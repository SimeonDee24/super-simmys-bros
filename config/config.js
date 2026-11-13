// Global tunable values. Character-specific numbers live in /characters,
// stage-specific numbers in /stages.
export const CONFIG = {
  GAME_TITLE: "SUPER SIMMY'S BROS",

  // --- Simulation ---
  TICK_RATE: 60,            // fixed simulation ticks per second
  MAX_CATCHUP_TICKS: 5,     // max sim ticks run in one rendered frame
  DEFAULT_SEED: 0x5eed1234, // RNG seed for a match

  // --- Screen ---
  SCREEN_W: 480,
  SCREEN_H: 270,

  // --- Input feel ---
  DOUBLE_TAP_WINDOW: 12,    // frames allowed between two taps to dash
  BUFFER_FRAMES: 9,         // a jump, attack or dash pressed up to this many frames
                            // too early still comes out on the first possible frame

  // --- Shield ---
  // Shield health is in thousandths of a percent: 50000 = 50 HP, like Smash.
  SHIELD_MAX: 50000,
  SHIELD_DEPLETE: 150,      // lost per frame while held (0.15 HP)
  SHIELD_REGEN: 80,         // regained per frame while not shielding (0.08 HP)
  SHIELD_DMG_MULT: 119,     // shield damage = attack damage x 1.19
  SHIELD_MIN_R: 6,          // bubble radius in px when almost broken...
  SHIELD_MAX_R: 17,         // ...and when full
  SHIELD_DROP_FRAMES: 11,   // lag after letting go of shield
  SHIELDSTUN_MULT: 58,      // shield stun = damage% x 0.58 + 2 frames
  SHIELD_PUSH_BASE: 128,    // pushback speed (1/256 px per frame) = base + per% x damage
  SHIELD_PUSH_PER_PCT: 23,
  SHIELD_BREAK_VEL: 1400,   // launch speed upward on shield break (1/256 px per frame)
  SHIELD_BREAK_STUN: 240,   // frames dizzy after a shield break (mashing shortens it)
  SHIELD_BREAK_MASH: 3,     // frames taken off per button press while dizzy
  SHIELD_BREAK_REFILL: 18750, // shield health after recovering from a break (37.5%)

  // --- Parry ---
  PARRY_WINDOW: 5,          // frames after releasing shield that still parry
  PARRY_FREEZE: 20,         // extra frames the attacker stays frozen after being parried

  // --- Grabs ---
  GRAB_TIME_BASE: 90,       // frames a grab lasts at 0%...
  GRAB_TIME_PER_PCT: 1,     // ...plus this many frames per 1% of the victim's damage
  GRAB_MASH: 4,             // frames taken off per button or direction pressed while held
  GRAB_RELEASE_GRABBER: 18, // lag for the grabber when the victim breaks free
  GRAB_RELEASE_VICTIM: 12,  // lag for the victim (less, so breaking free is rewarded)
  GRAB_RELEASE_PUSH: 400,   // how hard they are pushed apart (1/256 px per frame)
  HOLD_DISTANCE: 16,        // px in front of the grabber where the held opponent is

  // --- Air dodge ---
  AIRDODGE_LAND_LAG: 11,    // landing lag if you hit the floor during an air dodge

  // --- Hits and knockback ---
  // launch speed (px/frame) = knockback * KB_SPEED_NUM / KB_SPEED_DEN / 256
  KB_SPEED_NUM: 1344, KB_SPEED_DEN: 100000,   // = 0.0525 px per knockback unit
  KB_DECAY: 23,             // launch speed lost per frame (1/256 px) = 0.09 px
  HITSTUN_NUM: 4, HITSTUN_DEN: 10000,         // hitstun frames = knockback * 0.4
  HITLAG_BASE: 3,           // freeze frames on any hit...
  HITLAG_PER_DMG: 35,       // ...plus 0.35 frames per 1% damage
  HITLAG_MAX: 20,           // (a hitbox can scale its own with lagMult, e.g. 200 for smashes)
  TUMBLE_KB: 80000,         // knockback (thousandths) at which the victim tumbles
  SAKURAI: { lowKb: 60000, highKb: 88000, ground: 38, air: 45 },
  SPECIAL_LAND_LAG: 10,     // landing lag for an air special that sets none of its own
  HITSTUN_LAND_LAG: 8,      // landing lag when hitting the floor during light hitstun
  // Landing while tumbling knocks you down (teching arrives with milestone 3).
  KNOCKDOWN_MIN: 18,        // frames lying down before you can choose a getup
  KNOCKDOWN_MAX: 90,        // after this, you stand up automatically
  GETUP_INTANGIBLE: 20,     // frames you cannot be hit while standing up or rolling
  GETUP_STAND_FRAMES: 25,

  // --- Body push ---
  // Standing fighters cannot walk or run through each other: they push.
  PUSH_WIDTH: 12,           // px apart at which two grounded fighters start to push
  PUSH_RATE: 80,            // gentle push per frame while slightly overlapping (1/256 px)
  PUSH_HARD: 6,             // px: never closer than this; the runner pushes the other along

  // --- Ledges ---
  LEDGE_REACH_X: 20,        // px outside the ledge where it can be grabbed
  LEDGE_INSIDE_X: 2,        // px past the ledge (over the stage) that still grab
  LEDGE_REACH_Y: 18,        // px above/below the ledge the hands can be
  LEDGE_REGRAB_FRAMES: 30,
  // Grabbing a ledge makes you intangible for a moment, like Smash. Each
  // regrab without touching the stage (or being hit) gives less.
  LEDGE_INTANGIBLE: [60, 35, 12],  // 1st, 2nd, 3rd grab; after that, none  // frames after letting go before regrabbing

  // --- Match rules ---
  DEFAULT_STOCKS: 3,
  KO_RESPAWN_DELAY: 55,     // frames between the KO blast and reappearing
  RESPAWN_DESCEND: 30,      // frames the respawn platform takes to float down
  RESPAWN_DROP_PX: 60,      // how far above its resting spot the platform starts
  RESPAWN_PLATFORM_FRAMES: 180, // max frames you can stay on the platform
  RESPAWN_SLOT_OFFSET: 26,  // px each player's platform sits from the centre
  RESPAWN_INVULN: 120,      // frames of invincibility after leaving the platform
  GAME_END_FRAMES: 150,     // how long GAME! shows before leaving the match

  // --- Camera (render only, never affects the simulation) ---
  CAMERA: { maxPanX: 14, maxPanY: 8, followDiv: 8, ease: 0.08 },

  // --- Updates ---
  UPDATE_CHECK_SECONDS: 60, // how often the title screen looks for a new version
};
