# Momentum – Vertrag über Aussehen, Zustände und Wörter

Stand: freigegeben am 11.11.2026 (STOP 0).

Dieser Vertrag legt fest, wie Momentum aussieht und spricht. Die folgenden Blöcke bauen danach, und Tests setzen ihn durch.

Alle Regeln sind **festgelegt**: Dario hat sie entschieden oder am STOP 0 angenommen. Die Nummern verweisen auf `docs/decisions.md`; wo keine steht, gilt D160.

Belege sind die drei Mockups unter `docs/wp3/mockups/` (Screenshots in `bilder/`, je 393 und 320 px breit).

## §1 Leitbild und Geltung

**Leitbild** (festgelegt, D154, D155). Ein heller, einfarbiger Körper auf Graphit, der nur dort Farbe trägt, wo die Trainingsdaten etwas sagen. Darum herum eine Zahlenwelt mit festen Ziffernbreiten und einem Akzent. Mind bleibt hell und ruhig, Gym dunkel; beide benutzen dieselben Bausteine.

**Geltung.** Der Vertrag gilt für jeden Screen. Er ersetzt D89 («The body is a diagram, not an illustration»), die Muskelfarben als Flächenfarbe aus D123 und die Farbangaben der Muskelkarten-Übergabe (`docs/design/muscle-map/`). Über ihm stehen `CLAUDE.md` und alle Regeln der Wertung: Der Vertrag ändert keine Zahl, die die App berechnet.

## §2 Farbe

### 2.1 Drei Aufgaben

Farbe hat genau drei Aufgaben (festgelegt, D154):

1. **Akzent heisst bedienbar.** Schaltflächen, Links, die gewählte Option, der aktive Reiter. Mind trägt Indigo, Gym Violett.
2. **Die Statusskala heisst Datenlage.** Grün und Rot bewerten eine Veränderung, Blau weist auf fehlende Vergleichsdaten hin.
3. **Alles andere ist neutral.** Text, Flächen, Linien, Balken.

Daraus folgt für Balken und Linien, die einen Wert zeigen (Rating, Wochenziel, Verlauf): Sie sind neutral und benutzen zwei neue Tokens, `--data-ink` für die Füllung und `--data-track` für die Spur (festgelegt, D160).

Eine Ausnahme hat Dario am STOP 0 ergänzt: Hat ein Wochenziel sein Ziel erreicht, trägt sein Balken die Statusfarbe «stark»; sonst ist er neutral (festgelegt, D160). In Gym ist das die Füllfarbe `--status-strong` (5,4:1 gegen die Spur). Auf Hell ist es ihre dunklere Fassung `--status-strong-ink` (4,8:1), weil die Füllfarbe gegen die helle Spur nur 2,1:1 erreicht und ein Balken 3:1 braucht. Daneben steht wie heute «Ziel erreicht» als Wort.

### 2.2 Die beiden Welten

Mind ist `:root`, Gym ist `[data-world="gym"]`. Die Werte sind die von Variante B, wie gebaut (festgelegt, D148). Ein Screen gehört zu einer Welt; in Bereiche färbt der ganze Screen um; die Gym-Karte auf Heute ist hell.

| Token | Mind (hell) | Gym (dunkel) | Anmerkung |
|---|---|---|---|
| `--surface-base` | `#f4f4f8` | `#0f0f14` |  |
| `--surface-tinted` | `#f7f6fb` | `#141419` |  |
| `--surface-elevated` | `#ffffff` | `#1a1a22` |  |
| `--surface-raised` | `#ffffff` | `#202029` |  |
| `--surface-secondary` | `#f1f1f5` | `#232330` |  |
| `--surface-input` | `#f2f2f7` | `#282836` |  |
| `--surface-selected` | `#ffffff` | `#383848` |  |
| `--separator` | `rgba(60, 60, 67, 0.09)` | `rgba(255, 255, 255, 0.09)` |  |
| `--separator-strong` | `rgba(60, 60, 67, 0.18)` | `rgba(255, 255, 255, 0.2)` |  |
| `--text-primary` | `#1c1c1e` | `#f5f4fa` |  |
| `--text-secondary` | `#5e5e68` | `#b0aec0` |  |
| `--text-tertiary` | `#64646f` | `#9896a6` | D149, D160 |
| `--text-on-accent` | `#ffffff` | `#0f0f14` |  |
| `--accent` | `#5e5ce6` | `#a39dff` |  |
| `--accent-pressed` | `#4a48cf` | `#9089ff` |  |
| `--accent-tint` | `#ecebfd` | `#2c2956` |  |
| `--accent-ink` | `#5654e5` | `#bcb7ff` |  |
| `--sky-fill` | `#62b4f7` | `#62c6ff` |  |
| `--sky-ink` | `#166db6` | `#93d6ff` |  |
| `--sky-tint` | `#e6f2fd` | `#14334c` |  |
| `--status-weak` | `#ff3b5c` | wie hell |  |
| `--status-mixed` | `#ffd600` | wie hell |  |
| `--status-good` | `#4cde24` | wie hell |  |
| `--status-strong` | `#00b85b` | wie hell |  |
| `--status-empty` | `#e6e6ec` | `#2e2e3a` | D160: Graphit statt Marineblau |
| `--status-weak-ink` | `#c8183a` | `#ff8296` |  |
| `--status-weak-on` | `var(--text-primary)` | `#1a0a10` |  |
| `--status-weak-tint` | `#ffe6ea` | `#4a1f2a` |  |
| `--status-mixed-ink` | `#7a6410` | `#ffe36b` |  |
| `--status-mixed-on` | `var(--text-primary)` | `#1a1600` |  |
| `--status-mixed-tint` | `#fff7cc` | `#46400f` |  |
| `--status-good-ink` | `#1f7a12` | `#8fef6f` |  |
| `--status-good-on` | `var(--text-primary)` | `#0d1a08` |  |
| `--status-good-tint` | `#e4f8dc` | `#1f4218` |  |
| `--status-strong-ink` | `#00734a` | `#4ae69e` |  |
| `--status-strong-on` | `var(--text-primary)` | `#06180f` |  |
| `--status-strong-tint` | `#dcf5e8` | `#124430` |  |
| `--status-empty-ink` | `var(--text-secondary)` | wie hell |  |
| `--status-empty-tint` | `var(--surface-secondary)` | wie hell |  |
| `--status-track` | `#f1f1f5` | `#2a2a36` | D160: Graphit statt Marineblau |
| `--glass-fill-strong` | `rgba(255, 255, 255, 0.78)` | `rgba(26, 26, 34, 0.86)` |  |
| `--glass-solid` | `#ffffff` | `#1a1a22` |  |
| `--glass-border` | `rgba(255, 255, 255, 0.95)` | `rgba(255, 255, 255, 0.14)` |  |
| `--glass-blur` | `15px` | wie hell |  |
| `--scrim` | `rgba(16, 24, 40, 0.28)` | `rgba(0, 0, 0, 0.55)` |  |
| `--status-bar` | `#f4f4f8` | `#0f0f14` |  |
| `--tab-bar-material` | `rgba(255, 255, 255, 0.82)` | `rgba(15, 15, 20, 0.78)` |  |
| `--toast-surface` | `#1c1c1e` | `#f3f4f8` |  |
| `--toast-text` | `#ffffff` | `#0b0e17` |  |
| `--toast-action` | `#b4b3ff` | `#4f47c8` |  |
| `--data-ink` (neu) | `#3a3a44` | `#e6e5ee` | D160, §2.1 |
| `--data-track` (neu) | `#e7e7ee` | `#2a2a36` | D160, §2.1 |

Nicht in der Tabelle, aber unverändert aus Variante B: die Schatten, der Verlauf der Glasfüllung in Gym (Weiss 12 % nach 4 %) und die Verlaufskante der Karte (1,5 px).

**Der Grund** (festgelegt, D160). Variante B malt in Gym drei Farbschleier: Violett oben links, Cyan rechts, Mint unten. Künftig bleibt nur der violette; Mint fällt mit D154 weg, und Cyan wäre sonst eine dritte Farbe ohne Aufgabe. In Mind bleiben der violette und der blaue Schleier, der mintfarbene und der pfirsichfarbene fallen weg.

**Reste aus Variante A.** Von den 85 Tokens des Gym-Blocks überschreibt B nur 34. Zwei der übrigen sind sichtbar marineblau statt graphit: `--status-empty` und `--status-track`. Die Tabelle setzt Graphitwerte.

### 2.3 Statusskala

Die vier Füllfarben bleiben in beiden Welten gleich, wie D123 und `CLAUDE.md` es festhalten (festgelegt, D160). Der Review hielt sie auf Graphit für zu grell. Gemessen stimmt das für Flächen, nicht für das, was in Gym tatsächlich damit gefüllt wird: Punkte, Endpunkte und der beleuchtete Körper. Als kleine Marke auf der Gym-Karte messen Grün 6,6:1 und Rot 5,0:1. Text und Chips benutzen schon heute eigene Werte je Welt (`-ink`, `-tint`). Eine gedämpfte Fassung stand am STOP 0 zur Wahl und wurde nicht gewählt.

Die Hinweisfarbe ist die Familie `--sky-*`. Sie behält ihren Namen.

### 2.4 Der Muskelpunkt

Die zehn Muskelfarben erscheinen nur noch als Punkt von 8 px vor dem Namen in der Zeile und im Kopf des Sheets (festgelegt, D154). Sie färben keine Linie, keinen Ring und keine Fläche. Der Punkt ist um 35 % zu seinem eigenen Grau gezogen (festgelegt, D160; heute 13 %), weil Terrakotta neben einer grünen Zahl und Petrol neben einer roten sonst wie ein Status lesen. Bei einer Gruppe ohne Training hat er 40 % Deckkraft.

Die zehn Werte ziehen aus `src/features/body/tokens.ts` nach `tokens.css` um (`--muscle-*`) und werden von dort gelesen, so wie die Statusfarben (festgelegt, D160).

### 2.5 Was Mint ersetzt

Mint verlässt Gym (festgelegt, D154). Im Code steht Mint an 41 Stellen in 17 Dateien. Die Tabelle fasst sie nach Aufgabe zusammen.

| Stelle | Heute | Künftig |
|---|---|---|
| Rating-Balken `.metric-bar--gym` (`metrics.css:207`) | Mint | `--data-ink` auf `--data-track` |
| Wochenbalken auf Heute `.week__segment` (`today.css:258`, `:264`) | Mint | `--data-ink` auf `--data-track`; ist das Ziel erreicht, die Statusfarbe «stark» (§2.1) |
| Fortschritt des laufenden Workouts (`runningWorkout.css:53`, `:61`) | Mint | `--data-ink` auf `--data-track` |
| Balken im Übungsdetail `.gym-detail__bar` (`gym.css:465`) | Mint | neutral, der letzte trägt den Status (§6) |
| «Satz hinzufügen» `.gym-exercise__add` (`gym.css:307`) | Mint-Fläche | zweite Stufe der Schaltflächen (§5) |
| Gewählter Muskelfilter `.gym-picker__muscle` (`gym.css:57`) | Mint | `--accent-tint` und `--accent-ink` |
| Gewählte Option und Zielwähler (`areas.css:202`, `sessionSheet.css:22`, `TargetPicker.tsx:19`, `AreasScreen.tsx:469`, `OnboardingFlow.tsx:62`) | Mint | Akzent der Welt |
| Karte «Muskelgruppen» `.gym-hub__muscles` (`gymHub.css:58`) | Mint als Fläche | gewöhnliche Karte |
| «Gesamt +30 %» `.gym-hub__musclesOverall` (`gymHub.css:138`) | Mint | Farbe des Zustands nach §7, bei «Gehalten» Textfarbe |
| Pfeil der Karte (`gymHub.css:152`) | Mint | `--text-tertiary` |
| Platzhalter der Begleitfigur (`runningWorkout.css:26`) | Mint, gestrichelt | `--separator-strong` auf `--surface-secondary` |
| Bereichsmarke (`areas.css:32`, `:143`, `onboarding.css:264`) | Mint-Fläche | `--surface-secondary` und `--text-secondary` |
| Zielwert und Anteil (`areas.css:77`, `bossWeights.css:82`) | Mint | `--text-primary` |
| Label «Gym» auf Heute (`stage6-variant-b.css:131`) | Mint | `--text-primary`, der Pfeil im Akzent |
| «alles beantwortet», «Ziel erreicht», «steigend», «gesichert», Aufstiegsmarke (`today.css:95`, `:274`, `progress.css:59`, `backup.css:15`, `rank.css:302`) | Mint als «gut» | `--status-strong-ink` auf `--status-strong-tint` |
| Gewähltes «Ja» (`answerControls.css:29`) | Mint-Fläche | `--status-strong` mit `--status-strong-on`, wie eine 9 oder 10 auf der Skala |

**Erweiterung** (festgelegt, D160). Ersetzt man nur Mint, bleibt die Frage, was Gym auf den hellen, geteilten Screens trägt. Violett geht nicht, weil Mind dort Lila hat und beide kaum zu unterscheiden wären. Deshalb haben Bereiche gar keine eigene Farbe mehr: Der Bereich steht als Wort da, die Füllung ist neutral.

| Familie | Heute | Künftig |
|---|---|---|
| `--domain-*` (16 Tokens) | Lila für Mind, Mint für Gym, Blau für Laufen | entfallen; Balken neutral, Marken neutral |
| `--lilac-*` | Auswahl in Mind, Abzeichen «Ja/Nein», Kategorie | Auswahl im Akzent; Abzeichen und Kategorie neutral |
| `--rose-*` | zerstörende Aktion, Fehler, «fallend» | `--status-weak-ink` und `--status-weak-tint` |
| `--peach-*`, `--sand-*`, `--mint-*` | ohne Verwendung bzw. ersetzt | entfallen |
| `--sky-*` | «Skala»-Abzeichen, zu wenig Daten, Laufen | bleibt als Hinweisfarbe; das Abzeichen wird neutral |

### 2.6 Ausnahmen

- Das Rang-Abzeichen ist eine festgelegte Grafik (D48). Seine Farben bleiben in `RankBadge.tsx`.
- Die dunkle Bühne des Rangs (D16) und die Boss-Karte auf Heute bleiben dunkel, bekommen ihre Werte aber aus Tokens.
- Die Entwicklerseite `BodyDevPage.tsx` ist kein Produkt-Screen.

### 2.7 Glas

Karten und Sheets sind Glas, wie in Variante B gebaut: eine durchscheinende Füllung, 15 px Unschärfe, eine Verlaufskante von 1,5 px, ein Blur pro Karte (festgelegt, D146, D148). Die feste Fläche `--glass-solid` gilt, wo Unschärfe fehlt oder weniger Transparenz gewünscht ist. Über und unter dem 3D-Körper gibt es kein Glas, solange er sich bewegen kann; das Muskel-Sheet ist fest.

## §3 Schrift und Zahlen

- **Schriftskala** (festgelegt, wie gebaut): 34, 22, 17, 15, 13, 11 px. Die Systemschrift bleibt.
- **Kein Text unter 11 px** (festgelegt, D160). Heute haben die Tab-Leiste und eine Stelle im Muskelmodul 10 px.
- **Zahlstufen** (festgelegt, D160): `--type-figure-xl` 34 px für die eine Hauptzahl eines Screens, `--type-figure-l` 28 px für die Zahl im Kopf eines Sheets, `--type-figure-m` 20 px in der Kennzahlenleiste. In Zeilen steht die Zahl in 17 px halbfett.
- **Feste Ziffernbreiten** überall, wo Zahlen unter- oder nebeneinander stehen (`font-variant-numeric: tabular-nums`).
- **Einheit und Zusatz** («von 1000», «kg») stehen kleiner und in der zweiten Textstufe.
- **Eine Veränderung trägt immer ihr Vorzeichen** und steht nie ohne ihren Zeitraum («+9 %», darunter «letzte 30 Tage»).
- **Die kleinste Beschriftung erreicht 4,5:1** (festgelegt, D149). Die neuen Werte für `--text-tertiary`:

| Welt | Wert | auf der Karte | auf dem Grund | an der dunkelsten bzw. hellsten gemessenen Stelle |
|---|---|---|---|---|
| Mind | `#64646f` (heute `#a0a0a8`) | 5,84:1 | 5,33:1 | 4,69:1 |
| Gym | `#9896a6` (heute `#83818f`) | 5,97:1 | 6,60:1 | 5,97:1 |

Auf Hell liegen die zweite und die dritte Textstufe damit fast gleich (`#5e5e68` und `#64646f`). Die Rangfolge trägt dort künftig die Grösse, nicht die Helligkeit. Das ist die Folge des Entscheids, nicht ein Versehen.

## §4 Abstand, Dichte, Flächen

- **Ein Seitenrand** von 16 px auf jedem Screen (festgelegt, D160). Heute weicht der Session-Screen ab.
- **Karte:** Innenabstand 16 px (heute 18), Radius 22 px, eine Karte pro Thema. Keine Karte in einer Karte.
- **Zeile:** mindestens 54 px hoch (heute rund 61), bei zweizeiligem Namen mehr. Die Trefferfläche bleibt 44 px.
- **Kennzahlenleiste:** drei Zellen, getrennt durch eine feine Linie. Jede Zelle hat eine Beschriftung in 11 px, einen Wert in `--type-figure-m` und eine Zeile darunter für Zeitraum oder Zusatz. Die erste Zelle ist breiter (1,35 : 1 : 1), damit «Leistungstrend» bei 320 px passt.
- **Trennlinien** sind fein (`--separator`), nie eine zweite Fläche.

## §5 Bedienelemente

Eine Rangfolge, auf jedem Screen dieselbe (festgelegt, D160):

| Stufe | Aussehen | Beispiel |
|---|---|---|
| Primär, höchstens eine je Screen | `--accent` als Fläche, Text `--text-on-accent` | «Fertig», «Training erfassen» |
| Zweite Stufe | `--accent-tint` als Fläche, Text `--accent-ink` | «Übung hinzufügen», «Satz hinzufügen» |
| Text | `--accent-ink`, ohne Fläche | «Pläne verwalten» |
| Ruhig | `--text-secondary`, ohne Fläche | «Entfernen» |

- Eine zerstörende Aktion ist nie das auffälligste Element. «Entfernen» ist ruhig; die Sicherheit kommt vom Rückgängig, das es schon gibt. Wo eine Bestätigung nötig ist, trägt erst sie `--status-weak-ink`.
- **Segment:** Spur in `--surface-input`, die gewählte Seite in `--surface-selected` und halbfett. 32 px hoch mit 44 px Trefferfläche.
- **Chip:** 11 px halbfett, Fläche und Text aus der Statusfamilie; der neutrale Chip in `--surface-secondary`.
- **Tab-Leiste:** Beschriftung 11 px in `--text-tertiary`, der aktive Reiter in `--accent-ink`.
- **Satzzeile:** Die Eingabefelder benutzen `--surface-input` und die Zahlregeln aus §3.

## §6 Diagramme

- **Linie:** 1,5 px in `--data-ink`, runde Enden. Kein Flächenverlauf unter der Linie (festgelegt, D160; betrifft die Trendkurve im Verlauf).
- **Endpunkt:** ein Punkt mit 3 px Radius in der Statusfarbe des Zustands; bei «Gehalten» in `--data-ink`.
- **Nulllinie:** immer sichtbar, fein.
- **Verlaufslinie in der Zeile** (80 × 24 px, bei 320 px Breite 64 × 24): Alle Zeilen einer Liste teilen eine Skala von −12 % bis +12 %, die Nulllinie liegt in der Mitte (festgelegt, D160). Heute skaliert jede Zeile für sich, sodass +1 % so steil aussieht wie +60 %. Was über 12 % hinausgeht, bleibt am Rand stehen; die Zahl daneben nennt den Wert.
- **Diagramm im Sheet:** links zwei Beschriftungen («0 %» und «+12 %» oder «−12 %»), unten das erste und das letzte Datum, am Endpunkt der Wert.
- **Balken:** `--data-ink` mit 55 % Deckkraft, der letzte Balken in der Statusfarbe seiner Veränderung, links der kleinste und der grösste Wert, unten erstes und letztes Datum.
- **Ohne Messwert kein Diagramm.** Ein einzelner Messwert ist ein Punkt, keiner ist nichts. Das bleibt, wie es gebaut ist.
- Diagramme in Zeilen sind für Vorlesehilfen unsichtbar, weil die Zeile alles in Worten sagt; ein grosses Diagramm trägt eine Beschreibung.

## §7 Muskelstatus

Fünf Zustände (festgelegt, D153). Eine einzige Stelle im Code macht aus einer Zahl einen Zustand (`muscleState.ts`); Körper, Zeile, Chip, Sheet und Legende lesen dort.

| Zustand | Regel | Deutsch | Englisch | Am Körper | In der Zeile |
|---|---|---|---|---|---|
| verbessert | ab +3 % | Verbessert | Improved | grün getönt | Linie, Zahl in Grün, Wort |
| gehalten | −2 % bis +2 % | Gehalten | Held | Weiss, der Ton eines trainierten Muskels | Linie, Zahl in Textfarbe, Wort |
| zurückgegangen | ab −3 % | Zurückgegangen | Declined | rot getönt | Linie, Zahl in Rot, Wort |
| zu wenig Vergleichsdaten | weniger als drei Übungstage der Gruppe im Zeitraum, oder keine Übung mit zwei Tagen | Zu wenig Vergleichsdaten | Not enough to compare | leicht blau getönt | blauer Chip, keine Linie |
| noch nicht trainiert | kein Satz im Zeitraum | Noch nicht trainiert | Not trained yet | gedimmt | neutraler Chip, Punkt blass |

- **Das Band.** Der Zustand folgt der angezeigten ganzen Zahl, damit Zahl und Farbe nie auseinanderfallen. −2 bis +2 % ist gehalten; das entspricht dem Band von ±2,5 % bei kaufmännischer Rundung in beide Richtungen.
- **Die Farbstärke** am Körper wächst gleichmässig von 2,5 % bis 12 % und bleibt darüber gleich.
- **Zeiträume:** 30 und 90 Tage für den Muskeltrend. Der Verlauf behält 7 und 30 Tage; die beiden teilen sich heute die Konstante `TREND_RANGES` und brauchen künftig je eine.
- **Wörter:** «Leistungstrend», nie «Entwicklung» und nie «gewachsen». «Zu wenig Vergleichsdaten» ersetzt «Noch kein Vergleich».
- **Legendensatz** (hinter dem Knopf ⓘ): «Die Farbe zeigt, wie sich dein bester Arbeitssatz je Muskelgruppe im gewählten Zeitraum verändert hat. Sie misst Trainingsleistung, nicht Muskelmasse.»
- **Uneinheitlich:** Liegen die Übungen einer Gruppe mehr als zehn Prozentpunkte auseinander, steht im Sheet «uneinheitlich», und beide Übungen sind einzeln sichtbar (festgelegt, D160).
- **Kennzahl darüber:** Der Leistungstrend aller gewerteten Gruppen trägt denselben Zustand nach derselben Regel.

Diese Regeln baut der Block «Farbregeln», nicht 6b. Er muss wissen: Die Gym-Golden-Datei enthält den Anzeigezustand und wird dabei bewusst neu eingefroren; die Rundung in `muscleState.ts` rundet heute −2,5 auf −2.

## §8 Körperbühne

Zielbild für die Blöcke 7A und 7B.

- **Grösse und Rahmen** (festgelegt, D161): Der Körper nimmt mindestens 55 % der Bildschirmhöhe ein und steht ohne Kartenrahmen auf dem Grund. Darüber liegen nur die Kopfzeile in 17 px, die Zeitraumwahl und die Kennzahlenleiste. Unter den Füssen liegen ein kleiner Kontaktschatten und ein schwacher Schein.
- **Material** (festgelegt, D155): einfarbig, ohne Anatomiefarben. Ein trainierter Muskel ohne Veränderung ist weiss. Was nichts aussagt, ist gedimmt: ein Muskel ohne Training, und Kopf, Hände und Füsse (festgelegt, D161). So ist ein Körper ohne Daten eine ruhige graue Figur, und Training macht ihn hell.
- **Farbe am Körper** muss der Legende entsprechen. Das heutige Tone Mapping macht aus den Statusfarben Pastell; Block 7A wählt eines, das sie hält, und zeigt es an fünf Bildern.
- **Licht:** weniger Grundlicht, ein Hauptlicht von schräg oben, ein Kantenlicht von hinten.
- **Bedienung:** Ansichtstasten Vorne, Seite, Hinten und Zurücksetzen stehen oben in der Bühne, als feste Flächen. Zoomen mit zwei Fingern zwischen 1,0 und 1,8; Doppeltipp setzt zurück.
- **Bewegung** (festgelegt, D155): Drehen mit Schwung und weichem Auslaufen. Ein Tipp dreht den Körper nie; eine Auswahl in der Liste dreht ihn, wenn die Gruppe abgewandt ist.
- **Der Weg dorthin** (festgelegt, D161): Die Gym-Kachel auf Heute führt direkt zum Muskelgruppen-Screen. Die Gym-Übersicht bleibt der Ort für Training, Pläne und Laufen.
- **Treffen:** Hände gehören zur neutralen Zone (festgelegt, D155). Ein Tipp bis 12 px neben einer Gruppe wählt die nächstliegende; das gleicht die schmalen Unterarme aus.
- **Ohne 3D** bleibt die flache Figur der Ersatz, und die Zeilen sind der Weg für Vorlesehilfen.

## §9 Muskel-Sheet

Zielbild für Block 7C.

- **Höhe** (festgelegt, D161): zwei Stufen. Das Sheet öffnet auf zwei Dritteln der Höhe und lässt sich auf 92 % ziehen. Zuerst waren rund 80 % genannt; bei 80 % blieben über dem Sheet auf einem iPhone rund 80 px vom Körper, bei zwei Dritteln rund 190 px. Das reicht, um die gewählte Gruppe vergrössert stehen zu lassen (Mockup 2).
- **Der Körper darüber** dreht beim Öffnen zur gewählten Gruppe, rückt sie ins Fenster und bleibt dann stehen. Solange das Sheet offen ist, wird er nicht neu gezeichnet (festgelegt, D155).
- **Reihenfolge des Inhalts:** Name mit Muskelpunkt; die Veränderung in `--type-figure-l` mit Chip; darunter «Bester Arbeitssatz · letzte 30 Tage»; die Zeitraumwahl; das Diagramm; die Übungen der Gruppe mit ihrem besten Arbeitssatz und ihrer Veränderung; das Arbeitsvolumen pro Woche als Balken mit dem Vermerk «nicht gewertet» (festgelegt, D152).
- **Über der Falz** stehen Name, Veränderung, Zeitraum und Diagramm. Übungen und Volumen dürfen darunter beginnen.
- **Zu wenig Vergleichsdaten:** kein Diagramm. Ein Satz sagt, wie viele Übungstage es gibt und ab wann ein Trend erscheint; darunter steht, was erfasst ist.
- **Zurück:** nach unten ziehen, das Kreuz, ein Tipp auf den Körper darüber oder die Zurück-Geste des Browsers. Ein Tipp auf eine Übung führt ins Übungsdetail.

## §10 Bewegung

- **Tokens:** `--duration-fast` 130 ms, `--duration-base` 240 ms, neu `--duration-sheet` 320 ms; eine Kurve, `--ease-standard` (festgelegt, D160).
- **Nach Zeit, nicht nach Bildern.** Trägheit und Kamerafahrt des Körpers rechnen mit der vergangenen Zeit. Heute rechnen sie pro Bild und laufen bei halber Bildrate doppelt so lang.
- **Reduzierte Bewegung:** kein Auslaufen, Ansichten springen, Sheets erscheinen ohne Fahrt. Das gilt schon und bleibt.

## §11 Laden, leer, Fehler

- **Laden:** Ein Screen hält sein Layout. Wo Inhalt fehlt, steht eine ruhige Fläche in `--surface-secondary`, ohne Schimmer (festgelegt, D160). Der Körper zeigt bis zum Laden sein Standbild.
- **Leer:** ein Satz, was fehlt, und eine primäre Aktion. Eine Leiste voller Striche wird nicht gezeigt (Mockup 1, zweiter Zustand).
- **Fehler:** die vorhandenen Bausteine für «konnte nicht laden» und «veraltet».

## §12 Barrierefreiheit

- Kontrast 4,5:1 für Text, auch den kleinsten; 3:1 für grosse Schrift und für Marken.
- Kein Text unter 11 px. Trefferflächen 44 px.
- Farbe ist nie der einzige Träger: Jeder Zustand steht auch als Wort da.
- Der Weg für Vorlesehilfen führt über die Zeilen, nicht über den Körper.
- Reduzierte Bewegung und reduzierte Transparenz werden beachtet. Vergrössern der Seite wird nie gesperrt.
- Kein seitliches Überlaufen bei 320, 360, 393 und 430 px.

## §13 Wörter

| Deutsch | Englisch | Ersetzt |
|---|---|---|
| Leistungstrend | Performance trend | Gesamtentwicklung |
| Zu wenig Vergleichsdaten | Not enough to compare | Noch kein Vergleich |
| Bester Arbeitssatz | Best working set | Bester Satz (ab Block 5b) |
| Arbeitsvolumen pro Woche · nicht gewertet | Work volume per week · not scored | neu |
| Aufwärmsatz | Warm-up set | neu (Block 5b) |
| uneinheitlich | mixed | neu |

«Verbessert», «Gehalten», «Zurückgegangen» und «Noch nicht trainiert» bleiben. In der Oberfläche steht kein technisches Wort.

## §14 Was Tests durchsetzen

| Regel | Prüfung | Block |
|---|---|---|
| Kein Farbwert ausserhalb von `tokens.css`, ausser §2.6 | Suche über `src/`, wie `statusPalette.test.ts` | 6b |
| Schriftgrössen nur über Tokens, keine unter 11 px | Suche über die CSS-Dateien | 6b |
| `--text-tertiary` hält 4,5:1 gegen Karte und Grund | `contrast.test.ts` | 6b |
| Jeder sichtbare Text hält seinen Kontrast an den gerenderten Pixeln | Browser-Suite, heute `wp3-stage6a.mjs` | 6b |
| Kein Screen ist breiter als sein Viewport | Browser-Suite bei vier Breiten | 6b |
| Mint, die Bereichsfarben und die Muskelfarbe als Fläche kommen nicht mehr vor | Suche nach den entfernten Tokens | 6b |
| Zustand folgt der angezeigten Zahl; Band und Mindestdaten | `muscleState.test.ts` | Farbregeln |
| Körper, Zeile und Sheet zeigen dieselbe Zahl | Browser-Suite | 7C |
| Ein Tipp dreht nie; die Trägheit hängt nicht an der Bildrate | `body.mjs`, `gym-muscles.mjs` | 7B |
| Unter dem offenen Sheet entsteht kein Bild | `gym-muscles.mjs` | 7B, 7C |
| Hände neutral, Prüfpunkte der Zonen | Validator und ein eigener Test | 7A |

## §15 Zuordnung zu den Blöcken

| Block | Paragrafen |
|---|---|
| 6b Designsystem | §2 ohne den Körper, §3, §4, §5, §6 für die bestehenden Diagramme, §10 und §11 für die Oberfläche, §12, §14 |
| Farbregeln | §7, die Wörter aus §13, die sie braucht |
| 5b Kennzahl | «Bester Arbeitssatz» und «Aufwärmsatz» aus §13; sonst kein Aussehen |
| 7A Körpermodell | §8 Material, Farbe, Licht, neutrale Zone |
| 7B Interaktion | §8 Grösse, Bedienung, Bewegung, Treffen, der Weg von Heute; §10 für den Körper; die Messanzeige für Bildrate und Ladezeit |
| 7C Muskel-Sheet | §9, §6 für das Diagramm im Sheet |
| 9 Härtung | §12 auf dem Gerät, §14 als Ganzes |

## Anhang

**Mockups** (`docs/wp3/mockups/`): `muskelgruppen.html` (gemischte Datenlage; mit `#leer` das erste Öffnen), `muskel-sheet.html` (Brust mit Messwerten; mit `#wenig` die Unterarme), `bausteine.html` (beide Welten). Der Körper darin ist das heutige Modell mit dem heutigen Licht, gefärbt nach §7 und §8; Block 7A ersetzt Modell und Licht. Die Mockups zeigen den Stand der Abnahme; das Bausteinblatt zeigt auch den Wochenbalken bei erreichtem Ziel. Die Hände sind dort noch blau wie die Unterarme, weil sie im heutigen Modell dazugehören.

**Offen von Dario:** die üblichen Wiederholungsbereiche, ob Aufwärmsätze bisher erfasst wurden, ob Pyramiden, Drop-Sets oder Deload-Wochen vorkommen; iPhone-Modell und iOS-Version. Die Trainingsangaben braucht Block 5b, das Gerät braucht Block 7B.

**Kein Mac.** Dario hat keinen; die App misst Bildrate und Ladezeit deshalb selbst und zeigt sie an (Block 7B).
