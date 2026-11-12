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
| Foot length | 14.5–16.0 % | 14.1 % ✗ | 14.7 % ✓ |
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

Measured on 12 November 2026, by the same script.

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
| Foot length | 14.5–16.0 % | 14.7 % ✓ | 14.7 % ✓ | 14.7 % ✓ | 14.7 % ✓ |
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
