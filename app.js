// ─── Routine Tracker App ───
(() => {
  'use strict';

  // ─── DOM Refs ───
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  // Top bar & drawer
  const hamburgerBtn = $('#hamburgerBtn');
  const drawerOverlay = $('#drawerOverlay');
  const settingsDrawer = $('#settingsDrawer');
  const drawerCloseBtn = $('#drawerCloseBtn');
  const dateDisplay = $('#dateDisplay');

  // Schedule tab
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

  // Cycle
  const cycleDayNum = $('#cycleDayNum');
  const cycleDots = $('#cycleDots');

  // Feedback modal
  const feedbackOverlay = $('#feedbackOverlay');
  const feedbackBody = $('#feedbackBody');
  const feedbackCloseBtn = $('#feedbackCloseBtn');

  // Bottom nav
  const bottomNav = $('#bottomNav');
  const navItems = $$('.nav-item');
  const tabPanels = $$('.tab-panel');

  // Calendar
  const calMonthTitle = $('#calMonthTitle');
  const calGrid = $('#calGrid');
  const calPrev = $('#calPrev');
  const calNext = $('#calNext');
  const eventInputArea = $('#eventInputArea');
  const eventDateLabel = $('#eventDateLabel');
  const eventInput = $('#eventInput');
  const eventSaveBtn = $('#eventSaveBtn');
  const eventCloseBtn = $('#eventCloseBtn');
  const eventsList = $('#eventsList');

  // Stats
  const statsOverview = $('#statsOverview');
  const weeklyChart = $('#weeklyChart');

  // Ideas
  const ideasTextarea = $('#ideasTextarea');
  const ideasSavedIndicator = $('#ideasSavedIndicator');

  // Radar category scores
  const categoryScores = $('#categoryScores');

  // ─── Constants ───
  const STORAGE_KEY = 'routine_tracker_data';
  const EVENTS_KEY = 'routine_tracker_events';
  const IDEAS_KEY = 'routine_tracker_ideas';
  const CATEGORIES = ['discipline', 'health', 'content', 'skill', 'spiritual'];
  const CATEGORY_LABELS = {
    discipline: 'Discipline', health: 'Health', content: 'Content',
    skill: 'Skill', spiritual: 'Spiritual',
  };
  const CATEGORY_ICONS = {
    discipline: '🎯', health: '💪', content: '📝',
    skill: '🧠', spiritual: '🧘',
  };
  const CATEGORY_COLORS = {
    discipline: '#a29bfe', health: '#00d68f', content: '#fdcb6e',
    skill: '#74b9ff', spiritual: '#e84393',
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
        d.habits = d.habits.map(h => ({ ...h, category: h.category || 'discipline' }));
        if (!d.cycleStartDate) d.cycleStartDate = todayKey();
        if (!d.radarHistory) d.radarHistory = [];
        if (typeof d.feedbackShown === 'undefined') d.feedbackShown = false;
        return d;
      }
      return createDefaultData();
    } catch { return createDefaultData(); }
  }

  function createDefaultData() {
    return {
      habits: [], dailyLogs: {},
      cycleStartDate: todayKey(), radarHistory: [], feedbackShown: false,
    };
  }

  function saveData(d) { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); }

  let data = loadData();

  // ─── Tab Navigation ───
  function switchTab(tabName) {
    tabPanels.forEach(p => p.classList.remove('active'));
    navItems.forEach(n => n.classList.remove('active'));
    const panel = document.querySelector(`[data-tab="${tabName}"]`);
    const nav = document.querySelector(`.nav-item[data-tab="${tabName}"]`);
    if (panel) panel.classList.add('active');
    if (nav) nav.classList.add('active');

    // Scroll content to top
    const appContent = $('#appContent');
    if (appContent) appContent.scrollTop = 0;

    // Lazy init
    if (tabName === 'radar') { updateRadarChart(); renderCategoryScores(); }
    if (tabName === 'calendar') renderCalendar();
    if (tabName === 'stats') renderStats();
    if (tabName === 'ideas') loadIdeas();
  }

  bottomNav.addEventListener('click', (e) => {
    const item = e.target.closest('.nav-item');
    if (!item) return;
    switchTab(item.dataset.tab);
  });

  // ─── Settings Drawer ───
  function openDrawer() {
    settingsDrawer.classList.add('open');
    drawerOverlay.classList.add('open');
  }
  function closeDrawer() {
    settingsDrawer.classList.remove('open');
    drawerOverlay.classList.remove('open');
  }
  hamburgerBtn.addEventListener('click', openDrawer);
  drawerCloseBtn.addEventListener('click', closeDrawer);
  drawerOverlay.addEventListener('click', closeDrawer);

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
            ticks: { stepSize: 25, color: '#555568', backdropColor: 'transparent', font: { size: 10, family: 'Inter' } },
            grid: { color: 'rgba(255,255,255,0.06)', lineWidth: 1 },
            angleLines: { color: 'rgba(255,255,255,0.08)', lineWidth: 1 },
            pointLabels: { color: '#8888a0', font: { size: 11, weight: '600', family: 'Inter' }, padding: 10 },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1c1c26', titleColor: '#eaeaf0', bodyColor: '#8888a0',
            borderColor: '#2a2a38', borderWidth: 1, cornerRadius: 8, padding: 10,
            titleFont: { family: 'Inter', weight: '600' }, bodyFont: { family: 'Inter' },
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
      if (habitsInCat.length === 0) { scores[cat] = 0; }
      else {
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

  function renderCategoryScores() {
    const scores = getTodayScores();
    categoryScores.innerHTML = '';
    CATEGORIES.forEach(cat => {
      const pct = scores[cat];
      const row = document.createElement('div');
      row.className = 'cat-score-row';
      row.innerHTML = `
        <span class="cat-score-icon">${CATEGORY_ICONS[cat]}</span>
        <div class="cat-score-info">
          <div class="cat-score-name">${CATEGORY_LABELS[cat]}</div>
          <div class="cat-score-bar-track">
            <div class="cat-score-bar-fill" style="width:${pct}%;background:${CATEGORY_COLORS[cat]}"></div>
          </div>
        </div>
        <span class="cat-score-pct">${pct}%</span>
      `;
      categoryScores.appendChild(row);
    });
  }

  // ─── 10-Day Cycle ───
  function daysBetween(dateA, dateB) {
    const a = new Date(dateA + 'T00:00:00');
    const b = new Date(dateB + 'T00:00:00');
    return Math.floor((b - a) / 86400000);
  }

  function getCycleDay() {
    return Math.min(daysBetween(data.cycleStartDate, todayKey()) + 1, CYCLE_LENGTH);
  }

  function snapshotTodayScores() {
    const today = todayKey();
    const existing = data.radarHistory.findIndex(e => e.date === today);
    const scores = getTodayScores();
    if (existing >= 0) data.radarHistory[existing].scores = scores;
    else data.radarHistory.push({ date: today, scores });
    saveData(data);
  }

  function renderCycleIndicator() {
    const day = getCycleDay();
    cycleDayNum.textContent = day;
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
    if (getCycleDay() >= CYCLE_LENGTH && !data.feedbackShown) showFeedback();
  }

  function calcCycleAverages() {
    const start = data.cycleStartDate;
    const cycleEntries = data.radarHistory.filter(e =>
      daysBetween(start, e.date) >= 0 && daysBetween(start, e.date) < CYCLE_LENGTH
    );
    const averages = {};
    CATEGORIES.forEach(cat => {
      const vals = cycleEntries.map(e => e.scores[cat] || 0);
      averages[cat] = vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
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
    dateDisplay.textContent = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  // ─── Auto-reset ───
  function autoResetIfNewDay() {
    const today = todayKey();
    if (!data.dailyLogs[today]) {
      data.dailyLogs[today] = { completed: [] };
      saveData(data);
    }
  }

  // ─── Rendering (Schedule) ───
  function render() {
    const today = todayKey();
    autoResetIfNewDay();
    const log = data.dailyLogs[today] || { completed: [] };
    const total = data.habits.length;
    const done = data.habits.filter(h => log.completed.includes(h.id)).length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;

    scoreValue.textContent = pct + '%';
    completedCount.textContent = `${done}/${total}`;
    progressFill.style.width = pct + '%';
    streakValue.textContent = calcStreak();

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

    updateRadarChart();
    snapshotTodayScores();
    renderCycleIndicator();
    checkCycleComplete();
  }

  // ─── Streak ───
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

  // ─── Event Handlers (Schedule) ───
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
      if (checkbox.checked) { if (!log.completed.includes(id)) log.completed.push(id); }
      else { log.completed = log.completed.filter(x => x !== id); }
      saveData(data);
      render();
    }
    if (deleteBtn) {
      const id = deleteBtn.dataset.id;
      data.habits = data.habits.filter(h => h.id !== id);
      Object.values(data.dailyLogs).forEach(log => { log.completed = log.completed.filter(x => x !== id); });
      saveData(data);
      render();
    }
  });

  clearDoneBtn.addEventListener('click', () => {
    const today = todayKey();
    const log = data.dailyLogs[today] || { completed: [] };
    const doneIds = new Set(log.completed);
    data.habits = data.habits.filter(h => !doneIds.has(h.id));
    Object.values(data.dailyLogs).forEach(l => { l.completed = l.completed.filter(x => !doneIds.has(x)); });
    saveData(data);
    render();
    closeDrawer();
  });

  resetDayBtn.addEventListener('click', () => {
    data.dailyLogs[todayKey()] = { completed: [] };
    saveData(data);
    render();
    closeDrawer();
  });

  feedbackCloseBtn.addEventListener('click', resetCycle);
  feedbackOverlay.addEventListener('click', (e) => { if (e.target === feedbackOverlay) resetCycle(); });

  // ═══════════════════════════════════════
  // ─── Calendar Tab ───
  // ═══════════════════════════════════════
  let calYear, calMonth, calSelectedDate = null;

  function loadEvents() {
    try { return JSON.parse(localStorage.getItem(EVENTS_KEY)) || {}; }
    catch { return {}; }
  }
  function saveEvents(ev) { localStorage.setItem(EVENTS_KEY, JSON.stringify(ev)); }

  function initCalendar() {
    const now = new Date();
    calYear = now.getFullYear();
    calMonth = now.getMonth();
  }

  function renderCalendar() {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    calMonthTitle.textContent = `${months[calMonth]} ${calYear}`;

    const firstDay = new Date(calYear, calMonth, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const daysInPrev = new Date(calYear, calMonth, 0).getDate();
    const today = todayKey();
    const events = loadEvents();

    calGrid.innerHTML = '';

    // Previous month padding
    for (let i = firstDay - 1; i >= 0; i--) {
      const btn = document.createElement('button');
      btn.className = 'cal-day other-month';
      btn.textContent = daysInPrev - i;
      calGrid.appendChild(btn);
    }

    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const btn = document.createElement('button');
      btn.className = 'cal-day';
      btn.textContent = d;
      btn.dataset.date = dateStr;
      if (dateStr === today) btn.classList.add('today');
      if (events[dateStr] && events[dateStr].length > 0) btn.classList.add('has-event');
      if (calSelectedDate === dateStr) btn.classList.add('selected');
      btn.addEventListener('click', () => selectCalDay(dateStr, d));
      calGrid.appendChild(btn);
    }

    // Next month padding
    const totalCells = firstDay + daysInMonth;
    const remaining = (7 - (totalCells % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const btn = document.createElement('button');
      btn.className = 'cal-day other-month';
      btn.textContent = i;
      calGrid.appendChild(btn);
    }

    renderEventsList();
  }

  function selectCalDay(dateStr, day) {
    calSelectedDate = dateStr;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    eventDateLabel.textContent = `${months[calMonth]} ${day}, ${calYear}`;
    eventInput.value = '';
    eventInputArea.style.display = 'block';
    eventInput.focus();
    renderCalendar();
  }

  function renderEventsList() {
    const events = loadEvents();
    const monthEvents = [];
    Object.keys(events).forEach(dateStr => {
      const [y, m] = dateStr.split('-').map(Number);
      if (y === calYear && m === calMonth + 1) {
        events[dateStr].forEach((text, idx) => {
          monthEvents.push({ dateStr, text, idx, day: parseInt(dateStr.split('-')[2]) });
        });
      }
    });
    monthEvents.sort((a, b) => a.day - b.day);

    eventsList.innerHTML = '';
    if (monthEvents.length === 0) {
      eventsList.innerHTML = '<p style="text-align:center;color:var(--text-muted);font-size:0.8rem;padding:20px 0;">No events this month</p>';
      return;
    }
    monthEvents.forEach(ev => {
      const card = document.createElement('div');
      card.className = 'event-card';
      card.innerHTML = `
        <span class="event-card-date">${ev.day}</span>
        <span class="event-card-text">${escapeHtml(ev.text)}</span>
        <button class="event-delete-btn" data-date="${ev.dateStr}" data-idx="${ev.idx}">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
        </button>
      `;
      eventsList.appendChild(card);
    });

    eventsList.addEventListener('click', (e) => {
      const del = e.target.closest('.event-delete-btn');
      if (!del) return;
      const events = loadEvents();
      const d = del.dataset.date;
      const i = parseInt(del.dataset.idx);
      if (events[d]) { events[d].splice(i, 1); if (events[d].length === 0) delete events[d]; }
      saveEvents(events);
      renderCalendar();
    });
  }

  calPrev.addEventListener('click', () => {
    calMonth--;
    if (calMonth < 0) { calMonth = 11; calYear--; }
    renderCalendar();
  });

  calNext.addEventListener('click', () => {
    calMonth++;
    if (calMonth > 11) { calMonth = 0; calYear++; }
    renderCalendar();
  });

  eventSaveBtn.addEventListener('click', () => {
    if (!calSelectedDate) return;
    const text = eventInput.value.trim();
    if (!text) return;
    const events = loadEvents();
    if (!events[calSelectedDate]) events[calSelectedDate] = [];
    events[calSelectedDate].push(text);
    saveEvents(events);
    eventInput.value = '';
    eventInputArea.style.display = 'none';
    calSelectedDate = null;
    renderCalendar();
  });

  eventCloseBtn.addEventListener('click', () => {
    eventInputArea.style.display = 'none';
    calSelectedDate = null;
    renderCalendar();
  });

  // ═══════════════════════════════════════
  // ─── Stats Tab ───
  // ═══════════════════════════════════════
  function renderStats() {
    // Overall streak
    const overallStreak = calcStreak();

    // Per-category stats
    statsOverview.innerHTML = '';
    const todayScores = getTodayScores();

    // Overall row
    const overallRow = document.createElement('div');
    overallRow.className = 'stat-row';
    overallRow.innerHTML = `
      <span class="stat-row-icon">🔥</span>
      <div class="stat-row-info">
        <div class="stat-row-label">Overall Streak</div>
        <div class="stat-row-detail">Consecutive 100% days</div>
      </div>
      <span class="stat-row-value">${overallStreak}</span>
    `;
    statsOverview.appendChild(overallRow);

    // Category rows
    CATEGORIES.forEach(cat => {
      const row = document.createElement('div');
      row.className = 'stat-row';
      row.innerHTML = `
        <span class="stat-row-icon">${CATEGORY_ICONS[cat]}</span>
        <div class="stat-row-info">
          <div class="stat-row-label">${CATEGORY_LABELS[cat]}</div>
          <div class="stat-row-detail">Today's completion</div>
        </div>
        <span class="stat-row-value">${todayScores[cat]}%</span>
      `;
      statsOverview.appendChild(row);
    });

    // Weekly chart
    renderWeeklyChart();
  }

  function renderWeeklyChart() {
    weeklyChart.innerHTML = '';
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date();
    const todayStr = todayKey();

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const log = data.dailyLogs[key] || { completed: [] };
      const total = data.habits.length;
      const done = total > 0 ? data.habits.filter(h => log.completed.includes(h.id)).length : 0;
      const pct = total > 0 ? Math.round((done / total) * 100) : 0;

      const col = document.createElement('div');
      col.className = 'weekly-bar-col';
      const isToday = key === todayStr;
      col.innerHTML = `
        <span class="weekly-bar-pct">${pct}%</span>
        <div class="weekly-bar-wrap">
          <div class="weekly-bar${isToday ? ' today-bar' : ''}" style="height:${Math.max(pct, 3)}%"></div>
        </div>
        <span class="weekly-bar-label">${dayNames[d.getDay()]}</span>
      `;
      weeklyChart.appendChild(col);
    }
  }

  // ═══════════════════════════════════════
  // ─── Ideas Tab ───
  // ═══════════════════════════════════════
  let ideasSaveTimeout = null;

  function loadIdeas() {
    ideasTextarea.value = localStorage.getItem(IDEAS_KEY) || '';
  }

  function saveIdeas() {
    localStorage.setItem(IDEAS_KEY, ideasTextarea.value);
    ideasSavedIndicator.textContent = '✓ Saved';
    ideasSavedIndicator.classList.add('visible');
    setTimeout(() => ideasSavedIndicator.classList.remove('visible'), 1500);
  }

  ideasTextarea.addEventListener('input', () => {
    clearTimeout(ideasSaveTimeout);
    ideasSaveTimeout = setTimeout(saveIdeas, 600);
  });

  // ─── Init ───
  renderDate();
  initRadarChart();
  initCalendar();
  render();
  switchTab('schedule');
})();
