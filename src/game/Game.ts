import {
  CANVAS_WIDTH, CANVAS_HEIGHT, Difficulty, WeaponType, ShieldType, UltimateType,
  Star, Bullet, Explosion, Pickup, Player, Enemy, Companion, GameStats, Particle,
  DIFFICULTY_SETTINGS
} from './types';
import { audio } from './audio';

let nextEnemyId = 0;

export class Game {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  difficulty: Difficulty;
  diffSettings = DIFFICULTY_SETTINGS.normal;

  player: Player;
  enemies: Enemy[] = [];
  bullets: Bullet[] = [];
  explosions: Explosion[] = [];
  pickups: Pickup[] = [];
  stars: Star[] = [];
  particles: Particle[] = [];
  companion: Companion | null = null;

  keys: Set<string> = new Set();
  mouseDown = false;
  rightMouseDown = false;
  mouseX = 0;
  mouseY = 0;

  wave = 1;
  waveTimer = 0;
  waveEnemiesSpawned = 0;
  waveEnemiesTotal = 0;
  bossActive = false;
  bossDefeated = false;
  postBoss = false;
  spawnTimer = 0;
  gameTime = 0;
  gameOver = false;
  paused = false;

  stats: GameStats = {
    enemiesKilled: 0, bossesKilled: 0, shotsFired: 0,
    pickupsCollected: 0, damageDealt: 0, damageTaken: 0,
    timePlayed: 0, maxScore: 0, waveReached: 1
  };

  waveAnnouncement = '';
  waveAnnouncementTimer = 0;
  screenShake = 0;
  floatingTexts: { x: number; y: number; text: string; color: string; life: number }[] = [];

  onGameOver?: (stats: GameStats) => void;
  animationId = 0;
  lastTime = 0;
  handleContextMenu = (e: Event) => e.preventDefault();

  constructor(canvas: HTMLCanvasElement, difficulty: Difficulty) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.difficulty = difficulty;
    this.diffSettings = DIFFICULTY_SETTINGS[difficulty];

    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    this.player = this.createPlayer();
    this.initStars();
    this.startWave();

    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);

    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    canvas.addEventListener('mousedown', this.handleMouseDown);
    canvas.addEventListener('mouseup', this.handleMouseUp);
    canvas.addEventListener('mousemove', this.handleMouseMove);
    canvas.addEventListener('contextmenu', this.handleContextMenu);
  }

  createPlayer(): Player {
    return {
      x: CANVAS_WIDTH / 2,
      y: CANVAS_HEIGHT - 80,
      width: 40,
      height: 50,
      lives: 3,
      maxLives: 5,
      score: 0,
      scoreMultiplier: 1,
      multiplierTimer: 0,
      weapon: 'machinegun',
      weaponLevel: 1,
      shield: null,
      shieldTimer: 0,
      oneTimeShields: 0,
      ultimate: null,
      invincibleTimer: 0,
      shootCooldown: 0,
      laserBurstCount: 0,
      laserBurstTimer: 0,
      livesFromScore: 0,
    };
  }

  initStars() {
    this.stars = [];
    for (let i = 0; i < 100; i++) {
      this.stars.push({
        x: Math.random() * CANVAS_WIDTH,
        y: Math.random() * CANVAS_HEIGHT,
        speed: 0.5 + Math.random() * 2,
        size: 0.5 + Math.random() * 2,
        brightness: 0.3 + Math.random() * 0.7,
      });
    }
  }

  startWave() {
    this.waveEnemiesSpawned = 0;
    this.waveEnemiesTotal = 5 + this.wave * 3;
    this.waveTimer = 0;
    this.spawnTimer = 0;
    this.stats.waveReached = this.wave;
    this.waveAnnouncement = `⚔ ВОЛНА ${this.wave} ⚔`;
    this.waveAnnouncementTimer = 2;
  }

  handleKeyDown(e: KeyboardEvent) {
    this.keys.add(e.key.toLowerCase());
    if (e.key === 'p' || e.key === 'з') this.paused = !this.paused;
  }

  handleKeyUp(e: KeyboardEvent) {
    this.keys.delete(e.key.toLowerCase());
  }

  handleMouseDown(e: MouseEvent) {
    if (e.button === 0) this.mouseDown = true;
    if (e.button === 2) this.rightMouseDown = true;
  }

  handleMouseUp(e: MouseEvent) {
    if (e.button === 0) this.mouseDown = false;
    if (e.button === 2) this.rightMouseDown = false;
  }

  handleMouseMove(e: MouseEvent) {
    const rect = this.canvas.getBoundingClientRect();
    this.mouseX = (e.clientX - rect.left) * (CANVAS_WIDTH / rect.width);
    this.mouseY = (e.clientY - rect.top) * (CANVAS_HEIGHT / rect.height);
  }

  start() {
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  stop() {
    cancelAnimationFrame(this.animationId);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    this.canvas.removeEventListener('mousedown', this.handleMouseDown);
    this.canvas.removeEventListener('mouseup', this.handleMouseUp);
    this.canvas.removeEventListener('mousemove', this.handleMouseMove);
    this.canvas.removeEventListener('contextmenu', this.handleContextMenu);
  }

  loop = (time: number) => {
    const dt = Math.min((time - this.lastTime) / 1000, 0.05);
    this.lastTime = time;

    if (!this.paused && !this.gameOver) {
      this.update(dt);
    }
    this.render();
    this.animationId = requestAnimationFrame(this.loop);
  };

  update(dt: number) {
    this.gameTime += dt;
    this.stats.timePlayed = this.gameTime;

    this.updateStars(dt);
    this.updatePlayer(dt);
    this.updateBullets(dt);
    this.updateEnemies(dt);
    this.updateExplosions(dt);
    this.updatePickups(dt);
    this.updateParticles(dt);
    this.updateCompanion(dt);
    this.updateFloatingTexts(dt);
    this.checkCollisions();
    this.updateWave(dt);

    if (this.player.score > this.stats.maxScore) {
      this.stats.maxScore = this.player.score;
    }
  }

  updateStars(dt: number) {
    for (const star of this.stars) {
      star.y += star.speed * 60 * dt;
      if (star.y > CANVAS_HEIGHT) {
        star.y = 0;
        star.x = Math.random() * CANVAS_WIDTH;
      }
    }
  }

  updatePlayer(dt: number) {
    const p = this.player;
    const speed = 300;

    if (this.keys.has('w') || this.keys.has('ц')) p.y -= speed * dt;
    if (this.keys.has('s') || this.keys.has('ы')) p.y += speed * dt;
    if (this.keys.has('a') || this.keys.has('ф')) p.x -= speed * dt;
    if (this.keys.has('d') || this.keys.has('в')) p.x += speed * dt;

    p.x = Math.max(p.width / 2, Math.min(CANVAS_WIDTH - p.width / 2, p.x));
    p.y = Math.max(p.height / 2, Math.min(CANVAS_HEIGHT - p.height / 2, p.y));

    if (p.invincibleTimer > 0) p.invincibleTimer -= dt;
    if (p.shieldTimer > 0) {
      p.shieldTimer -= dt;
      if (p.shieldTimer <= 0) {
        if (p.shield === 'killRing') {
          p.shield = null;
        } else if (p.shield === 'immortality') {
          p.shield = null;
        }
      }
    }
    if (p.multiplierTimer > 0) {
      p.multiplierTimer -= dt;
      if (p.multiplierTimer <= 0) p.scoreMultiplier = 1;
    }
    if (p.shootCooldown > 0) p.shootCooldown -= dt;

    // Shooting
    if (this.mouseDown && p.shootCooldown <= 0) {
      this.playerShoot();
    }

    // Ultimate
    if (this.rightMouseDown && p.ultimate) {
      this.useUltimate();
      this.rightMouseDown = false;
    }

    // Kill ring shield effect
    if (p.shield === 'killRing' && p.shieldTimer > 0) {
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const e = this.enemies[i];
        if (e.isBoss) continue;
        const dx = e.x - p.x;
        const dy = e.y - p.y;
        if (Math.sqrt(dx * dx + dy * dy) < 120) {
          this.killEnemy(i);
        }
      }
    }
  }

  playerShoot() {
    const p = this.player;
    const level = p.weaponLevel;

    switch (p.weapon) {
      case 'machinegun': {
        const cooldown = Math.max(0.05, 0.12 - level * 0.01);
        p.shootCooldown = cooldown;
        const damage = 5 + level * 3;
        const speed = 600;
        
        // Center bullet(s)
        this.bullets.push({
          x: p.x, y: p.y - p.height / 2,
          vx: 0, vy: -speed, damage, radius: 3,
          color: '#ffff00', isPlayer: true
        });
        this.stats.shotsFired++;
        audio.shootMachinegun();

        if (level >= 2) {
          this.bullets.push({
            x: p.x - 10, y: p.y - p.height / 2 + 5,
            vx: -50, vy: -speed, damage, radius: 3,
            color: '#ffff00', isPlayer: true
          });
          this.bullets.push({
            x: p.x + 10, y: p.y - p.height / 2 + 5,
            vx: 50, vy: -speed, damage, radius: 3,
            color: '#ffff00', isPlayer: true
          });
        }
        if (level >= 3) {
          this.bullets.push({
            x: p.x - 15, y: p.y - p.height / 2 + 10,
            vx: -120, vy: -speed * 0.9, damage, radius: 3,
            color: '#ffff00', isPlayer: true
          });
          this.bullets.push({
            x: p.x + 15, y: p.y - p.height / 2 + 10,
            vx: 120, vy: -speed * 0.9, damage, radius: 3,
            color: '#ffff00', isPlayer: true
          });
        }
        if (level >= 4) {
          this.bullets.push({
            x: p.x, y: p.y + p.height / 2,
            vx: 0, vy: speed * 0.7, damage: damage * 0.5, radius: 3,
            color: '#ffaa00', isPlayer: true
          });
        }
        if (level >= 5) {
          this.bullets.push({
            x: p.x - 20, y: p.y,
            vx: -200, vy: -speed * 0.7, damage: damage * 0.7, radius: 3,
            color: '#ffff00', isPlayer: true
          });
          this.bullets.push({
            x: p.x + 20, y: p.y,
            vx: 200, vy: -speed * 0.7, damage: damage * 0.7, radius: 3,
            color: '#ffff00', isPlayer: true
          });
        }
        break;
      }
      case 'laser': {
        const cooldown = 0.3;
        p.shootCooldown = cooldown;
        const damage = 15 + level * 8;
        const speed = 800;
        const burstCount = Math.min(level, 5);

        // Основные выстрелы вверх
        for (let i = 0; i < burstCount; i++) {
          setTimeout(() => {
            if (this.gameOver) return;
            this.bullets.push({
              x: p.x, y: p.y - p.height / 2,
              vx: 0, vy: -speed, damage, radius: 4,
              color: '#00ffff', isPlayer: true, piercing: true
            });
            this.stats.shotsFired++;
            audio.shootLaser();
          }, i * 80);
        }

        // 3-й уровень: стрельба назад
        if (level >= 3) {
          setTimeout(() => {
            if (this.gameOver) return;
            this.bullets.push({
              x: p.x, y: p.y + p.height / 2,
              vx: 0, vy: speed * 0.7, damage: damage * 0.6, radius: 4,
              color: '#00cccc', isPlayer: true, piercing: true
            });
            this.stats.shotsFired++;
            audio.shootLaser();
          }, burstCount * 80);
        }

        // 5-й уровень: стрельба в стороны
        if (level >= 5) {
          setTimeout(() => {
            if (this.gameOver) return;
            // Влево
            this.bullets.push({
              x: p.x - p.width / 2, y: p.y,
              vx: -speed * 0.8, vy: 0, damage: damage * 0.5, radius: 4,
              color: '#00aaaa', isPlayer: true, piercing: true
            });
            // Вправо
            this.bullets.push({
              x: p.x + p.width / 2, y: p.y,
              vx: speed * 0.8, vy: 0, damage: damage * 0.5, radius: 4,
              color: '#00aaaa', isPlayer: true, piercing: true
            });
            this.stats.shotsFired += 2;
            audio.shootLaser();
          }, burstCount * 80 + 80);
        }
        break;
      }
      case 'rockets': {
        const cooldown = Math.max(0.3, 0.8 - level * 0.1);
        p.shootCooldown = cooldown;
        const damage = 20 + level * 10;
        const speed = 300;
        // 1-2 уровень: 1 ракета, 3-4 уровень: 2 ракеты, 5 уровень: 3 ракеты
        const count = level >= 5 ? 3 : level >= 3 ? 2 : 1;

        for (let i = 0; i < count; i++) {
          const angle = (i - (count - 1) / 2) * 0.3;
          this.bullets.push({
            x: p.x + (i - (count - 1) / 2) * 15,
            y: p.y - p.height / 2,
            vx: Math.sin(angle) * speed,
            vy: -Math.cos(angle) * speed,
            damage, radius: 5,
            color: '#ff6600', isPlayer: true,
            homing: true, explosionRadius: 40 + level * 10
          });
          this.stats.shotsFired++;
        }
        audio.shootRocket();
        break;
      }
    }
  }

  useUltimate() {
    const p = this.player;
    if (!p.ultimate) return;

    audio.ultimateActivate();

    switch (p.ultimate) {
      case 'bomb': {
        // Big damage in radius around player
        const radius = 200;
        for (let i = this.enemies.length - 1; i >= 0; i--) {
          const e = this.enemies[i];
          const dx = e.x - p.x;
          const dy = e.y - p.y;
          if (Math.sqrt(dx * dx + dy * dy) < radius) {
            this.damageEnemy(i, 100);
          }
        }
        this.explosions.push({
          x: p.x, y: p.y, radius: 0, maxRadius: radius,
          alpha: 1, color: '#ff4400'
        });
        audio.bigExplosion();
        break;
      }
      case 'meteor': {
        // Meteors across the screen
        for (let i = 0; i < 20; i++) {
          setTimeout(() => {
            if (this.gameOver) return;
            const mx = Math.random() * CANVAS_WIDTH;
            const my = 50 + Math.random() * (CANVAS_HEIGHT - 100);
            this.explosions.push({
              x: mx, y: my,
              radius: 0, maxRadius: 70, alpha: 1, color: '#ffaa00'
            });
            // Damage enemies in area
            for (let j = this.enemies.length - 1; j >= 0; j--) {
              const e = this.enemies[j];
              const dx = e.x - mx;
              const dy = e.y - my;
              if (Math.sqrt(dx * dx + dy * dy) < 80) {
                this.damageEnemy(j, 40);
              }
            }
            audio.explosion();
          }, i * 100);
        }
        break;
      }
      case 'companion': {
        this.companion = {
          x: p.x + 60,
          y: p.y,
          angle: 0,
          orbitRadius: 80,
          timer: 60,
          shootTimer: 0,
          weapon: ['machinegun', 'laser', 'rockets'][Math.floor(Math.random() * 3)] as WeaponType
        };
        break;
      }
    }
    p.ultimate = null;
  }

  updateBullets(dt: number) {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];

      if (b.homing && b.isPlayer) {
        // Find nearest enemy
        let nearest: Enemy | null = null;
        let minDist = Infinity;
        for (const e of this.enemies) {
          const dx = e.x - b.x;
          const dy = e.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < minDist) {
            minDist = dist;
            nearest = e;
          }
        }
        if (nearest) {
          const dx = nearest.x - b.x;
          const dy = nearest.y - b.y;
          const angle = Math.atan2(dy, dx);
          const speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
          const currentAngle = Math.atan2(b.vy, b.vx);
          const turnRate = 3 * dt;
          let angleDiff = angle - currentAngle;
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
          const newAngle = currentAngle + Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), turnRate);
          b.vx = Math.cos(newAngle) * speed;
          b.vy = Math.sin(newAngle) * speed;
        }
      }

      b.x += b.vx * dt;
      b.y += b.vy * dt;

      if (b.x < -20 || b.x > CANVAS_WIDTH + 20 || b.y < -20 || b.y > CANVAS_HEIGHT + 20) {
        this.bullets.splice(i, 1);
      }
    }
  }

  updateEnemies(dt: number) {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.moveTimer += dt;

      if (e.isBoss) {
        this.updateBoss(e, dt);
      } else {
        // Movement patterns
        e.y += e.speed * dt;
        if (e.movePattern === 1) {
          e.x += Math.sin(e.moveTimer * 2) * 100 * dt;
        } else if (e.movePattern === 2) {
          e.x += Math.cos(e.moveTimer * 1.5) * 150 * dt;
        }
        e.x = Math.max(e.width / 2, Math.min(CANVAS_WIDTH - e.width / 2, e.x));

        // Shooting
        if (e.shootInterval > 0) {
          e.shootTimer += dt;
          if (e.shootTimer >= e.shootInterval) {
            e.shootTimer = 0;
            this.enemyShoot(e);
          }
        }
      }

      // Shield regen for type 6
      if (e.type === 6 && !e.hasShield && e.shieldRegenTimer > 0) {
        e.shieldRegenTimer -= dt;
        if (e.shieldRegenTimer <= 0) {
          e.hasShield = true;
        }
      }

      // Remove if off screen
      if (e.y > CANVAS_HEIGHT + 50 && !e.isBoss) {
        this.enemies.splice(i, 1);
      }
    }
  }

  updateBoss(boss: Enemy, dt: number) {
    // Boss movement
    if (boss.y < 100) {
      boss.y += 50 * dt;
    } else {
      boss.x += Math.sin(boss.moveTimer * 0.8) * 120 * dt;
      boss.y = 100 + Math.sin(boss.moveTimer * 0.5) * 30;
    }
    boss.x = Math.max(boss.width, Math.min(CANVAS_WIDTH - boss.width, boss.x));

    // Boss shooting
    boss.shootTimer += dt;
    const shootInterval = boss.bossPhase >= 3 ? 0.3 : boss.bossPhase >= 2 ? 0.5 : 0.8;
    if (boss.shootTimer >= shootInterval) {
      boss.shootTimer = 0;
      this.bossShoot(boss);
    }

    // Phase transitions
    const hpPercent = boss.hp / boss.maxHp;
    if (hpPercent <= 0.25 && boss.bossPhase < 3) {
      boss.bossPhase = 3;
      boss.speed *= 1.3;
    } else if (hpPercent <= 0.5 && boss.bossPhase < 2) {
      boss.bossPhase = 2;
      boss.speed *= 1.2;
    } else if (hpPercent <= 0.75 && boss.bossPhase < 1) {
      boss.bossPhase = 1;
      boss.speed *= 1.1;
    }
  }

  bossShoot(boss: Enemy) {
    const phase = boss.bossPhase;
    const p = this.player;
    const angle = Math.atan2(p.y - boss.y, p.x - boss.x);
    const speed = 200;

    if (phase === 0) {
      // Single aimed shot
      this.bullets.push({
        x: boss.x, y: boss.y + boss.height / 2,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        damage: 1, radius: 5, color: '#ff0066', isPlayer: false
      });
    } else if (phase === 1) {
      // Spread shot
      for (let i = -2; i <= 2; i++) {
        const a = angle + i * 0.2;
        this.bullets.push({
          x: boss.x, y: boss.y + boss.height / 2,
          vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
          damage: 1, radius: 4, color: '#ff0066', isPlayer: false
        });
      }
    } else if (phase === 2) {
      // Circle shot
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + boss.moveTimer;
        this.bullets.push({
          x: boss.x, y: boss.y + boss.height / 2,
          vx: Math.cos(a) * speed * 0.8, vy: Math.sin(a) * speed * 0.8,
          damage: 1, radius: 4, color: '#ff3300', isPlayer: false
        });
      }
    } else {
      // Rapid aimed + spread
      for (let i = -3; i <= 3; i++) {
        const a = angle + i * 0.15;
        this.bullets.push({
          x: boss.x, y: boss.y + boss.height / 2,
          vx: Math.cos(a) * speed * 1.2, vy: Math.sin(a) * speed * 1.2,
          damage: 1, radius: 4, color: '#ff0000', isPlayer: false
        });
      }
    }
    audio.enemyShoot();
  }

  enemyShoot(e: Enemy) {
    const p = this.player;
    const angle = Math.atan2(p.y - e.y, p.x - e.x);
    const speed = 180;
    this.bullets.push({
      x: e.x, y: e.y + e.height / 2,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      damage: 1, radius: 4, color: '#ff4444', isPlayer: false
    });
    audio.enemyShoot();
  }

  updateExplosions(dt: number) {
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const ex = this.explosions[i];
      ex.radius += 300 * dt;
      ex.alpha -= 2 * dt;
      if (ex.alpha <= 0) {
        this.explosions.splice(i, 1);
      }
    }
  }

  updatePickups(dt: number) {
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pk = this.pickups[i];
      pk.y += pk.vy * dt;
      pk.pulsePhase += dt * 3;
      if (pk.y > CANVAS_HEIGHT + 30) {
        this.pickups.splice(i, 1);
      }
    }
  }

  updateParticles(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      p.vy += 50 * dt; // gravity
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  updateFloatingTexts(dt: number) {
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y -= 40 * dt;
      ft.life -= dt;
      if (ft.life <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }
  }

  addFloatingText(x: number, y: number, text: string, color: string) {
    this.floatingTexts.push({ x, y, text, color, life: 1.5 });
  }

  spawnParticles(x: number, y: number, color: string, count: number) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 50 + Math.random() * 200;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.3 + Math.random() * 0.7,
        maxLife: 1,
        color,
        size: 1 + Math.random() * 3,
      });
    }
  }

  updateCompanion(dt: number) {
    if (!this.companion) return;
    const c = this.companion;
    c.timer -= dt;
    if (c.timer <= 0) {
      this.companion = null;
      return;
    }
    c.angle += 2 * dt;
    c.x = this.player.x + Math.cos(c.angle) * c.orbitRadius;
    c.y = this.player.y + Math.sin(c.angle) * c.orbitRadius;

    c.shootTimer -= dt;
    if (c.shootTimer <= 0) {
      c.shootTimer = 0.3;
      // Find nearest enemy
      let nearest: Enemy | null = null;
      let minDist = Infinity;
      for (const e of this.enemies) {
        const dx = e.x - c.x;
        const dy = e.y - c.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minDist) { minDist = dist; nearest = e; }
      }
      if (nearest) {
        const angle = Math.atan2(nearest.y - c.y, nearest.x - c.x);
        this.bullets.push({
          x: c.x, y: c.y,
          vx: Math.cos(angle) * 500, vy: Math.sin(angle) * 500,
          damage: 10, radius: 3, color: '#aa00ff', isPlayer: true
        });
      }
    }
  }

  updateWave(dt: number) {
    if (this.bossActive) return;

    this.waveTimer += dt;
    this.spawnTimer += dt;

    const spawnInterval = Math.max(0.5, 2 - this.wave * 0.1) / this.diffSettings.spawnRate;

    if (this.waveEnemiesSpawned < this.waveEnemiesTotal) {
      if (this.spawnTimer >= spawnInterval) {
        this.spawnTimer = 0;
        this.spawnEnemy();
        this.waveEnemiesSpawned++;
      }
    } else if (this.enemies.length === 0) {
      // Wave complete
      audio.waveComplete();
      this.wave++;

      // Boss every 3 waves
      if (this.wave % 3 === 0) {
        this.spawnBoss();
      } else {
        this.startWave();
      }
    }
  }

  spawnEnemy() {
    const postBoss = this.postBoss;
    const wave = this.wave;
    
    // Determine enemy type based on wave
    let type: number;
    const rand = Math.random();
    
    if (wave <= 2) {
      type = rand < 0.6 ? 1 : 2;
    } else if (wave <= 4) {
      type = rand < 0.3 ? 1 : rand < 0.6 ? 2 : rand < 0.8 ? 3 : 5;
    } else {
      type = Math.ceil(Math.random() * 6);
    }

    const hpMult = this.diffSettings.enemyHpMult * (postBoss ? 1.5 : 1);
    const speedMult = this.diffSettings.enemySpeedMult * (postBoss ? 1.2 : 1);

    const configs: Record<number, Partial<Enemy>> = {
      1: { hp: 10 * hpMult, speed: 200 * speedMult, hasShield: false, shootInterval: 0, color: '#44ff44', points: 10 },
      2: { hp: 25 * hpMult, speed: 130 * speedMult, hasShield: false, shootInterval: 0, color: '#4488ff', points: 20 },
      3: { hp: 25 * hpMult, speed: 80 * speedMult, hasShield: false, shootInterval: 2, color: '#ff8844', points: 30 },
      4: { hp: 30 * hpMult, speed: 80 * speedMult, hasShield: true, shootInterval: 2.5, color: '#ff44ff', points: 40 },
      5: { hp: 60 * hpMult, speed: 70 * speedMult, hasShield: false, shootInterval: 0, color: '#ffff44', points: 50 },
      6: { hp: 35 * hpMult, speed: 120 * speedMult, hasShield: true, shootInterval: 1.8, color: '#ff4444', points: 60 },
    };

    const cfg = configs[type]!;
    const enemy: Enemy = {
      id: nextEnemyId++,
      x: 50 + Math.random() * (CANVAS_WIDTH - 100),
      y: -40,
      width: type === 5 ? 50 : 35,
      height: type === 5 ? 50 : 35,
      hp: cfg.hp!,
      maxHp: cfg.hp!,
      speed: cfg.speed!,
      type,
      hasShield: cfg.hasShield!,
      shieldRegenTimer: 0,
      shootTimer: Math.random() * 2,
      shootInterval: cfg.shootInterval!,
      color: cfg.color!,
      points: cfg.points!,
      isBoss: false,
      bossPhase: 0,
      bossPhaseTimer: 0,
      movePattern: Math.random() > 0.5 ? 1 : 2,
      moveTimer: Math.random() * 10,
      angle: 0,
    };

    this.enemies.push(enemy);
  }

  spawnBoss() {
    this.bossActive = true;
    audio.bossAppear();

    const bossNum = Math.floor(this.wave / 3);
    const hpMult = this.diffSettings.enemyHpMult * (this.postBoss ? 1.5 : 1);
    const baseHp = 200 + bossNum * 100;

    const bossColors = ['#ff0066', '#6600ff', '#ff6600', '#00ff66', '#ff00ff'];
    const bossColor = bossColors[(bossNum - 1) % bossColors.length];

    const boss: Enemy = {
      id: nextEnemyId++,
      x: CANVAS_WIDTH / 2,
      y: -80,
      width: 80 + bossNum * 5,
      height: 70 + bossNum * 5,
      hp: baseHp * hpMult,
      maxHp: baseHp * hpMult,
      speed: 60,
      type: 7,
      hasShield: false,
      shieldRegenTimer: 0,
      shootTimer: 0,
      shootInterval: 0.8,
      color: bossColor,
      points: 200 * bossNum,
      isBoss: true,
      bossPhase: 0,
      bossPhaseTimer: 0,
      movePattern: 1,
      moveTimer: 0,
      angle: 0,
    };

    this.enemies.push(boss);
  }

  checkCollisions() {
    const p = this.player;

    // Player bullets vs enemies
    for (let bi = this.bullets.length - 1; bi >= 0; bi--) {
      const b = this.bullets[bi];
      if (!b.isPlayer) continue;

      for (let ei = this.enemies.length - 1; ei >= 0; ei--) {
        const e = this.enemies[ei];
        if (this.circleRect(b.x, b.y, b.radius, e.x - e.width / 2, e.y - e.height / 2, e.width, e.height)) {
          if (e.hasShield) {
            e.hasShield = false;
            if (e.type === 6) e.shieldRegenTimer = 3;
            audio.shieldBreak();
            this.explosions.push({
              x: b.x, y: b.y, radius: 0, maxRadius: 20, alpha: 1, color: '#88ffff'
            });
          } else {
            this.damageEnemy(ei, b.damage);
          }

          if (b.homing && b.explosionRadius) {
            // Rocket explosion
            this.explosions.push({
              x: b.x, y: b.y, radius: 0, maxRadius: b.explosionRadius,
              alpha: 1, color: '#ff6600'
            });
            audio.explosion();
            // Area damage
            for (let ej = this.enemies.length - 1; ej >= 0; ej--) {
              if (ej === ei) continue;
              const e2 = this.enemies[ej];
              const dx = e2.x - b.x;
              const dy = e2.y - b.y;
              if (Math.sqrt(dx * dx + dy * dy) < b.explosionRadius) {
                this.damageEnemy(ej, b.damage * 0.5);
              }
            }
          }

          if (!b.piercing) {
            this.bullets.splice(bi, 1);
            break;
          }
        }
      }
    }

    // Enemy bullets vs player
    if (p.invincibleTimer <= 0) {
      for (let bi = this.bullets.length - 1; bi >= 0; bi--) {
        const b = this.bullets[bi];
        if (b.isPlayer) continue;

        if (this.circleRect(b.x, b.y, b.radius, p.x - p.width / 2, p.y - p.height / 2, p.width, p.height)) {
          this.bullets.splice(bi, 1);
          this.playerTakeDamage();
          break;
        }
      }
    }

    // Enemies vs player (collision)
    if (p.invincibleTimer <= 0) {
      for (let ei = this.enemies.length - 1; ei >= 0; ei--) {
        const e = this.enemies[ei];
        if (this.rectRect(
          p.x - p.width / 2, p.y - p.height / 2, p.width, p.height,
          e.x - e.width / 2, e.y - e.height / 2, e.width, e.height
        )) {
          if (p.shield === 'immortality' && p.shieldTimer > 0) {
            if (!e.isBoss) {
              this.killEnemy(ei);
            }
          } else {
            this.playerTakeDamage();
            if (!e.isBoss) {
              this.killEnemy(ei);
            }
          }
          break;
        }
      }
    }

    // Pickups vs player
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pk = this.pickups[i];
      const dx = pk.x - p.x;
      const dy = pk.y - p.y;
      if (Math.sqrt(dx * dx + dy * dy) < pk.radius + 25) {
        this.collectPickup(pk);
        this.pickups.splice(i, 1);
      }
    }
  }

  addScore(amount: number) {
    const p = this.player;
    p.score += amount;
    
    // Прогрессивная система: первая жизнь за 1000, вторая за 2000, третья за 3000 и т.д.
    // Сумма очков для N жизней = 1000 + 2000 + ... + N*1000 = N*(N+1)*500
    while (p.lives < p.maxLives) {
      const nextLifeCost = (p.livesFromScore + 1) * 1000;
      const totalNeeded = (p.livesFromScore + 1) * (p.livesFromScore + 2) * 500;
      
      if (p.score >= totalNeeded) {
        p.lives++;
        p.livesFromScore++;
        this.addFloatingText(p.x, p.y - 40, `+1 ❤ (${nextLifeCost} очков)`, '#ff4444');
        audio.pickup();
      } else {
        break;
      }
    }
  }

  damageEnemy(idx: number, damage: number) {
    const e = this.enemies[idx];
    if (!e || e.hasShield) return;
    
    e.hp -= damage;
    this.stats.damageDealt += damage;

    if (e.hp <= 0) {
      this.killEnemy(idx);
    }
  }

  killEnemy(idx: number) {
    const e = this.enemies[idx];
    if (!e) return;

    this.stats.enemiesKilled++;
    const scoreGain = e.points * this.player.scoreMultiplier * this.diffSettings.scoreMult;
    this.addScore(Math.floor(scoreGain));

    this.explosions.push({
      x: e.x, y: e.y, radius: 0,
      maxRadius: e.isBoss ? 80 : 30,
      alpha: 1, color: e.color
    });
    this.spawnParticles(e.x, e.y, e.color, e.isBoss ? 30 : 8);

    if (e.isBoss) {
      this.stats.bossesKilled++;
      audio.bigExplosion();
      this.bossActive = false;
      this.postBoss = true;
      this.screenShake = 1;
      this.waveAnnouncement = '💀 БОСС ПОВЕРЖЕН! 💀';
      this.waveAnnouncementTimer = 2.5;
      // Boss always drops pickup
      this.spawnPickup(e.x, e.y, true);
      this.spawnPickup(e.x + 30, e.y, true);
      this.spawnPickup(e.x - 30, e.y + 20, true);
      this.startWave();
    } else {
      audio.explosion();
      // Chance to drop pickup
      if (Math.random() < 0.15) {
        this.spawnPickup(e.x, e.y, false);
      }
    }

    this.enemies.splice(idx, 1);
  }

  spawnPickup(x: number, y: number, guaranteed: boolean) {
    const rand = Math.random();
    let type: Pickup['type'];
    let subtype: string;
    let color: string;
    let label: string;

    if (guaranteed) {
      // Boss drops are better
      if (rand < 0.3) {
        type = 'weapon';
        const weapons: WeaponType[] = ['machinegun', 'laser', 'rockets'];
        const weaponType = weapons[Math.floor(Math.random() * 3)];
        // Уровень оружия: если того же типа - прокачка, если другого - от 1 до текущего уровня
        if (weaponType === this.player.weapon) {
          subtype = `${weaponType}:${this.player.weaponLevel}`;
        } else {
          const level = 1 + Math.floor(Math.random() * this.player.weaponLevel);
          subtype = `${weaponType}:${level}`;
        }
        color = '#ffff00';
        label = 'W';
      } else if (rand < 0.5) {
        type = 'ultimate';
        const ults: UltimateType[] = ['bomb', 'meteor', 'companion'];
        subtype = ults[Math.floor(Math.random() * 3)];
        color = '#ff0066';
        label = 'U';
      } else if (rand < 0.7) {
        type = 'shield';
        const shields: ShieldType[] = ['immortality', 'killRing', 'oneTime'];
        subtype = shields[Math.floor(Math.random() * 3)];
        color = '#00ffcc';
        label = 'S';
      } else if (rand < 0.85) {
        type = 'health';
        subtype = 'health';
        color = '#ff4444';
        label = '+';
      } else {
        type = 'multiplier';
        subtype = 'x2';
        color = '#ffaa00';
        label = 'x2';
      }
    } else {
      if (rand < 0.35) {
        type = 'weapon';
        const weapons: WeaponType[] = ['machinegun', 'laser', 'rockets'];
        const weaponType = weapons[Math.floor(Math.random() * 3)];
        // Уровень оружия: если того же типа - прокачка, если другого - от 1 до текущего уровня
        if (weaponType === this.player.weapon) {
          subtype = `${weaponType}:${this.player.weaponLevel}`;
        } else {
          const level = 1 + Math.floor(Math.random() * this.player.weaponLevel);
          subtype = `${weaponType}:${level}`;
        }
        color = '#ffff00';
        label = 'W';
      } else if (rand < 0.5) {
        type = 'score';
        subtype = 'score';
        color = '#ffffff';
        label = '$';
      } else if (rand < 0.65) {
        type = 'shield';
        const shields: ShieldType[] = ['immortality', 'killRing', 'oneTime'];
        subtype = shields[Math.floor(Math.random() * 3)];
        color = '#00ffcc';
        label = 'S';
      } else if (rand < 0.8) {
        type = 'health';
        subtype = 'health';
        color = '#ff4444';
        label = '+';
      } else if (rand < 0.9) {
        type = 'multiplier';
        subtype = 'x2';
        color = '#ffaa00';
        label = 'x2';
      } else {
        type = 'ultimate';
        const ults: UltimateType[] = ['bomb', 'meteor', 'companion'];
        subtype = ults[Math.floor(Math.random() * 3)];
        color = '#ff0066';
        label = 'U';
      }
    }

    this.pickups.push({
      x, y, vy: 80,
      type, subtype, radius: 16,
      color, label, pulsePhase: 0
    });
  }

  collectPickup(pk: Pickup) {
    const p = this.player;
    this.stats.pickupsCollected++;
    audio.pickup();

    switch (pk.type) {
      case 'weapon': {
        // Формат subtype: "weaponType" или "weaponType:level"
        const parts = pk.subtype.split(':');
        const wt = parts[0] as WeaponType;
        const weaponLevel = parts.length > 1 ? parseInt(parts[1]) : 1;
        
        const weaponNames: Record<WeaponType, string> = {
          machinegun: 'Пулемёт',
          laser: 'Лазер',
          rockets: 'Ракеты'
        };
        
        if (p.weapon === wt) {
          // То же оружие - прокачка
          p.weaponLevel = Math.min(5, p.weaponLevel + 1);
          this.addFloatingText(pk.x, pk.y - 20, `${weaponNames[wt]} Ур.${p.weaponLevel}!`, '#ffff00');
        } else {
          // Другое оружие - устанавливаем уровень из приза
          p.weapon = wt;
          p.weaponLevel = Math.min(5, weaponLevel);
          this.addFloatingText(pk.x, pk.y - 20, `${weaponNames[wt]} Ур.${p.weaponLevel}!`, '#ffff00');
        }
        break;
      }
      case 'shield': {
        const st = pk.subtype as ShieldType;
        const shieldNames: Record<ShieldType, string> = {
          immortality: 'Бессмертие',
          killRing: 'Кольцо убийства',
          oneTime: 'Одноразовый щит'
        };
        if (st === 'oneTime') {
          p.oneTimeShields = Math.min(3, p.oneTimeShields + 1);
          this.addFloatingText(pk.x, pk.y - 20, `Щит ${p.oneTimeShields}/3`, '#44ff44');
        } else {
          p.shield = st;
          p.shieldTimer = 10;
          this.addFloatingText(pk.x, pk.y - 20, shieldNames[st], '#00ffcc');
        }
        break;
      }
      case 'ultimate': {
        const ultNames: Record<UltimateType, string> = {
          bomb: 'Бомба',
          meteor: 'Метеоритный дождь',
          companion: 'Помощник'
        };
        p.ultimate = pk.subtype as UltimateType;
        this.addFloatingText(pk.x, pk.y - 20, `${ultNames[p.ultimate]}!`, '#ff0066');
        break;
      }
      case 'health': {
        p.lives = Math.min(p.maxLives, p.lives + 1);
        this.addFloatingText(pk.x, pk.y - 20, '+1 ❤', '#ff4444');
        break;
      }
      case 'score': {
        const gained = 100 * p.scoreMultiplier;
        this.addScore(gained);
        this.addFloatingText(pk.x, pk.y - 20, `+${gained}`, '#ffdd00');
        break;
      }
      case 'multiplier': {
        p.scoreMultiplier = 2;
        p.multiplierTimer = 15;
        this.addFloatingText(pk.x, pk.y - 20, 'x2 Очки!', '#ffaa00');
        break;
      }
    }
  }

  playerTakeDamage() {
    const p = this.player;

    if (p.shield === 'immortality' && p.shieldTimer > 0) return;

    if (p.oneTimeShields > 0) {
      p.oneTimeShields--;
      audio.shieldBreak();
      p.invincibleTimer = 0.5;
      return;
    }

    p.lives--;
    this.stats.damageTaken++;
    p.invincibleTimer = 2;
    this.screenShake = 0.5;
    audio.playerHit();

    if (p.lives <= 0) {
      this.gameOver = true;
      audio.playerDeath();
      if (this.onGameOver) {
        setTimeout(() => this.onGameOver!(this.stats), 1000);
      }
    }
  }

  circleRect(cx: number, cy: number, cr: number, rx: number, ry: number, rw: number, rh: number): boolean {
    const nearestX = Math.max(rx, Math.min(cx, rx + rw));
    const nearestY = Math.max(ry, Math.min(cy, ry + rh));
    const dx = cx - nearestX;
    const dy = cy - nearestY;
    return (dx * dx + dy * dy) < (cr * cr);
  }

  rectRect(x1: number, y1: number, w1: number, h1: number, x2: number, y2: number, w2: number, h2: number): boolean {
    return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
  }

  // ============ RENDERING ============

  render() {
    const ctx = this.ctx;
    
    ctx.save();
    
    // Screen shake - applied to everything including background
    if (this.screenShake > 0) {
      const shakeX = (Math.random() - 0.5) * this.screenShake * 10;
      const shakeY = (Math.random() - 0.5) * this.screenShake * 10;
      ctx.translate(shakeX, shakeY);
      this.screenShake = Math.max(0, this.screenShake - 0.05);
    }
    
    // Background with gradient - draw larger to cover shake offset
    const bgGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    bgGrad.addColorStop(0, '#050510');
    bgGrad.addColorStop(0.5, '#0a0a2a');
    bgGrad.addColorStop(1, '#0a0520');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(-20, -20, CANVAS_WIDTH + 40, CANVAS_HEIGHT + 40);

    // Nebula effect
    ctx.save();
    ctx.globalAlpha = 0.05;
    const nebulaTime = this.gameTime * 0.1;
    for (let i = 0; i < 3; i++) {
      const nx = CANVAS_WIDTH / 2 + Math.sin(nebulaTime + i * 2) * 200;
      const ny = CANVAS_HEIGHT / 2 + Math.cos(nebulaTime + i * 1.5) * 150;
      const grad = ctx.createRadialGradient(nx, ny, 0, nx, ny, 200);
      const colors = ['#0044ff', '#ff0044', '#4400ff'];
      grad.addColorStop(0, colors[i]);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.fillRect(-20, -20, CANVAS_WIDTH + 40, CANVAS_HEIGHT + 40);
    }
    ctx.restore();

    this.renderStars();
    this.renderPickups();
    this.renderEnemies();
    this.renderBullets();
    this.renderPlayer();
    this.renderExplosions();
    this.renderParticles();
    this.renderFloatingTexts();
    this.renderCompanion();
    this.renderHUD();
    this.renderAnnouncement();

    ctx.restore();

    if (this.paused) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.fillStyle = '#00ffcc';
      ctx.font = 'bold 48px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('ПАУЗА', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
      ctx.font = '20px Arial';
      ctx.fillText('Нажмите P для продолжения', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 40);
    }

    if (this.gameOver) {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }
  }

  renderStars() {
    const ctx = this.ctx;
    for (const star of this.stars) {
      ctx.fillStyle = `rgba(255,255,255,${star.brightness})`;
      ctx.fillRect(star.x, star.y, star.size, star.size);
    }
  }

  renderPlayer() {
    const ctx = this.ctx;
    const p = this.player;

    if (p.invincibleTimer > 0 && Math.floor(p.invincibleTimer * 10) % 2 === 0) return;

    ctx.save();
    ctx.translate(p.x, p.y);

    // Ship body
    ctx.beginPath();
    ctx.moveTo(0, -p.height / 2);
    ctx.lineTo(-p.width / 2, p.height / 2);
    ctx.lineTo(-p.width / 4, p.height / 3);
    ctx.lineTo(0, p.height / 2.5);
    ctx.lineTo(p.width / 4, p.height / 3);
    ctx.lineTo(p.width / 2, p.height / 2);
    ctx.closePath();

    const gradient = ctx.createLinearGradient(0, -p.height / 2, 0, p.height / 2);
    gradient.addColorStop(0, '#00ccff');
    gradient.addColorStop(1, '#0044aa');
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Cockpit
    ctx.beginPath();
    ctx.ellipse(0, -5, 6, 10, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#88eeff';
    ctx.fill();

    // Engine glow
    ctx.beginPath();
    ctx.moveTo(-8, p.height / 3);
    ctx.lineTo(0, p.height / 2 + 10 + Math.random() * 5);
    ctx.lineTo(8, p.height / 3);
    ctx.fillStyle = `rgba(255, ${100 + Math.random() * 100}, 0, 0.8)`;
    ctx.fill();

    // Shield visual
    if (p.shield === 'immortality' && p.shieldTimer > 0) {
      ctx.beginPath();
      ctx.arc(0, 0, 35, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 0, 255, ${0.5 + Math.sin(this.gameTime * 5) * 0.3})`;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    if (p.shield === 'killRing' && p.shieldTimer > 0) {
      ctx.beginPath();
      ctx.arc(0, 0, 120, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 50, 50, ${0.3 + Math.sin(this.gameTime * 8) * 0.2})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    if (p.oneTimeShields > 0) {
      for (let i = 0; i < p.oneTimeShields; i++) {
        ctx.beginPath();
        ctx.arc(0, 0, 30 + i * 5, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(0, 255, 100, ${0.4 - i * 0.1})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  renderEnemies() {
    const ctx = this.ctx;

    for (const e of this.enemies) {
      ctx.save();
      ctx.translate(e.x, e.y);

      if (e.isBoss) {
        this.renderBoss(e);
      } else {
        this.renderEnemy(e);
      }

      // Shield indicator
      if (e.hasShield) {
        ctx.beginPath();
        ctx.arc(0, 0, Math.max(e.width, e.height) / 2 + 5, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(100, 200, 255, 0.6)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  renderEnemy(e: Enemy) {
    const ctx = this.ctx;
    const s = e.width / 2;

    ctx.fillStyle = e.color;
    ctx.strokeStyle = e.color;
    ctx.lineWidth = 2;

    switch (e.type) {
      case 1: // Fast, triangle
        ctx.beginPath();
        ctx.moveTo(0, s);
        ctx.lineTo(-s, -s);
        ctx.lineTo(s, -s);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      case 2: // Medium, diamond
        ctx.beginPath();
        ctx.moveTo(0, s);
        ctx.lineTo(-s, 0);
        ctx.lineTo(0, -s);
        ctx.lineTo(s, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      case 3: // Slow shooter, pentagon
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
          const method = i === 0 ? 'moveTo' : 'lineTo';
          ctx[method](Math.cos(a) * s, Math.sin(a) * s);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      case 4: // Shielded, hexagon
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          const method = i === 0 ? 'moveTo' : 'lineTo';
          ctx[method](Math.cos(a) * s, Math.sin(a) * s);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Inner detail
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
          const method = i === 0 ? 'moveTo' : 'lineTo';
          ctx[method](Math.cos(a) * s * 0.5, Math.sin(a) * s * 0.5);
        }
        ctx.closePath();
        ctx.strokeStyle = '#fff';
        ctx.stroke();
        break;
      case 5: // Tank, large square
        ctx.fillRect(-s, -s, s * 2, s * 2);
        ctx.strokeRect(-s, -s, s * 2, s * 2);
        ctx.fillStyle = '#000';
        ctx.fillRect(-s * 0.3, -s * 0.3, s * 0.6, s * 0.6);
        break;
      case 6: // Regenerating shield, star shape
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          const r = i % 2 === 0 ? s : s * 0.5;
          const method = i === 0 ? 'moveTo' : 'lineTo';
          ctx[method](Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
    }
  }

  renderBoss(e: Enemy) {
    const ctx = this.ctx;
    const s = e.width / 2;
    const bossNum = Math.floor(this.wave / 3) % 5;

    ctx.fillStyle = e.color;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;

    switch (bossNum) {
      case 0: // Skull-like
        ctx.beginPath();
        ctx.arc(0, -s * 0.2, s * 0.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillRect(-s * 0.5, s * 0.2, s, s * 0.5);
        ctx.strokeRect(-s * 0.5, s * 0.2, s, s * 0.5);
        // Eyes
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(-s * 0.3, -s * 0.3, s * 0.15, 0, Math.PI * 2);
        ctx.arc(s * 0.3, -s * 0.3, s * 0.15, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 1: // UFO shape
        ctx.beginPath();
        ctx.ellipse(0, 0, s, s * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(0, -s * 0.3, s * 0.5, s * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        break;
      case 2: // Spider
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * s * 0.6, Math.sin(a) * s * 0.6);
          ctx.lineTo(Math.cos(a) * s, Math.sin(a) * s * 1.2);
          ctx.strokeStyle = e.color;
          ctx.lineWidth = 4;
          ctx.stroke();
        }
        break;
      case 3: // Crystal
        ctx.beginPath();
        ctx.moveTo(0, -s);
        ctx.lineTo(s * 0.7, -s * 0.3);
        ctx.lineTo(s, s * 0.5);
        ctx.lineTo(0, s);
        ctx.lineTo(-s, s * 0.5);
        ctx.lineTo(-s * 0.7, -s * 0.3);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      case 4: // Eye
        ctx.beginPath();
        ctx.ellipse(0, 0, s, s * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.15, 0, Math.PI * 2);
        ctx.fillStyle = '#000';
        ctx.fill();
        break;
    }

    // HP bar
    const barWidth = e.width + 20;
    const barHeight = 6;
    const barY = -s - 15;
    ctx.fillStyle = '#333';
    ctx.fillRect(-barWidth / 2, barY, barWidth, barHeight);
    const hpRatio = e.hp / e.maxHp;
    const hpColor = hpRatio > 0.5 ? '#00ff00' : hpRatio > 0.25 ? '#ffff00' : '#ff0000';
    ctx.fillStyle = hpColor;
    ctx.fillRect(-barWidth / 2, barY, barWidth * hpRatio, barHeight);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.strokeRect(-barWidth / 2, barY, barWidth, barHeight);

    // Phase indicators
    ctx.fillStyle = '#fff';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`Фаза ${e.bossPhase + 1}/4`, 0, barY - 5);
  }

  renderBullets() {
    const ctx = this.ctx;

    for (const b of this.bullets) {
      ctx.save();
      ctx.translate(b.x, b.y);

      if (b.isPlayer) {
        if (b.homing) {
          // Rocket
          const angle = Math.atan2(b.vy, b.vx);
          ctx.rotate(angle + Math.PI / 2);
          ctx.beginPath();
          ctx.moveTo(0, -8);
          ctx.lineTo(-4, 6);
          ctx.lineTo(4, 6);
          ctx.closePath();
          ctx.fillStyle = '#ff6600';
          ctx.fill();
          // Trail
          ctx.beginPath();
          ctx.moveTo(-2, 6);
          ctx.lineTo(0, 12 + Math.random() * 4);
          ctx.lineTo(2, 6);
          ctx.fillStyle = '#ffaa00';
          ctx.fill();
        } else if (b.piercing) {
          // Laser
          ctx.beginPath();
          ctx.moveTo(0, -10);
          ctx.lineTo(-2, 10);
          ctx.lineTo(2, 10);
          ctx.closePath();
          ctx.fillStyle = '#00ffff';
          ctx.fill();
          ctx.shadowColor = '#00ffff';
          ctx.shadowBlur = 10;
          ctx.fill();
        } else {
          // Machinegun bullet
          ctx.beginPath();
          ctx.arc(0, 0, b.radius, 0, Math.PI * 2);
          ctx.fillStyle = b.color;
          ctx.fill();
        }
      } else {
        // Enemy bullet
        ctx.beginPath();
        ctx.arc(0, 0, b.radius, 0, Math.PI * 2);
        ctx.fillStyle = b.color;
        ctx.fill();
        ctx.shadowColor = b.color;
        ctx.shadowBlur = 5;
        ctx.fill();
      }

      ctx.restore();
    }
  }

  renderExplosions() {
    const ctx = this.ctx;

    for (const ex of this.explosions) {
      ctx.beginPath();
      ctx.arc(ex.x, ex.y, ex.radius, 0, Math.PI * 2);
      ctx.strokeStyle = ex.color;
      ctx.globalAlpha = ex.alpha;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = ex.color;
      ctx.globalAlpha = ex.alpha * 0.3;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  renderParticles() {
    const ctx = this.ctx;
    for (const p of this.particles) {
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  renderFloatingTexts() {
    const ctx = this.ctx;
    for (const ft of this.floatingTexts) {
      const alpha = Math.min(1, ft.life * 2);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = ft.color;
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeText(ft.text, ft.x, ft.y);
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }
  }

  renderPickups() {
    const ctx = this.ctx;

    for (const pk of this.pickups) {
      ctx.save();
      ctx.translate(pk.x, pk.y);

      const pulse = 1 + Math.sin(pk.pulsePhase) * 0.15;
      ctx.scale(pulse, pulse);

      // Outer glow
      ctx.shadowColor = pk.color;
      ctx.shadowBlur = 12;

      if (pk.type === 'weapon') {
        this.renderWeaponPickup(pk);
      } else if (pk.type === 'shield') {
        this.renderShieldPickup(pk);
      } else if (pk.type === 'ultimate') {
        this.renderUltimatePickup(pk);
      } else if (pk.type === 'health') {
        this.renderHealthPickup(pk);
      } else if (pk.type === 'score') {
        this.renderScorePickup(pk);
      } else if (pk.type === 'multiplier') {
        this.renderMultiplierPickup(pk);
      }

      ctx.shadowBlur = 0;
      ctx.restore();
    }
  }

  renderWeaponPickup(pk: Pickup) {
    const ctx = this.ctx;
    const r = pk.radius;
    
    // Парсим subtype для получения типа оружия и уровня
    const parts = pk.subtype.split(':');
    const weaponType = parts[0];
    const weaponLevel = parts.length > 1 ? parseInt(parts[1]) : 1;

    if (weaponType === 'machinegun') {
      // Пулемёт: ствол с патронами
      ctx.fillStyle = '#ffdd00';
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      // Ствол
      ctx.fillRect(-3, -r, 6, r * 1.6);
      ctx.strokeRect(-3, -r, 6, r * 1.6);
      // Рукоять
      ctx.fillRect(-6, r * 0.3, 12, 6);
      ctx.strokeRect(-6, r * 0.3, 12, 6);
      // Пули
      ctx.fillStyle = '#ff8800';
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(-8 + i * 8, -r - 3, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (weaponType === 'laser') {
      // Лазер: кристалл/призма
      ctx.fillStyle = '#00ffff';
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.lineTo(r * 0.7, 0);
      ctx.lineTo(0, r);
      ctx.lineTo(-r * 0.7, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Луч внутри
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.5);
      ctx.lineTo(0, r * 0.5);
      ctx.stroke();
    } else if (weaponType === 'rockets') {
      // Ракета: корпус с плавниками
      ctx.fillStyle = '#ff6600';
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      // Корпус
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.lineTo(5, -r * 0.3);
      ctx.lineTo(5, r * 0.5);
      ctx.lineTo(-5, r * 0.5);
      ctx.lineTo(-5, -r * 0.3);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Плавники
      ctx.fillStyle = '#cc3300';
      ctx.beginPath();
      ctx.moveTo(-5, r * 0.3);
      ctx.lineTo(-9, r * 0.7);
      ctx.lineTo(-5, r * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(5, r * 0.3);
      ctx.lineTo(9, r * 0.7);
      ctx.lineTo(5, r * 0.5);
      ctx.closePath();
      ctx.fill();
      // Огонь
      ctx.fillStyle = '#ffcc00';
      ctx.beginPath();
      ctx.moveTo(-3, r * 0.5);
      ctx.lineTo(0, r);
      ctx.lineTo(3, r * 0.5);
      ctx.closePath();
      ctx.fill();
    }

    // Уровень оружия (уголок)
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.font = 'bold 10px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeText(`${weaponLevel}`, r * 0.6, -r * 0.6);
    ctx.fillText(`${weaponLevel}`, r * 0.6, -r * 0.6);

    // Подпись
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 9px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const names: Record<string, string> = {
      machinegun: 'Пулемёт',
      laser: 'Лазер',
      rockets: 'Ракеты'
    };
    ctx.fillText(names[weaponType] || '', 0, r + 2);
  }

  renderShieldPickup(pk: Pickup) {
    const ctx = this.ctx;
    const r = pk.radius;

    // Форма щита
    ctx.fillStyle = pk.color;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(r * 0.9, -r * 0.5);
    ctx.lineTo(r * 0.9, r * 0.2);
    ctx.lineTo(0, r);
    ctx.lineTo(-r * 0.9, r * 0.2);
    ctx.lineTo(-r * 0.9, -r * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Внутренний символ
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    if (pk.subtype === 'immortality') {
      // Крест бессмертия
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.5);
      ctx.lineTo(0, r * 0.5);
      ctx.moveTo(-r * 0.4, 0);
      ctx.lineTo(r * 0.4, 0);
      ctx.stroke();
    } else if (pk.subtype === 'killRing') {
      // Кольцо
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.2, 0, Math.PI * 2);
      ctx.stroke();
    } else if (pk.subtype === 'oneTime') {
      // Цифра щита
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('◇', 0, 0);
    }

    // Подпись
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 8px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const names: Record<string, string> = {
      immortality: 'Бессмертие',
      killRing: 'Кольцо',
      oneTime: 'Щит x1'
    };
    ctx.fillText(names[pk.subtype] || '', 0, r + 2);
  }

  renderUltimatePickup(pk: Pickup) {
    const ctx = this.ctx;
    const r = pk.radius;

    if (pk.subtype === 'bomb') {
      // Бомба: круг с фитилём
      ctx.fillStyle = '#222';
      ctx.strokeStyle = pk.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 2, r * 0.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Фитиль
      ctx.strokeStyle = '#ffcc00';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.6);
      ctx.quadraticCurveTo(4, -r, 2, -r * 1.1);
      ctx.stroke();
      // Искра
      ctx.fillStyle = '#ffff00';
      ctx.beginPath();
      ctx.arc(2, -r * 1.1, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (pk.subtype === 'meteor') {
      // Метеорит: камень с хвостом
      ctx.fillStyle = '#884400';
      ctx.strokeStyle = pk.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-r * 0.5, -r * 0.3);
      ctx.lineTo(r * 0.3, -r * 0.7);
      ctx.lineTo(r * 0.7, -r * 0.1);
      ctx.lineTo(r * 0.4, r * 0.6);
      ctx.lineTo(-r * 0.3, r * 0.5);
      ctx.lineTo(-r * 0.7, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Огненный хвост
      ctx.fillStyle = '#ff6600';
      ctx.beginPath();
      ctx.moveTo(-r * 0.5, -r * 0.3);
      ctx.lineTo(-r * 1.1, -r * 0.8);
      ctx.lineTo(-r * 0.7, 0);
      ctx.closePath();
      ctx.fill();
    } else if (pk.subtype === 'companion') {
      // Помощник: маленький корабль
      ctx.fillStyle = '#aa00ff';
      ctx.strokeStyle = '#ff00ff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.8);
      ctx.lineTo(-r * 0.7, r * 0.5);
      ctx.lineTo(0, r * 0.2);
      ctx.lineTo(r * 0.7, r * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Орбита
      ctx.strokeStyle = '#ff00ff88';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.9, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Подпись
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 8px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const names: Record<string, string> = {
      bomb: 'Бомба',
      meteor: 'Метеорит',
      companion: 'Помощник'
    };
    ctx.fillText(names[pk.subtype] || '', 0, r + 2);
  }

  renderHealthPickup(pk: Pickup) {
    const ctx = this.ctx;
    const r = pk.radius;

    // Сердце
    ctx.fillStyle = pk.color;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, r * 0.6);
    ctx.bezierCurveTo(-r, r * 0.1, -r, -r * 0.6, 0, -r * 0.3);
    ctx.bezierCurveTo(r, -r * 0.6, r, r * 0.1, 0, r * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Плюс
    ctx.fillStyle = '#fff';
    ctx.fillRect(-1, -r * 0.2, 2, r * 0.5);
    ctx.fillRect(-r * 0.25, -r * 0.05, r * 0.5, 2);

    // Подпись
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 9px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('+1 ❤', 0, r + 2);
  }

  renderScorePickup(pk: Pickup) {
    const ctx = this.ctx;
    const r = pk.radius;

    // Монета
    ctx.fillStyle = '#ffdd00';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Внутренний круг
    ctx.strokeStyle = '#aa8800';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2);
    ctx.stroke();
    // $
    ctx.fillStyle = '#886600';
    ctx.font = 'bold 11px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', 0, 1);

    // Подпись
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 9px Arial';
    ctx.textBaseline = 'top';
    ctx.fillText('+100', 0, r + 2);
  }

  renderMultiplierPickup(pk: Pickup) {
    const ctx = this.ctx;
    const r = pk.radius;

    // Звезда с x2
    ctx.fillStyle = pk.color;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const radius = i % 2 === 0 ? r : r * 0.5;
      if (i === 0) ctx.moveTo(Math.cos(a) * radius, Math.sin(a) * radius);
      else ctx.lineTo(Math.cos(a) * radius, Math.sin(a) * radius);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // x2
    ctx.fillStyle = '#000';
    ctx.font = 'bold 9px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('x2', 0, 0);

    // Подпись
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 8px Arial';
    ctx.textBaseline = 'top';
    ctx.fillText('Множитель', 0, r + 2);
  }

  renderCompanion() {
    if (!this.companion) return;
    const ctx = this.ctx;
    const c = this.companion;

    ctx.save();
    ctx.translate(c.x, c.y);

    // Small ship
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(-10, 12);
    ctx.lineTo(0, 8);
    ctx.lineTo(10, 12);
    ctx.closePath();
    ctx.fillStyle = '#aa00ff';
    ctx.fill();
    ctx.strokeStyle = '#ff00ff';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Timer indicator
    const timerRatio = c.timer / 60;
    ctx.beginPath();
    ctx.arc(0, 0, 15, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * timerRatio);
    ctx.strokeStyle = '#ff00ff';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
  }

  renderAnnouncement() {
    if (this.waveAnnouncementTimer <= 0) return;
    const ctx = this.ctx;
    const alpha = Math.min(1, this.waveAnnouncementTimer);
    
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#00ffcc';
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Shadow/glow
    ctx.shadowColor = '#00ffcc';
    ctx.shadowBlur = 20;
    ctx.fillText(this.waveAnnouncement, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 50);
    ctx.shadowBlur = 0;
    
    ctx.restore();
    
    this.waveAnnouncementTimer -= 0.016;
  }

  renderHUD() {
    const ctx = this.ctx;
    const p = this.player;

    // Left side - Lives, Score, Wave
    ctx.fillStyle = 'rgba(0, 20, 40, 0.7)';
    ctx.fillRect(5, 5, 200, 115);
    ctx.strokeStyle = 'rgba(0, 255, 204, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(5, 5, 200, 115);

    ctx.fillStyle = '#fff';
    ctx.font = '14px Arial';
    ctx.textAlign = 'left';

    // Lives
    ctx.fillText(`Жизни: ${'❤'.repeat(p.lives)}${'♡'.repeat(p.maxLives - p.lives)}`, 15, 25);
    
    // Score
    ctx.fillText(`Очки: ${p.score}${p.scoreMultiplier > 1 ? ` (x${p.scoreMultiplier})` : ''}`, 15, 45);
    
    // Progress to next life (progressive system)
    if (p.lives < p.maxLives) {
      const nextLifeCost = (p.livesFromScore + 1) * 1000;
      const currentThreshold = p.livesFromScore * (p.livesFromScore + 1) * 500;
      const nextThreshold = (p.livesFromScore + 1) * (p.livesFromScore + 2) * 500;
      const progress = p.score - currentThreshold;
      const needed = nextThreshold - currentThreshold;
      const progressRatio = Math.min(1, progress / needed);
      
      const progressWidth = 150;
      const progressX = 15;
      const progressY = 52;
      ctx.fillStyle = '#333';
      ctx.fillRect(progressX, progressY, progressWidth, 4);
      ctx.fillStyle = '#ff4444';
      ctx.fillRect(progressX, progressY, progressRatio * progressWidth, 4);
      ctx.fillStyle = '#888';
      ctx.font = '10px Arial';
      ctx.fillText(`❤ ${needed - progress} до +1 жизни (нужно ${nextLifeCost})`, 15, 68);
    } else {
      ctx.fillStyle = '#44ff44';
      ctx.font = '10px Arial';
      ctx.fillText(`❤ Максимум жизней!`, 15, 68);
    }
    
    // Wave
    ctx.fillText(`Волна: ${this.wave}`, 15, 82);

    // Weapon
    const weaponNames: Record<WeaponType, string> = {
      machinegun: 'Пулемёт',
      laser: 'Лазер',
      rockets: 'Ракеты'
    };
    let weaponDesc = `${weaponNames[p.weapon]} [Ур.${p.weaponLevel}]`;
    if (p.weapon === 'laser') {
      if (p.weaponLevel >= 5) weaponDesc += ' ↑↓←→';
      else if (p.weaponLevel >= 3) weaponDesc += ' ↑↓';
    } else if (p.weapon === 'rockets') {
      const rocketCount = p.weaponLevel >= 5 ? 3 : p.weaponLevel >= 3 ? 2 : 1;
      weaponDesc += ` x${rocketCount}`;
    }
    ctx.fillText(weaponDesc, 15, 99);

    // Right side - Shield, Ultimate, Enemies
    ctx.fillStyle = 'rgba(0, 20, 40, 0.7)';
    ctx.fillRect(CANVAS_WIDTH - 205, 5, 200, 80);
    ctx.strokeStyle = 'rgba(0, 255, 204, 0.3)';
    ctx.strokeRect(CANVAS_WIDTH - 205, 5, 200, 80);

    ctx.textAlign = 'right';
    const rx = CANVAS_WIDTH - 15;

    // Shield
    const shieldNames: Record<ShieldType, string> = {
      immortality: 'Бессмертие',
      killRing: 'Кольцо убийства',
      oneTime: 'Одноразовый'
    };
    if (p.shield) {
      ctx.fillStyle = '#00ffcc';
      ctx.fillText(`${shieldNames[p.shield]}: ${p.shieldTimer.toFixed(1)}с`, rx, 25);
    } else if (p.oneTimeShields > 0) {
      ctx.fillStyle = '#44ff44';
      ctx.fillText(`Щиты: ${p.oneTimeShields}/3`, rx, 25);
    }

    // Ultimate
    ctx.fillStyle = '#ff0066';
    if (p.ultimate) {
      const ultNames: Record<UltimateType, string> = {
        bomb: 'Бомба [ПКМ]',
        meteor: 'Метеорит [ПКМ]',
        companion: 'Помощник [ПКМ]'
      };
      ctx.fillText(ultNames[p.ultimate], rx, 45);
    } else {
      ctx.fillStyle = '#666';
      ctx.fillText('Ульта: пусто', rx, 45);
    }

    // Enemies remaining
    ctx.fillStyle = '#aaa';
    ctx.fillText(`Враги: ${this.enemies.length}`, rx, 65);

    // Boss warning
    if (this.bossActive) {
      ctx.fillStyle = '#ff0000';
      ctx.font = 'bold 18px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('⚠ БОСС ⚠', CANVAS_WIDTH / 2, 30);
    }

    // Post-boss indicator
    if (this.postBoss && !this.bossActive) {
      ctx.fillStyle = '#ff6600';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Враги усилены!', CANVAS_WIDTH / 2, 30);
    }
  }
}
