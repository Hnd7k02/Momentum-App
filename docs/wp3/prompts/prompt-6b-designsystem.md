# Prompt 6b – Variante B wird das Designsystem

Für eine frische Session mit Claude Fable 5.2. Die Session braucht zwei Repos: `Hnd7k02/Momentum-App` (Branch `claude/momentum-wp3`) und `Hnd7k02/Momentum-preview`.
Start: «Lies `docs/wp3/prompts/prompt-6b-designsystem.md` und führe ihn aus.»
Geschrieben am 11.11.2026, vor Block 0. Zeilennummern beziehen sich auf den Commit `7e2a5ce`; prüf sie, bevor du dich darauf verlässt.

## 1. Worum es geht

Momentum ist eine lokale Web-App fürs iPhone mit zwei Bereichen: Mind (hell) und Gym (dunkel). In Stage 6a wurden zwei Gestaltungsvarianten gebaut. Dario, der Eigentümer, hat Variante B gewählt. Im Produkt läuft aber bis heute Variante A: B liegt in einer temporären Datei und wird nur von einer Screenshot-Suite eingeschaltet. Auf einem iPhone war B noch nie zu sehen.

Dieser Block macht B zum einzigen System, wendet den Vertrag über Aussehen, Zustände und Wörter (`docs/wp3/vertrag.md`) auf alle bestehenden Screens an und sichert die Regeln mit Tests. Am Ende steht ein Vorschau-Build, den Dario auf seinem iPhone abnimmt.

Die wichtigste Eigenschaft dieses Blocks: **Er ändert, wie die App aussieht, und nichts daran, was sie tut.** Keine Zahl, die die App berechnet, darf sich bewegen. Darauf verlässt sich die Abnahme, und daran misst du jede Änderung.

## 2. Arbeitsweise in dieser Session

- **Modell.** Dieser Block ist für Claude Fable 5.2 geschrieben. Läufst du als anderes Modell, sag es in der ersten Zeile deiner ersten Antwort.
- **Subagenten.** Nur für reine Such- und Leseläufe über viele Dateien, und nur auf Sonnet. Jede Gestaltungsentscheidung und jede Änderung machst du selbst.
- **Branch.** Du committest und pushst auf `claude/momentum-wp3` im Repo `Momentum-App`. Dario erlaubt das ausdrücklich, auch wenn deiner Session ein anderer Arbeitsbranch zugeteilt wurde. Kein anderer Branch, kein Pull Request, kein Merge, kein Push auf den Default-Branch: Er veröffentlicht die Live-App bei jedem Push.
- **Eine Veröffentlichung.** Am Schluss, und nur dann, veröffentlichst du den Vorschau-Build im Repo `Momentum-preview` auf `main` (Abschnitt 6, Schritt 9). Auch das erlaubt Dario ausdrücklich. Die Vorschau hat eine eigene Adresse und einen eigenen Datenspeicher; die Live-App und Darios Daten berührt sie nicht.
- **Commits.** Kleine, benannte Commits im Stil der bestehenden Historie, englisch. Eine Golden-Datei oder ein Fingerabdruck wird in diesem Block nie neu eingefroren.
- **Sprache.** Chat und STOP-Bericht auf Deutsch in Schweizer Schreibweise. `docs/decisions.md`, `HANDOVER.md`, `CLAUDE.md`, Code-Kommentare und Commit-Nachrichten englisch wie bisher.
- **Zu Ende arbeiten.** Halte nicht an, solange du noch Teile schuldest. Hindernisse diagnostizierst und umgehst du. Angehalten wird am STOP 6b in Abschnitt 9, oder vorher, wenn die Voraussetzung in Abschnitt 3 fehlt.

## 3. Voraussetzung

Block 0 ist abgeschlossen und abgenommen:

- `docs/wp3/vertrag.md` existiert und trägt den Stand «freigegeben am …», oder Dario bestätigt die Freigabe in der Nachricht, mit der er diese Session startet.
- `docs/decisions.md` enthält Darios Entscheide ab D148.

Fehlt eines davon, bau nichts. Sag Dario, was fehlt, und halte an.

**Der Vertrag geht diesem Prompt vor.** Dieser Prompt wurde vor dem Vertrag geschrieben. Wo beide sich widersprechen, gilt der Vertrag; nenn den Widerspruch im STOP-Bericht. Wo der Vertrag zu einer Stelle schweigt, die du anfassen musst, entscheide im Sinn seines Leitbilds, halte die Entscheidung klein und führ sie im STOP-Bericht auf.

## 4. Was du zuerst liest

1. `docs/wp3/vertrag.md` ganz, mit den Mockups unter `docs/wp3/mockups/`. Sieh dir die Screenshots an.
2. `docs/decisions.md`: die Einträge ab D148, dazu D123 und D145 bis D147.
3. `HANDOVER.md`: den Block «WP3 Stage 6a».
4. `docs/wp3/review-2026-11.md`: Abschnitt C. Er beschreibt, was an den heutigen Screens stört, mit Messwerten.
5. `scripts/verify/README.md`: wie die Browser-Prüfung läuft.
6. Den Code aus Abschnitt 5.

## 5. Ausgangslage im Code

**Die Varianten**

- Variante A ist der Build: `src/styles/tokens.css` mit `:root` (Mind) und dem Gym-Block ab Zeile 331.
- Variante B ist `src/styles/stage6-variant-b.css` (132 Zeilen), eingebunden über `@import` in `src/styles/global.css:4`, wirksam nur unter `data-variant="b"` auf `<html>`. Dieses Attribut setzt einzig `scripts/verify/wp3-stage6a.mjs:94`.
- Der temporäre Selektor `:root:not([data-variant="b"]) [data-tile="gym"]` steht in `tokens.css:332` und `global.css:44`. Er macht die Gym-Kachel auf Heute unter A dunkel; unter B ist sie hell (`stage6-variant-b.css:120–128`).
- `src/styles/contrast.test.ts:95–107` baut vier Token-Sätze (Mind A, Gym A, Mind B, Gym B) und hält jeden gegen seinen Grund.
- B zeichnet die Kante der Karte als 1,5 px breiten Verlauf über `.card::before` (`stage6-variant-b.css:95–118`). `CLAUDE.md` beschreibt Glas noch mit einer feinen hellen Linie.

**Farbe**

- Mint kennzeichnet heute Gym: rund 40 Verwendungen von `--mint-*`, `--domain-gym-*` und `--domain-sports-*` in 16 Dateien, am dichtesten in `areas.css`, `gym.css`, `today.css`, `runningWorkout.css` und `gymHub.css`. Unter B setzt `stage6-variant-b.css:28` zusätzlich `--mint-ink: #0a6e55` für das Label «Gym» auf Heute.
- Die zehn Muskelfarben stehen als Hex-Werte in `src/features/body/tokens.ts:36` und färben in `src/features/gym/MuscleRows.tsx:65–109` das Quadrat vor dem Namen, den Auswahlring und die Verlaufslinie.
- Dunkle Flächen ausserhalb der Tokens: `src/features/today/bossSummary.css:16` und `src/features/ranking/rank.css:38`. Dazu `ui.css:340` (`#fff`), drei Werte in `onboarding.css` und 65 im Rang-Abzeichen (`RankBadge.tsx`), das als Grafik festgelegt ist.
- Die Statusfarben haben eine Definition in `tokens.css`; `statusPalette.test.ts` sucht nach Kopien. `statusPalette.ts` liest für TypeScript und WebGL den hellen Satz.

**Schrift**

- `--text-tertiary` ist auf Hell `#a0a0a8` (`tokens.css:54`) und misst dort 2,4 bis 2,6:1. `contrast.test.ts` prüft diesen Token nicht, und die Suite `wp3-stage6a.mjs` meldet kleine Beschriftungen nur, statt sie zu halten.
- Schriftgrössen ausserhalb der Tokens: `appShell.css:52` (Tab-Leiste, 10 px), `muscleModule.css:151` (10 px), `rank.css:63` und `:295`, `metrics.css:133` und `:236`, `onboarding.css:79` und `:150`.
- Es gibt keine Tokens für Zahlstufen, Zeilenhöhe, Ebenen (z-index steht als Zahl in sieben Regeln) und nur zwei Dauern und eine Kurve für Bewegung.

**Diagramme und Bausteine**

- `src/features/gym/Sparkline.tsx`: 80 × 24, Linie 1,6 px, jede Zeile auf ihr eigenes Minimum und Maximum skaliert, Farbe als Prop.
- `src/features/progress/TrendCurve.tsx`: Linie 2,5 px mit Flächenverlauf, ohne Achsen.
- `src/features/gym/ExerciseDetail.tsx`: Balken ohne Achse und ohne Werte. Die Überschrift `gym.detail.sets` («Sätze an diesem Tag», `src/i18n/de.ts:525`) steht über einer Liste von Tagen.
- Sheet: `src/components/index.tsx` und `ui.css:507–541`, höchstens 88 % der Höhe, obere Ecken 26 px als Zahl.
- Der Session-Screen (`GymSessionScreen.tsx`, `gym.css`) hat vier Schaltflächenstile und einen rund doppelt so breiten Seitenrand wie die anderen Gym-Screens.

**Prüfung**

- `npm run test` muss mit Exit 0 enden; lies den Exit-Code, nicht die Zusammenfassung. Der Typecheck ist `tsc -b`. Stand am 11.11.2026: 106 Dateien, 1761 Tests, beide grün.
- 39 Skripte unter `scripts/verify/` und `tools/` starten Chromium über den festen Pfad `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`. Diesen Ordner gibt es in der Cloud-Umgebung nicht mehr. Vorhanden ist `/opt/pw-browsers/chromium`, ein Verweis auf den aktuellen Build. Installiere keinen Browser.
- Die Browser-Suites laufen gegen `npm run build` und `npx vite preview --port 4173`; einzelne, etwa `body.mjs`, gegen den Dev-Server, das README sagt welche. Die drei 3D-Suites `gym-muscles`, `body` und `body-reach` laufen einzeln, nie parallel zu anderen.
- `wp3-stage6a.mjs` nimmt `OUT`, `WIDTHS` und `VARIANTS` aus der Umgebung und kennt die Höhen für 393, 430 und 320, nicht für 360.
- `domainOutputs.test.ts` und `stage2Baseline.test.ts` vergleichen die Rechenergebnisse exakt mit den Dateien unter `.github/fixtures/`.

**Vorschau**

- `Momentum-preview` enthält nur Build-Ausgabe; ein Push auf `main` veröffentlicht sie über den Workflow «Publish preview». Sein `README.md` beschreibt das Vorgehen: Build mit `--base=/Momentum-preview/`, ohne `sw.js` und ohne Sourcemaps, die `index.html` der Vorschau bleibt ihre eigene, nur die zwei Asset-Adressen werden neu geschrieben.
- Diese `index.html` trägt `apple-mobile-web-app-status-bar-style: black-translucent`. Die App selbst trägt `default` mit `theme-color` (`index.html:14–17`), und `src/app/world.ts` schreibt die `theme-color` beim Weltwechsel um.

## 6. Die Arbeit, in dieser Reihenfolge

### Schritt 0 – Ausgangsmessung

Bevor du etwas an der Gestaltung änderst:

1. Mach den Chromium-Pfad an einer Stelle einstellbar (eine Konstante in `scripts/verify/lib.mjs`, lesbar aus der Umgebung, mit `/opt/pw-browsers/chromium` als Vorgabe) und lass alle Skripte sie benutzen. Startet das `playwright-core` des Repos nicht mit dem vorhandenen Chromium, nimm das vorinstallierte `playwright`. Das ist eine Reparatur des Prüfgeräts; keine Prüfung wird dabei geändert.
2. Lass `tsc -b`, `npm run test`, `npm run build` und jede Browser-Suite einmal laufen und halte das Ergebnis fest: Suite, bestanden von gesamt, was fehlschlägt und warum.

Was vor deiner Arbeit schon fehlschlägt, ist ein Befund für den STOP-Bericht und kein Auftrag, es in diesem Block zu beheben. Was vorher bestand, muss am Ende bestehen.

### Schritt 1 – B wird der Build

Überführ die Werte aus `stage6-variant-b.css` nach `tokens.css`, so wie Vertrag §2 sie festlegt. Entfern Variante A, den temporären Selektor an beiden Stellen, den `@import` und die Datei. Die Verlaufskante der Karte zieht in die Kartenregel in `ui.css` um. `contrast.test.ts` hält danach zwei Sätze statt vier, jeden mit denselben Zusagen wie bisher. Die Gym-Kachel auf Heute ist hell (Entscheid vom 28.10.).

Nach diesem Schritt sieht die App aus wie die B-Screenshots unter `docs/design/wp3/stage6a/`. Prüf das an zwei, drei Screens, bevor du weitergehst; so trennst du «B eingebaut» sauber von «Vertrag angewendet».

### Schritt 2 – Farbe nach Vertrag §2

- Mint verlässt Gym. Geh das Inventar im Vertrag Stelle für Stelle durch.
- Die Muskelfarbe bleibt als kleiner Punkt in der Zeile. Der Auswahlring und die Verlaufslinie verlieren sie; die Linie wird neutral und trägt die Statusfarbe am Endpunkt. Der Zustand dafür kommt wie bisher aus `muscleStateOf`.
- Die dunklen Flächen ausserhalb der Tokens werden Tokens oder stehen als Ausnahme im Vertrag.
- Die Statusfarben auf Graphit änderst du nur, wenn der Vertrag es als festgelegt führt. Dann gehören `statusPalette.ts`, die betroffene Regel in `contrast.test.ts` und der Absatz in `CLAUDE.md` dazu.

### Schritt 3 – Schrift, Zahlen, Dichte nach Vertrag §3 und §4

Neue Tokens für Zahlstufen, feste Ziffernbreiten überall, wo Zahlen untereinander oder nebeneinander stehen, die Einheit kleiner und gedämpft. `--text-tertiary` erreicht 4,5:1 in beiden Welten. Kein Text unter 11 px. Schriftgrössen nur noch über Tokens. Zeilenhöhe, Karteninnenabstand und Seitenrand nach Vertrag, auf allen Screens gleich.

### Schritt 4 – Bedienelemente nach Vertrag §5

Eine Rangfolge der Schaltflächen auf jedem Screen. Der Session-Screen ist der Prüfstein: eine primäre Aktion, «Entfernen» ruhig, der Seitenrand wie überall. Eingabefelder der Satzzeile, Segmente, Chips und die Tab-Leiste folgen denselben Tokens in beiden Welten.

### Schritt 5 – Diagramme nach Vertrag §6

Verlaufslinie, Trendkurve und die Balken im Übungsdetail bekommen die Regeln des Vertrags: Linienstärke, Nulllinie, beschrifteter Endwert, Skala. Die Überschrift über der Tagesliste im Übungsdetail sagt, was die Liste zeigt, in beiden Sprachen. Was ein Diagramm bei keinem und bei einem einzelnen Messwert zeichnet, bleibt, wie es ist: nichts und ein Punkt.

### Schritt 6 – Ebenen, Bewegung, Ladezustände nach Vertrag §10 und §11

Tokens für die Ebenen ersetzen die Zahlen. Dauern und Kurven nach Vertrag. Ein Screen, der lädt, hält sein Layout, wenn der Vertrag das so festlegt. Das Verhalten bei reduzierter Bewegung und reduzierter Transparenz bleibt erhalten.

### Schritt 7 – Regeln werden Tests, nach Vertrag §14

Mindestens diese Prüfungen existieren am Ende und schlagen an, wenn man die Regel bricht (probier es je einmal aus):

- kein Farbwert ausserhalb von `tokens.css`, mit den im Vertrag genannten Ausnahmen;
- keine Schriftgrösse ausserhalb der Tokens und keine unter 11 px;
- `--text-tertiary` hält 4,5:1 gegen Karte und Grund, in beiden Welten, in `contrast.test.ts`;
- die Browser-Suite hält auch kleine Beschriftungen bei 4,5:1 an den gerenderten Pixeln, statt sie nur zu melden;
- kein Screen ist breiter als sein Viewport bei 320, 360, 393 und 430 px.

Die Suite `wp3-stage6a.mjs` verliert die Dimension «Variante» und bekommt die vier Breiten. Benenn sie um, wenn der Name sonst lügt, und zieh die Verweise in `CLAUDE.md` und im `README.md` der Prüfskripte nach.

### Schritt 8 – Durchsicht aller Screens

Erzeug Screenshots jedes Screens in seiner Welt bei 320, 360, 393 und 430 px unter `docs/design/wp3/stage6b/`: Heute und Gestern, Heute mit Gym-Kachel und mit laufendem Workout, Verlauf, Fragedetail, Rang, Bereiche Mind und Gym, die Gym-Übersicht, Laufen, Muskelgruppen oben und bei den Zeilen, die Übungsliste, das Übungsdetail, die Session, die Planwahl und das Lauf-Sheet von Heute aus, ein Sheet von einem Gym-Screen aus, die Trainingspläne, die Pause, Einstellungen mit Backup, das Onboarding.

Sieh dir jeden Screenshot selbst an und vergleich ihn mit dem Vertrag und dem Bausteinblatt. Führ eine Liste: behoben, oder bewusst liegen gelassen mit Grund. Die bestehenden Bilder unter `docs/design/wp3/stage6a/` bleiben als Stand von vorher.

Prüf dabei drei Entscheide, die schon gebaut sein sollten, und sichere sie mit einer Prüfung, falls noch keine da ist: In Bereiche färbt der ganze Screen um. Die Planwahl und das Lauf-Sheet bleiben hell, wenn sie von Heute aus geöffnet werden. Die `theme-color` folgt der Welt.

### Schritt 9 – Schlussprüfung und Vorschau

1. `tsc -b`, `npm run test` (Exit-Code), `npm run build`, alle Browser-Suites, die 3D-Suites einzeln. Vergleich mit der Ausgangsmessung aus Schritt 0.
2. `git diff 7e2a5ce -- .github/fixtures` ist leer, und die Fingerabdrücke in `domainOutputs.test.ts` sind unverändert.
3. Trag den Stand in `HANDOVER.md` ein, im Stil der bestehenden Stage-Blöcke, und zieh die «Interface rules» in `CLAUDE.md` nach, wo sie nicht mehr stimmen (Glas, die Varianten, der Name der Suite). Neue Regeln aus dem Vertrag, die dauerhaft gelten, gehören dort in einem Satz hinein.
4. Veröffentlich den Build in `Momentum-preview` nach dem Vorgehen in dessen `README.md`, mit einer Abweichung: Die `index.html` der Vorschau trägt für diese Abnahme denselben Wert für die Statusleiste wie die App (`default`), denn genau diesen Entscheid prüft Dario auf dem Gerät. Halt im `README.md` der Vorschau fest, aus welchem Commit der Build stammt und dass der Wert für diese Abnahme umgestellt ist. Warte, bis der Workflow durchgelaufen ist, und öffne die Seite einmal selbst, soweit die Netzwerkregeln deiner Session es zulassen; wenn nicht, sag das im STOP-Bericht.

## 7. Was sich nicht ändern darf, und was nicht hierher gehört

**Unverändert bleiben:**

- alles, was rechnet oder speichert: `src/core/`, `src/storage/`, das Datenschema, das Backup-Format;
- jede Golden-Datei und jeder Fingerabdruck;
- das Verhalten jeder Bedienung: was ein Tipp tut, was gespeichert wird, welche Screens es gibt und wie man zu ihnen kommt;
- `muscleState.ts`: welcher Zustand aus welcher Zahl folgt;
- die Texte der Oberfläche, ausser wo Vertrag §13 ein Wort ändert;
- `body-preview.webp`, das GLB, Licht und Material des 3D-Körpers.

Kein Test wird gelöscht oder abgeschwächt, damit etwas grün wird. Prüft ein Test ein altes Aussehen (eine Farbe, die Variante, eine Höhe), wird er auf die neue Regel umgeschrieben und bleibt genauso streng. Im STOP-Bericht steht jede solche Stelle.

**Eigene Blöcke, nicht dieser:**

- die neuen Farbregeln des Muskelstatus (Toleranzband, drei Übungstage, 30 und 90 Tage, «Leistungstrend»): Sie ändern den Anzeigezustand, und der steht in einer Golden-Datei;
- die Kennzahl (5b);
- die Körperbühne, Zoom, Tippen und Drehen, die neutralen Hände (7A und 7B);
- das Muskel-Sheet, Höhenstufen und Wegziehen für Sheets (7C);
- das Aufräumen der Altdateien und der veralteten Dokumente.

Fällt dir unterwegs etwas auf, das in einen dieser Blöcke gehört, schreib es in den STOP-Bericht und lass es stehen.

## 8. Abnahmekriterien

- Es gibt nur noch ein System: keine Variante, kein `data-variant`, keine temporäre Datei.
- `tsc -b` ist sauber, `npm run test` endet mit Exit 0, der Build läuft.
- Jede Browser-Suite, die in Schritt 0 bestand, besteht.
- Unter `.github/fixtures/` hat sich nichts geändert.
- Die fünf Prüfungen aus Schritt 7 existieren und schlagen nachweislich an.
- Jeder Screen liegt in vier Breiten als Screenshot vor, und du hast jeden angesehen.
- Mint kommt in der Gym-Welt nicht mehr vor; die Muskelfarbe erscheint nur als Punkt.
- Der kleinste Text misst an den gerenderten Pixeln mindestens 4,5:1; nenn den tiefsten gemessenen Wert je Welt.
- Der Vorschau-Build ist erreichbar und zeigt das neue System.

## 9. STOP 6b

Schreib Dario einen Bericht auf Deutsch, den er auf dem Telefon lesen kann:

1. In drei Sätzen: was sich geändert hat.
2. Fünf Vorher-nachher-Paare als Bilder: Muskelgruppen, Session, Übungsdetail, Gym-Übersicht, Heute.
3. Die Zahlen: Tests, Suites gegen die Ausgangsmessung, der tiefste Kontrast je Welt, die Grösse des Builds gegen vorher.
4. Abweichungen vom Vertrag und eigene kleine Entscheidungen, jede mit Grund.
5. Jeder Test, den du umgeschrieben hast, mit alter und neuer Regel.
6. Was du gesehen und für spätere Blöcke liegen gelassen hast.
7. Die Adresse der Vorschau und eine Checkliste für das iPhone mit höchstens zehn Punkten. Darauf gehören: beide Welten und der Wechsel in Bereiche; die Statusleiste einmal in Safari als Tab und einmal als App vom Home-Bildschirm, in beiden Welten; die Lesbarkeit der kleinsten Schrift; Glas über dem Farbschleier; die Satzzeile mit Tastatur; die Tab-Leiste über dem unteren Rand.
8. Höchstens fünf Fragen, jede mit Optionen und deiner Empfehlung.
9. Der Stand in git für beide Repos.

Dann wartest du auf Darios Abnahme. Was er auf dem iPhone findet, behebst du in derselben Session und veröffentlichst die Vorschau neu. Der nächste Block startet in einer neuen Session mit seinem eigenen Prompt.
