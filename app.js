// ─── Routine Tracker App ───
(() => {
  'use strict';

  // ─── DOM Refs ───
  const $ = (s) => document.querySelector(s);
  const dateDisplay = $('#dateDisplay');
  const scoreValue = $('#scoreValue');
  const streakValue = $('#streakValue');
  const completedCount = $('#completedCount');
  const progressFill = $('#progressFill');
  const addForm = $('#addForm');
  const habitInput = $('#habitInput');
  const categorySelect = $('#categorySelect');
  const habitList = $('#habitList');
  const emptyState = $('#emptyState');
  const clearDoneBtn = $('#clearDoneBtn');
  const resetDayBtn = $('#resetDayBtn');
  const cycleDayNum = $('#cycleDayNum');
  const cycleDots = $('#cycleDots');
  const feedbackOverlay = $('#feedbackOverlay');
  const feedbackBody = $('#feedbackBody');
  const feedbackCloseBtn = $('#feedbackCloseBtn');

  // ─── Constants ───
  const STORAGE_KEY = 'routine_tracker_data';
  const CATEGORIES = ['discipline', 'health', 'content', 'skill', 'spiritual'];
  const CATEGORY_LABELS = {
    discipline: 'Discipline',
    health: 'Health',
    content: 'Content',
    skill: 'Skill',
    spiritual: 'Spiritual',
  };
  const CATEGORY_ICONS = {
    discipline: '🎯',
    health: '💪',
    content: '📝',
    skill: '🧠',
    spiritual: '🧘',
  };
  const CATEGORY_COLORS = {
    discipline: '#a29bfe',
    health: '#00d68f',
    content: '#fdcb6e',
    skill: '#74b9ff',
    spiritual: '#e84393',
  };
  const CYCLE_LENGTH = 10;

  // ─── State ───
  function todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  function loadData() {
    try {
      const d = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (d && d.habits) {
        // Migrate old habits without category
        d.habits = d.habits.map(h => ({
          ...h,
          category: h.category || 'discipline',
        }));
        // Ensure cycle fields exist
        if (!d.cycleStartDate) d.cycleStartDate = todayKey();
        if (!d.radarHistory) d.radarHistory = [];
        if (typeof d.feedbackShown === 'undefined') d.feedbackShown = false;
        return d;
      }
      return createDefaultData();
    } catch {
      return createDefaultData();
    }
  }

  function createDefaultData() {
    return {
      habits: [],          // [{ id, name, category }]
      dailyLogs: {},       // { 'YYYY-MM-DD': { completed: [id, ...] } }
      cycleStartDate: todayKey(),  // When the current 10-day cycle began
      radarHistory: [],    // [{ date, scores: { discipline: N, ... } }]
      feedbackShown: false, // Whether feedback was already shown for current cycle
    };
  }

  function saveData(d) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
  }

  let data = loadData();

  // ─── Radar Chart ───
  let radarChart = null;

  function initRadarChart() {
    const ctx = $('#radarChart').getContext('2d');
    radarChart = new Chart(ctx, {
      type: 'radar',
      data: {
        labels: CATEGORIES.map(c => CATEGORY_LABELS[c]),
        datasets: [{
          label: 'Today',
          data: [0, 0, 0, 0, 0],
          backgroundColor: 'rgba(108, 92, 231, 0.15)',
          borderColor: '#6c5ce7',
          borderWidth: 2,
          pointBackgroundColor: CATEGORIES.map(c => CATEGORY_COLORS[c]),
          pointBorderColor: '#fff',
          pointBorderWidth: 1.5,
          pointRadius: 5,
          pointHoverRadius: 7,
          fill: true,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        animation: { duration: 600, easing: 'easeOutQuart' },
        scales: {
          r: {
            beginAtZero: true, min: 0, max: 100,
            ticks: {
              stepSize: 25,
              color: '#555568',
              backdropColor: 'transparent',
              font: { size: 10, family: 'Inter' },
            },
            grid: { color: 'rgba(255,255,255,0.06)', lineWidth: 1 },
            angleLines: { color: 'rgba(255,255,255,0.08)', lineWidth: 1 },
            pointLabels: {
              color: '#8888a0',
              font: { size: 12, weight: '600', family: 'Inter' },
              padding: 12,
            },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1c1c26',
            titleColor: '#eaeaf0',
            bodyColor: '#8888a0',
            borderColor: '#2a2a38',
            borderWidth: 1,
            cornerRadius: 8,
            padding: 10,
            titleFont: { family: 'Inter', weight: '600' },
            bodyFont: { family: 'Inter' },
            callbacks: { label: (ctx) => `${ctx.raw}%` },
          },
        },
      },
    });
  }

  function getTodayScores() {
    const today = todayKey();
    const log = data.dailyLogs[today] || { completed: [] };
    const scores = {};
    CATEGORIES.forEach(cat => {
      const habitsInCat = data.habits.filter(h => h.category === cat);
      if (habitsInCat.length === 0) {
        scores[cat] = 0;
      } else {
        const doneCount = habitsInCat.filter(h => log.completed.includes(h.id)).length;
        scores[cat] = Math.round((doneCount / habitsInCat.length) * 100);
      }
    });
    return scores;
  }

  function updateRadarChart() {
    if (!radarChart) return;
    const scores = getTodayScores();
    radarChart.data.datasets[0].data = CATEGORIES.map(c => scores[c]);
    radarChart.update('default');
  }

  // ─── 10-Day Cycle Logic ───
  function daysBetween(dateA, dateB) {
    const a = new Date(dateA + 'T00:00:00');
    const b = new Date(dateB + 'T00:00:00');
    return Math.floor((b - a) / 86400000);
  }

  function getCycleDay() {
    const diff = daysBetween(data.cycleStartDate, todayKey());
    return Math.min(diff + 1, CYCLE_LENGTH); // 1-indexed, capped at 10
  }

  function snapshotTodayScores() {
    const today = todayKey();
    // Only save one snapshot per day (overwrite if exists)
    const existing = data.radarHistory.findIndex(e => e.date === today);
    const scores = getTodayScores();
    if (existing >= 0) {
      data.radarHistory[existing].scores = scores;
    } else {
      data.radarHistory.push({ date: today, scores });
    }
    saveData(data);
  }

  function renderCycleIndicator() {
    const day = getCycleDay();
    cycleDayNum.textContent = day;

    // Build dots
    cycleDots.innerHTML = '';
    for (let i = 1; i <= CYCLE_LENGTH; i++) {
      const dot = document.createElement('span');
      dot.className = 'cycle-dot';
      if (i < day) dot.classList.add('filled');
      if (i === day) dot.classList.add('current');
      cycleDots.appendChild(dot);
    }
  }

  function checkCycleComplete() {
    const day = getCycleDay();
    if (day >= CYCLE_LENGTH && !data.feedbackShown) {
      showFeedback();
    }
  }

  function calcCycleAverages() {
    // Filter history entries within the current cycle
    const start = data.cycleStartDate;
    const cycleEntries = data.radarHistory.filter(e => {
      return daysBetween(start, e.date) >= 0 && daysBetween(start, e.date) < CYCLE_LENGTH;
    });

    const averages = {};
    CATEGORIES.forEach(cat => {
      const vals = cycleEntries.map(e => e.scores[cat] || 0);
      averages[cat] = vals.length > 0
        ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
        : 0;
    });
    return averages;
  }

  function getFeedbackTier(score) {
    if (score >= 80) return { label: 'Strong Area', cls: 'strong' };
    if (score >= 60) return { label: 'Stable but Improve', cls: 'stable' };
    if (score >= 40) return { label: 'Needs Attention', cls: 'attention' };
    return { label: 'Critical – Focus Now', cls: 'critical' };
  }

  function showFeedback() {
    const averages = calcCycleAverages();

    feedbackBody.innerHTML = '';
    CATEGORIES.forEach(cat => {
      const avg = averages[cat];
      const tier = getFeedbackTier(avg);
      const row = document.createElement('div');
      row.className = 'feedback-row';
      row.innerHTML = `
        <div class="feedback-left">
          <span class="feedback-cat">${CATEGORY_ICONS[cat]} ${CATEGORY_LABELS[cat]}</span>
          <span class="feedback-score">${avg}%</span>
        </div>
        <span class="feedback-status ${tier.cls}">${tier.label}</span>
      `;
      feedbackBody.appendChild(row);
    });

    feedbackOverlay.classList.add('visible');
    data.feedbackShown = true;
    saveData(data);
  }

  function resetCycle() {
    data.cycleStartDate = todayKey();
    data.radarHistory = [];
    data.feedbackShown = false;
    saveData(data);
    feedbackOverlay.classList.remove('visible');
    renderCycleIndicator();
  }

  // ─── Date Display ───
  function renderDate() {
    const now = new Date();
    dateDisplay.textContent = now.toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
    });
  }

  // ─── Auto-reset day ───
  function autoResetIfNewDay() {
    const today = todayKey();
    if (!data.dailyLogs[today]) {
      data.dailyLogs[today] = { completed: [] };
      saveData(data);
    }
  }

  // ─── Rendering ───
  function render() {
    const today = todayKey();
    autoResetIfNewDay();

    const log = data.dailyLogs[today] || { completed: [] };
    const total = data.habits.length;
    const done = data.habits.filter(h => log.completed.includes(h.id)).length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;

    // Stats
    scoreValue.textContent = pct + '%';
    completedCount.textContent = `${done}/${total}`;
    progressFill.style.width = pct + '%';

    // Streak
    streakValue.textContent = calcStreak();

    // List
    habitList.innerHTML = '';
    if (total === 0) {
      emptyState.classList.remove('hidden');
    } else {
      emptyState.classList.add('hidden');
      data.habits.forEach(habit => {
        const isChecked = log.completed.includes(habit.id);
        const li = document.createElement('li');
        li.className = 'habit-item' + (isChecked ? ' completed' : '');
        li.innerHTML = `
          <input type="checkbox" class="habit-checkbox" data-id="${habit.id}" ${isChecked ? 'checked' : ''}>
          <span class="habit-name">${escapeHtml(habit.name)}</span>
          <span class="category-badge" data-cat="${habit.category}">${CATEGORY_LABELS[habit.category]}</span>
          <button class="delete-btn" data-id="${habit.id}" title="Delete habit">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
          </button>
        `;
        habitList.appendChild(li);
      });
    }

    // Update radar + snapshot + cycle
    updateRadarChart();
    snapshotTodayScores();
    renderCycleIndicator();
    checkCycleComplete();
  }

  // ─── Streak Calculation ───
  function calcStreak() {
    if (data.habits.length === 0) return 0;
    let streak = 0;
    const todayLog = data.dailyLogs[todayKey()] || { completed: [] };
    const todayAllDone = data.habits.every(h => todayLog.completed.includes(h.id));

    let d = new Date();
    if (!todayAllDone) d.setDate(d.getDate() - 1);

    for (let i = 0; i < 365; i++) {
      const key = d.toISOString().slice(0, 10);
      const log = data.dailyLogs[key];
      if (!log) break;
      if (!data.habits.every(h => log.completed.includes(h.id))) break;
      streak++;
      d.setDate(d.getDate() - 1);
    }
    return streak;
  }

  // ─── Helpers ───
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  // ─── Event Handlers ───

  addForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = habitInput.value.trim();
    if (!name) return;
    data.habits.push({ id: generateId(), name, category: categorySelect.value });
    autoResetIfNewDay();
    saveData(data);
    render();
    habitInput.value = '';
    habitInput.focus();
  });

  habitList.addEventListener('click', (e) => {
    const checkbox = e.target.closest('.habit-checkbox');
    const deleteBtn = e.target.closest('.delete-btn');

    if (checkbox) {
      const id = checkbox.dataset.id;
      const today = todayKey();
      autoResetIfNewDay();
      const log = data.dailyLogs[today];
      if (checkbox.checked) {
        if (!log.completed.includes(id)) log.completed.push(id);
      } else {
        log.completed = log.completed.filter(x => x !== id);
      }
      saveData(data);
      render();
    }

    if (deleteBtn) {
      const id = deleteBtn.dataset.id;
      data.habits = data.habits.filter(h => h.id !== id);
      Object.values(data.dailyLogs).forEach(log => {
        log.completed = log.completed.filter(x => x !== id);
      });
      saveData(data);
      render();
    }
  });

  clearDoneBtn.addEventListener('click', () => {
    const today = todayKey();
    const log = data.dailyLogs[today] || { completed: [] };
    const doneIds = new Set(log.completed);
    data.habits = data.habits.filter(h => !doneIds.has(h.id));
    Object.values(data.dailyLogs).forEach(l => {
      l.completed = l.completed.filter(x => !doneIds.has(x));
    });
    saveData(data);
    render();
  });

  resetDayBtn.addEventListener('click', () => {
    data.dailyLogs[todayKey()] = { completed: [] };
    saveData(data);
    render();
  });

  // Modal close → reset cycle
  feedbackCloseBtn.addEventListener('click', resetCycle);
  feedbackOverlay.addEventListener('click', (e) => {
    if (e.target === feedbackOverlay) resetCycle();
  });

  // ─── Init ───
  renderDate();
  initRadarChart();
  render();
})();
