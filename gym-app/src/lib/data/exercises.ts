import type { Equipment, EquipmentPreset, Exercise } from "../types";

/**
 * Structured exercise database. Each entry describes the movement pattern,
 * the muscles it trains, what equipment it needs, which athletic qualities it
 * develops and which joints it stresses (used to respect limitations).
 */
export const EXERCISES: Exercise[] = [
  // ── Squat pattern ───────────────────────────────────────────────
  { id: "back_squat", name: "Back Squat", pattern: "squat", primary: ["quads", "glutes"], secondary: ["core", "hamstrings"], equipment: ["barbell"], qualities: ["max_strength", "hypertrophy"], kind: "compound", loadType: "barbell", increment: 2.5, fatigue: 3, complexity: 3, stresses: ["knee", "lower_back", "hip"], benchmark: "back_squat", cue: "Brace, sit between your hips, drive the floor away." },
  { id: "front_squat", name: "Front Squat", pattern: "squat", primary: ["quads"], secondary: ["glutes", "core"], equipment: ["barbell"], qualities: ["max_strength", "core_stability"], kind: "compound", loadType: "barbell", increment: 2.5, fatigue: 3, complexity: 3, stresses: ["knee", "wrist"], cue: "Elbows high, torso tall, knees track over toes." },
  { id: "goblet_squat", name: "Goblet Squat", pattern: "squat", primary: ["quads", "glutes"], secondary: ["core"], equipment: ["dumbbell"], qualities: ["hypertrophy", "mobility"], kind: "compound", loadType: "dumbbell", increment: 2, fatigue: 2, complexity: 1, stresses: ["knee"], cue: "Hold the bell at your chest and sit down between your heels." },
  { id: "leg_press", name: "Leg Press", pattern: "squat", primary: ["quads", "glutes"], secondary: [], equipment: ["machine"], qualities: ["hypertrophy", "max_strength"], kind: "compound", loadType: "machine", increment: 5, fatigue: 2, complexity: 1, stresses: ["knee"], cue: "Lower until your hips want to tuck, then press through mid-foot." },
  { id: "bw_squat", name: "Tempo Bodyweight Squat", pattern: "squat", primary: ["quads", "glutes"], secondary: [], equipment: ["bodyweight"], qualities: ["mobility", "hypertrophy"], kind: "compound", loadType: "bodyweight", increment: 0, fatigue: 1, complexity: 1, stresses: ["knee"], cue: "Three seconds down, pause, stand up smoothly." },

  // ── Hinge pattern ───────────────────────────────────────────────
  { id: "deadlift", name: "Deadlift", pattern: "hinge", primary: ["hamstrings", "glutes", "back"], secondary: ["forearms", "core", "quads"], equipment: ["barbell"], qualities: ["max_strength", "grip"], kind: "compound", loadType: "barbell", increment: 2.5, fatigue: 3, complexity: 3, stresses: ["lower_back", "hip"], benchmark: "deadlift", cue: "Wedge into the bar, push the floor, lock hips and knees together." },
  { id: "trap_bar_deadlift", name: "Trap Bar Deadlift", pattern: "hinge", primary: ["glutes", "quads", "hamstrings"], secondary: ["back", "forearms"], equipment: ["barbell"], qualities: ["max_strength", "power", "grip"], kind: "compound", loadType: "barbell", increment: 2.5, fatigue: 3, complexity: 2, stresses: ["hip"], cue: "Chest proud, drive up fast, stand tall." },
  { id: "romanian_deadlift", name: "Romanian Deadlift", pattern: "hinge", primary: ["hamstrings", "glutes"], secondary: ["back", "forearms"], equipment: ["barbell"], qualities: ["hypertrophy", "resilience"], kind: "compound", loadType: "barbell", increment: 2.5, fatigue: 2, complexity: 2, stresses: ["lower_back"], cue: "Soft knees, push the hips back until the hamstrings load." },
  { id: "db_rdl", name: "Dumbbell Romanian Deadlift", pattern: "hinge", primary: ["hamstrings", "glutes"], secondary: ["forearms"], equipment: ["dumbbell"], qualities: ["hypertrophy", "resilience"], kind: "compound", loadType: "dumbbell", increment: 2, fatigue: 2, complexity: 1, stresses: ["lower_back"], cue: "Slide the bells down your thighs, hips back, flat back." },
  { id: "hip_thrust", name: "Barbell Hip Thrust", pattern: "hinge", primary: ["glutes"], secondary: ["hamstrings"], equipment: ["barbell", "bench"], qualities: ["hypertrophy", "power"], kind: "compound", loadType: "barbell", increment: 5, fatigue: 2, complexity: 1, stresses: ["hip"], cue: "Chin tucked, ribs down, squeeze to full hip extension." },
  { id: "kb_swing", name: "Kettlebell Swing", pattern: "hinge", primary: ["glutes", "hamstrings"], secondary: ["core", "forearms"], equipment: ["kettlebell"], qualities: ["power", "conditioning"], kind: "power", loadType: "dumbbell", increment: 4, fatigue: 2, complexity: 2, stresses: ["lower_back"], cue: "Hike, snap the hips, let the bell float." },
  { id: "nordic_curl", name: "Nordic Hamstring Curl", pattern: "iso_legs", primary: ["hamstrings"], secondary: [], equipment: ["bodyweight"], qualities: ["resilience", "hypertrophy"], kind: "isolation", loadType: "bodyweight", increment: 0, fatigue: 2, complexity: 2, stresses: ["knee"], cue: "Fall as slowly as you can, keep hips extended." },
  { id: "single_leg_rdl", name: "Single-Leg RDL", pattern: "hinge", primary: ["hamstrings", "glutes"], secondary: ["core"], equipment: ["dumbbell"], qualities: ["unilateral", "resilience", "core_stability"], kind: "compound", loadType: "dumbbell", increment: 2, fatigue: 1, complexity: 2, stresses: ["ankle"], cue: "Reach the back heel long, keep hips square." },

  // ── Lunge / unilateral ──────────────────────────────────────────
  { id: "bulgarian_split_squat", name: "Bulgarian Split Squat", pattern: "lunge", primary: ["quads", "glutes"], secondary: ["core"], equipment: ["dumbbell", "bench"], qualities: ["unilateral", "hypertrophy", "max_strength"], kind: "compound", loadType: "dumbbell", increment: 2, fatigue: 2, complexity: 2, stresses: ["knee"], cue: "Front foot far enough to keep the heel down, drop straight." },
  { id: "walking_lunge", name: "Walking Lunge", pattern: "lunge", primary: ["quads", "glutes"], secondary: ["hamstrings"], equipment: ["dumbbell"], qualities: ["unilateral", "hypertrophy"], kind: "compound", loadType: "dumbbell", increment: 2, fatigue: 2, complexity: 1, stresses: ["knee"], cue: "Long stride, back knee kisses the floor." },
  { id: "reverse_lunge", name: "Reverse Lunge", pattern: "lunge", primary: ["quads", "glutes"], secondary: [], equipment: ["bodyweight"], qualities: ["unilateral", "resilience"], kind: "compound", loadType: "bodyweight", increment: 0, fatigue: 1, complexity: 1, stresses: ["knee"], cue: "Step back softly, drive through the front foot." },
  { id: "step_up", name: "Dumbbell Step-Up", pattern: "lunge", primary: ["quads", "glutes"], secondary: ["calves"], equipment: ["dumbbell", "box"], qualities: ["unilateral", "power"], kind: "compound", loadType: "dumbbell", increment: 2, fatigue: 1, complexity: 1, stresses: ["knee"], cue: "Drive through the top foot only, stand tall." },
  { id: "lateral_lunge", name: "Lateral Lunge", pattern: "adductors", primary: ["glutes", "quads"], secondary: ["hamstrings"], equipment: ["bodyweight"], qualities: ["mobility", "unilateral", "resilience"], kind: "compound", loadType: "bodyweight", increment: 0, fatigue: 1, complexity: 1, stresses: ["knee", "hip"], cue: "Sit back into one hip, keep the other leg long." },
  { id: "copenhagen_plank", name: "Copenhagen Plank", pattern: "adductors", primary: ["core"], secondary: ["glutes"], equipment: ["bench"], qualities: ["resilience", "core_stability"], kind: "isolation", loadType: "timed", increment: 0, fatigue: 1, complexity: 2, stresses: ["hip"], cue: "Top leg on the bench, lift the hips in one line." },

  // ── Horizontal push ─────────────────────────────────────────────
  { id: "bench_press", name: "Bench Press", pattern: "h_push", primary: ["chest", "triceps"], secondary: ["shoulders"], equipment: ["barbell", "bench"], qualities: ["max_strength", "hypertrophy"], kind: "compound", loadType: "barbell", increment: 2.5, fatigue: 2, complexity: 2, stresses: ["shoulder", "wrist"], benchmark: "bench_press", cue: "Shoulder blades tucked, bar to lower chest, press back over shoulders." },
  { id: "incline_db_press", name: "Incline Dumbbell Press", pattern: "h_push", primary: ["chest", "shoulders"], secondary: ["triceps"], equipment: ["dumbbell", "bench"], qualities: ["hypertrophy"], kind: "compound", loadType: "dumbbell", increment: 2, fatigue: 2, complexity: 1, stresses: ["shoulder"], cue: "Low incline, elbows about 45°, stretch at the bottom." },
  { id: "db_bench", name: "Dumbbell Bench Press", pattern: "h_push", primary: ["chest", "triceps"], secondary: ["shoulders"], equipment: ["dumbbell", "bench"], qualities: ["hypertrophy", "max_strength"], kind: "compound", loadType: "dumbbell", increment: 2, fatigue: 2, complexity: 1, stresses: ["shoulder"], cue: "Control the stretch, press up and slightly in." },
  { id: "push_up", name: "Push-Up", pattern: "h_push", primary: ["chest", "triceps"], secondary: ["shoulders", "core"], equipment: ["bodyweight"], qualities: ["hypertrophy", "core_stability"], kind: "compound", loadType: "bodyweight", increment: 0, fatigue: 1, complexity: 1, stresses: ["wrist", "shoulder"], benchmark: "push_up", cue: "Body in one line, chest to the floor." },
  { id: "dip", name: "Parallel Bar Dip", pattern: "h_push", primary: ["chest", "triceps"], secondary: ["shoulders"], equipment: ["machine"], qualities: ["hypertrophy", "max_strength"], kind: "compound", loadType: "bodyweight", increment: 2.5, fatigue: 2, complexity: 2, stresses: ["shoulder", "elbow"], cue: "Lean slightly forward, lower until shoulders are just below elbows." },
  { id: "landmine_press", name: "Half-Kneeling Landmine Press", pattern: "v_push", primary: ["shoulders", "chest"], secondary: ["core", "triceps"], equipment: ["barbell"], qualities: ["core_stability", "rotational_power"], kind: "compound", loadType: "barbell", increment: 2.5, fatigue: 1, complexity: 1, stresses: [], cue: "Squeeze the down-knee glute, press up and across." },

  // ── Vertical push ───────────────────────────────────────────────
  { id: "overhead_press", name: "Overhead Press", pattern: "v_push", primary: ["shoulders", "triceps"], secondary: ["core"], equipment: ["barbell"], qualities: ["max_strength"], kind: "compound", loadType: "barbell", increment: 2.5, fatigue: 2, complexity: 2, stresses: ["shoulder", "lower_back"], benchmark: "overhead_press", cue: "Glutes tight, head through at the top." },
  { id: "db_shoulder_press", name: "Seated Dumbbell Press", pattern: "v_push", primary: ["shoulders", "triceps"], secondary: [], equipment: ["dumbbell", "bench"], qualities: ["hypertrophy"], kind: "compound", loadType: "dumbbell", increment: 2, fatigue: 1, complexity: 1, stresses: ["shoulder"], cue: "Elbows slightly forward, press to just short of lockout." },
  { id: "push_press", name: "Push Press", pattern: "v_push", primary: ["shoulders", "triceps"], secondary: ["quads", "glutes"], equipment: ["barbell"], qualities: ["power", "max_strength"], kind: "power", loadType: "barbell", increment: 2.5, fatigue: 2, complexity: 3, stresses: ["shoulder", "lower_back"], cue: "Short dip, violent drive, punch the bar up." },

  // ── Horizontal pull ─────────────────────────────────────────────
  { id: "barbell_row", name: "Barbell Row", pattern: "h_pull", primary: ["back"], secondary: ["biceps", "forearms"], equipment: ["barbell"], qualities: ["max_strength", "hypertrophy"], kind: "compound", loadType: "barbell", increment: 2.5, fatigue: 2, complexity: 2, stresses: ["lower_back"], benchmark: "barbell_row", cue: "Hinge to about 45°, pull to the belly button." },
  { id: "db_row", name: "One-Arm Dumbbell Row", pattern: "h_pull", primary: ["back"], secondary: ["biceps"], equipment: ["dumbbell", "bench"], qualities: ["hypertrophy", "unilateral"], kind: "compound", loadType: "dumbbell", increment: 2, fatigue: 1, complexity: 1, stresses: [], cue: "Pull the elbow to your hip, no twisting." },
  { id: "chest_supported_row", name: "Chest-Supported Row", pattern: "h_pull", primary: ["back"], secondary: ["biceps", "shoulders"], equipment: ["dumbbell", "bench"], qualities: ["hypertrophy"], kind: "compound", loadType: "dumbbell", increment: 2, fatigue: 1, complexity: 1, stresses: [], cue: "Chest on the pad, squeeze shoulder blades together." },
  { id: "cable_row", name: "Seated Cable Row", pattern: "h_pull", primary: ["back"], secondary: ["biceps"], equipment: ["cable"], qualities: ["hypertrophy"], kind: "compound", loadType: "machine", increment: 5, fatigue: 1, complexity: 1, stresses: [], cue: "Tall chest, pull to the lower ribs." },
  { id: "inverted_row", name: "Inverted Row", pattern: "h_pull", primary: ["back"], secondary: ["biceps", "core"], equipment: ["pullup_bar"], qualities: ["hypertrophy", "core_stability"], kind: "compound", loadType: "bodyweight", increment: 0, fatigue: 1, complexity: 1, stresses: [], cue: "Body rigid, pull your chest to the bar." },
  { id: "band_row", name: "Band Row", pattern: "h_pull", primary: ["back"], secondary: ["biceps"], equipment: ["bands"], qualities: ["hypertrophy", "resilience"], kind: "compound", loadType: "bodyweight", increment: 0, fatigue: 1, complexity: 1, stresses: [], cue: "Pause with the band at your ribs." },

  // ── Vertical pull ───────────────────────────────────────────────
  { id: "pull_up", name: "Pull-Up", pattern: "v_pull", primary: ["back", "biceps"], secondary: ["forearms", "core"], equipment: ["pullup_bar"], qualities: ["max_strength", "grip", "hypertrophy"], kind: "compound", loadType: "bodyweight", increment: 2.5, fatigue: 2, complexity: 2, stresses: ["elbow", "shoulder"], benchmark: "pull_up", cue: "Start from a dead hang, pull your chest toward the bar." },
  { id: "lat_pulldown", name: "Lat Pulldown", pattern: "v_pull", primary: ["back"], secondary: ["biceps"], equipment: ["cable"], qualities: ["hypertrophy"], kind: "compound", loadType: "machine", increment: 5, fatigue: 1, complexity: 1, stresses: [], cue: "Drive elbows down to your pockets." },
  { id: "band_pulldown", name: "Band Pulldown", pattern: "v_pull", primary: ["back"], secondary: ["biceps"], equipment: ["bands"], qualities: ["hypertrophy"], kind: "compound", loadType: "bodyweight", increment: 0, fatigue: 1, complexity: 1, stresses: [], cue: "Kneel tall, pull the band to your collarbones." },

  // ── Isolation: arms & shoulders ─────────────────────────────────
  { id: "db_curl", name: "Dumbbell Curl", pattern: "iso_arms", primary: ["biceps"], secondary: ["forearms"], equipment: ["dumbbell"], qualities: ["hypertrophy"], kind: "isolation", loadType: "dumbbell", increment: 1, fatigue: 1, complexity: 1, stresses: ["elbow"], cue: "Elbows still, full squeeze at the top." },
  { id: "hammer_curl", name: "Hammer Curl", pattern: "iso_arms", primary: ["biceps", "forearms"], secondary: [], equipment: ["dumbbell"], qualities: ["hypertrophy", "grip"], kind: "isolation", loadType: "dumbbell", increment: 1, fatigue: 1, complexity: 1, stresses: ["elbow"], cue: "Neutral grip, control the lowering." },
  { id: "cable_pushdown", name: "Cable Pushdown", pattern: "iso_arms", primary: ["triceps"], secondary: [], equipment: ["cable"], qualities: ["hypertrophy"], kind: "isolation", loadType: "machine", increment: 2.5, fatigue: 1, complexity: 1, stresses: ["elbow"], cue: "Pin the elbows, lock out fully." },
  { id: "overhead_db_extension", name: "Overhead Triceps Extension", pattern: "iso_arms", primary: ["triceps"], secondary: [], equipment: ["dumbbell"], qualities: ["hypertrophy"], kind: "isolation", loadType: "dumbbell", increment: 1, fatigue: 1, complexity: 1, stresses: ["elbow", "shoulder"], cue: "Deep stretch behind the head, elbows forward." },
  { id: "lateral_raise", name: "Lateral Raise", pattern: "iso_shoulders", primary: ["shoulders"], secondary: [], equipment: ["dumbbell"], qualities: ["hypertrophy"], kind: "isolation", loadType: "dumbbell", increment: 1, fatigue: 1, complexity: 1, stresses: [], cue: "Lead with the elbows, stop at shoulder height." },
  { id: "face_pull", name: "Face Pull", pattern: "iso_shoulders", primary: ["shoulders", "back"], secondary: [], equipment: ["cable"], qualities: ["resilience", "hypertrophy"], kind: "isolation", loadType: "machine", increment: 2.5, fatigue: 1, complexity: 1, stresses: [], cue: "Pull to your eyes, thumbs back." },
  { id: "band_pull_apart", name: "Band Pull-Apart", pattern: "iso_shoulders", primary: ["shoulders", "back"], secondary: [], equipment: ["bands"], qualities: ["resilience"], kind: "isolation", loadType: "bodyweight", increment: 0, fatigue: 1, complexity: 1, stresses: [], cue: "Arms long, spread the band to your chest." },
  { id: "farmer_carry", name: "Farmer Carry", pattern: "carry", primary: ["forearms", "core"], secondary: ["back", "glutes"], equipment: ["dumbbell"], qualities: ["grip", "core_stability", "resilience"], kind: "compound", loadType: "dumbbell", increment: 2, fatigue: 2, complexity: 1, stresses: [], cue: "Tall, quiet steps, crush the handles." },
  { id: "suitcase_carry", name: "Suitcase Carry", pattern: "carry", primary: ["core", "forearms"], secondary: [], equipment: ["kettlebell"], qualities: ["core_stability", "grip"], kind: "compound", loadType: "dumbbell", increment: 4, fatigue: 1, complexity: 1, stresses: [], cue: "One heavy bell, don't lean." },
  { id: "dead_hang", name: "Dead Hang", pattern: "carry", primary: ["forearms"], secondary: ["back"], equipment: ["pullup_bar"], qualities: ["grip", "mobility"], kind: "isolation", loadType: "timed", increment: 0, fatigue: 1, complexity: 1, stresses: [], cue: "Active shoulders, breathe." },

  // ── Legs isolation & calves ─────────────────────────────────────
  { id: "leg_extension", name: "Leg Extension", pattern: "iso_legs", primary: ["quads"], secondary: [], equipment: ["machine"], qualities: ["hypertrophy"], kind: "isolation", loadType: "machine", increment: 5, fatigue: 1, complexity: 1, stresses: ["knee"], cue: "Pause at the top, slow down." },
  { id: "leg_curl", name: "Seated Leg Curl", pattern: "iso_legs", primary: ["hamstrings"], secondary: [], equipment: ["machine"], qualities: ["hypertrophy", "resilience"], kind: "isolation", loadType: "machine", increment: 5, fatigue: 1, complexity: 1, stresses: [], cue: "Lean forward slightly, curl fully." },
  { id: "standing_calf_raise", name: "Standing Calf Raise", pattern: "calves", primary: ["calves"], secondary: [], equipment: ["dumbbell"], qualities: ["hypertrophy", "resilience"], kind: "isolation", loadType: "dumbbell", increment: 2, fatigue: 1, complexity: 1, stresses: ["ankle"], cue: "Full stretch at the bottom, pause at the top." },
  { id: "pogo_hops", name: "Pogo Hops", pattern: "calves", primary: ["calves"], secondary: [], equipment: ["bodyweight"], qualities: ["power", "speed", "resilience"], kind: "power", loadType: "timed", increment: 0, fatigue: 1, complexity: 1, stresses: ["ankle"], cue: "Stiff ankles, quick contacts." },

  // ── Core ────────────────────────────────────────────────────────
  { id: "plank", name: "Plank", pattern: "core_anti", primary: ["core"], secondary: [], equipment: ["bodyweight"], qualities: ["core_stability"], kind: "isolation", loadType: "timed", increment: 0, fatigue: 1, complexity: 1, stresses: [], cue: "Squeeze glutes, ribs down, push the floor away." },
  { id: "dead_bug", name: "Dead Bug", pattern: "core_anti", primary: ["core"], secondary: [], equipment: ["bodyweight"], qualities: ["core_stability"], kind: "isolation", loadType: "bodyweight", increment: 0, fatigue: 1, complexity: 1, stresses: [], cue: "Low back glued to the floor, move slowly." },
  { id: "pallof_press", name: "Pallof Press", pattern: "core_anti", primary: ["core"], secondary: [], equipment: ["cable"], qualities: ["core_stability", "rotational_power"], kind: "isolation", loadType: "machine", increment: 2.5, fatigue: 1, complexity: 1, stresses: [], cue: "Press out and resist the twist." },
  { id: "band_pallof", name: "Band Pallof Press", pattern: "core_anti", primary: ["core"], secondary: [], equipment: ["bands"], qualities: ["core_stability", "rotational_power"], kind: "isolation", loadType: "bodyweight", increment: 0, fatigue: 1, complexity: 1, stresses: [], cue: "Press out and resist the twist." },
  { id: "hanging_knee_raise", name: "Hanging Knee Raise", pattern: "core_anti", primary: ["core"], secondary: ["forearms"], equipment: ["pullup_bar"], qualities: ["core_stability", "grip"], kind: "isolation", loadType: "bodyweight", increment: 0, fatigue: 1, complexity: 1, stresses: [], cue: "Curl the pelvis up, no swinging." },
  { id: "side_plank", name: "Side Plank", pattern: "core_anti", primary: ["core"], secondary: ["glutes"], equipment: ["bodyweight"], qualities: ["core_stability", "resilience"], kind: "isolation", loadType: "timed", increment: 0, fatigue: 1, complexity: 1, stresses: [], cue: "Stack hips, push up through the bottom elbow." },
  { id: "cable_woodchop", name: "Cable Woodchop", pattern: "rotation", primary: ["core"], secondary: ["shoulders", "glutes"], equipment: ["cable"], qualities: ["rotational_power", "core_stability"], kind: "power", loadType: "machine", increment: 2.5, fatigue: 1, complexity: 1, stresses: ["lower_back"], cue: "Rotate through the hips, arms just follow." },
  { id: "landmine_rotation", name: "Landmine Rotation", pattern: "rotation", primary: ["core"], secondary: ["shoulders", "glutes"], equipment: ["barbell"], qualities: ["rotational_power", "core_stability"], kind: "power", loadType: "barbell", increment: 2.5, fatigue: 1, complexity: 2, stresses: ["lower_back"], cue: "Pivot the back foot, drive from the hips." },
  { id: "russian_twist", name: "Weighted Russian Twist", pattern: "rotation", primary: ["core"], secondary: [], equipment: ["dumbbell"], qualities: ["rotational_power"], kind: "isolation", loadType: "dumbbell", increment: 1, fatigue: 1, complexity: 1, stresses: ["lower_back"], cue: "Tall chest, rotate the ribs, not just the arms." },

  // ── Power: jumps & throws ───────────────────────────────────────
  { id: "box_jump", name: "Box Jump", pattern: "jump", primary: ["quads", "glutes"], secondary: ["calves"], equipment: ["box"], qualities: ["power", "speed"], kind: "power", loadType: "bodyweight", increment: 0, fatigue: 1, complexity: 1, stresses: ["knee", "ankle"], cue: "Jump high, land soft and quiet, step down." },
  { id: "broad_jump", name: "Broad Jump", pattern: "jump", primary: ["glutes", "quads"], secondary: ["hamstrings"], equipment: ["bodyweight"], qualities: ["power", "speed"], kind: "power", loadType: "bodyweight", increment: 0, fatigue: 1, complexity: 1, stresses: ["knee", "ankle"], cue: "Big arm swing, stick the landing." },
  { id: "squat_jump", name: "Countermovement Jump", pattern: "jump", primary: ["quads", "glutes"], secondary: ["calves"], equipment: ["bodyweight"], qualities: ["power"], kind: "power", loadType: "bodyweight", increment: 0, fatigue: 1, complexity: 1, stresses: ["knee", "ankle"], cue: "Quick dip, explode, reset between reps." },
  { id: "lateral_bound", name: "Lateral Bound", pattern: "jump", primary: ["glutes", "quads"], secondary: ["calves"], equipment: ["bodyweight"], qualities: ["power", "unilateral", "speed"], kind: "power", loadType: "bodyweight", increment: 0, fatigue: 1, complexity: 2, stresses: ["knee", "ankle"], cue: "Push sideways off one leg, stick on the other." },
  { id: "med_ball_rot_throw", name: "Rotational Med Ball Throw", pattern: "throw", primary: ["core"], secondary: ["shoulders", "glutes"], equipment: ["medball"], qualities: ["rotational_power", "power"], kind: "power", loadType: "bodyweight", increment: 0, fatigue: 1, complexity: 1, stresses: [], cue: "Load the back hip, throw through the wall." },
  { id: "med_ball_slam", name: "Med Ball Slam", pattern: "throw", primary: ["core", "back"], secondary: ["shoulders"], equipment: ["medball"], qualities: ["power", "conditioning"], kind: "power", loadType: "bodyweight", increment: 0, fatigue: 1, complexity: 1, stresses: [], cue: "Reach tall, slam through the floor." },
  { id: "med_ball_chest_pass", name: "Med Ball Chest Pass", pattern: "throw", primary: ["chest", "triceps"], secondary: ["core"], equipment: ["medball"], qualities: ["power", "speed"], kind: "power", loadType: "bodyweight", increment: 0, fatigue: 1, complexity: 1, stresses: ["wrist"], cue: "Step and punch the ball to the wall." },
  { id: "plyo_push_up", name: "Plyometric Push-Up", pattern: "throw", primary: ["chest", "triceps"], secondary: ["shoulders"], equipment: ["bodyweight"], qualities: ["power", "speed"], kind: "power", loadType: "bodyweight", increment: 0, fatigue: 1, complexity: 2, stresses: ["wrist", "shoulder"], cue: "Push fast enough that the hands leave the floor." },
  { id: "hang_power_clean", name: "Hang Power Clean", pattern: "jump", primary: ["glutes", "hamstrings", "back"], secondary: ["quads", "shoulders"], equipment: ["barbell"], qualities: ["power", "speed"], kind: "power", loadType: "barbell", increment: 2.5, fatigue: 2, complexity: 3, stresses: ["wrist", "lower_back"], cue: "Jump the bar up, fast elbows." },

  // ── Speed & conditioning ────────────────────────────────────────
  { id: "sprint_accel", name: "Acceleration Sprints (10–20 m)", pattern: "sprint", primary: ["glutes", "hamstrings", "quads"], secondary: ["calves"], equipment: ["bodyweight"], qualities: ["speed", "power"], kind: "power", loadType: "timed", increment: 0, fatigue: 2, complexity: 1, stresses: ["hip", "ankle"], cue: "Lean forward, punch the knees, full recovery between reps." },
  { id: "shuttle_run", name: "5-10-5 Shuttle Repeats", pattern: "conditioning", primary: ["quads", "glutes"], secondary: ["calves"], equipment: ["bodyweight"], qualities: ["speed", "conditioning"], kind: "conditioning", loadType: "timed", increment: 0, fatigue: 2, complexity: 1, stresses: ["knee", "ankle"], cue: "Low hips on the turn, plant and drive." },
  { id: "bike_intervals", name: "Bike Intervals", pattern: "conditioning", primary: ["quads"], secondary: ["glutes", "calves"], equipment: ["bike"], qualities: ["conditioning"], kind: "conditioning", loadType: "timed", increment: 0, fatigue: 2, complexity: 1, stresses: [], cue: "Hard efforts, easy spin between." },
  { id: "row_intervals", name: "Rower Intervals", pattern: "conditioning", primary: ["back", "quads"], secondary: ["hamstrings", "biceps"], equipment: ["rower"], qualities: ["conditioning"], kind: "conditioning", loadType: "timed", increment: 0, fatigue: 2, complexity: 1, stresses: ["lower_back"], cue: "Legs, body, arms. Arms, body, legs." },
  { id: "shadow_boxing", name: "Shadow Boxing Rounds", pattern: "conditioning", primary: ["shoulders", "core"], secondary: ["calves"], equipment: ["bodyweight"], qualities: ["conditioning", "speed"], kind: "conditioning", loadType: "timed", increment: 0, fatigue: 1, complexity: 1, stresses: [], cue: "Stay light on your feet, snap the punches back." },
  { id: "burpee_intervals", name: "Burpee Intervals", pattern: "conditioning", primary: ["chest", "quads"], secondary: ["core", "shoulders"], equipment: ["bodyweight"], qualities: ["conditioning"], kind: "conditioning", loadType: "timed", increment: 0, fatigue: 2, complexity: 1, stresses: ["wrist", "knee"], cue: "Steady rhythm you can hold for every round." },
  { id: "tempo_run", name: "Tempo Run", pattern: "conditioning", primary: ["quads", "calves"], secondary: ["hamstrings", "glutes"], equipment: ["bodyweight"], qualities: ["conditioning"], kind: "conditioning", loadType: "timed", increment: 0, fatigue: 2, complexity: 1, stresses: ["knee", "ankle"], cue: "Comfortably hard. You can speak in short phrases." },
  { id: "zone2_bike", name: "Easy Aerobic Bike", pattern: "conditioning", primary: ["quads"], secondary: ["calves"], equipment: ["bike"], qualities: ["conditioning"], kind: "conditioning", loadType: "timed", increment: 0, fatigue: 1, complexity: 1, stresses: [], cue: "Nose-breathing pace. Easy is the point." },
  { id: "brisk_walk", name: "Brisk Walk or Easy Jog", pattern: "conditioning", primary: ["calves"], secondary: ["quads"], equipment: ["bodyweight"], qualities: ["conditioning"], kind: "conditioning", loadType: "timed", increment: 0, fatigue: 1, complexity: 1, stresses: [], cue: "Conversational pace." },

  // ── Neck (MMA) ──────────────────────────────────────────────────
  { id: "neck_iso", name: "Neck Isometric Holds", pattern: "neck", primary: ["core"], secondary: ["shoulders"], equipment: ["bodyweight"], qualities: ["resilience"], kind: "isolation", loadType: "timed", increment: 0, fatigue: 1, complexity: 1, stresses: ["neck"], cue: "Hand against head, gentle pressure, no movement. Front, back, sides." },

  // ── Mobility ────────────────────────────────────────────────────
  { id: "hip_flow", name: "Hip Mobility Flow (90/90)", pattern: "mobility", primary: ["glutes"], secondary: ["core"], equipment: ["bodyweight"], qualities: ["mobility"], kind: "mobility", loadType: "timed", increment: 0, fatigue: 1, complexity: 1, stresses: [], cue: "Slow transitions, breathe into each end range." },
  { id: "thoracic_rotation", name: "Thoracic Rotations", pattern: "mobility", primary: ["back"], secondary: ["shoulders"], equipment: ["bodyweight"], qualities: ["mobility"], kind: "mobility", loadType: "timed", increment: 0, fatigue: 1, complexity: 1, stresses: [], cue: "Hips still, rotate through the upper back." },
  { id: "worlds_greatest", name: "World's Greatest Stretch", pattern: "mobility", primary: ["hamstrings", "glutes"], secondary: ["back"], equipment: ["bodyweight"], qualities: ["mobility"], kind: "mobility", loadType: "timed", increment: 0, fatigue: 1, complexity: 1, stresses: [], cue: "Lunge, elbow to instep, rotate and reach." },
  { id: "ankle_mobility", name: "Knee-to-Wall Ankle Mobility", pattern: "mobility", primary: ["calves"], secondary: [], equipment: ["bodyweight"], qualities: ["mobility"], kind: "mobility", loadType: "timed", increment: 0, fatigue: 1, complexity: 1, stresses: [], cue: "Drive the knee over the toes, heel down." },
];

const BY_ID = new Map(EXERCISES.map((e) => [e.id, e]));

export function getExercise(id: string): Exercise {
  const ex = BY_ID.get(id);
  if (!ex) throw new Error(`Unknown exercise: ${id}`);
  return ex;
}

export function findExercise(id: string): Exercise | undefined {
  return BY_ID.get(id);
}

export const EQUIPMENT_PRESETS: Record<EquipmentPreset, { label: string; detail: string; equipment: Equipment[] }> = {
  full_gym: {
    label: "Full gym",
    detail: "Barbells, machines, cables and dumbbells",
    equipment: ["barbell", "dumbbell", "kettlebell", "machine", "cable", "bench", "pullup_bar", "bands", "medball", "box", "bike", "rower", "bodyweight"],
  },
  home_gym: {
    label: "Home setup",
    detail: "Dumbbells, a bench, a pull-up bar and bands",
    equipment: ["dumbbell", "kettlebell", "bench", "pullup_bar", "bands", "medball", "box", "bodyweight"],
  },
  minimal: {
    label: "Bodyweight",
    detail: "Little or no equipment",
    equipment: ["bodyweight", "bands"],
  },
};

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  barbell: "Barbell & plates",
  dumbbell: "Dumbbells",
  kettlebell: "Kettlebells",
  machine: "Machines",
  cable: "Cable station",
  bench: "Bench",
  pullup_bar: "Pull-up bar",
  bands: "Resistance bands",
  medball: "Medicine ball",
  box: "Plyo box",
  bike: "Bike",
  rower: "Rower",
  bodyweight: "Bodyweight",
};

export function isAvailable(ex: Exercise, equipment: Equipment[]): boolean {
  const have = new Set<Equipment>([...equipment, "bodyweight"]);
  // Dumbbell work can be done with kettlebells too; keep it simple and strict otherwise.
  return ex.equipment.every((e) => have.has(e) || (e === "dumbbell" && have.has("kettlebell")) || (e === "kettlebell" && have.has("dumbbell")));
}
