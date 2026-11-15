# Prompt Kurve – Die Leistungskurve und die Farbstärke am Körper, passend zur neuen Kennzahl

Für eine frische Session mit dem Modell, das D159 festlegt. Die Session braucht zwei Repos: `Hnd7k02/Momentum-App` (Branch `claude/momentum-wp3`) und `Hnd7k02/Momentum-preview`.
Start: «Lies `docs/wp3/prompts/prompt-kurve.md` und führe ihn aus.»
Geschrieben am 15.11.2026, am STOP 5b, direkt nach Darios Antworten (D175). Zeilennummern beziehen sich auf den Commit `f7b235f`. Prüf jede Zeile, bevor du dich darauf verlässt.

## 1. Worum es geht

Momentum ist eine lokale Web-App fürs iPhone. Im Gym-Bereich wird aus den Sätzen eine prozentuale Veränderung gerechnet, und eine Kurve macht daraus einen Leistungswert von 0 bis 1000. Er zählt 60 % des Gym-Ratings. Dieselbe Veränderung färbt die Muskelgruppen am 3D-Körper.

Block 5b hat die Kennzahl ersetzt: Statt «Wiederholungen × Last» zählt der beste Arbeitssatz nach einem Stärke-Score, und im Zeitraum werden Mediane verglichen. Die neue Kennzahl ist ruhiger und ehrlicher. Eine zusätzliche Wiederholung las die alte Kennzahl als +8 bis +17 %, die neue liest sie als +2 bis +3 %.

Die Kurve und die Farbskala sind dabei stehen geblieben, und beide passen nicht mehr:

- **Das Rating.** Die Kurve macht aus +10 % einen Leistungswert von 800. Wer jede Woche eine Wiederholung mehr schafft und dann das Gewicht erhöht, kam unter der alten Kennzahl auf +20 % und mehr, unter der neuen auf +3 bis +7 %. Sein Leistungswert fällt mit dem Update von 939 auf 611, das Ziel seines Gym-Ratings von 964 auf 767 (Prüfdaten, Update am 02.11.). Trainiert hat er gleich gut.
- **Der Körper.** Die Farbe einer Gruppe erreicht ihre volle Stärke erst bei 12 % Veränderung. Unter der neuen Kennzahl liegen die Gruppen der Prüfdaten alle zwischen +3 und +7 %. Der Körper zeigt Fortschritt nur noch blass.

Dario, der Eigentümer, hat am STOP 5b entschieden (D175): Die Kurve wird neu eingestellt, in einem eigenen kleinen Block direkt nach 5b und vor 7B, und die Farbskala am Körper kommt dazu. Sein Ziel in seinen Worten: **Wer wie in den Prüfdaten jede Woche eine Wiederholung mehr und dann mehr Gewicht schafft, steht nach dem Update nicht tiefer als vorher.**

Die wichtigsten Eigenschaften dieses Blocks:

- **Zuerst die Zahlen, dann der Code.** Welcher Wert die Kurve bekommt, ist ein Produktentscheid. Der Entwurf zeigt Kandidaten alt gegen neu, du baust den empfohlenen, und Dario bestätigt den Wert am STOP.
- **Die neue Kurve gehört zur Era von 5b.** Von 5b ist noch nichts in der Live-App. Ein Gerät, das das Release lädt, bekommt Kennzahl und Kurve in einem Stand, mit einer einzigen Grenze. Jeder Tag davor rechnet byte-genau wie bisher.
- **Die Kurve bleibt eine Funktion.** Kein zweites Modell, keine Tabelle, keine Verzweigung. Eingestellt wird der eine Wert, den D99 und D101 dafür vorsehen.
- **Die Farbskala ist reine Anzeige.** Sie ändert nichts, was gewertet wird, und braucht keine Era.

## 2. Arbeitsweise in dieser Session

- **Modell.** Dieser Block ist für das Modell geschrieben, das D159 nennt. Läufst du als anderes Modell, sag es in der ersten Zeile deiner ersten Antwort.
- **Subagenten.** Nur für reine Such- und Leseläufe über viele Dateien, und nur auf Sonnet. Jede Entscheidung und jede Änderung machst du selbst, auch den Schluss-Review der Era-Mechanik.
- **Branch.** Du committest und pushst auf `claude/momentum-wp3` im Repo `Momentum-App`. Dario erlaubt das ausdrücklich, auch wenn deiner Session ein anderer Arbeitsbranch zugeteilt wurde. Kein anderer Branch, kein Pull Request, kein Merge, kein Push auf den Default-Branch: Er veröffentlicht die Live-App bei jedem Push.
- **Eine Veröffentlichung.** Am Schluss, und nur dann, veröffentlichst du den Vorschau-Build im Repo `Momentum-preview` auf `main` (Abschnitt 7, Schritt 7). Auch das erlaubt Dario ausdrücklich.
- **Commits.** Kleine, benannte Commits im Stil der bestehenden Historie, englisch. Neu eingefrorene Golden-Dateien kommen als eigener Commit; welche das sein dürfen, steht in Schritt 4.
- **Kein Backup mit echten Daten.** Dario hat keines; das hat er am STOP 5b gesagt. Gemessen wird an den Prüfdaten und an Testprofilen. Sag im Bericht, dass der Lauf mit echten Daten fehlt.
- **Sprache.** Chat und STOP-Bericht auf Deutsch in Schweizer Schreibweise. `docs/decisions.md`, `HANDOVER.md`, `CLAUDE.md`, Code-Kommentare und Commit-Nachrichten englisch wie bisher.
- **Zu Ende arbeiten.** Halte nicht an, solange du noch Teile schuldest. Hindernisse diagnostizierst und umgehst du. Angehalten wird am STOP Kurve in Abschnitt 10, oder vorher, wenn die Voraussetzung in Abschnitt 3 fehlt.

## 3. Voraussetzung

- **5b ist abgenommen** (D175, `HANDOVER.md`): Der Median ist bestätigt (`GYM_COMPARISON_CONFIRMED` ist `true`), das Übungsdetail zeichnet eine Linie, und unter den Sätzen steht der Hinweis zum Aufwärmsatz.
- `docs/wp3/stage5b/momentum-pruefdaten-5b.json` liegt im Repo, und `stage5bImportFile.test.ts` ist grün.

Fehlt das, bau nichts. Sag Dario, was fehlt, und halte an.

**Die Entscheide gehen diesem Prompt vor:** D175, D150, D172, D99 und D101 (was an der Kurve fest ist und was eingestellt werden darf), D153 und D167 (das Band und die schwächste Farbstärke) und jeder jüngere Eintrag in `docs/decisions.md`, dazu der Vertrag `docs/wp3/vertrag.md`. Wo sie diesem Prompt widersprechen, gelten sie; nenn den Widerspruch im STOP-Bericht.

## 4. Darios Vorgaben vom STOP 5b

| Vorgabe | In seinen Worten | Folge für diesen Block |
|---|---|---|
| Ort des Blocks | «direkt nach 5b und vor 7B» | Reihenfolge ab hier: 5b, Kurve, 7B, 7C, 7D, 9, Aufräumen. |
| Era | «wenn möglich in der neuen Era von 5b, weil davon noch nichts veröffentlicht ist» | Kennzahl und Kurve teilen eine Grenze. Kein eigener Aktivierungsschritt mit eigenem Datum, wenn es sich vermeiden lässt. Geht es nicht, begründ es im Entwurf, bevor du baust. |
| Ziel der Kurve | «Wer wie in den Prüfdaten jede Woche eine Wiederholung mehr und dann mehr Gewicht schafft, steht nach dem Update nicht tiefer als vorher.» | Das ist das Abnahmekriterium. Wie «nicht tiefer» gemessen wird, legt der Entwurf offen (Schritt 1). |
| Farbskala | «Volle Stärke gibt es heute erst bei 12 %, die Prüfdaten liegen neu alle zwischen +3 und +7 %.» | Die Stärke der Farbe am Körper wird neu skaliert. Die schwächste Stärke bleibt 0,3 (D167). |
| Reihenfolge der Arbeit | «Zuerst ein Entwurf mit den Zahlen alt gegen neu, dann der Code.» | Schritt 1 vor allem anderen. |
| Echte Daten | «Ein Backup mit echten Daten gibt es nicht.» | Prüfdaten und Testprofile sind die Messgrundlage. |

## 5. Was du zuerst liest

1. `docs/decisions.md`: D175; D99 und D101 ganz (die fünf festen Eigenschaften der Kurve und der eine Wert, der eingestellt werden darf); D150, D172 und D174 (die Era der Kennzahl, und was der Probelauf gezeigt hat); D100 (die zwei Fenster); D153, D164 und D167 (Band, Farbregeln, schwächste Farbstärke).
2. `docs/design/wp3/stage5b-kennzahl.md`: «The numbers» ganz, dazu Abschnitt 5 (der Aktivierungsschritt, Fall für Fall) und «Read as an adversary».
3. `docs/wp3/review-2026-11.md`: Abschnitt E, Risiko 10.
4. `CLAUDE.md`: «Configuration is historical», «When a product decision is not settled», und unter «Product rules that are settled» die Punkte zum 40/60-Rating, zur einen Kurve und zum Übungstag.
5. `HANDOVER.md`: der Block «WP3 Stage 5b», «Gym performance» und «Gym rating» unter «Scoring rules, as implemented», und unter «Risks and known debt» die Punkte zur Kurve, zum Abbau in der Pause und zu den Replay-Kosten.
6. `docs/wp3/vertrag.md`: §7 (Farbstärke, Band), §6 (die Skala der Zeilen und des Übungsdetails), §8 (Farbe am Körper).
7. `.github/fixtures/README.md` und `.github/fixtures/stage5b/README.md`: wie Golden-Dateien entstehen und welche nie neu erzeugt werden.
8. Den Code aus Abschnitt 6.

## 6. Ausgangslage im Code

**Die Kurve** (`src/core/scoring/performanceCurve.ts`, 182 Zeilen)

- `mapPerformanceChangeToScore(changePercent)` (Zeile 83): `1000 ÷ (1 + 4^(−x ÷ 10))`. Alle zehn Prozentpunkte vervierfachen sich die Chancen: 0 % ergibt 500, +10 % ergibt 800, −10 % ergibt 200, +5 % ergibt 667.
- Die zwei Zahlen stehen in `TRAINING_RATING` (`src/core/config/constants.ts:351–352`): `CURVE_ODDS_PER_DECADE: 4` und `CURVE_DECADE_PERCENT: 10`. Die Funktion liest sie **beim Laden des Moduls** in die Konstante `K` (Zeile 68), nicht aus dem Stand des Tages. Wer die zwei Zahlen ändert, bewertet jeden vergangenen Tag neu. Das darf nicht geschehen.
- `performanceScore({ trendChange, ytdChange })` (163) rechnet beide Fenster einzeln durch die Kurve und mittelt die zwei Werte je zur Hälfte (`TREND_WEIGHT`, `YTD_WEIGHT`). Das Trendfenster hat 60 Tage (`TREND_WINDOW_DAYS`), das zweite läuft seit Jahresbeginn.
- **Zwei Aufrufer:** `performanceOn()` in `src/storage/services/gymRatingService.ts:152` und `src/storage/services/runningRatingService.ts:141`. Laufen benutzt dieselbe Kurve (D101, D105).
- `performanceChangeForScore` (97) und `scoreForRatio` (109) hat ausserhalb der Tests niemand in Gebrauch.
- Fest und nicht verhandelbar sind nach D101: `score(0) = 500`; monoton und stetig; symmetrisch um 500; abnehmender Zuwachs; begrenzt auf 0–1000 ohne Deckel am Eingang. Einstellen darf man den einen Wert, der alle Anker gemeinsam verschiebt.
- Tests, die die Kurve festhalten: `performanceCurve.test.ts`, `trainingRating.test.ts`, `decayEquivalence.test.ts`, `gymScoring.test.ts`, `runningScoring.test.ts`.

**Die Era von 5b**

- Der Marker ist `scoring.gymMetric` im Stand (`GymMetricSnapshot`, `src/core/model/index.ts:304`): `{ id, repsDivisor, comparison }`. Der Build schreibt `GYM_METRIC` (`constants.ts:290`). Einziger Leser ist `gymMetricOf()` (`src/core/gym/metric.ts:36`); `null` heisst alte Kennzahl.
- `ensureGymMetricEra()` (`src/storage/configService.ts`) hängt den Marker beim ersten Laden an, nach den drei älteren Schritten und in denselben Stand. `ensureCurrentSnapshot()` schreibt bei jeder späteren Änderung die ganze heutige Konfiguration.
- `buildGymRating()` (`gymRatingService.ts`) löst für jeden Tag den Stand auf und rechnet seine zwei Fenster in der Kennzahl dieses Tages, mit einer Spur je Kennzahl.
- **Ein Marker ohne Kurvenwert existiert nur dort, wo eine 5b-Vorschau geladen wurde:** auf Darios iPhone in der Datenbank `momentum-preview`. In der Live-App gibt es ihn nicht.

**Was die Zahlen heute sagen** (`docs/design/wp3/stage5b/zahlen-*.md`, erzeugt von `src/storage/services/stage5bReport.test.ts`)

- Prüfdaten, Update am 02.11.: Leistungswert 939 alt, 611 neu; Ziel 964 und 767; Gym-Rating am Tag −9,6, nach 7 Tagen −41,8, nach 14 Tagen −50,6.
- Prüfdaten, Update am 15.11.: Leistungswert 884 alt, 711 neu; Ziel 930 und 826.
- 16-Wochen-Profil, Update an sieben Montagen: Ziel am Tag −122,6 bis +13,5; Gym-Rating nach 7 Tagen −37,3 bis +9,2.
- Der Bericht rechnet eine Historie dreifach: «alt» (ohne Marker), «neu» und «neu, letzter gegen ersten». Diese Bauart kannst du für die Kandidaten der Kurve übernehmen.

**Die Farbstärke am Körper** (`src/features/body/tokens.ts`)

- `TINT_STRENGTH` (Zeile 228): `fromPercent: 2.5`, `toPercent: 12`, `min: 0.3`. `stateIntensity()` (237) wächst gleichmässig von 0,3 bei 2,5 % auf 1 bei 12 % und bleibt darüber gleich. Eine Gruppe bei +3 % steht heute bei 0,34, bei +7 % bei 0,63.
- `min: 0.3` ist Darios Wert (D167) und steht nicht zur Wahl. 2,5 % ist das Ende des Bandes (D153) und steht ebenfalls nicht zur Wahl.
- Gehalten: `bodyVisuals.test.ts`, und auf dem echten Bild `scripts/verify/farbregeln.mjs`: ±3 % steht mindestens 5 ΔE von derselben Zone «gehalten», und die grössere Veränderung ist stärker gefärbt als die kleinere.
- Der Satz dazu steht in `docs/wp3/vertrag.md` §7 und in `CLAUDE.md` («grows evenly from 2.5 % to 12 %»).

**Zwei weitere Stellen mit denselben 12 %, die eine Skala sind und keine Farbstärke**

- `SPARK_SCALE` (`src/features/gym/Sparkline.tsx:38`): die Verlaufslinie der Zeile, −12 % bis +12 %, darüber bleibt sie am Rand stehen.
- `LINE_SCALE` (`src/features/gym/ExerciseLineChart.tsx:43`): die Linie im Übungsdetail, 12 % bis zum Rand, darüber wächst sie in Schritten von 6 %.

**Die Messgrundlage**

- `docs/wp3/stage5b/momentum-pruefdaten-5b.json`: fünf Wochen, 194 Sätze, doppelte Progression in 6–12 Wiederholungen. Von der Live-Version selbst erzeugt (`scripts/verify/stage5b-live-backup.mjs`). `stage5bImportFile.test.ts` hält die Zahlen der Muskelgruppen fest; sie hängen nicht an der Kurve.
- `src/storage/services/fixtures/trainingProfile.ts`: `metricCrossingProfile()` und `strengthProfile()`, 16 Wochen, mit Pyramide, Drop-Sets, leichten Tagen und einer leichten Woche.
- Sechzehn Golden-Dateien `stage5b-*` in `.github/fixtures/wp3-golden/` gehören zur Era von 5b. Jede andere Golden-Datei, die Baselines unter `.github/fixtures/stage2/`, `stage4/` und `stage5b/` und jeder Fingerabdruck in `domainOutputs.test.ts` liegen vor ihr.

**Prüfung**

- `npm run test` muss mit Exit 0 enden; der Typecheck ist `tsc -b`. Die Browser-Suites laufen gegen `npm run build` und `npx vite preview --port 4173`, die vier 3D-Suites einzeln. Rot ist nur die Offline-Prüfung in `release-proof.mjs`.
- `replayPerformance.test.ts` hält vier Zeitgrenzen. Sie bleiben, wie sie sind.

## 7. Die Arbeit, in dieser Reihenfolge

### Schritt 0 – Ausgangsmessung

`tsc -b`, `npm run test`, `npm run build`, jede Browser-Suite, die 3D-Suites einzeln. Notier die Fingerabdrücke aus `domainOutputs.test.ts` und die vier Laufzeiten aus `replayPerformance.test.ts`. Was vorher bestand, muss am Ende bestehen.

### Schritt 1 – Der Entwurf mit den Zahlen, bevor Code entsteht

Schreib `docs/design/wp3/kurve.md` (englisch). Er beantwortet:

1. **Wie wird «nicht tiefer als vorher» gemessen?** «Vorher» ist dieselbe Historie ohne den Marker von 5b: alte Kennzahl, alte Kurve. «Nachher» trägt den Marker und den Kandidaten. Es gibt mindestens drei Lesarten, und der Entwurf zeigt die Zahlen für jede: an jedem Tag ab dem Update; im Mittel der Tage nach dem Update; dort, wo das Rating sich einpendelt. Die alte Kennzahl ist ein Sägezahn mit Spitzen am Tag vor einer Gewichtserhöhung. Sag, welche Lesart du empfiehlst und warum.
2. **Welche Historie zählt als «wie in den Prüfdaten»?** Die Prüfdatei hat fünf Wochen. Um zu sehen, wo das Rating sich einpendelt, brauchst du dieselbe Progression über mehr Wochen. Bau sie als Testprofil nach dem Muster von `trainingProfile.ts`: jede Woche eine Wiederholung mehr, bei 10 oder 12 das Gewicht hoch und zurück auf 8. Mess an beidem.
3. **Die Kandidaten.** Eingestellt wird der eine Wert aus D99: wie viele Prozentpunkte die Chancen vervierfachen (heute 10). Rechne mindestens fünf Werte durch, darunter den heutigen. Für jeden steht in einer Tabelle, alt gegen neu: Leistungswert, Ziel und Gym-Rating am Tag des Updates und 1, 7, 14 und 30 Tage danach, dazu der Boss; für die Prüfdaten mit Update am 02.11. und am 15.11., für das lange Profil aus Punkt 2 und für die zwei 16-Wochen-Profile.
4. **Was derselbe Wert auf der anderen Seite tut.** Die Kurve ist symmetrisch. Ein steilerer Wert belohnt kleine Fortschritte stärker und bestraft kleine Rückgänge stärker. Zeig für jeden Kandidaten: gleich bleiben (0 %); −3 %; ein einzelner leichter Tag am Ende des Fensters, den der Median dämpft; eine ganze leichte Woche; und die Tage der zwei 16-Wochen-Profile, an denen eine Gruppe zurückgeht. Sag, ab welchem Wert ein gewöhnliches Auf und Ab das Rating stärker bewegt, als Dario es wollen kann.
5. **Die Empfehlung.** Der flachste Wert, der das Ziel in der empfohlenen Lesart erfüllt. Nenn daneben den nächstflacheren und den nächststeileren mit ihren Zahlen, damit Dario wählen kann.
6. **Wie trägt der Stand die Kurve, und wo liest die Rechnung sie?** Der Wert reist mit dem Tag, wie `repsDivisor`. Entscheide, wo er steht: im Feld `gymMetric`, weil es die Era von 5b ist, oder an anderer Stelle; begründ es. Die Rechnung liest ihn aus dem Stand des Tages und nie aus einer Konstante.
7. **Was heisst ein Marker ohne Kurvenwert?** Es gibt ihn nur auf Geräten, die eine 5b-Vorschau geladen haben. Ein fehlender Wert ist nach der Regel dieser App der frühere Zustand: die alte Kurve. Schreib auf, was der Aktivierungsschritt und `ensureCurrentSnapshot()` auf so einem Gerät tun, in jedem Fall, den `ensureGymMetricEra()` kennt.
8. **Laufen.** Laufen ruft dieselbe Funktion auf und darf sich an keinem Tag bewegen. Zeig, wie Gym seinen Wert bekommt, ohne dass die Kurve zwei Funktionen wird. D101 nennt die Kurve einen gemeinsamen Vertrag; die fünf festen Eigenschaften bleiben gemeinsam, eingestellt wird für Gym in seiner Era. Das ist eine Ergänzung zu D101 und gehört als Entscheid in `docs/decisions.md`.
9. **Die Farbstärke am Körper.** Mindestens drei Kandidaten für das obere Ende (heute 12 %), mit dem Bild des Körpers für die Prüfdaten bei 30 Tagen und für ein 16-Wochen-Profil, je neben dem heutigen Stand. Für jeden: die Stärke bei +3, +5, +7 und +10 %, und der Abstand in ΔE, den `farbregeln.mjs` misst. Eine Empfehlung.
10. **Die zwei Skalen.** Zeig die Zeilen der Prüfdaten und ein Übungsdetail auf der heutigen Skala von 12 %. Sag, ob sie neben der neuen Farbstärke noch passen. Du änderst sie nicht; die Frage geht an den STOP.

Lies den Entwurf danach einmal als Gegner: Wo könnte sich ein Tag vor der Grenze trotzdem bewegen? Wo könnte sich Laufen bewegen? Wo steht eine Zahl, die du nicht aus dem echten Replay hast? Schreib die Antworten in den Entwurf. Erst dann baust du.

### Schritt 2 – Die Kurve als Wert des Tages

- **Eine Funktion, ein Wert.** `mapPerformanceChangeToScore` bleibt die eine Kurve mit ihren fünf Eigenschaften. Ihre Steilheit wird ein Wert, den der Aufrufer mitgibt. Ohne ihn rechnet sie Bit für Bit wie heute.
- **`TRAINING_RATING.CURVE_ODDS_PER_DECADE` und `CURVE_DECADE_PERCENT` bleiben, wie sie sind.** Sie sind die Kurve jedes Tages vor der Grenze und die Kurve von Laufen.
- **Der neue Wert steht im Stand,** an der Stelle aus dem Entwurf, und in einer Konstante neben `GYM_METRIC`, die sagt, ob Dario ihn bestätigt hat (das Muster von `GYM_COMPARISON_CONFIRMED`). Ein Test hält fest, dass der Wert im Stand die Rechnung bestimmt, in der reinen Funktion und durch das ganze Replay (`CLAUDE.md`, «wire the shape to the thing it governs»).
- **Wo gelesen wird:** `buildGymRating()` liest den Wert aus dem Stand jedes Tages, wie die Kennzahl. Der Zwischenspeicher je Spur darf Tage mit verschiedener Kurve nicht verwechseln.
- **Was der Screen zeigt.** Der Leistungswert und das Ziel auf dem Gym-Screen kommen aus derselben Rechnung. Kein Teil der Oberfläche rechnet die Kurve selbst.
- **Laufen** ruft die Funktion ohne Wert auf. `runningScoring.test.ts` und die Laufen-Zahlen jeder Golden-Datei bleiben, wie sie sind.
- **Era.** Ein neues Gerät trägt Kennzahl und Kurve ab dem ersten Stand. Ein Gerät, wie die Live-App es hinterlässt, bekommt beide beim ersten Laden in einem Stand; das zweite Laden schreibt nichts. Ein Gerät mit einem Marker ohne Kurvenwert verhält sich so, wie der Entwurf es festlegt.
- **`replayPerformance.test.ts`** besteht mit unveränderten Grenzen.

### Schritt 3 – Tests

- **Die fünf festen Eigenschaften** gelten für jeden Kandidaten aus dem Entwurf, nicht nur für den gebauten: exakt 500 bei 0 %, symmetrisch bis aufs letzte Bit, monoton, abnehmender Zuwachs, begrenzt.
- **Der gebaute Wert in Zahlen:** die Anker bei 0, ±2,5, ±5, ±10 und ±20 %.
- **Das Ziel als Test.** Die Prüfdatei wird importiert und einmal geladen; das Gym-Rating nach der neuen Rechnung liegt in der Lesart aus dem Entwurf nicht unter dem der alten. Der Test nennt die Zahlen.
- **Kein Tag vor der Grenze bewegt sich:** nach dem Vorbild von `gymMetricEra.test.ts`, über die Zufalls-Historien aus `fixtures/randomGym.ts`, mit mehreren Update-Tagen.
- **Darios Gerät:** drei ältere Aktivierungen und diese in einem Laden, ein Stand, das zweite Laden schreibt nichts.
- **Der Marker ohne Kurvenwert:** jeder Fall aus Punkt 7 des Entwurfs.
- **Laufen:** dieselbe Historie mit und ohne den neuen Wert, jedes Ausgabefeld gleich.
- Bestehende Tests, die die alte Kurve an einem Gerät der neuen Era festhalten, formulierst du um: alte Regel für das Gerät ohne Marker, neue für das Gerät mit. Keiner wird gelöscht oder abgeschwächt; führ jeden im STOP-Bericht auf.

### Schritt 4 – Golden-Dateien

- **Unverändert bleiben:** jede Golden-Datei ausser den sechzehn `stage5b-*`, die Baselines unter `.github/fixtures/stage2/`, `stage4/` und `stage5b/`, und jeder Fingerabdruck in `domainOutputs.test.ts`.
- **Die sechzehn `stage5b-*`-Dateien** gehören zur Era von 5b und sind nie veröffentlicht worden. Sie werden einmal neu eingefroren, als eigener Commit. Ein Skript oder Test belegt daneben: Im Profil «über die Grenze» ist jeder Wert jedes Tages vor der Grenze derselbe wie vorher, und in beiden Profilen ändern sich nur Felder, die vom Leistungswert abhängen. Die prozentualen Veränderungen, die Übungstage und die Zustände der Muskelgruppen ändern sich nicht.
- `stage5bImportFile.test.ts` bleibt grün, ohne dass du es anfasst.

### Schritt 5 – Die Farbstärke am Körper

- Bau den empfohlenen Kandidaten aus dem Entwurf in `TINT_STRENGTH`. `min` bleibt 0,3, `fromPercent` bleibt 2,5.
- Die Stärke kommt weiter aus einer Stelle (`stateIntensity`); Körper, flache Figur und alles, was eine Gruppe färbt, lesen dort.
- `bodyVisuals.test.ts` nennt die neuen Zahlen. `farbregeln.mjs` behält seine Regeln: ±3 % steht mindestens 5 ΔE von «gehalten», und die grössere Veränderung ist stärker gefärbt. Passen die Beispielwerte der Suite nicht mehr zur neuen Skala, formulierst du sie um und sagst es.
- **Gemessen, nicht geschätzt:** Mit den Prüfdaten bei 30 Tagen ist eine Gruppe bei +7 % auf dem Bild deutlich stärker gefärbt als eine bei +3 %, und +3 % bleibt klar von «gehalten» unterscheidbar. Nenn die ΔE-Werte.
- Das Standbild auf der Gym-Karte, die neutralen Töne, das Licht und das Modell bleiben, wie sie sind.
- Vertrag §7 und der Satz in `CLAUDE.md` bekommen die neue Zahl.

### Schritt 6 – Der Zahlenbericht

Er steht im STOP-Bericht und in `docs/design/wp3/kurve.md`.

1. **Das Ziel:** Prüfdaten und langes Profil, alt gegen neu, in der Lesart aus dem Entwurf. Erfüllt oder nicht, mit Zahlen.
2. **Das Rating um das Update:** die Tabelle aus Schritt 1, Punkt 3, für den gebauten Wert und seine zwei Nachbarn.
3. **Die andere Seite:** die Fälle aus Schritt 1, Punkt 4, für den gebauten Wert.
4. **Der Körper:** die Stärke bei +3, +5, +7 und +10 %, alt gegen neu, mit den Bildern.
5. **Was sich an alten Tagen bewegt hat:** nichts, mit den zwei Belegen aus Schritt 3 und 4.

### Schritt 7 – Schlussprüfung, Dokumente, Vorschau

1. `tsc -b`, `npm run test` (Exit-Code), `npm run build`, alle Browser-Suites, die 3D-Suites einzeln. Vergleich mit Schritt 0.
2. `git diff <Commit vor diesem Block> -- .github/fixtures` zeigt genau die sechzehn `stage5b-*`-Dateien als geändert und sonst nichts; die Fingerabdrücke sind unverändert.
3. Dokumente: ein Block in `HANDOVER.md`; «Gym rating» unter den Wertungsregeln; das Risiko zur Kurve unter den Risiken als erledigt. In `CLAUDE.md` der Satz zur einen Kurve und der Satz zur Farbstärke. In `docs/decisions.md` neue Einträge für das, was du entschieden hast, darunter die Ergänzung zu D101.
4. Veröffentlich den Build in `Momentum-preview` nach dessen `README.md`; die Statusleiste bleibt `default`. Warte auf den Workflow.

## 8. Was sich nicht ändern darf, und was nicht hierher gehört

**Unverändert bleiben:**

- jeder Wert jedes Tages vor der Grenze von 5b, jede Golden-Datei und jeder Fingerabdruck ausser den sechzehn aus Schritt 4;
- Laufen, an jedem Tag;
- die fünf festen Eigenschaften der Kurve (D101), die Mittelung der zwei Fenster, ihre Längen und Gewichte, 40/60, die Bewegung zum Ziel, Endurance, Abbau und Pause;
- die Kennzahl von 5b: Stärke-Score, bester Arbeitssatz, Median, feste Reihenfolge, Aufwärmsatz;
- `muscleState.ts`: welcher Zustand aus welcher Zahl folgt, das Band, die Mindestdaten;
- die schwächste Farbstärke 0,3 (D167), die drei neutralen Töne, das Licht, das Körpermodell;
- `SPARK_SCALE` und `LINE_SCALE`, bis Dario am STOP etwas anderes sagt;
- `SCHEMA_VERSION` und `BACKUP_FORMAT_VERSION`.

Es gibt keine zweite Kurve, keine Tabelle, keine Verzweigung nach Vorzeichen, keine Anpassung an fremde Daten und keinen Deckel am Eingang. Kein Test wird gelöscht oder abgeschwächt.

**Eigene Blöcke, nicht dieser:**

- dass ein Abbau in der Trainingspause eine ganze Stufe ausmachen kann (D174): bestehendes Verhalten; führ es im Bericht mit den neuen Zahlen auf, änder es nicht;
- der Randfall in den drei Aktivierungsschritten bei einem Datum, das um zwei Tage zurückspringt (`HANDOVER.md`, Risiken): Block 9;
- Körperbühne, Interaktion, Muskel-Sheet, Katalog (7B, 7C, 7D);
- der Rückweg als geprobter Ablauf und die Freigabe (9).

## 9. Abnahmekriterien

- Der Entwurf liegt vor, mit den Zahlen aller Kandidaten, und stimmt mit dem Gebauten überein.
- Das Ziel ist in der Lesart des Entwurfs erfüllt und als Test festgehalten.
- Kein Tag vor der Grenze und kein Tag von Laufen hat sich bewegt; unter `.github/fixtures/` sind genau die sechzehn `stage5b-*`-Dateien geändert.
- Die fünf festen Eigenschaften der Kurve gelten für den gebauten Wert.
- Die Aktivierung ist idempotent, auch auf einem Gerät mit einem Marker ohne Kurvenwert.
- `replayPerformance.test.ts` besteht mit unveränderten Grenzen.
- Am Körper ist +7 % deutlich stärker gefärbt als +3 %, und +3 % bleibt von «gehalten» unterscheidbar; `farbregeln.mjs` ist grün.
- `tsc -b` ist sauber, `npm run test` endet mit Exit 0, der Build läuft, jede Suite aus Schritt 0 besteht.
- Der Zahlenbericht liegt vor, und der Vorschau-Build ist erreichbar.

## 10. STOP Kurve

Schreib Dario einen Bericht auf Deutsch, den er auf dem Telefon lesen kann:

1. In drei Sätzen: was sich geändert hat und ab wann es gilt.
2. Das Ziel in Zahlen: Prüfdaten und langes Profil, alt gegen neu.
3. Die andere Seite: was der neue Wert mit gleich bleiben, einem kleinen Rückgang und einer leichten Woche tut.
4. Der Körper vorher und nachher, mit Bildern.
5. Die Belege, dass kein alter Tag und kein Tag von Laufen sich bewegt hat, und die Laufzeiten.
6. Eigene kleine Entscheidungen, jede mit Grund; darunter die Lesart von «nicht tiefer als vorher» und der Ort des Werts im Stand.
7. Was du gesehen und für spätere Blöcke liegen gelassen hast.
8. Die Adresse der Vorschau und die Prüfliste fürs iPhone.
9. Höchstens fünf Fragen, jede mit Optionen und deiner Empfehlung. Drei stehen fest: den Wert der Kurve bestätigen (empfohlen, flacher oder steiler); das obere Ende der Farbstärke bestätigen; ob die Skala der Zeilen und des Übungsdetails mitgehen soll.
10. Der Stand in git für beide Repos.

**Prüfliste fürs iPhone** (übernimm sie und pass sie an; höchstens acht Punkte):

1. Die Vorschau nur als eigene App vom Home-Bildschirm öffnen, nie als Tab.
2. Die Prüfdatei in der Vorschau neu importieren. Der Stand der Vorschau trägt sonst den Marker von 5b ohne die neue Kurve.
3. Gym-Rating in der Vorschau und in der Live-App mit derselben Prüfdatei: Die Vorschau steht nicht tiefer; die erwarteten Zahlen stehen im Bericht.
4. Auf dem Gym-Screen passen Leistungswert und Ziel zu dem, was der Bericht nennt.
5. Muskelgruppen, 30 Tage: Der Körper ist klar gefärbt; eine Gruppe bei +7 % ist sichtbar kräftiger als eine bei +3 %.
6. Eine Gruppe im Band (−2 bis +2 %) bleibt weiss.
7. Die Zahlen der Muskelgruppen sind dieselben wie vor diesem Block; nur die Farbstärke hat sich geändert.
8. Laufen zeigt dieselben Zahlen wie vorher.

Dann wartest du auf Darios Abnahme. Wählt er einen anderen Wert, stellst du ihn um, frierst die sechzehn Golden-Dateien neu ein, veröffentlichst die Vorschau neu und sagst ihm, dass ein Gerät, das den Vorschau-Build schon geladen hat, den alten Wert in seinem Stand trägt und die Prüfdatei neu importieren muss. Was er auf dem iPhone findet, behebst du in derselben Session. Der nächste Block startet in einer neuen Session mit `docs/wp3/prompts/prompt-7b-interaktion.md`.
