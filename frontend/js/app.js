// app.js - Main entry point

import { loadCategories, loadSkills } from './media.js?v=5.4';
import { initQuiz, resetQuiz, isQuizLocked } from './quiz.js?v=5.4';
import { loadLeaderboard } from './leaderboard.js?v=5.4';
import { initGeoGame, startGeoGame, isGeoGameLocked } from './geogame.js?v=5.4';
import { initGamepad } from './gamepad.js?v=5.4';
import { triggerUpdate, clearLeaderboard } from './api.js?v=5.4';
import { clearFocusables } from './navigation.js?v=5.4';

let currentMode = 'quiz';

import { initGamepadTester } from './gamepad-tester.js?v=5.4';

document.addEventListener('DOMContentLoaded', () => {
  console.log("App initializing...");
  
  // Load saved theme
  const savedTheme = sessionStorage.getItem('kiosk_theme');
  if (savedTheme) {
    document.body.className = savedTheme;
    if (savedTheme === 'theme-lucky') {
      const luckyColors = sessionStorage.getItem('kiosk_lucky_colors');
      if (luckyColors) {
        const parsed = JSON.parse(luckyColors);
        Object.keys(parsed).forEach(key => {
          document.documentElement.style.setProperty(key, parsed[key]);
        });
      }
    }
  } else {
    document.body.className = 'theme-emergency-response';
  }

  // Initialize modes
  initModeTabs();
  
  // Load initial data
  loadCategories();
  initQuiz();
  loadLeaderboard('quiz-sidebar');
  
  // Init Gamepad
  initGamepad();
  
  // Init GeoGame
  initGeoGame();
  
  // Init Admin panel
  initAdmin();
  initGamepadTester();
  
  // Refresh btn
  const refreshMediaBtn = document.getElementById('btn-refresh-media');
  if (refreshMediaBtn) {
    refreshMediaBtn.addEventListener('click', () => {
      refreshMediaBtn.style.opacity = '0.5';
      setTimeout(() => refreshMediaBtn.style.opacity = '1', 200);
      loadCategories();
    });
  }
});

function initAdmin() {
  const adminBtn = document.getElementById('admin-btn');
  const adminPopup = document.getElementById('admin-popup');
  
  if (adminBtn && adminPopup) {
    adminBtn.addEventListener('click', () => {
      adminPopup.classList.toggle('hidden');
    });
  }
  
  const updateBtn = document.getElementById('btn-update-reboot');
  if (updateBtn) {
    updateBtn.addEventListener('click', async () => {
      if (confirm('Are you sure you want to pull the latest updates and reboot the system?')) {
        updateBtn.textContent = 'Rebooting...';
        await triggerUpdate();
      }
    });
  }
  
  const resetBtn = document.getElementById('btn-reset-scores');
  if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
      if (confirm('Are you sure you want to permanently delete all leaderboard scores?')) {
        await clearLeaderboard();
        loadLeaderboard('quiz-sidebar');
        alert('Scores reset successfully.');
      }
    });
  }

  // Easter Egg Logic
  let konamiBuffer = [];
  const seqAsteroids = JSON.stringify(['A', 'B', 'Start', 'Select']);
  const seqTanks = JSON.stringify(['X', 'Y', 'Start', 'Select']);

  // Inject debugger UI into admin popup
  const debugContainer = document.createElement('div');
  debugContainer.style.marginTop = '20px';
  debugContainer.style.padding = '10px';
  debugContainer.style.background = 'rgba(0,0,0,0.5)';
  debugContainer.style.border = '1px solid #444';
  debugContainer.style.borderRadius = '5px';
  debugContainer.style.fontFamily = 'monospace';
  debugContainer.style.fontSize = '12px';
  debugContainer.style.color = '#0f0';
  debugContainer.style.wordWrap = 'break-word';
  debugContainer.style.whiteSpace = 'pre-wrap';
  debugContainer.innerHTML = 'Konami Debugger:<br><span id="konami-buffer">[]</span>';
  if (adminPopup) adminPopup.appendChild(debugContainer);

  function checkKonami(input) {
    if (!adminPopup || adminPopup.classList.contains('hidden')) {
      konamiBuffer = [];
      return;
    }
    
    konamiBuffer.push(input);
    if (konamiBuffer.length > 10) konamiBuffer.shift();
    
    const bufferEl = document.getElementById('konami-buffer');
    if (bufferEl) bufferEl.textContent = JSON.stringify(konamiBuffer);
    
    const bufferStr = JSON.stringify(konamiBuffer);
    
    if (bufferStr.includes(seqAsteroids.slice(1, -1))) {
      konamiBuffer = [];
      if (bufferEl) bufferEl.textContent = 'ASTEROIDS TRIGGERED!';
      adminPopup.classList.add('hidden');
      import('./asteroids.js').then(module => {
        module.initAsteroids();
      }).catch(err => console.error('Failed to load asteroids:', err));
    }
    
    if (bufferStr.includes(seqTanks.slice(1, -1))) {
      konamiBuffer = [];
      if (bufferEl) bufferEl.textContent = 'TANKS TRIGGERED!';
      adminPopup.classList.add('hidden');
      import('./tanks.js').then(module => {
        module.initTanks();
      }).catch(err => console.error('Failed to load tanks:', err));
    }
  }

  window.addEventListener('app_gamepad_dpad', (e) => checkKonami(e.detail.direction));
  window.addEventListener('app_gamepad_btn', (e) => checkKonami(e.detail.button));
  window.addEventListener('app_gamepad_start_down', () => checkKonami('Start'));
  
  // Show raw events for troubleshooting unknown arcade buttons
  window.addEventListener('raw_gamepad_backend', (e) => {
    if (!adminPopup || adminPopup.classList.contains('hidden')) return;
    const bufferEl = document.getElementById('konami-buffer');
    if (bufferEl) {
      if (e.detail.action === 'RAW_EVDEV_SCANCODE') {
        bufferEl.innerHTML = `Raw Unmapped Key Pressed: <b>${e.detail.scancode}</b><br>` + bufferEl.innerHTML;
      } else if (e.detail.action === 'RAW_EVDEV_AXIS') {
        bufferEl.innerHTML = `Raw Axis Moved: <b>Code ${e.detail.axis_code} | Val ${e.detail.value}</b><br>` + bufferEl.innerHTML;
      }
    }
  });

  // Theme settings toggle
  const toggleThemesBtn = document.getElementById('btn-toggle-themes');
  const themeSubmenu = document.getElementById('theme-submenu');
  const themeCaret = document.getElementById('theme-caret');
  
  if (toggleThemesBtn && themeSubmenu) {
    toggleThemesBtn.addEventListener('click', () => {
      const isHidden = themeSubmenu.style.display === 'none';
      themeSubmenu.style.display = isHidden ? 'flex' : 'none';
      themeCaret.textContent = isHidden ? '▲' : '▼';
    });
  }

  // Theme settings buttons
  const themeBtns = document.querySelectorAll('.theme-btn');
  themeBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.documentElement.style.cssText = ''; // Clear lucky inline styles
      const themeClass = e.target.getAttribute('data-theme');
      document.body.className = themeClass;
      sessionStorage.setItem('kiosk_theme', themeClass);
    });
  });

  const luckyBtn = document.getElementById('btn-lucky-theme');
  if (luckyBtn) {
    luckyBtn.addEventListener('click', applyLuckyTheme);
  }
}

function applyLuckyTheme() {
  const h = Math.floor(Math.random() * 360);
  const isDark = Math.random() > 0.3; // 70% chance of dark mode
  
  const bgL = isDark ? 12 : 95;
  const textL = isDark ? 95 : 15;
  
  const colors = {
    '--bg-primary': `hsl(${h}, 30%, ${bgL}%)`,
    '--bg-secondary': `hsl(${h}, 30%, ${isDark ? bgL+4 : bgL-4}%)`,
    '--bg-tertiary': `hsl(${h}, 25%, ${isDark ? bgL+8 : bgL-8}%)`,
    '--bg-quaternary': `hsl(${h}, 25%, ${isDark ? bgL+12 : bgL-12}%)`,
    '--bg-elevated': `hsl(${h}, 25%, ${isDark ? bgL+12 : bgL-12}%)`,
    '--accent-primary': `hsl(${(h+180)%360}, 85%, 55%)`,
    '--accent-primary-light': `hsl(${(h+180)%360}, 85%, 65%)`,
    '--accent-primary-dark': `hsl(${(h+180)%360}, 85%, 45%)`,
    '--accent-secondary': `hsl(${(h+60)%360}, 85%, 55%)`,
    '--accent-secondary-light': `hsl(${(h+60)%360}, 85%, 65%)`,
    '--text-primary': `hsl(${h}, 10%, ${textL}%)`,
    '--text-secondary': `hsl(${h}, 10%, ${isDark ? 70 : 40}%)`,
    '--text-muted': `hsl(${h}, 10%, 55%)`,
    '--glass-bg': `hsla(0, 0%, ${isDark ? 255 : 0}%, 0.05)`,
    '--glass-bg-hover': `hsla(0, 0%, ${isDark ? 255 : 0}%, 0.1)`,
    '--glass-bg-active': `hsla(0, 0%, ${isDark ? 255 : 0}%, 0.15)`,
    '--glass-border': `hsla(0, 0%, ${isDark ? 255 : 0}%, 0.1)`,
    '--glass-border-hover': `hsla(0, 0%, ${isDark ? 255 : 0}%, 0.2)`,
    '--bg-gradient': `linear-gradient(135deg, hsl(${h}, 30%, ${bgL}%) 0%, hsl(${h}, 25%, ${isDark ? bgL+12 : bgL-12}%) 100%)`
  };

  document.body.className = 'theme-lucky';
  Object.keys(colors).forEach(key => {
    document.documentElement.style.setProperty(key, colors[key]);
  });
  
  sessionStorage.setItem('kiosk_theme', 'theme-lucky');
  sessionStorage.setItem('kiosk_lucky_colors', JSON.stringify(colors));
}

function initModeTabs() {
  const tabs = document.querySelectorAll('.app-mode-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      const mode = e.currentTarget.getAttribute('data-mode');
      switchMode(mode);
    });
  });
}

export function switchMode(mode) {
  if (currentMode === mode) return;
  
  // Update tabs
  document.querySelectorAll('.app-mode-tab').forEach(tab => {
    tab.classList.toggle('active', tab.getAttribute('data-mode') === mode);
  });
  
  if (mode === 'geogame') {
    document.querySelector('.app-body').classList.add('hidden');
    const geogameMode = document.getElementById('geogame-mode');
    if (geogameMode) geogameMode.classList.remove('hidden');
  } else {
    document.querySelector('.app-body').classList.remove('hidden');
    const geogameMode = document.getElementById('geogame-mode');
    if (geogameMode) geogameMode.classList.add('hidden');
    
    // Update sidebars
    document.querySelectorAll('.sidebar-mode-content').forEach(content => {
      content.classList.toggle('active', content.id === `${mode}-sidebar`);
    });
    
    // Update main content
    document.querySelectorAll('.app-mode-content').forEach(content => {
      content.classList.toggle('active', content.id === `${mode}-content`);
    });
  }
  
  // Clean up previous mode state
  if (currentMode === 'quiz') {
    resetQuiz();
  }
  
  currentMode = mode;
  clearFocusables('global');
  
  if (mode === 'quiz') {
    initQuiz();
    loadLeaderboard('quiz-sidebar');
  } else if (mode === 'geogame') {
    startGeoGame();
  } else if (mode === 'skillplayer') {
    // Media navigation re-init handled by media.js
  }
}

// Global exposure for HTML onclick handlers
window.switchMode = switchMode;
