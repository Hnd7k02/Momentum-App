# Prompt 9 – Härtung und Release-Gate

Für eine frische Session mit dem Modell, das D159 festlegt. Die Session braucht zwei Repos: `Hnd7k02/Momentum-App` (Branch `claude/momentum-wp3`) und `Hnd7k02/Momentum-preview`.
Start: «Lies `docs/wp3/prompts/prompt-9-haertung.md` und führe ihn aus.»
Geschrieben am 11.11.2026, vor allen Blöcken nach 6b. Zeilennummern beziehen sich auf den Commit `af89fd9`; fünf Blöcke liegen dazwischen. Nimm die Zeilen als Wegweiser, und lies zuerst `HANDOVER.md`.

## 1. Worum es geht

Momentum ist eine lokale Web-App fürs iPhone: keine Anmeldung, kein Server, alle Daten liegen auf dem Gerät. Dario, der Eigentümer, benutzt die Live-App täglich. Auf dem Branch `claude/momentum-wp3` liegt ganz WP3: ein Tag zurück, Mind und Gym ohne Food, das neue Designsystem, die neuen Farbregeln, die neue Kennzahl, der neue Körper mit Bühne und Muskel-Sheet. Nichts davon ist veröffentlicht.

Vier Dinge sind bis heute nie geschehen:

- Der Branch lief nie durch die automatische Prüfung auf GitHub; sie läuft nur auf dem Default-Branch.
- Die Browser-Prüfung kennt nur Chromium. Safari auf dem iPhone baut auf WebKit.
- Das Update von Darios Live-Daten auf diesen Stand wurde nie als Ganzes geprobt. Beim ersten Laden beginnen mehrere Wertungsabschnitte gleichzeitig.
- Es gibt keinen geprobten Rückweg.

Dieser Block macht den Branch freigabefähig und legt Dario am Schluss alles vor, was er für die Entscheidung braucht: das **Release-Gate**. Er baut aus dem Vertrag §12 auf dem Gerät und §14 als Ganzes.

Die wichtigste Eigenschaft dieses Blocks: **Er fügt nichts hinzu und ändert kein Verhalten. Er beweist, härtet und dokumentiert.** Und er veröffentlicht die Live-App nicht: Der Merge ist Darios Schritt.

## 2. Arbeitsweise in dieser Session

- **Modell.** Dieser Block ist für das Modell geschrieben, das D159 nennt. Läufst du als anderes Modell, sag es in der ersten Zeile deiner ersten Antwort.
- **Subagenten.** Nur für reine Such- und Leseläufe über viele Dateien, und nur auf Sonnet. Jede Bewertung und jede Änderung machst du selbst.
- **Branch.** Du committest und pushst auf `claude/momentum-wp3` im Repo `Momentum-App`. Dario erlaubt das ausdrücklich, auch wenn deiner Session ein anderer Arbeitsbranch zugeteilt wurde. Kein anderer Branch, kein Pull Request, kein Merge, kein Tag, kein Push auf den Default-Branch: Er veröffentlicht die Live-App bei jedem Push.
- **Eine Veröffentlichung.** Am Schluss veröffentlichst du den Release-Kandidaten im Repo `Momentum-preview` auf `main` (Abschnitt 6, Schritt 10), wie bisher ohne `sw.js`. Auch das erlaubt Dario ausdrücklich.
- **Commits.** Kleine, benannte Commits im Stil der bestehenden Historie, englisch. Eine bestehende Golden-Datei oder ein Fingerabdruck wird nie neu eingefroren; neue Dateien dürfen dazukommen.
- **Darios Backup ist privat.** Hängt er es an, liegt es nur ausserhalb der Repo-Ordner. Es wird nie committet, nie veröffentlicht und nie an einen Dienst geschickt. In Bericht und Repo stehen daraus nur Anzahlen und Zahlen der Wertung, keine Antworten und keine Fragetexte. Am Ende der Session löschst du die Datei.
- **Kein Test wird gelöscht oder abgeschwächt.** Findet eine neue Prüfung einen Fehler, behebst du den Fehler. Jede Stelle steht im Bericht.
- **Sprache.** Chat und STOP-Bericht auf Deutsch in Schweizer Schreibweise. `docs/decisions.md`, `HANDOVER.md`, `CLAUDE.md`, Code-Kommentare und Commit-Nachrichten englisch wie bisher.
- **Zu Ende arbeiten.** Halte nicht an, solange du noch Teile schuldest. Hindernisse diagnostizierst und umgehst du. Angehalten wird am Release-Gate in Abschnitt 9, oder vorher, wenn die Voraussetzung in Abschnitt 3 fehlt.

## 3. Voraussetzung

- Die Blöcke «Farbregeln», 5b, 7A, 7B und 7C sind abgenommen; `HANDOVER.md` nennt jeden als abgenommen.
- In `HANDOVER.md` stehen Darios Messwerte vom iPhone aus Block 7B.

Fehlt ein Block, bau nichts. Sag Dario, welcher fehlt, und halte an. Fehlen nur die Messwerte, arbeite weiter und führ sie am Gate als offen.

**Eine Frage stellst du in deiner ersten Antwort, und arbeitest dann weiter:** Unter welcher Adresse öffnet Dario die Live-App? Der Grund steht in Abschnitt 5 unter «Adresse und Datenspeicher».

**Der Vertrag und die Entscheide gehen diesem Prompt vor.** Wo sie ihm widersprechen, gelten sie; nenn den Widerspruch im Bericht.

## 4. Was du zuerst liest

1. `HANDOVER.md` ganz. Es ist das Dokument der Freigabe: «Repository state», jeder WP3-Block, «Invariants», «Risks and known debt», «Verification status», «Next work».
2. `docs/decisions.md`: ab D132, und jeden Eintrag nach D163.
3. `docs/wp3/vertrag.md`: §12 und §14, dazu §15.
4. `docs/wp3/review-2026-11.md`: Abschnitt B («Widersprüche», «Privatsphäre»), die Zeile F10 in Abschnitt F, die Zeile «9» und die Messgrössen in Abschnitt I.
5. `.github/workflows/deploy.yml`, `scripts/verify/README.md`, `scripts/verify/lib.mjs`.
6. `vite.config.ts` (der Service Worker entsteht beim Build), `src/sw/serviceWorker.js`, `src/app/serviceWorker.ts` und die Stelle in `src/app/App.tsx`, die den Update-Hinweis zeigt.
7. `docs/release-candidates.md` und `docs/device-tests.md`: Sie beschreiben RC2 und sind die Form, in der dieses Projekt Freigaben und Gerätetests festhält.
8. Das `README.md` im Repo `Momentum-preview`.

## 5. Ausgangslage

**Automatische Prüfung**

- Es gibt einen einzigen Workflow, `.github/workflows/deploy.yml` («Deploy to GitHub Pages»). Er läuft bei einem Push auf `claude/momentum-pwa-spec-j82dhm` (den Default-Branch) und auf `claude/gym-scoring-integration-9oeblv`, baut mit `npm ci`, `npm run typecheck`, `npm run test`, `npm run build` und veröffentlicht. Auf `claude/momentum-wp3` läuft nichts. Keine Browser-Suite läuft je auf GitHub.
- Unter `scripts/verify/` liegen 37 Suites und `lib.mjs`. Es gibt kein Skript, das alle startet. Die meisten laufen gegen `npm run build` und `npx vite preview --port 4173`, `body.mjs` gegen den Dev-Server; die drei 3D-Suites laufen einzeln.
- Alle Suites starten Chromium über `CHROMIUM` in `lib.mjs`. WebKit ist in der Cloud-Umgebung nicht vorhanden (`/opt/pw-browsers` enthält nur Chromium), und `scripts/verify/README.md` verbietet `npx playwright install`.
- Mehrere Suites lesen den Zugänglichkeitsbaum über eine Schnittstelle, die es nur in Chromium gibt. Für reduzierte Transparenz gibt es keine Suite.
- Eine Prüfung ist seit vor 6b rot: «offline, Gym still shows the 3D body» in `release-proof.mjs`. Sie gehört dem Aufräum-Block (D163). Hier bleibt sie rot und steht am Gate als bekannt.

**Update und Service Worker**

- Die Live-App steht auf dem Default-Branch am Commit `e30becd`, dem Stand von WP2. Sie kennt Food noch, kennt «gestern» nicht und rechnet die alte Kennzahl.
- Beim ersten Laden des neuen Stands ruft `loadConfiguration` (`src/storage/services/configurationService.ts`) die Aktivierungen nacheinander auf. Die Bestätigung von Beförderungen (D126) kennt der Live-Stand schon; neu für Darios Daten sind drei: das Ein-Tages-Fenster, Food aus, die neue Kennzahl. Jede ist für sich getestet; Block 5b hat einen Test für alle zusammen ergänzt.
- Der Service Worker entsteht beim Build (`vite.config.ts`), hält eine Liste aller Dateien samt Modell vor und übernimmt nicht von selbst: Ein neuer Stand wartet, die App zeigt einen Hinweis, und erst ein Tipp lädt neu.
- Die Vorschau wird ohne `sw.js` veröffentlicht. Offline und Update lassen sich dort nicht ausprobieren.

**Adresse und Datenspeicher**

- Die Dokumente nennen als Live-Adresse `https://dario02king.github.io/Momentum-App/` (`docs/device-tests.md`, `docs/release-candidates.md`, `HANDOVER.md`). Das Repo liegt heute unter `Hnd7k02`, und die Vorschau läuft unter `https://hnd7k02.github.io/Momentum-preview/`.
- Die Datenbank heisst immer `momentum` (`src/storage/db.ts:14`). Seiten unter derselben Herkunft teilen sich im selben Browser eine Datenbank. Liegt die Live-App inzwischen unter `hnd7k02.github.io`, dann teilen Live-App und Vorschau in Safari ihre Daten, und die Vorschau hätte dort bereits neue Wertungsabschnitte in Daten geschrieben, die auch die alte Live-App liest. Eine App vom Home-Bildschirm hat nach heutigem Wissen ihren eigenen Speicher; das gehört geprüft, nicht angenommen.

**Backup und Rückweg**

- Export und Import liegen in `src/features/backup/BackupSection.tsx` und `src/storage/services/backupService.ts`. Tests: `backup.test.ts`, `backupCompat.test.ts`, `backupPlans.test.ts`.
- `.github/fixtures/rc2-export.json` ist ein echter Export, aber nur ein Tag und ohne Sätze.
- Im Repo gibt es keinen Tag, obwohl `HANDOVER.md` einen nennt (`muscle-map-v1`).
- Nach dem ersten Laden trägt die Konfiguration die neuen Abschnitte. Der alte Stand würde sie übersehen und neue Tage alt bewerten. Zurück geht es sauber nur mit dem alten Stand und einem Backup von vor dem Update.

**Gerät**

- `HANDOVER.md` nennt unter «Verification status» drei Dateien als Beleg einer iPhone-Abnahme, die in Wahrheit iPad-Screenshots eines Entwurfs sind. Ein Protokoll mit Messwerten von einem iPhone gibt es erst seit Block 7B.
- VoiceOver wurde nie benutzt.

## 6. Die Arbeit, in dieser Reihenfolge

### Schritt 0 – Ausgangsmessung

`tsc -b`, `npm run test` (Exit-Code), `npm run build`, jede Suite, die 3D-Suites einzeln. Die Tabelle daraus ist die Grundlinie der Freigabe: Suite, bestanden von gesamt, Dauer.

### Schritt 1 – Ein Befehl für alles

Ein Skript startet die Server, lässt jede Suite in der richtigen Art laufen (die 3D-Suites einzeln, `body.mjs` gegen den Dev-Server), räumt auf und endet mit einem Exit-Code ungleich null, wenn etwas fehlschlägt. Es druckt die Tabelle aus Schritt 0. Die bekannte rote Prüfung bleibt rot und wird nicht ausgeblendet. Trag den Befehl in `package.json` und in `scripts/verify/README.md` ein.

### Schritt 2 – Prüfung auf GitHub

- Ein **eigener** Workflow läuft bei jedem Push auf `claude/momentum-wp3`: `npm ci`, `tsc -b`, `npm run test`, `npm run build`, dann die Suites über den Befehl aus Schritt 1. Er veröffentlicht nichts und hat keine Rechte dazu. `deploy.yml` fasst du nicht an.
- Auf GitHub darf der Workflow seinen Browser selbst installieren, passend zur Version von `playwright-core` im Repo; `CHROMIUM_PATH` zeigt die Suites dorthin. In deiner Session installierst du weiterhin keinen.
- Lehnt GitHub deinen Push ab, weil er eine Workflow-Datei enthält, nimm die Datei aus dem Commit, leg sie Dario im Bericht als Text vor und sag ihm, wo er sie einfügt. Dann gibt es bis dahin keinen Lauf auf GitHub und damit auch keinen in WebKit: Beides steht am Gate als offen, in der ersten Zeile, und `HANDOVER.md` hält es für den Aufräum-Block fest.
- Warte auf den ersten Lauf und lies sein Ergebnis. Was dort fehlschlägt und bei dir nicht, klärst du: Zeitabhängigkeit, fehlende Grafik, ein echter Fehler. Die 3D-Suites zählen Bilder; laufen sie dort nicht stabil, bekommen sie einen eigenen Schritt, und du sagst es, statt eine Grenze zu lockern.

### Schritt 3 – WebKit

- `lib.mjs` lernt, einen anderen Browser zu starten. Auf GitHub läuft eine Auswahl der Suites zusätzlich in WebKit: mindestens die Reise durch die ganze App (`release.mjs`), das Tippen in jedes Sheet (`wp3-sheets.mjs`), die Bereiche (`terminal.mjs`), das Designsystem bei 393 px und der Muskelgruppen-Screen mit Sheet.
- Suites, die an Chromium gebunden sind, bleiben dort. Führ eine Liste: welche Suite in WebKit läuft, welche nicht und warum.
- Hat WebKit auf GitHub kein WebGL, prüft der Lauf dort den flachen Ersatzkörper. Sag das, statt es als Prüfung des 3D-Körpers auszugeben.
- Jeden Unterschied, den WebKit zeigt, ordnest du ein: Fehler der App (beheben), Eigenheit der Prüfung (Prüfung anpassen, gleich streng), Eigenheit von WebKit unter Linux (benennen).
- Schreib in den Bericht, was dieser Lauf ist: eine Frühwarnung. Er ist nicht Safari auf dem iPhone und ersetzt Darios Prüfung nicht.

### Schritt 4 – Das Update, als Ganzes geprobt

Das ist der Teil mit dem grössten Risiko: Hier geht es um Darios echte Daten.

1. **Ein Profil, wie die Live-App es hinterlässt.** Bau den Live-Stand `e30becd` in einem getrennten Arbeitsverzeichnis ausserhalb der Repo-Ordner. Erzeug über seine eigene Oberfläche ein Profil mit mehreren Wochen: Antworten in Mind, Gym-Sessions mit mehreren Sätzen und einer Körpergewichtsübung, Läufe, ein Trainingsplan, Food eingeschaltet mit Bewertungen. Exportier sein Backup. Dieses erfundene Backup darf als neue Datei unter `.github/fixtures/` liegen.
2. **Das Update am Ort.** Derselbe Browser, dieselbe Datenbank, danach der neue Stand: Alle Aktivierungen laufen im ersten Laden, jede genau einmal. Nichts geht verloren: Zähl jede Sammlung vorher und nachher. Ein zweites Laden schreibt nichts.
3. **Die Vergangenheit bleibt.** Für jeden Tag vor dem Tag des Updates zeigt der neue Stand dieselben Werte, die der alte gezeigt hat: Tageswerte, Ratings, Boss. Belege es mit Zahlen aus beiden Ständen, nicht mit einem Blick.
4. **Der Tag des Updates und die Tage danach.** Was sich ab dann bewegt, steht in einer kurzen Tabelle mit Grund: Food fällt aus dem Boss, die Kennzahl wechselt, eine Woche wird erst am Dienstag gewertet, ein Tag zählt für eine Beförderung erst, wenn er abgeschlossen ist (D136).
5. **Über das Backup.** Dasselbe Backup, in eine frische Installation des neuen Stands importiert, ergibt denselben Zustand wie das Update am Ort.
6. **Der Service Worker.** Unter einer Adresse zuerst der alte Build, dann der neue: Der neue Stand wartet, der Hinweis erscheint, ein Tipp lädt genau einmal neu, und danach ist nichts vom alten Build mehr im Zwischenspeicher. Das wird eine Suite.
7. **Mit Darios Backup,** falls er es anhängt: die Punkte 5 und 3 mit seinen Daten, nach den Regeln aus Abschnitt 2.

Die Punkte 2 bis 5 werden Tests oder Suites, die bleiben. Neue Golden-Dateien für dieses Profil frierst du an drei Stichtagen ein: vor, am und nach dem Tag des Updates.

### Schritt 5 – Der Rückweg, geprobt

- **Was passiert, wenn der alte Stand auf Daten trifft, die der neue schon geladen hat?** Probier es aus und beschreib es: Öffnet er sie? Was zeigt er? Was schreibt er?
- **Der saubere Weg zurück:** Daten der App löschen, den alten Stand öffnen, das Backup von vor dem Update importieren. Belege, dass der Zustand danach derselbe ist wie vor dem Update: zweimal exportiert, zwei gleiche Dateien.
- **Der Stand im Repo, zu dem es zurückgeht,** ist der heutige Kopf des Default-Branchs. Schlag einen Namen für einen Tag darauf vor. Du setzt keinen Tag und fasst den Default-Branch nicht an; ob und wer den Tag setzt, entscheidet Dario am Gate.
- Schreib den Rückweg für Dario in drei Schritten auf, in Alltagssprache, und sag dazu, was dabei verloren geht: alles, was nach dem Backup erfasst wurde.

### Schritt 6 – Backup hin und zurück

Mit dem erfundenen Backup aus Schritt 4 und, falls angehängt, mit Darios eigenem: importieren, exportieren, wieder importieren. Die beiden Exporte sind gleich, und alle Ratings stimmen nach Löschen und Import mit vorher überein. Halt ausserdem fest, was der alte Stand mit einem Backup des neuen tut.

### Schritt 7 – Vertrag §14, als Ganzes

Erstell die Tabelle: jede Regel aus §14 und jede Regel, die ein späterer Block dazugeschrieben hat; die Prüfung, die sie durchsetzt; der Nachweis, dass die Prüfung anschlägt. Für den Nachweis brichst du jede Regel einmal absichtlich und siehst die Prüfung fehlschlagen, wie Stage 6b es für seine Regeln getan hat. Eine Regel ohne Prüfung bekommt eine. Die absichtlichen Brüche committest du nicht.

### Schritt 8 – Vertrag §12, was nur das Gerät zeigt

- Ergänz, was sich im Browser prüfen lässt und fehlt: reduzierte Transparenz auf jedem Screen mit Glas (alles bleibt lesbar bei 4,5:1), reduzierte Bewegung auf dem Muskelgruppen-Screen mit Sheet, das Vergrössern der Seite ist nirgends gesperrt, 44 px auf den neuen Screens, kein seitliches Überlaufen bei vier Breiten.
- Für den Weg mit Vorlesehilfen prüfst du den Zugänglichkeitsbaum der neuen Screens: Jede der zehn Zeilen sagt Gruppe, Zahl und Zustand; das Sheet hat einen Namen und gibt den Fokus zurück; das Diagramm trägt seine Beschreibung; der Körper ist für Vorlesehilfen kein Hindernis.
- Schreib `docs/device-tests.md` neu, für diesen Stand: die Prüfliste, die Dario auf dem iPhone abarbeitet, mit Platz für Gerät, iOS-Version, Datum und Ergebnis, und mit den Messwerten neben den Zielen aus dem Review, Abschnitt I. Was dort über RC2 steht, ist Geschichte und steht bereits in `docs/release-candidates.md`.

### Schritt 9 – Die Unterlagen der Freigabe

- **`docs/release-candidates.md`:** ein neuer Eintrag für diesen Kandidaten, in der Form der bestehenden: Commit, was er enthält, die Zahlen der Prüfung, was auf dem Gerät geprüft ist und was nicht, bekannte Grenzen, der Rückweg.
- **`HANDOVER.md`:** «Repository state», «Verification status» mit den echten Zahlen und Darios Messwerten (die iPad-Screenshots sind kein Beleg; streich die Behauptung), «Next work», und was unter «Risks and known debt» erledigt oder neu ist.
- **Für Dario, auf Deutsch:** was sich am Tag des Updates für ihn ändert, in höchstens zehn Zeilen. Food verschwindet aus der Oberfläche und seine Daten bleiben; Heute und Gestern; das neue Aussehen; die neue Kennzahl gilt ab diesem Tag und bewegt das Gym-Rating in den ersten Wochen um die Zahl aus Block 5b; eine Woche wird erst gewertet, wenn sie vorbei ist. Und was er davor tut: ein Backup exportieren.
- **Der Plan für den Merge:** was ein Merge in den Default-Branch auslöst, in welcher Reihenfolge mit dem Aufräum-Block, und was danach zu prüfen ist. Du führst ihn nicht aus.

### Schritt 10 – Schlussprüfung und Vorschau

1. Der Befehl aus Schritt 1: lokal in Chromium, auf GitHub in Chromium und in WebKit. Vergleich mit Schritt 0.
2. `git diff <Commit vor diesem Block> -- .github/fixtures` zeigt nur neue Dateien. Unter `src/` sind neue Tests dazugekommen; am übrigen Code haben sich nur Fehlerbehebungen geändert, und jede steht im Bericht.
3. Veröffentlich den Release-Kandidaten in `Momentum-preview` nach dessen `README.md`, ohne `sw.js`; die Statusleiste bleibt `default`. Warte auf den Workflow und öffne die Seite, soweit deine Netzwerkregeln es zulassen.

## 7. Was sich nicht ändern darf, und was nicht hierher gehört

**Unverändert bleiben:**

- jedes Verhalten und jedes Aussehen der App, ausser wo ein Fehler behoben wird, den dieser Block gefunden hat, und ausser der Messanzeige: Entscheidet Dario am Gate, dass sie nicht im Release bleibt, nimmst du sie in dieser Session heraus;
- jede bestehende Golden-Datei, jeder Fingerabdruck, jede Grenze in einem Test;
- `deploy.yml` und der Default-Branch;
- das Datenschema und das Backup-Format.

**Nicht ohne Darios Wort:**

- ein Merge, ein Tag, ein Pull Request;
- ein Service Worker auf der Vorschau. Er liesse sich später nicht einfach wieder entfernen: Ein einmal installierter Worker liefert seinen Stand weiter aus, auch wenn die Datei verschwindet. Will Dario Offline und Update vor dem Go-live auf dem Gerät proben, ist das eine Frage fürs Gate, mit diesem Haken;
- ein eigener Datenbankname für die Vorschau, falls Live-App und Vorschau eine Herkunft teilen. Das ist ein Vorschlag fürs Gate, kein stiller Schritt.

**Eigene Blöcke, nicht dieser:** die Offline-Prüfung in `release-proof.mjs`, die Altdateien im öffentlichen Repo, die Lizenzdatei, `README.md` und die übrigen veralteten Dokumente, «Pläne verwalten» aus dem leeren Muskelgruppen-Screen (alles Aufräumen); `bossService.ts:217` (D158, nach WP3).

## 8. Abnahmekriterien

- Ein Befehl lässt alle Suites laufen und endet mit einem ehrlichen Exit-Code.
- Auf GitHub läuft bei jedem Push auf den Branch die ganze Prüfung, ohne zu veröffentlichen; ein Lauf ist grün bis auf die eine bekannte Prüfung, oder die Workflow-Datei liegt Dario als Text vor.
- Die Auswahl der Suites läuft in WebKit, und die Liste sagt, was dort nicht läuft und warum.
- Das Update vom Live-Stand ist als Ganzes geprobt und als Test festgehalten: nichts verloren, die Vergangenheit unverändert, jede Aktivierung einmal.
- Der Rückweg ist geprobt und in drei Schritten beschrieben.
- Das Backup geht hin und zurück, ohne dass sich etwas ändert.
- Zu jeder Regel aus Vertrag §14 gibt es eine Prüfung, die nachweislich anschlägt.
- `docs/device-tests.md`, `docs/release-candidates.md` und `HANDOVER.md` beschreiben diesen Stand.
- Der Release-Kandidat liegt auf der Vorschau.

## 9. STOP 9 – das Release-Gate

Schreib Dario einen Bericht auf Deutsch, den er auf dem Telefon lesen kann:

1. Dein Urteil in drei Sätzen: freigabefähig oder nicht, und was dagegen spricht.
2. Die Tabelle der Prüfung: Typecheck, Tests, Build, Suites lokal, auf GitHub, in WebKit; daneben die Grundlinie.
3. Das Update: was beim ersten Laden geschieht, was erhalten bleibt, was sich ab dem Tag des Updates bewegt.
4. Der Rückweg in drei Schritten, und was er kostet.
5. Jeder Fehler, den dieser Block gefunden und behoben hat.
6. Was nur das Gerät zeigen kann und noch offen ist. Darios Messwerte aus Block 7B stehen neben den Zielen aus dem Review, Abschnitt I: Körper sichtbar nach 2,5 Sekunden beim ersten Laden und 1 Sekunde aus dem Speicher; beim Drehen mindestens 55 Bilder pro Sekunde und 95 % der Bilder unter 25 ms; im Leerlauf kein Bild; höchstens 12 Zeichenaufrufe, 80'000 Dreiecke, eine Textur von 1024 × 1024.
7. Bekannte Grenzen: die rote Offline-Prüfung, was WebKit unter Linux nicht belegt, die Frage der Adresse.
8. Was sich für ihn am Tag des Updates ändert (aus Schritt 9).
9. Die Adresse der Vorschau und die Prüfliste fürs iPhone.
10. Höchstens fünf Fragen, jede mit Optionen und deiner Empfehlung: Läuft der Aufräum-Block vor dem Merge (empfohlen, weil er Dateien aus dem öffentlichen Stand nimmt und die Lizenzdatei bringt)? Wer setzt den Tag für den Rückweg? Wer führt den Merge aus? Offline und Update vor dem Go-live auf dem Gerät proben? Bleibt die Messanzeige im Release, falls noch offen?
11. Der Stand in git für beide Repos.

**Prüfliste fürs iPhone** (übernimm sie und pass sie an; höchstens zehn Punkte):

1. In der Live-App ein Backup exportieren und sicher ablegen. Das ist der Rückweg.
2. Den Rückweg zur Hälfte proben, erst wenn Punkt 1 erledigt ist: In der Live-App dieses Backup gleich wieder importieren. Nichts ändert sich. Damit ist belegt, dass der alte Stand sein Backup liest.
3. Die Vorschau öffnen und das Backup importieren. Alles ist da: Antworten, Sessions, Läufe, Pläne. Food ist nirgends mehr zu sehen. Dort ein Backup exportieren und gleich wieder importieren: Nichts ändert sich.
4. Einen ganzen Tag durchspielen: Fragen beantworten, gestern etwas nachtragen, ein Workout mit einem Aufwärmsatz erfassen, «Fertig».
5. Muskelgruppen: der Körper, drei Sheets, und überall dieselbe Zahl in Zeile, Sheet und Farbe.
6. VoiceOver einschalten. Auf Heute eine Frage beantworten. In Muskelgruppen durch die Zeilen wischen: Jede sagt Gruppe, Zahl und Zustand. Ein Sheet öffnen und schliessen.
7. In den Bedienungshilfen «Bewegung reduzieren» und «Transparenz reduzieren» je einmal einschalten: Nichts fährt, Glas wird deckend, alles bleibt lesbar.
8. Die Messanzeige: Werte nach einem frischen Start und beim zweiten Öffnen kopieren und schicken.
9. Als App vom Home-Bildschirm: beide Welten, die Statusleiste, die Tastatur in der Satzzeile, die Tab-Leiste über dem Home-Balken.
10. Erst nach dem Go-live: Die Live-App zeigt den Hinweis auf den neuen Stand, ein Tipp lädt neu, deine Daten sind da. Dann einmal im Flugmodus öffnen: Heute und der Körper erscheinen (D163).

Dann wartest du. Trag Darios Ergebnisse in `docs/device-tests.md` und `HANDOVER.md` ein, mit Gerät, iOS-Version und Datum. Was er findet, behebst du in derselben Session und veröffentlichst die Vorschau neu.

**Der Merge ist Darios Schritt.** Beauftragt er dich in dieser Session ausdrücklich damit, gehst du nach dem Plan aus deinem Bericht vor; ohne diesen Auftrag mergst du nicht. Der letzte Block startet in einer neuen Session mit `docs/wp3/prompts/prompt-aufraeumen.md`.
