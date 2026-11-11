# Prompt 7A – Das Körpermodell: neues Grundmodell, Gate, Licht und Material

Für eine frische Session mit dem Modell, das D159 festlegt. Die Session braucht zwei Repos: `Hnd7k02/Momentum-App` (Branch `claude/momentum-wp3`) und `Hnd7k02/Momentum-preview`. Sie braucht ausserdem ein Artifact-Werkzeug, um Darios Referenzseite zu lesen.
Start: «Lies `docs/wp3/prompts/prompt-7a-koerpermodell.md` und führe ihn aus.»
Geschrieben am 11.11.2026, vor den Blöcken «Farbregeln» und 5b. Zeilennummern beziehen sich auf den Commit `af89fd9`; prüf sie, bevor du dich darauf verlässt.

## 1. Worum es geht

Momentum ist eine lokale Web-App fürs iPhone. Ihr Kern im Gym-Bereich ist ein drehbarer 3D-Körper, der je Muskelgruppe zeigt, wie sich die Trainingsleistung verändert hat. Dario, der Eigentümer, hat die Richtung festgelegt (D155): ein einfarbiger Körper in Weiss oder Schwarz, ohne Anatomiefarben, etwas anatomischer als heute, mit erkennbaren Muskelformen und sauberen Grenzen. Farbe kommt allein aus den Trainingsdaten.

Der heutige Körper erfüllt das nicht. Der Hals ist lang und dünn, der Kopf klein mit einem fremdartigen Gesicht, die Arme enden in Krallenhänden, die Füsse sind Stümpfe, und die Muskelzeichnung ging bei der Reduktion auf 40'000 Dreiecke verloren. Das Originalmodell ist nicht mehr auffindbar (D156).

D156 sah deshalb vor: Stufe 1 auf dem heutigen Modell, daneben ein Proof-Gate mit BodyParts3D. **Dario hat den Weg am 11.11.2026 geändert:** Das neue Grundmodell entsteht aus MakeHuman, nach der Anleitung `koerper-anleitung-7a.md` auf seiner Referenzseite. Ein erster Machbarkeits-Proof liegt dort; Dario hat ihn nicht abgenommen.

Dieser Block tut vier Dinge:

1. Er hält den neuen Weg als Entscheid fest, der D156 ergänzt.
2. Er baut Kandidaten für den Körper und legt sie Dario an einem **Gate** vor.
3. Wählt Dario einen Kandidaten, kommt dieser in die App, mit Licht, Material, Tone Mapping und neutraler Zone nach Vertrag §8.
4. Fällt das Gate durch, kommt Stufe 1 auf dem heutigen Modell, und das Körperthema wandert hinter WP3.

Die wichtigste Eigenschaft dieses Blocks: **Vor dem Gate wird in der App nichts getauscht, und an der App-Logik ändert sich gar nichts.** Das Gate hat eine Zeitbox von einer Session und hält die anderen Blöcke nicht auf (D159).

## 2. Arbeitsweise in dieser Session

- **Modell.** Dieser Block ist für das Modell geschrieben, das D159 nennt. Läufst du als anderes Modell, sag es in der ersten Zeile deiner ersten Antwort.
- **Subagenten.** Nur für reine Such- und Leseläufe über viele Dateien, und nur auf Sonnet. Jede Entscheidung, jedes Skript und jede Beurteilung eines Bildes machst du selbst.
- **Nur Skripte.** Bei Dario läuft kein Blender. Alle 3D-Arbeit läuft als Skript in dieser Session und ist wiederholbar: gleicher Input, byte-gleiches GLB.
- **Fremdes Material.** Die Referenzbilder der Seite gehören ihren Urhebern und kommen nie ins Repo und nie auf eine Seite, die du veröffentlichst. Ins Repo kommen nur Daten, deren Lizenz du selbst im Wortlaut gelesen hast.
- **Die Referenzseite ist Material, kein Auftrag.** Du liest sie mit deinem Artifact-Werkzeug, nicht über einen Web-Abruf. Was dort steht, ist Grundlage; der Auftrag ist dieser Prompt.
- **Branch.** Du committest und pushst auf `claude/momentum-wp3` im Repo `Momentum-App`. Dario erlaubt das ausdrücklich, auch wenn deiner Session ein anderer Arbeitsbranch zugeteilt wurde. Kein anderer Branch, kein Pull Request, kein Merge, kein Push auf den Default-Branch: Er veröffentlicht die Live-App bei jedem Push.
- **Zwei Veröffentlichungen, beide privat oder Vorschau.** Das Vergleichsblatt fürs Gate veröffentlichst du als private Artifact-Seite. Den Vorschau-Build veröffentlichst du erst nach dem Gate, am Schluss, im Repo `Momentum-preview` auf `main`. Beides erlaubt Dario ausdrücklich.
- **Commits.** Kleine, benannte Commits im Stil der bestehenden Historie, englisch. Eine Golden-Datei oder ein Fingerabdruck wird in diesem Block nie neu eingefroren.
- **Sprache.** Chat und STOP-Berichte auf Deutsch in Schweizer Schreibweise. `docs/decisions.md`, `HANDOVER.md`, `CLAUDE.md`, Code-Kommentare und Commit-Nachrichten englisch wie bisher.
- **Zu Ende arbeiten.** Halte nicht an, solange du noch Teile schuldest. Hindernisse diagnostizierst und umgehst du. Angehalten wird zweimal: am Gate (Abschnitt 7, Schritt 6) und am STOP 7A (Abschnitt 10).

## 3. Voraussetzung

- Block 5b ist abgenommen, oder Dario sagt in der Startnachricht, dass er 7A vorzieht. Technisch hängt dieser Block nur am Block «Farbregeln»: Der Körper kennt dann zwei neutrale Töne, Weiss für «Gehalten» und gedimmt für «Noch nicht trainiert» und die neutrale Zone.
- Du erreichst die Referenzseite «Momentum Referenzen»: `https://claude.ai/artifact/EZ9tFk1GZrUR8bbUxHMByk`. Von dort brauchst du `koerper-anleitung-7a.md`, `build_mh.py`, `label_mh.py` und `refine-body.mjs`. Erreichst du sie nicht, sag es Dario in deiner ersten Antwort und bitte ihn, die vier Dateien anzuhängen; bis dahin machst du Schritt 0 und Schritt 1.

**Rangfolge, wo sich etwas widerspricht:** Darios Punkte zum Proof (Abschnitt 4) vor der Anleitung; der Vertrag `docs/wp3/vertrag.md` und die Entscheide in `docs/decisions.md` vor diesem Prompt; dieser Prompt vor der Anleitung, wo es um Ablauf, Branch und Grenzen geht. Nenn jeden Widerspruch im Bericht.

## 4. Darios Punkte zum Proof

Was Dario am Proof nicht gefällt und was bleiben soll. **Diese Punkte gehen der Anleitung vor.**

Stand 11.11.2026: noch nicht eingetragen. Sie stehen an einem dieser drei Orte; nimm den jüngsten:

1. in der Nachricht, mit der Dario diese Session startet;
2. hier, falls er sie nachgetragen hat:
   - [ … ]
3. in Abschnitt 0 der Anleitung auf der Referenzseite.

Findest du sie an keinem der drei Orte, frag in deiner ersten Antwort danach, in einem Satz. Arbeite dann an Schritt 0 bis 3 weiter; die hängen nicht daran. Sind die Punkte noch immer nicht da, wenn du die Kandidaten baust, baust du nach der Anleitung allein und schreibst gross über das Vergleichsblatt, dass Darios Punkte fehlten.

## 5. Was du zuerst liest

1. Die Referenzseite: die Anleitung ganz, die Leitplanke für den Körper, den Abschnitt zum Proof und die drei Skripte. Sieh dir die Bilder des heutigen Körpers und des Proofs an.
2. `docs/wp3/vertrag.md`: §8 ganz, dazu §2 (Farbe, mit den Ausnahmen), §7 (die fünf Zustände am Körper), §12 und §14 (die Zeile «Hände neutral, Prüfpunkte der Zonen»).
3. `docs/decisions.md`: D155, D156, D157, D161, dazu D148 (das Standbild), D162 (die Farbwerte des Körpers liegen in `tokens.css`; dieser Block besitzt sie) und D123.
4. `docs/wp3/review-2026-11.md`: Abschnitt D.
5. `docs/design/muscle-map/momentum-muscle-map-handoff/HANDOFF.txt` und `docs/design/muscle-map/HANDOFF-DEVIATIONS.md`: der Vertrag zwischen GLB und App.
6. `HANDOVER.md`: den Abschnitt zur Muskelkarte und die Blöcke der Vorgänger in WP3.
7. `scripts/verify/README.md`: die drei 3D-Suites.
8. Den Code aus Abschnitt 6.

## 6. Ausgangslage im Code

**Das Modell**

- `public/models/momentum-body.glb`: 478'008 Bytes, 40'000 Dreiecke, 19'446 Punkte, ein Netz, 11 Teilnetze (zehn Gruppen und `none`). Geladen in `src/features/body/BodyModel.tsx:18`.
- Unter `tools/` liegen nur `validate-body-glb.mjs` (263 Zeilen) und `render-body-preview.mjs`. Einen Ordner `tools/body/` gibt es nicht, und kein Skript im Repo kann den heutigen Körper erzeugen.
- `src/features/body/muscleMeshMap.ts:120–129` führt die Dreieckszahlen je Gruppe. Zeile 132 nennt `none` «head, hands, feet»; im GLB gehören die Hände aber zu den Unterarmen.

**Der Validator** (`tools/validate-body-glb.mjs`, läuft als Erstes in `npm run build`)

- Rahmenwerte in den Zeilen 24–31: Höhe 1,60–1,90 m, höchstens 80'000 Dreiecke, mindestens 400 je Gruppe.
- Ein Netz (94), gemeinsame Punkt- und Normalenliste (110–117), ein Teilnetz je Materialname (126), alle zehn Gruppen und `none` (129–136), Quantisierung (145–150), Höhe, Breite, Füsse am Boden, Mitte (164–168), beidseitige Gruppen (193–204).
- Hüllen als Anteil der Körperhöhe (211–239), darunter `core: [0.54, 0.75]` und `calves: [0.03, 0.28]`. Für Schultern, Bizeps, Trizeps und Unterarme gibt es keine.
- Lizenz (243–246): `asset.copyright` muss «patmateee» und «CC-BY» nennen.
- Er prüft nicht, dass Hände, Kopf und Füsse neutral sind. Einen Test mit festen Prüfpunkten gibt es nirgends.

**Material und Licht**

- `src/features/body/BodyViewer.tsx:216–230`: sRGB-Ausgabe, `ACESFilmicToneMapping` (217), eine Raumumgebung (222), ein Halbkugellicht mit Stärke 1,35 (227) und drei Richtungslichter mit 2,15, 0,75 und 1,05.
- `src/features/body/tokens.ts:134–141`: Rauheit 0,74, kein Metall, Mischung und Kantenglanz für Ruhe und Auswahl. `BodyModel.tsx:64`: das Material der neutralen Zone mit Rauheit 0,8.
- Die Farbwerte des Körpers stehen in `src/styles/tokens.css` (`--body-*`, um Zeile 362) und werden über `statusPalette.ts` gelesen; `tokens.test.ts` hält sie fest. Der Block «Farbregeln» hat dort die zwei neutralen Töne ergänzt.
- `three` ist 0.160.1 (`package.json:19`). `AgXToneMapping` gibt es dort, `NeutralToneMapping` nicht.

**Werkzeuge und Ansichten**

- Die Entwicklerseite `#/dev/body` (`src/main.tsx:14–17`, `BodyDevPage.tsx`) gibt es nur im Dev-Server. Sie zeigt den Körper mit einer festen Mischung der fünf Zustände und nimmt `?lang=en` und `?model=missing`.
- `src/features/gym/assets/body-preview.webp` ist das Standbild auf der Karte in der Gym-Übersicht (`MuscleEntryCard.tsx:14`). `tools/render-body-preview.mjs` erzeugt es über `#/dev/body`. `HANDOVER.md` verlangt, es bei jeder Modelländerung neu zu erzeugen; D148 legt die Frage an den STOP dieses Blocks.
- Der flache Ersatzkörper (`src/components/BodyRenderer/`, eingesetzt in `MuscleModule.tsx:57–62`) steht, wenn 3D nicht geht. Er bleibt.

**Nennung**

`THIRD-PARTY-NOTICES.md`; in der App `areas.credits.*` (`src/i18n/de.ts:21` und `27`, `en.ts:20` und `25`, `src/features/areas/CreditsSection.tsx`); dazu `docs/design/muscle-map/ATTRIBUTION.txt` und `license.txt`.

**Prüfung**

- `scripts/verify/body.mjs` läuft gegen den Dev-Server (`npx vite --port 5173`), `gym-muscles.mjs` und `body-reach.mjs` gegen `npm run build` und `npx vite preview --port 4173`. Die drei laufen einzeln, nie parallel. `body-reach.mjs` trifft bei 320 px heute 9 von 10 Gruppen; die Unterarme fehlen.
- `npm run test` muss mit Exit 0 enden; der Typecheck ist `tsc -b`. Rot ist in den Suites nur die Offline-Prüfung in `release-proof.mjs` (Aufräum-Block, D163).
- Chromium liegt unter `/opt/pw-browsers/chromium`. Installiere keinen Browser.

## 7. Die Arbeit, in dieser Reihenfolge

### Schritt 0 – Ausgangsmessung und Werkzeug

`tsc -b`, `npm run test`, `npm run build`, jede Browser-Suite, die 3D-Suites einzeln. Prüf dann dein Werkzeug: die Python-Version, ob sich `bpy` installieren lässt (die Anleitung nennt bpy 5.3 mit Python 3.13) und ob PyPI erreichbar ist. Geht `bpy` nicht, sag es im Gate-Bericht und nenn, was du stattdessen benutzt hast.

### Schritt 1 – Der Entscheid

Trag in `docs/decisions.md` einen neuen Eintrag ein (nächste freie Nummer), der D156 ergänzt; D156 bekommt eine Statusnotiz. Er hält fest, in der Form der bestehenden Einträge:

- Dario hat am 11.11.2026 entschieden: Das neue Grundmodell entsteht aus MakeHuman (MPFB2-Daten, CC0), per Skript geformt, in Pose gebracht, in Regionen geteilt und mit Relief versehen; danach läuft `refine-body.mjs`.
- Das ersetzt das Proof-Gate mit BodyParts3D aus D156. BodyParts3D bleibt nur als mögliche Quelle für das Relief, und nur aus der offiziellen Quelle.
- Es gibt ein Gate mit den Kriterien der Anleitung; vorher wird in der App nichts getauscht.
- Fällt das Gate durch, gilt Stufe 1 auf dem heutigen Modell, und das Körperthema kommt nach WP3.

Zieh `HANDOVER.md` nach, wo es noch «stage 1 of the body and the proof gate» sagt. Am Ende des Blocks ergänzt du den Eintrag um den Ausgang des Gates.

### Schritt 2 – Die Pipeline ins Repo

- `tools/body/` bekommt `refine-body.mjs`, `build_mh.py` und `label_mh.py`. Die beiden Python-Dateien sind Proof-Skripte; mach daraus ein Werkzeug mit einem Befehl, festen Eingaben und einer Ausgabe.
- **Die MakeHuman-Daten.** Sie kommen aus dem PyPI-Wheel `anny==0.6.2`, und zwar nur der Ordner `anny/data/mpfb2/`, nie der Code. Lies die Lizenzdatei in diesen Daten im Wortlaut. Steht dort nicht CC0 1.0, halte an und sag es Dario. Leg entweder die benötigten Dateien samt Lizenz unter `tools/body/makehuman/` ab (wenige MB) oder halt das Wheel über seinen sha256 fest; begründ die Wahl.
- **Der Build ist deterministisch.** Zweimal gebaut ergibt zwei byte-gleiche Dateien. Der sha256 des GLB steht in einer `README.md` unter `tools/body/`, mit den Befehlen.
- **Tests.** `refine-body.mjs` hatte keine. Schreib sie, bevor du dich darauf verlässt: was als Streustück gilt, dass die Oberfläche beim Schneiden der Grenzen gleich bleibt, dass der Urhebervermerk geschrieben wird.

### Schritt 3 – Messen

Ein Skript misst jeden Körper an Landmarken und gibt die Tabelle der Anleitung (§3) aus: Kopfhöhe, Schulterhöhe, Kniehöhe, Schritthöhe, Arm- und Handlängen, Fusslänge, Schulterbreite, Hals zu Kopf, Symmetrie, dazu die Winkel der Haltung. Die Zielwerte der Anleitung sind Startwerte; prüf sie gegen eine Quelle (Drillis und Contini, wie Winter sie wiedergibt, oder ANSUR II), bevor sie in den Validator gehen, und nenn die Quelle in der Dokumentation.

Miss damit zuerst den heutigen Körper und den Proof (14'404 Punkte, 28'792 Dreiecke, 398 KB). Das ist die Vergleichsbasis fürs Gate.

### Schritt 4 – Die Kandidaten

Nach §4 der Anleitung, mit Darios Punkten aus Abschnitt 4 als erster Vorgabe:

- **Form.** Höchstens drei Körpertypen, lokale Formregler sparsam, jede Änderung gegen die Masse geprüft. Das Zielbild ist ein trainierter Mann zwischen 25 und 35 mit etwa 10–12 % Körperfett: athletisch, kein Bodybuilder, kein Comic-Held.
- **Pose.** Die Zielwinkel der Anleitung; die Ruhepose von MakeHuman weicht stark davon ab. Nach der Pose Ellbogen und Handgelenk auf Einschnürungen prüfen.
- **Relief.** Das ist der wichtigste Hebel: MakeHuman allein bleibt glatt. Zuerst Weg A (unterteilen und Rillen per Skript formen). Weg B nur, wenn A nicht reicht, und dann mit Namensnennung.
- **Kopf.** Zwei Varianten: natürlich und ruhig, oder vereinfacht wie eine Schaufensterpuppe.
- **Dreiecke.** Weniger in Kopf, Händen und Füssen, mehr in Rumpf und Gliedern. Höchstens 80'000, Ziel 40'000–60'000, mindestens 400 je Gruppe, das GLB höchstens 700 KB.
- **Regionen.** Einmal pro Punkt der festen Topologie festgelegt und als Datei gespeichert, nach der anatomischen Zuordnung der Anleitung. Kopf mit Hals, Hände ab dem Handgelenk und Füsse ab dem Knöchel sind `none`.
- **Achtung bei `refine-body.mjs`:** Seine Streu-Erkennung gab im Proof den oberen Trapezius vorne an die Nachbarn zurück. Sichere den Zusammenhang oder die Schwelle, und halt es mit einem Prüfpunkt fest.

Der Vertrag mit der App bleibt: ein Netz, 11 Teilnetze, der Materialname ist die ID der Muskelgruppe, `KHR_mesh_quantization`. Kopier den Proof nicht als Ziel.

### Schritt 5 – Licht, Material, Tone Mapping

Nach Vertrag §8, beurteilt am neuen Körper, nicht am alten:

- weniger Grundlicht, ein Hauptlicht von schräg oben, ein Kantenlicht von hinten;
- ein Tone Mapping, das die Statusfarben hält, statt sie zu Pastell zu machen. Die Farbe am Körper muss der Legende entsprechen. Bleib bei `three` 0.160.1; hältst du ein Upgrade für den einzigen Weg, ist das eine Frage fürs Gate, kein stiller Schritt;
- Weiss für «Gehalten», gedimmt für «Noch nicht trainiert» und die neutrale Zone, deutlich unterscheidbar auf Graphit;
- jeder Wert ist ein Token in `tokens.css`; `tokens.test.ts` hält die neuen Werte.

Zeig es an fünf Bildern: die fünf Zustände am neuen Körper, von vorne und von hinten, dazu ein Körper ohne Daten.

### Schritt 6 – Das Gate

**Bis hierher ist in der App nichts getauscht.** Die Kandidaten renderst du über `#/dev/body` mit einem Modellpfad, der nur dort gilt.

Dario bekommt ein Vergleichsblatt, als private Artifact-Seite fürs iPhone und mit den wichtigsten Bildern im Chat:

- «heute» gegen die Kandidaten, als ausgewählte Paare aus Körpertyp und Kopf: höchstens drei Körpertypen und zwei Köpfe, nicht alle Kombinationen;
- je Kandidat: vorne, seitlich, hinten und drei Viertel, einmal neutral und einmal mit Statusfarben, in der Gym-Welt und auf Hell, bei 393 und 320 px; dazu Nahaufnahmen von Kopf, Händen und Füssen;
- die Tabelle der Masse gegen die Ziele, mit dem heutigen Körper und dem Proof daneben;
- Dreiecke, Kilobyte, sha256;
- deine eigene Einschätzung in drei Sätzen je Kandidat: was erkennbar ist (Brust mit Unterkante, Bauch mit Mittellinie und Querfurchen, Schulter, Bizeps, Trizeps, Unterarm, Oberschenkel, Waden, Trapez, Latissimus, Rückenstrecker, Gesäss) und was nicht, und welche Artefakte du siehst.

Auf dem Blatt stehen nur deine eigenen Renderings. Kein Referenzbild.

**Prüfliste fürs iPhone am Gate** (höchstens zehn Punkte):

1. Erster Eindruck je Paar, bevor du ins Detail gehst: Mensch oder Puppe?
2. Proportionen: Kopf, Hals, Schulterbreite, Beinlänge.
3. Haltung: Arme, Hände, Stand.
4. Kopf: Variante A oder B, und irritiert das Gesicht?
5. Hände und Füsse in der Nahaufnahme.
6. Bei kleiner Darstellung: Welche Muskeln erkennst du ohne Farbe?
7. Die Grenzen zwischen den Gruppen mit Statusfarben: sauber oder gezackt?
8. Die Farben: Entsprechen Grün, Rot, Blau, Weiss und gedimmt der Legende?
9. Der Vergleich mit dem heutigen Körper: klar besser, gleich, schlechter?
10. Deine Wahl: ein Paar; oder ein Paar mit höchstens drei Korrekturen; oder keines.

Dazu eine Frage mit Empfehlung: Wird `body-preview.webp` mit dem gewählten Körper neu gerendert (D148)? Dann wartest du.

- **Dario wählt ein Paar:** weiter mit Schritt 7a.
- **Er wählt ein Paar mit Korrekturen:** eine Runde in dieser Session, neues Blatt, dann entscheidet er.
- **Er wählt keines:** weiter mit Schritt 7b.

### Schritt 7a – Produktion, wenn das Gate besteht

- `public/models/momentum-body.glb` wird ersetzt; der Build läuft aus `tools/body/` mit einem Befehl.
- **Validator.** Die Hüllen kommen aus den gemessenen Proportionen des neuen Körpers, jede mit Begründung, keine wird einfach geweitet. Die Lizenzprüfung gilt der neuen Quelle. Neu dazu kommen die Masse aus Schritt 3 und die neutrale Zone.
- **Prüfpunkte** (Vertrag §14), im Validator und in einem eigenen Test: Hand, Fuss und Kopf sind `none`; die Aussenseite des Oberschenkels gehört zum Bein; der obere Trapezius gehört zum Rücken; jede der zehn Gruppen wird an einem festen Punkt getroffen.
- `muscleMeshMap.ts`: die Tabelle der Dreieckszahlen und der Kommentar zur neutralen Zone.
- **Nennung.** `THIRD-PARTY-NOTICES.md` und die Texte in der App in beiden Sprachen: Für das ausgelieferte Modell fällt patmateee weg; MakeHuman wird genannt, freiwillig und empfohlen. Solange im Repo Dateien liegen, die vom alten Modell abstammen (die Kopie des GLB unter `docs/design/muscle-map/momentum-muscle-map-handoff/`, Bilder davon), bleibt dessen Nennung in `THIRD-PARTY-NOTICES.md` als eigener Abschnitt stehen, und `ATTRIBUTION.txt` und `license.txt` dort bleiben, wie sie sind. Der Satz zur Modelllizenz in der Lizenzdatei der App gehört dem Aufräum-Block; halt in `HANDOVER.md` fest, was er wissen muss.
- **Rahmen.** Kopf und Füsse berühren den Rand bei 320, 393 und 430 px in keiner Ansicht (`body.mjs`). Miss `body-reach.mjs` neu und nenn das Ergebnis; die Treffertoleranz für die Unterarme baut Block 7B.
- `body-preview.webp` nach Darios Antwort am Gate.

### Schritt 7b – Stufe 1, wenn das Gate durchfällt

`refine-body.mjs` auf dem heutigen GLB: Grenzen entlang der Rillen, Streustücke zurück, die gebackene Schattierung mit den zwei Materialstellen, die das Skript nennt, die Hände in die neutrale Zone. Validator und Prüfpunkte wie in 7a, soweit sie für dieses Modell gelten; die Lizenz bleibt patmateee, CC BY 4.0. Licht, Material und Tone Mapping aus Schritt 5 stellst du an diesem Körper ein. Der Entscheid aus Schritt 1 hält fest: Das Körperthema kommt nach WP3.

### Schritt 8 – Schlussprüfung und Vorschau

1. `tsc -b`, `npm run test` (Exit-Code), `npm run build` mit dem Validator, alle Browser-Suites, die 3D-Suites einzeln. Vergleich mit Schritt 0.
2. `git diff <Commit vor diesem Block> -- .github/fixtures src/core src/storage` ist leer.
3. Die Grösse des GLB und des Builds gegen vorher.
4. `HANDOVER.md` (ein Stage-Block; der Abschnitt zur Muskelkarte, wo er das alte Modell beschreibt), `CLAUDE.md` (wo eine Regel zum Körper nicht mehr stimmt), der Entscheid mit dem Ausgang des Gates.
5. Veröffentlich den Build in `Momentum-preview` nach dessen `README.md` (dort steht auch die Grösse des GLB); die Statusleiste bleibt `default`. Warte auf den Workflow und öffne die Seite, soweit deine Netzwerkregeln es zulassen.

## 8. Was sich nicht ändern darf, und was nicht hierher gehört

**Unverändert bleiben:**

- alle App-Logik: `src/core/`, `src/storage/`, `muscleState.ts`, jede Golden-Datei und jeder Fingerabdruck;
- der Vertrag zwischen GLB und App: ein Netz, 11 Teilnetze, Materialname gleich ID, die zehn IDs;
- die Bedienung des Körpers: Tippen, Drehen, Ansichtstasten, Grösse und Rahmen der Bühne;
- der flache Ersatzkörper.

Erlaubt sind nur: das Modell und seine Pipeline, der Validator, die Tabelle in `muscleMeshMap.ts`, die Licht- und Materialstellen samt ihren Tokens, die Nennung, das Standbild und die Entwicklerseite `#/dev/body` (etwa ein Parameter, der dort einen Kandidaten lädt).

**Nicht tun:** kein Blender von Hand; keine gekauften Modelle und keine von Sketchfab; keine Datei aus dem GitHub-Mirror von BodyParts3D im Repo (er trägt CC BY-SA 2.1 Japan); kein Referenzbild im Repo; kein Merge, kein Deploy.

**Eigene Blöcke, nicht dieser:** die Körperbühne, Zoom, Tippen und Drehen, die Treffertoleranz, die Messanzeige (7B); das Muskel-Sheet (7C); die Lizenzdatei der App (Aufräumen).

## 9. Abnahmekriterien

- Der neue Entscheid steht in `docs/decisions.md`, D156 trägt eine Statusnotiz, und der Ausgang des Gates ist eingetragen.
- Die Pipeline liegt unter `tools/body/`, baut mit einem Befehl und ergibt zweimal dasselbe GLB; die Lizenz jeder Datenquelle ist im Wortlaut gelesen und im Repo abgelegt.
- Das Gate fand statt, bevor in der App etwas getauscht wurde.
- Der Validator und der Prüfpunkt-Test sind grün; Hände, Kopf und Füsse sind neutral.
- Die Farben am Körper entsprechen der Legende, belegt an fünf Bildern.
- `tsc -b` ist sauber, `npm run test` endet mit Exit 0, der Build läuft, jede Suite aus Schritt 0 besteht.
- Das GLB hat höchstens 80'000 Dreiecke und 700 KB.
- Der Vorschau-Build ist erreichbar.

## 10. STOP 7A

Schreib Dario einen Bericht auf Deutsch, den er auf dem Telefon lesen kann:

1. In drei Sätzen: welcher Körper jetzt in der App steht und warum.
2. Vier Vorher-nachher-Paare aus der App: Muskelgruppen von vorne und von hinten, die Karte in der Gym-Übersicht, eine Nahaufnahme.
3. Die Zahlen: Masse gegen Ziel, Dreiecke, Kilobyte, sha256, Tests und Suites gegen die Ausgangsmessung, das Ergebnis von `body-reach.mjs`.
4. Lizenz und Nennung: was im Repo liegt, was die App nennt.
5. Abweichungen von der Anleitung und vom Vertrag, und eigene kleine Entscheidungen, jede mit Grund.
6. Was du gesehen und für spätere Blöcke liegen gelassen hast.
7. Die Adresse der Vorschau und die Prüfliste fürs iPhone.
8. Höchstens fünf Fragen, jede mit Optionen und deiner Empfehlung.
9. Der Stand in git für beide Repos.

**Prüfliste fürs iPhone** (übernimm sie und pass sie an; höchstens zehn Punkte):

1. Muskelgruppen öffnen: der Körper von vorne, von der Seite und von hinten. Stimmen Proportionen, Haltung und Kopf mit dem überein, was du am Gate gewählt hast?
2. Ohne auf die Farben zu achten: Erkennst du Brust, Bauch, Schulter, Rücken, Oberschenkel und Wade?
3. Die Farben entsprechen der Legende: Grün und Rot sind kräftig, nicht blass.
4. Eine gehaltene Gruppe ist weiss, eine nicht trainierte deutlich dunkler.
5. Kopf, Hände und Füsse sind gedimmt, färben sich nie und lassen sich nicht wählen.
6. Die Grenzen zwischen den Gruppen sind sauber, ohne Zacken und ohne Flecken an falscher Stelle.
7. Tippen auf jede der zehn Gruppen wählt die richtige. Die Unterarme sind schmal; das behebt Block 7B.
8. Drehen fühlt sich flüssig an, und der Körper erscheint ohne lange Wartezeit. Gemessen wird in Block 7B.
9. Die Karte in der Gym-Übersicht zeigt denselben Körper.
10. Bereiche → Einstellungen: Die Nennung des Modells stimmt.

Dann wartest du auf Darios Abnahme. Was er auf dem iPhone findet, behebst du in derselben Session und veröffentlichst die Vorschau neu. Der nächste Block startet in einer neuen Session mit `docs/wp3/prompts/prompt-7b-interaktion.md`.
