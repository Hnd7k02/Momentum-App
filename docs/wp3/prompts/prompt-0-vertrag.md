# Prompt 0 – Vertrag über Aussehen, Zustände und Wörter

Für eine frische Session mit Claude Fable 5.2 im Repo `Hnd7k02/Momentum-App`, Branch `claude/momentum-wp3`.
Start: «Lies `docs/wp3/prompts/prompt-0-vertrag.md` und führe ihn aus.»
Geschrieben am 11.11.2026. Zeilennummern in diesem Prompt beziehen sich auf den Commit `7e2a5ce`; prüf sie, bevor du dich darauf verlässt.

## 1. Worum es geht

Momentum ist eine lokale Web-App fürs iPhone (React, TypeScript, Vite, alle Daten in IndexedDB) mit zwei Bereichen, Mind und Gym. Ihr Kern soll ein drehbarer 3D-Körper werden, der zeigt, wie sich die Trainingsleistung je Muskelgruppe entwickelt, umgeben von einer ruhigen Zahlenwelt. Der Eigentümer ist Dario; er entscheidet, du baust.

Ein Review vom November 2026 (`docs/wp3/review-2026-11.md`) hat drei Engpässe benannt: das Körpermodell, die Kennzahl hinter den Farben und eine Gestaltung ohne Regeln für Farbe, Zahlen und Diagramme. Dario hat den Review freigegeben und entschieden. Die Umsetzung läuft danach in Blöcken, jeder in einer eigenen frischen Session: 6b (Designsystem), Farbregeln des Muskelstatus, 5b (Kennzahl), 7A (Körpermodell), 7B (Interaktion), 7C (Muskel-Sheet), 9 (Härtung).

Dieser Block ist der erste und verändert nichts am Produkt. Er legt schriftlich fest, wie die App aussehen und sprechen soll, damit die folgenden Blöcke bauen können, statt an jeder Ecke eine Grundsatzfrage zu stellen. Du lieferst vier Dinge und hältst dann an:

1. Darios Entscheide, eingetragen in `docs/decisions.md`.
2. Den Vertrag: `docs/wp3/vertrag.md`.
3. Drei Mockups mit Screenshots.
4. Einen STOP-Bericht, an dem Dario abnimmt.

Der Vertrag hat zwei Leser. Dario muss jede Regel ohne Design-Vorwissen verstehen und abnehmen können. Und eine spätere Session, die nur den Vertrag und den Code kennt, muss danach bauen und Tests schreiben können. Eine Regel, die sich an einem Screenshot oder mit einem Test prüfen lässt, ist deshalb mehr wert als drei Adjektive.

## 2. Arbeitsweise in dieser Session

- **Modell.** Dieser Block ist für Claude Fable 5.2 geschrieben. Läufst du als anderes Modell, sag es in der ersten Zeile deiner ersten Antwort.
- **Subagenten.** Nur für reine Such- und Leseläufe über viele Dateien, und nur auf Sonnet. Jede Bewertung und jede Formulierung im Vertrag machst du selbst.
- **Was du anfassen darfst.** Du schreibst nur unter `docs/` und in `HANDOVER.md`. Nichts unter `src/`, `public/`, `tools/` oder `scripts/` ändert sich in diesem Block. `npm ci`, der Dev-Server, ein Build und Screenshots sind erlaubt, soweit du sie für die Mockups brauchst.
- **Branch.** Du committest und pushst auf `claude/momentum-wp3`. Dario erlaubt das ausdrücklich, auch wenn deiner Session ein anderer Arbeitsbranch zugeteilt wurde. Kein anderer Branch, kein Pull Request, kein Merge, kein Push auf den Default-Branch (er veröffentlicht die Live-App bei jedem Push), nichts im Repo `Momentum-preview`.
- **Sprache.** Der Chat und der Vertrag sind Deutsch in Schweizer Schreibweise (ss statt ß). Token- und Dateinamen bleiben englisch wie im Code. `docs/decisions.md`, `HANDOVER.md` und die Commit-Nachrichten bleiben englisch wie bisher.
- **Zu Ende arbeiten.** Halte nicht an, solange du noch Teile schuldest. Hindernisse (ein Werkzeug klemmt, ein Pfad fehlt) diagnostizierst und umgehst du. Angehalten wird am STOP 0 in Abschnitt 9.
- **Fremdes Material.** Die drei Referenzbilder gehören ihren Urhebern und kommen nie ins Repo, auch nicht als Ausschnitt in einem Mockup.

## 3. Was du zuerst liest

1. `HANDOVER.md`: den Block «WP3 Stage 6a» und «Open at STOP 6a». Der Stand dort ist älter als die Entscheide in Abschnitt 4; das ist kein Widerspruch, du trägst ihn nach.
2. `docs/wp3/review-2026-11.md`: den Nachtrag am Anfang, dann die Abschnitte A, C, E («Farben, Legende, Zustände») und J. Der Modellplan in H und der erste Arbeitstag in K sind überholt.
3. `docs/decisions.md`: das Inhaltsverzeichnis, dann D89, D123 und D145 bis D147, und was du über die Überschriften zu Farbe und Zugänglichkeit findest.
4. Den heutigen Stand der Gestaltung: `src/styles/tokens.css`, `src/styles/stage6-variant-b.css`, `src/styles/global.css`, `src/components/ui.css` (Karte und Sheet), `src/features/body/tokens.ts`, `src/features/gym/MuscleRows.tsx`, `Sparkline.tsx` und `muscleState.ts`.
5. Variante B, wie sie gebaut ist: die 13 Screenshots `docs/design/wp3/stage6a/wp3-stage6a-b-393-*.png`. Sieh sie dir an, nicht nur die Dateinamen.
6. Darios Referenzseite, falls du ein Artifact-Werkzeug hast: `https://claude.ai/artifact/EZ9tFk1GZrUR8bbUxHMByk`. Dort liegen `ref-a-muskelkarte.png`, `ref-b-human-atlas.png`, `ref-c-finance-dashboard.png`, das Vorher-nachher-Bild `koerper-stufe1-vergleich.jpg` und Darios ursprüngliches Briefing `momentum-fable-review-prompt.md` (lesenswert sind dort die Abschnitte 2, 3 und 9). Erreichst du die Seite nicht, sag das im STOP-Bericht und leite aus Beschreibungen keinen Bildvergleich ab.

## 4. Was entschieden ist

Das ist die vollständige Liste von Darios Entscheiden. Sie werden nicht neu verhandelt. Hältst du einen davon für falsch, schreib es mit Begründung in den STOP-Bericht und bau trotzdem nach dem Entscheid.

**A. Aussehen (STOP 6a, entschieden am 28.10.2026)**

1. Variante B, wie gebaut: Graphit und Neon-Violett für Gym, Glas nach der glass_kit-Vorlage mit einer 1,5 px breiten Verlaufskante, ein stärkerer Farbschleier in Mind, die Gym-Karte auf Heute hell.
2. In Block 6b wandert B in `tokens.css`. Variante A, der temporäre Selektor und der `@import` fallen weg.
3. In Bereiche färbt der ganze Screen um, wenn man zwischen Mind und Gym wechselt.
4. Die kleinste Beschriftung (`--text-tertiary`) erreicht 4,5:1 in beiden Welten.
5. Die Statusleiste bleibt bei `default` mit einer `theme-color` je Welt. Die Abnahme macht Dario auf dem iPhone.
6. In Stage 7 pausiert das Rendern, solange das Sheet den Körper verdeckt.
7. Die Planwahl und das Lauf-Sheet bleiben hell, wenn sie von Heute aus geöffnet werden.
8. `body-preview.webp` wird in 6b nicht neu erzeugt. Ob es mit dem überarbeiteten Körper neu erzeugt wird, entscheidet Dario am STOP von Block 7A; `HANDOVER.md` verlangt es bei jeder Modelländerung.

**B. Gym-Kennzahl (STOP 5a, entschieden am 28.10. und 11.11.2026)**

1. Die Kennzahl eines Übungstags ist der beste Arbeitssatz nach dem Stärke-Score: effektive Last × (1 + Wiederholungen ÷ 30). Der Mittelwert der Arbeitssätze vom 28.10. ist damit ersetzt.
2. Der Faktor ist eine bewusste, dokumentierte Ausnahme von «keine fremden Normen». Darios Begründung im Wortlaut: Er rechnet nur meine eigenen Sätze ineinander um und vergleicht mich mit niemandem.
3. Das Arbeitsvolumen pro Muskelgruppe und Woche (Summe Wiederholungen × Last der Arbeitssätze) erscheint als zweite, nicht gewertete Zahl im Muskel-Sheet.
4. Aufwärmsätze markiert Dario selbst, pro Satz: ein Fakt am Satz, Standard aus, änderbar überall, wo der Satz änderbar ist. Fehlt das Feld, gilt der Satz als Arbeitssatz. Keine automatische Erkennung.
5. Ein Übungstag nur mit Aufwärmsätzen ist «keine Daten», nie null. Aufwärmsätze eröffnen die Session und zählen für die Anwesenheit wie heute (D128). Drop- und Back-off-Sätze sind Arbeitssätze.
6. Die neue Kennzahl gilt als Era ab dem ersten Laden des Updates. Jeder Tag davor wird byte-identisch mit der alten Kennzahl (bester Satz, Wiederholungen × Last) nachgerechnet.
7. Über die Era-Grenze hinweg rechnet jeder bewertete Tag sein ganzes Fenster in der Kennzahl dieses Tages (Review, Abschnitt E, Risiko 2).
8. Die Reihenfolge der Sätze wird deterministisch.
9. Aus dem freigegebenen Review, zu bestätigen mit Zahlen am STOP von Block 5b: der Vergleich im Zeitraum über den Median der letzten und der ersten Übungstage (Review, Abschnitt E, «Empfohlene Messdefinition»).

**C. Körper und 3D (entschieden am 11.11.2026)**

1. Leitplanke: ein einfarbiges Modell in Weiss oder Schwarz, ohne Anatomiefarben, etwas anatomischer als heute, mit erkennbaren Muskelformen und sauberen Grenzen. Farbe kommt allein aus den Trainingsdaten.
2. Das Originalmodell (615'940 Dreiecke) ist nicht mehr auffindbar. In Block 7A kommen deshalb Stufe 1 (`refine-body.mjs`) sowie Licht, Material und Tone Mapping.
3. Daneben gibt es ein Proof-Gate mit BodyParts3D als weissem Muskelkörper: zuerst nur fünf Renderings, höchstens ein halber Tag, dann entscheidet Dario.
4. Die Hände gehören zur neutralen Zone. Die Unterarme bekommen dafür eine Treffertoleranz.
5. Bewegung am Körper: dynamisch, flüssig, organisch. Ein Tipp dreht den Körper nie; eine Auswahl in der Liste darf ihn drehen (STOP 3b).
6. Kein Blender bei Dario. 3D-Arbeit läuft nur als Skript in der Cloud-Session.
7. D89 («The body is a diagram, not an illustration») widerspricht dieser Richtung und wird durch den Vertrag ersetzt.

**D. Farbe und Muskelstatus (entschieden am 11.11.2026)**

1. Farbregeln: ein Toleranzband von ±2,5 %, mindestens drei Übungstage als Vergleichsbasis, «Gehalten» in einem neutralen Ton, die Zeiträume 30 und 90 Tage.
2. Die Farbe einer Muskelgruppe bleibt nur als kleiner Punkt in der Zeile.
3. Verlaufslinien sind neutral und tragen die Statusfarbe nur am Endpunkt.
4. Mint als zweite Gym-Farbe fällt weg.

**E. Reihenfolge, Repo, Arbeitsweise (entschieden am 11.11.2026)**

1. In der ersten Woche zählt die durchgehende Funktion mehr als das beste Modell.
2. Aus dem öffentlichen Repo verschwinden `momentumpreview 2.zip`, `.github/Claude I6 backup request` und die drei iPad-Screenshots unter `docs/design/muscle-map/qa/device/`, ohne die Git-Historie umzuschreiben. Eine Lizenzdatei für die App kommt dazu; welche, ist noch offen. `.github/fixtures/rc2-export.json` bleibt, es ist bewusst öffentlich. Das Aufräumen ist ein eigener Block, nicht dieser.
3. `bossService.ts:217` füllt `recordedScore` mit `score`. Das ist als eigenes Gate nach WP3 vorgemerkt und wird jetzt nicht angefasst.
4. Die ganze Umsetzung läuft auf Fable 5.2, Subagenten nur für reine Suchläufe auf Sonnet. Gearbeitet wird nur in Cloud-Sessions, je Block eine frische Session mit ihrem Prompt aus `docs/wp3/prompts/`.

## 5. Was noch offen ist

**Von Dario** (steht die Antwort in der Nachricht, mit der er diese Session startet, übernimm sie; sonst führ den Punkt im STOP-Bericht als offen):

- seine üblichen Wiederholungsbereiche, ob er Aufwärmsätze bisher erfasst hat, ob er Pyramiden, Drop-Sets oder Deload-Wochen macht (bekannt ist: Push/Pull/Legs mit Fokus Muskelaufbau, Schwerpunkt Oberkörper und Klimmzüge, daneben Laufen);
- iPhone-Modell und iOS-Version, und ob er einen Mac hat;
- die Lizenz für die App.

**Gestaltungsfragen, zu denen der Vertrag einen Vorschlag machen muss.** Die Entscheide lassen sie offen, und Block 6b kann ohne Antwort nicht bauen:

1. **Was ersetzt Mint?** Heute kennzeichnet Mint den Bereich Gym an rund 40 Stellen in 16 Dateien (`--mint-*`, `--domain-gym-*`, `--domain-sports-*`): Balken auf Heute und Rang, die Muskelgruppen-Karte in der Gym-Übersicht, «Satz hinzufügen», der Rating-Balken, das Label «Gym» auf Heute. Violett kann Mint auf den hellen, geteilten Screens nicht einfach ersetzen, weil Mind dort Lila trägt. Mach ein Inventar aller Stellen und schlag je Stelle vor, was dort künftig steht.
2. **Statusfarben auf Graphit.** Die vier Füllfarben sind heute in beiden Welten gleich und per Test festgehalten (D123). Der Review hält sie auf dunklem Grund für zu grell. Zeig beide Fassungen nebeneinander und nenn die Folge einer Änderung: D123 wird ergänzt, die Regel in `CLAUDE.md` («the same four fills in both worlds») und eine Regel in `contrast.test.ts` ändern sich, und `statusPalette.ts` muss dem 3D-Körper die Gym-Werte geben. Ohne Darios Zustimmung bleiben die Farben, wie sie sind.
3. **Der neutrale Ton für «Gehalten»** am Körper, im Chip und in der Zeile.
4. **Der Weg zum Körper.** Vorschlag des Reviews: Die Gym-Kachel auf Heute führt direkt zum Muskelgruppen-Screen. Das würde Block 7B umsetzen.
5. **Die Körperbühne.** Mindestens 55 % der Bildschirmhöhe, kein Kartenrahmen, eine Bodenellipse. Das Mockup zeigt, ob es trägt.
6. **Die Höhe des Muskel-Sheets.** Dario hat rund 80 % genannt; der Review meint, bei 65 bis 70 % bleibe vom Körper genug sichtbar, um als Kontext zu dienen. Bau das Mockup in der Höhe, die du empfiehlst, und begründ sie.

Mehr als diese sechs Fragen stellst du am STOP nicht. Was du durch Lesen des Repos klären kannst, klärst du selbst.

## 6. Was du lieferst

### 6.1 Die Entscheide im Repo

Trag jeden Entscheid aus Abschnitt 4 in `docs/decisions.md` ein, ab D148, in der Form und Sprache der bestehenden Einträge, mit Datum und dem Vermerk, dass der Eigentümer entschieden hat. Fass zusammen, was zusammengehört; ein Eintrag pro Buchstabengruppe ist zu grob, einer pro Zeile zu fein. Bei Entscheiden, die erst ein späterer Block baut, steht der Block dabei.

Ältere Einträge schreibst du nicht um. Wo ein neuer Eintrag einen alten ablöst oder ergänzt, bekommt der alte eine Statusnotiz, wie D94 und D96 sie schon tragen. Das betrifft mindestens D84 (bester Satz), D89 (Körper als Diagramm) und D123 (Muskelfarben und, falls Dario zustimmt, die Statusfarben auf Dunkel).

In `HANDOVER.md` trägst du nach: STOP 6a und STOP 5a sind entschieden, mit Verweis auf die neuen Einträge; die Reihenfolge der Blöcke; der Verweis «D1–D144» stimmt wieder; das vorgemerkte Gate zu `bossService.ts:217` steht bei den offenen Punkten mit Datei und Zeile. Den übrigen Text lässt du stehen; das Aufräumen der veralteten Stellen ist ein eigener Block.

### 6.2 Der Vertrag

`docs/wp3/vertrag.md`, Deutsch. In der ersten Zeile unter dem Titel steht der Stand: «Entwurf zur Abnahme am STOP 0». Jede Regel trägt eine von zwei Marken: **festgelegt** (mit der Nummer des Entscheids) oder **Vorschlag** (wird am STOP 0 bestätigt). Richtwert für die Länge: 2'000 bis 3'000 Wörter plus Tabellen.

Halte dich an diese Gliederung und Nummerierung. Der Prompt für Block 6b verweist auf die Paragrafen.

- **§1 Leitbild und Geltung.** Das Leitbild in einem Absatz: ein heller, einfarbiger Körper auf Graphit, der nur dort Farbe trägt, wo Daten etwas sagen; darum eine Zahlenwelt mit festen Ziffernbreiten und einem Akzent. Dazu, was der Vertrag ersetzt (D89, Teile von D123 und der Muskelkarten-Übergabe) und was über ihm steht (`CLAUDE.md` und die Regeln der Wertung).
- **§2 Farbe.** Die drei Aufgaben der Farbe: Akzent heisst bedienbar, die Statusskala heisst Datenlage, alles andere ist neutral. Dann die endgültigen Token-Werte beider Welten als Tabelle, übernommen aus Variante B; die Statusskala hell und dunkel (Frage 2); der Muskelpunkt mit Grösse und Ort, und wo die zehn Farben künftig als Tokens wohnen; das Inventar zu Mint (Frage 1); die Ausnahmen, also das Rang-Abzeichen als festgelegte Grafik (D48) und seine dunkle Bühne (D16); die Regeln für Glas, einschliesslich wo es verboten ist (D146).
- **§3 Schrift und Zahlen.** Die bestehende Schriftskala, neue Stufen für Zahlen, feste Ziffernbreiten, die Einheit kleiner und gedämpft, das Vorzeichen immer, der Vergleichszeitraum immer neben einer Veränderung. Kein Text unter 11 px (heute hat die Tab-Leiste 10 px). Die neuen Werte für `--text-tertiary` in beiden Welten, ausgerechnet gegen Karte und Grund.
- **§4 Abstand, Dichte, Flächen.** Zeilenhöhe, Innenabstand der Karte, ein Seitenrand für alle Screens, Radien, eine Karte pro Thema, keine Karte in einer Karte, die Form einer Kennzahlenleiste.
- **§5 Bedienelemente.** Eine Rangfolge der Schaltflächen: eine primäre je Screen im Akzent, eine ruhige zweite Stufe, Text. Eine zerstörende Aktion ist nie das auffälligste Element. Dazu Segmente, Eingabefelder der Satzzeile, Tab-Leiste, Chips.
- **§6 Diagramme.** Linie, Balken, Nulllinie, beschrifteter Endwert, Endpunkt in Statusfarbe, die Frage der Skala bei den Verlaufslinien (heute skaliert jede Zeile für sich), leere Daten und ein einzelner Punkt.
- **§7 Muskelstatus.** Die fünf Zustände als Tabelle: Regel, Wort auf Deutsch und Englisch, Darstellung am Körper, in der Zeile, im Chip, im Sheet und in der Legende. Die Schwellen aus Abschnitt 4 (Gruppe D, Punkt 1), die Farbstärke zwischen 2,5 % und 12 %, der Legendensatz, die Regel für «uneinheitlich». Das Wort «Leistungstrend»; nie «gewachsen». Der Muskeltrend bekommt 30 und 90 Tage; `TREND_RANGES` teilt er sich heute mit dem Verlauf, der 7 und 30 behält.
- **§8 Körperbühne.** Das Zielbild für die Blöcke 7A und 7B in Worten: Grösse und Rahmen, Material und Licht, farbtreue Statusfarben, Bodenellipse, Zoom mit Grenzen, Ansichtstasten und Zurücksetzen, Tippen und Drehen, die neutralen Hände.
- **§9 Muskel-Sheet.** Das Zielbild für Block 7C: Höhe (Frage 6), Reihenfolge des Inhalts, was über und was unter der Falz liegt, das Arbeitsvolumen als nicht gewertete Zahl, der Weg zurück.
- **§10 Bewegung.** Dauern und Kurve als Tokens, Bewegung nach Zeit statt nach Bildern, Verhalten bei reduzierter Bewegung.
- **§11 Laden, leer, Fehler.** Wie ein Screen aussieht, bevor Daten da sind, ohne dass das Layout springt.
- **§12 Barrierefreiheit.** Kontrast, Mindestgrösse, 44 px Trefferfläche, Farbe nie als einziger Träger, der Weg für VoiceOver über die Zeilen, reduzierte Bewegung und reduzierte Transparenz.
- **§13 Wörter.** Eine Liste der neuen und geänderten Begriffe, Deutsch und Englisch. Keine technischen Wörter in der Oberfläche (`CLAUDE.md`).
- **§14 Was Tests durchsetzen.** Eine Tabelle: Regel, womit sie geprüft wird, welcher Block die Prüfung baut.
- **§15 Zuordnung.** Welcher Block welchen Paragrafen umsetzt: 6b, Farbregeln, 5b, 7A, 7B, 7C, 9.

Der Vertrag ändert keine Wertungsregel. Wo er eine berührt (§7 und die Golden-Datei mit dem Anzeigezustand; die Kennzahl aus Abschnitt 4, Gruppe B), nennt er nur, was der zuständige Block beachten muss.

### 6.3 Die Mockups

Drei statische HTML-Seiten unter `docs/wp3/mockups/`, jede für sich lauffähig, mit den Token-Werten aus dem Vertrag. Dazu Screenshots bei 393 × 852 und 320 × 693 als PNG im selben Ordner.

1. **Muskelgruppen**, Gym-Welt, in zwei Zuständen: mit gemischter Datenlage (verbessert, gehalten, Rückgang, zu wenig Vergleichsdaten, noch nicht trainiert) und beim ersten Öffnen ohne Daten.
2. **Muskel-Sheet** über dem Körper, in zwei Zuständen: eine Gruppe mit Messwerten und eine mit zu wenig Vergleichsdaten.
3. **Bausteinblatt**, beide Welten nebeneinander: Schaltflächen, Chips, Zahlstufen, eine Zeile, eine Kennzahlenleiste, eine Verlaufslinie, ein Balkendiagramm, die Statusskala in beiden Fassungen aus Frage 2, die Stellen aus dem Mint-Inventar vorher und nachher.

Für den Körper nimmst du das heutige Modell: am besten ein Standbild aus der Entwicklerseite `#/dev/body` mit der Zustandsmischung des Mockups, sonst das vorhandene `src/features/gym/assets/body-preview.webp`. Schreib ins Mockup, dass Modell und Licht aus Block 7A noch fehlen. Mehr als eine Stunde ist das Standbild nicht wert.

Für die Screenshots gibt es in der Cloud-Session ein vorinstalliertes Chromium unter `/opt/pw-browsers/chromium`. Installiere keinen Browser. Die Skripte unter `scripts/verify/` zeigen auf einen Pfad, den es nicht mehr gibt (`/opt/pw-browsers/chromium-1194/…`); das repariert Block 6b, du fasst sie nicht an.

Hast du ein Artifact-Werkzeug, veröffentlich die Mockups zusätzlich als private Seite, damit Dario sie auf dem iPhone ansehen kann, und gib ihm den Link im STOP-Bericht.

Die Mockups sind Belege für den Vertrag, kein Produktcode. Wenn sie mehr als die Hälfte deiner Zeit fressen, vereinfach sie.

## 7. Was nicht dazugehört

- Produktcode, Tokens, Tests, Prüfskripte.
- Das Aufräumen der Altdateien und der veralteten Dokumente.
- Der Körper selbst: Modell, Licht, BodyParts3D.
- Die Prompts für die folgenden Blöcke.

## 8. Woran du erkennst, dass du fertig bist

- Jeder Entscheid aus Abschnitt 4 ist in `docs/decisions.md` auffindbar; D84, D89 und D123 tragen eine Statusnotiz; `HANDOVER.md` nennt STOP 6a und 5a als entschieden.
- Der Vertrag hat alle fünfzehn Paragrafen, und jede Regel ist als festgelegt oder als Vorschlag markiert.
- §2 enthält die vollständige Token-Tabelle und das Mint-Inventar mit einem Vorschlag je Stelle.
- §7 enthält die Zustandstabelle mit Wörtern in beiden Sprachen.
- §14 nennt zu jeder prüfbaren Regel die Prüfung und den Block.
- Die drei Mockups liegen als HTML und als Screenshots in zwei Breiten vor. Du hast jeden Screenshot selbst angesehen, und die Mockups halten die Regeln des Vertrags ein (Kontrast, Mindestgrösse, kein seitliches Überlaufen bei 320 px).
- `git status` ist sauber, alles ist auf `claude/momentum-wp3` gepusht, unter `src/` hat sich nichts geändert, und `npm run test` endet weiterhin mit Exit 0.

## 9. STOP 0

Schreib Dario einen Bericht auf Deutsch, den er auf dem Telefon lesen kann:

1. In zwei, drei Sätzen: was vorliegt.
2. Wo es liegt: die Pfade und, falls vorhanden, der Link zur Mockup-Seite.
3. Was festgelegt ist und was Vorschlag ist, je eine kurze Liste.
4. Die Fragen aus Abschnitt 5, höchstens sechs, jede mit zwei oder drei Optionen, deiner Empfehlung und der Folge.
5. Was von Dario noch fehlt.
6. Der Stand in git: Branch, letzter Commit, sauber.

Dann wartest du. Nimmt Dario in derselben Session ab, arbeitest du seine Antworten ein, setzt den Stand im Vertrag auf «freigegeben am …», ergänzt die Entscheide in `docs/decisions.md`, committest und pushst. Danach ist dieser Block zu Ende. Block 6b startet Dario in einer neuen Session mit `docs/wp3/prompts/prompt-6b-designsystem.md`.
