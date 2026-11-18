# Momentum – Vertrag über Aussehen, Zustände und Wörter

Stand: freigegeben am 11.11.2026 (STOP 0).

Dieser Vertrag legt fest, wie Momentum aussieht und spricht. Die folgenden Blöcke bauen danach, und Tests setzen ihn durch.

Alle Regeln sind **festgelegt**: Dario hat sie entschieden oder am STOP 0 angenommen. Die Nummern verweisen auf `docs/decisions.md`; wo keine steht, gilt D160.

Belege sind die drei Mockups unter `docs/wp3/mockups/` (Screenshots in `bilder/`, je 393 und 320 px breit).

## §1 Leitbild und Geltung

**Leitbild** (festgelegt, D154, D155). Ein heller, einfarbiger Körper auf Graphit, der nur dort Farbe trägt, wo die Trainingsdaten etwas sagen. Darum herum eine Zahlenwelt mit festen Ziffernbreiten und einem Akzent. Mind bleibt hell und ruhig, Gym dunkel; beide benutzen dieselben Bausteine.

**Geltung.** Der Vertrag gilt für jeden Screen. Für das Onboarding gelten zusätzlich die Ausnahmen in §16, und nur dort (D190, D191). Er ersetzt D89 («The body is a diagram, not an illustration»), die Muskelfarben als Flächenfarbe aus D123 und die Farbangaben der Muskelkarten-Übergabe (`docs/design/muscle-map/`). Über ihm stehen `CLAUDE.md` und alle Regeln der Wertung: Der Vertrag ändert keine Zahl, die die App berechnet.

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
| Balken im Übungsdetail `.gym-detail__bar` (`gym.css:465`) | Mint | neutral, der letzte trägt den Status (§6); seit STOP 5b eine Linie (§6, D175) |
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
- Das App-Icon ist eine festgelegte Grafik wie das Rang-Abzeichen (D198). Seine Farben stehen nur in seinen SVG-Dateien unter `public/` (`icon-full.svg` und die zwei daraus gebauten, `icon.svg` und `icon-small.svg`), nicht in `tokens.css`. Die App zeigt es an einer Stelle: als Marke im Kopf der Einführung, als Bild neben dem Namen.
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
- **Die Karte «Muskelgruppen»** in der Gym-Übersicht hält beim Laden ihre Höhe, und ihr Titel steht an derselben Stelle (D168, gebaut in Block 7C): Ihr Text beginnt oben am Standbild und wächst nur nach unten.
- **Kennzahlenleiste:** drei Zellen, getrennt durch eine feine Linie. Jede Zelle hat eine Beschriftung in 11 px, einen Wert in `--type-figure-m` und eine Zeile darunter für Zeitraum oder Zusatz. Die erste Zelle ist breiter (1,35 : 1 : 1), damit «Leistungstrend» bei 320 px passt. Über dem Körper zeigt die dritte Zelle, «Stärkster», die Veränderung als Zahl und die Gruppe in der Zeile darunter; ist keine Gruppe verbessert, steht «–» über «keine Verbesserung» (festgelegt am STOP 7B, D184; im Mockup 1 steht die Gruppe als Zahl, in dieser Grösse passt von zehn Namen nur «Brust»).
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
- **Aufwärmsatz in der Satzzeile** (Block 5b, D173, D175): Die Satznummer ist der Schalter, mit 44 px Trefferfläche und einem Namen für Vorlesehilfen («Aufwärmsatz: Satz 1 von Bankdrücken»). Markiert trägt die Nummer die Fläche einer gewählten Option (`--accent-tint`, `--accent-ink`), und über der Zeile steht das Wort «Aufwärmsatz»; die Zeile bleibt bei jeder Breite einzeilig, auch in Pfund. Unter 360 px ist die Nummernzelle 20 px breit, und die Trefferfläche wächst nach links.
- **Hinweis unter den Sätzen** (festgelegt am STOP 5b, D175): «Tippe auf die Satznummer, um einen Satz als Aufwärmsatz zu markieren.» Er steht einmal im Workout, unter den Sätzen der ersten Übung, die einen Satz hat, in 11 px und `--text-secondary`, und nur solange, bis einmal ein Satz markiert wurde. Danach kommt er nicht wieder, auch wenn die Markierung wieder entfernt wird.

## §6 Diagramme

- **Linie:** 1,5 px in `--data-ink`, runde Enden. Kein Flächenverlauf unter der Linie (festgelegt, D160; betrifft die Trendkurve im Verlauf).
- **Endpunkt:** ein Punkt mit 3 px Radius in der Statusfarbe des Zustands; bei «Gehalten» in `--data-ink`.
- **Nulllinie:** immer sichtbar, fein.
- **Verlaufslinie in der Zeile** (80 × 24 px, bei 320 px Breite 64 × 24): Alle Zeilen einer Liste teilen eine Skala von −8 % bis +8 %, die Nulllinie liegt in der Mitte (gemeinsame Skala festgelegt in D160; 8 % seit dem STOP Kurve, D180, bis dahin 12 %). Vor der gemeinsamen Skala skalierte jede Zeile für sich, sodass +1 % so steil aussah wie +60 %. Was über 8 % hinausgeht, bleibt am Rand stehen; die Zahl daneben nennt den Wert. 8 % ist die Veränderung, bei der die Farbe am Körper voll ist (§7): Körper und Zeilen sprechen auf einer Skala. Unter der Kennzahl von 5b liest ein Monat Training +3 bis +7 % in einer Gruppe; bis 12 % nutzten diese Linien ein Viertel bis gut die Hälfte der neun Pixel über der Nulllinie und waren kaum zu unterscheiden. Bei 8 % stehen +3 % und +7 % 3,4 und 7,9 Pixel über der Linie. **Alle Linien einer Liste stehen in einer Spalte** (D169, gebaut in Block 7C): Neben einem Diagramm hat die Spalte der Zahl in jeder Zeile dieselbe Breite, mit Platz für «Zurückgegangen» und für «+100 %»; eine Zeile ohne Diagramm behält den Platz, den ihr Chip braucht. Der Name der Gruppe gibt zuerst nach, nie das Diagramm. **Eine Linie beginnt auf der Grundlinie ihres ersten Tages** (festgelegt am STOP 7C, D170, D187): Am ersten Trainingstag der Gruppe im Zeitraum steht sie bei null, danach an jedem Tag mit einem Vergleich. Ein einzelner Messwert ist deshalb die kürzeste Linie, von der Nulllinie zu seinem Wert; bis STOP 7C war er ein Punkt über der Nulllinie, der wie ein Fehler aussah. Zeigt die Zeile von einer langen Reihe nur die letzten zwölf Punkte, beginnt sie nicht mehr bei null.
- **Diagramm im Sheet:** links zwei Beschriftungen («0 %» und «+8 %» oder «−8 %»), unten das erste und das letzte Datum, am Endpunkt der Wert. Gebaut in Block 7C (D186): Die Skala ist die der Zeilen, 8 % reichen bis zum Rand, und was darüber hinausgeht, bleibt dort stehen – der Wert neben dem Endpunkt nennt die Zahl. Eine Reihe, die steigt und fällt, hat die Nulllinie in der Mitte und drei Beschriftungen: Die Reihe einer Gruppe kreuzt die Null oft, und eine bei null abgeschnittene Linie wäre falsch. Seit STOP 7C beginnt sie auf der Grundlinie des ersten Trainingstags der Gruppe im Zeitraum (D170); das erste Datum darunter ist dieser Tag. Der Wert steht rechts neben der Linie auf ihrer Höhe, wie in der Zeile und im Übungsdetail (im Mockup 2 über dem Endpunkt; dort läuft eine fallende Linie durch ihn hindurch). Das Diagramm trägt eine Beschreibung für Vorlesehilfen.
- **Balken:** `--data-ink` mit 55 % Deckkraft, der letzte Balken in der Statusfarbe seiner Veränderung. **Ausnahme: das Arbeitsvolumen im Muskel-Sheet** (Block 7C, D186): Dort trägt kein Balken eine Statusfarbe, auch der letzte nicht – das Volumen wird gezeigt und nie gewertet und geht deshalb in keine Farbe ein (D152). Bis fünf Wochen trägt jeder Balken seinen Wert und seine Kalenderwoche; ab sechs stehen die Balken auf der Achse dieses Absatzes (links die Null und der grösste Wert, unten die erste und die letzte Woche). Eine Woche ohne Arbeitssatz ist eine Lücke mit ihrer Kalenderwoche, kein Balken der Höhe null. Die Balken beginnen bei null (festgelegt am STOP 6b, D163): Die Höhe eines Balkens ist sein Anteil am grössten Wert. Eine Skala vom kleinsten zum grössten Wert liesse einen kleinen Rückgang wie einen Absturz aussehen und widerspräche der gemeinsamen Skala der Zeilen (D160). Links stehen die Null und der grösste Wert, jede Beschriftung auf ihrer Linie, unten erstes und letztes Datum. Das Übungsdetail, für das diese Regel am STOP 6b entstand, zeichnet seit STOP 5b eine Linie (nächster Punkt); die Regel gilt für jedes Balkendiagramm, das noch kommt.
- **Diagramm im Übungsdetail** (festgelegt am STOP 5b, D175): eine Linie statt der Balken. Unter der neuen Kennzahl ändert sich ein Tag zum nächsten um zwei, drei Prozent; Balken ab null standen fast gleich hoch. Jeder Tag steht an der Veränderung der Übung im Zeitraum bis zu diesem Tag (festgelegt am STOP 7C, D187): an derselben Rechnung wie ihre eine Zahl, als hätte der Zeitraum an diesem Tag geendet – so wie die Linie einer Gruppe ihre Zahl Tag für Tag ist. Die Linie endet deshalb immer bei der Zahl im Kopf, und ein grüner Endpunkt liegt nie unter null. Am ersten Tag steht sie bei null (D170). Bis STOP 7C stand jeder Tag an seiner Veränderung gegenüber dem ersten Tag; unter der Kennzahl von 5b ist das eine andere Rechnung als die Zahl, und bei den Dips der Prüfdaten endete eine grüne Linie unter null. Vor der Ära der Kennzahl von 5b ist beides dasselbe. Die Skala ist die der Zeilen: 8 % reichen bis zum Rand (seit dem STOP Kurve, D180; bis dahin 12 %), damit eine kleine Veränderung klein aussieht. Geht eine Reihe weiter, wächst die Skala in Schritten von 4 % (bis dahin 6 %), nach oben und unten gleich; nichts wird abgeschnitten. Eine Reihe, die nur steigt, steht über ihrer Nulllinie, eine, die nur fällt, darunter, eine mit beidem hat die Nulllinie in der Mitte. Links stehen die Beschriftungen der Skala, jede auf ihrer Linie («0 %» und «+8 %» oder «−8 %», bei beidem alle drei), unten das erste und das letzte Datum. Der Endpunkt trägt den Zustand des Endwerts, der Wert steht rechts neben der Linie auf seiner Höhe (bis Block 7C). Ein einzelner Tag zeichnet seit STOP 7C kein Diagramm: Ein Satz sagt, dass ein Trainingstag erfasst ist und die Linie mit dem zweiten beginnt (D170); bis dahin war er ein Punkt ohne Wert. **Seit Block 7C steht am Ende der Linie keine Zahl mehr** (D176, D186): Eine Übung hat eine einzige Veränderung, die im gewählten Zeitraum – der Median ihrer letzten gegen den Median ihrer ersten Übungstage, also die Zahl, die in die ihrer Gruppen eingeht. Sie steht im Kopf des Übungsdetails mit ihrem Zustand und mit «Bester Arbeitssatz · letzte N Tage», genau wie bei der Übung im Muskel-Sheet. «Zuletzt» und «Davor» sind zwei Sätze ohne Prozentzahl dazwischen. Seit STOP 7C zeichnet die Linie diese eine Zahl Tag für Tag; ein Satz unter dem Diagramm sagt das («Jeder Punkt ist die Veränderung im Zeitraum bis zu diesem Tag; der letzte ist die Zahl oben.»), und ihr Endpunkt trägt den Zustand der einen Zahl. Bis dahin stand oben unter «Veränderung» der letzte Tag gegen den davor und an der Linie unbenannt der letzte gegen den ersten: zwei Zahlen für eine Übung. Für Vorlesehilfen steht dieselbe Reihe als Tabelle da: Tag, bester Arbeitssatz, Veränderung im Zeitraum bis zu diesem Tag.
- **Ohne Messwert kein Diagramm**, keiner ist nichts. Ein einzelner Messwert ist die Linie von der Grundlinie seines ersten Tages zu seinem Wert, in der Zeile und im Sheet; im Übungsdetail steht für einen einzelnen Tag ein Satz statt eines Diagramms (festgelegt am STOP 7C, D170, D187). Bis dahin war ein einzelner Messwert ein Punkt.
- Diagramme in Zeilen sind für Vorlesehilfen unsichtbar, weil die Zeile alles in Worten sagt; ein grosses Diagramm trägt eine Beschreibung.

## §7 Muskelstatus

Fünf Zustände (festgelegt, D153). Eine einzige Stelle im Code macht aus einer Zahl einen Zustand (`muscleState.ts`); Körper, Zeile, Chip, Sheet und Legende lesen dort.

| Zustand | Regel | Deutsch | Englisch | Am Körper | In der Zeile |
|---|---|---|---|---|---|
| verbessert | ab +2 % | Verbessert | Improved | grün getönt | Linie, Zahl in Grün, Wort |
| gehalten | −2 % bis +1 % | Gehalten | Held | Weiss, der Ton eines trainierten Muskels | Linie, Zahl in Textfarbe, Wort |
| zurückgegangen | ab −3 % | Zurückgegangen | Declined | rot getönt | Linie, Zahl in Rot, Wort |
| zu wenig Vergleichsdaten | weniger als drei Übungstage der Gruppe im Zeitraum, oder keine Übung mit zwei Tagen | Zu wenig Vergleichsdaten | Not enough to compare | leicht blau getönt | blauer Chip, keine Linie |
| noch nicht trainiert | kein Satz im Zeitraum | Noch nicht trainiert | Not trained yet | gedimmt | neutraler Chip, Punkt blass |

- **Das Band.** Der Zustand folgt der angezeigten ganzen Zahl, damit Zahl und Farbe nie auseinanderfallen. Die Rundung ist kaufmännisch in beide Richtungen. **Das Band ist einseitig** (festgelegt am STOP Kurve, D180): −2 bis +1 % ist gehalten, ein Anstieg zählt ab einem gezeigten +2 % (ab +1,5 %), ein Rückgang ab einem gezeigten −3 % (ab −2,5 %). Bis dahin war es −2 bis +2 % (D153). Der Grund: Unter der Kennzahl von 5b ist eine Wiederholung mehr bei gleichem Gewicht 1 ÷ (30 + Wiederholungen), von 10 auf 11 also +2,5 % und von 11 auf 12 +2,4 %; das alte Band nannte den einen Schritt «+3 %» und den anderen «Gehalten». Eine Wiederholung mehr soll immer als Fortschritt erscheinen. Ein beidseitiges Band von ±1 % hätte dafür jede einzelne Wiederholung weniger zum Rückgang gemacht, also das Zappeln zurückgebracht, gegen das es das Band gibt. Unverändert bleibt deshalb die untere Seite: Eine Wiederholung weniger ist bis zehn Wiederholungen ein Rückgang und darüber gehalten.
- **Legende zum Band:** Die Legende sagt bei den zwei Zahlen, die sich unterscheiden, warum. Verbessert: «Ab +2 %. Schon eine Wiederholung mehr zählt als Fortschritt.» Gehalten: «−2 % bis +1 %». Zurückgegangen: «Ab −3 %. Eine kleine Schwankung nach unten zählt noch nicht als Rückgang.» (englisch: «From +2 %. One more rep already counts as progress.» und «From −3 %. A small dip does not yet count as a decline.») Die Erklärung steht bei der Regel und nicht als Absatz am Ende, weil sie dort auf einem schmalen Telefon unter den sichtbaren Teil des Sheets rutschte.
- **Die Farbstärke** am Körper wächst gleichmässig von 2,5 % bis 8 % und bleibt darüber gleich (Block «Kurve», D179; bis dahin 12 %; am STOP Kurve bestätigt, D180). Sie beginnt bei drei Zehnteln der vollen Stärke (D167). Ein Anstieg, der als «+2 %» gezeigt wird (ab +1,5 %), trägt diese schwächste Stärke; die Skala selbst rückt dafür nicht. Unter der Kennzahl von 5b liest ein Monat Training +3 bis +7 % in einer Gruppe; bis 12 % stand das alles im blassen unteren Teil der Skala. Bei 8 % füllen diese Werte die Skala: +3 % hat die Stärke 0,36, +5 % 0,62, +7 % 0,87, ab +8 % die volle. Am gerenderten Körper liegt die Brust bei +3 % 23,6 ΔE von derselben Brust «gehalten», bei +7 % 52,8.
- **Zeiträume:** 30 und 90 Tage für den Muskeltrend. Der Verlauf behält 7 und 30 Tage; die beiden teilen sich heute die Konstante `TREND_RANGES` und brauchen künftig je eine.
- **Wörter:** «Leistungstrend», nie «Entwicklung» und nie «gewachsen». «Zu wenig Vergleichsdaten» ersetzt «Noch kein Vergleich».
- **Legendensatz** (hinter dem Knopf ⓘ): «Die Farbe zeigt, wie sich dein bester Arbeitssatz je Muskelgruppe im gewählten Zeitraum verändert hat. Sie misst Trainingsleistung, nicht Muskelmasse.»
- **Uneinheitlich:** Liegen die Übungen einer Gruppe mehr als zehn Prozentpunkte auseinander, steht im Sheet «uneinheitlich», und beide Übungen sind einzeln sichtbar (festgelegt, D160). Gebaut in Block 7C (D186): Verglichen werden die Veränderungen, wie sie angezeigt werden, als ganze Zahlen – «+8 %» und «−2 %» liegen zehn Punkte auseinander und sind es nicht, «+9 %» und «−2 %» sind es. Das Wort muss sagen, was die Zahlen daneben sagen, aus demselben Grund, aus dem der Zustand der angezeigten Zahl folgt. Es steht als neutraler Chip neben dem Zustand, mit einem Satz über den Übungen; es ist kein Zustand und färbt nichts. Eine Gruppe ohne Zahl ist nie uneinheitlich.
- **Kennzahl darüber:** Der Leistungstrend aller gewerteten Gruppen trägt denselben Zustand nach derselben Regel.

Diese Regeln baut der Block «Farbregeln», nicht 6b. Er muss wissen: Die Gym-Golden-Datei enthält den Anzeigezustand und wird dabei bewusst neu eingefroren; die Rundung in `muscleState.ts` rundet heute −2,5 auf −2.

## §8 Körperbühne

Zielbild für die Blöcke 7A und 7B.

- **Grösse und Rahmen** (festgelegt, D161; die Lesart festgelegt am STOP 7B, D184): Die Bühne des Körpers nimmt 55 % der sichtbaren Höhe ein, und der Körper steht darin ohne Kartenrahmen auf dem Grund. Er füllt 84 % der Bühne, das sind 46 % des Bildschirms. Zuerst stand hier «Der Körper nimmt mindestens 55 % der Bildschirmhöhe ein»; gemeint ist die Bühne, wie in Mockup 1: Ein Körper von 55 % bräuchte eine Bühne von 65 % und schöbe die Legende und die erste Zeile unter den Rand. Darüber liegen nur die Kopfzeile in 17 px, die Zeitraumwahl und die Kennzahlenleiste. Unter den Füssen liegen ein kleiner Kontaktschatten und ein schwacher Schein.
- **Material** (festgelegt, D155): einfarbig, ohne Anatomiefarben. Ein trainierter Muskel ohne Veränderung ist weiss, ein Muskel ohne Training gedimmt (festgelegt, D161). Die neutrale Zone – Kopf mit Hals, Hände und Füsse – hat einen eigenen Ton, etwa in der Mitte zwischen gedimmt und Weiss (festgelegt, D166; weicht von D161 ab): Neben einem weissen Körper las sich ein gedimmter Kopf als andere Hautfarbe statt als neutral. Training macht den Körper hell.
- **Farbe am Körper** muss der Legende entsprechen. Der Körper wird ohne Tone Mapping gezeichnet (festgelegt am Gate von 7A, D165): Eine Statusfarbe am Körper ist die Farbe ihres Materials, nicht ein Pastell davon.
- **Licht:** wenig Grundlicht, ein Hauptlicht von schräg oben, ein Kantenlicht von hinten. Das Hauptlicht ist so stark, wie Weiss es an den Schultern verträgt, ohne auszufressen. Jeder Wert ist ein Token (`--body-light-*`, `--body-roughness*`, `--body-environment`).
- **Bedienung:** Ansichtstasten Vorne, Seite, Hinten und Zurücksetzen stehen oben in der Bühne, als feste Flächen. Zoomen mit zwei Fingern zwischen 1,0 und 1,8; Doppeltipp und die Taste setzen zurück, die Auswahl bleibt. Ein Zug, der nach oben oder unten beginnt, scrollt die Seite; seitlich dreht er den Körper (festgelegt am STOP 7B, D184).
- **Bewegung** (festgelegt, D155): Drehen mit Schwung und weichem Auslaufen. Ein Tipp dreht den Körper nie; eine Auswahl in der Liste dreht ihn, wenn die Gruppe abgewandt ist.
- **Der Weg dorthin** (festgelegt, D161): Die Gym-Kachel auf Heute führt direkt zum Muskelgruppen-Screen. Die Gym-Übersicht bleibt der Ort für Training, Pläne und Laufen.
- **Treffen:** Hände gehören zur neutralen Zone (festgelegt, D155). Ein Tipp bis 12 px neben einer Gruppe wählt die nächstliegende; das gleicht die schmalen Unterarme aus.
- **Ohne 3D** bleibt die flache Figur der Ersatz, und die Zeilen sind der Weg für Vorlesehilfen.
- **Die Messanzeige** bleibt im Release: ein Schalter in den Einstellungen, standardmässig aus (festgelegt am STOP 7B, D181, D184). Sie ist ein Werkzeug und die eine Stelle, an der technische Wörter stehen dürfen (§13).

## §9 Muskel-Sheet

Gebaut in Block 7C (D185, D186). Was dort entschieden wurde, steht bei jedem Punkt.

- **Höhe** (festgelegt, D161): zwei Stufen. Das Sheet öffnet auf zwei Dritteln der Höhe und lässt sich auf 92 % ziehen. Zuerst waren rund 80 % genannt; bei 80 % blieben über dem Sheet auf einem iPhone rund 80 px vom Körper, bei zwei Dritteln rund 190 px. Das reicht, um die gewählte Gruppe vergrössert stehen zu lassen (Mockup 2). Die zwei Anteile sind Tokens (`--sheet-detent-lower`, `--sheet-detent-upper`).
- **Ziehen:** Auf der unteren Stufe gehört jeder senkrechte Zug dem Sheet: nach oben zieht er es hoch, und was der Finger darüber hinaus zieht, scrollt den Inhalt. Auf der oberen Stufe scrollt ein Zug auf dem Inhalt den Inhalt; nur am Anfang des Inhalts nimmt ein Zug nach unten das Sheet mit, zurück auf die untere Stufe und von dort weg. Greifer und Kopfzeile bewegen immer das Sheet. Die Seite dahinter bewegt sich nie.
- **Greifer:** ein Bedienelement mit Namen («Ansicht vergrössern», «Ansicht verkleinern»), das die Stufe wechselt. **Ein Greifer steht nur dort, wo man ziehen kann:** Nur das Muskel-Sheet wird gezogen; alle anderen Sheets sind so hoch wie ihr Inhalt, tragen meist Felder und haben keinen Greifer mehr.
- **Der Körper darüber** dreht beim Öffnen zur gewählten Gruppe, rückt sie ins Fenster und bleibt dann stehen. Solange das Sheet offen ist, wird er nicht neu gezeichnet (festgelegt, D155). Gebaut: Die Seite rückt die Bühne unter die Kopfzeile und kehrt beim Schliessen dorthin zurück, wo sie war. Die Kamera fährt zum Ausschnitt, der die Gruppe in der Mitte des freien Streifens zeigt, so gross, wie sie mit 8 % Luft hineinpasst, höchstens 2,6-fach. Nach einem Tipp auf den Körper ändert sich der Drehwinkel nicht (§8); aus der Liste geöffnet dreht der Körper zuerst hin, wenn die Gruppe abgewandt ist. Ein Zoom des Nutzers wird durch die Fahrt ersetzt; nach dem Schliessen steht die Bühne bei 1,0, der Drehwinkel bleibt. Ein Wechsel des Zeitraums unter dem offenen Sheet zeichnet genau ein Bild. Die Ansichtstasten der Bühne sind unter dem Sheet nicht zu sehen.
- **Kein Weichzeichner über dem Körper:** Das Muskel-Sheet ist eine deckende Fläche, und sein Hintergrund dunkelt nicht ab und zeichnet nicht weich, zu jedem Zeitpunkt (D146, D185). Der Körper ist währenddessen noch unterwegs zur Gruppe.
- **Reihenfolge des Inhalts:** Name mit Muskelpunkt; die Veränderung in `--type-figure-l` mit Chip; darunter «Bester Arbeitssatz · letzte 30 Tage»; die Zeitraumwahl; das Diagramm; die Übungen der Gruppe mit ihrem besten Arbeitssatz und ihrer Veränderung; das Arbeitsvolumen pro Woche als Balken mit dem Vermerk «nicht gewertet» (festgelegt, D152). Die Zeitraumwahl ist die des Screens: Wer sie im Sheet ändert, ändert sie überall.
- **Über der Falz** stehen Name, Veränderung, Zeitraum und Diagramm. Übungen und Volumen dürfen darunter beginnen.
- **Die Veränderung einer Übung** ist die im gewählten Zeitraum, mit ihrem Zustand als Wort darunter wie in den zehn Zeilen. Es ist die eine Zahl, die eine Übung hat, und dieselbe steht im Kopf des Übungsdetails (D176, §6).
- **Arbeitsvolumen** (D152, D186): Wiederholungen × effektive Last über die Arbeitssätze, je Gruppe und Woche; Aufwärmsätze zählen nicht. Eine Übung zählt für ihre Gruppen mit den Anteilen, mit denen die Wertung sie verteilt (primär 70 %, sekundär 30 %). Gezeigt werden die Wochen, die ganz im Zeitraum liegen, und die laufende. Nichts Wertendes liest es.
- **Zu wenig Vergleichsdaten:** kein Diagramm. Ein Satz sagt, wie viele Übungstage es gibt und ab wann ein Trend erscheint; darunter steht unter «Erfasst», was erfasst ist: Übung, Tag, bester Arbeitssatz. Ein Tipp auf einen erfassten Tag führt zu seiner Übung.
- **Noch nicht trainiert:** ein Satz, was fehlt und wann die Gruppe zuletzt trainiert wurde (oder dass sie es noch nie wurde), und die eine Aktion «Training erfassen».
- **Zurück:** nach unten ziehen, das Kreuz, ein Tipp auf den Körper darüber, die Zurück-Geste des Browsers oder Escape. Ein Tipp auf den Körper darüber schliesst nur und wählt nichts. Ein Tipp auf eine Übung führt ins Übungsdetail; von dort führt Zurück – Taste und Geste – ins Sheet derselben Gruppe und von da auf den Screen. Die Adresse ändert sich für keines davon. Der Fokus kehrt auf die Zeile der Gruppe zurück. **Die Zurück-Geste schliesst jedes Sheet der App**, nicht nur dieses (festgelegt am STOP 7C, D187; gebaut im Aufräum-Block, D200), und die Adresse ändert sich dafür nicht. Ein Sheet mit Eingaben verliert dabei nichts Getipptes: Was in seinen Feldern stand, steht beim nächsten Öffnen desselben Sheets wieder da. Das Kreuz, der Grund dahinter, Escape und die Schaltflächen des Sheets verwerfen wie bisher.
- **Die Auswahl ist das offene Sheet:** Eine Gruppe ist gewählt, solange ihr Sheet steht, und keine mehr, wenn es zu ist. Unter den zehn Zeilen steht nur noch der Weg zur Gym-Übersicht.

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

«Verbessert», «Gehalten», «Zurückgegangen» und «Noch nicht trainiert» bleiben. In der Oberfläche steht kein technisches Wort – mit einer benannten Ausnahme, der Messanzeige (D181): Ihr Schalter und sein Hinweis sind Alltagssprache, ihre Zahlen dürfen heissen, was sie sind.

## §14 Was Tests durchsetzen

| Regel | Prüfung | Block |
|---|---|---|
| Kein Farbwert ausserhalb von `tokens.css`, ausser §2.6 | Suche über `src/`, wie `statusPalette.test.ts` | 6b |
| Schriftgrössen nur über Tokens, keine unter 11 px | Suche über die CSS-Dateien | 6b |
| `--text-tertiary` hält 4,5:1 gegen Karte und Grund | `contrast.test.ts` | 6b |
| Jeder sichtbare Text hält seinen Kontrast an den gerenderten Pixeln | `design-system.mjs` (vor Stage 6b `wp3-stage6a.mjs`) | 6b |
| Kein Screen ist breiter als sein Viewport | Browser-Suite bei vier Breiten | 6b |
| Mint, die Bereichsfarben und die Muskelfarbe als Fläche kommen nicht mehr vor | Suche nach den entfernten Tokens | 6b |
| Zustand folgt der angezeigten Zahl; Band und Mindestdaten | `muscleState.test.ts` | Farbregeln |
| Körper, Zeile und Sheet zeigen dieselbe Zahl | `muscle-sheet.mjs` | 7C |
| Jeder Weg zurück schliesst das Sheet und lässt den Screen stehen; die zwei Stufen und das Ziehen | `muscle-sheet.mjs`, `sheetDetents.test.ts`, `backLayer.test.tsx` | 7C |
| Eine Übung hat eine Veränderung, im Sheet und im Übungsdetail dieselbe | `muscle-sheet.mjs`, `exerciseDetailChart.test.tsx` | 7C |
| Nichts Wertendes liest das Arbeitsvolumen | `volumeUnscored.test.ts` | 7C |
| Die Karte «Muskelgruppen» hält Höhe und Titel beim Laden | `muscle-card.mjs` | 7C |
| Alle Linien der Zeilen stehen in einer Spalte | `muscle-sheet.mjs` | 7C |
| Ein Tipp dreht nie; die Trägheit hängt nicht an der Bildrate | `body.mjs`, `gym-muscles.mjs` | 7B |
| Unter dem offenen Sheet entsteht kein Bild; ein Wechsel des Zeitraums zeichnet genau eines | `gym-muscles.mjs` | 7B, 7C |
| Hände neutral, Prüfpunkte der Zonen | Validator und ein eigener Test | 7A |
| Jede Gruppe hat mindestens zehn Übungen nach Hauptmuskel; jede Übung nennt Gerät und Bewegung | `catalogue.test.ts` | 7D |
| «bauch», «ziehen», «maschine» und «eigengewicht» finden genau ihre Übungen, im Training und im Plan | `search.test.ts`, `exercise-search.mjs` | 7D |
| Bei reduzierter Transparenz ist jedes Glas deckend, die Tab-Leiste, die Leiste eines Trainings und der Schleier eines Sheets eingeschlossen, und jeder Text hält 4,5:1; bei reduzierter Bewegung fährt nichts; das Vergrössern der Seite ist nirgends gesperrt | `access-wp3.mjs` | 9 |
| Ein Training eines offenen Tages steht sofort im Chart, als vorläufig; vergangene Tage rechnen unverändert | `today-in-charts.mjs`, `provisionalRating.test.ts`, `history.test.ts` | 9 (D194) |

## §15 Zuordnung zu den Blöcken

| Block | Paragrafen |
|---|---|
| 6b Designsystem | §2 ohne den Körper, §3, §4, §5, §6 für die bestehenden Diagramme, §10 und §11 für die Oberfläche, §12, §14 |
| Farbregeln | §7, die Wörter aus §13, die sie braucht |
| 5b Kennzahl | «Bester Arbeitssatz» und «Aufwärmsatz» aus §13; §5 für die Satzzeile mit dem Aufwärmsatz und seinen Hinweis; §6 für die Linie im Übungsdetail (am STOP 5b gewählt) |
| Kurve | §7 für die Farbstärke am Körper; §6 für die Skala von Zeile und Übungsdetail, soweit der Block sie mitnimmt |
| 7A Körpermodell | §8 Material, Farbe, Licht, neutrale Zone |
| 7B Interaktion | §8 Grösse, Bedienung, Bewegung, Treffen, der Weg von Heute; §10 für den Körper; die Messanzeige für Bildrate und Ladezeit |
| 7C Muskel-Sheet | §9, §6 für das Diagramm im Sheet |
| 7D Übungskatalog | §3, §4 für die Zeile der Auswahl, §5, §11 für «nichts gefunden», §12, §13 |
| 7E Onboarding | §16, und für alles, was §16 nicht nennt, §3, §4, §5, §11, §12 und §13 |
| 9 Härtung | §12 auf dem Gerät, §14 als Ganzes |

## §16 Onboarding-Ausnahmen

Festgelegt am STOP 7E-a (16.11.2026, D190), angepasst am STOP 7E-a2, am STOP 7E-b und danach (17.11.2026, D191, D192, D193). **Dieser Abschnitt gilt nur im Onboarding** – in den Schritten, die eine neue Installation vor dem ersten Screen der App zeigt (`src/features/onboarding/`). Für jeden Screen der App gelten §1 bis §15 unverändert; nichts aus diesem Abschnitt darf dort stehen.

Massgebend für den Look ist der Entwurf «C1 · Momentum, referenznah» (Richtung C am STOP 7E-a). Er zeigt den Look der ersten Slide, nicht den Inhalt der übrigen Schritte.

**Die vier Ausnahmen**

- **a) Grund.** Der Grund ist flach in `--surface-base`, ohne die Schleier aus `--ground` (§2.2). Karten sind deshalb feste weisse Flächen (`--surface-elevated`, `--radius-card`, `--shadow-card`) statt Glas (§2.7): Es liegt nichts dahinter, was eine Unschärfe zeigen könnte.
- **b) Farbe in Datenmarken, nur im Hero von Slide 1.** Die Linie ist ein Verlauf `#7c5cf0` → `#5e5ce6` → `#2f8fe8` (`--onboarding-line-start`, `--accent`, `--onboarding-line-end`); die Balken dahinter stehen in `--accent-tint` und laufen nach unten aus; die Mind-Segmente folgen demselben Verlauf; die Gym-Segmente tragen den Gym-Akzent. Der Endpunkt der Linie hat einen Hof. Auf allen anderen Schritten bleiben Datenmarken neutral nach §2.1 und §6 (`--data-ink` auf `--data-track`, auf der Rang-Bühne `--stage-data-ink` auf `--stage-data-track`). Auch im Hero liegt kein Flächenverlauf unter der Linie (§6).
- **c) Hero-Zahl.** 40 px fett als eigene Zahlstufe, `--type-figure-hero`. Sie steht einmal, im Hero von Slide 1.
- **d) Beispielwerte, nur im Hero von Slide 1.** Der Hero ist ein Bild: `role="img"` mit einer Beschreibung, die sagt, dass es Beispielwerte sind. Er enthält keine Bedienelemente; was darin wie ein Segment oder eine Marke aussieht, ist gezeichnet. Kein anderer Schritt zeigt einen Wert, den es nicht gibt: Die übrigen Schritte zeigen eine echte Frage aus dem Katalog, die echten Ränge mit ihren Schwellen, die Ziele, die der Ablauf gerade hält – Gym und Laufen öffnen ohne Ziel und zeigen darum keine Zahl, sondern je einen Satz (D197) –, und die Auswahl der Person. Mind steht in der Zusammenfassung nur mit mindestens einer Frage: Ohne Frage bleibt Mind ausgeschaltet (`applyOnboarding`), und die Zusammenfassung sagt nichts anderes.
**Die Schrift ist die der App** (§3, D191). Vom STOP 7E-a bis zum STOP 7E-a2 stand hier als fünfte Ausnahme DM Sans; sie ist wieder heraus: Der Einstieg soll aussehen wie alles danach, und es spart 37 kB. Damit gelten auch im Onboarding die festen Ziffernbreiten, die DM Sans nicht hatte.

**Dunkle Flächen.** Sparsam: höchstens eine pro Screen. Sie steht immer für Gym oder für den Rang und bleibt kleiner als die hellen Flächen zusammen. Die Gym-Fläche erklärt für sich die Gym-Welt (`data-world="gym"`) und liest jede Farbe aus diesem Satz; die Rang-Bühne benutzt die Tokens `--stage-*` (§2.6). Nur der Fokusring einer dunklen Kachel, der ausserhalb von ihr auf dem hellen Grund liegt, nimmt den hellen Akzent (`--onboarding-ring`), weil der violette Akzent von Graphit dort nur 2,2:1 erreicht. Der Satz «Die Gym-Karte auf einem hellen Screen ist hell» (§2.2) gilt für die App weiter.

**Sonst gelten die bestehenden Tokens**, ohne neue Farbwerte: `--accent` für die eine Hauptschaltfläche je Schritt (§5), die Statusfarben nur für einen Zustand (der Chip «steigend»), `--accent-tint` mit `--accent-ink` für die Marke einer Welt in ihrer Kachel und für die Marke «Heute». Die zwei Farbwerte aus b) sind die einzigen, die das Onboarding hinzufügt.

**Schriftgrössen** kommen aus der Skala von §3. Wo der Entwurf 12, 14 oder 16 px zeigt, steht die nächste Stufe: 14 wird 15, 16 wird 17; 12 wird die Stufe des Bausteins, den es zeigt – 13 im Segment, 11 im Chip und in der Beschriftung einer Kachel (§5).

**Auswahl.** Eine gewählte Kachel oder Zeile trägt ein gefülltes Häkchen im Akzent (`SelectionMark`), nie einen dicken Rahmen. Die sieben Werte eines Wochenziels stehen als eine Segmentzeile 1–7 statt als sieben Kreise; die Trefferfläche jeder Zelle bleibt 44 px hoch und ihr Anteil der Zeile breit (§12, D163).

**Kurze Bildschirme.** Die drei Slides rücken unter 720 px Höhe enger zusammen, und das Diagramm im Hero gibt die Höhe ab, die der Slide fehlt (bis 64 px), bevor sie scrollt. Wie viel fehlt, wird gemessen und nicht angenommen: Wie viele Zeilen ein Satz braucht, entscheidet die Systemschrift, und sie ist von Telefon zu Telefon eine andere. Ein Schritt, der dann noch nicht passt, scrollt; die Hauptschaltfläche bleibt stehen.

**Die Auftaktseite** (D192, D193). Vor der ersten Slide steht eine sehr leere Seite: in der Mitte nur «Let’s get it started» in der Grösse eines Titels, darunter an der Stelle der Hauptschaltfläche ganz schwach «Screen antippen». Sie ist kein Schritt: keine Schrittmarken, kein Logo, kein Weg zurück; die erste Slide bleibt Schritt eins. **Sie hat keine Schaltfläche, die man suchen muss** (D193): Ein Tippen irgendwo auf den Bildschirm geht weiter – auf die Zeile, auf den Hinweis, auf den leeren Grund. Die Seite selbst nimmt das Tippen an, keine Ebene darüber; so bleibt die Zeile für die Messung erreichbar. Der Hinweis steht in `--text-tertiary`, 13 px, normal, ohne eigene Fläche und ohne Akzent: die schwächste Textstufe der Tokens (§3; 5,33:1 auf dem flachen Grund). Ein schwächeres Grau über 4,5:1 – bis etwa `#6e6e79`, 4,59:1 – wäre ein neuer Farbwert, den dieser Abschnitt ohne Darios Wort nicht hinzufügt. **Die eigene Ausnahme der Auftaktseite** (neben den vier): Bedienbar ist hier der Bildschirm, nicht die Wörter – darum trägt der Hinweis nicht den Akzent, den §2.1 dem Bedienbaren gibt, und steht auf keiner Stufe der Rangfolge aus §5. Das gilt nur auf dieser Seite. Für Tastatur und Screenreader ist der Hinweis eine echte Schaltfläche: Tab erreicht ihn, Enter geht weiter, und der Fokus geht danach auf «Los geht’s» über.

**Bereiche** (D192). «Womit startest du?» öffnet ohne Auswahl; «Weiter» wartet, und darunter steht «Wähle mindestens einen Bereich.», bis eine Welt gewählt ist.

**Mind-Fragen** (D191, D197). Der Schritt öffnet ohne gewählte Frage; die drei Startfragen aus D191 sind wieder heraus (der Eigentümer nach STOP 9). Solange keine Frage gewählt ist, wartet «Weiter» und darunter steht «Wähl mindestens eine Frage oder nimm Mind ab.» – als Wort, nicht nur als gesperrte Schaltfläche.

**Wochenziele** (D197). Der Schritt öffnet ohne gewähltes Ziel. «Weiter» wartet, und darunter steht «Wähl ein Wochenziel fürs Gym. Laufen ist freiwillig.», bis Gym ein Ziel hat. Ein Ziel nur fürs Laufen genügt nicht. **In der Einführung ist nichts vorausgewählt:** kein Bereich, keine Frage, kein Ziel.

**Was Tests durchsetzen.** `designRules.test.ts` hält die zwei Farbwerte und die Zahlstufe in `tokens.css`, nur das Onboarding liest sie, und kein Stylesheet lädt eine Schrift oder setzt eine eigene Familie; `contrast.test.ts` hält die Linie als Marke bei 3:1 und den Text auf der Gym-Fläche bei 4,5:1; `design-system.mjs` misst jeden Text der Auftaktseite und der sieben Schritte an den gerenderten Pixeln bei 320, 360, 393 und 430 px; `onboarding-7e.mjs` geht jeden Weg bei denselben Breiten und hält höchstens eine dunkle Fläche, 44 px Trefferflächen und einen Hero ohne Bedienelement – und auf der Auftaktseite ein Tippen überall: in jeder Ecke, auf der Zeile, auf dem Hinweis, mit Tab und Enter.

## Anhang

**Mockups** (`docs/wp3/mockups/`): `muskelgruppen.html` (gemischte Datenlage; mit `#leer` das erste Öffnen), `muskel-sheet.html` (Brust mit Messwerten; mit `#wenig` die Unterarme), `bausteine.html` (beide Welten). Der Körper darin ist das heutige Modell mit dem heutigen Licht, gefärbt nach §7 und §8; Block 7A ersetzt Modell und Licht. Die Mockups zeigen den Stand der Abnahme; das Bausteinblatt zeigt auch den Wochenbalken bei erreichtem Ziel. Die Hände sind dort noch blau wie die Unterarme, weil sie im heutigen Modell dazugehören.

**Offen von Dario:** die üblichen Wiederholungsbereiche, ob Aufwärmsätze bisher erfasst wurden, ob Pyramiden, Drop-Sets oder Deload-Wochen vorkommen; iPhone-Modell und iOS-Version. Die Trainingsangaben braucht Block 5b, das Gerät braucht Block 7B.

**Kein Mac.** Dario hat keinen; die App misst Bildrate und Ladezeit deshalb selbst und zeigt sie an (Block 7B).
