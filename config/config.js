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

  // --- Defence (used from milestone 3) ---
  PARRY_WINDOW: 5,          // frames after releasing shield that still parry

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
  HITSTUN_LAND_LAG: 8,      // landing lag when hitting the floor during light hitstun
  // Landing while tumbling knocks you down (teching arrives with milestone 3).
  KNOCKDOWN_MIN: 18,        // frames lying down before you can choose a getup
  KNOCKDOWN_MAX: 90,        // after this, you stand up automatically
  GETUP_INTANGIBLE: 20,     // frames you cannot be hit while standing up or rolling
  GETUP_STAND_FRAMES: 25,

  // --- Ledges ---
  LEDGE_REACH_X: 16,        // px outside the ledge where it can be grabbed
  LEDGE_INSIDE_X: 2,        // px past the ledge (over the stage) that still grab
  LEDGE_REACH_Y: 14,        // px above/below the ledge the hands can be
  LEDGE_REGRAB_FRAMES: 30,  // frames after letting go before regrabbing

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
