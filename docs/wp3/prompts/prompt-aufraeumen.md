# Prompt Aufräumen – Altdateien, Lizenz, Dokumente und zwei offene Punkte

Für eine frische Session mit dem Modell, das D159 festlegt. Die Session braucht zwei Repos: `Hnd7k02/Momentum-App` (Branch `claude/momentum-wp3`) und `Hnd7k02/Momentum-preview`.
Start: «Lies `docs/wp3/prompts/prompt-aufraeumen.md` und führe ihn aus.»
Geschrieben am 11.11.2026, vor allen Blöcken nach 6b. Zeilennummern beziehen sich auf den Commit `af89fd9`; sechs Blöcke liegen dazwischen. Nimm die Zeilen als Wegweiser, und lies zuerst `HANDOVER.md`.

## 1. Worum es geht

Momentum ist eine lokale Web-App fürs iPhone, und ihr Repo ist öffentlich. Im aktuellen Stand liegen Dinge, die dort nicht hingehören: ein altes Build-Paket, eine zweite Kopie eines Backups, drei iPad-Screenshots mit Browser-Tabs und einem Chat-Ausschnitt. Eine Lizenzdatei für die App fehlt. Mehrere Dokumente beschreiben einen Stand von vor Monaten. Dario, der Eigentümer, hat mit D157 entschieden, was damit geschieht.

Dazu kommen zwei kleine Punkte, die Dario diesem Block zugewiesen hat (D163):

- «Pläne verwalten», geöffnet aus dem leeren Muskelgruppen-Screen, führt in die Gym-Übersicht, aber nicht zu den Plänen.
- Die Prüfung «offline, Gym zeigt den 3D-Körper» in `release-proof.mjs` ist seit vor Stage 6b rot. Der Verdacht: Der Testserver antwortet anders als GitHub Pages.

Die wichtigsten Eigenschaften dieses Blocks: **Er entfernt und berichtigt. Die Git-Historie wird nicht umgeschrieben. Nichts, was die App rechnet oder speichert, ändert sich**, und am Verhalten ändert sich nur der Weg von «Pläne verwalten».

Dies ist der letzte Block von WP3.

## 2. Arbeitsweise in dieser Session

- **Modell.** Dieser Block ist für das Modell geschrieben, das D159 nennt. Läufst du als anderes Modell, sag es in der ersten Zeile deiner ersten Antwort.
- **Subagenten.** Nur für reine Such- und Leseläufe über viele Dateien, und nur auf Sonnet. Jede Bewertung, jede Löschung und jede Formulierung machst du selbst.
- **Branch.** Du committest und pushst auf `claude/momentum-wp3` im Repo `Momentum-App`. Dario erlaubt das ausdrücklich, auch wenn deiner Session ein anderer Arbeitsbranch zugeteilt wurde. Kein anderer Branch, kein Pull Request, kein Merge, kein Push auf den Default-Branch: Er veröffentlicht die Live-App bei jedem Push. **Ist `claude/momentum-wp3` inzwischen in den Default-Branch gemergt, sag es Dario in deiner ersten Antwort, frag, auf welchem Branch du arbeiten sollst, und pushe bis zur Antwort nichts.**
- **Keine Historie umschreiben.** Kein Force-Push, kein Filtern alter Commits. Was du entfernst, verschwindet aus dem aktuellen Stand und bleibt in der Historie sichtbar; sag Dario das im Bericht in einem Satz.
- **Löschen nur, was auf der Liste steht.** Die Liste ist Abschnitt 6, Schritt 1. Alles andere, was dir überflüssig scheint, schlägst du vor und lässt es liegen.
- **Eine Veröffentlichung.** Am Schluss veröffentlichst du den Vorschau-Build im Repo `Momentum-preview` auf `main` (Abschnitt 6, Schritt 7). Auch das erlaubt Dario ausdrücklich.
- **Commits.** Kleine, benannte Commits im Stil der bestehenden Historie, englisch. Eine Golden-Datei oder ein Fingerabdruck wird in diesem Block nie neu eingefroren.
- **Keine persönlichen Angaben erfinden.** In keine Datei kommt ein Name, eine Adresse oder eine E-Mail, die Dario dir nicht für genau diese Stelle genannt hat.
- **Sprache.** Chat und STOP-Bericht auf Deutsch in Schweizer Schreibweise. `README.md`, `docs/decisions.md`, `HANDOVER.md`, `CLAUDE.md`, Code-Kommentare und Commit-Nachrichten englisch wie bisher.
- **Zu Ende arbeiten.** Halte nicht an, solange du noch Teile schuldest. Hindernisse diagnostizierst und umgehst du. Angehalten wird am STOP in Abschnitt 9.

## 3. Voraussetzung

- Block 9 ist am Release-Gate angekommen: `HANDOVER.md` beschreibt den Release-Kandidaten, und es gibt einen Befehl, der alle Suites laufen lässt.
- Aus Block 7A steht fest, welches Körpermodell ausgeliefert wird und unter welcher Lizenz.

Fehlt das, bau nichts. Sag Dario, was fehlt, und halte an.

**Zwei Fragen stellst du in deiner ersten Antwort, und arbeitest dann weiter:**

1. Welcher Name und welches Jahr sollen im Urhebervermerk der Lizenzdatei stehen?
2. Unter welcher Adresse läuft die Live-App heute, falls Block 9 das nicht schon festgehalten hat?

**Die Entscheide gehen diesem Prompt vor:** D157, D163 und jeder jüngere Eintrag in `docs/decisions.md`. Wo sie ihm widersprechen, gelten sie; nenn den Widerspruch im Bericht.

## 4. Was du zuerst liest

1. `docs/decisions.md`: D157 und D163, dazu der Entscheid aus Block 7A zum Körpermodell und jeder Eintrag nach D163.
2. `docs/wp3/review-2026-11.md`: Abschnitt B, «Widersprüche zwischen Dokumentation und Repo» (sechs Punkte) und «Befunde zu Privatsphäre und öffentlichem Repo»; die Zeile F11 in Abschnitt F.
3. `HANDOVER.md` ganz, besonders «Repository state», den Block «WP3 — the November review and the owner's decisions» («Recorded by the review, corrected in the tidy-up block»), «Known, not from this stage» im Block zu Stage 6b, und «Verification status».
4. `README.md`, `THIRD-PARTY-NOTICES.md`, `docs/release-candidates.md`, `docs/device-tests.md`, `scripts/verify/README.md`.
5. `scripts/verify/release-proof.mjs`, `src/sw/serviceWorker.js`, `vite.config.ts`.
6. Den Code aus Abschnitt 5.

## 5. Ausgangslage

**Was im aktuellen Stand liegt und gehen soll** (D157)

- `momentumpreview 2.zip` im Wurzelordner, 364 KB, ein altes Build-Paket.
- `.github/Claude I6 backup request`, 13 KB: eine zweite Kopie des RC2-Backups mit zerstörten Umlauten.
- `docs/design/muscle-map/qa/device/IMG_0648.png`, `IMG_0649.png`, `IMG_0650.png`: iPad-Screenshots eines Entwurfs, auf denen Darios Browser-Tabs und ein Chat-Ausschnitt zu sehen sind.

**Was bleibt:** `.github/fixtures/rc2-export.json`. Es ist bewusst öffentlich, und Tests brauchen es.

**Lizenz**

- Es gibt keine `LICENSE`-Datei. `package.json` trägt `"private": true` und kein Feld `license`.
- `THIRD-PARTY-NOTICES.md` (29 Zeilen) nennt ein fremdes Werk: das 3D-Modell von patmateee unter CC BY 4.0, mit der Liste der Änderungen. Block 7A hat das Modell möglicherweise ersetzt.
- Im Ordner `docs/design/muscle-map/momentum-muscle-map-handoff/` liegt eine eigene Kopie des alten GLB mit `ATTRIBUTION.txt` und `license.txt`, und viele QA-Bilder unter `docs/design/` zeigen das alte Modell.

**Dokumente, die einen alten Stand beschreiben**

- `README.md` (88 Zeilen): eine Tabelle von Stufen bis «Sports domain: weekly target tracking», die Aussage, `c3e8b7f` sei ein Kandidat, der nie auf einem echten Gerät lief, kein Wort zu Mind und Gym.
- `docs/release-candidates.md` und `docs/device-tests.md` beschrieben RC2; Block 9 hat sie für den neuen Kandidaten nachgezogen. Prüf das, statt es zu wiederholen.
- Die Adresse `dario02king.github.io` steht in `HANDOVER.md` (um Zeile 1210), `docs/device-tests.md`, `docs/release-candidates.md` und `docs/design/muscle-map/INTEGRATION-QA.md` (Zeilen 14 und 87). Das Repo liegt heute unter `Hnd7k02`.
- `HANDOVER.md`: Der Titel lautet «Handover — Momentum V1, released»; die Tabelle «Repository state» beschreibt ältere Branches; die Blöcke zu WP2-1 und WP2-2 (um die Zeilen 136 und 164) sagen «not merged», obwohl `e30becd` der Merge von WP2 ist; «Verification status» nannte die drei iPad-Screenshots als Beleg einer iPhone-Abnahme.
- `scripts/verify/README.md`: In der Tabelle fehlen mindestens `stage2-shots.mjs`, `stage4-shots.mjs` und `status-shots.mjs`.
- Drei Commits tragen eine private E-Mail-Adresse in den Autor-Daten. Das lässt sich ohne Umschreiben der Historie nicht ändern und bleibt.

**«Pläne verwalten»**

- Die Schaltfläche steht in der Planwahl: `src/features/gym/PlanChooserSheet.tsx:57–59` (`plans.chooser.manage`).
- `src/features/gym/useTrainingLauncher.tsx:126–129` schliesst das Sheet und ruft `onManagePlans` des Wirts.
- Drei Wirte: `src/features/areas/GymTerminal.tsx:47` und `63` übergeben `scrollToPlans` (Zeile 35; der Anker ist ein Ref in Zeile 31, angehängt in 104). `src/features/today/TodayScreen.tsx:156` geht mit `onGoToAreas('gym')` in die Gym-Übersicht, ohne zu den Plänen zu rollen. `src/features/gym/GymMusclesScreen.tsx:39` übergibt `onBack` und landet ebenfalls oben in der Gym-Übersicht; der Kommentar darüber sagt es.
- Einen Ort «Pläne» in der Adresse gibt es nicht (`src/app/route.ts`).

**Die Offline-Prüfung**

- `scripts/verify/release-proof.mjs:51–81`: Die Suite installiert den Service Worker online, wartet, schaltet das Netz ab und lädt neu. «Die Hülle lädt aus dem Worker» besteht. «offline, Gym still shows the 3D body and its rows» (Zeile 80) schlägt fehl.
- Was `HANDOVER.md` dazu festhält: Offline scheitert im Headless-Chromium der erste dynamische Import des Körper-Chunks, obwohl der Worker ihn vorhält und ein einfacher Abruf derselben Adresse 200 liefert. `vite preview` sendet `Vary: Origin`, GitHub Pages nicht. Wurde Muskelgruppen einmal online besucht, besteht derselbe Lauf.
- Die Suites laufen gegen `npx vite preview --port 4173`. Einen eigenen kleinen Server gibt es unter `scripts/verify/` nicht, und `vite.config.ts` setzt keine Kopfzeilen für die Vorschau.
- `src/sw/serviceWorker.js` sucht im Zwischenspeicher mit `ignoreSearch`, ohne weitere Optionen.

**Prüfung**

`npm run test` muss mit Exit 0 enden; der Typecheck ist `tsc -b`. Alle Suites startet der Befehl aus Block 9.

## 6. Die Arbeit, in dieser Reihenfolge

### Schritt 0 – Ausgangsmessung

`tsc -b`, `npm run test`, `npm run build`, alle Suites über den Befehl aus Block 9. Die Offline-Prüfung ist rot; alles andere muss grün sein. Was sonst rot ist, ist ein Befund für die erste Zeile deines Berichts.

### Schritt 1 – Die Altdateien aus D157

Entfern mit `git rm` genau diese fünf Dateien: `momentumpreview 2.zip`, `.github/Claude I6 backup request` und die drei Bilder unter `docs/design/muscle-map/qa/device/`. Such danach jede Stelle, die auf sie verweist, und berichtige sie: Wo ein Dokument die Bilder als Beleg einer iPhone-Abnahme nennt, steht künftig, was wirklich belegt ist (Darios Protokoll aus den Blöcken 7B und 9).

### Schritt 2 – Lizenz

- **`LICENSE`** im Wurzelordner: Alle Rechte vorbehalten, mit Darios Antwort auf deine erste Frage als Urhebervermerk. Bis die Antwort da ist, bereitest du die Datei vor und committest sie nicht.
- Die Datei sagt drei Dinge und nicht mehr: Die App (Code, Gestaltung, Texte) ist urheberrechtlich geschützt, alle Rechte vorbehalten. Das 3D-Modell hat seine eigene Lizenz; sie steht in `THIRD-PARTY-NOTICES.md`. Darios Zeichnungen sind ausgenommen, wie D157 es sagt. Du gibst keine Rechtsauskunft und formulierst keine eigenen Klauseln.
- `package.json` bekommt den passenden Eintrag im Feld `license`.
- **`THIRD-PARTY-NOTICES.md`** beschreibt, was ausgeliefert wird: das Modell aus Block 7A mit seiner Quelle und Lizenz. Solange im Repo Dateien liegen, die vom alten Modell abstammen (die Kopie im Übergabe-Ordner, Bilder davon), bleibt dessen Nennung als eigener Abschnitt stehen. Die Nennung in der App stimmt mit der Datei überein.

### Schritt 3 – Dokumente

Berichtige, was falsch ist; schreib nichts neu, was stimmt.

- **`README.md`** ist das Gesicht des öffentlichen Repos. Schreib es neu, englisch und kurz: was Momentum ist (Mind und Gym, lokal, ohne Konto), wie man es baut, testet und prüft, wo die Regeln (`CLAUDE.md`), der Stand (`HANDOVER.md`), die Entscheide und der Vertrag liegen, und die Lizenz. Keine Stufentabelle von damals, keine persönlichen Angaben.
- **Die sechs Widersprüche aus dem Review, Abschnitt B.** Geh sie einzeln durch. Führ im Bericht eine Tabelle: Widerspruch, heutiger Stand, was du getan hast. Manche haben die Blöcke davor schon aufgelöst; dann belegst du das mit der Stelle.
- **Die Adresse.** Überall, wo `dario02king.github.io` als geltende Adresse steht, steht künftig die, die Dario bestätigt hat. In Dokumenten, die Geschichte festhalten (`INTEGRATION-QA.md`), bleibt die alte Adresse stehen, mit dem Vermerk, dass sie damals galt.
- **`HANDOVER.md`:** Titel, «Repository state», die beiden «not merged» zu WP2, «Verification status», der Verweis auf den höchsten Entscheid. Den Aufbau und die Stage-Blöcke lässt du stehen; sie sind das Gedächtnis des Projekts.
- **`scripts/verify/README.md`:** Jede Suite im Ordner steht in der Tabelle, und kein Eintrag nennt eine Datei, die es nicht mehr gibt.
- **`CLAUDE.md`:** nur Tatsachen, die nicht mehr stimmen (Dateinamen, Zahlen, Verweise). Keine Regel ändert sich in diesem Block.
- **Die Kommentare zur neutralen Zone** (`muscleMeshMap.ts`, `tools/validate-body-glb.mjs`, die Übergabe-Datei `HANDOFF.txt`) sagen «Kopf, Hände, Füsse». Prüf, ob das seit Block 7A auch für das Modell stimmt, und berichtige die Stelle, die noch abweicht.

### Schritt 4 – «Pläne verwalten» führt zu den Plänen

- Wer in der Planwahl «Pläne verwalten» antippt, steht danach bei den Trainingsplänen in der Gym-Übersicht: aus dem leeren Muskelgruppen-Screen (der Befund aus D163) und von Heute aus. Beides hat dieselbe Ursache; behebe sie einmal.
- Zurück führt dorthin, woher man kam.
- Der Fokus steht danach bei den Plänen, damit auch Vorlesehilfen dort ankommen.
- Die Adresse bekommt keinen neuen Ort, ausser du begründest, warum es ohne nicht geht.
- Ein Komponententest und eine Prüfung in einer Browser-Suite halten beide Wege fest.

### Schritt 5 – Die Offline-Prüfung

1. **Ein Testserver, der wie GitHub Pages antwortet.** Ein kleines Skript unter `scripts/verify/` liefert den gebauten Ordner unter `/Momentum-App/` aus, ohne `Vary: Origin` (D163) und sonst so nah an GitHub Pages, wie du es belegen kannst. Lies dafür die Kopfzeilen einer echten Antwort, wenn deine Netzwerkregeln es zulassen (die Vorschau unter `hnd7k02.github.io` genügt); sonst nenn im Bericht, welche Kopfzeilen du angenommen hast.
2. **Lass `release-proof.mjs` dagegen laufen**, mehrmals.
3. **Wird die Prüfung grün,** lag es am Testserver. Dann änderst du an der App nichts, stellst den Befehl aus Block 9 für diese Suite (oder für alle, wenn nichts dagegen spricht) auf den neuen Server um und hältst in `scripts/verify/README.md` fest, warum `vite preview` hier täuschte.
4. **Bleibt sie rot,** ist es ein Fehler der App. Finde die Ursache im Service Worker oder im Laden des Chunks, behebe sie, und sichere sie mit einem Test. Das ist die eine Stelle, an der dieser Block Code unter `src/` ausserhalb von Schritt 4 ändern darf.
5. In beiden Fällen bleibt Darios Prüfung im Flugmodus nach dem Go-live (D163); sie steht in der Prüfliste.

### Schritt 6 – Was sonst noch herumliegt

Mach ein Inventar, ohne etwas zu entfernen: die grössten Dateien im aktuellen Stand, Suites und Skripte, die nur noch alte Stände belegen, Dokumente ohne Leser, Ordner mit Bildern vergangener Stufen. Leg Dario am STOP eine kurze Liste vor: Datei oder Ordner, Grösse, wozu sie da war, dein Vorschlag (lassen, ins Archiv, entfernen).

### Schritt 7 – Schlussprüfung und Vorschau

1. `tsc -b`, `npm run test` (Exit-Code), `npm run build`, alle Suites über den Befehl aus Block 9, lokal und auf GitHub. Es gibt keine bekannte rote Prüfung mehr, oder du sagst genau, warum doch.
2. `git diff <Commit vor diesem Block> -- .github/fixtures` ist leer. Unter `src/` hat sich nur geändert, was die Schritte 4 und 5 verlangen.
3. `git status` ist sauber; die fünf Dateien sind weg; `LICENSE` steht, sobald Dario den Namen genannt hat.
4. Trag den Stand in `HANDOVER.md` ein und halt in `docs/decisions.md` fest, was du entschieden hast.
5. Veröffentlich den Build in `Momentum-preview` nach dessen `README.md`, ohne `sw.js`; die Statusleiste bleibt `default`. Warte auf den Workflow und öffne die Seite, soweit deine Netzwerkregeln es zulassen.

## 7. Was sich nicht ändern darf, und was nicht hierher gehört

**Unverändert bleiben:**

- die Git-Historie;
- `.github/fixtures/` ganz, also auch `rc2-export.json`;
- alles, was rechnet oder speichert: `src/core/`, `src/storage/`, das Datenschema, das Backup-Format, jede Golden-Datei und jeder Fingerabdruck;
- das Aussehen und Verhalten der App, ausser dem Weg von «Pläne verwalten» und, falls Schritt 5 es verlangt, dem Service Worker;
- jede Regel in `CLAUDE.md` und im Vertrag;
- `deploy.yml` und der Default-Branch.

Kein Test wird gelöscht oder abgeschwächt. Gehört eine Suite zu einem Stand, den es nicht mehr gibt, schlägst du sie in Schritt 6 vor und lässt sie laufen.

**Nicht hierher gehört:**

- `bossService.ts:217` (D158): ein eigenes Gate nach WP3;
- das Backlog aus D163: kg oder lb pro Übung, die randlose Statusleiste;
- das Löschen des Repos `Momentum-preview`: Das ist Darios Schritt nach dem Go-live;
- der Merge.

## 8. Abnahmekriterien

- Die fünf Dateien aus D157 sind aus dem aktuellen Stand entfernt, und nichts verweist mehr auf sie.
- `LICENSE` liegt vor (committet, sobald Dario den Namen genannt hat), und `THIRD-PARTY-NOTICES.md` beschreibt, was ausgeliefert wird und was vom alten Modell noch im Repo liegt.
- `README.md` beschreibt die App von heute; die sechs Widersprüche aus dem Review sind aufgelöst oder begründet offen.
- «Pläne verwalten» führt aus dem leeren Muskelgruppen-Screen und von Heute zu den Plänen; Test und Suite halten es fest.
- Die Offline-Prüfung ist grün, mit einem Server, der wie GitHub Pages antwortet, oder der Fehler der App ist behoben und getestet.
- `tsc -b` ist sauber, `npm run test` endet mit Exit 0, der Build läuft, alle Suites bestehen lokal und auf GitHub.
- Der Vorschau-Build ist erreichbar.

## 9. STOP Aufräumen

Schreib Dario einen Bericht auf Deutsch, den er auf dem Telefon lesen kann:

1. In drei Sätzen: was entfernt, was berichtigt und was behoben ist.
2. Die Liste der entfernten Dateien, mit dem Satz, dass sie in der Historie sichtbar bleiben.
3. Die Lizenz: was in `LICENSE` steht und was in `THIRD-PARTY-NOTICES.md`.
4. Die Tabelle der sechs Widersprüche.
5. Die Offline-Prüfung: woran es lag, und was jetzt läuft.
6. Die Zahlen: Tests und Suites gegen die Ausgangsmessung.
7. Das Inventar aus Schritt 6 mit deinen Vorschlägen.
8. Die Adresse der Vorschau und die Prüfliste fürs iPhone.
9. Höchstens fünf Fragen, jede mit Optionen und deiner Empfehlung.
10. Der Stand in git für beide Repos, und was vom Plan für den Merge aus Block 9 jetzt als Nächstes kommt.

**Prüfliste fürs iPhone** (übernimm sie und pass sie an; höchstens zehn Punkte):

1. Muskelgruppen ohne Training im Zeitraum öffnen, «Training erfassen» antippen, dann «Pläne verwalten»: Du stehst bei den Trainingsplänen in der Gym-Übersicht.
2. Dasselbe von Heute aus: Planwahl öffnen, «Pläne verwalten» antippen.
3. Zurück führt beide Male dorthin, woher du kamst.
4. Bereiche → Einstellungen: Die Nennung des 3D-Modells stimmt.
5. Eine Stichprobe, dass sonst nichts anders ist: Heute, Muskelgruppen mit einem Sheet, ein Workout.
6. Auf GitHub im Browser: Die drei Altdateien sind im aktuellen Stand weg, die Lizenzdatei steht, und die Startseite des Repos beschreibt die App von heute.
7. Erst nach dem Go-live: Flugmodus einschalten und die Live-App öffnen. Heute erscheint, und in Muskelgruppen steht der Körper (D163).
8. Erst nach dem Go-live: das Repo der Vorschau löschen, wenn du es nicht mehr brauchst.

Dann wartest du auf Darios Abnahme. Was er findet, behebst du in derselben Session und veröffentlichst die Vorschau neu. Damit ist WP3 gebaut; offen bleiben der Merge nach dem Plan aus Block 9 und, als eigenes Gate danach, D158.
