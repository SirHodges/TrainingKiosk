// api.js - Fetch wrapper module

const API_BASE = '/api';

async function fetchJson(endpoint, options = {}) {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Fetch error:', error);
    return null;
  }
}

export async function getCategories() {
  const data = await fetchJson(`/media/categories?t=${Date.now()}`);
  return data || [];
}

export async function getSkills(category) {
  const data = await fetchJson(`/media/${encodeURIComponent(category)}/skills?t=${Date.now()}`);
  return data || [];
}

export async function getFiles(category, skillId) {
  const data = await fetchJson(`/media/${encodeURIComponent(category)}/${encodeURIComponent(skillId)}/files?t=${Date.now()}`);
  return data || [];
}

export async function incrementView(skillId, filename) {
  return await fetchJson('/media/views/increment', {
    method: 'POST',
    body: JSON.stringify({ skill: skillId, filename })
  });
}

export async function getTotalViews() {
  const data = await fetchJson(`/media/views/total?t=${Date.now()}`);
  return data ? data.total : 0;
}

export async function startQuiz() {
  return await fetchJson('/quiz/start', { method: 'POST' });
}

export async function submitAnswer(sessionId, questionIndex, answerIndex, timeToAnswerMs, streakCount) {
  return await fetchJson('/quiz/answer', {
    method: 'POST',
    body: JSON.stringify({
      session_id: sessionId,
      question_index: questionIndex,
      answer_index: answerIndex,
      time_ms: timeToAnswerMs,
      streak_count: streakCount,
      timestamp: Date.now()
    })
  });
}

export async function skipQuestion(sessionId, questionIndex, timeToAnswerMs, streakCount) {
  return await fetchJson('/quiz/skip', {
    method: 'POST',
    body: JSON.stringify({
      session_id: sessionId,
      question_index: questionIndex,
      time_ms: timeToAnswerMs,
      streak_count: streakCount,
      timestamp: Date.now()
    })
  });
}

export async function getLeaderboard() {
  const data = await fetchJson(`/leaderboard?t=${Date.now()}`);
  return data && data.success ? data.scores : [];
}

export async function submitScore(score, name, stats) {
  return await fetchJson('/leaderboard/score', {
    method: 'POST',
    body: JSON.stringify({ score, name, stats })
  });
}

export async function checkTopScore(score) {
  return await fetchJson('/leaderboard/check', {
    method: 'POST',
    body: JSON.stringify({ score })
  });
}

export async function clearLeaderboard() {
  return await fetchJson('/leaderboard/nuke', { method: 'POST' });
}

export async function triggerUpdate() {
  return await fetchJson('/system/update', { method: 'POST' });
}
