# Prompt 5b – Die Kennzahl: bester Arbeitssatz mit Stärke-Score, als Era

Für eine frische Session mit dem Modell, das D159 festlegt. Die Session braucht zwei Repos: `Hnd7k02/Momentum-App` (Branch `claude/momentum-wp3`) und `Hnd7k02/Momentum-preview`.
Start: «Lies `docs/wp3/prompts/prompt-5b-kennzahl.md` und führe ihn aus.»
Geschrieben am 11.11.2026, vor dem Block «Farbregeln». Zeilennummern beziehen sich auf den Commit `af89fd9`; der Block davor hat Dateien unter `src/features/gym/` verändert. Prüf jede Zeile, bevor du dich darauf verlässt.

## 1. Worum es geht

Momentum ist eine lokale Web-App fürs iPhone. Im Gym-Bereich wird jede Übung an jedem Trainingstag auf eine Zahl reduziert, die **Kennzahl**. Aus ihr entstehen die Veränderung je Muskelgruppe, die Farbe am 3D-Körper und 60 % des Gym-Ratings.

Heute ist die Kennzahl der beste Satz nach «Wiederholungen × Last», und im Zeitraum wird der letzte Tag mit dem ersten verglichen. Das erzeugt Scheinausschläge: Wer von 12 × 80 kg auf 8 × 85 kg geht, also schwerer wird, fällt um 29 %. Ein einzelner leichter Tag färbt eine Gruppe rot.

Dario, der Eigentümer, hat entschieden (D150–D152): Die Kennzahl wird der **beste Arbeitssatz** nach einem Stärke-Score, `effektive Last × (1 + Wiederholungen ÷ 30)`. Aufwärmsätze markiert er selbst, Satz für Satz. Das Arbeitsvolumen wird später gezeigt und nie gewertet. Dazu kommt aus dem freigegebenen Review der Vergleich über Mediane, den Dario an deinen Zahlen bestätigt.

Die wichtigste Eigenschaft dieses Blocks: **Die neue Kennzahl ist eine Era.** Sie gilt ab dem ersten Laden des Updates. Jeder Tag davor wird byte-identisch so nachgerechnet wie bisher, und keine bestehende Golden-Datei wird neu eingefroren. Ein Fehler hier verändert alte Werte still; darum entsteht zuerst ein Entwurf, dann Code, und am Schluss ein Zahlenbericht alt gegen neu, an dem Dario abnimmt.

## 2. Arbeitsweise in dieser Session

- **Modell.** Dieser Block ist für das Modell geschrieben, das D159 nennt. Läufst du als anderes Modell, sag es in der ersten Zeile deiner ersten Antwort.
- **Subagenten.** Nur für reine Such- und Leseläufe über viele Dateien, und nur auf Sonnet. Jede Entscheidung und jede Änderung machst du selbst, auch den Schluss-Review der Era-Mechanik.
- **Branch.** Du committest und pushst auf `claude/momentum-wp3` im Repo `Momentum-App`. Dario erlaubt das ausdrücklich, auch wenn deiner Session ein anderer Arbeitsbranch zugeteilt wurde. Kein anderer Branch, kein Pull Request, kein Merge, kein Push auf den Default-Branch: Er veröffentlicht die Live-App bei jedem Push.
- **Eine Veröffentlichung.** Am Schluss, und nur dann, veröffentlichst du den Vorschau-Build im Repo `Momentum-preview` auf `main` (Abschnitt 6, Schritt 9). Auch das erlaubt Dario ausdrücklich.
- **Commits.** Kleine, benannte Commits im Stil der bestehenden Historie, englisch. Neue Golden-Dateien kommen als eigene Commits dazu. Eine bestehende Golden-Datei wird nicht neu eingefroren; die eine Ausnahme steht in Schritt 4.
- **Darios Backup ist privat.** Hängt er es an, liegt es nur ausserhalb der Repo-Ordner, etwa in deinem Scratchpad. Es wird nie committet, nie veröffentlicht und nie an einen Dienst geschickt. In Bericht und Repo stehen daraus nur Zahlen zu Übungen und Muskelgruppen, keine Antworten aus Mind und keine Fragetexte. Am Ende der Session löschst du die Datei.
- **Sprache.** Chat und STOP-Bericht auf Deutsch in Schweizer Schreibweise. `docs/decisions.md`, `HANDOVER.md`, `CLAUDE.md`, Code-Kommentare und Commit-Nachrichten englisch wie bisher.
- **Zu Ende arbeiten.** Halte nicht an, solange du noch Teile schuldest. Hindernisse diagnostizierst und umgehst du. Angehalten wird am STOP 5b in Abschnitt 9, oder vorher, wenn die Voraussetzung in Abschnitt 3 fehlt.

## 3. Voraussetzung

- Der Block «Farbregeln» ist abgenommen: `HANDOVER.md` nennt ihn als abgenommen, oder Dario bestätigt es in der Nachricht, mit der er diese Session startet.
- `muscleState.ts` trägt Band und Mindestdaten, und Muskelgruppen bietet 30 und 90 Tage.

Fehlt das, bau nichts. Sag Dario, was fehlt, und halte an.

**Die Entscheide gehen diesem Prompt vor:** D150, D151, D152 und jeder jüngere Eintrag in `docs/decisions.md`, dazu der Vertrag `docs/wp3/vertrag.md`. Wo sie diesem Prompt widersprechen, gelten sie; nenn den Widerspruch im STOP-Bericht.

## 4. Darios Angaben zu seinem Training

Er hat sie am 11.11.2026 gemacht. Sie bestimmen die Testprofile und den Zahlenbericht.

| Frage | Antwort | Folge für diesen Block |
|---|---|---|
| Übliche Wiederholungen | zum Beispiel 6–12 | Ein Testprofil mit doppelter Progression: Wiederholungen steigen von 8 auf 12, dann steigt die Last und die Wiederholungen fallen auf 8 zurück. Genau dort erzeugt die alte Kennzahl den Sägezahn. |
| Aufwärmsätze bisher erfasst | nein; er möchte sie neu erfassen können, ohne dass sie zählen | Seine Historie enthält keine Aufwärmsätze, die Grenze der Era ist für ihn davon unberührt. Das Flag aus D151 ist die neue Möglichkeit. «Ohne dass sie zählen» heisst nach D151: nicht für die Kennzahl und nicht für das Arbeitsvolumen. Für die Anwesenheit zählt ein Aufwärmsatz wie jeder Satz (D128). |
| Pyramiden | «eigene Entscheidung» | Gelesen als: keine Sonderregel und keine Erkennung. Die Sätze einer Pyramide sind Arbeitssätze, ausser er markiert die leichten von Hand. Ein Testprofil deckt die Pyramide ab. Nenn diese Lesart am STOP. |
| Drop-Sets | ja | Arbeitssätze (D151). Ein Testprofil mit Drop-Sets nach der Arbeit; die neue Kennzahl bleibt dabei bei 0 %. |
| Deloads | nein | Keine Sonderbehandlung. Ein einzelner leichter Tag wird über den Median gedämpft, eine ganze leichte Woche bleibt als Rückgang sichtbar. |

## 5. Was du zuerst liest

1. `docs/decisions.md`: D150, D151, D152; dazu D84 und D90 (was ersetzt und was ausgenommen wird), D128, D131, D132 bis D136 (das Muster einer Era), D139 und D153.
2. `docs/wp3/review-2026-11.md`: Abschnitt E ganz. Die acht durchgerechneten Fälle, «Empfohlene Messdefinition» und die zehn Risiken für Replay und Era sind die Grundlage dieses Blocks.
3. `docs/design/wp3/stage5-gateG.md`: was Gate G gemessen hat, besonders «The deterministic set order».
4. `CLAUDE.md`: «The architectural rule», «Configuration is historical», «Absence is not failure» und «When a product decision is not settled».
5. `HANDOVER.md`: «Gym performance» und «Gym rating» unter «Scoring rules, as implemented», «Invariants future changes must preserve», und unter «Risks and known debt» die Punkte zur Reihenfolge der Sätze, zu den zwei Fenstern pro Tag und zu den Replay-Kosten.
6. `.github/fixtures/README.md` und `docs/design/wp3/stage3b-golden.md`: wie Golden-Dateien entstehen und wann sie neu eingefroren wurden.
7. `docs/wp3/vertrag.md`: §13 (die zwei Wörter dieses Blocks), §6 (Balken), §3 und §5 (für die Satzzeile).
8. Den Code aus Abschnitt 6.

## 6. Ausgangslage im Code

**Die Rechnung** (`src/core/gym/performance.ts`, 493 Zeilen, rein und ohne Speicher)

- `setScore` (Zeile 68) ist `reps * weightGrams`; `isScorableSet` (58) lässt nur positive, endliche Werte zu; `bestSet` (85) nimmt das Maximum, bei Gleichstand den Satz mit der kleineren `order`.
- `exerciseDays` (129) macht aus den Sätzen einer Übung an einem Tag einen `ExerciseDay` (98) mit genau einem `best`. Ein Tag ohne wertbaren Satz erzeugt nichts, keine Null.
- `compareExerciseDays` (182) vergleicht einen Tag mit dem vorigen Tag derselben Übung. `gymPerformanceOverSpan` (435) nimmt je Übung den ersten und den letzten Tag; `gymPerformanceInWindow` (480) schneidet davor das Fenster zu. `musclePerformance` (295) bildet je Gruppe das gewichtete Mittel (70 % Hauptmuskeln, 30 % Nebenmuskeln), `gymPerformance` (404) das gleichgewichtete Mittel der Gruppen.
- Eine Median-Funktion gibt es unter `src/core/` nicht.
- `src/core/gym/load.ts`: `effectiveLoadGrams` (84) löst die effektive Last auf (extern, Körpergewicht, assistiert), `bodyweightOn` (47) liest das Körpergewicht am Tag des Satzes. Das bleibt.

**Der Satz** (`src/core/model/index.ts:706`, `GymSetRecord`)

`id`, `sessionId`, `exerciseId`, `date`, `weightGrams` (ganze Gramm), `reps`, `order`, `muscles`, `primaryMuscles?`, `loadType?`, `createdAt`. Ein Feld für Aufwärmsätze gibt es nicht. `primaryMuscles?` und `loadType?` sind die Vorbilder: Fehlt das Feld, ist das eine Era, und nichts füllt es nach.

**Der Dienst**

- `src/storage/services/gymService.ts`: `toSetInput` (473), `bySetOrder` (574), `buildExerciseDays` (883), `loadGymHistory` (953), `exerciseHistory` (973). `buildExerciseDays` liest die Sätze über den Index `by_date` (`src/storage/repositories/gym.ts:142–144`), also innerhalb eines Tages in der Reihenfolge der IDs. Daher ist das Replay heute nicht bit-genau gleich auf zwei Geräten mit denselben Sätzen unter verschiedenen IDs.
- `src/storage/services/gymRatingService.ts`: `performanceOn` (135) rechnet je Tag zwei Fenster, den Trend über `TRAINING_RATING.TREND_WINDOW_DAYS` (60 Tage, `src/core/config/constants.ts:293`) und das Jahr seit dem 1. Januar. `buildGymRating` (160) hält dafür einen Zwischenspeicher und drei Zeiger (213–242). Der Kommentar dort warnt: Filtern in einer Schleife über die Historie ist die quadratische Laufzeit, die mit D73 schon einmal entfernt wurde.
- `src/storage/services/replayPerformance.test.ts` hält die Laufzeit über 730 Tage in vier Grenzen (Zeilen 242, 247, 268, 277).

**Die Era**

- `AppConfigSnapshot.scoring` (`src/core/model/index.ts:318–337`) trägt `model?`, `gymModel?`, `runningModel?` und `sessionWindowDays?`; jedes fehlende Feld ist eine Era. `buildConfigSnapshot` (`src/core/config/snapshot.ts:66`) schreibt die jeweils aktuellen Modelle.
- Das Muster für «ab dem ersten Laden» steht zweimal in `src/storage/configService.ts`: `ensureSessionWindowEra` (184) und `ensureFoodRetired` (246). Lies beide Kommentare ganz. Sie regeln, was oft vergessen wird: Die Grenze bleibt, wo sie geschrieben wurde, ausser die Uhr ging beim Schreiben vor; ein Stand mit späterem Datum bekommt das Feld auch; ein Profil ohne Stand wird in Ruhe gelassen; `ensureCurrentSnapshot` (112) darf die Era nicht früher beginnen lassen; nichts wirft; alles ist idempotent.
- Aufgerufen werden sie in `loadConfiguration` (`src/storage/services/configurationService.ts:69–77`), in der Reihenfolge Beförderungs-Era, Ein-Tages-Fenster, Food.
- Die Live-App steht auf dem Default-Branch am Commit `e30becd`, vor ganz WP3. Sie kennt die Bestätigung von Beförderungen schon, das Ein-Tages-Fenster und das Ende von Food noch nicht. Beim ersten Laden des Releases laufen bei Dario deshalb drei Aktivierungen im selben Laden: diese beiden und deine.

**Backup**

`src/core/backup/format.ts:391` prüft einen Satz nur auf ID und gültiges Datum und übernimmt ihn ohne Feldliste; `backupService.ts` schreibt die Sätze, wie sie gespeichert sind. Ein zusätzliches, optionales Feld überlebt Export und Import. `SCHEMA_VERSION` ist 5, `BACKUP_FORMAT_VERSION` ist 3.

**Golden-Dateien und Profile**

- `.github/fixtures/wp3-golden/` hält 22 Dateien, drei davon für Gym; dazu fünf Dateien unter `stage2/` und eine unter `stage4/`. `domainOutputs.test.ts` vergleicht exakt und führt zusätzlich Fingerabdrücke (Zeilen 190–192); `stage2Baseline.test.ts` vergleicht die Stage-2-Dateien.
- Die Profile entstehen in `src/storage/services/fixtures/profiles.ts` (`currentProfile` Zeile 47, `trainingBreakProfile` 178, `p8CrossingProfile` 217, `confirmationProfile` 233, `foodOffProfile` 256). `currentProfile` rechnet «unter den aktuellen Modellen ab Tag 1» und hat einen Satz pro Übung und Tag. Sobald `buildConfigSnapshot` das neue Feld schreibt, würde dieses Profil neu rechnen.

**Oberfläche**

- `src/features/gym/GymSessionScreen.tsx`: `SetRow` (122) mit den Feldern für Wiederholungen (181) und Gewicht (217), `PendingSetRow` (272), die Zeile «Bester Satz» (1084).
- Wörter in `src/i18n/de.ts`: `gym.bestSet` (407), `gym.progress.explainMetric` (433, «Übungswert = bester Satz des Tages (Wdh. × {unit}).»), `gym.detail.history` (527), `gym.detail.value` (532); Englisch daneben in `en.ts`.
- `src/features/gym/ExerciseDetail.tsx` zeichnet `day.best.score` als Balken ab null (`barHeight`, Zeile 33) und nennt den Tag über seinen besten Satz.
- `src/features/gym/muscleAnalytics.ts`: `muscleTrend` (Zeile 110) ruft für jeden Trainingstag einer Gruppe `gymPerformanceOverSpan` auf. Die Verlaufslinie einer Zeile endet deshalb genau dort, wo die Zahl daneben steht; `scripts/verify/release-proof.mjs` prüft das.

**Prüfung**

- `npm run test` muss mit Exit 0 enden; lies den Exit-Code. Der Typecheck ist `tsc -b`.
- Die Browser-Suites laufen gegen `npm run build` und `npx vite preview --port 4173`, die drei 3D-Suites einzeln. Rot ist nur die Offline-Prüfung in `release-proof.mjs`; sie gehört dem Aufräum-Block (D163).

## 7. Die Arbeit, in dieser Reihenfolge

### Schritt 0 – Ausgangsmessung

`tsc -b`, `npm run test`, `npm run build`, jede Browser-Suite. Notier die Fingerabdrücke aus `domainOutputs.test.ts` und die vier Laufzeiten aus `replayPerformance.test.ts`. Was vorher bestand, muss am Ende bestehen.

### Schritt 1 – Der Entwurf, bevor Code entsteht

Schreib `docs/design/wp3/stage5b-kennzahl.md` (englisch, wie die anderen Gate-Dokumente dort). Es beantwortet, mit Verweis auf die Codestellen:

1. Wie heisst das neue Feld im Konfigurationsstand, was trägt es, und was bedeutet sein Fehlen?
2. Wo liest die Rechnung, welche Kennzahl für einen bewerteten Tag gilt?
3. Wie rechnet ein Tag nach der Grenze ein Fenster, das Sätze von vor der Grenze enthält?
4. Wie trägt ein Übungstag beide Werte, ohne dass der Dienst doppelt liest oder quadratisch wird?
5. Was tut der Aktivierungsschritt in jedem Fall, den die beiden bestehenden Schritte kennen (Uhr ging vor, Reise nach Westen, späterer Stand, kein Stand, Import eines alten Backups, zweites Laden)?
6. Welche bestehenden Profile werden wie auf die alte Kennzahl festgelegt, und welche neuen kommen dazu?
7. Was ändert sich für ein neues Gerät, das unter dieser Version eingerichtet wird?

Lies den Entwurf danach einmal als Gegner: Wo könnte ein Tag vor der Grenze einen anderen Wert bekommen? Erst wenn du keine Stelle mehr findest, baust du.

### Schritt 2 – Marker und Aktivierung

- **Ein Feld unter `scoring`.** Es benennt die Kennzahl und trägt die eine Konstante 30 (D150: eine Konstante im Stand, nie eine Tabelle) und die Vergleichsregel. Fehlt es, gilt die alte Kennzahl in allen ihren Teilen: bester Satz nach `reps × load` über alle Sätze, erster gegen letzten Tag, die heutige Reihenfolge.
- **Die Vergleichsregel ist ein Schalter in diesem Feld**, nicht eine zweite Era. Dario bestätigt den Median am STOP anhand deiner Zahlen. Bis dahin ist er gebaut und eingeschaltet, und ein Test hält fest, dass Schalter und Rechnung nicht auseinanderlaufen können (`CLAUDE.md`, «When a product decision is not settled»).
- **Ein Aktivierungsschritt** nach dem Muster von `ensureSessionWindowEra`, in `loadConfiguration` nach den drei bestehenden. Er beginnt diese Era und keine andere.
- **Ein neues Gerät** trägt das Feld vom ersten Stand an.
- **Tests** nach dem Vorbild von `p8UpdateDay.test.ts` und `foodRetirement.test.ts`, dazu einer für Darios Fall: ein Profil, wie die Live-App es hinterlässt (Food an, kein Ein-Tages-Fenster), bei dem alle drei Aktivierungen im selben Laden laufen; das zweite Laden schreibt nichts.

### Schritt 3 – Die Kennzahl

- **Satz-Score:** effektive Last × (1 + Wiederholungen ÷ 30). Die effektive Last bleibt, wie `load.ts` sie liefert. Halt den Vergleich zweier Sätze ganzzahlig, wie der Kommentar am Satz es verlangt: `Last × (30 + Wiederholungen)` ordnet gleich und bleibt eine ganze Zahl.
- **Kennzahl des Übungstags:** der höchste Satz-Score unter den Arbeitssätzen. Ein Tag, an dem eine Übung nur Aufwärmsätze hat, erzeugt keinen Übungstag: keine Daten, nie null.
- **Vergleich im Zeitraum:** je Übung der Median der letzten k Übungstage gegen den Median der ersten k. Dabei ist k die Hälfte der Tage, abgerundet, höchstens 3. Bei zwei oder drei Tagen ist das der letzte gegen den ersten, wie heute. Das gilt für jedes Fenster: den Trend und das Jahr im Rating und die Zeiträume von Muskelgruppen. Der Vergleich eines Tages mit dem vorigen Tag derselben Übung (`compareExerciseDays`) bleibt, wie er ist.
- **Über die Grenze** (D150): Jeder bewertete Tag rechnet sein ganzes Fenster in der Kennzahl dieses Tages. Ein Tag vor der Grenze sieht nur alte Werte. Ein Tag ab der Grenze liest auch die älteren Sätze seines Fensters nach dem neuen Score; ein alter Satz ohne Flag ist ein Arbeitssatz. Nie werden zwei Einheiten gemischt, und kein Fenster bleibt ohne Vergleichsbasis.
- **Was der Screen zeigt, liest dieselbe Rechnung.** Muskelgruppen, die Karte in der Gym-Übersicht, die Verlaufslinie der Zeile (`muscleTrend`) und das Übungsdetail rechnen heute, also in der neuen Era: mit dem neuen Score und dem Median, über den ganzen gewählten Zeitraum. Die Linie einer Zeile endet weiterhin bei der Zahl daneben. Kein Teil der Oberfläche rechnet eine eigene Fassung.
- **Alles danach bleibt:** 70/30, gleiches Gewicht je Gruppe, die Kurve, 40 % Anwesenheit und 60 % Leistung, Bewegung, Endurance, Abbau. Unter `src/core/scoring/` änderst du nichts.
- **Laufzeit.** Der Dienst hält seine Zeiger und seinen Zwischenspeicher; `replayPerformance.test.ts` besteht mit unveränderten Grenzen. Nenn die vier Zeiten vorher und nachher.

### Schritt 4 – Die feste Reihenfolge

In der neuen Era gehen die Übungstage eines Tages nach Übungs-ID sortiert in die Muskelsummen ein, wie Gate G es gemessen hat. Zwei Geräte mit denselben Sätzen unter verschiedenen IDs rechnen danach bit-genau gleich; ein Test belegt das mit vertauschten IDs.

Bau es an die Era gebunden: Tage vor der Grenze behalten ihre Reihenfolge, und keine bestehende Golden-Datei ändert sich. Geht es nur für alle Tage, ist das der Fall, den D150 nennt: genau eine Gym-Golden-Datei mit neuer Zeilenfolge und keinem neuen Wert. Dann, und nur dann, frierst du diese eine Datei neu ein, als eigener Commit, mit einem Skript, das die Gleichheit aller Werte bis zur neunten Stelle belegt.

### Schritt 5 – Der Aufwärmsatz

- **Ein Fakt am Satz** (D151): ein optionales Feld, Standard aus. Fehlt es, ist der Satz ein Arbeitssatz. Nichts füllt es nach, nichts erkennt Aufwärmsätze von selbst, und kein Stand der Konfiguration ist dafür nötig.
- **Änderbar überall, wo der Satz änderbar ist:** im Workout für heute und gestern, nach der einen Schreibregel in `core/config/closure.ts`. Ein älterer Tag bleibt geschlossen.
- **Was er tut und was nicht.** Ein Aufwärmsatz eröffnet die Session und zählt für die Anwesenheit wie jeder Satz (D128). Er stellt nie die Kennzahl, erscheint nie als «Bester Arbeitssatz» und geht später nicht ins Arbeitsvolumen ein.
- **Rückgängig** bringt den Satz mit seinem Flag zurück (D131). Eine Aktion entscheidet aus dem, was gespeichert ist, wenn sie in der Schreibschlange an der Reihe ist.
- **Die Bedienung** entwirfst du klein und nach Vertrag §5: in der Satzzeile, mit 44 px Trefferfläche, als Wort erkennbar und nie nur als Farbe, mit einem Namen für Vorlesehilfen, ohne Umbruch bei 320 px auch in Pfund. Zeig sie am STOP in vier Breiten.
- **Die Zeile «Letztes Mal»** in einem geplanten Workout und jede andere Stelle, die einen früheren Satz als Marke nennt, nennt einen Arbeitssatz. Führ jede solche Stelle im STOP-Bericht auf.
- **Backup.** Das Feld überlebt Export und Import; ein Test belegt es. `SCHEMA_VERSION` und `BACKUP_FORMAT_VERSION` bleiben, wie sie sind. Hältst du eine Erhöhung für nötig, begründ sie im Entwurf, bevor du sie baust.

### Schritt 6 – Wörter und Übungsdetail

- «Bester Arbeitssatz» ersetzt «Bester Satz», «Aufwärmsatz» kommt neu, in beiden Sprachen nach Vertrag §13.
- Der Erklärsatz zur Kennzahl (`gym.progress.explainMetric`) sagt in Alltagssprache, was jetzt gilt: der beste Arbeitssatz des Tages, bei dem mehr Gewicht und mehr Wiederholungen beide zählen. Keine Formel, kein technisches Wort, kein Versprechen über Maximalkraft.
- Ein Tag wird weiterhin über seinen Satz benannt («8 × 82,5 kg»). Der Stärke-Score selbst wird nirgends als Kilogramm gedruckt; er liesse sich als Maximalkraft lesen.
- **Linie oder Balken** (Vertrag §6, D163): Rendere das Übungsdetail für drei echte Reihen aus den neuen Profilen (doppelte Progression, gleichmässiger Anstieg, eine Reihe mit einem leichten Tag) einmal mit den heutigen Balken und einmal als Linie nach den Regeln von §6, je bei 393 und 320 px. Im Build bleiben die Balken. Die Frage geht mit deiner Empfehlung an den STOP; entscheidet Dario für die Linie, baust du sie in derselben Session und ziehst §6 nach.

### Schritt 7 – Profile, Tests, Golden-Dateien

- **Die bestehenden Profile werden auf die alte Kennzahl festgelegt.** Danach sind jede bestehende Golden-Datei und jeder Fingerabdruck byte-identisch, ohne dass du eine Datei anfasst. Das ist der erste Beweis.
- **Neue Profile, neue Dateien.** Mindestens:
  - eines über die Grenze, mit mehreren Sätzen pro Übung und Tag, an mehreren Stichtagen vor, an und nach der Grenze eingefroren;
  - eines unter der neuen Kennzahl ab Tag 1 mit: doppelter Progression in 6–12 Wiederholungen; einer Pyramide; Drop-Sets nach der Arbeit; markierten und unmarkierten Aufwärmsätzen; einem Tag nur mit Aufwärmsätzen; einem einzelnen leichten Tag am Ende eines Fensters mit sechs und mit vier Übungstagen; einer ganzen leichten Woche; einer Körpergewichtsübung mit wechselndem Körpergewicht.
- **Die acht Fälle des Reviews** als Unit-Tests, mit den Zahlen der Spalte «Bestwert, Stärke-Score»: +2,5 %, +5,6 %, 0,0 %, 0,0 %, 0,0 %, −8,6 %, −3,9 %, −20,0 %. Dazu die Reihe aus dem Repo (5 × 69, 6 × 70,5, 7 × 72, 5 × 73,5, 6 × 75, 7 × 76,5 kg): −3 % am vierten Tag, +17 % über die Reihe.
- **Der zweite Beweis.** Für zufällig erzeugte Historien gilt: Jeder Tag vor der Grenze hat nach dem Anhängen des Markers denselben Wert wie davor, in jedem Ausgabefeld. Und eine Historie, die ganz vor der Grenze liegt, rechnet in jedem Feld wie der Code vor diesem Block.
- **Der Median** an seinen Kanten: zwei, drei, vier, fünf, sechs und sieben Übungstage.

### Schritt 8 – Der Zahlenbericht

Er steht im STOP-Bericht und, ohne private Daten, in `docs/design/wp3/stage5b-kennzahl.md`.

1. **Je Profil und Übung:** die Reihe alt gegen neu.
2. **Je Muskelgruppe bei 30 und 90 Tagen:** Veränderung und Zustand alt gegen neu.
3. **Das Rating:** Leistungsanteil und Gym-Rating am Tag der Grenze und 1, 7, 14 und 30 Tage danach, alt gegen neu, dazu der Boss. Der Review schätzt den einmaligen Schritt auf höchstens rund 50 Punkte im Ziel und rund −26 nach einer Woche; sag, was dein Replay ergibt.
4. **Median gegen «letzter gegen ersten»:** dieselben Tabellen mit beiden Regeln, damit Dario den Median bestätigen kann.
5. **Mit Darios Backup,** falls es angehängt ist: dieselben vier Tabellen für seine Daten, nach den Regeln aus Abschnitt 2. Fehlt es, erzeugst du mit dem Live-Build (`e30becd`, in einem getrennten Arbeitsverzeichnis) über dessen eigene Oberfläche ein Backup mit Sätzen, fährst den Probelauf damit und sagst im Bericht, dass der Lauf mit echten Daten fehlt.

### Schritt 9 – Schlussprüfung, Dokumente, Vorschau

1. `tsc -b`, `npm run test` (Exit-Code), `npm run build`, alle Browser-Suites, die 3D-Suites einzeln. Vergleich mit Schritt 0.
2. `git diff <Commit vor diesem Block> -- .github/fixtures` zeigt nur neue Dateien, ausser im Fall aus Schritt 4.
3. Dokumente: der Stand in `HANDOVER.md` (ein Stage-Block; «Gym performance» unter den Wertungsregeln; der Rückweg aus Review-Risiko 9 unter den Risiken). In `CLAUDE.md` die Sätze, die nicht mehr stimmen: was Gym vergleicht, die neue Era in der Liste unter «Configuration is historical», der Aufwärmsatz als Fakt am Satz und die dokumentierte Ausnahme von «keine fremden Normen» mit Verweis auf D150. In `docs/decisions.md` neue Einträge für das, was du entschieden hast.
4. Veröffentlich den Build in `Momentum-preview` nach dessen `README.md`; die Statusleiste bleibt `default`. Warte auf den Workflow und öffne die Seite, soweit deine Netzwerkregeln es zulassen.

## 8. Was sich nicht ändern darf, und was nicht hierher gehört

**Unverändert bleiben:**

- jeder Wert jedes Tages vor der Grenze, jede bestehende Golden-Datei und jeder bestehende Fingerabdruck;
- alles nach der prozentualen Veränderung: `src/core/scoring/`, die Kurve und ihre Steilheit (Review-Risiko 10 ist eine spätere Frage), 40/60, Endurance, Abbau;
- Laufen, Mind, der Boss ausser über das Gym-Rating;
- die Anwesenheit: Ein Satz eröffnet eine Session, ob Aufwärmsatz oder nicht;
- Sätze in Gramm, Gewichtseinträge in Kilogramm (D130);
- `bossService.ts:217` (D158);
- `muscleState.ts`: welcher Zustand aus welcher Zahl folgt;
- das Aussehen, ausser den zwei Wörtern, dem Flag in der Satzzeile und dem Erklärsatz.

Es gibt keine automatische Erkennung von Aufwärmsätzen, keine Wiederholungsbänder, keine Tabelle aus fremden Daten, keine Sonderregel für Pyramiden oder Deloads. Kein Test wird gelöscht oder abgeschwächt.

**Eigene Blöcke, nicht dieser:**

- das Arbeitsvolumen pro Woche als Anzeige und das Muskel-Sheet (7C);
- Körper, Bühne, Interaktion (7A, 7B);
- der Rückweg als geprobter Ablauf und die Freigabe (9).

## 9. Abnahmekriterien

- Der Entwurf liegt vor und stimmt mit dem Gebauten überein.
- Beide Beweise aus Schritt 7 bestehen; unter `.github/fixtures/` sind nur Dateien dazugekommen (oder der Fall aus Schritt 4 ist belegt).
- Die acht Fälle des Reviews und die Reihe aus dem Repo ergeben die genannten Zahlen.
- Die Aktivierung ist idempotent und hält die Grenze in jedem Fall aus Schritt 1, Frage 5.
- `replayPerformance.test.ts` besteht mit unveränderten Grenzen.
- Ein Aufwärmsatz lässt sich setzen, entfernen, rückgängig machen, exportieren und importieren; er zählt für die Woche und nie für die Kennzahl.
- `tsc -b` ist sauber, `npm run test` endet mit Exit 0, der Build läuft, jede Suite aus Schritt 0 besteht.
- Der Zahlenbericht liegt vor, und der Vorschau-Build ist erreichbar.

## 10. STOP 5b

Schreib Dario einen Bericht auf Deutsch, den er auf dem Telefon lesen kann:

1. In drei Sätzen: was sich geändert hat und ab wann es gilt.
2. Der Zahlenbericht aus Schritt 8, das Wichtigste zuerst: seine Muskelgruppen alt gegen neu, dann das Rating in den ersten 30 Tagen.
3. Die zwei Beweise, dass kein alter Tag sich bewegt hat, und die Laufzeiten.
4. Der Aufwärmsatz in vier Breiten, und die Bilder «Linie oder Balken».
5. Der Rückweg in zwei Sätzen: Nach dem ersten Laden trägt die Konfiguration das neue Feld; zurück geht es nur mit einem Backup von vor dem Update.
6. Eigene kleine Entscheidungen, jede mit Grund; darunter die Lesart «Pyramiden» und «ohne dass sie zählen».
7. Was du gesehen und für spätere Blöcke liegen gelassen hast.
8. Die Adresse der Vorschau und die Prüfliste fürs iPhone.
9. Höchstens fünf Fragen, jede mit Optionen und deiner Empfehlung. Zwei stehen fest: Median bestätigen, ja oder nein; Linie oder Balken.
10. Der Stand in git für beide Repos.

**Prüfliste fürs iPhone** (übernimm sie und pass sie an; höchstens zehn Punkte):

1. Zuerst in der Live-App ein frisches Backup exportieren und behalten. Es ist auch der Rückweg.
2. Die Vorschau öffnen und dieses Backup importieren. Live-App und Vorschau zeigen jetzt dieselben Daten: die Live-App nach der alten Kennzahl, die Vorschau nach der neuen.
3. Muskelgruppen, 30 Tage, in beiden: Passen die neuen Zahlen besser zu deinem Training als die alten? Nenn zwei Gruppen, bei denen du es sicher weisst.
4. Eine Übung, bei der du die Wiederholungen gesteigert und dann das Gewicht erhöht hast: Im Übungsdetail steht kein tiefer Einbruch mehr am Tag der Erhöhung.
5. Ein Workout öffnen und einen Satz als Aufwärmsatz markieren: mit einem Finger treffbar, als Wort erkennbar, nach dem Neuladen noch da.
6. Mit Aufwärmsatz und Arbeitssätzen nennt «Bester Arbeitssatz» nie den Aufwärmsatz.
7. Ein Workout nur mit einem Aufwärmsatz zählt für die Woche; die Übung zeigt keinen Wert und keine Null.
8. Den markierten Satz entfernen und «Rückgängig» tippen: Er kommt mit der Markierung zurück.
9. Gestern lässt sich ein Satz markieren, ein älterer Tag nicht.
10. Das Gym-Rating in der Vorschau weicht heute nur wenig von der Live-App ab; die erwartete Zahl steht im Bericht.

Dann wartest du auf Darios Abnahme. Bestätigt er den Median nicht, stellst du den Schalter um, erzeugst die neuen Golden-Dateien neu, veröffentlichst die Vorschau neu und sagst ihm, dass ein Gerät, das den Vorschau-Build schon geladen hat, den alten Schalter in seinem Stand trägt und ein frisch importiertes Backup braucht. Was er auf dem iPhone findet, behebst du in derselben Session. Der nächste Block startet in einer neuen Session mit `docs/wp3/prompts/prompt-7a-koerpermodell.md`.
