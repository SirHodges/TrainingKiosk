// leaderboard.js - Leaderboard display module

window.updateTooltipPos = function(e, row) {
  const tooltip = row.querySelector('.score-tooltip');
  if (tooltip) {
    tooltip.style.left = (e.clientX + 15) + 'px';
    tooltip.style.top = (e.clientY + 15) + 'px';
  }
};

import { getLeaderboard, checkTopScore, submitScore } from './api.js?v=3.2';

export async function loadLeaderboard(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  const scores = await getLeaderboard();
  
  let html = `
    <div class="leaderboard-container">
      <div class="leaderboard-header">
        <h2 class="leaderboard-title"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="silver" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 8px; margin-bottom: 4px;"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path><path d="M4 22h16"></path><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path></svg>Leaderboard</h2>
      </div>
      <div class="scores-list">
  `;
  
  if (scores.length === 0) {
    html += `<div class="no-scores">No scores yet. Be the first!</div>`;
  } else {
    scores.forEach((s, i) => {
      html += `
        <div class="score-row" onmousemove="window.updateTooltipPos(event, this)">
          <div class="score-rank">${getRankDisplay(i + 1)}</div>
          <div class="score-name">${s.name}</div>
          <div class="score-val">${s.score}</div>
          <div class="score-date">${formatDate(s.date)}</div>
          <div class="score-tooltip">
            <div class="stat-row"><span class="stat-label">✅ Correct:</span><span class="stat-value" style="color: #22c55e; font-weight: bold;">${s.stats?.correct || 0}</span></div>
            <div class="stat-row"><span class="stat-label">❌ Wrong:</span><span class="stat-value" style="color: #ef4444; font-weight: bold;">${s.stats?.wrong || 0}</span></div>
            <div class="stat-row"><span class="stat-label">⏭️ Skipped:</span><span class="stat-value" style="color: #eab308; font-weight: bold;">${s.stats?.skips || 0}</span></div>
            <div class="stat-row"><span class="stat-label">🔥 Best Streak:</span><span class="stat-value" style="color: #f97316; font-weight: bold;">${s.stats?.best_streak || 0}</span></div>
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
    <div class="score-row ${isPlaceholder ? 'score-placeholder' : ''}" onmousemove="window.updateTooltipPos(event, this)">
      <div class="score-rank">${getRankDisplay(r)}</div>
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

function getRankDisplay(rank) {
  if (rank === 1) return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFD700" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path><path d="M4 22h16"></path><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path></svg>`;
  if (rank === 2) return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C0C0C0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path><path d="M4 22h16"></path><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path></svg>`;
  if (rank === 3) return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#CD7F32" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path><path d="M4 22h16"></path><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path></svg>`;
  return `#${rank}`;
}
