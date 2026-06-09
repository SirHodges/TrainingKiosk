// tanks.js - Modular Top-Down Tanks Mini-Game

let isRunning = false;
let canvas, ctx;
let animationFrameId;

let keys = [
  { up: false, down: false, left: false, right: false, shoot: false },
  { up: false, down: false, left: false, right: false, shoot: false }
];

let tanks = [];
let bullets = [];
let scores = [0, 0];
let gameOver = false;
let gameOverTime = 0;

const WIDTH = 800;
const HEIGHT = 480;
const TANK_SPEED = 2;
const TANK_TURN_SPEED = 0.05;
const TANK_RADIUS = 12;
const BULLET_SPEED = 6;
const MAX_SCORE = 3;

const walls = [
  { x: 0, y: 0, w: WIDTH, h: 20 },
  { x: 0, y: HEIGHT - 20, w: WIDTH, h: 20 },
  { x: 0, y: 0, w: 20, h: HEIGHT },
  { x: WIDTH - 20, y: 0, w: 20, h: HEIGHT },
  { x: 350, y: 150, w: 100, h: 180 },
  { x: 100, y: 100, w: 150, h: 20 },
  { x: 100, y: 100, w: 20, h: 100 },
  { x: WIDTH - 250, y: HEIGHT - 120, w: 150, h: 20 },
  { x: WIDTH - 120, y: HEIGHT - 200, w: 20, h: 100 },
  { x: 100, y: HEIGHT - 200, w: 20, h: 100 },
  { x: WIDTH - 120, y: 100, w: 20, h: 100 }
];

class Tank {
  constructor(playerIdx, color, startX, startY, startAngle) {
    this.playerIdx = playerIdx;
    this.color = color;
    this.startX = startX;
    this.startY = startY;
    this.startAngle = startAngle;
    this.reset();
  }
  reset() {
    this.x = this.startX;
    this.y = this.startY;
    this.angle = this.startAngle;
    this.lastShot = 0;
    this.dead = false;
  }
  update() {
    if (this.dead || gameOver) return;
    const k = keys[this.playerIdx];
    
    if (k.left) this.angle -= TANK_TURN_SPEED;
    if (k.right) this.angle += TANK_TURN_SPEED;

    let dx = 0, dy = 0;
    if (k.up) {
      dx = Math.cos(this.angle) * TANK_SPEED;
      dy = Math.sin(this.angle) * TANK_SPEED;
    } else if (k.down) {
      dx = -Math.cos(this.angle) * TANK_SPEED;
      dy = -Math.sin(this.angle) * TANK_SPEED;
    }

    if (dx !== 0 || dy !== 0) {
      this.x += dx;
      if (checkWallCollision(this.x, this.y, TANK_RADIUS)) this.x -= dx;
      this.y += dy;
      if (checkWallCollision(this.x, this.y, TANK_RADIUS)) this.y -= dy;
    }

    if (k.shoot && Date.now() - this.lastShot > 500) {
      bullets.push({
        x: this.x + Math.cos(this.angle) * (TANK_RADIUS + 8),
        y: this.y + Math.sin(this.angle) * (TANK_RADIUS + 8),
        vx: Math.cos(this.angle) * BULLET_SPEED,
        vy: Math.sin(this.angle) * BULLET_SPEED,
        owner: this.playerIdx
      });
      this.lastShot = Date.now();
      k.shoot = false;
    }
  }
  draw() {
    if (this.dead) return;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.fillStyle = this.color;
    ctx.fillRect(-10, -10, 20, 20);
    ctx.fillStyle = '#bbb';
    ctx.fillRect(0, -3, 16, 6);
    ctx.restore();
  }
}

function checkWallCollision(cx, cy, radius) {
  for (let w of walls) {
    let testX = cx, testY = cy;
    if (cx < w.x) testX = w.x;
    else if (cx > w.x + w.w) testX = w.x + w.w;
    if (cy < w.y) testY = w.y;
    else if (cy > w.y + w.h) testY = w.y + w.h;
    
    let distX = cx - testX;
    let distY = cy - testY;
    if ((distX*distX + distY*distY) <= radius*radius) return true;
  }
  return false;
}

let roundResetTimeout = null;

function resetRound() {
  if (gameOver) return;
  tanks.forEach(t => t.reset());
  bullets = [];
}

function update() {
  if (!isRunning) return;
  
  if (gameOver) {
    if (Date.now() - gameOverTime > 5000) quitTanks();
  } else {
    tanks.forEach(t => t.update());

    for (let i = bullets.length - 1; i >= 0; i--) {
      let b = bullets[i];
      b.x += b.vx;
      b.y += b.vy;

      if (checkWallCollision(b.x, b.y, 3)) {
        bullets.splice(i, 1);
        continue;
      }

      for (let t of tanks) {
        if (!t.dead && b.owner !== t.playerIdx) {
          let dx = t.x - b.x;
          let dy = t.y - b.y;
          if (dx*dx + dy*dy <= TANK_RADIUS*TANK_RADIUS) {
            t.dead = true;
            bullets.splice(i, 1);
            scores[b.owner]++;
            if (scores[b.owner] >= MAX_SCORE) {
              gameOver = true;
              gameOverTime = Date.now();
              if (roundResetTimeout) clearTimeout(roundResetTimeout);
            } else {
              if (roundResetTimeout) clearTimeout(roundResetTimeout);
              roundResetTimeout = setTimeout(resetRound, 1500);
            }
            break;
          }
        }
      }
    }
  }

  draw();
  animationFrameId = requestAnimationFrame(update);
}

function draw() {
  ctx.fillStyle = '#222';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = '#555';
  walls.forEach(w => ctx.fillRect(w.x, w.y, w.w, w.h));

  tanks.forEach(t => t.draw());

  ctx.fillStyle = '#ff0';
  bullets.forEach(b => {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.font = '24px monospace';
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.fillText(`${scores[0]} - ${scores[1]}`, WIDTH / 2, 50);

  if (gameOver) {
    ctx.font = '40px monospace';
    ctx.fillStyle = scores[0] >= MAX_SCORE ? '#3b82f6' : '#ef4444';
    ctx.fillText(`Player ${scores[0] >= MAX_SCORE ? '1 (Blue)' : '2 (Red)'} Wins!`, WIDTH / 2, HEIGHT / 2);
  }
}

function handleGamepadAxes(e) {
  if (!isRunning) return;
  const p = e.detail.player;
  if (p < 0 || p > 1) return;
  const [x, y] = e.detail.axes;
  keys[p].left = x < -0.5;
  keys[p].right = x > 0.5;
  keys[p].up = y < -0.5;
  keys[p].down = y > 0.5;
}

function handleBtn(e) {
  if (!isRunning) return;
  const btn = e.detail.button;
  const p = e.detail.player;
  if (btn === 'Start' || btn === 'Select') {
    quitTanks();
    return;
  }
  if (p >= 0 && p <= 1 && btn === 'A') {
    keys[p].shoot = true;
  }
}

function initTanks() {
  if (isRunning) return;
  isRunning = true;
  canvas = document.createElement('canvas');
  canvas.id = 'tanks-canvas';
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  canvas.style.position = 'fixed';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.zIndex = '9999';
  canvas.style.backgroundColor = '#222';
  document.body.appendChild(canvas);
  ctx = canvas.getContext('2d');
  scores = [0, 0];
  gameOver = false;
  tanks = [
    new Tank(0, '#3b82f6', 60, HEIGHT/2, 0),
    new Tank(1, '#ef4444', WIDTH-60, HEIGHT/2, Math.PI)
  ];
  bullets = [];
  window.addEventListener('app_gamepad_axes', handleGamepadAxes);
  window.addEventListener('app_gamepad_btn', handleBtn);
  update();
}

function quitTanks() {
  isRunning = false;
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  window.removeEventListener('app_gamepad_axes', handleGamepadAxes);
  window.removeEventListener('app_gamepad_btn', handleBtn);
  if (canvas) canvas.remove();
}

export { initTanks };
