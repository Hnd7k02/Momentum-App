# The owner's addendum to block 7A

Pictures for D167: the weakest tint at 0.5 and at 0.3, and the borders the
build now cuts as lines, before and after. They are the pictures of the STOP
page («Körper STOP 7A», https://claude.ai/artifact/V6EXnbcNemqc63rpxCxpQG).

In every pair the left picture is the body the owner accepted on
2026-11-13 (`8537f79`) and the right one the body of the addendum.

| file | what it shows | how it was taken |
|---|---|---|
| `farbe-plus3.jpg` | chest +3 %, quadriceps −3 %, the rest held: the tint at 0.5 and at 0.3 | the app's stage at 393 px, `scripts/verify/farbregeln.mjs`, picture `koerper-schwelle-vorne`, both on the new body |
| `farbe-plus9.jpg` | chest +9 %, quadriceps −8 %: the same | picture `koerper-gemischt-vorne` |
| `app-vorne.jpg`, `app-hinten.jpg` | the app's stage with the test data, accepted (tint 0.5) and now | `farbregeln.mjs`, the closing runs of the two states |
| `brust.jpg` | the pectoral's lower edge | the dev page's stage, fixture `edge`, front |
| `knie-vorne.jpg`, `knie-hinten.jpg` | the knee's cut | fixture `edge`, front and back |
| `schluesselbein.jpg`, `schluesselbein-schraeg.jpg` | the collarbone and the deltoid's edge | fixture `mixed`, front and 35° |
| `ruecken.jpg` | the deltoid's edge from behind | fixture `mixed`, back |

The pictures from the dev page are the real viewer (`tools/body/gate-shots.mjs`,
here at four device pixels per px), with the accepted body as `model`
(`git show 8537f79:public/models/momentum-body.glb`) and the app's own body,
both drawn with the app's tint as it is now, so that a pair differs in its
borders alone.
