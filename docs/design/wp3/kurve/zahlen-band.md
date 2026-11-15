# Block «Kurve» — das Band neben der neuen Kennzahl

Erzeugt von `src/storage/services/kurveReport.test.ts`. «Gehalten» folgt der gezeigten ganzen Zahl (D153): heute −2 bis +2 %. Daneben zwei Varianten, die eine Wiederholung mehr bis 12 Wiederholungen immer als Fortschritt zeigen.

## Was ein einzelner Schritt liest

**Eine Wiederholung mehr, und eine weniger, bei gleichem Gewicht** (Stärke-Score: Last × (30 + Wiederholungen))

| mehr | Veränderung | heute: −2 bis +2 gehalten | A: −1 bis +1 gehalten | B: −2 bis +1 gehalten | weniger | Veränderung | heute: −2 bis +2 gehalten | A: −1 bis +1 gehalten | B: −2 bis +1 gehalten |
|---|---|---|---|---|---|---|---|---|---|
| 5 → 6 | +2,86 % → «+3 %» | Verbessert | Verbessert | Verbessert | 5 → 4 | −2,86 % → «−3 %» | Zurückgegangen | Zurückgegangen | Zurückgegangen |
| 6 → 7 | +2,78 % → «+3 %» | Verbessert | Verbessert | Verbessert | 6 → 5 | −2,78 % → «−3 %» | Zurückgegangen | Zurückgegangen | Zurückgegangen |
| 7 → 8 | +2,70 % → «+3 %» | Verbessert | Verbessert | Verbessert | 7 → 6 | −2,70 % → «−3 %» | Zurückgegangen | Zurückgegangen | Zurückgegangen |
| 8 → 9 | +2,63 % → «+3 %» | Verbessert | Verbessert | Verbessert | 8 → 7 | −2,63 % → «−3 %» | Zurückgegangen | Zurückgegangen | Zurückgegangen |
| 9 → 10 | +2,56 % → «+3 %» | Verbessert | Verbessert | Verbessert | 9 → 8 | −2,56 % → «−3 %» | Zurückgegangen | Zurückgegangen | Zurückgegangen |
| 10 → 11 | +2,50 % → «+3 %» | Verbessert | Verbessert | Verbessert | 10 → 9 | −2,50 % → «−3 %» | Zurückgegangen | Zurückgegangen | Zurückgegangen |
| 11 → 12 | +2,44 % → «+2 %» | Gehalten | Verbessert | Verbessert | 11 → 10 | −2,44 % → «−2 %» | Gehalten | Zurückgegangen | Gehalten |
| 12 → 13 | +2,38 % → «+2 %» | Gehalten | Verbessert | Verbessert | 12 → 11 | −2,38 % → «−2 %» | Gehalten | Zurückgegangen | Gehalten |
| 13 → 14 | +2,33 % → «+2 %» | Gehalten | Verbessert | Verbessert | 13 → 12 | −2,33 % → «−2 %» | Gehalten | Zurückgegangen | Gehalten |
| 14 → 15 | +2,27 % → «+2 %» | Gehalten | Verbessert | Verbessert | 14 → 13 | −2,27 % → «−2 %» | Gehalten | Zurückgegangen | Gehalten |
| 15 → 16 | +2,22 % → «+2 %» | Gehalten | Verbessert | Verbessert | 15 → 14 | −2,22 % → «−2 %» | Gehalten | Zurückgegangen | Gehalten |

**2,5 kg mehr, und 2,5 kg weniger, bei gleichen Wiederholungen**

| mehr | Veränderung | heute: −2 bis +2 gehalten | A: −1 bis +1 gehalten | B: −2 bis +1 gehalten | weniger | Veränderung | heute: −2 bis +2 gehalten | A: −1 bis +1 gehalten | B: −2 bis +1 gehalten |
|---|---|---|---|---|---|---|---|---|---|
| 40 → 42,5 kg | +6,25 % → «+6 %» | Verbessert | Verbessert | Verbessert | 40 → 37,5 kg | −6,25 % → «−6 %» | Zurückgegangen | Zurückgegangen | Zurückgegangen |
| 50 → 52,5 kg | +5,00 % → «+5 %» | Verbessert | Verbessert | Verbessert | 50 → 47,5 kg | −5,00 % → «−5 %» | Zurückgegangen | Zurückgegangen | Zurückgegangen |
| 60 → 62,5 kg | +4,17 % → «+4 %» | Verbessert | Verbessert | Verbessert | 60 → 57,5 kg | −4,17 % → «−4 %» | Zurückgegangen | Zurückgegangen | Zurückgegangen |
| 70 → 72,5 kg | +3,57 % → «+4 %» | Verbessert | Verbessert | Verbessert | 70 → 67,5 kg | −3,57 % → «−4 %» | Zurückgegangen | Zurückgegangen | Zurückgegangen |
| 80 → 82,5 kg | +3,13 % → «+3 %» | Verbessert | Verbessert | Verbessert | 80 → 77,5 kg | −3,13 % → «−3 %» | Zurückgegangen | Zurückgegangen | Zurückgegangen |
| 90 → 92,5 kg | +2,78 % → «+3 %» | Verbessert | Verbessert | Verbessert | 90 → 87,5 kg | −2,78 % → «−3 %» | Zurückgegangen | Zurückgegangen | Zurückgegangen |
| 100 → 102,5 kg | +2,50 % → «+3 %» | Verbessert | Verbessert | Verbessert | 100 → 97,5 kg | −2,50 % → «−3 %» | Zurückgegangen | Zurückgegangen | Zurückgegangen |
| 110 → 112,5 kg | +2,27 % → «+2 %» | Gehalten | Verbessert | Verbessert | 110 → 107,5 kg | −2,27 % → «−2 %» | Gehalten | Zurückgegangen | Gehalten |
| 120 → 122,5 kg | +2,08 % → «+2 %» | Gehalten | Verbessert | Verbessert | 120 → 117,5 kg | −2,08 % → «−2 %» | Gehalten | Zurückgegangen | Gehalten |
| 130 → 132,5 kg | +1,92 % → «+2 %» | Gehalten | Verbessert | Verbessert | 130 → 127,5 kg | −1,92 % → «−2 %» | Gehalten | Zurückgegangen | Gehalten |
| 140 → 142,5 kg | +1,79 % → «+2 %» | Gehalten | Verbessert | Verbessert | 140 → 137,5 kg | −1,79 % → «−2 %» | Gehalten | Zurückgegangen | Gehalten |

**Der Tag, an dem das Gewicht steigt und die Wiederholungen auf 8 zurückgehen**

| Schritt | Veränderung | heute: −2 bis +2 gehalten | A: −1 bis +1 gehalten | B: −2 bis +1 gehalten |
|---|---|---|---|---|
| 10 × 40 kg → 8 × 42,5 kg | +0,94 % → «+1 %» | Gehalten | Gehalten | Gehalten |
| 12 × 40 kg → 8 × 42,5 kg | −3,87 % → «−4 %» | Zurückgegangen | Zurückgegangen | Zurückgegangen |
| 10 × 60 kg → 8 × 62,5 kg | −1,04 % → «−1 %» | Gehalten | Gehalten | Gehalten |
| 12 × 60 kg → 8 × 62,5 kg | −5,75 % → «−6 %» | Zurückgegangen | Zurückgegangen | Zurückgegangen |
| 10 × 80 kg → 8 × 82,5 kg | −2,03 % → «−2 %» | Gehalten | Zurückgegangen | Gehalten |
| 12 × 80 kg → 8 × 82,5 kg | −6,70 % → «−7 %» | Zurückgegangen | Zurückgegangen | Zurückgegangen |
| 10 × 100 kg → 8 × 102,5 kg | −2,62 % → «−3 %» | Zurückgegangen | Zurückgegangen | Zurückgegangen |
| 12 × 100 kg → 8 × 102,5 kg | −7,26 % → «−7 %» | Zurückgegangen | Zurückgegangen | Zurückgegangen |
| 10 × 120 kg → 8 × 122,5 kg | −3,02 % → «−3 %» | Zurückgegangen | Zurückgegangen | Zurückgegangen |
| 12 × 120 kg → 8 × 122,5 kg | −7,64 % → «−8 %» | Zurückgegangen | Zurückgegangen | Zurückgegangen |

## Wie viele Gruppen und Übungen im Band liegen

Gruppen: die Zahl der Zeile in Muskelgruppen (Median der letzten gegen die ersten Übungstage; alt: letzter gegen ersten Tag). Übungen: der letzte Tag gegen den davor, wie in der Übungsliste. Zellen: verbessert / gehalten / zurückgegangen.

| Historie | Kennzahl | Zeitraum | Gruppen mit Zahl | Gruppen — heute: −2 bis +2 gehalten | Gruppen — A: −1 bis +1 gehalten | Gruppen — B: −2 bis +1 gehalten | Gruppen bei +2 / −2 | Übungen mit Vergleich | Übungen — heute: −2 bis +2 gehalten | Übungen — A: −1 bis +1 gehalten | Übungen — B: −2 bis +1 gehalten | Übungen bei +2 / −2 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Prüfdaten, 15.11. | alt | 30 Tage | 10 | 8 / 1 / 1 | 9 / 0 / 1 | 9 / 0 / 1 | 1 / 0 | 12 | 9 / 3 / 0 | 10 / 2 / 0 | 10 / 2 / 0 | 1 / 0 |
| Prüfdaten, 15.11. | alt | 90 Tage | 10 | 10 / 0 / 0 | 10 / 0 / 0 | 10 / 0 / 0 | 0 / 0 | 12 | 9 / 3 / 0 | 10 / 2 / 0 | 10 / 2 / 0 | 1 / 0 |
| Prüfdaten, 15.11. | neu | 30 Tage | 10 | 10 / 0 / 0 | 10 / 0 / 0 | 10 / 0 / 0 | 0 / 0 | 12 | 7 / 5 / 0 | 10 / 2 / 0 | 10 / 2 / 0 | 3 / 0 |
| Prüfdaten, 15.11. | neu | 90 Tage | 10 | 10 / 0 / 0 | 10 / 0 / 0 | 10 / 0 / 0 | 0 / 0 | 12 | 7 / 5 / 0 | 10 / 2 / 0 | 10 / 2 / 0 | 3 / 0 |
| über die Grenze, 17.06. | alt | 30 Tage | 10 | 5 / 4 / 1 | 7 / 2 / 1 | 7 / 2 / 1 | 2 / 0 | 15 | 2 / 10 / 3 | 3 / 9 / 3 | 3 / 9 / 3 | 1 / 0 |
| über die Grenze, 17.06. | alt | 90 Tage | 10 | 6 / 2 / 2 | 6 / 2 / 2 | 6 / 2 / 2 | 0 / 0 | 15 | 2 / 10 / 3 | 3 / 9 / 3 | 3 / 9 / 3 | 1 / 0 |
| über die Grenze, 17.06. | neu | 30 Tage | 10 | 3 / 7 / 0 | 3 / 7 / 0 | 3 / 7 / 0 | 0 / 0 | 15 | 3 / 9 / 3 | 4 / 8 / 3 | 4 / 8 / 3 | 1 / 0 |
| über die Grenze, 17.06. | neu | 90 Tage | 10 | 7 / 3 / 0 | 7 / 3 / 0 | 7 / 3 / 0 | 0 / 0 | 15 | 3 / 9 / 3 | 4 / 8 / 3 | 4 / 8 / 3 | 1 / 0 |
| ab Tag 1, 13.06. | alt | 30 Tage | 10 | 6 / 4 / 0 | 8 / 2 / 0 | 8 / 2 / 0 | 2 / 0 | 15 | 5 / 8 / 2 | 6 / 7 / 2 | 6 / 7 / 2 | 1 / 0 |
| ab Tag 1, 13.06. | alt | 90 Tage | 10 | 7 / 2 / 1 | 7 / 2 / 1 | 7 / 2 / 1 | 0 / 0 | 15 | 5 / 8 / 2 | 6 / 7 / 2 | 6 / 7 / 2 | 1 / 0 |
| ab Tag 1, 13.06. | neu | 30 Tage | 10 | 2 / 8 / 0 | 4 / 6 / 0 | 4 / 6 / 0 | 2 / 0 | 15 | 4 / 9 / 2 | 6 / 7 / 2 | 6 / 7 / 2 | 2 / 0 |
| ab Tag 1, 13.06. | neu | 90 Tage | 10 | 7 / 3 / 0 | 8 / 2 / 0 | 8 / 2 / 0 | 1 / 0 | 15 | 4 / 9 / 2 | 6 / 7 / 2 | 6 / 7 / 2 | 2 / 0 |
| ab Tag 1, 21.06. | alt | 30 Tage | 10 | 2 / 4 / 4 | 4 / 1 / 5 | 4 / 2 / 4 | 2 / 1 | 15 | 0 / 10 / 5 | 1 / 9 / 5 | 1 / 9 / 5 | 1 / 0 |
| ab Tag 1, 21.06. | alt | 90 Tage | 10 | 3 / 3 / 4 | 4 / 2 / 4 | 4 / 2 / 4 | 1 / 0 | 15 | 0 / 10 / 5 | 1 / 9 / 5 | 1 / 9 / 5 | 1 / 0 |
| ab Tag 1, 21.06. | neu | 30 Tage | 10 | 2 / 8 / 0 | 2 / 8 / 0 | 2 / 8 / 0 | 0 / 0 | 15 | 1 / 9 / 5 | 2 / 8 / 5 | 2 / 8 / 5 | 1 / 0 |
| ab Tag 1, 21.06. | neu | 90 Tage | 10 | 7 / 3 / 0 | 9 / 1 / 0 | 9 / 1 / 0 | 2 / 0 | 15 | 1 / 9 / 5 | 2 / 8 / 5 | 2 / 8 / 5 | 1 / 0 |
| langes Profil, 28.02. | alt | 30 Tage | 10 | 7 / 3 / 0 | 7 / 3 / 0 | 7 / 3 / 0 | 0 / 0 | 12 | 6 / 2 / 4 | 7 / 1 / 4 | 7 / 1 / 4 | 1 / 0 |
| langes Profil, 28.02. | alt | 90 Tage | 10 | 10 / 0 / 0 | 10 / 0 / 0 | 10 / 0 / 0 | 0 / 0 | 12 | 6 / 2 / 4 | 7 / 1 / 4 | 7 / 1 / 4 | 1 / 0 |
| langes Profil, 28.02. | neu | 30 Tage | 10 | 7 / 3 / 0 | 10 / 0 / 0 | 10 / 0 / 0 | 3 / 0 | 12 | 5 / 7 / 0 | 8 / 3 / 1 | 8 / 4 / 0 | 3 / 1 |
| langes Profil, 28.02. | neu | 90 Tage | 10 | 10 / 0 / 0 | 10 / 0 / 0 | 10 / 0 / 0 | 0 / 0 | 12 | 5 / 7 / 0 | 8 / 3 / 1 | 8 / 4 / 0 | 3 / 1 |

