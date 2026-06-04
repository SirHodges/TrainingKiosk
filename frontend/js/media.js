// media.js - SkillPlayer functionality

import { getCategories, getSkills, getFiles, incrementView, getTotalViews } from './api.js';
import { registerFocusables } from './navigation.js';

let currentCategory = null;
let currentSkill = null;
let currentContent = null;

export async function loadCategories() {
  const categories = await getCategories();
  const container = document.getElementById('category-tabs');
  if (!container) return;
  
  container.innerHTML = '';
  categories.forEach((cat, index) => {
    const btn = document.createElement('button');
    btn.className = `category-tab ${index === 0 ? 'active' : ''}`;
    btn.textContent = cat.name;
    if (cat.is_new) {
      btn.innerHTML += ' <span class="badge-new">NEW</span>';
    }
    btn.onclick = () => {
      document.querySelectorAll('.category-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentCategory = cat.name;
      loadSkills(cat.name);
    };
    container.appendChild(btn);
  });
  
  if (categories.length > 0) {
    currentCategory = categories[0].name;
    loadSkills(categories[0].name);
  }
  
  updateTotalViews();
}

export async function loadSkills(category) {
  const skills = await getSkills(category);
  const container = document.getElementById('skills-list');
  if (!container) return;
  
  container.innerHTML = '';
  const focusables = [];
  
  skills.forEach(skill => {
    const btn = document.createElement('button');
    btn.className = 'skill-btn';
    btn.innerHTML = `
      <div class="skill-logo">
        <img src="/api/media/file/${encodeURIComponent(category)}/${encodeURIComponent(skill.name)}/${encodeURIComponent(skill.logo)}" alt="${skill.name}" onerror="this.style.display='none'">
      </div>
      <span class="skill-name">${skill.name}</span>
      ${skill.is_new ? '<span class="badge-new">NEW</span>' : ''}
    `;
    btn.onclick = () => selectSkill(skill.name, skill.name);
    container.appendChild(btn);
    focusables.push(btn);
  });
  
  registerFocusables('media-sidebar', focusables);
}

export async function selectSkill(skillId, skillName) {
  currentSkill = skillId;
  const files = await getFiles(currentCategory, skillId);
  const container = document.getElementById('skillplayer-content');
  if (!container) return;
  
  container.innerHTML = `
    <div class="skill-header">
      <h2>${skillName}</h2>
    </div>
    <div class="media-grid">
      ${files.map((file, idx) => `
        <div class="video-card" id="media-card-${idx}">
          <div class="media-icon">${file.type === 'pdf' ? '📄' : '▶️'}</div>
          <div class="media-info">
            <h3>${file.name}</h3>
            ${file.is_new ? '<span class="badge-new">NEW</span>' : ''}
          </div>
        </div>
      `).join('')}
    </div>
  `;
  
  const focusables = [];
  files.forEach((file, idx) => {
    const card = document.getElementById(`media-card-${idx}`);
    card.onclick = () => playContent(currentCategory, skillId, file.filename, file.name, file.type);
    focusables.push(card);
  });
  
  registerFocusables('media-content', focusables);
}

export function playContent(category, skill, filename, name, type) {
  const container = document.getElementById('skillplayer-content');
  
  const url = `/api/media/file/${encodeURIComponent(category)}/${encodeURIComponent(skill)}/${encodeURIComponent(filename)}`;
  
  let mediaHtml = '';
  if (type === 'pdf') {
    mediaHtml = `<iframe class="pdf-viewer" src="${url}" type="application/pdf"></iframe>`;
  } else {
    mediaHtml = `<video class="video-player" src="${url}" controls autoplay></video>`;
  }
  
  container.innerHTML = `
    <div class="media-player-header">
      <button class="btn-secondary" id="btn-back-media">⬅ Back</button>
      <h2>${name}</h2>
    </div>
    <div class="video-container">
      ${mediaHtml}
    </div>
  `;
  
  document.getElementById('btn-back-media').onclick = () => selectSkill(currentSkill, name.split(' - ')[0] || currentSkill);
  registerFocusables('media-player', [document.getElementById('btn-back-media')]);
  
  incrementView(skill, filename).then(updateTotalViews);
}

async function updateTotalViews() {
  const views = await getTotalViews();
  const el = document.getElementById('total-views-counter');
  if (el) el.textContent = `${views} Views`;
}

// Global exposes for html
window.loadCategories = loadCategories;
window.selectSkill = selectSkill;
window.playContent = playContent;
