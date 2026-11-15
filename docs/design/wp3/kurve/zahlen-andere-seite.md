# Block «Kurve» — die andere Seite

Erzeugt von `src/storage/services/kurveReport.test.ts`. Die Kurve ist symmetrisch: Was kleine Fortschritte stärker belohnt, bestraft kleine Rückgänge stärker.

## Was derselbe Wert mit einem kleinen Rückgang tut, als reine Kurve

Beide Fenster lesen dieselbe Veränderung, die Anwesenheit ist voll. «Ziel» ist, wohin das Rating dann geht; das Rating schliesst pro Tag 10 % der Lücke nach unten.

| Wert | Ziel bei 0 % | bei −1 % | bei −2 % (am Bildschirm «Gehalten») | bei −3 % | bei −5 % | Spanne des Ziels zwischen −2 % und +2 % | Rating 850 nach 7 / 14 / 30 Tagen bei −3 % |
|---|---|---|---|---|---|---|---|
| 10 | 700 | 679 | 659 | 639 | 600 | 83 | 740 / 687 / 647 |
| 8 | 700 | 674 | 649 | 624 | 578 | 103 | 732 / 675 / 633 |
| 6 | 700 | 665 | 632 | 600 | 544 | 136 | 720 / 657 / 611 |
| 5 | 700 | 659 | 619 | 582 | 520 | 162 | 710 / 643 / 593 |
| 4 | 700 | 649 | 600 | 557 | 490 | 200 | 697 / 624 / 569 |
| 3,5 | 700 | 641 | 587 | 540 | 473 | 226 | 688 / 611 / 553 |
| 3 | 700 | 632 | 570 | 520 | 454 | 259 | 678 / 595 / 534 |
| 2,5 | 700 | 619 | 549 | 496 | 435 | 302 | 665 / 577 / 511 |
| 2 | 700 | 600 | 520 | 467 | 418 | 360 | 650 / 554 / 483 |

## Wer hält: die Person der Prüfdaten ohne Fortschritt, 40 Wochen

Die Sätze der fünften Woche der Prüfdaten, jede Woche, neue Kennzahl und Kandidat ab dem ersten Tag; «alt» ist dasselbe Tagebuch unter der alten Kennzahl und Kurve. Zellen: Leistungswert / Gym-Rating am letzten Tag in der ersten Zeile, sonst Gym-Rating.

| Fall | alt | 10 | 8 | 6 | 5 | 4 | 3,5 | 3 | 2,5 | 2 |
|---|---|---|---|---|---|---|---|---|---|---|
| gleich bleiben: jede Woche dieselben Sätze | 500 / 700,0 | 500 / 700,0 | 500 / 700,0 | 500 / 700,0 | 500 / 700,0 | 500 / 700,0 | 500 / 700,0 | 500 / 700,0 | 500 / 700,0 | 500 / 700,0 |
| gewöhnliches Auf und Ab: zwei Wochen eine Wiederholung mehr, zwei eine weniger (Wochen 13–40: Mittel, tiefster–höchster Stand) | 687,6 (675–716) | 702,6 (695–711) | 703,2 (693–713) | 704,3 (691–718) | 705,1 (689–721) | 706,3 (687–726) | 707,2 (685–730) | 708,3 (682–734) | 709,8 (679–741) | 712,1 (674–750) |
| ein einzelner leichter Tag (Sonntag der Woche 21, alle Arbeitssätze mit 80 %): Rating am Vortag → tiefster Stand der 14 Tage danach | 700,0 → 636,6 | 700,0 → 700,0 | 700,0 → 700,0 | 700,0 → 700,0 | 700,0 → 700,0 | 700,0 → 700,0 | 700,0 → 700,0 | 700,0 → 700,0 | 700,0 → 700,0 | 700,0 → 700,0 |
| eine ganze leichte Woche (Woche 21): Rating am Sonntag davor → tiefster Stand der 21 Tage danach | 700,0 → 581,9 | 700,0 → 700,0 | 700,0 → 700,0 | 700,0 → 700,0 | 700,0 → 700,0 | 700,0 → 700,0 | 700,0 → 700,0 | 700,0 → 700,0 | 700,0 → 700,0 | 700,0 → 700,0 |
| ab Woche 21 überall eine Wiederholung weniger, für immer (je Übung −2,4 bis −2,9 %): Rating davor → tiefster Stand → 12 Wochen danach | 700,0 → 526,0 → 604,9 | 700,0 → 648,2 → 671,3 | 700,0 → 635,7 → 664,5 | 700,0 → 615,3 → 653,6 | 700,0 → 599,6 → 645,3 | 700,0 → 577,2 → 633,5 | 700,0 → 562,2 → 625,7 | 700,0 → 543,5 → 616,0 | 700,0 → 520,1 → 603,9 | 700,0 → 490,8 → 588,9 |

## Die zwei 16-Wochen-Profile: wie oft und wie weit das Rating fällt

Zellen: Tage, an denen das Gym-Rating gefallen ist / grösster Rückgang innerhalb von sieben Tagen. «ab Tag 1»: neue Kennzahl von Anfang an, gezählt ab Woche 5. «über die Grenze»: gezählt ab dem Update am Montag der Woche 11.

| Profil | alt | 10 | 8 | 6 | 5 | 4 | 3,5 | 3 | 2,5 | 2 |
|---|---|---|---|---|---|---|---|---|---|---|
| ab Tag 1 | 26 / −25,1 | 0 / 0,0 | 0 / 0,0 | 0 / 0,0 | 0 / 0,0 | 0 / 0,0 | 0 / 0,0 | 0 / 0,0 | 0 / 0,0 | 0 / 0,0 |
| über die Grenze | 17 / −25,1 | 15 / −5,2 | 3 / 0,0 | 0 / 0,0 | 0 / 0,0 | 0 / 0,0 | 0 / 0,0 | 0 / 0,0 | 0 / 0,0 | 0 / 0,0 |

Der Leistungswert des Profils «ab Tag 1» an den Tagen, die der Median dämpft:

| Tag | alt | 10 | 8 | 6 | 5 | 4 | 3,5 | 3 | 2,5 | 2 |
|---|---|---|---|---|---|---|---|---|---|---|
| Sonntag vor der leichten Woche (03.05.) | 873 | 672 | 711 | 768 | 808 | 858 | 886 | 916 | 946 | 973 |
| Sonntag der leichten Woche (10.05.) | 775 | 689 | 729 | 788 | 828 | 875 | 902 | 929 | 955 | 978 |
| Vortag des leichten Tags (12.06.) | 835 | 724 | 766 | 822 | 856 | 895 | 916 | 937 | 958 | 977 |
| der leichte Tag (13.06.) | 831 | 710 | 750 | 803 | 836 | 874 | 895 | 917 | 939 | 962 |

