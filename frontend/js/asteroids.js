// asteroids.js - Modular Asteroids Mini-Game
// Triggered by Konami Code

let isRunning = false;
let canvas, ctx;
let animationFrameId;

// Game State
let ship = null;
let asteroids = [];
let bullets = [];
let particles = [];
let keys = { left: false, right: false, up: false, shoot: false };
let lastShot = 0;
let score = 0;

// Config
const FRICTION = 0.99;
const SHIP_THRUST = 0.15;
const TURN_SPEED = 0.08;
const BULLET_SPEED = 7;
const MAX_BULLETS = 5;

class Ship {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.r = 15;
    this.a = Math.PI / 2 * 3; // pointing up
    this.vx = 0;
    this.vy = 0;
    this.explodeTime = 0;
  }
  update() {
    if (this.explodeTime > 0) {
      this.explodeTime--;
      return;
    }
    if (keys.left) this.a -= TURN_SPEED;
    if (keys.right) this.a += TURN_SPEED;
    if (keys.up) {
      this.vx += Math.cos(this.a) * SHIP_THRUST;
      this.vy += Math.sin(this.a) * SHIP_THRUST;
    }
    this.vx *= FRICTION;
    this.vy *= FRICTION;
    this.x += this.vx;
    this.y += this.vy;

    // Screen wrap
    if (this.x < 0) this.x = canvas.width;
    if (this.x > canvas.width) this.x = 0;
    if (this.y < 0) this.y = canvas.height;
    if (this.y > canvas.height) this.y = 0;
  }
  draw(ctx) {
    if (this.explodeTime > 0) return; // don't draw if exploded
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(this.x + Math.cos(this.a) * this.r, this.y + Math.sin(this.a) * this.r);
    ctx.lineTo(this.x + Math.cos(this.a + 2.5) * this.r, this.y + Math.sin(this.a + 2.5) * this.r);
    ctx.lineTo(this.x + Math.cos(this.a - 2.5) * this.r, this.y + Math.sin(this.a - 2.5) * this.r);
    ctx.closePath();
    ctx.stroke();
    
    // Draw thrust
    if (keys.up) {
      ctx.beginPath();
      ctx.moveTo(this.x - Math.cos(this.a) * this.r, this.y - Math.sin(this.a) * this.r);
      ctx.lineTo(this.x + Math.cos(this.a + 2.8) * this.r * 1.5, this.y + Math.sin(this.a + 2.8) * this.r * 1.5);
      ctx.lineTo(this.x + Math.cos(this.a - 2.8) * this.r * 1.5, this.y + Math.sin(this.a - 2.8) * this.r * 1.5);
      ctx.fillStyle = 'orange';
      ctx.fill();
    }
  }
}

class Asteroid {
  constructor(x, y, r) {
    this.x = x;
    this.y = y;
    this.r = r;
    this.a = Math.random() * Math.PI * 2;
    this.vx = Math.cos(this.a) * (Math.random() * 2 + 1) * (50 / r); // smaller = faster
    this.vy = Math.sin(this.a) * (Math.random() * 2 + 1) * (50 / r);
    this.vert = Math.floor(Math.random() * 5 + 5);
    this.offs = [];
    for (let i = 0; i < this.vert; i++) {
      this.offs.push(Math.random() * 0.4 + 0.8);
    }
  }
  update() {
    this.x += this.vx;
    this.y += this.vy;
    if (this.x < -this.r) this.x = canvas.width + this.r;
    if (this.x > canvas.width + this.r) this.x = -this.r;
    if (this.y < -this.r) this.y = canvas.height + this.r;
    if (this.y > canvas.height + this.r) this.y = -this.r;
  }
  draw(ctx) {
    ctx.strokeStyle = '#aaa';
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
  }
}

class Bullet {
  constructor(x, y, a) {
    this.x = x;
    this.y = y;
    this.vx = Math.cos(a) * BULLET_SPEED;
    this.vy = Math.sin(a) * BULLET_SPEED;
    this.life = 60;
  }
  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.life--;
    if (this.x < 0) this.x = canvas.width;
    if (this.x > canvas.width) this.x = 0;
    if (this.y < 0) this.y = canvas.height;
    if (this.y > canvas.height) this.y = 0;
  }
  draw(ctx) {
    ctx.fillStyle = 'red';
    ctx.beginPath();
    ctx.arc(this.x, this.y, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

class Particle {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = (Math.random() - 0.5) * 4;
    this.vy = (Math.random() - 0.5) * 4;
    this.life = 30 + Math.random() * 20;
  }
  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.life--;
  }
  draw(ctx) {
    ctx.fillStyle = `rgba(255, 200, 0, ${this.life / 50})`;
    ctx.fillRect(this.x, this.y, 3, 3);
  }
}

function spawnAsteroids(count) {
  for (let i = 0; i < count; i++) {
    let x, y;
    do {
      x = Math.random() * canvas.width;
      y = Math.random() * canvas.height;
    } while (distBetweenPoints(ship.x, ship.y, x, y) < 100);
    asteroids.push(new Asteroid(x, y, 40));
  }
}

function distBetweenPoints(x1, y1, x2, y2) {
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

function explodeAsteroid(index) {
  let a = asteroids[index];
  asteroids.splice(index, 1);
  score += Math.floor(1000 / a.r);
  
  for (let i = 0; i < 10; i++) particles.push(new Particle(a.x, a.y));
  
  if (a.r > 20) { // Split
    asteroids.push(new Asteroid(a.x, a.y, a.r / 2));
    asteroids.push(new Asteroid(a.x, a.y, a.r / 2));
  }
  
  if (asteroids.length === 0) {
    setTimeout(() => spawnAsteroids(5), 1000);
  }
}

function handleGamepadAxes(e) {
  if (!isRunning) return;
  const [x, y] = e.detail.axes;
  keys.left = x < -0.5;
  keys.right = x > 0.5;
  keys.up = y < -0.5;
}

function handleGamepadBtn(e) {
  if (!isRunning) return;
  const btn = e.detail.button;
  if (btn === 'A') {
    if (ship.explodeTime <= 0 && bullets.length < MAX_BULLETS) {
      bullets.push(new Bullet(ship.x + Math.cos(ship.a) * ship.r, ship.y + Math.sin(ship.a) * ship.r, ship.a));
    }
  } else if (btn === 'B' || btn === 'START') {
    quitAsteroids();
  }
}

function handleKeyboardDown(e) {
  if (!isRunning) return;
  if (e.key === 'ArrowLeft') keys.left = true;
  if (e.key === 'ArrowRight') keys.right = true;
  if (e.key === 'ArrowUp') keys.up = true;
  if (e.key === ' ') {
    if (ship.explodeTime <= 0 && bullets.length < MAX_BULLETS) {
      bullets.push(new Bullet(ship.x + Math.cos(ship.a) * ship.r, ship.y + Math.sin(ship.a) * ship.r, ship.a));
    }
  }
  if (e.key === 'Escape') quitAsteroids();
}

function handleKeyboardUp(e) {
  if (!isRunning) return;
  if (e.key === 'ArrowLeft') keys.left = false;
  if (e.key === 'ArrowRight') keys.right = false;
  if (e.key === 'ArrowUp') keys.up = false;
}

function update() {
  if (!isRunning) return;
  
  // Background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'; // trailing effect
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Ship
  ship.update();
  ship.draw(ctx);
  
  // Bullets
  for (let i = bullets.length - 1; i >= 0; i--) {
    bullets[i].update();
    bullets[i].draw(ctx);
    if (bullets[i].life <= 0) bullets.splice(i, 1);
  }
  
  // Asteroids
  for (let i = asteroids.length - 1; i >= 0; i--) {
    asteroids[i].update();
    asteroids[i].draw(ctx);
  }
  
  // Particles
  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update();
    particles[i].draw(ctx);
    if (particles[i].life <= 0) particles.splice(i, 1);
  }
  
  // Collision: Bullet vs Asteroid
  for (let i = asteroids.length - 1; i >= 0; i--) {
    let a = asteroids[i];
    let hit = false;
    for (let j = bullets.length - 1; j >= 0; j--) {
      let b = bullets[j];
      if (distBetweenPoints(a.x, a.y, b.x, b.y) < a.r) {
        bullets.splice(j, 1);
        explodeAsteroid(i);
        hit = true;
        break;
      }
    }
    if (hit) continue;
    
    // Collision: Ship vs Asteroid
    if (ship.explodeTime <= 0 && distBetweenPoints(a.x, a.y, ship.x, ship.y) < a.r + ship.r) {
      ship.explodeTime = 60;
      for (let k = 0; k < 30; k++) particles.push(new Particle(ship.x, ship.y));
      setTimeout(() => {
        ship = new Ship(canvas.width / 2, canvas.height / 2);
        score = 0;
      }, 1500);
    }
  }
  
  // Score & Instructions
  ctx.fillStyle = 'white';
  ctx.font = '24px Courier New';
  ctx.fillText(`SCORE: ${score}`, 20, 40);
  
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '16px Courier New';
  ctx.fillText('DPAD: Move/Rotate | A: Shoot | B: Quit', 20, canvas.height - 20);

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
  
  ship = new Ship(canvas.width / 2, canvas.height / 2);
  asteroids = [];
  bullets = [];
  particles = [];
  score = 0;
  
  spawnAsteroids(4);
  
  window.addEventListener('app_gamepad_axes', handleGamepadAxes);
  window.addEventListener('app_gamepad_btn', handleGamepadBtn);
  window.addEventListener('keydown', handleKeyboardDown);
  window.addEventListener('keyup', handleKeyboardUp);
  
  // Handle resize
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
  console.log("ASTEROIDS EASTER EGG TERMINATED");
  
  cancelAnimationFrame(animationFrameId);
  window.removeEventListener('app_gamepad_axes', handleGamepadAxes);
  window.removeEventListener('app_gamepad_btn', handleGamepadBtn);
  window.removeEventListener('keydown', handleKeyboardDown);
  window.removeEventListener('keyup', handleKeyboardUp);
  window.removeEventListener('resize', resizeCanvas);
  
  if (canvas && canvas.parentNode) {
    canvas.parentNode.removeChild(canvas);
  }
  canvas = null;
  ctx = null;
}
