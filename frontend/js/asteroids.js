import { getRandomUpgrades, UPGRADES } from './asteroids_upgrades.js';

let isRunning = false;
let canvas, ctx;
let animationFrameId;

// Game State
let gameState = 'PLAYING'; // PLAYING, UPGRADE, GAME_OVER
let wave = 1;
let score = 0;
let lives = 3;
let screenShake = 0;
let combo = 0;
let comboTimer = 0;

let ship = null;
let asteroids = [];
let bullets = [];
let particles = [];
let floatingTexts = [];
let ufo = null;
let ufoTimer = 600; // spawn after 10 seconds initially

// Upgrade State
let shipUpgrades = {
  ids: [],
  speedMult: 1, turnMult: 1, frictionMult: 1, hitboxMult: 1, fireRateMult: 1,
  dualShot: false, spreadShot: false, rearShot: false, sideShots: false,
  heavyBullets: false, piercing: false, flak: false, homing: false, bouncing: false, plasma: false,
  mineLayer: false, laserSight: false, ghostDrive: false, shield: false, reflective: false, ramming: false,
  scrapCollector: false, comboDecayMult: 1, scoreMult: 1, emp: false, chrono: false, radioactive: false,
  gravityWell: false, ufoHunter: false
};
let currentChoices = [];
let selectedChoiceIdx = 0;

let keys = { left: false, right: false, up: false, shoot: false };

// Config
const BASE_FRICTION = 0.99;
const BASE_THRUST = 0.15;
const BASE_TURN_SPEED = 0.08;
const BASE_BULLET_SPEED = 7;
const MAX_BULLETS = 50; // Increased for upgrades

class Ship {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.r = 15;
    this.a = Math.PI / 2 * 3;
    this.vx = 0;
    this.vy = 0;
    this.explodeTime = 0;
    this.lastShot = 0;
    this.shieldActive = shipUpgrades.shield;
    this.ghostTimer = 0;
    this.mineTimer = 0;
  }
  update() {
    if (this.explodeTime > 0) {
      this.explodeTime--;
      if (this.explodeTime <= 0) {
        if (lives > 0) {
          respawnShip();
        } else {
          gameState = 'GAME_OVER';
        }
      }
      return;
    }
    
    let isThrusting = false;
    if (keys.left) this.a -= BASE_TURN_SPEED * shipUpgrades.turnMult;
    if (keys.right) this.a += BASE_TURN_SPEED * shipUpgrades.turnMult;
    if (keys.up) {
      this.vx += Math.cos(this.a) * BASE_THRUST * shipUpgrades.speedMult;
      this.vy += Math.sin(this.a) * BASE_THRUST * shipUpgrades.speedMult;
      isThrusting = true;
      if (shipUpgrades.ghostDrive) this.ghostTimer = 60; // 1 second invincibility
      
      // Thrust particles
      if (Math.random() < 0.5) {
        let px = this.x - Math.cos(this.a) * this.r;
        let py = this.y - Math.sin(this.a) * this.r;
        particles.push(new Particle(px, py, -this.vx + (Math.random()-0.5)*2, -this.vy + (Math.random()-0.5)*2, 'orange', 20));
      }
    }
    
    if (this.ghostTimer > 0) this.ghostTimer--;
    
    // Friction
    let friction = isThrusting ? BASE_FRICTION : (BASE_FRICTION * shipUpgrades.frictionMult);
    this.vx *= friction;
    this.vy *= friction;
    this.x += this.vx;
    this.y += this.vy;

    // Screen wrap
    if (this.x < 0) this.x = canvas.width;
    if (this.x > canvas.width) this.x = 0;
    if (this.y < 0) this.y = canvas.height;
    if (this.y > canvas.height) this.y = 0;
    
    // Mine layer
    if (shipUpgrades.mineLayer && isThrusting) {
      this.mineTimer--;
      if (this.mineTimer <= 0) {
        this.mineTimer = 120; // drop a mine every 2 seconds
        bullets.push(new Mine(this.x, this.y));
      }
    }
  }
  draw(ctx) {
    if (this.explodeTime > 0) return;
    
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.a);
    
    if (this.ghostTimer > 0) ctx.globalAlpha = 0.5;
    
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(this.r, 0);
    ctx.lineTo(-this.r, this.r * 0.7);
    ctx.lineTo(-this.r * 0.5, 0);
    ctx.lineTo(-this.r, -this.r * 0.7);
    ctx.closePath();
    ctx.stroke();
    
    if (this.shieldActive) {
      ctx.strokeStyle = 'cyan';
      ctx.beginPath();
      ctx.arc(0, 0, this.r * 1.5, 0, Math.PI * 2);
      ctx.stroke();
    }
    
    if (shipUpgrades.laserSight) {
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)';
      ctx.beginPath();
      ctx.moveTo(this.r, 0);
      ctx.lineTo(2000, 0);
      ctx.stroke();
    }
    
    ctx.restore();
  }
}

class Mine {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.life = 300;
    this.isMine = true;
  }
  update() { this.life--; }
  draw(ctx) {
    ctx.fillStyle = 'orange';
    ctx.beginPath();
    ctx.arc(this.x, this.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

class Asteroid {
  constructor(x, y, r) {
    this.x = x;
    this.y = y;
    this.r = r;
    this.a = Math.random() * Math.PI * 2;
    let speed = (Math.random() * 2 + 1) * (50 / r) * (1 + wave * 0.1);
    this.vx = Math.cos(this.a) * speed;
    this.vy = Math.sin(this.a) * speed;
    this.vert = Math.floor(Math.random() * 5 + 5);
    this.offs = [];
    for (let i = 0; i < this.vert; i++) {
      this.offs.push(Math.random() * 0.4 + 0.8);
    }
    this.hitFlash = 0;
  }
  update() {
    let speedMult = 1;
    if (shipUpgrades.chrono && !keys.up) speedMult = 0.4;
    
    if (shipUpgrades.gravityWell) {
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
    for (let j = 0; j < this.vert; j++) {
      let a = j * Math.PI * 2 / this.vert;
      let r = this.r * this.offs[j];
      if (j === 0) ctx.moveTo(this.x + Math.cos(a) * r, this.y + Math.sin(a) * r);
      else ctx.lineTo(this.x + Math.cos(a) * r, this.y + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.stroke();
    if (this.hitFlash > 0) ctx.fill();
  }
}

class Bullet {
  constructor(x, y, a) {
    this.x = x;
    this.y = y;
    let spd = BASE_BULLET_SPEED * (shipUpgrades.heavyBullets ? 1.5 : 1);
    if (shipUpgrades.plasma) spd *= 0.4;
    this.vx = Math.cos(a) * spd;
    this.vy = Math.sin(a) * spd;
    this.life = shipUpgrades.plasma ? 180 : 60;
    this.pierced = 0;
  }
  update() {
    if (shipUpgrades.homing && asteroids.length > 0) {
      // Find nearest
      let nearest = null;
      let minDist = 99999;
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
    
    if (shipUpgrades.bouncing) {
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
    ctx.fillStyle = shipUpgrades.plasma ? 'magenta' : (shipUpgrades.heavyBullets ? 'yellow' : 'red');
    ctx.beginPath();
    let r = shipUpgrades.plasma ? 12 : (shipUpgrades.heavyBullets ? 4 : 2);
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
    ctx.globalAlpha = this.life / this.maxLife;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x - this.vx*2, this.y - this.vy*2); // stretched line
    ctx.stroke();
    ctx.globalAlpha = 1.0;
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
      // Aim at player if small UFO
      if (wave > 3 && Math.random() < 0.5 && ship.explodeTime <= 0) {
        angle = Math.atan2(ship.y - this.y, ship.x - this.x) + (Math.random()-0.5)*0.5;
      }
      let b = new Bullet(this.x, this.y, angle);
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

function spawnAsteroids(count) {
  for (let i = 0; i < count; i++) {
    let x, y;
    do {
      x = Math.random() * canvas.width;
      y = Math.random() * canvas.height;
    } while (distBetweenPoints(ship.x, ship.y, x, y) < 150);
    asteroids.push(new Asteroid(x, y, 40));
  }
}

function distBetweenPoints(x1, y1, x2, y2) {
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

function fireBullets() {
  if (ship.explodeTime > 0) return;
  let cooldown = 200 * shipUpgrades.fireRateMult;
  if (Date.now() - ship.lastShot < cooldown) return;
  if (bullets.length >= MAX_BULLETS) return;
  
  ship.lastShot = Date.now();
  
  let angles = [ship.a];
  if (shipUpgrades.dualShot) {
    // We will spawn two bullets offset from center instead
  }
  if (shipUpgrades.spreadShot) {
    angles.push(ship.a + 0.2);
    angles.push(ship.a - 0.2);
  }
  if (shipUpgrades.rearShot) angles.push(ship.a + Math.PI);
  if (shipUpgrades.sideShots) {
    angles.push(ship.a + Math.PI/2);
    angles.push(ship.a - Math.PI/2);
  }
  
  angles.forEach(a => {
    if (shipUpgrades.dualShot) {
      let perp = a + Math.PI/2;
      let ox = Math.cos(perp) * 6;
      let oy = Math.sin(perp) * 6;
      bullets.push(new Bullet(ship.x + Math.cos(a)*ship.r + ox, ship.y + Math.sin(a)*ship.r + oy, a));
      bullets.push(new Bullet(ship.x + Math.cos(a)*ship.r - ox, ship.y + Math.sin(a)*ship.r - oy, a));
    } else {
      bullets.push(new Bullet(ship.x + Math.cos(a)*ship.r, ship.y + Math.sin(a)*ship.r, a));
    }
  });
}

function explodeAsteroid(index) {
  let a = asteroids[index];
  asteroids.splice(index, 1);
  
  screenShake = Math.max(screenShake, 5);
  
  let pts = Math.floor(1000 / a.r) * shipUpgrades.scoreMult;
  combo++;
  comboTimer = 180; // 3 seconds to keep combo
  let mult = Math.min(5, 1 + Math.floor(combo / 5));
  pts *= mult;
  score += pts;
  
  floatingTexts.push(new FloatingText(a.x, a.y, `+${pts}`, mult > 1 ? 'yellow' : 'white'));
  
  for (let i = 0; i < 10; i++) particles.push(new Particle(a.x, a.y, (Math.random()-0.5)*8, (Math.random()-0.5)*8, 'white', 30));
  
  if (shipUpgrades.radioactive && Math.random() < 0.2) {
    // Radioactive blast
    for (let i = 0; i < 30; i++) particles.push(new Particle(a.x, a.y, (Math.random()-0.5)*12, (Math.random()-0.5)*12, 'lime', 40));
    asteroids.forEach((other, oi) => {
      if (distBetweenPoints(a.x, a.y, other.x, other.y) < 150) {
        setTimeout(() => explodeAsteroid(asteroids.indexOf(other)), 100); // cascade
      }
    });
  }
  
  if (shipUpgrades.scrapCollector && Math.random() < 0.05) {
    lives++;
    floatingTexts.push(new FloatingText(a.x, a.y-20, "1-UP!", "lime"));
  }
  
  if (a.r > 20) {
    asteroids.push(new Asteroid(a.x, a.y, a.r / 2));
    asteroids.push(new Asteroid(a.x, a.y, a.r / 2));
  }
  
  if (asteroids.length === 0) {
    gameState = 'UPGRADE';
    currentChoices = getRandomUpgrades(3, shipUpgrades.ids);
    selectedChoiceIdx = 0;
  }
}

function killShip() {
  if (ship.explodeTime > 0) return;
  
  if (ship.shieldActive) {
    ship.shieldActive = false;
    ship.ghostTimer = 120; // 2 seconds invincibility after shield breaks
    screenShake = 10;
    for (let k = 0; k < 20; k++) particles.push(new Particle(ship.x, ship.y, (Math.random()-0.5)*6, (Math.random()-0.5)*6, 'cyan', 30));
    return;
  }
  
  if (shipUpgrades.reflective) {
    for (let a = 0; a < Math.PI*2; a+= 0.2) {
      bullets.push(new Bullet(ship.x, ship.y, a));
    }
  }
  
  ship.explodeTime = 60;
  screenShake = 25;
  lives--;
  combo = 0;
  for (let k = 0; k < 40; k++) particles.push(new Particle(ship.x, ship.y, (Math.random()-0.5)*10, (Math.random()-0.5)*10, 'orange', 50));
}

function respawnShip() {
  ship = new Ship(canvas.width / 2, canvas.height / 2);
  ship.ghostTimer = 120; // safe spawn
}

function handleGamepadAxes(e) {
  if (!isRunning) return;
  const [x, y] = e.detail.axes;
  
  if (gameState === 'PLAYING') {
    keys.left = x < -0.5;
    keys.right = x > 0.5;
    keys.up = y < -0.5;
  } else if (gameState === 'UPGRADE') {
    // Menu navigation debounce logic
    if (x < -0.5 && !keys.left) { selectedChoiceIdx = Math.max(0, selectedChoiceIdx - 1); keys.left = true; }
    else if (x > -0.5) { keys.left = false; }
    
    if (x > 0.5 && !keys.right) { selectedChoiceIdx = Math.min(2, selectedChoiceIdx + 1); keys.right = true; }
    else if (x < 0.5) { keys.right = false; }
  }
}

function handleGamepadBtn(e) {
  if (!isRunning) return;
  const btn = e.detail.button;
  if (btn === 'B' || btn === 'START') { quitAsteroids(); return; }
  
  if (gameState === 'PLAYING') {
    if (btn === 'A') fireBullets();
  } else if (gameState === 'UPGRADE') {
    if (btn === 'A') {
      let choice = currentChoices[selectedChoiceIdx];
      shipUpgrades.ids.push(choice.id);
      choice.apply(shipUpgrades);
      
      // Start next wave
      wave++;
      ship.shieldActive = shipUpgrades.shield; // reset shield
      spawnAsteroids(4 + Math.floor(wave*1.5));
      gameState = 'PLAYING';
    }
  } else if (gameState === 'GAME_OVER') {
    if (btn === 'A') {
      // Restart
      shipUpgrades = { ids: [], speedMult: 1, turnMult: 1, frictionMult: 1, hitboxMult: 1, fireRateMult: 1 };
      wave = 1;
      score = 0;
      lives = 3;
      asteroids = [];
      bullets = [];
      spawnAsteroids(4);
      respawnShip();
      gameState = 'PLAYING';
    }
  }
}

function update() {
  if (!isRunning) return;
  
  // Background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  ctx.save();
  if (screenShake > 0) {
    ctx.translate((Math.random()-0.5)*screenShake, (Math.random()-0.5)*screenShake);
    screenShake *= 0.9;
    if (screenShake < 0.5) screenShake = 0;
  }
  
  if (gameState === 'PLAYING') {
    if (comboTimer > 0) {
      comboTimer -= (1 / shipUpgrades.comboDecayMult);
      if (comboTimer <= 0) combo = 0;
    }
    
    ship.update();
    ship.draw(ctx);
    
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
    
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
      floatingTexts[i].update();
      floatingTexts[i].draw(ctx);
      if (floatingTexts[i].life <= 0) floatingTexts.splice(i, 1);
    }
    
    // UFO Logic
    if (!ufo) {
      let spawnRate = shipUpgrades.ufoHunter ? 2 : 1;
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
      
      // Bullets vs Asteroids
      for (let j = bullets.length - 1; j >= 0; j--) {
        let b = bullets[j];
        if (b.isMine) continue;
        
        if (distBetweenPoints(a.x, a.y, b.x, b.y) < a.r) {
          a.hitFlash = 3;
          if (shipUpgrades.plasma) {
            // Plasma obliterates instantly but keeps going
            explodeAsteroid(i);
            hit = true;
            break;
          } else {
            if (shipUpgrades.flak) {
              for (let f = 0; f < 5; f++) bullets.push(new Bullet(b.x, b.y, Math.random()*Math.PI*2));
            }
            if (shipUpgrades.piercing && b.pierced < 1) {
              b.pierced++;
            } else {
              bullets.splice(j, 1);
            }
            explodeAsteroid(i);
            hit = true;
            break;
          }
        }
      }
      if (hit) continue;
      
      // Mines vs Asteroids
      for (let j = bullets.length - 1; j >= 0; j--) {
        let b = bullets[j];
        if (b.isMine && distBetweenPoints(a.x, a.y, b.x, b.y) < a.r + 15) {
          bullets.splice(j, 1);
          explodeAsteroid(i);
          screenShake = 10;
          for (let k = 0; k < 20; k++) particles.push(new Particle(a.x, a.y, (Math.random()-0.5)*8, (Math.random()-0.5)*8, 'orange', 40));
          hit = true;
          break;
        }
      }
      if (hit) continue;
      
      // Ship vs Asteroid
      if (ship.explodeTime <= 0 && ship.ghostTimer <= 0) {
        let shipHitbox = ship.r * shipUpgrades.hitboxMult;
        if (distBetweenPoints(a.x, a.y, ship.x, ship.y) < a.r + shipHitbox) {
          if (shipUpgrades.ramming && keys.up) {
            explodeAsteroid(i); // Ram through it!
            screenShake = 5;
          } else {
            killShip();
          }
        }
      }
    }
    
    // UFO Collisions
    if (ufo) {
      // Bullets vs UFO
      for (let j = bullets.length - 1; j >= 0; j--) {
        let b = bullets[j];
        if (b.isEnemy) continue;
        
        if (distBetweenPoints(ufo.x, ufo.y, b.x, b.y) < ufo.r) {
          ufo.hitFlash = 3;
          bullets.splice(j, 1);
          
          let pts = (shipUpgrades.ufoHunter ? 1000 : 500) * shipUpgrades.scoreMult;
          score += pts;
          floatingTexts.push(new FloatingText(ufo.x, ufo.y, `+${pts}`, 'magenta'));
          for (let k = 0; k < 20; k++) particles.push(new Particle(ufo.x, ufo.y, (Math.random()-0.5)*10, (Math.random()-0.5)*10, 'red', 40));
          
          if (shipUpgrades.ufoHunter && Math.random() < 0.25) {
            lives++;
            floatingTexts.push(new FloatingText(ufo.x, ufo.y-20, "1-UP!", "lime"));
          }
          
          ufo = null;
          ufoTimer = 600 - Math.min(400, wave * 20);
          screenShake = 15;
          break;
        }
      }
      
      // Ship vs UFO
      if (ufo && ship.explodeTime <= 0 && ship.ghostTimer <= 0) {
        if (distBetweenPoints(ufo.x, ufo.y, ship.x, ship.y) < ufo.r + (ship.r * shipUpgrades.hitboxMult)) {
          killShip();
        }
      }
    }
    
    // Enemy Bullets vs Ship
    if (ship.explodeTime <= 0 && ship.ghostTimer <= 0) {
      for (let j = bullets.length - 1; j >= 0; j--) {
        let b = bullets[j];
        if (!b.isEnemy) continue;
        if (distBetweenPoints(ship.x, ship.y, b.x, b.y) < (ship.r * shipUpgrades.hitboxMult)) {
          bullets.splice(j, 1);
          killShip();
          break;
        }
      }
    }
  }
  
  ctx.restore(); // restore screen shake
  
  // HUD
  ctx.fillStyle = 'white';
  ctx.font = '24px Courier New';
  ctx.textAlign = 'left';
  ctx.fillText(`SCORE: ${score}`, 20, 40);
  ctx.fillText(`WAVE: ${wave}`, 20, 70);
  ctx.fillText(`LIVES: ${lives}`, 20, 100);
  
  if (combo > 1) {
    ctx.fillStyle = 'yellow';
    ctx.fillText(`COMBO x${Math.min(5, 1 + Math.floor(combo/5))}`, 20, 130);
    // combo bar
    ctx.fillRect(20, 140, comboTimer, 5);
  }
  
  // Overlays
  if (gameState === 'UPGRADE') {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.font = '40px Courier New';
    ctx.fillText(`WAVE ${wave} COMPLETE`, canvas.width/2, canvas.height/2 - 150);
    ctx.font = '20px Courier New';
    ctx.fillText("Select an Upgrade (D-Pad Left/Right, A to Confirm)", canvas.width/2, canvas.height/2 - 100);
    
    let cardW = 250;
    let cardH = 150;
    let startX = canvas.width/2 - (cardW * 1.5) - 20;
    
    for (let i = 0; i < 3; i++) {
      let x = startX + i * (cardW + 20);
      let y = canvas.height/2;
      
      if (i === selectedChoiceIdx) {
        ctx.strokeStyle = 'yellow';
        ctx.lineWidth = 5;
        ctx.strokeRect(x, y, cardW, cardH);
      } else {
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, cardW, cardH);
      }
      
      let choice = currentChoices[i];
      if (choice) {
        ctx.fillStyle = choice.type === 'weapon' ? '#ff9999' : (choice.type === 'ship' ? '#99ccff' : '#99ff99');
        ctx.font = 'bold 20px Courier New';
        ctx.fillText(choice.name, x + cardW/2, y + 40);
        
        ctx.fillStyle = 'white';
        ctx.font = '16px Courier New';
        // Wrap text roughly
        let words = choice.desc.split(' ');
        let line = '';
        let lineY = y + 80;
        for (let w of words) {
          if (ctx.measureText(line + w + ' ').width > cardW - 20) {
            ctx.fillText(line, x + cardW/2, lineY);
            line = w + ' ';
            lineY += 20;
          } else {
            line += w + ' ';
          }
        }
        ctx.fillText(line, x + cardW/2, lineY);
      }
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
    ctx.fillText(`FINAL SCORE: ${score}`, canvas.width/2, canvas.height/2 + 10);
    ctx.font = '20px Courier New';
    ctx.fillText("Press A to Restart, B to Quit", canvas.width/2, canvas.height/2 + 50);
  }

  animationFrameId = requestAnimationFrame(update);
}

export function initAsteroids() {
  if (isRunning) return;
  isRunning = true;
  console.log("ASTEROIDS EASTER EGG INITIATED");
  
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
  score = 0;
  lives = 3;
  combo = 0;
  shipUpgrades = {
    ids: [], speedMult: 1, turnMult: 1, frictionMult: 1, hitboxMult: 1, fireRateMult: 1,
    dualShot: false, spreadShot: false, rearShot: false, sideShots: false,
    heavyBullets: false, piercing: false, flak: false, homing: false, bouncing: false, plasma: false,
    mineLayer: false, laserSight: false, ghostDrive: false, shield: false, reflective: false, ramming: false,
    scrapCollector: false, comboDecayMult: 1, scoreMult: 1, emp: false, chrono: false, radioactive: false,
    gravityWell: false, ufoHunter: false
  };
  
  ship = new Ship(canvas.width / 2, canvas.height / 2);
  asteroids = [];
  bullets = [];
  particles = [];
  floatingTexts = [];
  ufo = null;
  ufoTimer = 600;
  
  spawnAsteroids(4);
  
  window.addEventListener('app_gamepad_axes', handleGamepadAxes);
  window.addEventListener('app_gamepad_btn', handleGamepadBtn);
  window.addEventListener('resize', resizeCanvas);
  
  update();
}

function resizeCanvas() {
  if (canvas) {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
}

export function quitAsteroids() {
  if (!isRunning) return;
  isRunning = false;
  
  cancelAnimationFrame(animationFrameId);
  window.removeEventListener('app_gamepad_axes', handleGamepadAxes);
  window.removeEventListener('app_gamepad_btn', handleGamepadBtn);
  window.removeEventListener('resize', resizeCanvas);
  
  if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
  canvas = null;
  ctx = null;
}
