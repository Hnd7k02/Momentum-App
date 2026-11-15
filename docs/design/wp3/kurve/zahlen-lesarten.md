# Block «Kurve» — «nicht tiefer als vorher», in drei Lesarten

Erzeugt von `src/storage/services/kurveReport.test.ts`. Jede Historie wird mit der Uhr an ihrem letzten Tag gerechnet; verglichen wird Tag für Tag das Gym-Rating neu minus alt, für jeden Tag des Updates einzeln.

## Langes Profil: die Prüfdaten, nach derselben Regel 40 Wochen lang

Das Update an jedem der 155 Tage vom 16.11. (dem Tag nach der Prüfdatei) bis zum 19.04.; je Update die 90 Tage danach.

| Wert | An jedem Tag: tiefster Unterschied neu − alt | Update-Tage mit einem Tag ≥ 0,5 tiefer | längste Strecke tiefer (Tage) | Im Mittel der ersten 30 Tage: schlechtester Update-Tag | 60 Tage | 90 Tage | Eingependelt: Gym-Rating im Mittel der letzten 8 Wochen (alt 930,7) | Boss, ebenso (alt 861,8) |
|---|---|---|---|---|---|---|---|---|
| 10 | −54,2 (Update 19.11., Tag +90) | 155 von 155 | 91 | −37,4 | −43,1 | −43,2 | 915,1 (−15,6) | 854,0 (−7,8) |
| 8 | −32,8 (Update 16.11., Tag +19) | 155 von 155 | 91 | −26,3 | −25,1 | −25,6 | 931,1 (+0,4) | 862,0 (+0,2) |
| 6 | −18,2 (Update 16.11., Tag +12) | 105 von 155 | 77 | −14,4 | −10,8 | −7,6 | 949,3 (+18,6) | 871,3 (+9,5) |
| 5 | −10,9 (Update 16.11., Tag +12) | 64 von 155 | 37 | −7,8 | −3,6 | +1,7 | 958,5 (+27,9) | 881,7 (+19,9) |
| 4 | −4,5 (Update 18.11., Tag +6) | 14 von 155 | 21 | −1,5 | +3,2 | +10,7 | 966,9 (+36,3) | 891,8 (+30,0) |
| 3,5 | −1,9 (Update 18.11., Tag +6) | 8 von 155 | 8 | +1,2 | +6,2 | +15,0 | 970,6 (+39,9) | 896,2 (+34,4) |
| 3 | 0,0 (Update 21.11., Tag +0) | 0 von 155 | 0 | +3,6 | +9,0 | +19,2 | 973,7 (+43,0) | 900,0 (+38,1) |
| 2,5 | +0,1 (Update 31.12., Tag +0) | 0 von 155 | 0 | +5,3 | +11,3 | +20,3 | 976,3 (+45,6) | 903,0 (+41,2) |
| 2 | +0,1 (Update 31.12., Tag +0) | 0 von 155 | 0 | +6,2 | +13,0 | +20,7 | 978,2 (+47,5) | 905,4 (+43,5) |

## Dasselbe Profil, das Update in der dritten bis fünften Woche

Das Update an jedem der 21 Tage vom 26.10. bis zum 15.11.: Beide Fenster sind dann zwei bis fünf Wochen alt.

| Wert | An jedem Tag: tiefster Unterschied neu − alt | Update-Tage mit einem Tag ≥ 0,5 tiefer | längste Strecke tiefer (Tage) | Im Mittel der ersten 30 Tage: schlechtester Update-Tag | 60 Tage | 90 Tage |
|---|---|---|---|---|---|---|
| 10 | −77,8 (Update 26.10., Tag +31) | 21 von 21 | 91 | −57,8 | −61,5 | −56,9 |
| 8 | −62,6 (Update 26.10., Tag +29) | 21 von 21 | 91 | −49,1 | −48,5 | −42,0 |
| 6 | −49,0 (Update 26.10., Tag +12) | 21 von 21 | 91 | −36,2 | −31,7 | −24,1 |
| 5 | −40,6 (Update 26.10., Tag +12) | 21 von 21 | 73 | −27,4 | −21,5 | −13,9 |
| 4 | −29,5 (Update 26.10., Tag +12) | 21 von 21 | 53 | −16,1 | −9,9 | −2,9 |
| 3,5 | −22,4 (Update 26.10., Tag +12) | 13 von 21 | 37 | −9,4 | −3,6 | +3,0 |
| 3 | −14,4 (Update 26.10., Tag +10) | 13 von 21 | 17 | −1,9 | +3,1 | +9,2 |
| 2,5 | −6,1 (Update 01.11., Tag +4) | 11 von 21 | 8 | +6,4 | +10,0 | +15,5 |
| 2 | −2,4 (Update 01.11., Tag +2) | 4 von 21 | 5 | +9,1 | +13,0 | +21,9 |

## Profil «über die Grenze» (16 Wochen, Viertagesplan mit Pyramide, Drop-Sets, leichter Woche)

Das Update an jedem der 7 Montage der Wochen 6 bis 12; je Update die Tage bis zum Ende des Profils (höchstens 90).

| Wert | An jedem Tag: tiefster Unterschied neu − alt | Update-Tage mit einem Tag ≥ 0,5 tiefer | längste Strecke tiefer (Tage) | Im Mittel der ersten 30 Tage: schlechtester Update-Tag | 60 Tage | 90 Tage |
|---|---|---|---|---|---|---|
| 10 | −68,6 (Update 06.04., Tag +30) | 7 von 7 | 53 | −44,8 | −34,6 | – |
| 8 | −51,6 (Update 06.04., Tag +30) | 5 von 7 | 46 | −32,7 | −18,9 | – |
| 6 | −28,3 (Update 06.04., Tag +30) | 5 von 7 | 40 | −16,8 | +2,0 | – |
| 5 | −14,5 (Update 06.04., Tag +29) | 5 von 7 | 36 | −8,2 | +14,1 | – |
| 4 | −4,4 (Update 06.04., Tag +4) | 2 von 7 | 6 | +2,7 | +28,5 | – |
| 3,5 | −1,3 (Update 06.04., Tag +4) | 1 von 7 | 5 | +9,2 | +36,6 | – |
| 3 | +0,3 (Update 06.04., Tag +0) | 0 von 7 | 0 | +16,4 | +45,2 | – |
| 2,5 | +1,2 (Update 04.05., Tag +0) | 0 von 7 | 0 | +24,2 | +53,9 | – |
| 2 | +1,7 (Update 04.05., Tag +0) | 0 von 7 | 0 | +31,1 | +62,2 | – |

## Prüfdaten, bis zu ihrem letzten Tag (15.11.)

Die Uhr steht am 15.11.; gezählt werden die Tage vom Update bis dorthin — 14 nach dem 02.11., einer am 15.11.

| Update | Wert | Leistung alt | neu | Ziel alt | neu | Rating am Tag: neu − alt | tiefster Unterschied | im Mittel | am 15.11. |
|---|---|---|---|---|---|---|---|---|---|
| 02.11. | 10 | 939 | 611 | 964 | 767 | −9,6 | −50,6 | −37,5 | −50,6 |
| 02.11. | 8 | 939 | 638 | 964 | 783 | −8,0 | −39,8 | −30,4 | −39,8 |
| 02.11. | 6 | 939 | 680 | 964 | 808 | −6,6 | −26,2 | −21,4 | −25,2 |
| 02.11. | 5 | 939 | 712 | 964 | 827 | −5,8 | −22,1 | −16,5 | −16,6 |
| 02.11. | 4 | 939 | 756 | 964 | 854 | −4,6 | −16,5 | −9,9 | −5,6 |
| 02.11. | 3,5 | 939 | 785 | 964 | 871 | −3,9 | −12,9 | −5,8 | +0,9 |
| 02.11. | 3 | 939 | 819 | 964 | 892 | −3,0 | −8,6 | −1,1 | +8,1 |
| 02.11. | 2,5 | 939 | 860 | 964 | 916 | −2,0 | −4,5 | +4,3 | +15,9 |
| 02.11. | 2 | 939 | 906 | 964 | 944 | −0,8 | −1,6 | +10,1 | +23,8 |
| 15.11. | 10 | 884 | 711 | 930 | 826 | −3,7 | −3,7 | −3,7 | −3,7 |
| 15.11. | 8 | 884 | 755 | 930 | 853 | −2,7 | −2,7 | −2,7 | −2,7 |
| 15.11. | 6 | 884 | 817 | 930 | 890 | −1,4 | −1,4 | −1,4 | −1,4 |
| 15.11. | 5 | 884 | 858 | 930 | 915 | −0,5 | −0,5 | −0,5 | −0,5 |
| 15.11. | 4 | 884 | 904 | 930 | 943 | +0,4 | +0,4 | +0,4 | +0,4 |
| 15.11. | 3,5 | 884 | 929 | 930 | 957 | +0,9 | +0,9 | +0,9 | +0,9 |
| 15.11. | 3 | 884 | 952 | 930 | 971 | +1,4 | +1,4 | +1,4 | +1,4 |
| 15.11. | 2,5 | 884 | 973 | 930 | 984 | +1,8 | +1,8 | +1,8 | +1,8 |
| 15.11. | 2 | 884 | 989 | 930 | 993 | +2,2 | +2,2 | +2,2 | +2,2 |

## Eine Trainingspause nach der Prüfdatei (bestehendes Verhalten, nicht geändert)

Kein Training nach dem 15.11., gerechnet am 06.12. Die versäumte Woche senkt das Rating zuerst über die Anwesenheit; ab dem siebten Tag setzt der Abbau das Rating auf den Fortschritt innerhalb der Stufe, die beim Beginn der Pause gehalten wurde (D96, D124). Hält das Rating dann eine tiefere Stufe, endet es eine ganze Stufe tiefer (D174).

| Update | Kurve | Rating am 15.11. | am 21.11. | am 22.11. (7. Tag) | am 29.11. (14. Tag) |
|---|---|---|---|---|---|
| 02.11. | alt | 831,7 | 690,5 | 700,0 | 700,0 |
| 02.11. | neu, 10 | 781,1 | 614,9 | 587,4 | 560,0 |
| 02.11. | neu, 8 | 792,0 | 633,0 | 596,5 | 560,0 |
| 02.11. | neu, 6 | 806,5 | 658,3 | 609,2 | 560,0 |
| 02.11. | neu, 5 | 815,2 | 674,4 | 617,2 | 560,0 |
| 02.11. | neu, 4 | 826,1 | 693,3 | 700,0 | 700,0 |
| 02.11. | neu, 3,5 | 832,6 | 703,6 | 701,8 | 700,0 |
| 02.11. | neu, 3 | 839,9 | 714,1 | 707,0 | 700,0 |
| 02.11. | neu, 2,5 | 847,6 | 724,1 | 712,0 | 700,0 |
| 02.11. | neu, 2 | 855,5 | 732,7 | 716,3 | 700,0 |
| 15.11. | alt | 831,7 | 690,5 | 700,0 | 700,0 |
| 15.11. | neu, 10 | 828,0 | 639,8 | 599,9 | 560,0 |
| 15.11. | neu, 8 | 829,1 | 652,7 | 606,4 | 560,0 |
| 15.11. | neu, 6 | 830,3 | 671,0 | 615,5 | 560,0 |
| 15.11. | neu, 5 | 831,2 | 682,9 | 621,4 | 560,0 |
| 15.11. | neu, 4 | 832,1 | 696,5 | 700,0 | 700,0 |
| 15.11. | neu, 3,5 | 832,6 | 703,6 | 701,8 | 700,0 |
| 15.11. | neu, 3 | 833,1 | 710,5 | 705,3 | 700,0 |
| 15.11. | neu, 2,5 | 833,6 | 716,6 | 708,3 | 700,0 |
| 15.11. | neu, 2 | 833,9 | 721,2 | 710,6 | 700,0 |

