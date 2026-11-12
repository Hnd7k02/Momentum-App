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


def label_by_rules(P, joints, dominant, bones, height, cuts=None):
    """Vertex labels for a posed body `P` (metres) of height `height`.

    `cuts` are the straight cuts between the inert zone and the muscles
    (`bodylib.cut_planes`): the same planes the build cuts the mesh along.
    """
    J = joints
    H = height
    k = H / 1.78          # the rules' lengths were set on a body of 1.78 m
    cuts = cuts or cut_planes(J, H)
    seg = np.array([bone_segment(bones[int(b)]) if b >= 0 else 'torso' for b in dominant])

    def beyond(name):
        point, normal, _ = cuts[name]
        return (P - point) @ normal > 0

    # Elbow and knee: the cut is the plane through the joint that bisects the
    # two segments, not where the skinning weights change bones. Wrist and
    # ankle: the straight cut of `cut_planes`.
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
        Hj, K, A = J[f'joint-{side}-upper-leg'], J[f'joint-{side}-knee'], J[f'joint-{side}-ankle']
        n = _unit(_unit(K - Hj) + _unit(A - K))
        m = np.isin(seg, ['upperleg', 'lowerleg']) & mine
        above = (P - K) @ n < 0
        seg[m & above] = 'upperleg'
        seg[m & ~above] = 'lowerleg'
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

    lab = np.full(len(P), -1)
    lab[np.isin(seg, ['head', 'hand', 'foot'])] = R['none']
    lab[seg == 'lowerarm'] = R['forearms']
    lab[seg == 'lowerleg'] = R['calves']

    yS = 0.5 * (J['joint-l-shoulder'][1] + J['joint-r-shoulder'][1])
    xS = 0.5 * (J['joint-l-shoulder'][0] - J['joint-r-shoulder'][0])
    yClav = 0.5 * (J['joint-l-clavicle'][1] + J['joint-r-clavicle'][1])
    yPelvis = J['joint-pelvis'][1]
    yBelt = yPelvis + 0.045 * k          # the iliac crest, the documented waistband

    # The torso's mid-coronal plane per height: front and back part along the
    # mid-axillary line.
    torso = np.isin(seg, ['torso', 'upperleg']) & (np.abs(P[:, 0]) < xS * 0.92)
    ys = np.linspace(P[:, 1].min(), P[:, 1].max(), 120)
    zmid = np.full_like(ys, np.nan)
    for i, y in enumerate(ys):
        m = torso & (np.abs(P[:, 1] - y) < 0.02)
        if m.sum() > 8:
            zmid[i] = 0.5 * (P[m, 2].min() + P[m, 2].max())
    ok = ~np.isnan(zmid)
    zmid = np.interp(ys, ys[ok], zmid[ok])
    zm = np.interp(P[:, 1], ys, zmid)
    front = P[:, 2] > zm - 0.005 * k

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
    pec_bottom = yS - 0.205 * k + 0.85 * np.clip(x - 0.065 * k, 0, None)
    # The collarbone: a line on the skin from the pit of the throat out to the
    # shoulder, lying a little above the line of the bone's two joints. The
    # pectoral reaches up to it; above it, beside the neck, is the trapezius.
    C, A = J['joint-l-clavicle'], J['joint-l-scapula']
    collarbone = C[1] + (A[1] - C[1]) / (A[0] - C[0]) * (x - C[0]) + CLAVICLE_LIFT * k
    chest = m & front & (y >= pec_bottom) & (y < collarbone) & (x < xS - 0.01 * k)
    lab[chest] = R['chest']
    m = lab < 0
    # Above the collarbone. Between the heads of the two collarbones, under
    # the neck's cut, lies the pit of the throat: no muscle of the back is
    # there, and since the neck is cut level above it, it goes with the chest
    # below. Everything else up there is the trapezius.
    above = m & (y >= collarbone)
    pit = above & front & (x < THROAT_HALF_WIDTH * k + THROAT_FLARE * (y - collarbone))
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
    return lab
