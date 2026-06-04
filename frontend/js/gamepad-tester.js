let animationFrameId = null;

export function initGamepadTester() {
  const btn = document.getElementById('btn-test-gamepads');
  const modal = document.getElementById('gamepad-tester-modal');
  const closeBtn = document.getElementById('btn-close-tester');
  
  if (!btn || !modal) return;
  
  btn.addEventListener('click', () => {
    document.getElementById('admin-popup').classList.add('hidden');
    modal.classList.remove('hidden');
    startTesterLoop();
  });
  
  closeBtn.addEventListener('click', () => {
    modal.classList.add('hidden');
    stopTesterLoop();
  });
  
  window.addEventListener('raw_gamepad_backend', (e) => {
    const rawBox = document.getElementById('gamepad-tester-raw-output');
    if (rawBox) {
      let msg = '';
      if (e.detail.action === 'RAW_EVDEV_SCANCODE') {
         msg = `<span style="color: #f59e0b; font-weight: bold;">[RAW EVDEV] SCANCODE: ${e.detail.scancode}</span> (Path: ${e.detail.path})`;
      } else {
         msg = `[MAPPED EVENT] player: ${e.detail.player}, action: ${e.detail.action}, btn_index: ${e.detail.button_index}, dir: ${e.detail.direction}`;
      }
      rawBox.innerHTML += `<div>${msg}</div>`;
      rawBox.scrollTop = rawBox.scrollHeight;
    }
  });
}

function startTesterLoop() {
  if (animationFrameId) return;
  pollGamepads();
}

function stopTesterLoop() {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
}

function pollGamepads() {
  const output = document.getElementById('gamepad-tester-output');
  const gps = navigator.getGamepads ? navigator.getGamepads() : [];
  
  let html = '';
  let found = false;
  
  for (let i = 0; i < gps.length; i++) {
    const gp = gps[i];
    if (!gp) continue;
    found = true;
    
    html += `<div style="margin-bottom: 15px; border-bottom: 1px solid #333; padding-bottom: 10px;">`;
    html += `<strong style="color: #4ade80;">Gamepad ${i}:</strong> ${gp.id}<br>`;
    
    html += `<div><strong>Buttons:</strong> `;
    const pressedBtns = [];
    for (let b = 0; b < gp.buttons.length; b++) {
      if (gp.buttons[b].pressed) {
        pressedBtns.push(`<span style="color: #ef4444; font-weight: bold; padding: 2px 6px; background: rgba(239, 68, 68, 0.2); border-radius: 4px;">[${b}]</span>`);
      }
    }
    if (pressedBtns.length > 0) {
      html += pressedBtns.join(' ');
    } else {
      html += `<span style="color: #666;">None</span>`;
    }
    html += `</div>`;
    
    html += `<div><strong>Axes:</strong> `;
    const activeAxes = [];
    for (let a = 0; a < gp.axes.length; a++) {
      if (Math.abs(gp.axes[a]) > 0.1) {
        activeAxes.push(`<span style="color: #3b82f6;">[${a}]: ${gp.axes[a].toFixed(2)}</span>`);
      }
    }
    if (activeAxes.length > 0) {
      html += activeAxes.join(' | ');
    } else {
      html += `<span style="color: #666;">None</span>`;
    }
    html += `</div>`;
    
    html += `</div>`;
  }
  
  if (!found) {
    html = '<div style="color: #ef4444;">No gamepads detected. Press any button on the controller to wake it up!</div>';
  }
  
  output.innerHTML = html;
  
  animationFrameId = requestAnimationFrame(pollGamepads);
}
