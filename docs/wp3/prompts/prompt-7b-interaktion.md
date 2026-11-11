# Prompt 7B – Die Körperbühne: Grösse, Bedienung, Bewegung, Treffen, Messanzeige

Für eine frische Session mit dem Modell, das D159 festlegt. Die Session braucht zwei Repos: `Hnd7k02/Momentum-App` (Branch `claude/momentum-wp3`) und `Hnd7k02/Momentum-preview`.
Start: «Lies `docs/wp3/prompts/prompt-7b-interaktion.md` und führe ihn aus.»
Geschrieben am 11.11.2026, vor den Blöcken «Farbregeln», 5b und 7A. Zeilennummern beziehen sich auf den Commit `af89fd9`; die Blöcke davor haben Dateien unter `src/features/gym/` und `src/features/body/` verändert. Prüf jede Zeile, bevor du dich darauf verlässt.

## 1. Worum es geht

Momentum ist eine lokale Web-App fürs iPhone. Im Gym-Bereich steht ein drehbarer 3D-Körper, der je Muskelgruppe zeigt, wie sich die Trainingsleistung verändert hat. Block 7A hat dem Körper Form, Licht und Material gegeben. Dieser Block gibt ihm seine Bühne und seine Bedienung.

Heute steht der Körper in einer Karte, auf 360 px Höhe gedeckelt, unter Titel, Zeitraumwahl und einer Kennzahlenkarte: rund 29 % des Bildschirms. Ein Tipp auf einen Muskel kann den Körper drehen. Die Trägheit rechnet pro Bild statt pro Zeit und läuft bei halber Bildrate doppelt so lang. Es gibt keinen Zoom, kein Zurücksetzen und keinen Umgang mit einem verlorenen Grafik-Kontext. Von Heute aus sind es drei Schritte bis zum Körper. Und gemessen wurde auf einem iPhone noch nie.

Dieser Block baut aus Vertrag §8 Grösse, Bedienung, Bewegung, Treffen und den Weg von Heute, dazu §10 für den Körper und die Messanzeige für Bildrate und Ladezeit. Dario, der Eigentümer, hat das mit D155 und D161 entschieden.

Die wichtigste Eigenschaft dieses Blocks: **Jede Aussage über «flüssig» und «schnell» ist gemessen, auf Darios Gerät, mit einer Anzeige in der App.** Dario hat keinen Mac; es gibt keinen anderen Weg zu diesen Zahlen. An dem, was die App rechnet, ändert sich nichts.

## 2. Arbeitsweise in dieser Session

- **Modell.** Dieser Block ist für das Modell geschrieben, das D159 nennt. Läufst du als anderes Modell, sag es in der ersten Zeile deiner ersten Antwort.
- **Subagenten.** Nur für reine Such- und Leseläufe über viele Dateien, und nur auf Sonnet. Jede Gestaltungsentscheidung und jede Änderung machst du selbst.
- **Branch.** Du committest und pushst auf `claude/momentum-wp3` im Repo `Momentum-App`. Dario erlaubt das ausdrücklich, auch wenn deiner Session ein anderer Arbeitsbranch zugeteilt wurde. Kein anderer Branch, kein Pull Request, kein Merge, kein Push auf den Default-Branch: Er veröffentlicht die Live-App bei jedem Push.
- **Eine Veröffentlichung.** Am Schluss, und nur dann, veröffentlichst du den Vorschau-Build im Repo `Momentum-preview` auf `main` (Abschnitt 7, Schritt 10). Auch das erlaubt Dario ausdrücklich.
- **Commits.** Kleine, benannte Commits im Stil der bestehenden Historie, englisch. Eine Golden-Datei oder ein Fingerabdruck wird in diesem Block nie neu eingefroren.
- **Sprache.** Chat und STOP-Bericht auf Deutsch in Schweizer Schreibweise. `docs/decisions.md`, `HANDOVER.md`, `CLAUDE.md`, Code-Kommentare und Commit-Nachrichten englisch wie bisher.
- **Zu Ende arbeiten.** Halte nicht an, solange du noch Teile schuldest. Hindernisse diagnostizierst und umgehst du. Angehalten wird am STOP 7B in Abschnitt 10, oder vorher, wenn die Voraussetzung in Abschnitt 3 fehlt.

## 3. Voraussetzung

- Block 7A ist abgenommen: `HANDOVER.md` nennt, welcher Körper in der App steht (ein neuer nach dem Gate, oder Stufe 1 auf dem alten), und Kopf, Hände und Füsse sind neutral.
- Der Block «Farbregeln» ist abgenommen: Muskelgruppen hat 30 und 90 Tage und den Knopf ⓘ mit der Legende.

Fehlt eines davon, bau nichts. Sag Dario, was fehlt, und halte an.

**Der Vertrag geht diesem Prompt vor**, ebenso jeder Entscheid in `docs/decisions.md`, der jünger ist als D163. Wo sie diesem Prompt widersprechen, gelten sie; nenn den Widerspruch im STOP-Bericht. Wo der Vertrag schweigt, entscheide im Sinn seines Leitbilds, halte die Entscheidung klein und führ sie im STOP-Bericht auf.

## 4. Das Gerät

Dario prüft auf einem **iPhone 15 Pro mit dem neusten iOS**. Die genaue Version nennt er am STOP; die Messanzeige druckt sie mit. Er benutzt Momentum als App vom Home-Bildschirm und gelegentlich in Safari. Daraus folgt für diesen Block:

- 393 px Breite ist die wichtigste Ansicht; 320, 360 und 430 px müssen trotzdem halten.
- Der Bildschirm meldet eine Pixeldichte von 3; der Körper zeichnet höchstens mit 2 (`dpr={[1, 2]}`). Das bleibt, ausser die Messung spricht dagegen.
- Der Bildschirm kann bis 120 Bilder pro Sekunde. Ob Safari der Seite 60 oder 120 gibt, weisst du nicht; die Messanzeige zeigt es, und die Bewegung darf nicht davon abhängen.
- Oben liegt die Kamerainsel, unten der Home-Balken. Die Höhe des sichtbaren Bereichs ist als App und in Safari verschieden.
- Zwei Gesten des Systems kreuzen sich mit deinen: das Vergrössern der Seite mit zwei Fingern (es wird nie gesperrt, Vertrag §12; der Zoom des Körpers gilt nur auf dem Körper) und das Zurückwischen vom linken Rand.

## 5. Was du zuerst liest

1. `docs/wp3/vertrag.md`: §8 ganz, §10, §11 (Laden und leer), §4 (die Kennzahlenleiste), §12 und §14 (die Zeilen für 7B).
2. Mockup 1: `docs/wp3/mockups/muskelgruppen.html` mit den Bildern `1-muskelgruppen-*.png` und `1-muskelgruppen-leer-*.png` unter `docs/wp3/mockups/bilder/`. Sieh sie dir an: Sie zeigen die Bühne, die Leiste und die Tasten.
3. `docs/decisions.md`: D155, D161, D146 (Glas und der Körper), D163 und die Einträge der Blöcke «Farbregeln» und 7A.
4. `docs/wp3/review-2026-11.md`: Abschnitt C («Körper als Bühne», «Signaturmomente»), die Zeile F8 in Abschnitt F und die Messgrössen am Ende von Abschnitt I.
5. `HANDOVER.md`: die Blöcke der Vorgänger in WP3 und der Abschnitt zur Muskelkarte.
6. `scripts/verify/README.md`: die drei 3D-Suites und was sie messen.
7. Den Code aus Abschnitt 6.

## 6. Ausgangslage im Code

**Kamera und Bewegung** (`src/features/body/CameraRig.tsx`, 268 Zeilen, eine eigene Umlaufsteuerung)

- Konstanten in den Zeilen 27–32: Abstand 4,05, Neigung zwischen −22° und 30°, `YAW_PER_PX = 0.55`, `FRICTION = 0.93`.
- `useFrame` (231) hat kein Zeit-Argument. Die Fahrt zu einer Ansicht ist `yaw += d * 0.18` pro Bild (241); das Auslaufen ist `yaw += velocity; velocity *= FRICTION` pro Bild (244–247). Beides hängt an der Bildrate.
- `keepAlive()` (119–126) fordert das nächste Bild an, solange sich etwas bewegt. Im Leerlauf entsteht kein Bild.
- Kein Zoom, kein Zurücksetzen. Nach aussen gibt es `goTo`, `faceAzimuth` und `azimuth` (54–61). `fovForHeight` (41–44) passt den Bildwinkel an die Höhe an.
- Reduzierte Bewegung wird in den Zeilen 70 und 89–98 gelesen und in 185 und 235 beachtet: kein Auslaufen, Ansichten springen.

**Tippen und Treffen**

- `src/features/body/useTapVsDrag.ts`: Ein Tipp bewegt sich höchstens 10 px (Finger) und dauert höchstens 500 ms (Zeilen 22–23); ein zweiter Finger macht aus der Geste keinen Tipp (41–46).
- `src/features/body/BodyModel.tsx:88–103`: ein einzelner Strahl. Der erste Treffer mit einer Muskelgruppe gewinnt, ein Treffer auf `none` wird übersprungen, sodass eine Gruppe dahinter gewinnen kann. Eine Toleranz gibt es nicht. Ein Fehltipp lässt die Auswahl stehen (`BodyViewer.tsx:118–126`).
- **Ein Tipp kann den Körper drehen.** `BodyViewer.tsx:191–199` dreht bei jeder Änderung der Auswahl hin, wenn die Gruppe mehr als 70° abgewandt ist, und unterscheidet nicht, ob die Auswahl aus der Liste oder vom Körper kam. `scripts/verify/body.mjs:237–238` und `body-reach.mjs:15–17` halten das als bekannt fest.

**Der Viewer** (`src/features/body/BodyViewer.tsx`)

- `dpr={[1, 2]}` (208); `frameloop={live ? 'demand' : 'never'}` (210); `live` heisst: im Bild und Tab sichtbar (159–174).
- Die Ansichtstasten stehen in den Zeilen 244–259 (`body.view.*`: Vorne, Seite, Hinten), als Leiste oben rechts (`bodyViewer.css:27–65`).
- Ohne WebGL oder nach einem Ladefehler steht der flache Ersatzkörper (201). Einen verlorenen Kontext (`webglcontextlost`) behandelt nichts.
- Das Modell lädt unter `Suspense fallback={null}` (232): Bis es da ist, ist die Fläche leer.
- Der Viewer ist ein eigener Chunk (`src/features/body/index.ts:9`).

**Grösse und Screen**

- `src/features/gym/muscleModule.css:24–32`: `aspect-ratio: 1 / 1.02; min-height: 280px; max-height: 360px`, in einer deckenden Karte (18–22).
- `src/features/gym/GymMusclesScreen.tsx`: Kopf mit Zurück-Taste und grossem Titel (46–56), Zeitraumwahl (59–69), dann `GymProgress` mit der Kennzahlenkarte, der Karte mit Körper und Zeilen und der Übungsliste. Während des Ladens steht `LoadingBlocks heights={[130, 520]}` (80).
- `body-preview.webp` wird nur auf der Karte in der Gym-Übersicht benutzt, nicht als Platzhalter.

**Der Weg**

- `src/app/route.ts`: Die Gym-Übersicht ist `#/areas/gym`, Muskelgruppen `#/areas/gym/muscles`.
- Auf Heute führt das Label der Gym-Kachel (`src/features/today/TodayScreen.tsx:454–459`, `onOpenGym`) über `src/app/App.tsx:51` in die Gym-Übersicht. Von dort führt die Karte `MuscleEntryCard` zu Muskelgruppen.

**Sheets und Messung**

- `Sheet` (`src/components/index.tsx:413`) wird in `<body>` eingehängt. Ein Signal «ein Sheet ist offen» gibt es nicht, und nichts hält den Körper unter einem Sheet an.
- Eine Anzeige für Bildrate oder Ladezeit gibt es nirgends. Einstellungen liegen in `src/features/areas/AreasScreen.tsx`; die Entwicklerseite `#/dev/body` gibt es nur im Dev-Server.

**Prüfung**

- `body.mjs` (Dev-Server): unter anderem «ein Zug über 40 px dreht mit Auslaufen» (210), «Auswahl in der Liste unter 70° bewegt die Kamera nicht» (214), «abgewandt dreht» (217), «alle zehn Gruppen per Tipp erreichbar» (260), «im Leerlauf null Bilder» (269), reduzierte Bewegung (328, 344).
- `gym-muscles.mjs` (Vorschau-Build): «Tipp wählt» (174–186), «im Leerlauf keine Bilder» (379), verdeckter Tab (385–398), aus dem Bild gescrollt (414–416).
- `body-reach.mjs` tippt ein Raster über den Körper; angenommen sind heute 9 von 10 Gruppen bei 320 px.
- Die drei 3D-Suites laufen einzeln. `npm run test` muss mit Exit 0 enden; der Typecheck ist `tsc -b`. Rot ist nur die Offline-Prüfung in `release-proof.mjs` (Aufräum-Block, D163).

## 7. Die Arbeit, in dieser Reihenfolge

### Schritt 0 – Ausgangsmessung

`tsc -b`, `npm run test`, `npm run build`, jede Browser-Suite, die 3D-Suites einzeln. Notier das Ergebnis von `body-reach.mjs` je Breite und Ansicht.

### Schritt 1 – Die Messanzeige, zuerst

Bau sie vor allem anderen; dann misst du jede weitere Änderung damit.

- **Was sie zeigt.** Ladezeit vom Öffnen von Muskelgruppen bis zum ersten Bild mit Modell, getrennt nach Code, Modell und erstem Bild, und ob aus dem Netz oder aus dem Speicher. Beim Drehen: mittlere Bildrate, Anteil der Bilder unter 25 ms, das längste Bild. Bilder in der letzten Sekunde Leerlauf. Zeichenaufrufe und Dreiecke aus dem Renderer. Die benutzte Pixeldichte, die beobachtete Bildrate des Bildschirms, Gerät und iOS-Version aus dem Browser, die Grösse des sichtbaren Bereichs.
- **Sie verfälscht nichts.** Sie fordert selbst kein Bild an und hält die Schleife nicht wach; sie aktualisiert sich nur mit Bildern, die ohnehin entstehen, und nach dem Ende einer Geste.
- **Sie ist für Dario bedienbar.** Aus, bis er sie einschaltet. Einschalten geht in der App vom Home-Bildschirm, ohne Adresszeile, und die Einstellung überlebt ein Neuladen, denn die Ladezeit misst man beim Neuladen. Eine Taste kopiert das Ergebnis als Text, damit er es in den Chat einfügen kann. Kein technisches Wort mehr als nötig; Zahlen mit Einheit.
- **Sie gehört nicht zu den Daten.** Kein Feld im Datenschema, nichts im Backup.
- Ob sie im Release bleibt, fragst du am STOP, mit Empfehlung.

Die Ziele aus dem Review, als Ziel und nicht als Garantie: Körper sichtbar nach höchstens 2,5 Sekunden beim ersten Laden und 1 Sekunde aus dem Speicher; beim Drehen im Mittel mindestens 55 Bilder pro Sekunde und 95 % der Bilder unter 25 ms; im Leerlauf kein Bild; höchstens 12 Zeichenaufrufe und 80'000 Dreiecke.

### Schritt 2 – Bewegung nach Zeit

- Auslaufen und Kamerafahrt rechnen mit der vergangenen Zeit (Vertrag §10). Bei halber Bildrate dauert dieselbe Bewegung gleich lang und endet am selben Winkel.
- Die Rechnung ist eine reine Funktion mit Unit-Test: 60 Schritte zu 16,67 ms und 30 Schritte zu 33,33 ms ergeben denselben Winkel, innerhalb einer genannten Toleranz. Ein langer Schritt nach einer Pause (Tab kam zurück) lässt den Körper nicht springen.
- In `body.mjs` oder `gym-muscles.mjs` belegt eine Prüfung dasselbe im Browser, mit gedrosselter Bildrate (Vertrag §14).
- Die Werte der Bewegung (Reibung, Dauer der Fahrt, Schwelle) stehen an einer Stelle, mit Namen. Drehen fühlt sich dynamisch, flüssig und organisch an (D155): Schwung beim Loslassen, weiches Auslaufen, kein hartes Einrasten.
- Reduzierte Bewegung bleibt, wie sie ist: kein Auslaufen, Ansichten springen.

### Schritt 3 – Ein Tipp dreht nie

- Der Viewer erfährt, woher eine Auswahl kommt. Ein Tipp auf den Körper wählt und lässt die Kamera stehen. Eine Auswahl in der Liste dreht den Körper, wenn die Gruppe abgewandt ist, mit der Fahrt aus Schritt 2.
- Schreib die Prüfungen um, die das alte Verhalten festhalten oder umgehen (`body.mjs:237–238`, die Rückdrehung in `body-reach.mjs`), genauso streng.

### Schritt 4 – Treffen

- Kopf, Hände und Füsse sind neutral: Ein Tipp dort wählt nichts.
- **Toleranz** (Vertrag §8): Ein Tipp bis 12 px neben einer Gruppe wählt die nächstliegende. Die 12 px sind Bildschirm-Pixel, unabhängig von Zoom und Pixeldichte. Das gleicht die schmalen Unterarme aus.
- Entscheide, was ein Tipp auf eine neutrale Fläche tut, hinter der eine Gruppe liegt (eine Hand vor dem Oberschenkel), und begründ es im STOP-Bericht.
- Ein Fehltipp lässt die Auswahl weiterhin stehen.
- **Ziel:** `body-reach.mjs` erreicht bei 320, 393 und 430 px von vorne und von hinten 10 von 10 Gruppen. Erreichst du es bei 320 px nicht, nenn die Zahl und den Grund; frier keine schwächere Erwartung ein, ohne es zu sagen.

### Schritt 5 – Die Bühne

Nach Vertrag §8 und Mockup 1:

- **Grösse und Rahmen.** Der Körper nimmt mindestens 55 % der Bildschirmhöhe ein und steht ohne Kartenrahmen auf dem Grund. Rechne mit der Höhe, die auf dem Gerät wirklich sichtbar ist, als App und in Safari. Kopf und Füsse berühren den Rand in keiner Ansicht.
- **Darüber** stehen nur drei Dinge: die Kopfzeile in 17 px mit Zurück, «Muskelgruppen» und ⓘ; die Zeitraumwahl; die Kennzahlenleiste.
- **Die Kennzahlenleiste** (Vertrag §4): drei Zellen, getrennt durch eine feine Linie, die erste breiter (1,35 : 1 : 1), damit «Leistungstrend» bei 320 px passt. Inhalt wie im Mockup: der Leistungstrend mit seinem Zustand; «Gewertet» mit der Zahl der gewerteten Gruppen von zehn; «Stärkster» mit Gruppe und Veränderung. Jede Zelle hat eine Beschriftung in 11 px, einen Wert in `--type-figure-m` und eine Zeile darunter. Die Leiste ersetzt die heutige Kennzahlenkarte; was deren Tipp erklärt hat, bleibt erreichbar.
- **Unter den Füssen** liegen ein kleiner Kontaktschatten und ein schwacher Schein. Nichts davon ist ein Weichzeichner über oder unter der Zeichenfläche (D146).
- **Die Tasten** Vorne, Seite, Hinten und Zurücksetzen stehen oben in der Bühne, als feste Flächen, mit 44 px Trefferfläche.
- **Darunter** die Reihe der fünf Zustände, dann die zehn Zeilen wie bisher.
- **Leer** (Mockup 1, zweiter Zustand): keine Leiste voller Striche. Der Körper steht gedimmt da, ein Satz sagt, was fehlt, und es gibt die eine primäre Aktion. `muscleGap.ts` liefert den Grund.
- **Laden** (Vertrag §11): Der Screen hält sein Layout. Wo der Körper stehen wird, steht bis dahin sein Standbild, an derselben Stelle und in derselben Grösse, ohne Sprung beim Wechsel. Brauchst du dafür ein zweites Standbild, erzeug es mit `tools/render-body-preview.mjs`.
- **Scrollen.** Die Zeilen unter dem Körper bleiben mit einer Hand erreichbar. Entscheide, was ein senkrechter Zug auf dem Körper tut, und prüf es auf dem Gerät.

### Schritt 6 – Zoom und Zurücksetzen

- Zoomen mit zwei Fingern zwischen 1,0 und 1,8, nur auf dem Körper. Die Seite selbst bleibt überall vergrösserbar.
- Ein Doppeltipp und die Taste ↺ setzen zurück: Ansicht vorne, Zoom 1,0, Neigung wie am Anfang. Die Auswahl bleibt.
- Zwei Finger sind nie ein Tipp und nie ein Zug zum Drehen. Der erste Tipp eines Doppeltipps wählt wie jeder Tipp, ohne Wartezeit.
- Entscheide, welcher Teil des Körpers bei Zoom im Fenster bleibt, sodass keine gewählte Gruppe aus dem Bild fällt.
- Bei reduzierter Bewegung springt der Zoom zurück, ohne Fahrt.

### Schritt 7 – Robust

- **Verlorener Kontext.** Geht der Grafik-Kontext verloren (iOS tut das bei Apps im Hintergrund), steht danach der Körper wieder oder der flache Ersatzkörper, nie eine leere Fläche. Belege es mit einer Prüfung, die den Kontext absichtlich verliert.
- **Die Pause.** Ein Wirt kann den Viewer anhalten: Es entsteht kein Bild, und das letzte bleibt stehen. Bau das hier und benutz es sofort für jedes Sheet, das über Muskelgruppen aufgeht (die Legende, die Erklärung der Kennzahl). Eine Prüfung in `gym-muscles.mjs` hält fest: Unter einem offenen Sheet entsteht kein Bild (Vertrag §14). Block 7C benutzt dieselbe Pause für das Muskel-Sheet.
- Was schon gilt, bleibt: kein Bild im Leerlauf, im verdeckten Tab und aus dem Bild gescrollt; nach Verlassen und Wiederbetreten genau ein Viewer.

### Schritt 8 – Der Weg von Heute

- Die Gym-Kachel auf Heute führt direkt zu Muskelgruppen (D161). Ihr Name für Vorlesehilfen sagt, wohin sie führt.
- Zurück führt dorthin, woher man kam. Von Muskelgruppen aus ist die Gym-Übersicht mit einem Tipp erreichbar; sie bleibt der Ort für Training, Pläne und Laufen. Die Knöpfe auf Heute, die ein Training erfassen oder fortsetzen, bleiben, wie sie sind.
- Heute lädt weder den Viewer noch das Modell; erst der Tipp tut es. Hältst du ein Vorladen für nötig, um das Ladeziel zu erreichen, ist das eine Frage für den STOP, kein stiller Schritt.
- Schreib die Prüfungen um, die den alten Weg gehen (`wp2-2-shots.mjs`, `design-system.mjs`).

### Schritt 9 – Suites und Durchsicht

- `body.mjs`, `gym-muscles.mjs` und `body-reach.mjs` halten die neuen Regeln: Ein Tipp dreht nie; die Trägheit hängt nicht an der Bildrate; Zoom hat seine Grenzen; Doppeltipp und Taste setzen zurück; verlorener Kontext; Pause unter dem Sheet; 10 von 10.
- `design-system.mjs` misst die Bühne mit: Jeder Text der Kopfzeile, der Leiste und der Tasten hält 4,5:1 an den gerenderten Pixeln; nichts ist breiter als der Bildschirm; die Leiste passt bei 320 px.
- Screenshots unter `docs/design/wp3/stage7b/` bei 320, 360, 393 und 430 px: Muskelgruppen oben, mit gewählter Gruppe, leer, beim Laden, gezoomt, mit dem Ersatzkörper, mit eingeschalteter Messanzeige. Sieh dir jeden an.
- Miss mit der Anzeige im Headless-Browser und trag die Zahlen als Vergleichswert ein. Sie sagen nichts über das iPhone; das steht dabei.

### Schritt 10 – Schlussprüfung und Vorschau

1. `tsc -b`, `npm run test` (Exit-Code), `npm run build`, alle Browser-Suites, die 3D-Suites einzeln. Vergleich mit Schritt 0.
2. `git diff <Commit vor diesem Block> -- .github/fixtures src/core src/storage` ist leer.
3. `HANDOVER.md` (ein Stage-Block), `CLAUDE.md` (die Regeln zum Körper, zum Glas über dem Körper und zur Trefferfläche, wo sie nicht mehr stimmen), `docs/decisions.md` (ein neuer Eintrag für das, was du entschieden hast), `scripts/verify/README.md`.
4. Veröffentlich den Build in `Momentum-preview` nach dessen `README.md`; die Statusleiste bleibt `default`. Warte auf den Workflow und öffne die Seite, soweit deine Netzwerkregeln es zulassen.

## 8. Was sich nicht ändern darf, und was nicht hierher gehört

**Unverändert bleiben:**

- alles, was rechnet oder speichert: `src/core/`, `src/storage/`, das Datenschema, das Backup-Format, jede Golden-Datei und jeder Fingerabdruck;
- `muscleState.ts` und die Farben am Körper;
- das Modell, sein Licht und sein Material (7A);
- der Inhalt der zehn Zeilen und der Weg für Vorlesehilfen über die Zeilen;
- das Vergrössern der Seite: nie gesperrt.

Kein Test wird gelöscht oder abgeschwächt. Im STOP-Bericht steht jede umgeschriebene Prüfung mit alter und neuer Regel.

**Eigene Blöcke, nicht dieser:**

- das Muskel-Sheet, seine Höhenstufen, das Wegziehen, die Kamera, die beim Öffnen zur Gruppe fährt (7C);
- WebKit-Lauf, Messprotokoll als Release-Beleg (9);
- die Offline-Prüfung (Aufräumen).

## 9. Abnahmekriterien

- Der Körper nimmt bei 320, 360, 393 und 430 px mindestens 55 % der Höhe ein, ohne Kartenrahmen, und nichts ist abgeschnitten.
- Ein Tipp dreht den Körper nie; eine Auswahl in der Liste dreht ihn, wenn die Gruppe abgewandt ist.
- Die Bewegung hängt nicht an der Bildrate; Unit-Test und Browser-Prüfung belegen es.
- Zoom zwischen 1,0 und 1,8; Doppeltipp und Taste setzen zurück; die Seite bleibt vergrösserbar.
- `body-reach.mjs` erreicht 10 von 10, oder die Abweichung ist benannt und begründet.
- Ein verlorener Kontext endet nie in einer leeren Fläche; unter einem offenen Sheet entsteht kein Bild.
- Die Gym-Kachel auf Heute führt direkt zum Körper, und zurück führt zu Heute.
- Die Messanzeige zeigt alle Werte aus Schritt 1 und lässt sie kopieren.
- `tsc -b` ist sauber, `npm run test` endet mit Exit 0, der Build läuft, jede Suite aus Schritt 0 besteht.
- Der Vorschau-Build ist erreichbar.

## 10. STOP 7B

Schreib Dario einen Bericht auf Deutsch, den er auf dem Telefon lesen kann:

1. In drei Sätzen: was sich geändert hat.
2. Vier Vorher-nachher-Paare: Muskelgruppen oben, mit gewählter Gruppe, leer, beim Laden.
3. Die Zahlen: Tests, Suites gegen die Ausgangsmessung, `body-reach.mjs` je Breite, deine Messwerte aus dem Headless-Browser neben den Zielen.
4. Eine leere Tabelle für seine Messwerte vom iPhone: erstes Laden, zweites Laden, Drehen, Leerlauf, Gerät und iOS.
5. Eigene kleine Entscheidungen und Abweichungen vom Vertrag, jede mit Grund.
6. Jede umgeschriebene Prüfung mit alter und neuer Regel.
7. Was du gesehen und für spätere Blöcke liegen gelassen hast.
8. Die Adresse der Vorschau und die Prüfliste fürs iPhone.
9. Höchstens fünf Fragen, jede mit Optionen und deiner Empfehlung. Eine steht fest: Bleibt die Messanzeige im Release?
10. Der Stand in git für beide Repos.

**Prüfliste fürs iPhone** (übernimm sie und pass sie an; höchstens zehn Punkte):

1. Auf Heute die Gym-Kachel antippen: Du landest direkt beim Körper. Zurück führt zu Heute. Die Gym-Übersicht erreichst du von dort mit einem Tipp.
2. Der Körper füllt gut die Hälfte des Bildschirms, ohne Rahmen. Kopf und Füsse sind nie abgeschnitten, als App vom Home-Bildschirm und in Safari.
3. Zehnmal auf verschiedene Muskeln tippen, auch auf die Unterarme: Der Körper dreht sich dabei nie. Notier, wie oft die richtige Gruppe gewählt wurde.
4. Ein Tipp auf Hand, Fuss oder Kopf wählt nichts.
5. In der Liste eine Gruppe der Rückseite wählen: Der Körper dreht zu ihr.
6. Zehnmal drehen und loslassen: Er läuft weich aus, ohne Ruckeln und ohne hartes Einrasten. Die Zeilen darunter bleiben mit einer Hand erreichbar.
7. Mit zwei Fingern zoomen: bis etwa 1,8-fach und nicht weiter. Doppeltipp und ↺ setzen zurück. Die Seite selbst zoomt dabei nicht mit.
8. Die Messanzeige einschalten, die App schliessen und neu öffnen, zu Muskelgruppen, zehn Sekunden drehen, loslassen, zwei Sekunden warten. Werte kopieren und in den Chat schicken. Dann dasselbe ein zweites Mal.
9. Die App eine Minute in den Hintergrund legen und die Kamera öffnen, dann zurück: Der Körper ist da oder die flache Figur, nie ein leeres Feld.
10. Die Legende ⓘ öffnen: Der Körper dahinter steht still. Mit «Bewegung reduzieren» in den Bedienungshilfen springen die Ansichten, und nichts läuft aus.

Dann wartest du auf Darios Abnahme und seine Messwerte. Trag sie in `HANDOVER.md` ein, mit Gerät, iOS-Version und Datum; es sind die ersten gemessenen Werte von einem iPhone in diesem Projekt. Was er findet, behebst du in derselben Session und veröffentlichst die Vorschau neu. Der nächste Block startet in einer neuen Session mit `docs/wp3/prompts/prompt-7c-muskel-sheet.md`.
