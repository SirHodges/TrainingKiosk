// app.js - Main entry point

import { loadCategories, loadSkills } from './media.js';
import { initQuiz, resetQuiz } from './quiz.js';
import { loadLeaderboard } from './leaderboard.js';
import { initGeoGame, startGeoGame } from './geogame.js';
import { initGamepad } from './gamepad.js';
import { triggerUpdate, clearLeaderboard } from './api.js';
import { clearFocusables } from './navigation.js';

let currentMode = 'skillplayer';

document.addEventListener('DOMContentLoaded', () => {
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
  loadLeaderboard('quiz-sidebar');
  
  // Init Gamepad
  initGamepad();
  
  // Init GeoGame
  initGeoGame();
  
  // Init Admin panel
  initAdmin();
  
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
      const mode = e.target.getAttribute('data-mode');
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
  
  // Update sidebars
  document.querySelectorAll('.sidebar-mode-content').forEach(content => {
    content.classList.toggle('active', content.id === `${mode}-sidebar`);
  });
  
  // Update main content
  document.querySelectorAll('.app-mode-content').forEach(content => {
    content.classList.toggle('active', content.id === `${mode}-content`);
  });
  
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
