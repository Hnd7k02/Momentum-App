"""Where the ten muscle regions lie on the MakeHuman body: the rules.

The rules place the regions from the skeleton and from landmarks, on one
posed reference body. Their result is stored per vertex of the fixed
topology (`regions.json`) and that file is what a build reads — the rules
run only when the file is made anew (`build.py --relabel`), never per build.

Anatomical assignment (guide, section 4.7):

  chest             pectoralis major down to its lower edge, up to the clavicle line
  shoulders         the deltoid, front, side and back, with its V-shaped insertion
  back              trapezius — also its upper part, seen from the front between
                    neck and shoulder —, latissimus, rhomboids, erectors, down to
                    the iliac crest
  core              rectus abdominis, external oblique and serratus, in front of
                    the mid-axillary line; the inguinal ligament below
  biceps, triceps   the upper arm, front and back, down to the elbow's plane
  forearms          elbow to wrist
  quadriceps        the thigh, front and inside, down to the knee
  hamstringsGlutes  the glutes from the iliac crest, and the back of the thigh
  calves            the whole lower leg down to the ankle, front included
  none              head with neck, hands from the wrist, feet from the ankle
"""
from __future__ import annotations

import numpy as np

from bodylib import R, bone_segment, cut_planes


def _unit(v):
    return v / np.linalg.norm(v)


#: How far the collarbone's line on the skin lies above the line of its
#: joints, and half the width of the pit of the throat between its two heads
#: (metres on a body of 1.78 m). Set on renderings of `athletisch-a`.
CLAVICLE_LIFT = 0.020
THROAT_HALF_WIDTH = 0.045
#: The pit widens upwards: its edge runs out to the side of the neck, where
#: the trapezius begins, instead of standing under the neck as a tab.
THROAT_FLARE = 0.75
#: The lower edge of the pectoral (metres on a body of 1.78 m; x is the
#: distance from the body's middle). It is lowest under the nipple, where
#: the muscle's fold lies on the body — read from the surface: under the
#: nipple the chest stands out until 14 cm below the shoulder joints and
#: falls back by a centimetre and a half within the next two. From there
#: to the middle it runs about level, a few millimetres higher over the
#: breastbone; to the side it rises in an arc to the fold of the armpit.
PEC_FOLD = 0.142          # below the shoulder joints, under the nipple
PEC_NIPPLE = 0.098        # the nipple's distance from the middle
PEC_MIDDLE_LIFT = 0.006   # how much higher the edge lies over the breastbone
PEC_ARC = 4.9             # the arc to the armpit: rise = PEC_ARC * (x - nipple)^2
#: The deltoid's edge against the trunk: a plane, seen from the front as a
#: straight line from the fold of the armpit up over the collarbone and the
#: top of the shoulder, and down the back to the armpit's rear fold. It
#: leans outwards as it goes down. In front the pectoral lies against it
#: below the collarbone, the trapezius above; behind, the back. Read from
#: the body: the groove between deltoid and pectoral lies 3.4 cm inside the
#: shoulder joint at the joint's height, and the deltoid's rear edge on the
#: same plane to within half a centimetre.
DELT_EDGE_IN = 0.0345     # inside the shoulder joint, at its height
DELT_EDGE_LEAN = 0.145    # further out by this much for every metre down
DELT_EDGE_DOWN = 0.050    # the line ends this far below the shoulder joints
#: How far from one of the lines a vertex may lie and still be given to the
#: side of the line it is on.
LINE_REACH = 0.035


def segments(P, joints, dominant, bones, height, cuts=None):
    """The limb or the trunk every vertex of the posed body `P` belongs to.

    The skinning weights say it roughly; the joints' planes and the straight
    cuts of `bodylib.cut_planes` say it exactly.
    """
    J = joints
    cuts = cuts or cut_planes(J, height)
    seg = np.array([bone_segment(bones[int(b)]) if b >= 0 else 'torso' for b in dominant])

    def beyond(name):
        point, normal, _ = cuts[name]
        return (P - point) @ normal > 0

    # The elbow: the cut is the plane through the joint that bisects the two
    # segments, not where the skinning weights change bones. Knee, wrist and
    # ankle: the straight cuts of `cut_planes`.
    for side, sx in (('l', 1.0), ('r', -1.0)):
        mine = P[:, 0] * sx > 0
        S, E, Hd = J[f'joint-{side}-shoulder'], J[f'joint-{side}-elbow'], J[f'joint-{side}-hand']
        n = _unit(_unit(E - S) + _unit(Hd - E))
        m = np.isin(seg, ['upperarm', 'lowerarm']) & mine
        above = (P - E) @ n < 0
        seg[m & above] = 'upperarm'
        seg[m & ~above] = 'lowerarm'
        m = np.isin(seg, ['lowerarm', 'hand']) & mine
        far = beyond(f'wrist-{side}')
        seg[m & ~far] = 'lowerarm'
        seg[m & far] = 'hand'
        m = np.isin(seg, ['upperleg', 'lowerleg']) & mine
        below = beyond(f'knee-{side}')
        seg[m & ~below] = 'upperleg'
        seg[m & below] = 'lowerleg'
        m = np.isin(seg, ['lowerleg', 'foot']) & mine
        far = beyond(f'ankle-{side}')
        seg[m & ~far] = 'lowerleg'
        seg[m & far] = 'foot'

    # Head and neck are inert down to the neck's cut: a nearly level plane at
    # the base of the neck. What the neck's bones carry below it — the slope
    # of the trapezius, the pit between the collarbones — belongs to the
    # trunk; what the trunk's bones carry above it, close to the neck, to the
    # neck.
    point, _, radius = cuts['neck']
    near = np.linalg.norm(P - point, axis=1) < radius
    above_cut = beyond('neck')
    seg[(seg == 'head') & near & ~above_cut] = 'torso'
    seg[(seg == 'torso') & near & above_cut] = 'head'
    return seg


class Lines:
    """The lines the rules draw on the front of the trunk.

    Each is a field over any points of the posed body, zero on the line. The
    rules label the base mesh's vertices by them, and the build cuts the
    fine mesh along them (`borders`), so that a border between two regions
    is the line itself and not the edges of the quads that lie nearest.
    """

    def __init__(self, P, seg, joints, height):
        J = joints
        self.k = k = height / 1.78          # the rules' lengths were set on a body of 1.78 m
        self.yS = 0.5 * (J['joint-l-shoulder'][1] + J['joint-r-shoulder'][1])
        self.xS = 0.5 * (J['joint-l-shoulder'][0] - J['joint-r-shoulder'][0])
        self.C, self.A = J['joint-l-clavicle'], J['joint-l-scapula']
        # The torso's mid-coronal plane per height: front and back part along
        # the mid-axillary line.
        torso = np.isin(seg, ['torso', 'upperleg']) & (np.abs(P[:, 0]) < self.xS * 0.92)
        ys = np.linspace(P[:, 1].min(), P[:, 1].max(), 120)
        zmid = np.full_like(ys, np.nan)
        for i, y in enumerate(ys):
            m = torso & (np.abs(P[:, 1] - y) < 0.02)
            if m.sum() > 8:
                zmid[i] = 0.5 * (P[m, 2].min() + P[m, 2].max())
        ok = ~np.isnan(zmid)
        self.ys, self.zmid = ys, np.interp(ys, ys[ok], zmid[ok])

    def front(self, Q):
        """Positive in front of the mid-axillary line."""
        return Q[:, 2] - np.interp(Q[:, 1], self.ys, self.zmid) + 0.005 * self.k

    def pec_bottom(self, x):
        """The height of the pectoral's lower edge, `x` from the middle."""
        k = self.k
        inner = np.clip(x / (PEC_NIPPLE * k), 0, 1)
        outer = np.clip(x - PEC_NIPPLE * k, 0, None)
        return (self.yS - PEC_FOLD * k
                + PEC_MIDDLE_LIFT * k * 0.5 * (1 + np.cos(np.pi * inner))
                + PEC_ARC / k * outer ** 2)

    def collarbone(self, x):
        """The height of the collarbone's line on the skin, `x` from the middle:
        from the pit of the throat out to the shoulder, a little above the
        line of the bone's two joints."""
        C, A = self.C, self.A
        return C[1] + (A[1] - C[1]) / (A[0] - C[0]) * (x - C[0]) + CLAVICLE_LIFT * self.k

    def pit(self, x, y):
        """Positive in the pit of the throat, between the heads of the two collarbones."""
        return THROAT_HALF_WIDTH * self.k + THROAT_FLARE * (y - self.collarbone(x)) - x

    def delt_edge(self, y):
        """Where the deltoid's front edge lies, from the middle, at the height `y`."""
        return self.xS - DELT_EDGE_IN * self.k + DELT_EDGE_LEAN * (self.yS - y)

    def delt_low(self):
        return self.yS - DELT_EDGE_DOWN * self.k

    def below_pec(self, Q):
        """Positive under the pectoral's lower edge."""
        return self.pec_bottom(np.abs(Q[:, 0])) - Q[:, 1]

    def under_collarbone(self, Q):
        """Positive under the collarbone's line."""
        return self.collarbone(np.abs(Q[:, 0])) - Q[:, 1]

    def in_pit(self, Q):
        """Positive in the pit of the throat."""
        return self.pit(np.abs(Q[:, 0]), Q[:, 1])

    def inside_delt(self, Q):
        """Positive inside the deltoid's edge, towards the middle."""
        return self.delt_edge(Q[:, 1]) - np.abs(Q[:, 0])

    def paint(self, Q, labels):
        """The regions of the points `Q` — vertices, or the middles of
        triangles — with the lines drawn: every point within reach of one is
        given to the side of the line it lies on.

        Under the pectoral's edge is the core. Outside the deltoid's edge is
        the shoulder, all round. Inside it, in front, the chest reaches up
        to the collarbone and into the pit of the throat; above that, and
        behind, is the back.
        """
        reach = LINE_REACH * self.k
        out = np.asarray(labels).copy()
        front = self.front(Q) > 0
        pec = self.below_pec(Q)
        near = front & np.isin(out, [R['chest'], R['core']]) & (np.abs(pec) < reach)
        out[near & (pec > 0)] = R['core']
        out[near & (pec <= 0)] = R['chest']
        delt = self.inside_delt(Q)
        under = np.maximum(self.under_collarbone(Q), self.in_pit(Q))
        near = (np.isin(out, [R['chest'], R['back'], R['shoulders']]) & (Q[:, 1] > self.delt_low())
                & ((np.abs(delt) < reach) | (front & (np.abs(under) < reach) & (delt > 0))))
        chest = front & (under > 0)
        out[near & (delt <= 0)] = R['shoulders']
        out[near & (delt > 0) & chest] = R['chest']
        out[near & (delt > 0) & ~chest] = R['back']
        return out

    def cuts(self):
        """The lines the build cuts the fine mesh along before it paints it,
        in their order: for each a function of the mesh that gives the field
        and the triangles it holds for. A later line ends on an earlier one:
        the collarbone at the deltoid's edge, the pit's edge at the collarbone.
        """
        reach = LINE_REACH * self.k

        def zone(P, tris, labels, regions, field, all_round=False):
            centre = P[tris].mean(axis=1)
            held = np.isin(labels, [R[name] for name in regions]) & (np.abs(field(centre)) < reach)
            return centre, held if all_round else held & (self.front(centre) > 0)

        def pectoral(P, tris, labels):
            _, held = zone(P, tris, labels, ('chest', 'core'), self.below_pec)
            return self.below_pec(P), held

        def deltoid(P, tris, labels):
            centre, held = zone(P, tris, labels, ('chest', 'back', 'shoulders'), self.inside_delt, all_round=True)
            return self.inside_delt(P), held & (centre[:, 1] > self.delt_low())

        def collarbone(P, tris, labels):
            centre, held = zone(P, tris, labels, ('chest', 'back', 'shoulders'), self.under_collarbone)
            return self.under_collarbone(P), held & (self.inside_delt(centre) > 0)

        def pit(P, tris, labels):
            centre, held = zone(P, tris, labels, ('chest', 'back'), self.in_pit)
            return self.in_pit(P), held & (self.under_collarbone(centre) < 0)

        return [pectoral, deltoid, collarbone, pit]


def label_by_rules(P, joints, dominant, bones, height, cuts=None):
    """Vertex labels for a posed body `P` (metres) of height `height`.

    `cuts` are the straight cuts between the inert zone and the muscles, and
    at the knee (`bodylib.cut_planes`): the same planes the build cuts the
    mesh along.
    """
    J = joints
    H = height
    k = H / 1.78          # the rules' lengths were set on a body of 1.78 m
    seg = segments(P, J, dominant, bones, H, cuts)
    lines = Lines(P, seg, J, H)

    lab = np.full(len(P), -1)
    lab[np.isin(seg, ['head', 'hand', 'foot'])] = R['none']
    lab[seg == 'lowerarm'] = R['forearms']
    lab[seg == 'lowerleg'] = R['calves']

    xS = lines.xS
    yPelvis = J['joint-pelvis'][1]
    yBelt = yPelvis + 0.045 * k          # the iliac crest, the documented waistband
    front = lines.front(P) > 0

    # The deltoid: around the shoulder joint, on the arm's outer side, down to
    # about 45 % of the humerus, lowest on the outside (the V of its insertion).
    delt = np.zeros(len(P), bool)
    for side, sx in (('l', 1.0), ('r', -1.0)):
        S, E = J[f'joint-{side}-shoulder'], J[f'joint-{side}-elbow']
        u = _unit(E - S)
        L = np.linalg.norm(E - S)
        rel = P - S
        t = rel @ u / L
        radial = rel - np.outer(rel @ u, u)
        outward = _unit(np.cross(u, np.array([0, 0, 1.0])) * -sx)
        if outward[0] * sx < 0:
            outward = -outward
        rn = np.linalg.norm(radial, axis=1) + 1e-9
        cosang = (radial @ outward) / rn
        mine = P[:, 0] * sx > 0
        tmax = 0.30 + 0.17 * np.clip(cosang, 0, 1)
        on_arm = (t > 0) & (t < tmax) & (cosang > -0.5) & np.isin(seg, ['upperarm', 'torso'])
        cap = (t <= 0) & (np.linalg.norm(rel, axis=1) < 0.11 * k) & (np.abs(P[:, 0]) > xS - 0.045 * k) & np.isin(seg, ['torso', 'upperarm'])
        delt |= mine & (on_arm | cap)
    lab[delt & (lab < 0)] = R['shoulders']

    # The armpit's folds: pectoral and latissimus insert at the top of the
    # humerus, on its inner side.
    for side, sx in (('l', 1.0), ('r', -1.0)):
        S, E = J[f'joint-{side}-shoulder'], J[f'joint-{side}-elbow']
        u = _unit(E - S)
        L = np.linalg.norm(E - S)
        rel = P - S
        t = rel @ u / L
        radial = rel - np.outer(rel @ u, u)
        outward = _unit(np.cross(u, np.array([0, 0, 1.0])) * -sx)
        if outward[0] * sx < 0:
            outward = -outward
        cosang = (radial @ outward) / (np.linalg.norm(radial, axis=1) + 1e-9)
        m = (lab < 0) & (P[:, 0] * sx > 0) & (seg == 'upperarm') & (t < 0.22) & (cosang < -0.5)
        lab[m & front] = R['chest']
        lab[m & ~front] = R['back']

    # The upper arm: biceps in front of its axis, triceps behind.
    for side, sx in (('l', 1.0), ('r', -1.0)):
        S, E = J[f'joint-{side}-shoulder'], J[f'joint-{side}-elbow']
        u = _unit(E - S)
        fwd = _unit(np.array([0, 0, 1.0]) - u[2] * u)
        m = (seg == 'upperarm') & (lab < 0) & (P[:, 0] * sx > 0)
        rel = P[m] - S
        lab[np.where(m)[0]] = np.where(rel @ fwd > 0, R['biceps'], R['triceps'])

    # The thigh: quadriceps in front of its axis, hamstrings behind. A slight
    # inward turn: the sartorius runs from the hip's front to the inner knee.
    for side, sx in (('l', 1.0), ('r', -1.0)):
        Hj, K = J[f'joint-{side}-upper-leg'], J[f'joint-{side}-knee']
        u = _unit(K - Hj)
        fwd = _unit(np.array([0, 0, 1.0]) - u[2] * u)
        m = (seg == 'upperleg') & (lab < 0) & (P[:, 0] * sx > 0)
        rel = P[m] - Hj
        lab[np.where(m)[0]] = np.where(rel @ fwd > -0.012 * k, R['quadriceps'], R['hamstringsGlutes'])

    # The torso.
    x = np.abs(P[:, 0])
    y = P[:, 1]
    m = lab < 0
    pec_bottom = lines.pec_bottom(x)
    # The collarbone: the pectoral reaches up to it; above it, beside the
    # neck, is the trapezius.
    collarbone = lines.collarbone(x)
    chest = m & front & (y >= pec_bottom) & (y < collarbone) & (x < xS - 0.01 * k)
    lab[chest] = R['chest']
    m = lab < 0
    # Above the collarbone. Between the heads of the two collarbones, under
    # the neck's cut, lies the pit of the throat: no muscle of the back is
    # there, and since the neck is cut level above it, it goes with the chest
    # below. Everything else up there is the trapezius.
    above = m & (y >= collarbone)
    pit = above & front & (lines.pit(x, y) > 0)
    lab[pit] = R['chest']
    lab[above & ~pit] = R['back']
    m = lab < 0
    below = y < yBelt
    hipside = x > 0.085 * k
    lab[m & front & ~below] = R['core']
    lab[m & front & below & ~hipside] = R['core']
    lab[m & front & below & hipside] = R['quadriceps']
    lab[m & ~front & ~below] = R['back']
    lab[m & ~front & below] = R['hamstringsGlutes']
    assert (lab >= 0).all()
    # The lines. Sphere, cone and plane above give the deltoid its place and
    # leave its edge against the pectoral and the trapezius in steps; on the
    # front that edge is one line, like the pectoral's lower edge and the
    # collarbone.
    return lines.paint(P, lab)
