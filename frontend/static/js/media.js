/* media.js — SkillPlayer: categories, skills, video/PDF playback, view tracking */

// ===========================================
// SkillPlayer State
// ===========================================
let currentCategory = 'Skills';
let currentSkill = null;
let currentContent = null;

// ===========================================
// DOM Elements - SkillPlayer
// ===========================================
const skillsList = document.getElementById('skills-list');
const videosGrid = document.getElementById('videos-grid');
const videoPlayer = document.getElementById('video-player');
const pdfViewer = document.getElementById('pdf-viewer');
const videoPlaceholder = document.getElementById('video-placeholder');
const videoTitle = document.getElementById('video-title');
const currentSkillTitle = document.getElementById('current-skill-title');
const categoryTitle = document.getElementById('category-title');

// ===========================================
// SkillPlayer Functions
// ===========================================

// Select a category
function selectCategory(category) {
    currentCategory = category;
    currentSkill = null;

    // Update tab active state
    document.querySelectorAll('.category-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.category === category);
    });

    // Update category title
    categoryTitle.textContent = category;

    // Reset content area
    videosGrid.innerHTML = '';
    currentSkillTitle.textContent = 'Select a topic to see videos';
    document.getElementById('current-skill-title-french').style.display = 'inline';
    document.getElementById('current-skill-title-french').textContent = '/ Sélectionnez un sujet pour voir les vidéos';
    videoPlayer.pause();
    videoPlayer.src = '';
    videoPlayer.style.display = 'none';
    pdfViewer.src = '';
    pdfViewer.style.display = 'none';
    videoPlaceholder.style.display = 'flex';
    videoTitle.textContent = '';

    // Reset arrow to point left (at sidebar) when no skill selected
    const placeholderArrow = document.getElementById('placeholder-arrow');
    if (placeholderArrow) {
        placeholderArrow.classList.remove('point-down');
    }

    // Load skills for this category
    loadSkills();
}

// Load skills on page load
async function loadSkills() {
    try {
        const response = await fetch(`/api/media/${currentCategory}/skills`);
        const skills = await response.json();

        if (skills.length === 0) {
            skillsList.innerHTML = `
                        <li class="empty-message">
                            <span>No items found</span>
                            <small>Add folders to content/${currentCategory}/</small>
                        </li>
                    `;
            return;
        }

        skillsList.innerHTML = skills.map(skill => {
            const iconHtml = skill.logo
                ? `<img src="/api/media/file/${currentCategory}/${skill.id}/${skill.logo}" class="skill-logo" alt="${skill.name}">`
                : '<span class="skill-icon">📚</span>';
            const newBadge = skill.is_new ? '<span class="new-badge">NEW</span>' : '';

            return `
                    <li>
                        <button class="skill-btn" data-skill="${skill.id}" onclick="selectSkill('${skill.id}', '${skill.name}')">
                            ${iconHtml}
                            <span class="skill-name">${skill.name}</span>
                            ${newBadge}
                        </button>
                    </li>
                `}).join('');

    } catch (error) {
        console.error('Error loading skills:', error);
        skillsList.innerHTML = '<li class="error-message">Error loading skills</li>';
    }
}

// Select a skill and load its content
async function selectSkill(skillId, skillName) {
    currentSkill = skillId;

    // Stop current content and reset player
    videoPlayer.pause();
    videoPlayer.src = '';
    videoPlayer.style.display = 'none';
    pdfViewer.src = '';
    pdfViewer.style.display = 'none';

    videoPlaceholder.style.display = 'flex';
    videoTitle.textContent = '';

    // Arrow should point down to content when skill is selected
    const placeholderArrow = document.getElementById('placeholder-arrow');
    if (placeholderArrow) {
        placeholderArrow.classList.add('point-down');
    }
    currentContent = null;

    // Update active state in sidebar
    document.querySelectorAll('.skill-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.skill === skillId);
    });

    // Update title
    currentSkillTitle.textContent = skillName;
    document.getElementById('current-skill-title-french').style.display = 'none';

    // Load content for this skill
    try {
        const response = await fetch(`/api/media/${currentCategory}/${skillId}/files`);
        const files = await response.json();

        if (files.length === 0) {
            videosGrid.innerHTML = `
                        <div class="empty-videos">
                            <span class="empty-icon">📭</span>
                            <p>No content found in this skill folder</p>
                            <small>Add .mp4 videos or .pdf files</small>
                        </div>
                    `;
            return;
        }

        videosGrid.innerHTML = files.map((file) => {
            const pdfIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="28" height="28">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 2l5 5h-5V4zM8.5 13h1c.55 0 1 .45 1 1v1c0 .55-.45 1-1 1h-.5v1.5H8V13h.5zm3 0h1.25c.41 0 .75.34.75.75v2.5c0 .41-.34.75-.75.75H11.5V13zm4 0H17v1h-1v.5h1v1h-1V17h-1v-4h.5zM9 14v1h.5v-1H9zm3 0v2h.5v-2h-.5z"/>
                    </svg>`;
            const videoIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="28" height="28">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
                    </svg>`;
            const icon = file.type === 'pdf' ? pdfIcon : videoIcon;
            const newBadge = file.is_new ? '<span class="new-badge">NEW</span>' : '';
            return `
                    <button class="video-card" onclick="playContent(event, '${file.category}', '${file.skill}', '${file.filename}', '${file.name.replace(/'/g, "\\'")}', '${file.type}')">
                        <div class="video-card-icon">${icon}</div>
                        <div class="video-card-info">
                            <span class="video-name">${file.name} ${newBadge}</span>
                        </div>
                    </button>
                `}).join('');

    } catch (error) {
        console.error('Error loading content:', error);
        videosGrid.innerHTML = '<div class="error-message">Error loading content</div>';
    }
}

// Play a video or show PDF
function playContent(evt, category, skill, filename, title, type) {
    currentContent = { category, skill, filename, title, type };

    // Update active state
    document.querySelectorAll('.video-card').forEach(card => {
        card.classList.remove('active');
    });
    evt.currentTarget.classList.add('active');

    // Hide placeholder
    videoPlaceholder.style.display = 'none';

    // Set source url
    const contentUrl = `/api/media/file/${category}/${skill}/${filename}`;
    videoTitle.textContent = title;

    if (type === 'pdf') {
        // Show PDF
        videoPlayer.pause();
        videoPlayer.style.display = 'none';

        pdfViewer.src = `${contentUrl}?t=${Date.now()}#toolbar=0&navpanes=0&pagemode=none&view=FitH&scrollbar=0`;
        pdfViewer.style.display = 'block';
    } else {
        // Show Video
        pdfViewer.style.display = 'none';
        pdfViewer.src = '';

        videoPlayer.src = contentUrl;
        videoPlayer.style.display = 'block';
        videoPlayer.play();
    }

    // Scroll to viewer on mobile
    document.getElementById('video-section').scrollIntoView({ behavior: 'smooth' });

    // Track view
    trackView(category, skill, filename);
}

// Track view and update counter
async function trackView(category, skill, filename) {
    try {
        const response = await fetch('/api/media/views/increment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ category, skill, filename })
        });
        const data = await response.json();
        document.getElementById('total-views').textContent = data.total;
    } catch (error) {
        console.error('Error tracking view:', error);
    }
}

// Load total views on page load
async function loadTotalViews() {
    try {
        const response = await fetch('/api/media/views/total');
        const data = await response.json();
        document.getElementById('total-views').textContent = data.total;
    } catch (error) {
        console.error('Error loading views:', error);
    }
}

// Load categories with NEW badges
async function loadCategories() {
    try {
        const response = await fetch('/api/media/categories');
        const categories = await response.json();
        const categoryTabs = document.getElementById('category-tabs');

        categoryTabs.innerHTML = categories.map(cat => {
            const isActive = cat.name === currentCategory ? 'active' : '';
            const newBadge = cat.is_new ? '<span class="new-badge">NEW</span>' : '';
            return `<button class="category-tab ${isActive}" data-category="${cat.name}" onclick="selectCategory('${cat.name}')">${cat.name} ${newBadge}</button>`;
        }).join('');
    } catch (error) {
        console.error('Error loading categories:', error);
    }
}
