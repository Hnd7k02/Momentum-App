# Block 7D — the exercise catalogue: the list before the code

The whole future catalogue, ordered by primary group (D171, prompt
`docs/wp3/prompts/prompt-7d-uebungskatalog.md`, step 1). Written before a
line of code; the code (`src/core/gym/catalogue.ts`) and the fourth table
in `catalogue.test.ts` follow it entry for entry.

**The new ids may still change until the owner has accepted this list**
(STOP 7D). From the release on an id is given for good.

## The rules the list follows

- **At least ten exercises per group, counted by primary group**, for all
  ten groups — a floor, not the aim. An exercise with two primaries (the
  deadlift) counts for both and is listed under both.
- **Machine, cable and bodyweight first**; free weights besides them.
- **Only what is really done** in an ordinary gym or at home. No grip
  variants unless they are known as exercises of their own, no filler.
  Where a group is by nature one movement — the calves are calf raises,
  the forearms wrist curls and reverse curls — the list reaches ten through
  the equipment and the stance, the way the catalogue already lists
  "Seitheben", "Seitheben Kabel" and "Seitheben Kurzhantel lean-away". The
  report says so, and asks.
- **Ids**: `ex_` and the English name in lower case with underscores.
- **Names**: German in Swiss spelling, unique; familiar English gym names
  stay English. The English name is the stored record's name.
- **Roles** in the line of the existing entries (D92: primaries share 70 %,
  the rest 30 %); two primaries only where both are the purpose.
- **Load type**: `external`, `bodyweight` or `assisted` (D91). `bodyweight`
  counts the whole body weight plus what is added, also where only part of
  it moves — the existing rule for push-ups, kept. Every bodyweight entry
  is also equipment "Eigengewicht", and no other is.
- **Equipment**: every entry has one. The list needs three values the type
  did not have: `ezBar` (SZ-Stange: SZ-Curls and reverse curls),
  `kettlebell` (the kettlebell swing) and `wristRoller` (Unterarmroller),
  each with its search words in both languages.
- **Movement**: every entry, old and new, names its movement from a fixed
  list — drücken (`push`), ziehen (`pull`), rudern (`row`), beugen
  (`bend`), strecken (`extend`), heben (`raise`) — and four more, because
  the six do not describe what some groups do: **Flys** (`fly`: the chest
  and rear-delt flys move the arms round the chest, which is none of the
  six), **drehen** (`rotate`: the core's rotation), **halten** (`hold`:
  plank, Pallof press, the ab wheel — the core holding against a force)
  and **tragen** (`carry`: the farmer's walk). An entry may carry several:
  a row is also a pull, so "zieh" finds every row. Movement and equipment
  are description, like the detail: nothing that rates reads them.
- **Exercises measured in time or distance** (holds, carries, skipping)
  do not fit "repetitions × load". The two already listed stay (Plank,
  Farmer's Walk); no new one is added — see "Left out" below.

## The counts, before and after

| Group (by primary) | before | after | new |
|---|---|---|---|
| Chest | 6 | 15 | 9 |
| Back | 11 | 20 | 9 |
| Shoulders | 7 | 15 | 8 |
| Biceps | 5 | 10 | 5 |
| Triceps | 6 | 14 | 8 |
| Core | 3 | 15 | 12 |
| Quadriceps | 3 | 11 | 8 |
| Hamstrings and glutes | 5 | 14 | 9 |
| Calves | 2 | 10 | 8 |
| Forearms | 2 | 10 | 8 |
| **Entries** | **49** | **133** | **84** |

| Equipment | before | after |
|---|---|---|
| Langhantel (`barbell`) | 8 | 21 |
| Kurzhantel (`dumbbell`) | 10 | 26 |
| Kabel (`cable`) | 14 | 26 |
| Maschine (`machine`) | 11 | 26 |
| Smith Machine (`smith`) | 1 | 4 |
| Eigengewicht (`bodyweight`) | 5 | 26 |
| SZ-Stange (`ezBar`) | 0 | 2 |
| Kettlebell (`kettlebell`) | 0 | 1 |
| Unterarmroller (`wristRoller`) | 0 | 1 |

| Load type | before | after |
|---|---|---|
| `external` | 42 | 105 |
| `bodyweight` | 5 | 26 |
| `assisted` | 2 | 2 |

| Movement | entries |
|---|---|
| drücken (`push`) | 26 |
| ziehen (`pull`) | 17 |
| rudern (`row`) | 8 |
| beugen (`bend`) | 35 |
| strecken (`extend`) | 20 |
| heben (`raise`) | 23 |
| Flys (`fly`) | 8 |
| drehen (`rotate`) | 4 |
| halten (`hold`) | 3 |
| tragen (`carry`) | 1 |

### Chest — Brust (15; 9 new)

| | id | Deutsch | English | Detail | Groups (primary in bold) | Equipment | Load | Movement |
|---|---|---|---|---|---|---|---|---|
|  | `ex_bench_press` | Bankdrücken | Bench Press | Brust / Chest | **Brust**, Trizeps, Schultern | Langhantel | external | drücken |
| new | `ex_dumbbell_bench_press` | Bankdrücken Kurzhantel | Dumbbell Bench Press | Brust / Chest | **Brust**, Trizeps, Schultern | Kurzhantel | external | drücken |
| new | `ex_smith_machine_bench_press` | Bankdrücken Smith Machine | Smith Machine Bench Press | Brust / Chest | **Brust**, Trizeps, Schultern | Smith Machine | external | drücken |
| new | `ex_cable_chest_press` | Brustpresse Kabel | Cable Chest Press | Brust / Chest | **Brust**, Trizeps, Schultern | Kabel | external | drücken |
| new | `ex_chest_press_machine` | Brustpresse Maschine | Chest Press Machine | Brust / Chest | **Brust**, Trizeps, Schultern | Maschine | external | drücken |
| new | `ex_pec_deck` | Butterfly Maschine | Pec Deck | Brust / Chest | **Brust** | Maschine | external | Flys |
|  | `ex_cable_fly_low_to_high` | Cable Fly bottom-up | Low-to-High Cable Fly | obere Brust / Upper chest | **Brust** | Kabel | external | Flys |
|  | `ex_chest_fly` | Cable Fly straight | Cable Fly | Brust / Chest | **Brust** | Kabel | external | Flys |
| new | `ex_high_to_low_cable_fly` | Cable Fly top-down | High-to-Low Cable Fly | untere Brust / Lower chest | **Brust** | Kabel | external | Flys |
| new | `ex_dumbbell_fly` | Flys Kurzhantel | Dumbbell Fly | Brust / Chest | **Brust** | Kurzhantel | external | Flys |
|  | `ex_push_up` | Liegestütze | Push-Up | Brust / Chest | **Brust**, Trizeps, Rumpf | Eigengewicht | bodyweight | drücken |
| new | `ex_decline_bench_press` | Negativbank Langhantel | Decline Bench Press | untere Brust / Lower chest | **Brust**, Trizeps, Schultern | Langhantel | external | drücken |
|  | `ex_incline_press` | Schrägbank Kurzhantel | Incline Dumbbell Press | obere Brust / Upper chest | **Brust**, Schultern, Trizeps | Kurzhantel | external | drücken |
| new | `ex_incline_bench_press` | Schrägbank Langhantel | Incline Bench Press | obere Brust / Upper chest | **Brust**, Schultern, Trizeps | Langhantel | external | drücken |
|  | `ex_incline_press_machine` | Schrägbank Maschine | Incline Press Machine | obere Brust / Upper chest | **Brust**, Schultern, Trizeps | Maschine | external | drücken |

### Back — Rücken (20; 9 new)

| | id | Deutsch | English | Detail | Groups (primary in bold) | Equipment | Load | Movement |
|---|---|---|---|---|---|---|---|---|
|  | `ex_close_cable_row` | Enges Kabelrudern | Close-Grip Cable Row | oberer Rücken / Upper back | **Rücken**, Bizeps, Unterarme | Kabel | external | rudern, ziehen |
| new | `ex_hyperextension` | Hyperextensions | Hyperextension | unterer Rücken / Lower back | **Rücken**, Beinbeuger und Gesäss | Eigengewicht | bodyweight | strecken |
|  | `ex_pull_up` | Klimmzüge | Pull-Up | Latissimus / Latissimus | **Rücken**, Bizeps | Eigengewicht | bodyweight | ziehen |
|  | `ex_assisted_pull_up` | Klimmzüge assistiert | Assisted Pull-Up | Latissimus / Latissimus | **Rücken**, Bizeps | Maschine | assisted | ziehen |
| new | `ex_chin_up` | Klimmzüge Untergriff | Chin-Up | Latissimus / Latissimus | **Rücken**, Bizeps | Eigengewicht | bodyweight | ziehen |
|  | `ex_deadlift` | Kreuzheben | Deadlift | Rücken / Beinbeuger / Gesäss / Back / hamstrings / glutes | **Rücken**, **Beinbeuger und Gesäss**, Unterarme | Langhantel | external | heben |
| new | `ex_one_arm_dumbbell_row` | Kurzhantelrudern einarmig | One-Arm Dumbbell Row | oberer Rücken / Upper back | **Rücken**, Bizeps, Unterarme | Kurzhantel | external | rudern, ziehen |
|  | `ex_barbell_row` | Langhantelrudern | Barbell Row | oberer Rücken / Upper back | **Rücken**, Bizeps, Unterarme | Langhantel | external | rudern, ziehen |
|  | `ex_lat_pulldown` | Latzug | Lat Pulldown | Latissimus / Latissimus | **Rücken**, Bizeps | Kabel | external | ziehen |
|  | `ex_lat_pulldown_close` | Latzug eng von oben | Close-Grip Lat Pulldown | Latissimus / Latissimus | **Rücken**, Bizeps | Kabel | external | ziehen |
|  | `ex_lat_pulldown_neutral` | Latzug neutraler Griff | Neutral-Grip Lat Pulldown | Latissimus / Latissimus | **Rücken**, Bizeps | Kabel | external | ziehen |
|  | `ex_lat_pulldown_wide` | Latzug weit | Wide-Grip Lat Pulldown | Latissimus / Latissimus | **Rücken**, Bizeps | Kabel | external | ziehen |
| new | `ex_back_extension_machine` | Rückenstrecker Maschine | Back Extension Machine | unterer Rücken / Lower back | **Rücken**, Beinbeuger und Gesäss | Maschine | external | strecken |
| new | `ex_inverted_row` | Rudern Eigengewicht | Inverted Row | oberer Rücken / Upper back | **Rücken**, Bizeps, Unterarme | Eigengewicht | bodyweight | rudern, ziehen |
| new | `ex_seated_row_machine` | Rudern Maschine | Seated Row Machine | oberer Rücken / Upper back | **Rücken**, Bizeps, Unterarme | Maschine | external | rudern, ziehen |
|  | `ex_smith_row` | Rudern Smith Machine | Smith Machine Row | oberer Rücken / Upper back | **Rücken**, Bizeps, Unterarme | Smith Machine | external | rudern, ziehen |
| new | `ex_dumbbell_shrug` | Shrugs Kurzhantel | Dumbbell Shrug | Trapez / Traps | **Rücken**, Unterarme | Kurzhantel | external | heben |
| new | `ex_barbell_shrug` | Shrugs Langhantel | Barbell Shrug | Trapez / Traps | **Rücken**, Unterarme | Langhantel | external | heben |
|  | `ex_straight_arm_pulldown` | Straight-Arm Pullover Kabel | Straight-Arm Cable Pullover | Latissimus / Latissimus | **Rücken** | Kabel | external | ziehen |
| new | `ex_t_bar_row` | T-Bar-Rudern | T-Bar Row | oberer Rücken / Upper back | **Rücken**, Bizeps, Unterarme | Langhantel | external | rudern, ziehen |

### Shoulders — Schultern (15; 8 new)

| | id | Deutsch | English | Detail | Groups (primary in bold) | Equipment | Load | Movement |
|---|---|---|---|---|---|---|---|---|
| new | `ex_arnold_press` | Arnold Press | Arnold Press | vordere und seitliche Schulter / Front and side delts | **Schultern**, Trizeps | Kurzhantel | external | drücken |
| new | `ex_upright_row` | Aufrechtes Rudern | Upright Row | seitliche Schulter / Trapez / Side delts / traps | **Schultern**, Rücken | Langhantel | external | rudern, ziehen |
|  | `ex_face_pull` | Face Pulls | Face Pulls | hintere Schulter / Trapez / Rear delts / traps | **Schultern**, Rücken | Kabel | external | ziehen |
|  | `ex_front_raise` | Frontheben | Front Raise | vordere Schulter / Front delts | **Schultern** | Kurzhantel | external | heben |
|  | `ex_overhead_press` | Overhead Press | Overhead Press | vordere Schulter / Front delts | **Schultern**, Trizeps, Rumpf | Langhantel | external | drücken |
| new | `ex_pike_push_up` | Pike-Liegestütze | Pike Push-Up | vordere Schulter / Front delts | **Schultern**, Trizeps | Eigengewicht | bodyweight | drücken |
| new | `ex_cable_reverse_fly` | Reverse Flys Kabel | Cable Reverse Fly | hintere Schulter / Rear delts | **Schultern**, Rücken | Kabel | external | Flys |
| new | `ex_dumbbell_reverse_fly` | Reverse Flys Kurzhantel | Dumbbell Reverse Fly | hintere Schulter / Rear delts | **Schultern**, Rücken | Kurzhantel | external | Flys |
|  | `ex_reverse_fly_machine` | Reverse Flys Maschine | Reverse Fly Machine | hintere Schulter / Rear delts | **Schultern**, Rücken | Maschine | external | Flys |
| new | `ex_dumbbell_shoulder_press` | Schulterdrücken Kurzhantel | Dumbbell Shoulder Press | vordere Schulter / Front delts | **Schultern**, Trizeps | Kurzhantel | external | drücken |
| new | `ex_shoulder_press_machine` | Schulterpresse Maschine | Shoulder Press Machine | vordere Schulter / Front delts | **Schultern**, Trizeps | Maschine | external | drücken |
|  | `ex_lateral_raise` | Seitheben | Lateral Raise | seitliche Schulter / Side delts | **Schultern** | Kurzhantel | external | heben |
|  | `ex_cable_lateral_raise` | Seitheben Kabel | Cable Lateral Raise | seitliche Schulter / Side delts | **Schultern** | Kabel | external | heben |
|  | `ex_lean_away_lateral_raise` | Seitheben Kurzhantel lean-away | Lean-Away Lateral Raise | seitliche Schulter / Side delts | **Schultern** | Kurzhantel | external | heben |
| new | `ex_lateral_raise_machine` | Seitheben Maschine | Lateral Raise Machine | seitliche Schulter / Side delts | **Schultern** | Maschine | external | heben |

### Biceps — Bizeps (10; 5 new)

| | id | Deutsch | English | Detail | Groups (primary in bold) | Equipment | Load | Movement |
|---|---|---|---|---|---|---|---|---|
|  | `ex_biceps_curl` | Bizeps-Curls | Biceps Curl | Bizeps / Biceps | **Bizeps** | Kurzhantel | external | beugen |
| new | `ex_cable_curl` | Bizeps-Curls Kabel | Cable Curl | Bizeps / Biceps | **Bizeps** | Kabel | external | beugen |
| new | `ex_barbell_curl` | Bizeps-Curls Langhantel | Barbell Curl | Bizeps / Biceps | **Bizeps** | Langhantel | external | beugen |
|  | `ex_supinating_curl` | Eindreh-Curls | Supinating Curl | Bizeps / Biceps | **Bizeps** | Kurzhantel | external | beugen |
|  | `ex_hammer_curl` | Hammer Curls | Hammer Curl | Brachialis / Brachioradialis / Brachialis / brachioradialis | **Bizeps**, Unterarme | Kurzhantel | external | beugen |
| new | `ex_rope_hammer_curl` | Hammer Curls Seil | Rope Hammer Curl | Brachialis / Brachioradialis / Brachialis / brachioradialis | **Bizeps**, Unterarme | Kabel | external | beugen |
| new | `ex_concentration_curl` | Konzentrationscurls | Concentration Curl | Bizeps / Biceps | **Bizeps** | Kurzhantel | external | beugen |
|  | `ex_preacher_curl` | Preacher-Curls | Preacher Curl | Bizeps, kurzer Kopf / Biceps, short head | **Bizeps** | Maschine | external | beugen |
|  | `ex_incline_curl` | Schrägbank-Curls | Incline Curl | Bizeps, langer Kopf / Biceps, long head | **Bizeps** | Kurzhantel | external | beugen |
| new | `ex_ez_bar_curl` | SZ-Curls | EZ-Bar Curl | Bizeps / Biceps | **Bizeps** | SZ-Stange | external | beugen |

### Triceps — Trizeps (14; 8 new)

| | id | Deutsch | English | Detail | Groups (primary in bold) | Equipment | Load | Movement |
|---|---|---|---|---|---|---|---|---|
| new | `ex_bench_dip` | Bankdips | Bench Dip | Trizeps / Triceps | **Trizeps**, Schultern | Eigengewicht | bodyweight | drücken |
|  | `ex_dip` | Dips | Dip | Brust unten / Trizeps / Lower chest / triceps | **Trizeps**, Brust, Schultern | Eigengewicht | bodyweight | drücken |
|  | `ex_assisted_dip` | Dips assistiert | Assisted Dip | Brust unten / Trizeps / Lower chest / triceps | **Trizeps**, Brust, Schultern | Maschine | assisted | drücken |
| new | `ex_seated_dip_machine` | Dips Maschine sitzend | Seated Dip Machine | Trizeps / Triceps | **Trizeps**, Brust, Schultern | Maschine | external | drücken |
| new | `ex_close_grip_bench_press` | Enges Bankdrücken | Close-Grip Bench Press | Trizeps / Triceps | **Trizeps**, Brust, Schultern | Langhantel | external | drücken |
| new | `ex_close_grip_push_up` | Liegestütze eng | Close-Grip Push-Up | Trizeps / Triceps | **Trizeps**, Brust, Rumpf | Eigengewicht | bodyweight | drücken |
|  | `ex_triceps_pushdown` | Pushdown Seil | Triceps Pushdown | Trizeps / Triceps | **Trizeps** | Kabel | external | strecken, drücken |
| new | `ex_bar_pushdown` | Pushdown Stange | Bar Pushdown | Trizeps / Triceps | **Trizeps** | Kabel | external | strecken, drücken |
|  | `ex_skullcrusher` | Skullcrusher Langhantel | Skullcrusher | Trizeps / Triceps | **Trizeps** | Langhantel | external | strecken |
|  | `ex_overhead_cable_extension` | Trizeps Überkopf Kabel | Overhead Cable Extension | Trizeps, langer Kopf / Triceps, long head | **Trizeps** | Kabel | external | strecken |
| new | `ex_dumbbell_overhead_extension` | Trizeps Überkopf Kurzhantel | Dumbbell Overhead Extension | Trizeps, langer Kopf / Triceps, long head | **Trizeps** | Kurzhantel | external | strecken |
|  | `ex_cable_skullcrusher` | Trizeps-Crusher Kabel | Cable Skullcrusher | Trizeps / Triceps | **Trizeps** | Kabel | external | strecken |
| new | `ex_triceps_kickback` | Trizeps-Kickbacks Kurzhantel | Triceps Kickback | Trizeps / Triceps | **Trizeps** | Kurzhantel | external | strecken |
| new | `ex_triceps_extension_machine` | Trizepsmaschine | Triceps Extension Machine | Trizeps / Triceps | **Trizeps** | Maschine | external | strecken |

### Core — Rumpf (15; 12 new)

| | id | Deutsch | English | Detail | Groups (primary in bold) | Equipment | Load | Movement |
|---|---|---|---|---|---|---|---|---|
| new | `ex_ab_crunch_machine` | Bauchmaschine | Ab Crunch Machine | gerade Bauchmuskulatur / Rectus abdominis | **Rumpf** | Maschine | external | beugen |
| new | `ex_ab_wheel_rollout` | Bauchroller | Ab Wheel Rollout | gerade Bauchmuskulatur / Rectus abdominis | **Rumpf** | Eigengewicht | bodyweight | halten |
| new | `ex_lying_leg_raise` | Beinheben liegend | Lying Leg Raise | unterer Bauch / Hüftbeuger / Lower abs / hip flexors | **Rumpf** | Eigengewicht | bodyweight | heben |
|  | `ex_cable_crunch` | Cable Crunch | Cable Crunch | gerade Bauchmuskulatur / Rectus abdominis | **Rumpf** | Kabel | external | beugen |
| new | `ex_crunch` | Crunches | Crunch | gerade Bauchmuskulatur / Rectus abdominis | **Rumpf** | Eigengewicht | bodyweight | beugen |
| new | `ex_bicycle_crunch` | Fahrrad-Crunches | Bicycle Crunch | schräge Bauchmuskulatur / Obliques | **Rumpf** | Eigengewicht | bodyweight | drehen, beugen |
|  | `ex_hanging_leg_raise` | Hanging Leg Raises | Hanging Leg Raise | unterer Bauch / Hüftbeuger / Lower abs / hip flexors | **Rumpf**, Unterarme | Eigengewicht | bodyweight | heben |
| new | `ex_pallof_press` | Pallof Press | Pallof Press | Rumpfstabilität / Core stability | **Rumpf** | Kabel | external | halten, drücken |
|  | `ex_plank` | Plank | Plank | Rumpf / Core | **Rumpf** | Eigengewicht | bodyweight | halten |
| new | `ex_reverse_crunch` | Reverse Crunches | Reverse Crunch | unterer Bauch / Lower abs | **Rumpf** | Eigengewicht | bodyweight | beugen |
| new | `ex_rotary_torso_machine` | Rumpfrotation Maschine | Rotary Torso Machine | schräge Bauchmuskulatur / Obliques | **Rumpf** | Maschine | external | drehen |
| new | `ex_russian_twist` | Russian Twist | Russian Twist | schräge Bauchmuskulatur / Obliques | **Rumpf** | Eigengewicht | bodyweight | drehen |
| new | `ex_dumbbell_side_bend` | Seitbeugen Kurzhantel | Dumbbell Side Bend | schräge Bauchmuskulatur / Obliques | **Rumpf** | Kurzhantel | external | beugen |
| new | `ex_sit_up` | Sit-ups | Sit-Up | Bauch / Hüftbeuger / Abs / hip flexors | **Rumpf** | Eigengewicht | bodyweight | beugen |
| new | `ex_cable_woodchop` | Woodchop Kabel | Cable Woodchop | schräge Bauchmuskulatur / Obliques | **Rumpf** | Kabel | external | drehen |

### Quadriceps — Quadrizeps (11; 8 new)

| | id | Deutsch | English | Detail | Groups (primary in bold) | Equipment | Load | Movement |
|---|---|---|---|---|---|---|---|---|
| new | `ex_lunge` | Ausfallschritte | Lunge | Quadrizeps / Gesäss / Quadriceps / glutes | **Quadrizeps**, Beinbeuger und Gesäss | Eigengewicht | bodyweight | beugen |
|  | `ex_leg_press` | Beinpresse | Leg Press | Quadrizeps / Gesäss / Quadriceps / glutes | **Quadrizeps**, Beinbeuger und Gesäss | Maschine | external | drücken |
|  | `ex_leg_extension` | Beinstrecker Maschine | Leg Extension | Quadrizeps / Quadriceps | **Quadrizeps** | Maschine | external | strecken |
| new | `ex_bulgarian_split_squat` | Bulgarian Split Squat | Bulgarian Split Squat | Quadrizeps / Gesäss / Quadriceps / glutes | **Quadrizeps**, Beinbeuger und Gesäss | Eigengewicht | bodyweight | beugen |
| new | `ex_front_squat` | Frontkniebeuge | Front Squat | Quadrizeps / Quadriceps | **Quadrizeps**, Beinbeuger und Gesäss, Rumpf | Langhantel | external | beugen |
| new | `ex_goblet_squat` | Goblet Squat | Goblet Squat | Quadrizeps / Gesäss / Quadriceps / glutes | **Quadrizeps**, Beinbeuger und Gesäss, Rumpf | Kurzhantel | external | beugen |
| new | `ex_hack_squat` | Hackenschmidt-Kniebeuge | Hack Squat | Quadrizeps / Quadriceps | **Quadrizeps**, Beinbeuger und Gesäss | Maschine | external | beugen |
|  | `ex_squat` | Kniebeuge | Back Squat | Quadrizeps / Gesäss / Quadriceps / glutes | **Quadrizeps**, Beinbeuger und Gesäss, Rumpf | Langhantel | external | beugen |
| new | `ex_bodyweight_squat` | Kniebeuge Eigengewicht | Bodyweight Squat | Quadrizeps / Gesäss / Quadriceps / glutes | **Quadrizeps**, Beinbeuger und Gesäss | Eigengewicht | bodyweight | beugen |
| new | `ex_smith_machine_squat` | Kniebeuge Smith Machine | Smith Machine Squat | Quadrizeps / Gesäss / Quadriceps / glutes | **Quadrizeps**, Beinbeuger und Gesäss | Smith Machine | external | beugen |
| new | `ex_step_up` | Step-ups | Step-Up | Quadrizeps / Gesäss / Quadriceps / glutes | **Quadrizeps**, Beinbeuger und Gesäss | Eigengewicht | bodyweight | beugen |

### Hamstrings and glutes — Beinbeuger und Gesäss (14; 9 new)

| | id | Deutsch | English | Detail | Groups (primary in bold) | Equipment | Load | Movement |
|---|---|---|---|---|---|---|---|---|
|  | `ex_leg_curl` | Beinbeuger Maschine | Leg Curl | Beinbeuger / Hamstrings | **Beinbeuger und Gesäss** | Maschine | external | beugen |
| new | `ex_seated_leg_curl` | Beinbeuger sitzend | Seated Leg Curl | Beinbeuger / Hamstrings | **Beinbeuger und Gesäss** | Maschine | external | beugen |
| new | `ex_cable_glute_kickback` | Gesäss-Kickbacks Kabel | Cable Glute Kickback | Gesäss / Glutes | **Beinbeuger und Gesäss** | Kabel | external | strecken |
| new | `ex_glute_bridge` | Glute Bridge | Glute Bridge | Gesäss / Glutes | **Beinbeuger und Gesäss** | Eigengewicht | bodyweight | strecken |
| new | `ex_good_morning` | Good Morning | Good Morning | Beinbeuger / unterer Rücken / Hamstrings / lower back | **Beinbeuger und Gesäss**, Rücken | Langhantel | external | strecken |
|  | `ex_hip_thrust` | Hip Thrust | Hip Thrust | Gesäss / Glutes | **Beinbeuger und Gesäss** | Langhantel | external | strecken |
| new | `ex_hip_thrust_machine` | Hip Thrust Maschine | Hip Thrust Machine | Gesäss / Glutes | **Beinbeuger und Gesäss** | Maschine | external | strecken |
|  | `ex_hip_abduction_machine` | Hüftabduktion Maschine | Hip Abduction Machine | Gluteus medius / Gluteus medius | **Beinbeuger und Gesäss** | Maschine | external | drücken |
| new | `ex_kettlebell_swing` | Kettlebell Swing | Kettlebell Swing | Gesäss / Beinbeuger / Glutes / hamstrings | **Beinbeuger und Gesäss**, Rücken | Kettlebell | external | strecken |
|  | `ex_deadlift` | Kreuzheben | Deadlift | Rücken / Beinbeuger / Gesäss / Back / hamstrings / glutes | **Rücken**, **Beinbeuger und Gesäss**, Unterarme | Langhantel | external | heben |
| new | `ex_nordic_hamstring_curl` | Nordic Curls | Nordic Hamstring Curl | Beinbeuger / Hamstrings | **Beinbeuger und Gesäss** | Eigengewicht | bodyweight | beugen |
| new | `ex_cable_pull_through` | Pull-Through Kabel | Cable Pull-Through | Gesäss / Beinbeuger / Glutes / hamstrings | **Beinbeuger und Gesäss** | Kabel | external | strecken |
|  | `ex_romanian_deadlift` | Rumänisches Kreuzheben | Romanian Deadlift | Beinbeuger / Gesäss / Hamstrings / glutes | **Beinbeuger und Gesäss**, Rücken | Langhantel | external | heben |
| new | `ex_dumbbell_romanian_deadlift` | Rumänisches Kreuzheben Kurzhantel | Dumbbell Romanian Deadlift | Beinbeuger / Gesäss / Hamstrings / glutes | **Beinbeuger und Gesäss**, Rücken | Kurzhantel | external | heben |

### Calves — Waden (10; 8 new)

| | id | Deutsch | English | Detail | Groups (primary in bold) | Equipment | Load | Movement |
|---|---|---|---|---|---|---|---|---|
| new | `ex_donkey_calf_raise` | Donkey-Wadenheben | Donkey Calf Raise | Waden / Calves | **Waden** | Maschine | external | heben |
|  | `ex_calf_raise` | Wadenheben | Calf Raise | Waden / Calves | **Waden** | Maschine | external | heben |
| new | `ex_leg_press_calf_raise` | Wadenheben Beinpresse | Leg Press Calf Raise | Waden / Calves | **Waden** | Maschine | external | heben |
| new | `ex_bodyweight_calf_raise` | Wadenheben Eigengewicht | Bodyweight Calf Raise | Waden / Calves | **Waden** | Eigengewicht | bodyweight | heben |
| new | `ex_single_leg_calf_raise` | Wadenheben einbeinig | Single-Leg Calf Raise | Waden / Calves | **Waden** | Eigengewicht | bodyweight | heben |
| new | `ex_dumbbell_calf_raise` | Wadenheben Kurzhantel | Dumbbell Calf Raise | Waden / Calves | **Waden** | Kurzhantel | external | heben |
| new | `ex_barbell_calf_raise` | Wadenheben Langhantel | Barbell Calf Raise | Waden / Calves | **Waden** | Langhantel | external | heben |
|  | `ex_seated_calf_raise` | Wadenheben sitzend | Seated Calf Raise | Soleus / Soleus | **Waden** | Maschine | external | heben |
| new | `ex_seated_dumbbell_calf_raise` | Wadenheben sitzend Kurzhantel | Seated Dumbbell Calf Raise | Soleus / Soleus | **Waden** | Kurzhantel | external | heben |
| new | `ex_smith_machine_calf_raise` | Wadenheben Smith Machine | Smith Machine Calf Raise | Waden / Calves | **Waden** | Smith Machine | external | heben |

### Forearms — Unterarme (10; 8 new)

| | id | Deutsch | English | Detail | Groups (primary in bold) | Equipment | Load | Movement |
|---|---|---|---|---|---|---|---|---|
|  | `ex_farmers_carry` | Farmer's Walk | Farmer's Carry | Griffkraft / Grip | **Unterarme**, Rumpf | Kurzhantel | external | tragen |
| new | `ex_cable_reverse_curl` | Reverse Curls Kabel | Cable Reverse Curl | Brachioradialis / Brachioradialis | **Unterarme**, Bizeps | Kabel | external | beugen |
| new | `ex_barbell_reverse_curl` | Reverse Curls Langhantel | Barbell Reverse Curl | Brachioradialis / Brachioradialis | **Unterarme**, Bizeps | Langhantel | external | beugen |
| new | `ex_ez_bar_reverse_curl` | Reverse Curls SZ | EZ-Bar Reverse Curl | Brachioradialis / Brachioradialis | **Unterarme**, Bizeps | SZ-Stange | external | beugen |
| new | `ex_cable_wrist_curl` | Unterarm-Curls Kabel | Cable Wrist Curl | Unterarmbeuger / Forearm flexors | **Unterarme** | Kabel | external | beugen |
|  | `ex_wrist_curl` | Unterarm-Curls Kurzhantel | Wrist Curl | Unterarmbeuger / Forearm flexors | **Unterarme** | Kurzhantel | external | beugen |
| new | `ex_barbell_wrist_curl` | Unterarm-Curls Langhantel | Barbell Wrist Curl | Unterarmbeuger / Forearm flexors | **Unterarme** | Langhantel | external | beugen |
| new | `ex_dumbbell_reverse_wrist_curl` | Unterarm-Curls Obergriff Kurzhantel | Dumbbell Reverse Wrist Curl | Unterarmstrecker / Forearm extensors | **Unterarme** | Kurzhantel | external | strecken |
| new | `ex_barbell_reverse_wrist_curl` | Unterarm-Curls Obergriff Langhantel | Barbell Reverse Wrist Curl | Unterarmstrecker / Forearm extensors | **Unterarme** | Langhantel | external | strecken |
| new | `ex_wrist_roller` | Unterarmroller | Wrist Roller | Unterarmbeuger und -strecker / Forearm flexors and extensors | **Unterarme** | Unterarmroller | external | heben |

## The list read as an opponent

Three independent readings of the first draft (read-only, on Sonnet; every
decision below is mine) raised thirty objections. What changed:

| Objection | Decision |
|---|---|
| Zottman curls with two primaries, and rare | **out**; forearms reach ten without it |
| Wrist curl behind the back: rare, a barbell wrist curl in another stance | **out** |
| Forearms padded with wrist-curl variants | partly kept, said in the report: the forearms are trained by wrist curls and reverse curls, and the list holds them by equipment. Added the **wrist roller** (Unterarmroller), a distinct exercise, and the **barbell reverse curl**, the classic form |
| Calves padded with variants (donkey, barbell, seated dumbbell, two-leg bodyweight) | **kept**, and asked at the STOP: the calves are calf raises; ten is the owner's floor (D171). The donkey calf raise is the first candidate to drop |
| Lunges, split squats and step-ups logged as dumbbell weight only, though most are done unloaded | **bodyweight**: the body is the load and dumbbells are added weight, as for push-ups. Hesitant, in the report |
| Ab wheel: core only, "strecken" misleading | core only (as the plank); movement **halten** |
| Core misses the rotary torso machine and a floor staple | **added** "Rumpfrotation Maschine" and "Reverse Crunches" |
| Back misses the barbell shrug | **added** "Shrugs Langhantel" |
| Hamstrings miss the seated leg curl, a machine of its own in most gyms | **added** "Beinbeuger sitzend"; "Beinbeuger Maschine" stays as it is |
| Sit-ups and crunches one family | both kept: two names everyone uses for two exercises |
| Back extension machine and hyperextensions the same movement | both kept: one external, one bodyweight |
| "Kniebeuge/Wadenheben ohne Gewicht" against a load type that adds weight | renamed **"… Eigengewicht"** |
| "Kickbacks Kurzhantel" / "Kickbacks Kabel" do not say which body part | **"Trizeps-Kickbacks Kurzhantel"**, **"Gesäss-Kickbacks Kabel"** |
| "Fliegende Kurzhantel" dated | **"Flys Kurzhantel"** |
| "Holzhacker Kabel" a literal translation | **"Woodchop Kabel"** |
| "Rudern Körpergewicht" unnatural | **"Rudern Eigengewicht"** |
| "Kurzhantel-Bankdrücken", "Kabelcurls", "Langhantel-Curls", "Negativbankdrücken" break the catalogue's order (movement first, equipment last) | **"Bankdrücken Kurzhantel"**, **"Bizeps-Curls Kabel"**, **"Bizeps-Curls Langhantel"**, **"Negativbank Langhantel"** |
| "Dips Maschine" could be the assisted machine | **"Dips Maschine sitzend"** |
| Reverse wrist curl and reverse curl names do not say the equipment | **"Unterarm-Curls Obergriff Kurzhantel"** / Dumbbell Reverse Wrist Curl; **EZ-Bar Reverse Curl** |
| Upright row not found under "rudern" | movement **rudern, ziehen** |
| Hack squat: "Hackenschmidt-Kniebeuge" long | kept: the name Swiss gyms use; "hack" finds it inside the word, and "Hack Squat" is its stored name |
| Pallof press marginal | kept: the one cable core exercise against rotation |

## Assignments I hesitated over

| Exercise | As listed | The alternative |
|---|---|---|
| Shrugs (dumbbell, barbell) | **Rücken** primary (the traps are part of the back on the body model), Unterarme | Schultern primary, as many split plans group traps with shoulders |
| Aufrechtes Rudern | **Schultern** primary, Rücken | Schultern and Rücken as two primaries |
| Bankdips | **Trizeps** primary, Schultern | Trizeps, Brust and Schultern, as the Dips |
| Liegestütze eng | **Trizeps** primary, Brust, Rumpf | Brust primary, Trizeps |
| Bulgarian Split Squat, Ausfallschritte, Step-ups | **Quadrizeps** primary, Beinbeuger und Gesäss; **bodyweight** | Beinbeuger und Gesäss primary for the long-stride forms; external (dumbbell weight only) |
| Hyperextensions, Rückenstrecker Maschine | **Rücken** primary (erectors), Beinbeuger und Gesäss | Beinbeuger und Gesäss primary for the glute-focused form |
| Reverse Curls (SZ, Langhantel, Kabel) | **Unterarme** primary, Bizeps | Bizeps primary, Unterarme — as the hammer curls |
| Kettlebell Swing | **Beinbeuger und Gesäss** primary, Rücken | with Rumpf as a third group |
| Bauchroller | **Rumpf** only | Rumpf, with Rücken and Schultern secondary |

## Left out, and why

- **Time and distance**: side plank, dead hang, wall sit, hollow hold,
  plate pinch, skipping, sled push. They need a measure the app does not
  have ("repetitions × load"); a new measure is not this block's. An open
  question at the STOP.
- **Adductor machine**: none of the ten groups is the adductors; mapped to
  the nearest group it would credit the wrong part of the body.
- **Grip variants** that are not exercises of their own (another lat
  pulldown grip, a wide cable row), the sumo deadlift and the single-leg
  RDL (variants of what is listed), the tibialis raise (the front of the
  shin is not the calves), the hand gripper (a spring, not a load).
