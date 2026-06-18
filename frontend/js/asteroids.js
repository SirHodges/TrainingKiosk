import { getRandomUpgrades, UPGRADES } from './asteroids_upgrades.js';

let isRunning = false;
let canvas, ctx;
let animationFrameId;

// Game State
let gameState = 'PLAYING'; // PLAYING, UPGRADE, GAME_OVER
let wave = 1;
let screenShake = 0;
let upgradeLockoutTimer = 0;

function getDefaultUpgrades() {
  return {
    ids: [], speedMult: 1, turnMult: 1, frictionMult: 1, hitboxMult: 1, fireRateMult: 1,
    dualShot: false, spreadShot: false, rearShot: false, sideShots: false,
    heavyBullets: false, piercing: false, flak: false, homing: false, bouncing: false, plasma: false,
    mineLayer: false, laserSight: false, ghostDrive: false, shield: false, reflective: false, ramming: false,
    scrapCollector: false, comboDecayMult: 1, scoreMult: 1, emp: false, chrono: false, radioactive: false,
    gravityWell: false, ufoHunter: false
  };
}

let players = [
  { idx: 0, color: 'cyan', score: 0, lives: 3, combo: 0, comboTimer: 0, lockedIn: false, choices: [], choiceIdx: 0, keys: { left: false, right: false, up: false, shoot: false }, upgrades: getDefaultUpgrades() },
  { idx: 1, color: 'red', score: 0, lives: 3, combo: 0, comboTimer: 0, lockedIn: false, choices: [], choiceIdx: 0, keys: { left: false, right: false, up: false, shoot: false }, upgrades: getDefaultUpgrades() }
];

let ships = [null, null];
let asteroids = [];
let bullets = [];
let particles = [];
let floatingTexts = [];
let ufo = null;
let ufoTimer = 600;

// Config
const BASE_FRICTION = 0.99;
const BASE_THRUST = 0.15;
const BASE_TURN_SPEED = 0.08;
const BASE_BULLET_SPEED = 7;
const MAX_BULLETS = 50;

class Ship {
  constructor(p) {
    this.p = p; // player reference
    this.x = canvas.width / 2 + (p.idx === 0 ? -50 : 50);
    this.y = canvas.height / 2;
    this.r = 15;
    this.a = Math.PI / 2 * 3;
    this.vx = 0;
    this.vy = 0;
    this.explodeTime = 0;
    this.lastShot = 0;
    this.shieldActive = p.upgrades.shield;
    this.ghostTimer = 120; // 2 seconds spawn invincibility
    this.mineTimer = 0;
  }
  update() {
    if (this.explodeTime > 0) {
      this.explodeTime--;
      if (this.explodeTime <= 0) {
        if (this.p.lives > 0) {
          ships[this.p.idx] = new Ship(this.p);
        } else {
          ships[this.p.idx] = null;
          checkGameOver();
        }
      }
      return;
    }
    
    let u = this.p.upgrades;
    let k = this.p.keys;
    let isThrusting = false;
    
    if (k.left) this.a -= BASE_TURN_SPEED * u.turnMult;
    if (k.right) this.a += BASE_TURN_SPEED * u.turnMult;
    if (k.up) {
      this.vx += Math.cos(this.a) * BASE_THRUST * u.speedMult;
      this.vy += Math.sin(this.a) * BASE_THRUST * u.speedMult;
      isThrusting = true;
      if (u.ghostDrive) this.ghostTimer = 60;
      
      if (Math.random() < 0.5) {
        let px = this.x - Math.cos(this.a) * this.r;
        let py = this.y - Math.sin(this.a) * this.r;
        particles.push(new Particle(px, py, -this.vx + (Math.random()-0.5)*2, -this.vy + (Math.random()-0.5)*2, 'orange', 20));
      }
    }
    
    if (this.ghostTimer > 0) this.ghostTimer--;
    
    let friction = isThrusting ? BASE_FRICTION : (BASE_FRICTION * u.frictionMult);
    this.vx *= friction;
    this.vy *= friction;
    this.x += this.vx;
    this.y += this.vy;

    if (this.x < 0) this.x = canvas.width;
    if (this.x > canvas.width) this.x = 0;
    if (this.y < 0) this.y = canvas.height;
    if (this.y > canvas.height) this.y = 0;
    
    if (u.mineLayer && isThrusting) {
      this.mineTimer--;
      if (this.mineTimer <= 0) {
        this.mineTimer = 120;
        bullets.push(new Mine(this.x, this.y, this.p.idx));
      }
    }
  }
  draw(ctx) {
    if (this.explodeTime > 0) return;
    
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.a);
    
    if (this.ghostTimer > 0) ctx.globalAlpha = 0.5;
    
    ctx.strokeStyle = this.p.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(this.r, 0);
    ctx.lineTo(-this.r, this.r * 0.7);
    ctx.lineTo(-this.r * 0.5, 0);
    ctx.lineTo(-this.r, -this.r * 0.7);
    ctx.closePath();
    ctx.stroke();
    
    if (this.shieldActive) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.beginPath();
      ctx.arc(0, 0, this.r * 1.5, 0, Math.PI * 2);
      ctx.stroke();
    }
    
    if (this.p.upgrades.laserSight) {
      ctx.strokeStyle = `rgba(${this.p.idx === 0 ? '0,255,255' : '255,0,0'}, 0.3)`;
      ctx.beginPath();
      ctx.moveTo(this.r, 0);
      ctx.lineTo(2000, 0);
      ctx.stroke();
    }
    
    ctx.restore();
  }
}

class Mine {
  constructor(x, y, ownerIdx) {
    this.x = x; this.y = y; this.owner = ownerIdx;
    this.vx = 0; this.vy = 0; this.life = 300; this.isMine = true;
  }
  update() { this.life--; }
  draw(ctx) {
    ctx.fillStyle = players[this.owner].color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

class Asteroid {
  constructor(x, y, r) {
    this.x = x; this.y = y; this.r = r;
    this.a = Math.random() * Math.PI * 2;
    let speed = (Math.random() * 2 + 1) * (50 / r) * (1 + wave * 0.1);
    this.vx = Math.cos(this.a) * speed;
    this.vy = Math.sin(this.a) * speed;
    this.vert = Math.floor(Math.random() * 5 + 5);
    this.points = [];
    for (let i = 0; i < this.vert; i++) {
      let a = i * Math.PI * 2 / this.vert;
      let r2 = this.r * (Math.random() * 0.4 + 0.8);
      this.points.push({ x: Math.cos(a) * r2, y: Math.sin(a) * r2 });
    }
    this.hitFlash = 0;
  }
  update() {
    let speedMult = 1;
    // Chrono slows if NO ONE is thrusting
    if ((players[0].upgrades.chrono || players[1].upgrades.chrono) && !players[0].keys.up && !players[1].keys.up) {
      speedMult = 0.4;
    }
    
    if (players[0].upgrades.gravityWell || players[1].upgrades.gravityWell) {
      let dx = (canvas.width/2) - this.x;
      let dy = (canvas.height/2) - this.y;
      let dist = Math.sqrt(dx*dx + dy*dy);
      if (dist > 10) {
        this.vx += (dx/dist) * 0.05;
        this.vy += (dy/dist) * 0.05;
      }
    }
    
    this.x += this.vx * speedMult;
    this.y += this.vy * speedMult;
    if (this.x < -this.r) this.x = canvas.width + this.r;
    if (this.x > canvas.width + this.r) this.x = -this.r;
    if (this.y < -this.r) this.y = canvas.height + this.r;
    if (this.y > canvas.height + this.r) this.y = -this.r;
    if (this.hitFlash > 0) this.hitFlash--;
  }
  draw(ctx) {
    ctx.strokeStyle = this.hitFlash > 0 ? 'white' : '#aaa';
    ctx.fillStyle = this.hitFlash > 0 ? 'white' : 'transparent';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let j = 0; j < this.points.length; j++) {
      let p = this.points[j];
      if (j === 0) ctx.moveTo(this.x + p.x, this.y + p.y);
      else ctx.lineTo(this.x + p.x, this.y + p.y);
    }
    ctx.closePath();
    ctx.stroke();
    if (this.hitFlash > 0) ctx.fill();
  }
}

class Ufo {
  constructor() {
    this.x = Math.random() < 0.5 ? 0 : canvas.width;
    this.y = Math.random() * canvas.height;
    this.r = 20;
    this.vx = (this.x === 0 ? 1 : -1) * (1 + wave * 0.2);
    this.vy = (Math.random() - 0.5);
    this.shootTimer = 120;
    this.hitFlash = 0;
  }
  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.shootTimer--;
    if (this.shootTimer <= 0) {
      this.shootTimer = 120 - Math.min(80, wave * 5);
      let angle = Math.random() * Math.PI * 2;
      // Target a random alive player
      if (wave > 3 && Math.random() < 0.5) {
        let targets = ships.filter(s => s !== null && s.explodeTime <= 0);
        if (targets.length > 0) {
          let t = targets[Math.floor(Math.random() * targets.length)];
          angle = Math.atan2(t.y - this.y, t.x - this.x) + (Math.random()-0.5)*0.5;
        }
      }
      let b = new Bullet(this.x, this.y, angle, null);
      b.isEnemy = true;
      b.life = 100;
      bullets.push(b);
    }
    if (this.hitFlash > 0) this.hitFlash--;
  }
  draw(ctx) {
    ctx.strokeStyle = this.hitFlash > 0 ? 'white' : 'red';
    ctx.fillStyle = this.hitFlash > 0 ? 'white' : 'transparent';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(this.x - this.r, this.y);
    ctx.lineTo(this.x + this.r, this.y);
    ctx.lineTo(this.x + this.r/2, this.y - this.r/2);
    ctx.lineTo(this.x - this.r/2, this.y - this.r/2);
    ctx.closePath();
    ctx.moveTo(this.x - this.r/1.5, this.y);
    ctx.lineTo(this.x - this.r/2, this.y + this.r/2);
    ctx.lineTo(this.x + this.r/2, this.y + this.r/2);
    ctx.lineTo(this.x + this.r/1.5, this.y);
    ctx.stroke();
    if (this.hitFlash > 0) ctx.fill();
  }
}

class Bullet {
  constructor(x, y, a, ownerIdx) {
    this.x = x; this.y = y; this.owner = ownerIdx;
    
    let u = ownerIdx !== null ? players[ownerIdx].upgrades : getDefaultUpgrades();
    let spd = BASE_BULLET_SPEED * (u.heavyBullets ? 1.5 : 1);
    if (u.plasma) spd *= 0.4;
    
    this.vx = Math.cos(a) * spd;
    this.vy = Math.sin(a) * spd;
    this.life = u.plasma ? 180 : 60;
    this.pierced = 0;
    this.isFlak = false;
  }
  update() {
    let u = this.owner !== null ? players[this.owner].upgrades : getDefaultUpgrades();
    
    if (u.homing && asteroids.length > 0) {
      let nearest = null, minDist = 99999;
      asteroids.forEach(a => {
        let d = distBetweenPoints(this.x, this.y, a.x, a.y);
        if (d < minDist) { minDist = d; nearest = a; }
      });
      if (nearest) {
        let angleTo = Math.atan2(nearest.y - this.y, nearest.x - this.x);
        let currAngle = Math.atan2(this.vy, this.vx);
        let diff = angleTo - currAngle;
        while (diff > Math.PI) diff -= Math.PI*2;
        while (diff < -Math.PI) diff += Math.PI*2;
        currAngle += diff * 0.1;
        let speed = Math.sqrt(this.vx*this.vx + this.vy*this.vy);
        this.vx = Math.cos(currAngle) * speed;
        this.vy = Math.sin(currAngle) * speed;
      }
    }
    
    this.x += this.vx;
    this.y += this.vy;
    this.life--;
    
    if (u.bouncing) {
      if (this.x < 0 || this.x > canvas.width) { this.vx *= -1; this.x += this.vx; }
      if (this.y < 0 || this.y > canvas.height) { this.vy *= -1; this.y += this.vy; }
    } else {
      if (this.x < 0) this.x = canvas.width;
      if (this.x > canvas.width) this.x = 0;
      if (this.y < 0) this.y = canvas.height;
      if (this.y > canvas.height) this.y = 0;
    }
  }
  draw(ctx) {
    if (this.isEnemy) {
      ctx.fillStyle = 'red';
      ctx.beginPath(); ctx.arc(this.x, this.y, 3, 0, Math.PI*2); ctx.fill();
      return;
    }
    
    let p = players[this.owner];
    ctx.fillStyle = p.upgrades.plasma ? 'magenta' : (p.upgrades.heavyBullets ? p.color : 'white');
    ctx.beginPath();
    let r = p.upgrades.plasma ? 12 : (p.upgrades.heavyBullets ? 4 : 2);
    ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

class Particle {
  constructor(x, y, vx, vy, color, life) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.color = color; this.life = life; this.maxLife = life;
  }
  update() { this.x += this.vx; this.y += this.vy; this.life--; }
  draw(ctx) {
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 2;
    let scale = this.life / this.maxLife;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x - this.vx*2*scale, this.y - this.vy*2*scale);
    ctx.stroke();
  }
}

class FloatingText {
  constructor(x, y, text, color) {
    this.x = x; this.y = y; this.text = text; this.color = color;
    this.life = 40; this.maxLife = 40;
  }
  update() { this.y -= 1; this.life--; }
  draw(ctx) {
    ctx.fillStyle = this.color;
    ctx.globalAlpha = this.life / this.maxLife;
    ctx.font = 'bold 20px Courier New';
    ctx.fillText(this.text, this.x, this.y);
    ctx.globalAlpha = 1.0;
  }
}

function spawnAsteroids(count) {
  for (let i = 0; i < count; i++) {
    let x, y;
    let safe = false;
    while (!safe) {
      x = Math.random() * canvas.width;
      y = Math.random() * canvas.height;
      safe = true;
      for (let s of ships) {
        if (s && distBetweenPoints(s.x, s.y, x, y) < 150) safe = false;
      }
    }
    asteroids.push(new Asteroid(x, y, 40));
  }
}

function distBetweenPoints(x1, y1, x2, y2) {
  let dx = x2 - x1;
  let dy = y2 - y1;
  return Math.sqrt(dx*dx + dy*dy);
}

function fireBullets(pIdx) {
  let s = ships[pIdx];
  if (!s || s.explodeTime > 0) return;
  let p = players[pIdx];
  let u = p.upgrades;
  
  let cooldown = 200 * u.fireRateMult;
  if (Date.now() - s.lastShot < cooldown) return;
  if (bullets.length >= MAX_BULLETS) return;
  
  s.lastShot = Date.now();
  let angles = [s.a];
  
  if (u.spreadShot) { angles.push(s.a + 0.2); angles.push(s.a - 0.2); }
  if (u.rearShot) angles.push(s.a + Math.PI);
  if (u.sideShots) { angles.push(s.a + Math.PI/2); angles.push(s.a - Math.PI/2); }
  
  angles.forEach(a => {
    if (u.dualShot) {
      let perp = a + Math.PI/2;
      let ox = Math.cos(perp) * 6, oy = Math.sin(perp) * 6;
      bullets.push(new Bullet(s.x + Math.cos(a)*s.r + ox, s.y + Math.sin(a)*s.r + oy, a, pIdx));
      bullets.push(new Bullet(s.x + Math.cos(a)*s.r - ox, s.y + Math.sin(a)*s.r - oy, a, pIdx));
    } else {
      bullets.push(new Bullet(s.x + Math.cos(a)*s.r, s.y + Math.sin(a)*s.r, a, pIdx));
    }
  });
}

function explodeAsteroid(index, ownerIdx) {
  let a = asteroids[index];
  asteroids.splice(index, 1);
  screenShake = Math.max(screenShake, 5);
  
  if (ownerIdx !== null && ownerIdx >= 0) {
    let p = players[ownerIdx];
    let pts = Math.floor(1000 / a.r) * p.upgrades.scoreMult;
    p.combo++;
    p.comboTimer = 180;
    let mult = Math.min(5, 1 + Math.floor(p.combo / 5));
    pts *= mult;
    p.score += pts;
    floatingTexts.push(new FloatingText(a.x, a.y, `+${pts}`, p.color));
    
    if (p.upgrades.radioactive && Math.random() < 0.2) {
      for (let i = 0; i < 30; i++) particles.push(new Particle(a.x, a.y, (Math.random()-0.5)*12, (Math.random()-0.5)*12, 'lime', 40));
      asteroids.forEach((other, oi) => {
        if (distBetweenPoints(a.x, a.y, other.x, other.y) < 150) {
          setTimeout(() => {
            let nIdx = asteroids.indexOf(other);
            if(nIdx !== -1) explodeAsteroid(nIdx, ownerIdx);
          }, 100);
        }
      });
    }
    
    if (p.upgrades.scrapCollector && Math.random() < 0.05) {
      p.lives++;
      floatingTexts.push(new FloatingText(a.x, a.y-20, "1-UP!", p.color));
    }
  } else {
    // Destroyed by something else (e.g. ship ramming, EMP)
    for (let i = 0; i < 10; i++) particles.push(new Particle(a.x, a.y, (Math.random()-0.5)*8, (Math.random()-0.5)*8, 'white', 30));
  }
  
  if (a.r > 20) {
    asteroids.push(new Asteroid(a.x, a.y, a.r / 2));
    asteroids.push(new Asteroid(a.x, a.y, a.r / 2));
  }
  
  if (asteroids.length === 0) {
    gameState = 'UPGRADE';
    upgradeLockoutTimer = 60; // 1 second lockout
    
    // Prepare upgrade cards for both players
    players.forEach(p => {
      if (p.lives > 0) {
        p.choices = getRandomUpgrades(3, p.upgrades.ids);
        p.choiceIdx = 0;
        p.lockedIn = false;
      } else {
        p.lockedIn = true; // Dead players auto-lock
      }
    });
  }
}

function killShip(pIdx) {
  let s = ships[pIdx];
  if (!s || s.explodeTime > 0) return;
  let p = players[pIdx];
  
  if (s.shieldActive) {
    s.shieldActive = false;
    s.ghostTimer = 120;
    screenShake = 10;
    for (let k = 0; k < 20; k++) particles.push(new Particle(s.x, s.y, (Math.random()-0.5)*6, (Math.random()-0.5)*6, 'cyan', 30));
    return;
  }
  
  if (p.upgrades.reflective) {
    for (let a = 0; a < Math.PI*2; a+= 0.2) {
      bullets.push(new Bullet(s.x, s.y, a, pIdx));
    }
  }
  
  s.explodeTime = 60;
  screenShake = 25;
  p.lives--;
  p.combo = 0;
  for (let k = 0; k < 40; k++) particles.push(new Particle(s.x, s.y, (Math.random()-0.5)*10, (Math.random()-0.5)*10, p.color, 50));
}

function checkGameOver() {
  if (players[0].lives <= 0 && players[1].lives <= 0) {
    gameState = 'GAME_OVER';
  }
}

function handleGamepadAxes(e) {
  if (!isRunning) return;
  const pIdx = e.detail.player;
  if (pIdx < 0 || pIdx > 1) return;
  
  const p = players[pIdx];
  const [x, y] = e.detail.axes;
  
  if (gameState === 'PLAYING') {
    p.keys.left = x < -0.5;
    p.keys.right = x > 0.5;
    p.keys.up = y < -0.5;
  } else if (gameState === 'UPGRADE' && !p.lockedIn && upgradeLockoutTimer <= 0) {
    if (x < -0.5 && !p.keys.left) { p.choiceIdx = Math.max(0, p.choiceIdx - 1); p.keys.left = true; }
    else if (x > -0.5) { p.keys.left = false; }
    
    if (x > 0.5 && !p.keys.right) { p.choiceIdx = Math.min(2, p.choiceIdx + 1); p.keys.right = true; }
    else if (x < 0.5) { p.keys.right = false; }
  }
}

function handleGamepadBtn(e) {
  if (!isRunning) return;
  const pIdx = e.detail.player;
  const btn = e.detail.button;
  if (btn === 'B' || btn === 'START') { quitAsteroids(); return; }
  if (pIdx < 0 || pIdx > 1) return;
  
  let p = players[pIdx];
  
  if (gameState === 'PLAYING') {
    if (btn === 'A') fireBullets(pIdx);
  } else if (gameState === 'UPGRADE') {
    if (btn === 'A' && upgradeLockoutTimer <= 0 && !p.lockedIn && p.lives > 0) {
      let choice = p.choices[p.choiceIdx];
      if (choice) {
        p.upgrades.ids.push(choice.id);
        choice.apply(p.upgrades);
      }
      p.lockedIn = true;
      
      if (players[0].lockedIn && players[1].lockedIn) {
        wave++;
        // Apply EMP
        if (players[0].upgrades.emp || players[1].upgrades.emp) {
           screenShake = 20;
        }
        players.forEach(pl => {
          if (pl.lives > 0 && ships[pl.idx]) ships[pl.idx].shieldActive = pl.upgrades.shield;
        });
        spawnAsteroids(4 + Math.floor(wave*1.5));
        gameState = 'PLAYING';
      }
    }
  } else if (gameState === 'GAME_OVER') {
    if (btn === 'A') {
      gameState = 'PLAYING';
      wave = 1;
      players = [
        { idx: 0, color: 'cyan', score: 0, lives: 3, combo: 0, comboTimer: 0, lockedIn: false, choices: [], choiceIdx: 0, keys: { left: false, right: false, up: false, shoot: false }, upgrades: getDefaultUpgrades() },
        { idx: 1, color: 'red', score: 0, lives: 3, combo: 0, comboTimer: 0, lockedIn: false, choices: [], choiceIdx: 0, keys: { left: false, right: false, up: false, shoot: false }, upgrades: getDefaultUpgrades() }
      ];
      ships = [new Ship(players[0]), new Ship(players[1])];
      asteroids = [];
      bullets = [];
      particles = [];
      floatingTexts = [];
      ufo = null;
      spawnAsteroids(4);
    }
  }
}

function update() {
  if (!isRunning) return;
  
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  ctx.save();
  if (screenShake > 0) {
    ctx.translate((Math.random()-0.5)*screenShake, (Math.random()-0.5)*screenShake);
    screenShake *= 0.9;
    if (screenShake < 0.5) screenShake = 0;
  }
  
  if (gameState === 'PLAYING') {
    players.forEach(p => {
      if (p.comboTimer > 0) {
        p.comboTimer -= (1 / p.upgrades.comboDecayMult);
        if (p.comboTimer <= 0) p.combo = 0;
      }
    });
    
    ships.forEach(s => { if (s) s.update(); });
    ships.forEach(s => { if (s) s.draw(ctx); });
    
    for (let i = bullets.length - 1; i >= 0; i--) {
      bullets[i].update();
      bullets[i].draw(ctx);
      if (bullets[i].life <= 0) bullets.splice(i, 1);
    }
    
    for (let i = asteroids.length - 1; i >= 0; i--) {
      asteroids[i].update();
      asteroids[i].draw(ctx);
    }
    
    for (let i = particles.length - 1; i >= 0; i--) {
      particles[i].update();
      particles[i].draw(ctx);
      if (particles[i].life <= 0) particles.splice(i, 1);
    }
    if (particles.length > 150) particles.splice(0, particles.length - 150);
    
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
      floatingTexts[i].update();
      floatingTexts[i].draw(ctx);
      if (floatingTexts[i].life <= 0) floatingTexts.splice(i, 1);
    }
    
    if (!ufo) {
      let spawnRate = (players[0].upgrades.ufoHunter || players[1].upgrades.ufoHunter) ? 2 : 1;
      ufoTimer -= spawnRate;
      if (ufoTimer <= 0) ufo = new Ufo();
    } else {
      ufo.update();
      ufo.draw(ctx);
      if (ufo.x < -100 || ufo.x > canvas.width + 100) {
        ufo = null;
        ufoTimer = 600 - Math.min(400, wave * 20);
      }
    }
    
    // Collisions
    for (let i = asteroids.length - 1; i >= 0; i--) {
      let a = asteroids[i];
      let hit = false;
      
      for (let j = bullets.length - 1; j >= 0; j--) {
        let b = bullets[j];
        if (b.isEnemy) continue;
        
        if (distBetweenPoints(a.x, a.y, b.x, b.y) < a.r) {
          a.hitFlash = 3;
          let u = b.owner !== null ? players[b.owner].upgrades : getDefaultUpgrades();
          if (u.plasma) {
            explodeAsteroid(i, b.owner);
            hit = true;
            break;
          } else {
            if (u.flak && !b.isFlak) {
              for (let f = 0; f < 5; f++) {
                let nb = new Bullet(b.x, b.y, Math.random()*Math.PI*2, b.owner);
                nb.isFlak = true;
                bullets.push(nb);
              }
            }
            if (u.piercing && b.pierced < 1) b.pierced++;
            else bullets.splice(j, 1);
            
            explodeAsteroid(i, b.owner);
            hit = true;
            break;
          }
        }
      }
      if (hit) continue;
      
      for (let j = bullets.length - 1; j >= 0; j--) {
        let b = bullets[j];
        if (b.isMine && distBetweenPoints(a.x, a.y, b.x, b.y) < a.r + 15) {
          bullets.splice(j, 1);
          explodeAsteroid(i, b.owner);
          hit = true;
          break;
        }
      }
      if (hit) continue;
      
      ships.forEach(s => {
        if (s && s.explodeTime <= 0 && s.ghostTimer <= 0) {
          let u = players[s.p.idx].upgrades;
          if (distBetweenPoints(a.x, a.y, s.x, s.y) < a.r + (s.r * u.hitboxMult)) {
            if (u.ramming && players[s.p.idx].keys.up) {
              explodeAsteroid(i, s.p.idx);
            } else {
              killShip(s.p.idx);
            }
          }
        }
      });
    }
    
    if (ufo) {
      for (let j = bullets.length - 1; j >= 0; j--) {
        let b = bullets[j];
        if (b.isEnemy) continue;
        if (distBetweenPoints(ufo.x, ufo.y, b.x, b.y) < ufo.r) {
          ufo.hitFlash = 3;
          bullets.splice(j, 1);
          
          if (b.owner !== null) {
            let p = players[b.owner];
            let pts = (p.upgrades.ufoHunter ? 1000 : 500) * p.upgrades.scoreMult;
            p.score += pts;
            floatingTexts.push(new FloatingText(ufo.x, ufo.y, `+${pts}`, p.color));
            if (p.upgrades.ufoHunter && Math.random() < 0.25) p.lives++;
          }
          for (let k = 0; k < 20; k++) particles.push(new Particle(ufo.x, ufo.y, (Math.random()-0.5)*10, (Math.random()-0.5)*10, 'red', 40));
          
          ufo = null;
          ufoTimer = 600 - Math.min(400, wave * 20);
          screenShake = 15;
          break;
        }
      }
      
      ships.forEach(s => {
        if (ufo && s && s.explodeTime <= 0 && s.ghostTimer <= 0) {
          if (distBetweenPoints(ufo.x, ufo.y, s.x, s.y) < ufo.r + (s.r * players[s.p.idx].upgrades.hitboxMult)) killShip(s.p.idx);
        }
      });
    }
    
    for (let j = bullets.length - 1; j >= 0; j--) {
      let b = bullets[j];
      if (!b.isEnemy) continue;
      ships.forEach(s => {
        if (s && s.explodeTime <= 0 && s.ghostTimer <= 0) {
          if (distBetweenPoints(s.x, s.y, b.x, b.y) < (s.r * players[s.p.idx].upgrades.hitboxMult)) {
            bullets.splice(j, 1);
            killShip(s.p.idx);
          }
        }
      });
    }
  }
  
  ctx.restore();
  
  // HUD (P1 Top Left, P2 Top Right)
  ctx.font = '20px Courier New';
  
  ctx.fillStyle = players[0].color;
  ctx.textAlign = 'left';
  ctx.fillText(`P1 LIVES: ${players[0].lives} | SCORE: ${players[0].score}`, 20, 30);
  if (players[0].combo > 1) {
    ctx.fillText(`COMBO x${Math.min(5, 1 + Math.floor(players[0].combo/5))}`, 20, 60);
    ctx.fillRect(20, 70, players[0].comboTimer, 5);
  }

  ctx.fillStyle = players[1].color;
  ctx.textAlign = 'right';
  ctx.fillText(`P2 LIVES: ${players[1].lives} | SCORE: ${players[1].score}`, canvas.width - 20, 30);
  if (players[1].combo > 1) {
    ctx.fillText(`COMBO x${Math.min(5, 1 + Math.floor(players[1].combo/5))}`, canvas.width - 20, 60);
    ctx.fillRect(canvas.width - 20 - players[1].comboTimer, 70, players[1].comboTimer, 5);
  }
  
  ctx.fillStyle = 'white';
  ctx.textAlign = 'center';
  ctx.fillText(`WAVE: ${wave}`, canvas.width/2, 30);
  
  // Upgrade Menu
  if (gameState === 'UPGRADE') {
    if (upgradeLockoutTimer > 0) upgradeLockoutTimer--;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.font = '40px Courier New';
    ctx.fillText(`WAVE ${wave} COMPLETE`, canvas.width/2, 80);
    ctx.font = '20px Courier New';
    let subText = upgradeLockoutTimer > 0 ? "Analyzing Drops..." : "Select an Upgrade (D-Pad Left/Right, A to Confirm)";
    ctx.fillStyle = upgradeLockoutTimer > 0 ? '#aaa' : 'white';
    ctx.fillText(subText, canvas.width/2, 120);
    
    let cardW = 200;
    let cardH = 120;
    
    // Draw P1 Choices
    if (players[0].lives > 0 && !players[0].lockedIn) {
      ctx.fillStyle = players[0].color;
      ctx.fillText("PLAYER 1", canvas.width/4, 180);
      let startX = canvas.width/4 - (cardW * 1.5) - 20;
      for (let i = 0; i < 3; i++) {
        let x = startX + i * (cardW + 20);
        let y = 220;
        ctx.strokeStyle = (i === players[0].choiceIdx) ? players[0].color : 'white';
        ctx.lineWidth = (i === players[0].choiceIdx) ? 5 : 2;
        ctx.strokeRect(x, y, cardW, cardH);
        
        let c = players[0].choices[i];
        if (c) {
          ctx.fillStyle = 'white'; ctx.font = 'bold 16px Courier New';
          ctx.fillText(c.name, x + cardW/2, y + 30);
          ctx.font = '14px Courier New';
          renderWrappedText(ctx, c.desc, x + cardW/2, y + 60, cardW - 20);
        }
      }
    } else if (players[0].lockedIn && players[0].lives > 0) {
      ctx.fillStyle = players[0].color;
      ctx.fillText("PLAYER 1 READY", canvas.width/4, canvas.height/2);
    }
    
    // Draw P2 Choices
    if (players[1].lives > 0 && !players[1].lockedIn) {
      ctx.fillStyle = players[1].color;
      ctx.fillText("PLAYER 2", (canvas.width/4)*3, 180);
      let startX = (canvas.width/4)*3 - (cardW * 1.5) - 20;
      for (let i = 0; i < 3; i++) {
        let x = startX + i * (cardW + 20);
        let y = 220;
        ctx.strokeStyle = (i === players[1].choiceIdx) ? players[1].color : 'white';
        ctx.lineWidth = (i === players[1].choiceIdx) ? 5 : 2;
        ctx.strokeRect(x, y, cardW, cardH);
        
        let c = players[1].choices[i];
        if (c) {
          ctx.fillStyle = 'white'; ctx.font = 'bold 16px Courier New';
          ctx.fillText(c.name, x + cardW/2, y + 30);
          ctx.font = '14px Courier New';
          renderWrappedText(ctx, c.desc, x + cardW/2, y + 60, cardW - 20);
        }
      }
    } else if (players[1].lockedIn && players[1].lives > 0) {
      ctx.fillStyle = players[1].color;
      ctx.fillText("PLAYER 2 READY", (canvas.width/4)*3, canvas.height/2);
    }
    
  } else if (gameState === 'GAME_OVER') {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = 'red';
    ctx.textAlign = 'center';
    ctx.font = '50px Courier New';
    ctx.fillText("GAME OVER", canvas.width/2, canvas.height/2 - 50);
    ctx.fillStyle = 'white';
    ctx.font = '30px Courier New';
    ctx.fillText(`P1 SCORE: ${players[0].score} | P2 SCORE: ${players[1].score}`, canvas.width/2, canvas.height/2 + 10);
    ctx.font = '20px Courier New';
    ctx.fillText("Press A to Restart, B to Quit", canvas.width/2, canvas.height/2 + 60);
  }

  animationFrameId = requestAnimationFrame(update);
}

function renderWrappedText(ctx, text, x, y, maxW) {
  let words = text.split(' ');
  let line = '';
  for (let w of words) {
    if (ctx.measureText(line + w + ' ').width > maxW) {
      ctx.fillText(line, x, y);
      line = w + ' ';
      y += 18;
    } else {
      line += w + ' ';
    }
  }
  ctx.fillText(line, x, y);
}

export function initAsteroids() {
  if (isRunning) return;
  isRunning = true;
  
  canvas = document.createElement('canvas');
  canvas.id = 'asteroids-canvas';
  canvas.style.position = 'fixed';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.width = '100vw';
  canvas.style.height = '100vh';
  canvas.style.zIndex = '10000';
  canvas.style.background = '#000';
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);
  ctx = canvas.getContext('2d');
  
  gameState = 'PLAYING';
  wave = 1;
  players = [
    { idx: 0, color: 'cyan', score: 0, lives: 3, combo: 0, comboTimer: 0, lockedIn: false, choices: [], choiceIdx: 0, keys: { left: false, right: false, up: false, shoot: false }, upgrades: getDefaultUpgrades() },
    { idx: 1, color: 'red', score: 0, lives: 3, combo: 0, comboTimer: 0, lockedIn: false, choices: [], choiceIdx: 0, keys: { left: false, right: false, up: false, shoot: false }, upgrades: getDefaultUpgrades() }
  ];
  ships = [new Ship(players[0]), new Ship(players[1])];
  asteroids = [];
  bullets = [];
  particles = [];
  floatingTexts = [];
  ufo = null;
  spawnAsteroids(4);
  
  window.addEventListener('app_gamepad_axes', handleGamepadAxes);
  window.addEventListener('app_gamepad_btn', handleGamepadBtn);
  window.addEventListener('resize', resizeCanvas);
  update();
}

function resizeCanvas() {
  if (canvas) { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
}

export function quitAsteroids() {
  if (!isRunning) return;
  isRunning = false;
  cancelAnimationFrame(animationFrameId);
  window.removeEventListener('app_gamepad_axes', handleGamepadAxes);
  window.removeEventListener('app_gamepad_btn', handleGamepadBtn);
  window.removeEventListener('resize', resizeCanvas);
  if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
  canvas = null; ctx = null;
}
