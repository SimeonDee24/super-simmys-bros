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

  // --- Defence (used from milestone 3) ---
  PARRY_WINDOW: 5,          // frames after releasing shield that still parry

  // --- Ledges ---
  LEDGE_REACH_X: 16,        // px outside the ledge where it can be grabbed
  LEDGE_INSIDE_X: 2,        // px past the ledge (over the stage) that still grab
  LEDGE_REACH_Y: 14,        // px above/below the ledge the hands can be
  LEDGE_REGRAB_FRAMES: 30,  // frames after letting go before regrabbing

  // --- Match rules ---
  DEFAULT_STOCKS: 3,
  RESPAWN_INVULN: 120,      // frames of invincibility after respawning

  // --- Camera (render only, never affects the simulation) ---
  CAMERA: { maxPanX: 14, maxPanY: 8, followDiv: 8, ease: 0.08 },

  // --- Updates ---
  UPDATE_CHECK_SECONDS: 60, // how often the title screen looks for a new version
};
