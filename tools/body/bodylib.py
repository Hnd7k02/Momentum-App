"""The Momentum body, built from the MakeHuman base mesh (MPFB2 data, CC0 1.0).

Everything here is numpy and the standard library, so that the same input
gives the same bytes: no Blender, no solver with a random start, no threads
that could add in another order.

The steps, each a function:

  load_base()        the base mesh as MPFB2 ships it: 19'158 vertices, all quads
  shape()            macro targets (gender, age, muscle, weight, proportions,
                     height) and local targets, with MakeHuman's own weighting
  pose()             linear blend skinning with the default rig: arms, elbows,
                     palms, fingers, legs, feet
  body_only()        the body without helper geometry, in metres, on the ground
  subdivide()        one Catmull-Clark step on the muscle regions only; the
                     inert zone keeps the base resolution, stitched without a gap
  relief()           the relief MakeHuman lacks: its own muscle detail made
                     sharper, grooves along named lines, a mild unsharp mask
  write_glb()        one mesh, one primitive per region, the material name is
                     the muscle-group id — the contract with the app

`build.py` runs them for one candidate and hands the result to
`refine-body.mjs`, which draws the borders along the grooves, bakes the shade
and quantizes.
"""
from __future__ import annotations

import gzip
import json
import math
import struct
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
DATA = HERE / 'makehuman'

#: The order of the primitives in the GLB. It is the order of today's file;
#: the app finds a region by its material name, never by its place.
REGIONS = ['none', 'chest', 'back', 'shoulders', 'biceps', 'triceps', 'core',
           'quadriceps', 'hamstringsGlutes', 'calves', 'forearms']
R = {name: index for index, name in enumerate(REGIONS)}
NONE = R['none']


# ── the base mesh ─────────────────────────────────────────────────────────────

class Base:
    """The MakeHuman base mesh and what belongs to it."""

    def __init__(self, data: Path = DATA):
        self.data = Path(data)
        #: every file read, relative to the data folder — vendor.py copies these
        self.read = set()
        vertices, faces, groups = [], [], []
        group = None
        with open(self._file('3dobjs/base.obj')) as handle:
            for line in handle:
                if line.startswith('v '):
                    vertices.append([float(x) for x in line.split()[1:4]])
                elif line.startswith('g '):
                    group = line.split()[1]
                elif line.startswith('f '):
                    faces.append([int(part.split('/')[0]) - 1 for part in line.split()[1:]])
                    groups.append(group)
        #: positions in MakeHuman's unit, a decimetre
        self.V = np.array(vertices, dtype=np.float64)
        self.faces = faces
        self.groups = groups
        with open(self._file('mesh_metadata/basemesh_vertex_groups.json')) as handle:
            self.vertex_groups = {
                name: np.concatenate([np.arange(a, b + 1) for a, b in spans])
                for name, spans in json.load(handle).items() if spans
            }
        with open(self._file('rigs/standard/rig.default.json')) as handle:
            self.rig = json.load(handle)
        with open(self._file('rigs/standard/weights.default.json')) as handle:
            self.weights = json.load(handle)['weights']
        #: the quads of the body proper, and the vertices they use
        self.body_quads = np.array([f for f, g in zip(faces, groups) if g == 'body'], dtype=np.int64)
        self.body_vertices = np.unique(self.body_quads)

    def _file(self, relative: str) -> Path:
        path = self.data / relative
        if not path.is_file():
            raise SystemExit(
                f'{relative} is not in {self.data}. The repository keeps only the MakeHuman files its '
                f'candidates read; after a change that needs another one, run tools/body/vendor.py '
                f'(tools/body/README.md).')
        self.read.add(relative)
        return path

    def target(self, name: str):
        indices, deltas = [], []
        with gzip.open(self._file(f'targets/{name}.target.gz'), 'rt') as handle:
            for line in handle:
                line = line.strip()
                if not line or line.startswith('#'):
                    continue
                parts = line.split()
                indices.append(int(parts[0]))
                deltas.append([float(parts[1]), float(parts[2]), float(parts[3])])
        return np.array(indices, dtype=np.int64), np.array(deltas, dtype=np.float64).reshape(-1, 3)


# ── shape ─────────────────────────────────────────────────────────────────────

def macro_targets(gender=1.0, age=0.5, muscle=0.8, weight=0.5, proportions=1.0, height=0.5):
    """The macro targets and their weights, as MakeHuman combines them.

    gender 0..1 (1 male), age 0..1 (0.5 is 25 years), muscle and weight 0..1
    (0.5 average), proportions 0..1 (1 ideal), height 0..1.
    """
    genders = {'female': 1 - gender, 'male': gender}
    if age < 0.5:
        young = max(0.0, (age - 0.1875) * 3.2)
        ages = {'baby': max(0.0, 1 - age * 5.333), 'child': max(0.0, min(1.0, 5.333 * age) - young),
                'young': young, 'old': 0.0}
    else:
        old = max(0.0, age * 2 - 1)
        ages = {'baby': 0.0, 'child': 0.0, 'young': 1 - old, 'old': old}

    def three(x, low, high, middle):
        out = {low: max(0.0, 1 - 2 * x), high: max(0.0, 2 * x - 1)}
        if middle:
            out[middle] = 1 - out[low] - out[high]
        return out

    muscles = three(muscle, 'minmuscle', 'maxmuscle', 'averagemuscle')
    weights = three(weight, 'minweight', 'maxweight', 'averageweight')
    props = three(proportions, 'uncommonproportions', 'idealproportions', None)
    heights = three(height, 'minheight', 'maxheight', None)
    races = {'african': 1 / 3, 'asian': 1 / 3, 'caucasian': 1 / 3}

    out = []
    for gk, gw in genders.items():
        for ak, aw in ages.items():
            for rk, rw in races.items():
                out.append((f'macrodetails/{rk}-{gk}-{ak}', rw * gw * aw))
            for mk, mw in muscles.items():
                for wk, ww in weights.items():
                    base = gw * aw * mw * ww
                    out.append((f'macrodetails/universal-{gk}-{ak}-{mk}-{wk}', base))
                    for pk, pw in props.items():
                        out.append((f'macrodetails/proportions/{gk}-{ak}-{mk}-{wk}-{pk}', base * pw))
                    for hk, hw in heights.items():
                        out.append((f'macrodetails/height/{gk}-{ak}-{mk}-{wk}-{hk}', base * hw))
    return [(name, w) for name, w in out if w >= 1e-6]


def shape(base: Base, macro: dict, local: dict | None = None):
    """The base mesh with the macro targets and the local ones applied."""
    V = base.V.copy()
    applied = []
    for name, weight in macro_targets(**macro) + sorted((local or {}).items()):
        if abs(weight) < 1e-6:
            continue
        indices, deltas = base.target(name)
        V[indices] += weight * deltas
        applied.append((name, round(weight, 4)))
    return V, applied


def joint(base: Base, V, name: str):
    """A joint of the skeleton: the centre of its little cube in the mesh."""
    return V[base.vertex_groups[name]].mean(axis=0)


# ── the head ──────────────────────────────────────────────────────────────────

def _base_normals(base: Base, V):
    quads = base.body_quads
    tris = np.concatenate([quads[:, [0, 1, 2]], quads[:, [0, 2, 3]]])
    normals = np.zeros_like(V)
    face = np.cross(V[tris[:, 1]] - V[tris[:, 0]], V[tris[:, 2]] - V[tris[:, 0]])
    for corner in range(3):
        np.add.at(normals, tris[:, corner], face)
    return normals / np.maximum(np.linalg.norm(normals, axis=1, keepdims=True), 1e-12)


def _base_neighbours(base: Base, n):
    neighbours = [set() for _ in range(n)]
    for quad in base.body_quads:
        for k in range(4):
            a, b = int(quad[k]), int(quad[(k + 1) % 4])
            neighbours[a].add(b)
            neighbours[b].add(a)
    return neighbours


def fill_eyes(base: Base, V):
    """Close the eye sockets with a calm eyeball, as a statue has it.

    The body mesh has no eyes: behind each pair of lids it has a pocket that
    holds MakeHuman's separate eyeball, and without the eyeball one looks into
    a dark slit. The pocket is turned inside out here. Its bottom, behind the
    eye, becomes the front of the eyeball; its rim at the lids stays where it
    is. No vertex is added and no face changes, so every target and every
    region still refers to the same indices.
    """
    V = V.copy()
    normals = _base_normals(base, V)
    neighbours = _base_neighbours(base, len(V))
    body = set(int(i) for i in base.body_vertices)
    BINS = 24
    for side in ('l', 'r'):
        centre = joint(base, V, f'joint-{side}-eye')
        eyeball = np.linalg.norm(V[base.vertex_groups[f'helper-{side}-eye']] - centre, axis=1).max()
        near = [i for i in body if np.linalg.norm(V[i] - centre) < 1.5 * eyeball]
        towards = {i for i in near
                   if np.dot(normals[i], _unit(centre - V[i])) > 0.3}
        # The pocket is what can be reached from its bottom without crossing a lid.
        start = min(towards, key=lambda i: V[i][2])
        pocket, stack = {start}, [start]
        while stack:
            for j in neighbours[stack.pop()]:
                if j in towards and j not in pocket:
                    pocket.add(j)
                    stack.append(j)
        index = np.array(sorted(pocket))
        rel = V[index] - centre
        dist = np.linalg.norm(rel, axis=1)
        polar = np.arccos(np.clip(rel[:, 2] / dist, -1, 1))        # 0 at the front of the eye
        around = np.arctan2(rel[:, 1], rel[:, 0])
        bins = np.floor((around + math.pi) / (2 * math.pi) * BINS).astype(int) % BINS
        rim_polar = np.full(BINS, np.nan)
        rim_dist = np.full(BINS, np.nan)
        for b in range(BINS):
            here = np.where(bins == b)[0]
            if len(here):
                k = here[polar[here].argmin()]
                rim_polar[b], rim_dist[b] = polar[k], dist[k]
        known = np.where(~np.isnan(rim_polar))[0]
        for b in range(BINS):                                       # an empty sector takes its neighbours'
            if np.isnan(rim_polar[b]):
                nearest = known[np.argmin(np.minimum((known - b) % BINS, (b - known) % BINS))]
                rim_polar[b], rim_dist[b] = rim_polar[nearest], rim_dist[nearest]
        # The rim, smooth around the eye: each sector between its two neighbours.
        position = (around + math.pi) / (2 * math.pi) * BINS - 0.5
        lower = np.floor(position).astype(int) % BINS
        upper = (lower + 1) % BINS
        t = position - np.floor(position)
        rim_p = (1 - t) * rim_polar[lower] + t * rim_polar[upper]
        rim_d = (1 - t) * rim_dist[lower] + t * rim_dist[upper]
        deepest = polar.max()
        share = np.clip((deepest - polar) / np.maximum(deepest - rim_p, 1e-9), 0, 1)   # 1 at the rim, 0 at the bottom
        new_polar = rim_p * share
        new_dist = rim_d * share + eyeball * (1 - share)
        moved = share < 0.999
        target = centre + np.c_[np.sin(new_polar) * np.cos(around), np.sin(new_polar) * np.sin(around),
                                np.cos(new_polar)] * new_dist[:, None]
        V[index[moved]] = target[moved]
        # Two rounds of smoothing, the rim held: the sectors leave no steps.
        free = [int(i) for i in index[moved]]
        for _ in range(2):
            V[free] = np.array([0.5 * V[i] + 0.5 * np.mean([V[j] for j in neighbours[i]], axis=0) for i in free])
    return V


def smooth_face(base: Base, V, pairs=14, strength=1.0):
    """The mannequin's head: the skull and the jaw stay, the features go soft.

    Three steps. The cavities of the mouth and the nostrils are found first —
    a vertex whose own normal runs into the head again within three
    centimetres lies inside one. The skin of the face is then smoothed without
    them, by Taubin's pairs of steps, which do not shrink the head; the
    smoothing fades out towards the ears, the crown and the throat. Last, each
    cavity is drawn tight across its own rim, so that nothing of it shows
    through the softened lips or nose.
    """
    V = V.copy()
    neighbours = _base_neighbours(base, len(V))
    head = set()
    for name, pairs_ in base.weights.items():
        if bone_segment(name.split('.')[0]) != 'head' or not pairs_:
            continue
        for index, weight in pairs_:
            if weight > 0.5:
                head.add(int(index))
    head &= set(int(i) for i in base.body_vertices)
    eye = joint(base, V, 'joint-l-eye')
    top = max(V[i][1] for i in head)
    chin = min(V[i][1] for i in head if V[i][2] > eye[2] - 0.3 and abs(V[i][0]) < 0.2)
    size = top - chin

    # The cavities: below the eyes and near the middle, a normal that meets the head again.
    normals = _base_normals(base, V)
    quads = np.array([q for q in base.body_quads if all(int(v) in head for v in q)])
    tris = np.concatenate([quads[:, [0, 1, 2]], quads[:, [0, 2, 3]]])
    A, e1, e2 = V[tris[:, 0]], V[tris[:, 1]] - V[tris[:, 0]], V[tris[:, 2]] - V[tris[:, 0]]
    hidden = set()
    for i in sorted(head):
        x, y, z = V[i]
        if abs(x) > 0.38 or y > eye[1] - 0.12 or z < eye[2] - 0.45:
            continue
        d = normals[i]
        o = V[i] + 0.003 * d
        h = np.cross(d, e2)
        det = (e1 * h).sum(axis=1)
        ok = np.abs(det) > 1e-12
        det = np.where(ok, det, 1.0)
        sv = o - A
        u = (sv * h).sum(axis=1) / det
        q = np.cross(sv, e1)
        v = (q @ d) / det
        t = (e2 * q).sum(axis=1) / det
        if (ok & (u >= 0) & (v >= 0) & (u + v <= 1) & (t > 1e-4) & (t < 0.3)).any():
            hidden.add(i)

    weight = np.zeros(len(V))
    for i in head:
        x, y, z = V[i]
        front = np.clip((z - (eye[2] - 0.75)) / 0.3, 0, 1)                 # fades out before the ears
        below = np.clip((top - 0.10 * size - y) / (0.12 * size), 0, 1)     # the crown keeps its shape
        above = np.clip((y - (chin - 0.10 * size)) / (0.15 * size), 0, 1)  # the throat is not the face
        weight[i] = strength * front * below * above
    # A vertex on a cavity's rim with fewer than three neighbours on the skin
    # would be smoothed between those two alone — and its twin across the rim
    # with it, onto the same spot. It goes with the cavity instead.
    grew = True
    while grew:
        grew = False
        for i in sorted(head):
            if i not in hidden and weight[i] > 0 and any(j in hidden for j in neighbours[i]) \
                    and sum(1 for j in neighbours[i] if j not in hidden) < 3:
                hidden.add(i)
                grew = True
    skin = [i for i in sorted(head) if weight[i] > 0 and i not in hidden]
    skin_neighbours = {i: [j for j in neighbours[i] if j not in hidden] for i in skin}
    for _ in range(pairs):
        for factor in (0.5, -0.53):
            mean = np.array([np.mean([V[j] for j in skin_neighbours[i]], axis=0) if skin_neighbours[i] else V[i]
                             for i in skin])
            V[skin] += factor * weight[skin][:, None] * (mean - V[skin])
    # Drawn tight, but not flat: three tenths of each cavity's depth stay, inside
    # the head. Drawn quite flat its faces lose their area, refine-body.mjs
    # drops them, and the body is no longer closed.
    inside = sorted(hidden)
    before = V[inside].copy()
    for _ in range(300):
        V[inside] = np.array([np.mean([V[j] for j in neighbours[i]], axis=0) for i in inside])
    V[inside] = 0.7 * V[inside] + 0.3 * before
    return V


# ── pose ──────────────────────────────────────────────────────────────────────

def _unit(v):
    return v / np.linalg.norm(v)


def _rotation(axis, degrees):
    axis = _unit(axis)
    t = math.radians(degrees)
    K = np.array([[0, -axis[2], axis[1]], [axis[2], 0, -axis[0]], [-axis[1], axis[0], 0]])
    return np.eye(3) + math.sin(t) * K + (1 - math.cos(t)) * (K @ K)


def _rotation_between(a, b):
    a, b = _unit(a), _unit(b)
    axis = np.cross(a, b)
    s = np.linalg.norm(axis)
    c = float(np.dot(a, b))
    if s < 1e-9:
        return np.eye(3)
    return _rotation(axis, math.degrees(math.atan2(s, c)))


def _affine(Rm, pivot):
    M = np.eye(4)
    M[:3, :3] = Rm
    M[:3, 3] = pivot - Rm @ pivot
    return M


class Pose:
    """A pose as one rigid transform per bone, applied to whole subtrees."""

    def __init__(self, base: Base, V):
        self.base = base
        self.V = V
        self.T = {name: np.eye(4) for name in base.rig}
        self.children: dict = {}
        for name, bone in base.rig.items():
            self.children.setdefault(bone.get('parent'), []).append(name)
        self.info: dict = {}

    def subtree(self, name):
        out, stack = [], [name]
        while stack:
            n = stack.pop()
            out.append(n)
            stack.extend(self.children.get(n, []))
        return out

    def apply(self, T, root):
        for name in self.subtree(root):
            self.T[name] = T @ self.T[name]

    def at(self, bone, point):
        """Where a rest-pose point is now, carried by `bone`."""
        return (self.T[bone] @ np.append(point, 1.0))[:3]

    def joint(self, name):
        return joint(self.base, self.V, name)

    def skin(self):
        """Linear blend skinning with the default weights, normalised."""
        V = self.V
        n = len(V)
        total = np.zeros(n)
        acc = np.zeros((n, 3))
        Vh = np.c_[V, np.ones(n)]
        for name, pairs in self.base.weights.items():
            if not pairs:
                continue
            arr = np.array(pairs)
            vi = arr[:, 0].astype(np.int64)
            vw = arr[:, 1]
            T = self.T.get(name, np.eye(4))
            np.add.at(acc, vi, vw[:, None] * (Vh[vi] @ T.T)[:, :3])
            np.add.at(total, vi, vw)
        out = V.copy()
        moved = total > 0
        out[moved] = acc[moved] / total[moved, None]
        return out

    def dominant_bones(self):
        """Per vertex, the bone with the largest weight: the start of the regions."""
        bones = sorted(self.base.weights.keys())
        n = len(self.V)
        best_w = np.zeros(n)
        best_b = np.full(n, -1)
        for bi, name in enumerate(bones):
            pairs = self.base.weights[name]
            if not pairs:
                continue
            arr = np.array(pairs)
            vi = arr[:, 0].astype(np.int64)
            vw = arr[:, 1]
            better = vw > best_w[vi]
            best_w[vi[better]] = vw[better]
            best_b[vi[better]] = bi
        return bones, best_b


FORWARD = np.array([0.0, 0.0, 1.0])
UP = np.array([0.0, 1.0, 0.0])


def pose(base: Base, V, arm=-1.0, armfwd=0.0, elbow=0.0, palm=None, fingers=0.0, clavicle=0.0,
         leg=-1.0, shin=None, toes=None, wrist=0.0, spread=0.0, thumb=0.0):
    """Bring the rest pose to a standing one.

    arm       the upper arms' angle from the vertical in the front view, degrees
    armfwd    how far the upper arms hang forward of the body's plane
    elbow     the elbows' flexion
    palm      None leaves the forearm's twist of the rest pose; a number turns
              the palms to the thighs and then that many degrees further to the front
    fingers   curl of each finger joint
    spread    how much of the fingers' fan is closed, 0..1: 1 lays index, ring
              and little finger parallel to the middle finger
    thumb     how far the thumb is laid towards the index finger, degrees
    clavicle  how far the shoulder girdle is lowered
    leg       the thighs' angle from the vertical in the front view
    shin      the same for the lower legs (default: as `leg`)
    toes      how far the feet point outwards; None leaves the rest pose
    """
    p = Pose(base, V)
    for side, sx in (('L', 1.0), ('R', -1.0)):
        s = side.lower()
        S, E, H = p.joint(f'joint-{s}-shoulder'), p.joint(f'joint-{s}-elbow'), p.joint(f'joint-{s}-hand')
        up = E - S
        p.info[f'rest_arm_{side}'] = round(math.degrees(math.atan2(abs(up[0]), -up[1])), 1)
        p.info[f'rest_forearm_forward_{side}'] = round(math.degrees(math.asin(_unit(H - E)[2])), 1)

        if clavicle:
            C = p.joint(f'joint-{s}-clavicle')
            # Lowering the left shoulder turns it clockwise about the forward axis.
            p.apply(_affine(_rotation(FORWARD, -clavicle * sx), C), f'clavicle.{side}')

        if arm >= 0:
            a, f = math.radians(arm), math.radians(armfwd)
            target = _unit(np.array([sx * math.sin(a), -math.cos(a), 0.0]))
            target = _rotation(np.array([1.0, 0, 0]), -math.degrees(f)) @ target
            Sp, Ep = p.at(f'upperarm01.{side}', S), p.at(f'upperarm01.{side}', E)
            p.apply(_affine(_rotation_between(Ep - Sp, target), Sp), f'upperarm01.{side}')
            # The forearm continues the upper arm, flexed forward by `elbow`.
            Ep, Hp = p.at(f'lowerarm01.{side}', E), p.at(f'lowerarm01.{side}', H)
            n = _unit(FORWARD - np.dot(FORWARD, target) * target)
            e = math.radians(elbow)
            forearm = math.cos(e) * target + math.sin(e) * n
            p.apply(_affine(_rotation_between(Hp - Ep, forearm), Ep), f'lowerarm01.{side}')

        if palm is not None:
            # Turn the forearm about its own axis until the palm faces the
            # thigh. Half of the twist at the elbow end of the forearm, half
            # at its middle: the wrist then turns by the whole and nothing
            # wrings. `palm` is added to that, in degrees towards the front.
            Ep, Hp = p.at(f'lowerarm01.{side}', E), p.at(f'wrist.{side}', H)
            axis = _unit(Hp - Ep)
            index = p.at(f'wrist.{side}', p.joint(f'joint-{s}-finger-2-1'))
            little = p.at(f'wrist.{side}', p.joint(f'joint-{s}-finger-5-1'))
            middle = p.at(f'wrist.{side}', p.joint(f'joint-{s}-finger-3-1'))
            normal = np.cross(little - index, middle - Hp) * sx      # out of the palm
            normal = _unit(normal - np.dot(normal, axis) * axis)
            medial = np.array([-sx, 0.0, 0.0])
            wanted = _unit(medial - np.dot(medial, axis) * axis)
            twist = math.degrees(math.atan2(np.dot(np.cross(normal, wanted), axis), np.dot(normal, wanted)))
            twist += palm * sx
            p.info[f'palm_twist_{side}'] = round(twist, 1)
            for bone in (f'lowerarm01.{side}', f'lowerarm02.{side}'):
                Ep, Hp = p.at(f'lowerarm01.{side}', E), p.at(f'wrist.{side}', H)
                p.apply(_affine(_rotation(Hp - Ep, 0.5 * twist), Ep), bone)

        if wrist:
            # Straighten or bend the hand about the axis across the palm.
            Hp = p.at(f'wrist.{side}', H)
            across = p.at(f'wrist.{side}', p.joint(f'joint-{s}-finger-5-1')) - p.at(f'wrist.{side}', p.joint(f'joint-{s}-finger-2-1'))
            p.apply(_affine(_rotation(across, wrist * sx), Hp), f'wrist.{side}')

        if spread or thumb:
            # In the rest pose the fingers fan out and the thumb stands off:
            # a hand that is held open. A hand that hangs is closed.
            knuckle = {f: p.joint(f'joint-{s}-finger-{f}-1') for f in (1, 2, 3, 4, 5)}
            tip = {f: p.joint(f'joint-{s}-finger-{f}-4') for f in (1, 2, 3, 4, 5)}
            normal = _unit(np.cross(knuckle[5] - knuckle[2], knuckle[3] - H))
            flat = lambda v: _unit(v - np.dot(v, normal) * normal)
            middle_dir = flat(tip[3] - knuckle[3])
            for finger in (2, 4, 5):
                if not spread:
                    break
                own = flat(tip[finger] - knuckle[finger])
                angle = math.degrees(math.atan2(np.dot(np.cross(own, middle_dir), normal), np.dot(own, middle_dir)))
                bone = f'finger{finger}-1.{side}'
                Rb = p.T[bone][:3, :3]
                p.apply(_affine(_rotation(Rb @ normal, spread * angle), p.at(bone, knuckle[finger])), bone)
            if thumb:
                bone = f'finger1-1.{side}'
                own = tip[1] - knuckle[1]
                towards = p.joint(f'joint-{s}-finger-2-2') - knuckle[1]
                axis = np.cross(own, towards)
                full = math.degrees(math.atan2(np.linalg.norm(axis), np.dot(own, towards)))
                Rb = p.T[bone][:3, :3]
                p.apply(_affine(_rotation(Rb @ _unit(axis), min(thumb, 0.9 * full)), p.at(bone, knuckle[1])), bone)

        if fingers:
            index = p.joint(f'joint-{s}-finger-2-1')
            little = p.joint(f'joint-{s}-finger-5-1')
            middle = p.joint(f'joint-{s}-finger-3-1')
            for finger in (2, 3, 4, 5):
                for segment, share in ((1, 0.8), (2, 1.0), (3, 0.7)):
                    bone = f'finger{finger}-{segment}.{side}'
                    if bone not in base.rig:
                        continue
                    pivot = p.at(bone, p.joint(f'joint-{s}-finger-{finger}-{segment}'))
                    across = p.at(bone, little) - p.at(bone, index)
                    along = p.at(bone, middle) - p.at(bone, H)
                    palm_normal = np.cross(across, along) * sx
                    # Curl towards the palm: pick the sense that moves the
                    # finger's tip to the palm's side.
                    tip_name = f'joint-{s}-finger-{finger}-4'
                    tip = p.at(bone, p.joint(tip_name)) if tip_name in base.vertex_groups else pivot + along
                    for sense in (1.0, -1.0):
                        Rm = _rotation(across, sense * fingers * share)
                        moved = Rm @ (tip - pivot) + pivot
                        if np.dot(moved - tip, palm_normal) > 0:
                            p.apply(_affine(Rm, pivot), bone)
                            break

        if leg >= 0:
            Hj, K, A = p.joint(f'joint-{s}-upper-leg'), p.joint(f'joint-{s}-knee'), p.joint(f'joint-{s}-ankle')
            thigh = K - Hj
            p.info[f'rest_leg_{side}'] = round(math.degrees(math.atan2(abs(thigh[0]), -thigh[1])), 1)
            a = math.radians(leg)
            target = np.array([sx * math.sin(a), -math.cos(a), _unit(thigh)[2]])
            p.apply(_affine(_rotation_between(thigh, target), Hj), f'upperleg01.{side}')
            Kp, Ap = p.at(f'lowerleg01.{side}', K), p.at(f'lowerleg01.{side}', A)
            lower = Ap - Kp
            b = math.radians(leg if shin is None else shin)
            starget = np.array([sx * math.sin(b), -1.0, 0.0])
            starget[2] = _unit(lower)[2]
            p.apply(_affine(_rotation_between(lower, starget), Kp), f'lowerleg01.{side}')
            # The feet flat on the ground again, as in the rest pose.
            Ap2 = p.at(f'foot.{side}', A)
            p.apply(_affine(np.linalg.inv(p.T[f'foot.{side}'][:3, :3]), Ap2), f'foot.{side}')
            if toes is not None:
                # The foot's own direction: from the ankle to between the
                # second and the third toe.
                heading = 0.5 * (p.joint(f'joint-{s}-toe-2-1') + p.joint(f'joint-{s}-toe-3-1')) - A
                rest = math.degrees(math.atan2(heading[0] * sx, heading[2]))
                p.info[f'rest_toes_out_{side}'] = round(rest, 1)
                p.apply(_affine(_rotation(UP, (toes - rest) * sx), Ap2), f'foot.{side}')
    return p


# ── the straight cuts between the inert zone and the muscles ─────────────────

#: Where each cut lies, relative to its joint (metres on a body of 1.78 m,
#: degrees). The owner's wording at the gate of block 7A: "at the base of the
#: neck a calm, nearly level cut without a V and without waves; at wrist and
#: ankle a straight cut."
CUTS = {
    # The neck is a clean column from about a centimetre below the neck joint
    # upwards; lower, the slope of the trapezius leaves it and a level plane
    # would run out along the shoulders. Tilted a little, the front lower: a
    # collar, not a V.
    'neck_drop': 0.006, 'neck_tilt': 5.0,
    # Across the forearm, at the wrist joint.
    'wrist_shift': 0.0,
    # Across the shin, above the joint, so that the ankle bones go with the foot.
    'ankle_lift': 0.035,
}


def cut_planes(joints, height, overrides=None):
    """The five cuts: name → (a point on the plane, its normal, the radius it holds in).

    The normal points to the inert side — up the neck, down the hand, down the
    foot. One definition serves the rules that label the vertices and the
    build that cuts the mesh, so the two cannot part.
    """
    k = height / 1.78
    o = {**CUTS, **(overrides or {})}
    tilt = math.radians(o['neck_tilt'])
    cuts = {'neck': (joints['joint-neck'] - np.array([0.0, o['neck_drop'] * k, 0.0]),
                     np.array([0.0, math.cos(tilt), math.sin(tilt)]), 0.17 * k)}
    for side in ('l', 'r'):
        E, Hd = joints[f'joint-{side}-elbow'], joints[f'joint-{side}-hand']
        n = _unit(Hd - E)
        cuts[f'wrist-{side}'] = (Hd + n * o['wrist_shift'] * k, n, 0.09 * k)
        K, A = joints[f'joint-{side}-knee'], joints[f'joint-{side}-ankle']
        n = _unit(A - K)
        cuts[f'ankle-{side}'] = (A - n * o['ankle_lift'] * k, n, 0.11 * k)
    return cuts


def cut(P, tris, labels, point, normal, radius, inert, snap=0.0003, margin=0.012):
    """Cut the mesh along a plane and give the far side to the inert zone.

    Within `radius` of `point`, every triangle the plane crosses is split, so
    that the plane's line on the body becomes a loop of edges; no vertex is
    moved, a new one lies on an old edge, and the surface is the one it was.
    What then lies beyond the plane is inert. What lies before it and was
    inert takes the region of the muscle next to it.

    A vertex within `snap` of the plane counts as on it: the cut goes through
    it rather than leaving a sliver beside it.
    """
    P = np.asarray(P, dtype=np.float64)
    tris = np.asarray(tris, dtype=np.int64)
    labels = np.asarray(labels).copy()
    d = (P - point) @ normal
    d[np.abs(d) < snap] = 0.0
    centre = P[tris].mean(axis=1)
    away = np.linalg.norm(centre - point, axis=1)
    td = d[tris]
    crossing = (td.max(axis=1) > 0) & (td.min(axis=1) < 0)
    # The loop must lie well inside the radius: a crossing triangle at its
    # edge would be split while its neighbour beyond is not.
    if (crossing & (np.abs(away - radius) < margin)).any():
        raise SystemExit('a cut reaches the edge of the zone it holds in — its radius is wrong for this body')
    todo = crossing & (away < radius)

    points = [row for row in P]
    made = {}

    def on_edge(a, b):
        key = (a, b) if a < b else (b, a)
        if key not in made:
            t = d[a] / (d[a] - d[b])
            made[key] = len(points)
            points.append(P[a] + t * (P[b] - P[a]))
        return made[key]

    out_tris, out_labels, out_side = [], [], []

    def emit(a, b, c, label, side):
        out_tris.append((a, b, c))
        out_labels.append(label)
        out_side.append(side)

    for t in range(len(tris)):
        a, b, c = (int(x) for x in tris[t])
        if not todo[t]:
            side = 0
            if away[t] < radius:
                side = 1 if td[t].sum() > 0 else -1
            emit(a, b, c, labels[t], side)
            continue
        # Turn the triangle, winding kept, so that the corner that stands
        # alone — on the plane, or alone on its side — comes first.
        corners = [(a, d[a]), (b, d[b]), (c, d[c])]
        zero = [i for i, (_, x) in enumerate(corners) if x == 0]
        if zero:
            first = zero[0]
        else:
            signs = [x > 0 for _, x in corners]
            first = next(i for i in range(3) if signs[i] != signs[(i + 1) % 3] and signs[i] != signs[(i + 2) % 3])
        (a, da), (b, db), (c, dc) = corners[first], corners[(first + 1) % 3], corners[(first + 2) % 3]
        if da == 0:
            m = on_edge(b, c)
            emit(a, b, m, labels[t], 1 if db > 0 else -1)
            emit(a, m, c, labels[t], 1 if dc > 0 else -1)
        else:
            mab, mca = on_edge(a, b), on_edge(c, a)
            emit(a, mab, mca, labels[t], 1 if da > 0 else -1)
            other = 1 if db > 0 else -1
            # The quad that is left: along its shorter diagonal.
            if np.linalg.norm(points[mab] - P[c]) <= np.linalg.norm(P[b] - points[mca]):
                emit(mab, b, c, labels[t], other)
                emit(mab, c, mca, labels[t], other)
            else:
                emit(mab, b, mca, labels[t], other)
                emit(b, c, mca, labels[t], other)

    P2 = np.array(points)
    tris2 = np.array(out_tris, dtype=np.int64)
    labels2 = np.array(out_labels)
    side = np.array(out_side)
    labels2[side > 0] = inert
    # Before the plane nothing is inert: such a triangle takes the region of
    # the nearest triangle that has one, across shared edges, ring by ring.
    owners = {}
    for t, tri in enumerate(tris2):
        if side[t] < 0:
            for i in range(3):
                x, y = int(tri[i]), int(tri[(i + 1) % 3])
                owners.setdefault((x, y) if x < y else (y, x), []).append(t)
    pending = [t for t in range(len(tris2)) if side[t] < 0 and labels2[t] == inert]
    while pending:
        taken = {}
        for t in pending:
            tri = tris2[t]
            for i in range(3):
                x, y = int(tri[i]), int(tri[(i + 1) % 3])
                for other in owners[(x, y) if x < y else (y, x)]:
                    if other != t and labels2[other] != inert and t not in taken:
                        taken[t] = labels2[other]
        if not taken:
            raise SystemExit('a cut left an inert piece with no muscle beside it')
        for t, label in taken.items():
            labels2[t] = label
        pending = [t for t in pending if t not in taken]
    return P2, tris2, labels2


def pieces(tris, labels, label):
    """The connected pieces of one region: a list of arrays of triangle indices, largest first."""
    index = np.where(np.asarray(labels) == label)[0]
    position = {int(t): n for n, t in enumerate(index)}
    parent = list(range(len(index)))

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    first = {}
    for t in index:
        tri = tris[t]
        for i in range(3):
            x, y = int(tri[i]), int(tri[(i + 1) % 3])
            key = (x, y) if x < y else (y, x)
            if key in first:
                ra, rb = find(position[int(t)]), find(first[key])
                if ra != rb:
                    parent[ra] = rb
            else:
                first[key] = position[int(t)]
    groups = {}
    for n, t in enumerate(index):
        groups.setdefault(find(n), []).append(int(t))
    return sorted((np.array(g) for g in groups.values()), key=lambda g: (-len(g), int(g[0])))


# ── the body alone, in metres ────────────────────────────────────────────────

class Body:
    """A body mesh on the fixed topology: positions, quads, and what was measured on the way."""

    def __init__(self, P, quads, joints, origin):
        self.P = P                # (n, 3) metres, y up, +x the body's left, +z forward
        self.quads = quads        # (m, 4) indices into P
        self.joints = joints      # name -> (3,) metres
        self.origin = origin      # index of each vertex in the base mesh


def body_only(base: Base, V, pose_obj: Pose | None = None, height: float | None = None) -> Body:
    """The body without helpers, in metres, feet on the ground, centred in x."""
    used = base.body_vertices
    remap = -np.ones(len(V), dtype=np.int64)
    remap[used] = np.arange(len(used))
    P = V[used] * 0.1
    low = P[:, 1].min()
    mid = 0.5 * (P[:, 0].min() + P[:, 0].max())
    shift = np.array([mid, low, 0.0])
    P = P - shift
    joints = {}
    for name in base.vertex_groups:
        if not name.startswith('joint-'):
            continue
        point = joint(base, V, name) * 0.1 - shift
        joints[name] = point
    if height is not None:
        scale = height / P[:, 1].max()
        P = P * scale
        joints = {k: v * scale for k, v in joints.items()}
    return Body(P, remap[base.body_quads], joints, used)


# ── regions ───────────────────────────────────────────────────────────────────

def bone_segment(name: str) -> str:
    if name.startswith('upperarm'):
        return 'upperarm'
    if name.startswith('lowerarm'):
        return 'lowerarm'
    if name.startswith(('wrist', 'metacarpal', 'finger')):
        return 'hand'
    if name.startswith('upperleg'):
        return 'upperleg'
    if name.startswith('lowerleg'):
        return 'lowerleg'
    if name.startswith(('foot', 'toe')):
        return 'foot'
    if name.startswith(('root', 'spine', 'clavicle', 'breast', 'shoulder', 'pelvis')):
        return 'torso'
    return 'head'


def face_labels(vertex_labels, quads):
    """A quad takes the region most of its corners have; a tie goes to the first corner."""
    labels = vertex_labels[quads]
    out = labels[:, 0].copy()
    for i in range(len(quads)):
        row = labels[i]
        values, counts = np.unique(row, return_counts=True)
        best = counts.max()
        winners = values[counts == best]
        out[i] = row[0] if row[0] in winners else winners[0]
    return out


# ── subdivision ───────────────────────────────────────────────────────────────

def subdivide(P, quads, labels, refine_mask, weight=None):
    """One Catmull-Clark step on the quads of `refine_mask`; the rest stays coarse.

    Positions are those of a Catmull-Clark step over the whole mesh, so the
    surface is one smooth surface. Where a coarse quad meets a refined one it
    takes the new point on the shared edge into its outline and is closed as
    a fan around its centre: no gap, no T-junction.

    The step rounds the surface a little, and the coarse zone is not rounded:
    where the two meet, the rounded side ends in a step — a ring round the
    limb. `weight`, one number in [0, 1] for every old vertex, says how much
    of the rounding a vertex takes; falling to 0 towards the coarse zone, it
    lets the rounding run out instead of ending. A new point on an edge takes
    the mean of its ends' weights. Without it every touched vertex is rounded
    in full, as before.

    Returns the new positions, the triangles, their regions, and for every new
    vertex the old vertices it is the mean of (for carrying fields across).
    """
    n = len(P)
    m = len(quads)
    face_point = P[quads].mean(axis=1)

    edge_index: dict = {}
    edge_faces: list = []
    edge_ends: list = []
    face_edges = np.zeros((m, 4), dtype=np.int64)
    for f in range(m):
        q = quads[f]
        for c in range(4):
            a, b = int(q[c]), int(q[(c + 1) % 4])
            key = (a, b) if a < b else (b, a)
            e = edge_index.get(key)
            if e is None:
                e = len(edge_ends)
                edge_index[key] = e
                edge_ends.append(key)
                edge_faces.append([])
            edge_faces[e].append(f)
            face_edges[f, c] = e
    edge_ends_arr = np.array(edge_ends, dtype=np.int64)
    ne = len(edge_ends)

    # Edge points: the mean of the two ends and the two face points; a border
    # edge of the mesh takes its midpoint.
    edge_point = np.zeros((ne, 3))
    for e in range(ne):
        a, b = edge_ends[e]
        fs = edge_faces[e]
        if len(fs) == 2:
            edge_point[e] = (P[a] + P[b] + face_point[fs[0]] + face_point[fs[1]]) / 4.0
            if weight is not None:
                share = (weight[a] + weight[b]) / 2.0
                edge_point[e] = (1.0 - share) * (P[a] + P[b]) / 2.0 + share * edge_point[e]
        else:
            edge_point[e] = (P[a] + P[b]) / 2.0

    # Vertex points: (F + 2R + (k - 3) P) / k.
    face_sum = np.zeros((n, 3))
    face_count = np.zeros(n)
    for c in range(4):
        np.add.at(face_sum, quads[:, c], face_point)
        np.add.at(face_count, quads[:, c], 1)
    mid_sum = np.zeros((n, 3))
    edge_count = np.zeros(n)
    mids = (P[edge_ends_arr[:, 0]] + P[edge_ends_arr[:, 1]]) / 2.0
    np.add.at(mid_sum, edge_ends_arr[:, 0], mids)
    np.add.at(mid_sum, edge_ends_arr[:, 1], mids)
    np.add.at(edge_count, edge_ends_arr[:, 0], 1)
    np.add.at(edge_count, edge_ends_arr[:, 1], 1)
    k = np.maximum(face_count, 1)[:, None]
    smooth = (face_sum / k + 2.0 * mid_sum / np.maximum(edge_count, 1)[:, None] + (k - 3.0) * P) / k

    # A vertex moves only if a refined quad touches it; the coarse zone keeps
    # its shape exactly.
    touched = np.zeros(n, dtype=bool)
    touched[np.unique(quads[refine_mask])] = True
    interior = (face_count == edge_count) & (face_count >= 3)
    vertex_point = np.where((touched & interior)[:, None], smooth, P)
    if weight is not None:
        vertex_point = P + np.asarray(weight, dtype=np.float64)[:, None] * (vertex_point - P)

    edge_used = np.zeros(ne, dtype=bool)
    edge_used[np.unique(face_edges[refine_mask])] = True
    edge_new = -np.ones(ne, dtype=np.int64)
    edge_new[edge_used] = n + np.arange(int(edge_used.sum()))
    n_edges = int(edge_used.sum())

    # A face point is needed by every refined quad, and by every coarse quad
    # that has to take a new edge point into its outline.
    split_edges = edge_used[face_edges]                    # (m, 4)
    needs_centre = refine_mask | split_edges.any(axis=1)
    face_new = -np.ones(m, dtype=np.int64)
    face_new[needs_centre] = n + n_edges + np.arange(int(needs_centre.sum()))

    out_P = np.concatenate([vertex_point, edge_point[edge_used], face_point[needs_centre]])
    # What each new vertex is made of, as (index, weight) lists on the old vertices.
    parents = [None] * len(out_P)
    for e in np.nonzero(edge_used)[0]:
        parents[edge_new[e]] = edge_ends[e]
    for f in np.nonzero(needs_centre)[0]:
        parents[face_new[f]] = tuple(int(x) for x in quads[f])

    # Which way the refined quads are cut into triangles. All the diagonals of
    # a patch should run the same way, so that every vertex has six
    # neighbours: a fan of diagonals around every other vertex gives the
    # vertices two kinds of neighbourhood, and whatever smooths over
    # neighbours (the baked shade, for one) then draws a dotted pattern. The
    # way is chosen per quad against a fixed direction, mirrored for the
    # body's two halves, so that neighbouring quads agree and left agrees
    # with right.
    centroid_x = P[quads][:, :, 0].mean(axis=1)
    d02 = P[quads[:, 2]] - P[quads[:, 0]]
    d13 = P[quads[:, 3]] - P[quads[:, 1]]
    d02 /= np.linalg.norm(d02, axis=1, keepdims=True) + 1e-12
    d13 /= np.linalg.norm(d13, axis=1, keepdims=True) + 1e-12
    reference = np.stack([np.where(centroid_x >= 0, 1.0, -1.0), np.ones(m), np.full(m, 0.35)], axis=1)
    along02 = np.abs(np.einsum('ij,ij->i', d02, reference)) >= np.abs(np.einsum('ij,ij->i', d13, reference))

    tris, tri_labels = [], []
    for f in range(m):
        q = [int(x) for x in quads[f]]
        label = int(labels[f])
        if refine_mask[f]:
            centre = int(face_new[f])
            for c in range(4):
                v = q[c]
                e_next = int(edge_new[face_edges[f, c]])
                e_prev = int(edge_new[face_edges[f, (c + 3) % 4]])
                # The child quad v, e_next, centre, e_prev. Its diagonal runs
                # with the parent's chosen one: through the corner and the
                # centre at two opposite corners, across them at the others.
                if (c % 2 == 0) == bool(along02[f]):
                    tris.append((v, e_next, centre)); tri_labels.append(label)
                    tris.append((v, centre, e_prev)); tri_labels.append(label)
                else:
                    tris.append((v, e_next, e_prev)); tri_labels.append(label)
                    tris.append((e_next, centre, e_prev)); tri_labels.append(label)
        elif needs_centre[f]:
            centre = int(face_new[f])
            ring = []
            for c in range(4):
                ring.append(q[c])
                if split_edges[f, c]:
                    ring.append(int(edge_new[face_edges[f, c]]))
            for i in range(len(ring)):
                tris.append((ring[i], ring[(i + 1) % len(ring)], centre)); tri_labels.append(label)
        else:
            tris.append((q[0], q[1], q[2])); tri_labels.append(label)
            tris.append((q[0], q[2], q[3])); tri_labels.append(label)
    return out_P, np.array(tris, dtype=np.int64), np.array(tri_labels, dtype=np.int64), parents


def carry(values, parents, n_old):
    """A per-vertex field after `subdivide`: new vertices take the mean of their parents."""
    values = np.asarray(values, dtype=np.float64)
    out = np.zeros((len(parents),) + values.shape[1:])
    out[:n_old] = values
    for i in range(n_old, len(parents)):
        out[i] = values[list(parents[i])].mean(axis=0)
    return out


# ── mesh helpers ──────────────────────────────────────────────────────────────

def vertex_normals(P, tris):
    fn = np.cross(P[tris[:, 1]] - P[tris[:, 0]], P[tris[:, 2]] - P[tris[:, 0]])
    N = np.zeros_like(P)
    for c in range(3):
        np.add.at(N, tris[:, c], fn)
    return N / (np.linalg.norm(N, axis=1, keepdims=True) + 1e-12)


def adjacency(n, tris):
    """Neighbours of every vertex as two arrays (CSR), in a fixed order."""
    pairs = np.concatenate([tris[:, [0, 1]], tris[:, [1, 2]], tris[:, [2, 0]],
                            tris[:, [1, 0]], tris[:, [2, 1]], tris[:, [0, 2]]])
    pairs = np.unique(pairs, axis=0)
    offset = np.zeros(n + 1, dtype=np.int64)
    np.add.at(offset, pairs[:, 0] + 1, 1)
    offset = np.cumsum(offset)
    return offset, pairs[:, 1].copy(), pairs[:, 0].copy()


def neighbour_mean(field, offset, targets, sources):
    """The mean of a field over each vertex's neighbours."""
    acc = np.zeros_like(field)
    np.add.at(acc, sources, field[targets])
    degree = (offset[1:] - offset[:-1]).astype(np.float64)
    degree[degree == 0] = 1
    return acc / (degree[:, None] if field.ndim == 2 else degree)


def taubin(P, adj, iterations, mask=None):
    """Taubin smoothing: the shape without its fine relief, and without shrinking."""
    offset, targets, sources = adj
    cur = P.copy()
    for _ in range(iterations):
        for factor in (0.5, -0.53):
            mean = neighbour_mean(cur, offset, targets, sources)
            step = factor * (mean - cur)
            if mask is not None:
                step[~mask] = 0
            cur = cur + step
    return cur


def limit_curvature(P, tris, mask, sharpest, passes=120):
    """No fold sharper than `sharpest`: bend the surface back wherever it bends harder.

    A muscle is a broad form and a wrinkle is a narrow one, and what tells
    them apart is how hard the surface bends. The bend at a vertex is read as
    its mean curvature H (in 1/m; a rod of radius r has H = 1/2r), from how
    far the vertex stands off the mean of its neighbours along its normal:
    off = H * h^2 / 2 for edges of length h. Where |H| is above `sharpest`
    the vertex is moved half of the way back to where it would be just at
    the limit, and that is repeated: a crease opens into a soft valley, a
    spike settles into a low dome, and everything that bends more gently
    than the limit is not touched at all. Only the masked vertices move, and
    only along their normals, so the mesh does not slide.
    """
    adj = adjacency(len(P), tris)
    offset, targets, sources = adj
    cur = P.copy()
    for _ in range(passes):
        N = vertex_normals(cur, tris)
        mean = neighbour_mean(cur, offset, targets, sources)
        off = np.einsum('ij,ij->i', mean - cur, N)
        edge2 = np.zeros(len(cur))
        np.add.at(edge2, sources, ((cur[targets] - cur[sources]) ** 2).sum(axis=1))
        degree = np.maximum((offset[1:] - offset[:-1]).astype(np.float64), 1)
        allowed = sharpest * (edge2 / degree) / 2.0
        excess = np.sign(off) * np.maximum(np.abs(off) - allowed, 0.0)
        excess[~mask] = 0
        cur = cur + 0.5 * excess[:, None] * N
    return cur


def geodesic(P, adj, sources_mask, limit):
    """Distance along the edges to the nearest marked vertex, up to `limit` (Dijkstra)."""
    import heapq
    offset, targets, _ = adj
    n = len(P)
    dist = np.full(n, np.inf)
    heap = []
    for i in np.nonzero(sources_mask)[0]:
        dist[i] = 0.0
        heap.append((0.0, int(i)))
    heapq.heapify(heap)
    while heap:
        d, i = heapq.heappop(heap)
        if d > dist[i] or d > limit:
            continue
        for e in range(offset[i], offset[i + 1]):
            j = int(targets[e])
            nd = d + float(np.linalg.norm(P[i] - P[j]))
            if nd < dist[j]:
                dist[j] = nd
                heapq.heappush(heap, (nd, j))
    return dist


# ── GLB ───────────────────────────────────────────────────────────────────────

COPYRIGHT = ('Body built from the MakeHuman base mesh and targets and the skinning weights of Anny '
             '(NAVER Corp.), all CC0 1.0 Universal')


def write_glb(path, P, tris, tri_labels, generator, copyright=COPYRIGHT):
    """The body as refine-body.mjs reads it: float positions, one primitive per region."""
    N = vertex_normals(P, tris)
    pos = P.astype(np.float32)
    nrm = N.astype(np.float32)
    blobs = [pos.tobytes(), nrm.tobytes()]
    views = [dict(buffer=0, byteOffset=0, byteLength=len(blobs[0]), byteStride=12, target=34962),
             dict(buffer=0, byteOffset=len(blobs[0]), byteLength=len(blobs[1]), byteStride=12, target=34962)]
    accessors = [dict(bufferView=0, componentType=5126, count=len(pos), type='VEC3',
                      min=pos.min(0).tolist(), max=pos.max(0).tolist()),
                 dict(bufferView=1, componentType=5126, count=len(nrm), type='VEC3')]
    offset = len(blobs[0]) + len(blobs[1])
    primitives = []
    counts = {}
    for ri, name in enumerate(REGIONS):
        idx = tris[tri_labels == ri].astype(np.uint32).ravel()
        counts[name] = int((tri_labels == ri).sum())
        raw = idx.tobytes()
        pad = (-len(raw)) % 4
        blobs.append(raw + b'\0' * pad)
        views.append(dict(buffer=0, byteOffset=offset, byteLength=len(raw), target=34963))
        offset += len(raw) + pad
        accessors.append(dict(bufferView=len(views) - 1, componentType=5125, count=len(idx), type='SCALAR'))
        primitives.append(dict(attributes=dict(POSITION=0, NORMAL=1), indices=len(accessors) - 1, material=ri))
    gltf = dict(asset=dict(version='2.0', generator=generator, copyright=copyright),
                scene=0, scenes=[dict(nodes=[0])], nodes=[dict(mesh=0, name='MomentumBody')],
                meshes=[dict(name='MomentumBody', primitives=primitives)],
                materials=[dict(name=name) for name in REGIONS],
                buffers=[dict(byteLength=offset)], bufferViews=views, accessors=accessors)
    js = json.dumps(gltf, separators=(',', ':')).encode()
    js += b' ' * ((-len(js)) % 4)
    binary = b''.join(blobs)
    with open(path, 'wb') as handle:
        handle.write(struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(binary)))
        handle.write(struct.pack('<II', len(js), 0x4E4F534A))
        handle.write(js)
        handle.write(struct.pack('<II', len(binary), 0x004E4942))
        handle.write(binary)
    return counts


def read_glb(path):
    """Any body GLB of the app's contract: positions in metres, triangles, their regions."""
    raw = Path(path).read_bytes()
    json_length = struct.unpack_from('<I', raw, 12)[0]
    gltf = json.loads(raw[20:20 + json_length])
    binary = raw[20 + json_length + 8:]
    kinds = {5120: ('b', 1), 5121: ('B', 1), 5122: ('h', 2), 5123: ('H', 2), 5125: ('I', 4), 5126: ('f', 4)}
    width = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}

    def accessor(index):
        acc = gltf['accessors'][index]
        view = gltf['bufferViews'][acc['bufferView']]
        code, size = kinds[acc['componentType']]
        comps = width[acc['type']]
        stride = view.get('byteStride') or size * comps
        start = view.get('byteOffset', 0) + acc.get('byteOffset', 0)
        out = np.zeros((acc['count'], comps))
        dtype = np.dtype('<' + code)
        for c in range(comps):
            out[:, c] = np.ndarray(acc['count'], dtype=dtype, buffer=binary, offset=start + c * size, strides=(stride,))
        return out, acc

    node = next(n for n in gltf['nodes'] if n.get('mesh') == 0)
    scale = np.array(node.get('scale', [1, 1, 1]), dtype=np.float64)
    translation = np.array(node.get('translation', [0, 0, 0]), dtype=np.float64)
    primitives = gltf['meshes'][0]['primitives']
    positions, _ = accessor(primitives[0]['attributes']['POSITION'])
    P = positions * scale + translation
    tris, labels = [], []
    names = []
    for prim in primitives:
        name = gltf['materials'][prim['material']]['name']
        names.append(name)
        idx, _ = accessor(prim['indices'])
        t = idx.astype(np.int64).reshape(-1, 3)
        tris.append(t)
        labels.append(np.full(len(t), R[name]))
    return dict(P=P, tris=np.concatenate(tris), labels=np.concatenate(labels), gltf=gltf, bytes=len(raw))


# ── relief ────────────────────────────────────────────────────────────────────

def quad_adjacency(n, quads):
    """Neighbours along the edges of a quad mesh (CSR)."""
    pairs = np.concatenate([quads[:, [c, (c + 1) % 4]] for c in range(4)] +
                           [quads[:, [(c + 1) % 4, c]] for c in range(4)])
    pairs = np.unique(pairs, axis=0)
    offset = np.zeros(n + 1, dtype=np.int64)
    np.add.at(offset, pairs[:, 0] + 1, 1)
    return np.cumsum(offset), pairs[:, 1].copy(), pairs[:, 0].copy()


def high_pass(field, adj, iterations):
    """A field without its slow part: what is left after neighbour averaging is taken away."""
    offset, targets, sources = adj
    low = field.copy()
    for _ in range(iterations):
        low = 0.5 * low + 0.5 * neighbour_mean(low, offset, targets, sources)
    return field - low


def muscle_detail(base: Base, macro: dict, local: dict | None, iterations=10, soften=0, smooth=0):
    """What MakeHuman's own muscle slider adds in fine form, as a displacement.

    The difference between this body at full muscle and at average muscle is
    what MakeHuman's artists sculpted for "more muscle": bulk, and the lines
    between the muscles. High-passed, the bulk goes and the lines stay. Added
    to a body in multiples it sharpens the definition without making the body
    bigger — relief from the data itself, with no line drawn by hand.

    In multiples the finest part of it turns into folds: a line one vertex
    wide, three times as deep, is a crease. `soften` averages the
    displacement over the neighbours that many times, which takes the
    narrowest lines out and leaves the forms between the muscles — the
    relief is then a band of scales, neither the bulk nor the wrinkles.
    `smooth` does the same with Taubin's two steps, which cut the narrow
    lines off more sharply and take less from the forms beside them.
    """
    full, _ = shape(base, {**macro, 'muscle': 1.0}, local)
    plain, _ = shape(base, {**macro, 'muscle': 0.5}, local)
    used = base.body_vertices
    remap = -np.ones(len(base.V), dtype=np.int64)
    remap[used] = np.arange(len(used))
    adj = quad_adjacency(len(used), remap[base.body_quads])
    detail = high_pass((full - plain)[used], adj, iterations)
    offset, targets, sources = adj
    for _ in range(soften):
        detail = 0.5 * detail + 0.5 * neighbour_mean(detail, offset, targets, sources)
    if smooth:
        detail = taubin(detail, adj, smooth)
    out = np.zeros_like(base.V)
    out[used] = detail
    return out


def sharp_spots(base: Base, V, labels, regions, sharper_than, reach):
    """Where the base body has something small and sharp in the named regions.

    On MakeHuman's body that is the nipples and the navel: modelled in rings
    of edges a millimetre or two long, they bend the surface harder than
    anything a muscle does. On a body in one colour, an inch tall on a phone,
    they are specks — and with the relief in multiples, spikes. A vertex is
    a seed where the mean curvature (1/m, read as in `limit_curvature`) is
    above `sharper_than`; the spot is everything within `reach` metres of a
    seed along the surface, inside the muscles. Returns the spot as a mask
    over the body's vertices, and how many seeds it grew from.
    """
    used = base.body_vertices
    remap = -np.ones(len(base.V), dtype=np.int64)
    remap[used] = np.arange(len(used))
    quads = remap[base.body_quads]
    P = V[used] / 10.0                                    # the base mesh counts in decimetres
    adj = quad_adjacency(len(P), quads)
    offset, targets, sources = adj
    tris = np.concatenate([quads[:, [0, 1, 2]], quads[:, [0, 2, 3]]])
    N = vertex_normals(P, tris)
    off = np.einsum('ij,ij->i', neighbour_mean(P, offset, targets, sources) - P, N)
    edge2 = np.zeros(len(P))
    np.add.at(edge2, sources, ((P[targets] - P[sources]) ** 2).sum(axis=1))
    degree = np.maximum((offset[1:] - offset[:-1]).astype(np.float64), 1)
    curvature = 2.0 * off / np.maximum(edge2 / degree, 1e-12)
    labels = np.asarray(labels)
    seeds = np.isin(labels, [R[name] for name in regions]) & (np.abs(curvature) > sharper_than)
    dist = geodesic(P, adj, seeds, reach)
    return np.isfinite(dist) & (dist <= reach) & (labels != NONE), int(seeds.sum())


def relax_spots(base: Base, V, spot, passes=80):
    """The surface inside `spot` (a mask from `sharp_spots`), drawn smooth between its rim.

    Each pass moves every vertex of the spot halfway to the mean of its
    neighbours while the rim stays: after enough of them the spot is the
    calm surface its surroundings would have without it.
    """
    used = base.body_vertices
    remap = -np.ones(len(base.V), dtype=np.int64)
    remap[used] = np.arange(len(used))
    offset, targets, sources = quad_adjacency(len(used), remap[base.body_quads])
    cur = V[used].copy()
    for _ in range(passes):
        mean = neighbour_mean(cur, offset, targets, sources)
        cur[spot] = 0.5 * cur[spot] + 0.5 * mean[spot]
    out = V.copy()
    out[used] = cur
    return out


def unsharp(P, tris, mask, amount, iterations=6, limit=0.004):
    """Push every masked vertex away from a smoothed copy of the surface, along its normal.

    What stands out stands out more and what lies in lies deeper: the relief
    that is there reads at a smaller size. `limit` bounds the move in metres.
    """
    adj = adjacency(len(P), tris)
    smooth = taubin(P, adj, iterations)
    N = vertex_normals(P, tris)
    offset = np.einsum('ij,ij->i', P - smooth, N)
    move = np.clip(amount * offset, -limit, limit)
    move[~mask] = 0
    return P + move[:, None] * N


def groove(P, tris, seeds, depth, width, mask=None, adj=None):
    """A soft groove along the marked vertices: `depth` metres deep at its line,
    fading with the distance along the surface like a bell of width `width`."""
    adj = adj or adjacency(len(P), tris)
    d = geodesic(P, adj, seeds, 3.0 * width)
    fall = np.where(np.isfinite(d), np.exp(-(d / width) ** 2), 0.0)
    if mask is not None:
        fall[~mask] = 0
    N = vertex_normals(P, tris)
    return P - (depth * fall)[:, None] * N


# ── fewer triangles where nothing is told ─────────────────────────────────────

def decimate(P, tris, tri_labels, label, keep_share, flip_limit=0.2):
    """Collapse edges inside one region until `keep_share` of its triangles are left.

    Quadric error metrics (Garland and Heckbert): each vertex carries the sum
    of the squared distances to the planes of the triangles around it, and the
    edge whose collapse costs least goes first. Only a vertex that lies wholly
    inside the region may move; one on the seam to another region stays where
    it is, so the seam and everything beyond it is untouched. A collapse that
    would fold the surface over, or leave it non-manifold, is not made.

    Deterministic: the queue is ordered by cost and then by the two indices.
    """
    import heapq

    n = len(P)
    P = P.copy()
    tris = [list(map(int, t)) for t in tris]
    alive = [True] * len(tris)
    in_region = [int(l) == label for l in tri_labels]
    incident = [set() for _ in range(n)]
    for t, tri in enumerate(tris):
        for v in tri:
            incident[v].add(t)
    interior = [len(incident[v]) > 0 and all(in_region[t] for t in incident[v]) for v in range(n)]

    def plane(tri):
        a, b, c = P[tri[0]], P[tri[1]], P[tri[2]]
        normal = np.cross(b - a, c - a)
        area2 = np.linalg.norm(normal)
        if area2 < 1e-18:
            return None, 0.0
        normal = normal / area2
        return np.append(normal, -np.dot(normal, a)), 0.5 * area2

    Q = np.zeros((n, 4, 4))
    for t, tri in enumerate(tris):
        if not in_region[t]:
            continue
        pl, area = plane(tri)
        if pl is None:
            continue
        K = area * np.outer(pl, pl)
        for v in tri:
            Q[v] += K

    def neighbours(v):
        out = set()
        for t in incident[v]:
            out.update(tris[t])
        out.discard(v)
        return out

    def cost(u, v):
        """The cheapest place for the vertex that u and v become, and its error."""
        q = Q[u] + Q[v]
        if interior[u] and interior[v]:
            places = [0.5 * (P[u] + P[v]), P[u], P[v]]
        elif interior[u]:
            places = [P[v]]
        else:
            places = [P[u]]
        best, best_error = None, None
        for place in places:
            h = np.append(place, 1.0)
            error = float(h @ q @ h)
            if best_error is None or error < best_error - 1e-18:
                best, best_error = place, error
        return best_error, best

    heap = []

    def push(u, v):
        if not (interior[u] or interior[v]):
            return
        a, b = (u, v) if u < v else (v, u)
        error, _ = cost(a, b)
        heapq.heappush(heap, (error, a, b))

    seen = set()
    for t, tri in enumerate(tris):
        if not in_region[t]:
            continue
        for c in range(3):
            a, b = tri[c], tri[(c + 1) % 3]
            key = (a, b) if a < b else (b, a)
            if key not in seen:
                seen.add(key)
                push(*key)

    total = sum(in_region)
    target = int(round(total * keep_share))
    left = total
    removed_vertex = [False] * n
    while heap and left > target:
        error, u, v = heapq.heappop(heap)
        if removed_vertex[u] or removed_vertex[v]:
            continue
        now, place = cost(u, v)
        if abs(now - error) > 1e-12 * max(1.0, abs(now)):
            continue                               # stale entry; a fresh one is in the queue
        shared = incident[u] & incident[v]
        if len(shared) != 2:
            continue
        # The link condition: u and v may share exactly the two vertices
        # opposite their edge, or the surface would pinch.
        if len(neighbours(u) & neighbours(v)) != 2:
            continue
        # The one that goes: an interior vertex; if only one is, that one.
        gone, kept = (u, v) if interior[u] else (v, u)
        if not interior[gone]:
            continue
        if not interior[kept]:
            place = P[kept]
        # No triangle may turn over.
        ok = True
        for t in (incident[gone] | incident[kept]) - shared:
            tri = tris[t]
            before, _ = plane(tri)
            moved = [place if x in (gone, kept) else P[x] for x in tri]
            normal = np.cross(moved[1] - moved[0], moved[2] - moved[0])
            length = np.linalg.norm(normal)
            if before is None or length < 1e-18 or np.dot(before[:3], normal / length) < flip_limit:
                ok = False
                break
        if not ok:
            continue
        for t in shared:
            alive[t] = False
            for x in tris[t]:
                incident[x].discard(t)
            left -= 1
        for t in list(incident[gone]):
            tris[t] = [kept if x == gone else x for x in tris[t]]
            incident[kept].add(t)
        incident[gone] = set()
        removed_vertex[gone] = True
        P[kept] = place
        Q[kept] = Q[kept] + Q[gone]
        for w in sorted(neighbours(kept)):
            push(kept, w)

    used = sorted({v for t, tri in enumerate(tris) if alive[t] for v in tri})
    remap = -np.ones(n, dtype=np.int64)
    remap[used] = np.arange(len(used))
    out_tris = np.array([[remap[v] for v in tri] for t, tri in enumerate(tris) if alive[t]], dtype=np.int64)
    out_labels = np.array([int(tri_labels[t]) for t in range(len(tris)) if alive[t]], dtype=np.int64)
    return P[used], out_tris, out_labels, np.array(used, dtype=np.int64)
