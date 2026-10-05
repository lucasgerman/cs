// Global tuning constants. Units: meters, seconds, degrees where noted.
export const WALL_H = 5;          // height of map walls
export const GRAVITY = 20;        // m/s^2 (CS: 800 u/s^2)
export const STEP_H = 0.55;       // max step-up height while on ground
export const U = 1 / 40;          // CS units -> meters (1.8m player = 72u)

export const PLAYER = {
  radius: 0.35,
  height: 1.8,
  eye: 1.62,
  crouchEye: 1.05,
  jump: 7.0,
  walkMul: 0.52,
  crouchMul: 0.34,
  accel: 80,
  friction: 10,
  airAccel: 22,
  airMax: 1.0,
};

export const ROUND = {
  freeze: 10,
  live: 115,
  bomb: 40,
  end: 6,
  buyTime: 20,
  plant: 3.2,
  defuse: 10,
  defuseKit: 5,
};

export const ECON = {
  start: 800,
  max: 16000,
  win: 3250,
  winBomb: 3500,
  loss: [1400, 1900, 2400, 2900, 3400],
  plant: 300,
  lossPlantBonus: 800,
};

export const MATCH = { halfRounds: 12, winRounds: 13, otRounds: 3 };

export const DIFFICULTY = {
  easy:   { reaction: 0.9,  aimSigma: 5.0, turnSpeed: 220, hsChance: 0.05, settle: 0.7, burst: 0.3, sight: 45 },
  normal: { reaction: 0.5,  aimSigma: 2.6, turnSpeed: 420, hsChance: 0.15, settle: 1.3, burst: 0.5, sight: 60 },
  hard:   { reaction: 0.25, aimSigma: 1.3, turnSpeed: 800, hsChance: 0.30, settle: 2.2, burst: 0.7, sight: 80 },
  expert: { reaction: 0.15, aimSigma: 0.8, turnSpeed: 1100, hsChance: 0.45, settle: 3.0, burst: 0.8, sight: 95 },
};

export const BOT_NAMES = [
  'Viktor', 'Sasha', 'Mateo', 'Kenji', 'Dmitri', 'Lucas', 'Aiden', 'Rafael', 'Nikolai', 'Omar',
  'Ivan', 'Tomas', 'Felix', 'Marco', 'Jonas', 'Elias', 'Hugo', 'Pavel', 'Bruno', 'Yuri',
];
