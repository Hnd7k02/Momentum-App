# Prompt 7C – Das Muskel-Sheet: eine Gruppe im Detail

Für eine frische Session mit dem Modell, das D159 festlegt. Die Session braucht zwei Repos: `Hnd7k02/Momentum-App` (Branch `claude/momentum-wp3`) und `Hnd7k02/Momentum-preview`.
Start: «Lies `docs/wp3/prompts/prompt-7c-muskel-sheet.md` und führe ihn aus.»
Geschrieben am 11.11.2026, vor den Blöcken «Farbregeln», 5b, 7A und 7B. Zeilennummern beziehen sich auf den Commit `af89fd9`; die vier Blöcke davor haben fast alle hier genannten Dateien verändert. Nimm die Zeilen als Wegweiser zum Symbol, nicht als Adresse, und lies zuerst die Blöcke der Vorgänger in `HANDOVER.md`.

## 1. Worum es geht

Momentum ist eine lokale Web-App fürs iPhone. Im Gym-Bereich zeigt ein drehbarer 3D-Körper je Muskelgruppe, wie sich die Trainingsleistung verändert hat; darunter stehen zehn Zeilen mit derselben Aussage. Was bis heute fehlt, ist die Antwort auf die nächste Frage: Warum steht diese Gruppe so da? Ein Tipp auf einen Muskel hebt ihn nur hervor und filtert eine Übungsliste weiter unten.

Dieser Block baut das Muskel-Sheet nach Vertrag §9: Es fährt über dem Körper hoch und zeigt für eine Gruppe die Veränderung, den Verlauf, die Übungen mit ihrem besten Arbeitssatz und das Arbeitsvolumen pro Woche. Dario, der Eigentümer, hat das mit D152, D155 und D161 entschieden. Dafür lernt die Sheet-Komponente zwei Dinge, die sie heute nicht kann: Höhenstufen und Wegziehen.

Die wichtigsten Eigenschaften dieses Blocks:

- **Körper, Zeile und Sheet zeigen dieselbe Zahl und denselben Zustand**, weil alle drei an derselben Stelle lesen. Eine Prüfung im Browser hält das fest.
- **Ohne Messwert kein Diagramm.** Wo Daten fehlen, sagt ein Satz, was fehlt.
- **Das Arbeitsvolumen wird gezeigt und nie gewertet.** Es geht in kein Rating, nicht in den Boss und in keine Farbe ein.
- An dem, was die App rechnet und wertet, ändert sich nichts.

## 2. Arbeitsweise in dieser Session

- **Modell.** Dieser Block ist für das Modell geschrieben, das D159 nennt. Läufst du als anderes Modell, sag es in der ersten Zeile deiner ersten Antwort.
- **Subagenten.** Nur für reine Such- und Leseläufe über viele Dateien, und nur auf Sonnet. Jede Gestaltungsentscheidung und jede Änderung machst du selbst.
- **Branch.** Du committest und pushst auf `claude/momentum-wp3` im Repo `Momentum-App`. Dario erlaubt das ausdrücklich, auch wenn deiner Session ein anderer Arbeitsbranch zugeteilt wurde. Kein anderer Branch, kein Pull Request, kein Merge, kein Push auf den Default-Branch: Er veröffentlicht die Live-App bei jedem Push.
- **Eine Veröffentlichung.** Am Schluss, und nur dann, veröffentlichst du den Vorschau-Build im Repo `Momentum-preview` auf `main` (Abschnitt 6, Schritt 8). Auch das erlaubt Dario ausdrücklich.
- **Commits.** Kleine, benannte Commits im Stil der bestehenden Historie, englisch. Eine Golden-Datei oder ein Fingerabdruck wird in diesem Block nie neu eingefroren.
- **Sprache.** Chat und STOP-Bericht auf Deutsch in Schweizer Schreibweise. `docs/decisions.md`, `HANDOVER.md`, `CLAUDE.md`, Code-Kommentare und Commit-Nachrichten englisch wie bisher.
- **Zu Ende arbeiten.** Halte nicht an, solange du noch Teile schuldest. Hindernisse diagnostizierst und umgehst du. Angehalten wird am STOP 7C in Abschnitt 9, oder vorher, wenn die Voraussetzung in Abschnitt 3 fehlt.

## 3. Voraussetzung

Abgenommen sind, laut `HANDOVER.md` oder Darios Startnachricht:

- **Farbregeln:** `muscleState.ts` trägt Band und Mindestdaten; 30 und 90 Tage; die Legende.
- **5b:** die Kennzahl ist der beste Arbeitssatz; Sätze können als Aufwärmsatz markiert sein.
- **7B:** die Körperbühne steht; ein Tipp dreht nie; der Viewer lässt sich anhalten.

Fehlt eines davon, bau nichts. Sag Dario, was fehlt, und halte an.

**Der Vertrag geht diesem Prompt vor**, ebenso jeder Entscheid in `docs/decisions.md`, der jünger ist als D163. Wo sie diesem Prompt widersprechen, gelten sie; nenn den Widerspruch im STOP-Bericht. Wo der Vertrag schweigt, entscheide im Sinn seines Leitbilds, halte die Entscheidung klein und führ sie im STOP-Bericht auf.

## 4. Was du zuerst liest

1. `docs/wp3/vertrag.md`: §9 ganz, §6 (Linie, Diagramm im Sheet, Balken), §7 («uneinheitlich», die fünf Zustände), §3, §11, §12, §13 und §14 (die Zeilen für 7C).
2. Mockup 2: `docs/wp3/mockups/muskel-sheet.html` mit den Bildern `2-muskel-sheet-*.png` und `2-muskel-sheet-wenig-*.png`. Sieh sie dir an; sie zeigen Reihenfolge und Falz.
3. `docs/decisions.md`: D152, D155, D161, D163 (Balken ab null, die drei Textregeln) und die Einträge der Blöcke «Farbregeln», 5b, 7A und 7B.
4. `HANDOVER.md`: die Blöcke der Vorgänger in WP3.
5. `docs/wp3/review-2026-11.md`: Abschnitt C («Signaturmomente») und Abschnitt E («Empfohlene Messdefinition», die zweite Zahl).
6. `scripts/verify/README.md`: `gym-muscles.mjs`, `wp3-sheets.mjs`, `design-system.mjs`.
7. Den Code aus Abschnitt 5.

## 5. Ausgangslage im Code

**Die Sheet-Komponente**

- `Sheet` in `src/components/index.tsx:413` mit `open`, `title`, `onClose`, `children`, `footer`, `returnFocus`. Sie wird in `<body>` eingehängt, ist ein modaler Dialog mit dem Titel als Namen, setzt den Fokus auf ein markiertes Feld oder auf sich selbst und gibt ihn beim Schliessen zurück.
- Schliessen: Tipp auf den Hintergrund, das Kreuz, Escape. Die Zurück-Geste des Browsers schliesst kein Sheet.
- CSS in `src/components/ui.css` ab Zeile 570: eine einzige Höhe (`max-height: 88vh`), die Auffahrt mit `--duration-sheet`, Glas mit deckendem Ersatz. Der Greifer (618) ist ein unbeweglicher Strich ohne Funktion.
- `src/app/route.ts:20–23` sagt ausdrücklich: Sheets sind keine Orte und kommen nie in die Adresse.
- `scripts/verify/wp3-sheets.mjs` tippt in jedes Textfeld jedes Sheets und prüft Fokus und Escape. Das muss grün bleiben.

**Was ein Tipp auf einen Muskel heute tut**

- Die Auswahl liegt in `src/features/gym/GymProgress.tsx:74`. Der Körper wählt (`onSelect`), eine Zeile schaltet um (`onToggle`, 217–225).
- Die Übungsliste darunter zeigt die Übungen der gewählten Gruppe, oder alle (92–106), unter «Übungen · Brust». Ihre Veränderung ist `history.comparisons.get(id)`: der letzte Tag gegen den vorigen Tag derselben Übung, nicht die Veränderung im Zeitraum.
- Ein Tipp auf eine Übung ersetzt den Screen durch `ExerciseDetail` (108–117). Das ist ein Zustand der Komponente, kein Ort in der Adresse.
- Auf dem Screen gibt es bereits Sheets: die Erklärung der Kennzahl (`MetricDetailSheet`) und die Legende.

**Die Zahlen**

- `src/features/gym/muscleAnalytics.ts`: `toMuscleAnalytics(history)` (121) liefert je Gruppe Zustand, Veränderung und Verlauf; `muscleTrend(days, muscle)` (110) liefert einen Punkt je Trainingstag der Gruppe, die Zeile zeigt davon die letzten zwölf (`SPARKLINE_POINTS`, 89).
- `src/features/gym/Sparkline.tsx`: feste Skala von −12 % bis +12 %, 80 × 24 px, für Vorlesehilfen unsichtbar.
- Die Veränderung einer einzelnen Übung im Zeitraum gibt die Rechnung nicht nach aussen: `gymPerformanceOverSpan` (`src/core/gym/performance.ts`) bildet sie und reicht nur das Mittel der Gruppe weiter.
- Ein Arbeitsvolumen rechnet nirgends etwas. Texte für «Arbeitsvolumen», den Vermerk «nicht gewertet», «uneinheitlich» und die Überschrift «Erfasst» gibt es in `src/i18n/` nicht. Die Wortfolge «nicht gewertet» steht dort nur in einem Hinweis zum Körpergewicht (`de.ts:502`), der damit nichts zu tun hat.

**Der Körper**

- Der Viewer schreibt nur `data-azimuth` und `data-view` an sein Element (`src/features/body/BodyViewer.tsx`). Welchen Zustand er für welche Gruppe zeichnet, lässt sich von aussen nicht lesen.
- Seit Block 7B lässt er sich anhalten: Die Pause greift, wenn die Kamera zur Ruhe gekommen ist, erlaubt ein einzelnes angefordertes Bild und endet, bevor die Kamera wieder fährt. Unter der Legende entsteht so schon heute kein Bild.

**Tokens**

`--type-figure-l` (28 px), `--duration-sheet` (320 ms), `--layer-sheet` in `src/styles/tokens.css`.

**Prüfung**

`npm run test` muss mit Exit 0 enden; der Typecheck ist `tsc -b`. Die Browser-Suites laufen gegen `npm run build` und `npx vite preview --port 4173`, die drei 3D-Suites einzeln. Rot ist nur die Offline-Prüfung in `release-proof.mjs` (Aufräum-Block, D163).

## 6. Die Arbeit, in dieser Reihenfolge

### Schritt 0 – Ausgangsmessung

`tsc -b`, `npm run test`, `npm run build`, jede Browser-Suite, die 3D-Suites einzeln. Was vorher bestand, muss am Ende bestehen.

### Schritt 1 – Höhenstufen und Wegziehen

Die Sheet-Komponente lernt beides, ohne dass ein bestehendes Sheet sein Verhalten ändert, solange es das nicht verlangt.

- **Zwei Stufen** (Vertrag §9): Das Muskel-Sheet öffnet auf zwei Dritteln der Höhe und lässt sich auf 92 % ziehen.
- **Wegziehen:** Nach unten ziehen schliesst.
- **Scrollen und Ziehen vertragen sich,** wie man es von iOS kennt: Auf der unteren Stufe zieht ein Zug nach oben zuerst das Sheet hoch und scrollt erst dann den Inhalt; am Anfang des Inhalts zieht ein Zug nach unten das Sheet zurück und dann zu. Die Seite dahinter bewegt sich nie mit.
- **Ohne Finger bedienbar:** Der Greifer ist ein Bedienelement mit Namen, das die Stufe wechselt; das Kreuz und Escape bleiben.
- **Reduzierte Bewegung:** Das Sheet erscheint und wechselt die Stufe ohne Fahrt.
- **Ein Greifer steht nur dort, wo man ziehen kann.** Entscheide, ob alle Sheets das Wegziehen bekommen oder nur dieses, und begründ es. Sheets mit Textfeldern und Tastatur dürfen dadurch nicht unruhiger werden; `wp3-sheets.mjs` bleibt unverändert grün.
- Die Dauer ist `--duration-sheet`, die Kurve `--ease-standard`; neue Masse werden Tokens.

### Schritt 2 – Öffnen, Schliessen, Zurück

- **Öffnen:** Ein Tipp auf einen Muskel am Körper oder auf eine Zeile öffnet das Sheet dieser Gruppe.
- **Schliessen** (Vertrag §9): nach unten ziehen, das Kreuz, ein Tipp auf den Körper darüber, die Zurück-Geste des Browsers, Escape. Der Tipp auf den Körper darüber schliesst nur; er wählt keine andere Gruppe.
- **Die Zurück-Geste** schliesst das Sheet und verlässt den Screen nicht. Das widerspricht dem Satz in `route.ts`, dass Sheets nie in die Adresse kommen. Löse es, ohne dass die Adresse einen neuen Ort bekommt, und schreib den Kommentar dort so um, dass er wieder stimmt. Entscheide, ob das für alle Sheets gilt oder nur für dieses.
- **Übungsdetail:** Ein Tipp auf eine Übung im Sheet führt ins Übungsdetail. Zurück führt Schritt für Schritt: Übungsdetail, dann das Sheet derselben Gruppe, dann Muskelgruppen. Das gilt für die Taste und für die Geste.
- **Fokus:** Beim Schliessen geht er dorthin zurück, woher das Sheet kam: auf die Zeile der Gruppe.
- **Die Übungsliste auf dem Screen:** Die Übungen einer Gruppe stehen jetzt im Sheet. Entscheide, was unter den zehn Zeilen bleibt, und halt es klein.

### Schritt 3 – Der Körper über dem Sheet

- Beim Öffnen rückt die Kamera die Gruppe in das Fenster, das über dem Sheet frei bleibt (auf einem iPhone rund 190 px), und bleibt dann stehen (D161).
- **Nach einem Tipp auf den Körper ändert sich der Drehwinkel nicht:** Die Gruppe ist schon zugewandt, die Kamera rückt sie nur ins Fenster. Aus der Liste geöffnet dreht der Körper zuerst hin, wenn die Gruppe abgewandt ist. So gelten §8 («ein Tipp dreht nie») und §9 zugleich.
- **Die Reihenfolge beim Öffnen:** Das Sheet fährt hoch, die Kamera fährt zur Gruppe, und sobald sie ruht, greift die Pause aus Block 7B. «Kein Bild» zählt ab diesem Moment.
- **Solange das Sheet offen ist, wird der Körper nicht neu gezeichnet** (D155). Ändert sich unter dem offenen Sheet, was er zeigen muss (der Zeitraum), forderst du genau ein Bild an, und er steht wieder.
- **Beim Schliessen** endet zuerst die Pause, dann fährt die Kamera in die Ansicht der Bühne zurück, und die Schleife läuft wieder nach Bedarf.
- Bei reduzierter Bewegung springt die Kamera.

### Schritt 4 – Der Inhalt

In dieser Reihenfolge (Vertrag §9, Mockup 2):

1. **Name** der Gruppe mit ihrem Muskelpunkt, daneben das Kreuz.
2. **Die Veränderung** in `--type-figure-l` mit Vorzeichen, daneben der Chip mit dem Zustand.
3. **«Bester Arbeitssatz · letzte 30 Tage»**, mit dem gewählten Zeitraum.
4. **Die Zeitraumwahl** 30 und 90 Tage. Es ist dieselbe wie auf dem Screen: Wer sie im Sheet ändert, ändert sie überall.
5. **Das Diagramm** (Vertrag §6): eine Linie in `--data-ink`, 1,5 px, runde Enden, kein Verlauf darunter; die Nulllinie fein und immer sichtbar; links zwei Beschriftungen («0 %» und «+12 %» oder «−12 %»); unten das erste und das letzte Datum; am Endpunkt ein Punkt mit 3 px Radius in der Statusfarbe (bei «Gehalten» in `--data-ink`) und der Wert. Die Skala ist dieselbe wie in den Zeilen; was über 12 % hinausgeht, bleibt am Rand stehen. Ein einzelner Messwert ist ein Punkt. Das Diagramm trägt eine Beschreibung für Vorlesehilfen.
6. **Die Übungen der Gruppe**, jede mit ihrem besten Arbeitssatz im Zeitraum («8 × 82,5 kg», in der gewählten Einheit) und ihrer Veränderung.
7. **Arbeitsvolumen pro Woche**, mit dem Vermerk «nicht gewertet», als Balken.

Dazu:

- **Über der Falz** stehen auf der unteren Stufe Name, Veränderung, Zeitraum und Diagramm, bei 393 × 852 und bei 320 px Breite. Übungen und Volumen dürfen darunter beginnen.
- **Dieselbe Quelle.** Zahl und Zustand im Sheet kommen aus derselben Funktion wie die der Zeile und des Körpers. Das Sheet rechnet nichts selbst.
- **Die Veränderung einer Übung** im Sheet ist die der Übung im gewählten Zeitraum, also die, die in die Zahl der Gruppe eingeht, nicht der Vergleich mit dem vorigen Tag. Braucht es dafür eine reine Funktion unter `src/core/gym/`, die nach aussen gibt, was die Rechnung der Gruppe ohnehin bildet, ist das erlaubt. Kein Wert, der in ein Rating eingeht, ändert sich dadurch, und jede Golden-Datei bleibt, wie sie ist.
- **«uneinheitlich»** (Vertrag §7): Liegen die Veränderungen der Übungen einer Gruppe mehr als zehn Prozentpunkte auseinander, steht im Sheet das Wort «uneinheitlich», und die Übungen sind einzeln sichtbar. Die Regel wohnt in `muscleState.ts`, mit Tests an der Kante (genau zehn Punkte, eine einzige Übung).
- **Zu wenig Vergleichsdaten:** kein Diagramm. Ein Satz sagt, wie viele Übungstage es im Zeitraum gibt und ab wann ein Trend erscheint. Darunter steht unter «Erfasst», was erfasst ist: Übung, Tag, bester Arbeitssatz. Das Volumen folgt.
- **Noch nicht trainiert:** ein Satz, was fehlt, mit dem Datum der letzten Session der Gruppe, wenn es eine vor dem Zeitraum gibt, und die eine Aktion «Training erfassen» (Vertrag §11).
- **Zahlen und Text:** feste Ziffernbreiten, die Einheit kleiner und in der zweiten Textstufe, das Minuszeichen und der geschützte Abstand vor dem Prozentzeichen aus `i18n/typography.ts`. Deutsch und Englisch nach Vertrag §13.
- **Welt:** Das Sheet ist dunkel, weil es von einem Gym-Screen kommt. Es darf Glas sein: Der Körper darunter steht still.

### Schritt 5 – Das Arbeitsvolumen

- **Was es ist** (D152): die Summe aus Wiederholungen × Last über die Arbeitssätze, je Muskelgruppe und Woche. Aufwärmsätze zählen nicht. Die Last ist die effektive Last, wie die Kennzahl sie liest. Die Woche beginnt am Montag wie überall in der App.
- **Wie viel einer Gruppe zusteht:** Eine Übung trifft mehrere Gruppen. Nimm dafür die Anteile, mit denen die Wertung eine Übung auf ihre Gruppen verteilt (`core/gym/muscles.ts`), damit eine Verbundübung nicht für jede Gruppe voll zählt. Nenn die Regel am STOP; hältst du eine andere für besser, begründ sie dort.
- **Eine reine, getestete Funktion.** Sie darf unter `src/core/gym/` stehen. Nichts unter `src/core/scoring/`, kein Rating-Dienst und `muscleState.ts` lesen sie; ein Test über die Quelltexte hält das fest, wie `foodRetirement.test.ts` es für Food tut.
- **Die Balken** (Vertrag §6, D163): neutral in `--data-ink` mit 55 % Deckkraft, ab null, die Wochen des gewählten Zeitraums, jede mit Kalenderwoche und Wert in der gewählten Einheit. Kein Balken trägt eine Statusfarbe, auch der letzte nicht: Nach D152 geht das Volumen in keine Farbe ein. Das weicht bewusst vom Satz in §6 über den letzten Balken ab; nenn es am STOP. Bei 90 Tagen und 320 px passen dreizehn Wochen in die Breite; entscheide, welche Beschriftungen dann stehen bleiben.
- Eine Woche ohne Arbeitssatz der Gruppe ist eine Lücke, kein Balken der Höhe null mit einer Zahl darüber.
- Die Balken haben eine Entsprechung in Worten für Vorlesehilfen.

### Schritt 6 – Prüfungen

- **Dieselbe Zahl** (Vertrag §14), in einer Browser-Suite: Für ein Profil, das alle fünf Zustände enthält, stimmen für jede der zehn Gruppen überein: Zahl und Wort der Zeile, Zahl und Chip im Sheet, und der Zustand, den der Körper zeichnet. Dafür gibt der Viewer seinen Zustand je Gruppe nach aussen, unsichtbar und aus denselben Werten, die er zeichnet.
- **Kein Diagramm ohne Messwert:** Die Zustände «zu wenig Vergleichsdaten» und «noch nicht trainiert» haben keines.
- **Unter dem offenen Muskel-Sheet entsteht kein Bild** (`gym-muscles.mjs`), gezählt ab dem Moment, in dem die Kamera ruht; ein Wechsel des Zeitraums erzeugt genau eines.
- **Jeder Weg zurück** schliesst das Sheet und lässt den Screen stehen; aus dem Übungsdetail führt Zurück ins Sheet.
- **Die Höhenstufen** und das Wegziehen mit Zeigergesten; die Falz bei 393 und 320 px.
- `design-system.mjs` nimmt das Sheet in beiden Stufen und in den Zuständen aus Schritt 4 auf: jeder Text bei 4,5:1 an den gerenderten Pixeln, keiner unter 11 px, nichts scrollt seitwärts.
- Unit-Tests für das Volumen, für «uneinheitlich» und für die Veränderung einer Übung im Zeitraum.

### Schritt 7 – Durchsicht

Screenshots unter `docs/design/wp3/stage7c/` bei 320, 360, 393 und 430 px: das Sheet einer Gruppe mit Messwerten auf beiden Stufen, «uneinheitlich», zu wenig Vergleichsdaten, noch nicht trainiert, 90 Tage, einmal auf Englisch. Sieh dir jeden an und vergleich ihn mit Mockup 2. Führ eine Liste: behoben, oder bewusst anders mit Grund.

### Schritt 8 – Schlussprüfung und Vorschau

1. `tsc -b`, `npm run test` (Exit-Code), `npm run build`, alle Browser-Suites, die 3D-Suites einzeln. Vergleich mit Schritt 0.
2. `git diff <Commit vor diesem Block> -- .github/fixtures` ist leer, und die Fingerabdrücke in `domainOutputs.test.ts` sind unverändert.
3. `HANDOVER.md` (ein Stage-Block), `CLAUDE.md` (die Regeln zu Sheets, zum Arbeitsvolumen und zum Körper unter einem Sheet), `docs/decisions.md` (ein neuer Eintrag für das, was du entschieden hast), `scripts/verify/README.md`.
4. Veröffentlich den Build in `Momentum-preview` nach dessen `README.md`; die Statusleiste bleibt `default`. Warte auf den Workflow und öffne die Seite, soweit deine Netzwerkregeln es zulassen.

## 7. Was sich nicht ändern darf, und was nicht hierher gehört

**Unverändert bleiben:**

- alles, was wertet oder speichert: jedes Rating, der Boss, `src/core/scoring/`, `src/storage/`, das Datenschema, das Backup-Format, jede Golden-Datei und jeder Fingerabdruck;
- `muscleState.ts`: welcher Zustand aus welcher Zahl folgt (dazu kommt nur «uneinheitlich»);
- die Körperbühne, die Bedienung des Körpers, das Modell;
- das Verhalten der bestehenden Sheets beim Tippen und mit Tastatur;
- der Weg für Vorlesehilfen: Er führt über die Zeilen, und das Sheet ist von dort ohne den Körper erreichbar.

Kein Test wird gelöscht oder abgeschwächt. Im STOP-Bericht steht jede umgeschriebene Prüfung mit alter und neuer Regel.

**Eigene Blöcke, nicht dieser:**

- WebKit-Lauf, VoiceOver auf dem Gerät, die Freigabe (9);
- die Offline-Prüfung, die veralteten Dokumente, «Pläne verwalten» aus dem leeren Muskelgruppen-Screen (Aufräumen).

## 8. Abnahmekriterien

- Ein Tipp auf einen Muskel oder eine Zeile öffnet das Sheet auf zwei Dritteln; es lässt sich auf 92 % ziehen und nach unten schliessen.
- Jeder der fünf Wege zurück schliesst das Sheet und verlässt den Screen nicht.
- Körper, Zeile und Sheet zeigen für jede Gruppe dieselbe Zahl und denselben Zustand; die Prüfung dafür besteht.
- Es gibt kein Diagramm ohne Messwert.
- Das Arbeitsvolumen steht mit «nicht gewertet» im Sheet, und der Quelltext-Test belegt, dass nichts Wertendes es liest.
- Unter dem offenen Sheet entsteht kein Bild.
- Über der Falz stehen Name, Veränderung, Zeitraum und Diagramm bei 393 und 320 px.
- `wp3-sheets.mjs` ist unverändert grün; `tsc -b` ist sauber, `npm run test` endet mit Exit 0, der Build läuft, jede Suite aus Schritt 0 besteht.
- Der Vorschau-Build ist erreichbar.

## 9. STOP 7C

Schreib Dario einen Bericht auf Deutsch, den er auf dem Telefon lesen kann:

1. In drei Sätzen: was sich geändert hat.
2. Fünf Bilder: das Sheet mit Messwerten auf beiden Stufen, «uneinheitlich», zu wenig Vergleichsdaten, noch nicht trainiert; daneben Mockup 2.
3. Die Zahlen: Tests, Suites gegen die Ausgangsmessung, der tiefste Kontrast im Sheet.
4. Eigene kleine Entscheidungen und Abweichungen vom Vertrag, jede mit Grund; darunter die Regel für das Volumen je Gruppe, das Wegziehen bei den anderen Sheets und was unter den Zeilen geblieben ist.
5. Jede umgeschriebene Prüfung mit alter und neuer Regel.
6. Was du gesehen und für Block 9 oder das Aufräumen liegen gelassen hast.
7. Die Adresse der Vorschau und die Prüfliste fürs iPhone.
8. Höchstens fünf Fragen, jede mit Optionen und deiner Empfehlung.
9. Der Stand in git für beide Repos.

**Prüfliste fürs iPhone** (übernimm sie und pass sie an; höchstens zehn Punkte):

1. Auf einen Muskel am Körper tippen: Das Sheet fährt auf etwa zwei Drittel hoch. Der Körper darüber zeigt die Gruppe, hat sich nicht weggedreht und steht still.
2. In der Liste eine Gruppe der Rückseite antippen: Der Körper dreht zu ihr, dann steht das Sheet.
3. Drei Gruppen mit verschiedener Datenlage öffnen: eine mit Messwerten, eine mit zu wenig Vergleichsdaten, eine nicht trainierte. Verstehst du jede Zahl ohne Erklärung?
4. Zahl und Wort im Sheet sind dieselben wie in der Zeile, und die Farbe am Körper passt dazu.
5. Das Diagramm hat eine Nulllinie, ein Anfangs- und ein Enddatum und den Wert am Endpunkt. Bei zu wenig Daten steht ein Satz, kein Diagramm.
6. Unter «Übungen» steht jede Übung mit ihrem besten Arbeitssatz und ihrer Veränderung. Wo zwei Übungen weit auseinanderliegen, steht «uneinheitlich».
7. «Arbeitsvolumen pro Woche» trägt den Vermerk «nicht gewertet». Stimmt die Zahl einer Woche, die du gut kennst, ungefähr?
8. Das Sheet nach oben ziehen (fast ganz gross), nach unten ziehen (zu), das Kreuz, ein Tipp auf den Körper, vom linken Rand zurückwischen: Jedes schliesst das Sheet, keines verlässt den Screen.
9. Eine Übung antippen: Du landest im Übungsdetail. Zurück führt wieder ins Sheet.
10. Im Sheet auf 90 Tage wechseln: Zahl, Diagramm und Körper passen wieder zusammen. Beim Scrollen im Sheet bewegt sich die Seite dahinter nicht.

Dann wartest du auf Darios Abnahme. Was er auf dem iPhone findet, behebst du in derselben Session und veröffentlichst die Vorschau neu. Der nächste Block startet in einer neuen Session mit `docs/wp3/prompts/prompt-9-haertung.md`.
