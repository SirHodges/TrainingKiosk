// app.js - Main entry point

import { loadCategories, loadSkills } from './media.js';
import { initQuiz, resetQuiz } from './quiz.js';
import { loadLeaderboard } from './leaderboard.js';
import { initGamepad } from './gamepad.js';
import { clearFocusables } from './navigation.js';

let currentMode = 'skillplayer';

document.addEventListener('DOMContentLoaded', () => {
  // Initialize modes
  initModeTabs();
  
  // Load initial data
  loadCategories();
  loadLeaderboard('quiz-sidebar');
  
  // Init gamepad client
  initGamepad();
  
  // Init Admin panel
  initAdmin();
});

function initAdmin() {
  const adminBtn = document.getElementById('admin-btn');
  const adminPopup = document.getElementById('admin-popup');
  if (adminBtn && adminPopup) {
    adminBtn.addEventListener('click', () => {
      adminPopup.classList.toggle('hidden');
    });
  }
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
  } else if (mode === 'skillplayer') {
    // Media navigation re-init handled by media.js
  }
}

// Global exposure for HTML onclick handlers
window.switchMode = switchMode;
