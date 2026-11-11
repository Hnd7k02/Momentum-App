# Prompt Farbregeln – Der Muskelstatus bekommt Band, Mindestdaten und neutrale Töne

Für eine frische Session mit dem Modell, das D159 festlegt. Die Session braucht zwei Repos: `Hnd7k02/Momentum-App` (Branch `claude/momentum-wp3`) und `Hnd7k02/Momentum-preview`.
Start: «Lies `docs/wp3/prompts/prompt-farbregeln-muskelstatus.md` und führe ihn aus.»
Geschrieben am 11.11.2026, nach der Abnahme von STOP 6b (D163). Zeilennummern beziehen sich auf den Commit `af89fd9`; prüf sie, bevor du dich darauf verlässt.

## 1. Worum es geht

Momentum ist eine lokale Web-App fürs iPhone mit zwei Bereichen: Mind (hell) und Gym (dunkel). Im Gym-Bereich zeigt ein drehbarer 3D-Körper je Muskelgruppe, wie sich die Trainingsleistung im gewählten Zeitraum verändert hat. Dieselbe Aussage steht in zehn Zeilen darunter, in der Kennzahl darüber und auf der Karte in der Gym-Übersicht.

Heute folgt diese Aussage einer zu nervösen Regel: Schon +1 % ist grün, schon −1 % rot, nur exakt 0 % gilt als gehalten, und «Gehalten» ist gelb wie eine Warnung. Zwei Trainingstage genügen als Vergleich. Der Körper flackert deshalb um null.

Dieser Block baut Vertrag §7: ein Toleranzband, eine Mindestmenge an Daten, «Gehalten» in einem neutralen Ton (am Körper weiss), die Zeiträume 30 und 90 Tage, die neuen Wörter und die Legende. Dario, der Eigentümer, hat das mit D153, D160 und D161 entschieden.

Die wichtigste Eigenschaft dieses Blocks: **Er ändert, was angezeigt wird, und nichts daran, was gerechnet wird.** Kein Rating, kein Verhältnis, kein Tageswert bewegt sich. Genau eine Golden-Datei ändert sich, und nur in der Spalte mit dem Anzeigezustand; das weist du nach, bevor du sie neu einfrierst.

## 2. Arbeitsweise in dieser Session

- **Modell.** Dieser Block ist für das Modell geschrieben, das D159 nennt. Läufst du als anderes Modell, sag es in der ersten Zeile deiner ersten Antwort.
- **Subagenten.** Nur für reine Such- und Leseläufe über viele Dateien, und nur auf Sonnet. Jede Entscheidung und jede Änderung machst du selbst.
- **Branch.** Du committest und pushst auf `claude/momentum-wp3` im Repo `Momentum-App`. Dario erlaubt das ausdrücklich, auch wenn deiner Session ein anderer Arbeitsbranch zugeteilt wurde. Kein anderer Branch, kein Pull Request, kein Merge, kein Push auf den Default-Branch: Er veröffentlicht die Live-App bei jedem Push.
- **Eine Veröffentlichung.** Am Schluss, und nur dann, veröffentlichst du den Vorschau-Build im Repo `Momentum-preview` auf `main` (Abschnitt 6, Schritt 8). Auch das erlaubt Dario ausdrücklich.
- **Commits.** Kleine, benannte Commits im Stil der bestehenden Historie, englisch. Das Neu-Einfrieren der einen Golden-Datei ist ein eigener Commit, der nichts anderes enthält als die Datei und ihren Fingerabdruck.
- **Sprache.** Chat und STOP-Bericht auf Deutsch in Schweizer Schreibweise. `docs/decisions.md`, `HANDOVER.md`, `CLAUDE.md`, Code-Kommentare und Commit-Nachrichten englisch wie bisher.
- **Zu Ende arbeiten.** Halte nicht an, solange du noch Teile schuldest. Hindernisse diagnostizierst und umgehst du. Angehalten wird am STOP in Abschnitt 9, oder vorher, wenn die Voraussetzung in Abschnitt 3 fehlt.

## 3. Voraussetzung

- Stage 6b ist abgenommen: `HANDOVER.md` nennt es im Block «WP3 Stage 6b» («accepted by the owner on his iPhone at STOP 6b»), und `docs/decisions.md` reicht mindestens bis D163.
- `docs/wp3/vertrag.md` trägt den Stand «freigegeben».

Fehlt eines davon, bau nichts. Sag Dario, was fehlt, und halte an.

**Der Vertrag geht diesem Prompt vor**, ebenso jeder Entscheid in `docs/decisions.md`, der jünger ist als D163. Wo sie diesem Prompt widersprechen, gelten sie; nenn den Widerspruch im STOP-Bericht. Wo der Vertrag zu einer Stelle schweigt, die du anfassen musst, entscheide im Sinn seines Leitbilds, halte die Entscheidung klein und führ sie im STOP-Bericht auf.

## 4. Was du zuerst liest

1. `docs/wp3/vertrag.md`: §7 ganz, dazu §2 (die drei Aufgaben der Farbe), §6 (Endpunkt und Zeile), §8 (Material: weiss und gedimmt), §11 (leer), §13 (Wörter) und §14.
2. Die Mockups `docs/wp3/mockups/muskelgruppen.html` und `muskel-sheet.html` mit ihren Bildern unter `docs/wp3/mockups/bilder/`. Sieh dir die Bilder an. `docs/wp3/mockups/werkzeug/koerper-standbild.html` zeigt, mit welchen Tönen der Körper der Mockups gefärbt wurde.
3. `docs/decisions.md`: D153, D154, D160, D161, D162 (der Absatz «"Gehalten" keeps its yellow») und D163; dazu D123.
4. `docs/wp3/review-2026-11.md`: Abschnitt E, «Farben, Legende, Zustände» und Risiko 6.
5. `HANDOVER.md`: den Block «WP3 Stage 6b» samt «After STOP 6b».
6. `scripts/verify/README.md` und den Code aus Abschnitt 5.

## 5. Ausgangslage im Code

**Die Regel**

- `src/features/gym/muscleState.ts` (57 Zeilen) ist die eine Stelle. `roundShown` (Zeile 19) rundet mit `Math.round`, also −2,5 auf −2 und +2,5 auf +3. `shownTrend` (29) liest das Vorzeichen der gerundeten Zahl. `muscleStateOf(entry: MusclePerformance)` (53) liefert `noData`, bei `insufficientBaseline` den Zustand `awaitingBaseline`, sonst die Richtung.
- Die fünf Zustände heissen im Code `improved`, `unchanged`, `declined`, `awaitingBaseline` und `noData` (`src/features/body/tokens.ts:25–30`).
- Wer dort liest: `src/features/body/bodyVisuals.ts:3` (3D-Körper), `MuscleRows.tsx:10`, `MuscleEntryCard.tsx:13` (Karte in der Gym-Übersicht), `GymProgress.tsx:18` (mit Re-Export in Zeile 40), `muscleAnalytics.ts:10`, `ExerciseDetail.tsx:8` (`roundShown` und `shownTrend` für die Veränderung einer einzelnen Übung) und der flache Ersatzkörper unter `src/components/BodyRenderer/`.
- **Drei Stellen runden noch selbst** und leiten daraus Wort und Farbe ab, ohne `muscleState.ts` zu fragen: die Kennzahl auf der Karte in der Gym-Übersicht (`MuscleEntryCard.tsx:90–106`), `changeText` in `GymProgress.tsx:42–53` und `changeText` in `GymOverview.tsx:40–50` (dort für die Leistung seit Jahresbeginn im Rating).
- Der Zähler «n von 10 Gruppen gewertet» und die Kennzahl darüber lesen heute `history.overall.measured` und `history.overall.ratio` aus der Rechnung (`GymProgress.tsx:187–188`, `MuscleEntryCard.tsx:66`), nicht den Anzeigezustand.
- `MusclePerformance` (`src/core/gym/performance.ts:256`) trägt `status`, `ratio`, `exercises`, `compared` und `latestScore`, aber keine Zahl der Übungstage. Sie lässt sich dort auch nicht zählen: `gymPerformanceOverSpan` (435) reicht je Übung nur den ersten und den letzten Tag weiter. Die Übungstage des Zeitraums stehen in `GymHistory.days`; `muscleAnalytics.ts` liest sie bereits (`trainingDays`, Zeile 101).

**Der Körper**

- `bodyVisuals.ts:31–45` macht aus Zustand und Veränderung einen Farbton und eine Stärke: `STATE_COLOR[state].model` und `stateIntensity(state, delta)` (`tokens.ts:96–102` und `144–150`). Heute: gehalten ist `--status-mixed` (Gelb) mit Stärke 0,4; zu wenig Daten ist `--sky-ink` mit 0,42; nicht trainiert hat Stärke 0 und bleibt im Grundgrau; verbessert und zurückgegangen wachsen von 0,34 bei 0 % auf 1 bei 12 %. Die Stärke rechnet mit der ungerundeten Veränderung.
- Es gibt genau einen neutralen Ton, `--body-base` (`#c9c9d2`, `tokens.css:362`). Er ist zugleich das ungefärbte Material und die Farbe der neutralen Zone `none` (`BodyModel.tsx:64`). `useMuscleHighlight.ts:144–157` mischt ihn mit dem Farbton. `tokens.test.ts:115–122` hält die heutigen Werte fest.
- Im heutigen GLB gehören die Hände zu den Unterarmen. Das ändert Block 7A, nicht dieser.

**Gelb für «Gehalten»**

`muscleModule.css:218–222`, `gym.css:397–398` und `458–459`, `gymHub.css:111–112`, und der flache Ersatzkörper mit seiner Legende in `src/components/BodyRenderer/bodyRenderer.css` (Zeilen 53–54, 114–115 und 143).

**Zeiträume**

`TREND_RANGES = [7, 30]` steht in `src/core/config/constants.ts:179` und wird dreimal benutzt: `ProgressScreen.tsx:31` und `143` (Verlauf), `GymMusclesScreen.tsx:32` und `64` (Muskeltrend, Vorgabe ist der letzte Eintrag) und `GymTerminal.tsx:84` (die Karte in der Gym-Übersicht nimmt ebenfalls den letzten Eintrag, heute 30).

**Wörter**

- `src/i18n/de.ts:375` `muscle.state.awaitingBaseline` «Noch kein Vergleich»; `422` `gym.progress.overall` «Gesamtentwicklung»; `427–429` `gym.progress.noBaseline` mit dem Hinweis «… an zwei Trainingstagen in den letzten {days} Tagen»; `tokens.ts:100` führt für denselben Zustand den Text «Kein Vergleich». Die Karte in der Gym-Übersicht schreibt «Gesamt {change}» (`gymHub.muscles.overall`, Zeile 730). Englisch stehen in `en.ts` «No comparison yet» (369 und 419) und «Overall progress» (414).
- `src/features/gym/muscleGap.ts` unterscheidet vier Arten von «leer» und nennt den Zeitraum in Tagen (`gymHub.muscles.*`, `de.ts:732–741`).
- Eine Legende oder einen Knopf ⓘ gibt es auf dem Screen nicht.

**Die Golden-Datei**

- `src/storage/services/domainOutputs.test.ts` vergleicht alle Rechenergebnisse exakt mit `.github/fixtures/wp3-golden/`. Für Gym schreibt `gymOutputsOf` (Zeile 154) je Muskelgruppe ein Tupel, dessen siebtes Element `muscleStateOf(m)` ist; die Fenster sind `GYM_RANGES = [7, 30, 90]` (174). Die Gym-Fingerabdrücke in den Zeilen 190–192 enthalten den Zustand ebenfalls.
- Nur `a-four-domain-profile-under-the-current-models.gym.json` enthält Sätze. Die beiden RC2-Profile haben keine; ihre Gym-Dateien dürfen sich nicht ändern.
- Neu einfrieren: `WP3_GOLDEN_DIR=<Ordner> npx vitest run src/storage/services/domainOutputs.test.ts` schreibt die Dateien in den Ordner, statt zu vergleichen.

**Suites, die alte Wörter oder Regeln prüfen**

`scripts/verify/gym-muscles.mjs:151` und `wp3-reload.mjs:296` («Noch kein Vergleich»; `wp3-reload` prüft ausserdem den Wechsel zwischen 7 und 30 Tagen), `wp3-stage1.mjs:763–787` («Gehalten» bei einer Veränderung, die auf 0 % rundet), `phase4-a11y.mjs:106` (die Namen der Zustände), `design-system.mjs` (Muskelgruppen mit leerem Zeitraum, 45 Tage nach der letzten Session; in den Zeilen 645–648 tippt sie dort auf «7 Tage» und erwartet «Kein Training in den letzten 7 Tagen»).

**Prüfung**

- `npm run test` muss mit Exit 0 enden; lies den Exit-Code, nicht die Zusammenfassung. Der Typecheck ist `tsc -b`. Stand am 11.11.2026: 111 Dateien, 1728 Tests.
- Die Browser-Suites laufen gegen `npm run build` und `npx vite preview --port 4173`, `body.mjs` gegen den Dev-Server. Die drei 3D-Suites `gym-muscles`, `body` und `body-reach` laufen einzeln. Stand: 37 Suites, 36 grün; rot ist allein die Offline-Prüfung in `release-proof.mjs` («offline, Gym still shows the 3D body»). Sie gehört dem Aufräum-Block (D163) und wird hier nicht angefasst.
- Chromium liegt unter `/opt/pw-browsers/chromium`. Installiere keinen Browser.

## 6. Die Arbeit, in dieser Reihenfolge

### Schritt 0 – Ausgangsmessung

`tsc -b`, `npm run test`, `npm run build` und jede Browser-Suite einmal, die 3D-Suites einzeln. Halt fest: Suite, bestanden von gesamt. Was vor deiner Arbeit fehlschlägt, ist ein Befund für den STOP-Bericht. Was vorher bestand, muss am Ende bestehen.

### Schritt 1 – Die Regel, an der einen Stelle

In `muscleState.ts`, mit Tests in `muscleState.test.ts` (Vertrag §14):

- **Rundung.** Kaufmännisch in beide Richtungen: −2,5 wird −3, +2,5 wird +3, und −0 bleibt 0.
- **Band.** Der Zustand folgt der angezeigten ganzen Zahl: ab +3 % verbessert, ab −3 % zurückgegangen, −2 % bis +2 % gehalten. Zahl und Zustand können so nie auseinanderfallen.
- **Mindestdaten.** «Zu wenig Vergleichsdaten» gilt, wenn die Gruppe im Zeitraum weniger als drei Übungstage hat oder keine Übung mit zwei Tagen (das ist das heutige `insufficientBaseline`). Ein **Übungstag** ist eine Übung an einem Tag, also ein Eintrag in `GymHistory.days`, und er zählt für jede Gruppe, der die Übung an diesem Tag ein Gewicht über null gibt. Das ist dieselbe Zugehörigkeit, mit der `musclePerformance` rechnet.
- **Eine andere Lesart gibt es:** drei verschiedene Kalendertage statt drei Einträge. Bankdrücken und Schrägbank am Montag und Bankdrücken am Donnerstag sind drei Übungstage, aber zwei Kalendertage. Bau die Lesart oben. Zähl für das Testprofil mit Sätzen (und für Darios Daten, falls er sein Backup anhängt), in wie vielen Gruppen und Zeiträumen die beiden Lesarten auseinandergehen, und leg das am STOP als Frage vor.
- **Die Zahl der Übungstage kommt aus der History**, nicht aus `src/core`. Körper, Zeile, Chip, Karte und der Golden-Test rufen dieselbe Funktion; keiner zählt selbst.
- **Die Kennzahl darüber** (der Trend aller gewerteten Gruppen) trägt denselben Zustand nach demselben Band.
- **Was «gewertet» heisst.** Eine Gruppe mit «Zu wenig Vergleichsdaten» zählt in der Anzeige nicht als gewertet: Der Zähler «n von 10» und die Kennzahl darüber lesen nur Gruppen, die verbessert, gehalten oder zurückgegangen sind. Sonst stünde über sieben Zeilen mit Zahl «9 von 10 gewertet». Die Kennzahl ist dann das Mittel dieser Gruppen, jede mit gleichem Gewicht, wie `gymPerformance` es bildet. Das ist eine Zahl der Anzeige, gebildet an derselben einen Stelle; das Rating rechnet weiter mit seinen eigenen Fenstern, und `src/core` bleibt unberührt. Zeig am STOP, wo Zähler und Kennzahl dadurch von heute abweichen.
- **Die drei Stellen, die heute selbst runden,** lesen danach dieselbe Funktion. Für die Leistung seit Jahresbeginn in `GymOverview.tsx` gelten Rundung und Band wie für jede gefärbte Veränderung; die Mindestdaten-Regel gilt dort nicht.
- **Einzelne Übungen.** `shownTrend` färbt heute auch die Veränderung einer einzelnen Übung (Übungsliste, Übungsdetail, letzter Balken). Vertrag und D153 sprechen von der Gruppe. Damit Liste und Gruppe sich nicht widersprechen, gilt das Band für jede Veränderung, die als Zustand gefärbt wird; die Mindestdaten-Regel gilt nur für die Gruppe und die Kennzahl darüber. Führ das im STOP-Bericht als eigene kleine Entscheidung auf.
- **Die Namen der Zustände im Code bleiben** (`unchanged`, `awaitingBaseline`). Benennst du sie um, ändert sich die Golden-Datei in jeder Zeile statt nur dort, wo ein Zustand wechselt.

### Schritt 2 – Der Nachweis und die eine Golden-Datei

1. Nach Schritt 1 schlägt `domainOutputs.test.ts` fehl. Es darf nur an zwei Stellen fehlschlagen: an der Gym-Golden-Datei des Profils mit Sätzen und an dessen Gym-Fingerabdruck. Jede Boss-Datei, die beiden RC2-Gym-Dateien, alle Boss-Fingerabdrücke und `stage2Baseline.test.ts` bleiben grün, ohne dass du sie anfasst. Schlägt mehr fehl, hast du etwas an der Rechnung verändert: such den Fehler, frier nichts ein.
2. Frier zuerst in einen Ordner ausserhalb des Repos ein und vergleich mit der bestehenden Datei: Unterschiede gibt es nur im siebten Element der Muskel-Tupel. Belege das mit einem kleinen Skript, das beide Dateien mit maskiertem siebten Element vergleicht und Gleichheit meldet.
3. Erst dann frierst du im Repo neu ein und trägst den einen neuen Gym-Fingerabdruck ein. Die Zahl `values` daneben bleibt gleich, weil die Zustandswörter keine Ziffern enthalten.
4. `GYM_RANGES` im Test bleibt bei 7, 30 und 90. Das sind die Fenster der Golden-Datei, nicht die Auswahl auf dem Screen; ein Fenster zu streichen würde den Nachweis verwischen. Der Kommentar darüber wird wahr gemacht.

Im STOP-Bericht steht eine Tabelle: Fenster, Gruppe, Zahl, Zustand alt, Zustand neu, Grund (Band oder Mindestdaten).

### Schritt 3 – Zeiträume

Der Muskeltrend bekommt 30 und 90 Tage mit 30 als Vorgabe; der Verlauf behält 7 und 30. Die beiden teilen sich heute eine Konstante und bekommen je eine. Die Karte in der Gym-Übersicht bleibt bei 30 Tagen. Die neue Konstante ist die einzige Zeile, die du unter `src/core/` änderst.

Zieh die Texte nach, die den Zeitraum nennen (`muscleGap.ts`, die leeren Zustände, der Hinweis bei zu wenig Daten), und prüf mit einem Testprofil, dass 90 Tage zeigt, was 30 Tage nicht mehr erreicht.

### Schritt 4 – Farbe am Körper

- **Zwei neutrale Töne statt einem** (Vertrag §8, D161): Weiss für «Gehalten», den Ton eines trainierten Muskels ohne Veränderung; gedimmt für «Noch nicht trainiert» und für die neutrale Zone (Kopf, Hände, Füsse). Ein Körper ohne Daten ist eine ruhige graue Figur, und Training macht ihn hell. Beide Töne sind Tokens in `tokens.css`; nimm als Ausgang die Töne aus dem Werkzeug der Mockups.
- **Wem was gehört.** Dieser Block legt die zwei Tokens an und bestimmt, welcher Zustand welchen Ton bekommt; das bleibt. Block 7A stellt Licht und Tone Mapping ein und darf die Werte der Tokens danach nachziehen.
- **Verbessert** grün getönt, **zurückgegangen** rot getönt, **zu wenig Vergleichsdaten** leicht blau getönt.
- **Stärke.** Sie wächst gleichmässig von 2,5 % bis 12 % und bleibt darüber gleich. Wähl die kleinste Stärke so, dass +3 % bei 393 px neben einer gehaltenen, weissen Gruppe als Grün erkennbar ist.
- Der flache Ersatzkörper zeigt dieselben fünf Zustände mit denselben Tönen.
- Licht, Rauheit, Tone Mapping, das GLB und `body-preview.webp` bleiben, wie sie sind; das ist Block 7A. Der heutige Körper zeigt die Statusfarben deshalb noch als Pastell, und die Hände färben sich noch mit den Unterarmen. Beides nennst du im STOP-Bericht als bekannt.
- `tokens.test.ts` hält danach die beiden Töne statt des einen, genauso streng.

Zeig das Ergebnis an fünf Bildern aus `#/dev/body` oder dem echten Screen: gemischte Datenlage von vorne und von hinten, ein Körper ohne Daten, einer nur mit gehaltenen Gruppen, und +3 % neben gehalten.

### Schritt 5 – Zeile, Chip, Karte, Diagramm

Nach der Tabelle in Vertrag §7:

- **Gehalten:** Linie, Zahl in Textfarbe, das Wort. Kein Gelb mehr, an keiner der Stellen aus Abschnitt 5, auch nicht am flachen Ersatzkörper und in seiner Legende.
- **Verbessert, zurückgegangen:** Linie, Zahl in der Statusfarbe, das Wort.
- **Zu wenig Vergleichsdaten:** blauer Chip, keine Linie.
- **Noch nicht trainiert:** neutraler Chip, der Punkt blass.
- Der Endpunkt der Verlaufslinie ist bei «Gehalten» schon neutral (6b); er folgt jetzt der neuen Regel.
- Farbe ist nie der einzige Träger: Jeder Zustand steht als Wort da, auch für Vorlesehilfen.

### Schritt 6 – Wörter und Legende

- «Leistungstrend» ersetzt «Gesamtentwicklung» und das «Gesamt» auf der Karte in der Gym-Übersicht; «Zu wenig Vergleichsdaten» ersetzt «Noch kein Vergleich» und «Kein Vergleich». Das gilt in beiden Sprachen, nach den Tabellen in Vertrag §7 und §13. Nie «Entwicklung», nie «gewachsen».
- Wo eine Gruppe zu wenig Daten hat, sagt ein Satz, wie viele Übungstage es im Zeitraum gibt und ab wann ein Trend erscheint (Muster im Mockup: «2 Übungstage in den letzten 30 Tagen. Ab dem dritten zeigt Momentum einen Leistungstrend.»). `muscleGap.ts` lernt denselben Grund für den Fall, dass keine einzige Gruppe genug Daten hat.
- **Die Legende.** Ein Knopf ⓘ in der Kopfzeile von Muskelgruppen (44 px Trefferfläche, mit Namen für Vorlesehilfen) öffnet ein Sheet mit dem Legendensatz aus Vertrag §7, wörtlich, und den fünf Zuständen mit ihrer Regel in Worten. Unter dem Körper steht die Reihe der fünf Zustände wie im Mockup 1. Der Satz sagt schon «bester Arbeitssatz», obwohl die Kennzahl bis Block 5b der beste Satz ist; bau ihn trotzdem wörtlich und nenn die Vorwegnahme im STOP-Bericht.
- Die Zahlen folgen den drei Textregeln aus D163 (`i18n/typography.ts`).
- «Bester Satz» bleibt in der übrigen Oberfläche stehen; «Bester Arbeitssatz» führt Block 5b ein. «uneinheitlich» baut Block 7C mit dem Sheet.

### Schritt 7 – Suites und Durchsicht

- Schreib jede Prüfung, die ein altes Wort oder die alte Regel prüft, auf die neue Regel um, genauso streng. `wp3-reload.mjs` prüft danach den Wechsel zwischen 30 und 90 Tagen. `design-system.mjs` behält den leeren Zeitraum bei 30 Tagen, der Vorgabe; ihr Tipp auf «7 Tage» wird ein Tipp auf «90 Tage», und sie prüft dort, dass die Session von vor 45 Tagen erscheint.
- Neu in einer Browser-Suite: Für jede der zehn Zeilen passt der Zustand zur gedruckten Zahl (−2 bis +2 gehalten, sonst die Richtung), und eine Gruppe mit weniger als drei Übungstagen zeigt den Chip und keine Linie.
- Erzeug Screenshots von Muskelgruppen (oben, bei den Zeilen, mit offener Legende, 30 und 90 Tage, leerer Zeitraum), der Gym-Übersicht und des Übungsdetails bei 320, 360, 393 und 430 px unter `docs/design/wp3/farbregeln/`. Sieh dir jeden an.

### Schritt 8 – Schlussprüfung und Vorschau

1. `tsc -b`, `npm run test` (Exit-Code), `npm run build`, alle Browser-Suites, die 3D-Suites einzeln. Vergleich mit Schritt 0.
2. `git diff af89fd9 -- .github/fixtures` zeigt genau eine Datei, und `git diff af89fd9 --stat -- src/core src/storage` zeigt nur die Konstante der Zeiträume und den Golden-Test.
3. Trag den Stand in `HANDOVER.md` ein, im Stil der bestehenden Stage-Blöcke. Halt die Entscheidungen dieses Blocks als neuen Eintrag in `docs/decisions.md` fest (nächste freie Nummer). Zieh in `CLAUDE.md` nach, was nicht mehr stimmt (die Zeiträume von Muskelgruppen; «Gehalten» ist neutral).
4. Veröffentlich den Build in `Momentum-preview` nach dem Vorgehen in dessen `README.md`. Die Statusleiste bleibt `default` (D163). Halt im `README.md` der Vorschau fest, aus welchem Commit der Build stammt. Warte, bis der Workflow «Publish preview» durchgelaufen ist, und öffne die Seite einmal selbst, soweit die Netzwerkregeln deiner Session es zulassen; wenn nicht, sag das im STOP-Bericht.

## 7. Was sich nicht ändern darf, und was nicht hierher gehört

**Unverändert bleiben:**

- alles, was rechnet oder speichert: `src/core/` (ausser der einen Konstante), `src/storage/`, das Datenschema, das Backup-Format;
- jede Golden-Datei und jeder Fingerabdruck ausser der einen Gym-Datei und ihrem Fingerabdruck;
- das Verhalten jeder Bedienung, ausser dem neuen Knopf ⓘ und der Zeitraumwahl;
- das GLB, Licht, Rauheit und Tone Mapping des Körpers, `body-preview.webp`;
- das Layout des Muskelgruppen-Screens: Grösse und Rahmen des Körpers, der Titel und die Kennzahlenkarte bleiben, wo sie sind. Dazu kommen nur der Knopf ⓘ und die Reihe der fünf Zustände.

Kein Test wird gelöscht oder abgeschwächt, damit etwas grün wird. Im STOP-Bericht steht jede umgeschriebene Prüfung mit alter und neuer Regel.

**Eigene Blöcke, nicht dieser:**

- die Kennzahl, das Aufwärm-Flag und «Bester Arbeitssatz» (5b);
- Modell, Licht, Material, Tone Mapping, die neutralen Hände (7A);
- die Körperbühne mit Kennzahlenleiste, Zoom, Tippen und Drehen, der Weg von Heute (7B);
- das Muskel-Sheet, «uneinheitlich», das Arbeitsvolumen (7C);
- die Offline-Prüfung und die veralteten Dokumente (Aufräumen).

Fällt dir unterwegs etwas auf, das in einen dieser Blöcke gehört, schreib es in den STOP-Bericht und lass es stehen.

## 8. Abnahmekriterien

- `muscleState.ts` ist die einzige Stelle, die aus einer Zahl einen Zustand macht; `muscleState.test.ts` hält Rundung, Band und Mindestdaten an den Grenzen fest (−3, −2,5, −2, 0, +2, +2,5, +3; zwei und drei Übungstage; keine Übung mit zwei Tagen).
- Genau eine Golden-Datei und ein Fingerabdruck haben sich geändert, und der Nachweis aus Schritt 2 liegt vor.
- `tsc -b` ist sauber, `npm run test` endet mit Exit 0, der Build läuft, jede Suite aus Schritt 0 besteht.
- «Gehalten» ist nirgends mehr gelb; Körper, Zeile, Karte und Legende zeigen für jede Gruppe denselben Zustand.
- Muskelgruppen bietet 30 und 90 Tage, der Verlauf 7 und 30.
- «Gesamtentwicklung», «Noch kein Vergleich» und «Kein Vergleich» kommen im Gym-Bereich nicht mehr vor, ebenso wenig «Overall progress» und «No comparison yet». Laufen behält seine eigenen Texte.
- Der Zähler «n von 10» nennt genau die Gruppen, deren Zeile eine Zahl zeigt.
- Jeder Text hält 4,5:1 an den gerenderten Pixeln (`design-system.mjs`), auch im Sheet der Legende.
- Der Vorschau-Build ist erreichbar und zeigt die neuen Regeln.

## 9. STOP Farbregeln

Schreib Dario einen Bericht auf Deutsch, den er auf dem Telefon lesen kann:

1. In drei Sätzen: was sich geändert hat.
2. Die fünf Körperbilder aus Schritt 4 und drei Vorher-nachher-Paare: Muskelgruppen oben, die Zeilen, die Karte in der Gym-Übersicht.
3. Die Tabelle aus Schritt 2 und der Nachweis, dass sich keine Rechnung bewegt hat.
4. Die Zahlen: Tests, Suites gegen die Ausgangsmessung, der tiefste Kontrast je Welt.
5. Eigene kleine Entscheidungen und Abweichungen vom Vertrag, jede mit Grund.
6. Jede umgeschriebene Prüfung mit alter und neuer Regel.
7. Was du gesehen und für spätere Blöcke liegen gelassen hast.
8. Die Adresse der Vorschau und die Prüfliste fürs iPhone.
9. Höchstens fünf Fragen, jede mit Optionen und deiner Empfehlung. Dazu gehört die Lesart von «Übungstag» mit den Zahlen aus Schritt 1.
10. Der Stand in git für beide Repos.

**Prüfliste fürs iPhone** (übernimm sie und pass sie an, was du gebaut hast; höchstens zehn Punkte):

1. Muskelgruppen bietet «30 Tage» und «90 Tage»; der Verlauf weiterhin 7 und 30.
2. Eine Gruppe zwischen −2 % und +2 %: am Körper weiss, in der Zeile die Zahl in Textfarbe und «Gehalten». Kein Gelb.
3. Eine Gruppe ab +3 % ist grün, eine ab −3 % rot. Bei drei Gruppen stimmen Körper, Zahl und Wort überein.
4. Eine Gruppe mit weniger als drei Übungstagen: blauer Chip «Zu wenig Vergleichsdaten», keine Linie, am Körper leicht blau, und ein Satz sagt, was fehlt.
5. Eine nicht trainierte Gruppe ist am Körper gedimmt, deutlich dunkler als eine gehaltene.
6. Der Knopf ⓘ öffnet die Legende; der Satz ist lesbar, das Sheet schliesst sauber.
7. Über dem Körper steht «Leistungstrend», auch auf der Karte in der Gym-Übersicht.
8. Mit dem importierten Backup: Bei 90 Tagen erscheinen Gruppen, die bei 30 Tagen leer sind.
9. Im Übungsdetail liest eine Veränderung von ±1 % oder ±2 % als «Gehalten».
10. Bekannt und nicht zu melden: Die Hände färben sich noch mit den Unterarmen, und die Farben am Körper sind noch blass (beides Block 7A).

Dann wartest du auf Darios Abnahme. Was er auf dem iPhone findet, behebst du in derselben Session und veröffentlichst die Vorschau neu. Der nächste Block startet in einer neuen Session mit `docs/wp3/prompts/prompt-5b-kennzahl.md`.
