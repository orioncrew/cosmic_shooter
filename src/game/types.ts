// Types and constants for Space Shooter

export const CANVAS_WIDTH = 900;
export const CANVAS_HEIGHT = 700;

export type Difficulty = 'easy' | 'normal' | 'hard';

export type WeaponType = 'machinegun' | 'laser' | 'rockets';
export type ShieldType = 'immortality' | 'killRing' | 'oneTime';
export type UltimateType = 'bomb' | 'meteor' | 'companion';

export interface Vec2 {
  x: number;
  y: number;
}

export interface Star {
  x: number;
  y: number;
  speed: number;
  size: number;
  brightness: number;
}

export interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  radius: number;
  color: string;
  isPlayer: boolean;
  piercing?: boolean;
  homing?: boolean;
  explosionRadius?: number;
  targetId?: number;
}

export interface Explosion {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  color: string;
}

export interface Pickup {
  x: number;
  y: number;
  vy: number;
  type: 'weapon' | 'shield' | 'ultimate' | 'health' | 'score' | 'multiplier';
  subtype: string;
  radius: number;
  color: string;
  label: string;
  pulsePhase: number;
}

export interface Player {
  x: number;
  y: number;
  width: number;
  height: number;
  lives: number;
  maxLives: number;
  score: number;
  scoreMultiplier: number;
  multiplierTimer: number;
  weapon: WeaponType;
  weaponLevel: number;
  shield: ShieldType | null;
  shieldTimer: number;
  oneTimeShields: number;
  ultimate: UltimateType | null;
  invincibleTimer: number;
  shootCooldown: number;
  laserBurstCount: number;
  laserBurstTimer: number;
  nextLifeAt: number; // порог очков для следующей дополнительной жизни
}

export interface Enemy {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  hp: number;
  maxHp: number;
  speed: number;
  type: number; // 1-6
  hasShield: boolean;
  shieldRegenTimer: number;
  shootTimer: number;
  shootInterval: number;
  color: string;
  points: number;
  isBoss: boolean;
  bossPhase: number;
  bossPhaseTimer: number;
  movePattern: number;
  moveTimer: number;
  angle: number;
}

export interface Companion {
  x: number;
  y: number;
  angle: number;
  orbitRadius: number;
  timer: number;
  shootTimer: number;
  weapon: WeaponType;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface GameStats {
  enemiesKilled: number;
  bossesKilled: number;
  shotsFired: number;
  pickupsCollected: number;
  damageDealt: number;
  damageTaken: number;
  timePlayed: number;
  maxScore: number;
  waveReached: number;
}

export const DIFFICULTY_SETTINGS = {
  easy: { enemyHpMult: 0.7, enemySpeedMult: 0.8, spawnRate: 0.8, scoreMult: 0.8 },
  normal: { enemyHpMult: 1.0, enemySpeedMult: 1.0, spawnRate: 1.0, scoreMult: 1.0 },
  hard: { enemyHpMult: 1.5, enemySpeedMult: 1.2, spawnRate: 1.3, scoreMult: 1.5 },
};

export const WEAPON_COLORS: Record<WeaponType, string> = {
  machinegun: '#ffff00',
  laser: '#00ffff',
  rockets: '#ff6600',
};

export const SHIELD_COLORS: Record<ShieldType, string> = {
  immortality: '#ff00ff',
  killRing: '#ff4444',
  oneTime: '#44ff44',
};

export const ULTIMATE_COLORS: Record<UltimateType, string> = {
  bomb: '#ff0000',
  meteor: '#ffaa00',
  companion: '#aa00ff',
};
