# The measures of the body

`node tools/body/measure-body.mjs <body.glb> …` measures a body at landmarks
and prints the table below. Every figure is read from the surface of the file
itself, so one rule measures today's model, the proof and every candidate; how
each landmark is found is written at the top of the script.

## The comparison the gate starts from

Measured on 12 November 2026. H is the body height.

| measure | target | today's body | the proof |
|---|---|---|---|
| Height | — | 1.750 m | 1.780 m |
| Head height (crown to chin) | 12.5–13.5 % | 12.6 % ✓ | 12.6 % ✓ |
| Shoulder height (acromion) | 80.0–83.0 % | 82.2 % ✓ | 83.0 % ✓ |
| Knee height (joint line) | 27.0–30.0 % | 24.0 % ✗ | 29.8 % ✓ |
| Crotch height | 45.0–49.0 % | 45.9 % ✓ | 49.4 % ✗ |
| Upper arm | 16.7–20.5 % | 23.6 % ✗ | 17.7 % ✓ |
| Forearm | 13.1–16.1 % | 13.9 % ✓ | 15.1 % ✓ |
| Hand | 9.7–11.9 % | 10.1 % ✓ | 12.3 % ✗ |
| Foot length | 14.5–16.0 % | 14.2 % ✗ | 14.9 % ✓ |
| Shoulder breadth (bideltoid) | 25.0–30.0 % | 25.2 % ✓ | 31.5 % ✗ |
| Neck width to head width | 0.75–0.90 | 0.65 ✗ | 0.79 ✓ |
| Symmetry (largest mirrored distance) | ≤ 2 mm | 1.8 mm ✓ | 2.2 mm ✗ |
| Upper arm away from the trunk | 15–25° | 21.7° ✓ | 23.4° ✓ |
| Elbow bend | 5–15° | 7.7° ✓ | 1.1° ✗ |
| Toes turned out | 5–10° | −0.4° ✗ | 0.8° ✗ |
| **Met, of 14** | | **9** | **8** |
| Triangles | ≤ 80,000 | 40,000 | 28,792 |
| Inert zone (share of the triangles) | 25–35 % | 17 % | 68 % |
| File | ≤ 700 KB | 467 KB | 398 KB |
| Closed surface | yes | no, 1171 open edges | no, 30 open edges |

Where the regions lie, by a ray at a place found from the landmarks:

| place | today's body | the proof |
|---|---|---|
| hand | `forearms` | `none` |
| sole of the foot | `none` | `none` |
| crown, face | `none` | `none` |
| ridge between neck and shoulder | `back` | `none` |
| the same slope from the front | `shoulders` | `none` |
| outside of the thigh | `hamstringsGlutes` | `quadriceps` |

What the figures say about today's body is what the eye says: the neck is
thin against the head (0.65), the upper arm is long, the knee border sits low,
the feet are short and point straight ahead, the hands belong to the forearms,
and the mesh is not closed. The proof has the proportions nearly right but
straight arms, straight feet, a trapezius that was handed to the inert zone,
and two thirds of its triangles in head, hands and feet.

## The four candidates of the gate

Measured on 12 November 2026, by the same script, as they were shown. The
body the app ships is `athletisch-a` after the owner's three corrections and
the two of the second sheet; it is measured in the next section.

| measure | target | schlank-a | athletisch-a | athletisch-b | kraeftig-a |
|---|---|---|---|---|---|
| Height | — | 1.780 m | 1.780 m | 1.780 m | 1.780 m |
| Head height (crown to chin) | 12.5–13.5 % | 12.6 % ✓ | 12.6 % ✓ | 12.9 % ✓ | 12.6 % ✓ |
| Shoulder height (acromion) | 80.0–83.0 % | 82.9 % ✓ | 82.8 % ✓ | 82.8 % ✓ | 82.7 % ✓ |
| Knee height (joint line) | 27.0–30.0 % | 29.9 % ✓ | 29.9 % ✓ | 29.9 % ✓ | 29.9 % ✓ |
| Crotch height | 45.0–49.0 % | 49.2 % ✗ | 49.0 % ✓ | 49.0 % ✓ | 48.8 % ✓ |
| Upper arm | 16.7–20.5 % | 18.4 % ✓ | 18.3 % ✓ | 18.3 % ✓ | 18.1 % ✓ |
| Forearm | 13.1–16.1 % | 15.0 % ✓ | 15.2 % ✓ | 15.2 % ✓ | 15.0 % ✓ |
| Hand | 9.7–11.9 % | 11.0 % ✓ | 10.8 % ✓ | 10.8 % ✓ | 11.0 % ✓ |
| Foot length | 14.5–16.0 % | 14.9 % ✓ | 14.9 % ✓ | 14.9 % ✓ | 14.9 % ✓ |
| Shoulder breadth (bideltoid) | 25.0–30.0 % | 29.1 % ✓ | 29.6 % ✓ | 29.6 % ✓ | 30.3 % ✗ |
| Neck width to head width | 0.75–0.90 | 0.81 ✓ | 0.79 ✓ | 0.79 ✓ | 0.78 ✓ |
| Symmetry (largest mirrored distance) | ≤ 2 mm | 0.1 mm ✓ | 0.1 mm ✓ | 0.1 mm ✓ | 0.1 mm ✓ |
| Upper arm away from the trunk | 15–25° | 21.5° ✓ | 21.1° ✓ | 21.1° ✓ | 19.6° ✓ |
| Elbow bend | 5–15° | 7.9° ✓ | 7.7° ✓ | 7.7° ✓ | 6.9° ✓ |
| Toes turned out | 5–10° | 6.4° ✓ | 6.4° ✓ | 6.4° ✓ | 6.4° ✓ |
| Met | of 14 | 13 | 14 | 14 | 13 |
| Triangles | ≤ 80,000 | 50142 | 50232 | 50236 | 50238 |
| Inert zone | 25–35 % | 34 % | 34 % | 34 % | 34 % |
| Smallest group | ≥ 400 | 1632 | 1642 | 1642 | 1672 |
| File | ≤ 700 KB | 690 KB | 691 KB | 691 KB | 691 KB |
| Closed surface | yes | yes | yes | yes | yes |

All four: hand, sole, crown and face are `none`; the ridge between neck and
shoulder, and the same slope from the front, are `back`; the outside of the
thigh is `quadriceps`.

## The body the app ships

`public/models/momentum-body.glb`, measured on 13 November 2026:
`athletisch-a` with the three corrections of the gate — straight cuts at
neck, wrists and ankles, the collarbone redrawn, built 1.75 m tall like the
body it replaced — and the two of its second sheet: a surface without folds,
and the arms (forearm at the mean of 14.6 %, a little stronger, the upper
arm 17° from the trunk, the fingers bent a little more).

| measure | target | the shipped body | held by the validator |
|---|---|---|---|
| Height | — | 1.750 m | |
| Head height (crown to chin) | 12.5–13.5 % | 12.6 % ✓ | yes |
| Shoulder height (acromion) | 80.0–83.0 % | 82.8 % ✓ | yes |
| Knee height (joint line) | 27.0–30.0 % | 29.8 % ✓ | no — target not checked at its source |
| Crotch height | 45.0–49.0 % | 49.1 % ✗ | no — target not checked at its source |
| Upper arm | 16.7–20.5 % | 18.2 % ✓ | yes |
| Forearm | 13.1–16.1 % | 14.6 % ✓ | yes |
| Hand | 9.7–11.9 % | 10.1 % ✓ | yes |
| Foot length | 14.5–16.0 % | 14.9 % ✓ | yes |
| Shoulder breadth (bideltoid) | 25.0–30.0 % | 29.7 % ✓ | no — the window is to become 27–32 % once checked at its source (D165) |
| Neck width to head width | 0.75–0.90 | 0.78 ✓ | yes |
| Symmetry (largest mirrored distance) | ≤ 2 mm | 0.6 mm ✓ | yes |
| Upper arm away from the trunk | 15–25° | 17.0° ✓ | yes |
| Elbow bend | 5–15° | 7.4° ✓ | yes |
| Toes turned out | 5–10° | 6.4° ✓ | yes |
| Met | of 14 | 13 | 11 held |
| Triangles | ≤ 80,000 | 50,152 | yes |
| Inert zone | 25–35 % | 33 % | |
| Smallest group | ≥ 400 | 1,674 (triceps) | yes |
| File | ≤ 700 KB | 690 KB | yes |
| Closed surface | yes | yes | yes |

Hand, sole, crown and face are `none`; the ridge between neck and shoulder,
and the same slope from the front, are `back`; the outside of the thigh is
`quadriceps`. `tools/body/checkpoints.mjs` asks 33 such places on every
build.

The hand's figure is the reach from the wrist to the farthest point of the
hand, so it is shorter with the fingers bent more (28° for 20°); the hand
itself is as long as before, 12.1 % of the height laid flat along its
joints. Arm and hand together read 42.9 % for the 44.3 % of STOP 7A.

*The crotch height, corrected on 12 November 2026:* for the body of STOP 7A
this document read "49.0 % ✓" and "14 met". The script took the crotch as
the highest of its 900 cuts in which the legs are still two loops — the cut
**below** the crotch, up to 0.11 % of the height too low, and jumping by
that much when the surface moves by half a millimetre. It now finds the
place between two cuts by halving, and that body reads 49.10 %: two
millimetres above a window that is itself not checked at its source (the
one ANSUR II figure found is 47.4 %). The body did not change; the reading
did. The candidates of the gate read the same way: `athletisch-a` 49.1 %,
`schlank-a` 49.2 %, `kraeftig-a` 48.9 %, and their table above stands as it
was shown.

A second reading was made safer at the same time and changes no figure of
a body measured before: the hand's reach is taken from the hand's own cuts,
because with the arm held closer the thigh lay within a hand's breadth of
the wrist and was taken for the hand (13.4 % for 9.7 %).

## The second sheet: the shipped body, the one before it, and the alternative

Measured on 13 November 2026, on the shipped body as it was accepted — its
borders were drawn anew afterwards, which changed no measure of the body and
three of the file (see below). `stop-7a` is the body the app shipped at
STOP 7A, before the second sheet; `gate-2-b` is the shipped body with the
relief bounded at 6 mm instead of 4, the sheet's alternative. Both were kept
in `candidates.json` until the owner had accepted the shipped body, and are
in commit `8537f79`.

| measure | target | momentum-body | stop-7a | gate-2-b |
|---|---|---|---|---|
| Height | — | 1.750 m | 1.750 m | 1.750 m |
| Head height (crown to chin) | 12.5–13.5 % | 12.6 % ✓ | 12.6 % ✓ | 12.6 % ✓ |
| Shoulder height (acromion) | 80.0–83.0 % | 82.8 % ✓ | 82.8 % ✓ | 82.8 % ✓ |
| Knee height (joint line) | 27.0–30.0 % | 30.0 % ✓ | 29.9 % ✓ | 30.0 % ✓ |
| Crotch height | 45.0–49.0 % | 49.1 % ✗ | 49.1 % ✗ | 49.1 % ✗ |
| Upper arm | 16.7–20.5 % | 18.2 % ✓ | 18.3 % ✓ | 18.3 % ✓ |
| Forearm | 13.1–16.1 % | 14.6 % ✓ | 15.2 % ✓ | 14.6 % ✓ |
| Hand | 9.7–11.9 % | 10.1 % ✓ | 10.8 % ✓ | 10.1 % ✓ |
| Foot length | 14.5–16.0 % | 14.9 % ✓ | 14.9 % ✓ | 14.9 % ✓ |
| Shoulder breadth (bideltoid) | 25.0–30.0 % | 29.7 % ✓ | 29.6 % ✓ | 29.7 % ✓ |
| Neck width to head width | 0.75–0.90 | 0.78 ✓ | 0.79 ✓ | 0.79 ✓ |
| Symmetry (largest mirrored distance) | ≤ 2 mm | 0.6 mm ✓ | 0.6 mm ✓ | 0.6 mm ✓ |
| Upper arm away from the trunk | 15–25° | 17.0° ✓ | 21.1° ✓ | 17.2° ✓ |
| Elbow bend | 5–15° | 7.4° ✓ | 7.7° ✓ | 7.5° ✓ |
| Toes turned out | 5–10° | 6.4° ✓ | 6.4° ✓ | 6.4° ✓ |
| Met | of 14 | 13 | 13 | 13 |
| Triangles | ≤ 80,000 | 49964 | 49988 | 49936 |
| Inert zone | 25–35 % | 33 % | 33 % | 33 % |
| Smallest group | ≥ 400 | 1654 | 1642 | 1654 |
| File | ≤ 700 KB | 687 KB | 688 KB | 687 KB |
| Closed surface | yes | yes | yes | yes |

All three passed `tools/validate-body-glb.mjs` as it stood then, with all
33 check points and its eleven measures.

## The borders drawn anew

After the acceptance the build cut the knee, the pectoral's lower edge, the
collarbone and the deltoid's edge into the mesh as lines (README, "The lines
on the trunk"). No vertex of the body moved, and thirteen of the fourteen
measures read as above, to the digit. The fourteenth is read from the border
of calf and thigh: the knee's height is 29.8 % for 30.0 %, now that the
border is the joint's plane. What changed besides is the mesh along the
lines — 50,152
triangles for 49,964, the smallest group 1,674 for 1,654, the file 690 KB
for 687 — and where the regions end:

| region | before | now |
|---|---|---|
| chest, its lowest point | 66.1 % of the height, under the breastbone | 71.1 %, under the nipple; 71.5 % at the breastbone |
| calves, their highest point | 31.1 % | 29.9 %, the knee's cut (the joint is at 29.9 %) |
| quadriceps and hamstrings, their lowest | 29.3 % and 28.7 % | 29.6 % both |

The validator holds it with 59 check points for 33 — the pectoral's edge at
the breastbone and under the nipple, both sides of the knee's cut and of
the deltoid's edge — and with the two cuts of each lower leg, each within a
millimetre of its plane (0.2 mm).

## What the targets were checked against

The guide (`koerper-anleitung-7a.md` §3) gives them as starting values after
Drillis & Contini (1966) as Winter reproduces them, to be checked before they
enter the validator. **The check could only be done in part:** this session's
network rules block the sources themselves (the ANSUR II report at
`apps.dtic.mil`, the Penn State open design lab), so what follows rests on
search results that quote them, and on what the two sources say about each
other. The validator of step 7a must not take a window from here that is
marked open.

| measure | guide | what the check found | state |
|---|---|---|---|
| Head height | 0.130 H | Quoted with Winter's figure as "head height 0.130". | confirmed |
| Upper arm, forearm, hand | 0.186, 0.146, 0.108 H | Quoted with the same figure. They are lengths between skin landmarks — acromion to elbow, elbow to wrist, wrist to fingertip — which is why the script measures the upper arm from the acromion, not from the joint: 0.818 − 0.186 = 0.632 is the elbow height of the same figure. | confirmed |
| Shoulder height | 0.818 H | ANSUR II, men (n = 4082): acromial height 1441 mm (SD 63.3). Against a mean stature of 1756 mm that is 0.821. | confirmed; the stature mean is from memory, the search did not return it |
| Foot length | 0.152 H | ANSUR II, men: 271 mm (SD 13.1), 0.154 H. | confirmed, as above |
| Shoulder breadth | 25–30 % H | ANSUR II, men: bideltoid breadth 510 mm (SD 32.5), **0.290 H** — the mean lies at the upper edge of the guide's window. The guide's window looks taken from Winter's "shoulder width 0.259 H", which is the distance between the shoulder joints, not the breadth over the deltoids. A trained man is at or above the mean. | **the window is too low: 27–32 % would be mean −1 SD to +1.6 SD. Left as the guide has it; a question for the gate** |
| Crotch height | 45–49 % H | The guide marks it "check against ANSUR II". Only a subsample turned up (471 men, 833 mm), about 0.474 H. | open |
| Knee height | 0.285 H | Not checked. | open |
| Neck to head width | 0.75–0.90 | No source names this ratio; it is a criterion of look. Measured as the narrowest cut of the neck against the widest cut of the skull above the ears. | the guide's own |
| Symmetry, posture angles | 2 mm; 15–25°, 5–15°, 5–10° | Criteria of the guide, not anthropometry. | the guide's own |

A measure is judged on the figure as it is printed, against the limits as
they are printed: 49.04 % reads "49.0 %" and meets "45.0–49.0 %".

Two definitions are a choice and are said here because another choice gives
another number:

- **Shoulder breadth is taken as if the arms hung straight down** — the
  distance between the shoulder joints plus the bulge of each deltoid beside
  the arm's own line. Taken as the widest place of the posed body it comes
  out about 2.5 % H larger, because an arm held 20° away is wider there.
- **The elbow bend is the angle between the lines through the limbs**, which
  is what one sees. On a MakeHuman body the angle between the skeleton's
  joints is about 12° larger (the elbow joint lies behind the middle of the
  arm): a pose of 20° at the joints reads as 8°. The script prints both.
