// leaderboard.js - Leaderboard display module

import { getLeaderboard, checkTopScore, submitScore } from './api.js';

export async function loadLeaderboard(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  const scores = await getLeaderboard();
  
  let html = `
    <div class="leaderboard-container">
      <div class="leaderboard-header">
        <h2 class="leaderboard-title">🏆 Leaderboard</h2>
      </div>
      <div class="scores-list">
  `;
  
  if (scores.length === 0) {
    html += `<div class="no-scores">No scores yet. Be the first!</div>`;
  } else {
    scores.forEach((s, i) => {
      html += `
        <div class="score-row">
          <div class="score-rank">#${i + 1}</div>
          <div class="score-name">${s.name}</div>
          <div class="score-val">${s.score}</div>
          <div class="score-date">${formatDate(s.date)}</div>
          <div class="score-tooltip">
            <div class="stat-row"><span class="stat-label">Correct:</span><span class="stat-value">${s.stats?.correct || 0}</span></div>
            <div class="stat-row"><span class="stat-label">Wrong:</span><span class="stat-value">${s.stats?.wrong || 0}</span></div>
            <div class="stat-row"><span class="stat-label">Best Streak:</span><span class="stat-value">${s.stats?.best_streak || 0}</span></div>
          </div>
        </div>
      `;
    });
  }
  
  html += `
      </div>
    </div>
  `;
  
  container.innerHTML = html;
}

export function displayScoresWithPlaceholder(scores, containerId, userScore) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  let html = `<div class="scores-list">`;
  
  let placed = false;
  let rank = 1;
  
  const renderRow = (s, r, isPlaceholder = false) => `
    <div class="score-row ${isPlaceholder ? 'score-placeholder' : ''}">
      <div class="score-rank">#${r}</div>
      <div class="score-name">${isPlaceholder ? 'YOU' : s.name}</div>
      <div class="score-val">${s.score}</div>
      <div class="score-date">${isPlaceholder ? 'Now' : formatDate(s.date)}</div>
    </div>
  `;
  
  scores.forEach(s => {
    if (!placed && userScore > s.score) {
      html += renderRow({ score: userScore }, rank, true);
      placed = true;
      rank++;
    }
    html += renderRow(s, rank);
    rank++;
  });
  
  if (!placed && rank <= 10) {
    html += renderRow({ score: userScore }, rank, true);
  }
  
  html += `</div>`;
  container.innerHTML = html;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const month = d.toLocaleString('default', { month: 'short' });
  const day = d.getDate();
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return `${month} ${day} ${time}`;
}
