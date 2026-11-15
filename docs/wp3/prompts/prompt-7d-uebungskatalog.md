# Prompt 7D – Der Übungskatalog: mindestens zehn je Gruppe, und eine Stichwortsuche

Für eine frische Session mit dem Modell, das D159 festlegt. Die Session braucht zwei Repos: `Hnd7k02/Momentum-App` (Branch `claude/momentum-wp3`) und `Hnd7k02/Momentum-preview`.
Start: «Lies `docs/wp3/prompts/prompt-7d-uebungskatalog.md` und führe ihn aus.»
Geschrieben am 15.11.2026, vor den Blöcken 5b, 7B und 7C. Zeilennummern beziehen sich auf den Commit `16c520c`; drei Blöcke liegen dazwischen, und 5b hat `src/features/gym/GymSessionScreen.tsx` verändert. Nimm die Zeilen als Wegweiser zum Symbol, nicht als Adresse, und lies zuerst die Blöcke der Vorgänger in `HANDOVER.md`.

## 1. Worum es geht

Momentum ist eine lokale Web-App fürs iPhone. Wer im Gym-Bereich ein Training erfasst oder einen Trainingsplan zusammenstellt, wählt seine Übungen aus einem mitgelieferten Katalog oder legt eigene an.

Heute hat der Katalog 49 Übungen. Nur fünf davon sind Eigengewichtsübungen, und vier der zehn Muskelgruppen sind dünn besetzt: Quadrizeps 3, Bauch 3, Waden 2, Unterarme 2. Die Suche im Auswahl-Sheet findet eine Übung nur über ihren Namen. Wer «bauch» oder «maschine» tippt, findet nichts.

Dario, der Eigentümer, hat mit D171 entschieden: Der Katalog wird eine wirklich grosse Auswahl an Geräte-, Kabel- und Eigengewichtsübungen für alle zehn Gruppen, mindestens zehn je Gruppe. Dazu kommt eine Stichwortsuche über Name, Detail, Muskelgruppe, Bewegung und Gerät, im Training und beim Erstellen eines Plans.

Die wichtigsten Eigenschaften dieses Blocks:

- **Bestehende IDs bleiben unverändert.** Unter `ex_bench_press` liegen Sätze aus zwei Jahren. Keine der 49 Übungen ändert ID, Rollen, Belastungsart oder den englischen Namen ihres gespeicherten Eintrags.
- **Eine Zuordnung ist ein Produktentscheid.** Welche Gruppen eine neue Übung trifft und welche davon Hauptmuskel ist, bestimmt, wohin künftige Sätze zählen. Darum steht jede Zuordnung als Zeile in einem Test, und Dario sieht die ganze Liste am STOP, bevor sie in die Live-App kommt.
- **Nichts wird aus einem Namen geraten.** Bewegung, Gerät und Suchwörter stehen an jeder Übung geschrieben, wie ihre Muskeln.
- **Der Katalog bleibt Code.** Keine fremde Datenbank, keine Schnittstelle, keine Bilder, keine Anleitungen. An dem, was die App rechnet und wertet, ändert sich nichts.

## 2. Arbeitsweise in dieser Session

- **Modell.** Dieser Block ist für das Modell geschrieben, das D159 nennt. Läufst du als anderes Modell, sag es in der ersten Zeile deiner ersten Antwort.
- **Subagenten.** Nur für reine Such- und Leseläufe über viele Dateien, und nur auf Sonnet. Jede Zuordnung, jeden Namen und jede Änderung machst du selbst.
- **Branch.** Du committest und pushst auf `claude/momentum-wp3` im Repo `Momentum-App`. Dario erlaubt das ausdrücklich, auch wenn deiner Session ein anderer Arbeitsbranch zugeteilt wurde. Kein anderer Branch, kein Pull Request, kein Merge, kein Push auf den Default-Branch: Er veröffentlicht die Live-App bei jedem Push.
- **Eine Veröffentlichung.** Am Schluss, und nur dann, veröffentlichst du den Vorschau-Build im Repo `Momentum-preview` auf `main` (Abschnitt 6, Schritt 7). Auch das erlaubt Dario ausdrücklich.
- **Commits.** Kleine, benannte Commits im Stil der bestehenden Historie, englisch. Eine Golden-Datei oder ein Fingerabdruck wird in diesem Block nie neu eingefroren.
- **Keine fremden Daten.** Du lädst keine Übungsdatenbank herunter und übernimmst keine Liste, keine Beschreibung und kein Bild aus einer fremden Quelle. Namen und Zuordnungen schreibst du aus allgemeinem Trainingswissen, und jede Zuordnung begründest du dir selbst, bevor sie in den Test kommt.
- **Sprache.** Chat und STOP-Bericht auf Deutsch in Schweizer Schreibweise. `docs/decisions.md`, `HANDOVER.md`, `CLAUDE.md`, Code-Kommentare und Commit-Nachrichten englisch wie bisher.
- **Zu Ende arbeiten.** Halte nicht an, solange du noch Teile schuldest. Hindernisse diagnostizierst und umgehst du. Angehalten wird am STOP 7D in Abschnitt 9, oder vorher, wenn die Voraussetzung in Abschnitt 3 fehlt.

## 3. Voraussetzung

Abgenommen sind, laut `HANDOVER.md` oder Darios Startnachricht:

- **5b:** die Kennzahl ist der beste Arbeitssatz; die Satzzeile trägt die Markierung «Aufwärmsatz» und, bis zur ersten Markierung, einen Hinweis darunter (D175).
- **Kurve:** der Block, den Dario am STOP 5b zwischen 5b und 7B gesetzt hat (D175).
- **7B und 7C:** die Körperbühne und das Muskel-Sheet stehen.

Fehlt eines davon, bau nichts. Sag Dario, was fehlt, und halte an.

**Die Entscheide gehen diesem Prompt vor:** D171, D93 (die Zuordnung einer mitgelieferten Übung gehört dem Katalog), D87 und D92 (ein Satz trägt die Zuordnung, unter der er erfasst wurde; 70 % für die Hauptmuskeln, 30 % für die übrigen), D91 (die drei Belastungsarten) und jeder jüngere Eintrag in `docs/decisions.md`, dazu der Vertrag `docs/wp3/vertrag.md`. Wo sie diesem Prompt widersprechen, gelten sie; nenn den Widerspruch im STOP-Bericht.

## 4. Was du zuerst liest

1. `docs/decisions.md`: D171; dazu D87, D91, D92 und D93. In `HANDOVER.md` der Block «WP2-1 — exercise catalogue and training plans»: Seit dort ist der Katalog die Quelle der Anzeige für eine mitgelieferte Übung.
2. `src/core/gym/catalogue.ts` ganz, mit dem Kommentar am Kopf: Seine sechs Eigenschaften sind die Regeln dieses Blocks.
3. `src/core/gym/catalogue.test.ts` ganz: wie Rollen, Belastungsart und englischer Name der 49 Übungen festgehalten sind.
4. `src/core/gym/load.ts` und in `HANDOVER.md` «Gym performance», der Absatz zur effektiven Last: was `bodyweight` und `assisted` rechnen.
5. `CLAUDE.md`: «What this app does not do» und «Interface rules».
6. `docs/wp3/vertrag.md`: §3, §4 (Zeile), §5 (Bedienelemente), §11 (leer), §12 und §13.
7. `scripts/verify/README.md`: `wp3-sheets.mjs`, `wp3-stage1.mjs` (B11, B12), `wp2-1-shots.mjs`, `design-system.mjs`.
8. Den Code aus Abschnitt 5.

## 5. Ausgangslage im Code

**Der Katalog** (`src/core/gym/catalogue.ts`, 214 Zeilen)

- `CatalogueExercise` (Zeile 39): `id`, `names` und `detail` je Sprache, `muscles`, `primary`, `loadType?` (fehlt für den Normalfall `external`), `equipment?`, `deprecated?`.
- `Equipment` (61): `barbell`, `dumbbell`, `cable`, `machine`, `smith`, `bodyweight`. Der Wert ist heute reine Beschreibung; kein Screen zeigt ihn, und nichts sucht danach.
- `EXERCISE_CATALOGUE` (71): 49 Einträge. Nach Hauptmuskel gezählt: Rücken 11, Schultern 7, Brust 6, Trizeps 6, Bizeps 5, Beinbeuger und Gesäss 5, Quadrizeps 3, Rumpf 3, Waden 2, Unterarme 2. Kreuzheben hat zwei Hauptmuskeln und zählt für beide. Nach Belastungsart: 42 `external`, 5 `bodyweight` (Liegestütze, Klimmzüge, Dips, Plank, Hanging Leg Raises), 2 `assisted`. Nach Gerät: Kabel 14, Maschine 11, Kurzhantel 10, Langhantel 8, Eigengewicht 5, Smith 1.
- `catalogueRecords` (181) macht aus dem Katalog die Einträge, die beim ersten Öffnen von Gym in den Speicher geschrieben werden. Der gespeicherte Name ist der englische; er ist Anker und Rückfall und wird nie überschrieben. `ensureExerciseCatalogue` (`src/storage/services/gymService.ts:54`) schreibt nur fehlende IDs. So kommt eine neue Übung auf ein Gerät, das den Katalog schon hat.
- Eine Bewegung (drücken, ziehen, …) trägt kein Eintrag.

**Der Test** (`src/core/gym/catalogue.test.ts`, 220 Zeilen)

- Drei Tabellen halten ID, englischen Namen, Gruppen, Hauptmuskeln und Belastungsart fest: `ITERATION_2` (Zeile 28, 29 Einträge), `WP2_1` (61, 19 Einträge), `WP3` (84, die eine Übung aus Stage 1).
- «has 49 entries with unique ids» (99) zählt. Weitere Tests halten: jeder deutsche Name kommt genau einmal vor, kein «ß», keine leeren Texte, nur die zehn Gruppen, Hauptmuskeln sind Teil der Gruppen, nichts ist als veraltet markiert.

**Die Auswahl** (`src/features/gym/ExercisePicker.tsx`, 277 Zeilen)

- Ein Sheet mit einem Suchfeld und einer flachen, alphabetischen Liste. Dieselbe Komponente dient dem Training (`GymSessionScreen.tsx`, Zeile 1129) und dem Plan (`PlanEditor.tsx:226`).
- `offered` (72) nimmt jede Übung, die nicht als veraltet markiert ist, unter dem Namen, den der Nutzer sieht. `matches` (84) sucht den eingegebenen Text klein geschrieben als Teilstring im gezeigten und im gespeicherten Namen. «bench» findet deshalb Bankdrücken. Detail, Gruppe, Bewegung und Gerät durchsucht nichts.
- Eine Zeile zeigt den Namen und darunter Detail und Gruppen (`describeExercise` in `exerciseNames.ts`: Ein Detail, das die Gruppen schon sagen, entfällt).
- Eine eigene Übung nennt Name, Gruppen, Hauptmuskeln und Belastungsart; sie hat weder Detail noch Gerät.
- Texte: `gym.picker.*` in `src/i18n/de.ts` (ab Zeile 433) und `en.ts`; die Gruppen heissen `muscle.*` (364–373). Die Gruppe `core` heisst auf Deutsch «Rumpf».

**Prüfung**

- `scripts/verify/wp3-sheets.mjs` tippt Zeichen für Zeichen ins Suchfeld, im Training und im Plan, und prüft Wert und Fokus nach jedem Zeichen. Das muss grün bleiben.
- `npm run test` muss mit Exit 0 enden; der Typecheck ist `tsc -b`. Die Browser-Suites laufen gegen `npm run build` und `npx vite preview --port 4173`, die 3D-Suites einzeln. Rot ist nur die Offline-Prüfung in `release-proof.mjs` (Aufräum-Block, D163).

## 6. Die Arbeit, in dieser Reihenfolge

### Schritt 0 – Ausgangsmessung

`tsc -b`, `npm run test`, `npm run build`, jede Browser-Suite, die 3D-Suites einzeln. Notier die Fingerabdrücke aus `domainOutputs.test.ts`. Was vorher bestand, muss am Ende bestehen.

### Schritt 1 – Die Liste, bevor Code entsteht

Schreib `docs/design/wp3/stage7d-katalog.md` (englisch). Es enthält die ganze künftige Liste als Tabelle, nach Hauptmuskel geordnet: ID, Name deutsch, Name englisch, Detail, Gruppen, Hauptmuskeln, Gerät, Belastungsart, Bewegung, und ob der Eintrag neu ist. Dazu die Zählung je Gruppe, je Gerät und je Belastungsart, vorher und nachher.

Regeln für die Liste:

- **Mindestens zehn Übungen je Gruppe**, gezählt nach Hauptmuskel, für alle zehn Gruppen. Das ist die Untergrenze, nicht das Ziel: Gesucht ist eine wirklich grosse Auswahl. Wo eine Gruppe viele gängige Übungen hat, nimm sie auf.
- **Geräte, Kabel und Eigengewicht zuerst.** Jede Gruppe bekommt Übungen an der Maschine, am Kabel und mit dem eigenen Körpergewicht, soweit es sie für die Gruppe gibt. Freie Gewichte dürfen dazukommen.
- **Nur Übungen, die man in einem gewöhnlichen Studio oder zu Hause wirklich macht.** Keine Varianten, die sich nur im Griff um wenige Zentimeter unterscheiden, ausser sie sind als eigene Übung geläufig. Keine Füllzeilen, um auf zehn zu kommen.
- **IDs:** `ex_` und der englische Name in Kleinbuchstaben mit Unterstrichen. Eine ID ist ab der Freigabe für immer vergeben. Bis Dario die Liste abgenommen hat, darf sich eine neue ID noch ändern; sag das im Bericht.
- **Namen:** deutsch in Schweizer Schreibweise, wie die bestehenden (geläufige englische Namen bleiben englisch: «Hip Thrust», «Face Pulls»). Jeder deutsche Name kommt genau einmal vor. Der englische Name ist der Name des gespeicherten Eintrags.
- **Detail:** was die Übung anatomisch trifft, als kurze Bezeichnung in beiden Sprachen, wie bei den bestehenden.
- **Rollen:** jede Gruppe, die die Übung trifft, und welche davon Hauptmuskel ist. Hauptmuskeln teilen sich 70 %, die übrigen 30 % (D92). Halt dich an die Linie der bestehenden Einträge: Bankdrücken ist Brust mit Trizeps und Schultern, Latzug ist Rücken mit Bizeps. Zwei Hauptmuskeln nur dort, wo beide der Zweck der Übung sind, wie beim Kreuzheben.
- **Belastungsart:** `external`, `bodyweight` oder `assisted`, nichts Neues. `bodyweight` rechnet das ganze Körpergewicht plus Zusatzgewicht, auch dort, wo nur ein Teil davon bewegt wird. Das ist die bestehende Regel für Liegestütze und bleibt; ein Anteil je Übung wäre eine Tabelle aus fremden Daten.
- **Gerät:** Jede neue Übung trägt eines. Reicht die heutige Liste nicht, erweiterst du `Equipment` um genau die Werte, die du brauchst, jeder mit einem Suchwort in beiden Sprachen.
- **Übungen, die nur nach Zeit oder Strecke Sinn ergeben** (Halten, Tragen), passen nicht in «Wiederholungen × Last». Zwei stehen schon im Katalog (Plank, Farmer's Walk). Nimm neue nur auf, wenn sie sich ehrlich in Wiederholungen erfassen lassen, und führ die übrigen im Bericht als offene Frage auf. Eine neue Messart entsteht in diesem Block nicht.

Lies die Liste danach einmal als Gegner: Welche Zuordnung würde ein erfahrener Trainierender bestreiten? Welche zwei Einträge sind in Wahrheit dieselbe Übung? Erst dann baust du.

### Schritt 2 – Der Katalog

- Trag die neuen Einträge in `EXERCISE_CATALOGUE` ein, unter ihrer Gruppe. Kein bestehender Eintrag ändert sich, ausser dass er die neuen Felder für Bewegung und, wo es fehlt, Gerät bekommt.
- **Bewegung als Feld.** Jeder Eintrag, alt und neu, nennt seine Bewegung aus einer festen, kleinen Liste: mindestens drücken, ziehen, rudern, beugen, strecken, heben. Ein Eintrag darf mehrere tragen: Rudern ist auch eine Zugübung, und «zieh» soll alle Zugübungen finden. Reichen die sechs Wörter nicht (Rumpf, Drehen, Halten), ergänz die Liste und begründ es. Das Feld ist Beschreibung wie `equipment`: Die Wertung liest es nie.
- **Die Rollen in den Test.** `catalogue.test.ts` bekommt eine vierte Tabelle für die neuen Einträge, in derselben Form wie die drei bestehenden: ID, englischer Name, Gruppen, Hauptmuskeln, Belastungsart. Die drei bestehenden Tabellen und ihre Tests bleiben, wie sie sind. Der Zähltest nennt die neue Zahl; dazu kommt ein Test, der für jede der zehn Gruppen mindestens zehn Einträge nach Hauptmuskel verlangt, und einer, der für jeden Eintrag Gerät und Bewegung verlangt.
- **Speicher.** Die neuen Einträge kommen über `ensureExerciseCatalogue` auf ein bestehendes Gerät, ohne dass ein vorhandener Eintrag angefasst wird. Ein Test belegt es: ein Speicher mit den 49 alten Einträgen, einer davon vom Nutzer umbenannt, danach sind die neuen da und die alten Byte für Byte gleich.
- `SCHEMA_VERSION` und `BACKUP_FORMAT_VERSION` bleiben, wie sie sind.

### Schritt 3 – Die Suche

Eine reine, getestete Funktion unter `src/core/gym/`, die die Auswahl aufruft. Sie rechnet nichts, was gewertet wird.

- **Worüber sie sucht:** den Namen in der gezeigten Sprache und den gespeicherten englischen Namen; das Detail; die Muskelgruppen der Übung mit Synonymen; die Bewegung; das Gerät; die Belastungsart «Eigengewicht».
- **Synonyme der Gruppen**, mindestens: Bauch, Rumpf, Core, Abs für `core`; Po, Gesäss für `hamstringsGlutes`; Beine für `quadriceps`, `hamstringsGlutes` und `calves`. Ergänz, was nahe liegt (Arme, Rücken, Schulter in der Einzahl, Oberschenkel, Unterarm), und die englischen Entsprechungen für die englische Oberfläche. Die Synonyme stehen an einer Stelle, je Sprache, und ein Test hält fest, dass jede Gruppe mindestens unter ihrem angezeigten Namen gefunden wird.
- **Wörter der Bewegung:** drücken, ziehen, rudern, beugen, strecken, heben, mit ihren englischen Entsprechungen.
- **Wörter des Geräts:** Maschine, Kabel, Kurzhantel, Langhantel, Eigengewicht, mit ihren englischen Entsprechungen, und eines für jeden weiteren Wert von `Equipment`.
- **Gross- und Kleinschreibung und Umlaute spielen keine Rolle.** «RÜCKEN», «rücken», «ruecken» und «rucken» finden dasselbe; «gesass» findet Gesäss.
- **Wortanfänge reichen.** «zieh» findet alle Zugübungen, «masch» alle Maschinenübungen. Mehrere Wörter grenzen ein: «kabel brust» findet die Brustübungen am Kabel.
- **Was die Suche heute findet, findet sie weiter:** einen Teil des Namens mitten im Wort («bench» findet Bankdrücken, «curl» findet Bizeps-Curls).
- **Eigene Übungen** des Nutzers werden über Name, Gruppen mit Synonymen und Belastungsart gefunden; Bewegung und Gerät haben sie nicht.
- **Die Reihenfolge der Treffer** entscheidest du und hältst sie fest: Ein Treffer im Namen steht vor einem Treffer über Gruppe oder Gerät; innerhalb davon alphabetisch.
- **Tests,** mindestens: «bauch», «ziehen», «maschine» und «eigengewicht» finden je genau die Übungen, die es sein sollen, und der Test nennt sie; «zieh» findet dieselben wie «ziehen»; Gross- und Kleinschreibung; die Umlaute in allen vier Schreibweisen; zwei Wörter; ein Wort ohne Treffer; eine eigene Übung; die englische Oberfläche mit «abs», «pull», «machine» und «bodyweight».

### Schritt 4 – Die Auswahl im Training und im Plan

- `ExercisePicker` ruft die Suche auf. Im Training und im Plan ist es dieselbe Komponente und bleibt es.
- **Die lange Liste.** Ohne Suchtext stehen jetzt deutlich mehr als hundert Zeilen im Sheet. Entscheide klein, wie die Liste lesbar bleibt (Zwischentitel je Gruppe, oder die alphabetische Liste wie heute), und zeig es am STOP. Kein neuer Screen, keine Filterleiste mit eigener Logik neben der Suche.
- **Warum eine Zeile gefunden wurde, muss man sehen.** Wer «maschine» tippt und eine Zeile ohne das Wort sieht, hält die Suche für kaputt. Die zweite Zeile nennt deshalb auch das Gerät. Sie bricht bei 320 px sauber um und wiederholt nichts (`describeExercise`).
- **Das Suchfeld** sagt, was man suchen kann, in Alltagssprache und ohne technisches Wort. Der leere Zustand (Vertrag §11) sagt, dass nichts gefunden wurde, und bietet die eine Aktion an, die es schon gibt: «Eigene Übung».
- Trefferflächen 44 px, kein Text unter 11 px, kein seitliches Überlaufen bei 320, 360, 393 und 430 px, in beiden Welten: Das Sheet folgt dem Screen, der es öffnet.
- Wörter in beiden Sprachen; Deutsch ist die Quelle (`src/i18n/catalogue.test.ts` hält die Platzhalter).

### Schritt 5 – Prüfungen

- `wp3-sheets.mjs` bleibt unverändert grün.
- Eine Browser-Suite für diesen Block, auf einem festen Tag: Im Training und im Plan findet «bauch» die Rumpfübungen, «zieh» die Zugübungen, «maschine» und «eigengewicht» ihre Übungen; eine gefundene Übung lässt sich wählen und landet im Workout und im Plan; «Eigene Übung» geht weiter; die Liste ohne Suchtext zeigt jede angebotene Übung genau einmal.
- `design-system.mjs` nimmt das Sheet mit einer Suche und mit dem leeren Zustand auf.
- Jede Prüfung, die die Zahl 49 oder eine feste Reihenfolge der Liste kennt, passt du an und nennst sie im Bericht mit alter und neuer Regel.

### Schritt 6 – Durchsicht

Screenshots unter `docs/design/wp3/stage7d/` bei 320, 360, 393 und 430 px: die Auswahl ohne Suchtext, mit «bauch», mit «zieh», mit «maschine», mit «eigengewicht», ohne Treffer, einmal auf Englisch, einmal aus dem Plan. Sieh dir jeden an. Führ eine Liste: behoben, oder bewusst so mit Grund.

### Schritt 7 – Schlussprüfung und Vorschau

1. `tsc -b`, `npm run test` (Exit-Code), `npm run build`, alle Browser-Suites, die 3D-Suites einzeln. Vergleich mit Schritt 0.
2. `git diff <Commit vor diesem Block> -- .github/fixtures` ist leer, und die Fingerabdrücke in `domainOutputs.test.ts` sind unverändert.
3. Dokumente: `HANDOVER.md` (ein Stage-Block; die Zeile zum Katalog unter «Files worth knowing» nennt noch 29 Übungen), `CLAUDE.md` («no exercise database» so gefasst, dass der Satz sagt, was gilt: ein mitgelieferter Katalog als Code, keine fremde Datenbank, keine Schnittstelle, keine Bilder, keine Anleitungen), `docs/decisions.md` (ein neuer Eintrag für das, was du entschieden hast, mit der Zählung je Gruppe), `scripts/verify/README.md`.
4. Veröffentlich den Build in `Momentum-preview` nach dessen `README.md`; die Statusleiste bleibt `default`. Warte auf den Workflow und öffne die Seite, soweit deine Netzwerkregeln es zulassen.

## 7. Was sich nicht ändern darf, und was nicht hierher gehört

**Unverändert bleiben:**

- die 49 bestehenden Übungen: ID, Gruppen, Hauptmuskeln, Belastungsart, englischer Name, deutscher Name und Detail;
- jeder gespeicherte Eintrag auf einem bestehenden Gerät, auch ein vom Nutzer umbenannter;
- alles, was wertet oder speichert: jedes Rating, der Boss, `src/core/scoring/`, die Kennzahl, das Datenschema, das Backup-Format, jede Golden-Datei und jeder Fingerabdruck;
- die drei Belastungsarten und was sie rechnen (D91);
- eigene Übungen des Nutzers und wie man sie anlegt;
- das Verhalten des Sheets beim Tippen und mit Tastatur.

Es gibt keine Übungsbilder, keine Anleitungen, keine Vorschläge («Leute trainieren auch»), keine Favoriten, keine zuletzt benutzten Übungen und keinen Abgleich mit einer fremden Quelle. Kein Test wird gelöscht oder abgeschwächt; die Tabellen der bestehenden Rollen bleiben Zeile für Zeile.

**Eigene Blöcke, nicht dieser:**

- kg oder lb je Übung (Backlog aus STOP 6b, D163);
- eine Messart nach Zeit oder Strecke;
- WebKit-Lauf, VoiceOver auf dem Gerät, die Freigabe (9);
- die Altdateien, die Lizenzdatei, die veralteten Dokumente (Aufräumen).

## 8. Abnahmekriterien

- Jede der zehn Gruppen hat mindestens zehn Übungen nach Hauptmuskel; ein Test hält es fest.
- Die 49 bestehenden Einträge sind unverändert; die drei bestehenden Tabellen im Test bestehen ohne Änderung.
- Jede neue Übung hat Name deutsch und englisch, Detail, Rollen, Gerät und Belastungsart; ihre Rollen stehen in `catalogue.test.ts`.
- Die Suche findet über Name, Detail, Gruppe mit Synonymen, Bewegung und Gerät, ohne Rücksicht auf Gross- und Kleinschreibung und Umlaute, und Wortanfänge reichen; die Tests für «bauch», «ziehen», «maschine» und «eigengewicht» bestehen.
- Die Suche steht im Training und beim Erstellen eines Plans.
- Ein bestehendes Gerät bekommt die neuen Übungen, ohne dass ein vorhandener Eintrag sich ändert.
- `git diff -- .github/fixtures` ist leer; `wp3-sheets.mjs` ist unverändert grün; `tsc -b` ist sauber, `npm run test` endet mit Exit 0, der Build läuft, jede Suite aus Schritt 0 besteht.
- Die ganze Übungsliste steht auf der STOP-Seite, und der Vorschau-Build ist erreichbar.

## 9. STOP 7D

Schreib Dario einen Bericht auf Deutsch, den er auf dem Telefon lesen kann. Die Liste braucht Platz: Leg den Bericht als Seite an, wie die STOP-Seiten der Blöcke davor.

1. In drei Sätzen: was sich geändert hat.
2. **Die Übungsliste**, vollständig, nach Muskelgruppe geordnet: Name deutsch und englisch, Detail, Hauptmuskel und weitere Gruppen, Gerät, Belastungsart. Neue Übungen sind als neu markiert. Darüber die Zählung je Gruppe, je Gerät und je Belastungsart, vorher und nachher.
3. Die Zuordnungen, bei denen du gezögert hast, jede mit der Alternative.
4. Die Suche: was sie findet, an den vier Wörtern «bauch», «ziehen», «maschine» und «eigengewicht», mit je einem Bild; die Synonyme als Liste.
5. Die Zahlen: Tests, Suites gegen die Ausgangsmessung.
6. Eigene kleine Entscheidungen, jede mit Grund; darunter die Reihenfolge der Treffer, die Gliederung der langen Liste und jede Erweiterung von Gerät oder Bewegung.
7. Jede umgeschriebene Prüfung mit alter und neuer Regel.
8. Was du gesehen und für Block 9 oder das Aufräumen liegen gelassen hast; darunter die Übungen nach Zeit oder Strecke.
9. Die Adresse der Vorschau und die Prüfliste fürs iPhone.
10. Höchstens fünf Fragen, jede mit Optionen und deiner Empfehlung. Eine steht fest: Stimmt die Liste, oder was soll hinein, hinaus oder anders zugeordnet werden?
11. Der Stand in git für beide Repos.

**Prüfliste fürs iPhone** (übernimm sie und pass sie an; höchstens zehn Punkte):

1. Ein Training öffnen und «Übung hinzufügen» tippen: Die Liste ist lang, bleibt aber lesbar, und das Suchfeld sagt, was du suchen kannst.
2. «bauch» tippen: Es erscheinen die Bauch- und Rumpfübungen, und keine andere. Dasselbe mit «core» und «abs».
3. «zieh» tippen: Es erscheinen alle Zugübungen, auch Rudern und Klimmzüge.
4. «maschine», «kabel» und «eigengewicht» tippen: In jeder Zeile steht, warum sie gefunden wurde.
5. «RÜCKEN», «ruecken» und «rucken» finden dasselbe.
6. «kabel brust» grenzt auf die Brustübungen am Kabel ein. Ein Wort ohne Treffer zeigt einen Satz und «Eigene Übung».
7. Für jede der zehn Gruppen findest du mindestens zehn Übungen. Nenn zwei Übungen, die du machst und die fehlen.
8. Eine neue Eigengewichtsübung wählen und einen Satz erfassen: Sie verlangt dein Körpergewicht, wie Klimmzüge es tun, und zählt für die Gruppen, die in der Liste stehen.
9. Bereiche › Gym › Trainingspläne, einen Plan anlegen: Dieselbe Suche, dieselben Treffer.
10. Deine bisherigen Übungen und Pläne sind unverändert: dieselben Namen, dieselbe Historie im Übungsdetail.

Dann wartest du auf Darios Abnahme. Was er an der Liste ändert, baust du in derselben Session und veröffentlichst die Vorschau neu. Der nächste Block startet in einer neuen Session mit `docs/wp3/prompts/prompt-9-haertung.md`.
