// ─── Routine Tracker App ───
(async () => {
  'use strict';

  // ─── Auth Gate ───
  let currentSession = null;
  let currentUserId = null;
  try {
    currentSession = await supaGetSession();
  } catch (e) {
    console.warn('Auth check failed:', e);
  }
  if (!currentSession) {
    window.location.href = 'auth.html';
    return;
  }
  currentUserId = currentSession.user.id;

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
  const cycleLengthLabel = $('#cycleLengthLabel');

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
  const ideaInput = $('#ideaInput');
  const ideaAddBtn = $('#ideaAddBtn');
  const ideaList = $('#ideaList');
  const ideaCount = $('#ideaCount');
  const ideaEmpty = $('#ideaEmpty');

  // Radar category scores
  const categoryScores = $('#categoryScores');

  // Settings panel refs
  const settingsCategoryList = $('#settingsCategoryList');
  const addCategoryForm = $('#addCategoryForm');
  const newCatEmoji = $('#newCatEmoji');
  const newCatName = $('#newCatName');
  const notifToggle = $('#notifToggle');
  const notifTimeRow = $('#notifTimeRow');
  const notifTime = $('#notifTime');
  const themeToggle = $('#themeToggle');
  const themeIcon = $('#themeIcon');
  const themeLabel = $('#themeLabel');
  const exportDataBtn = $('#exportDataBtn');
  const importDataBtn = $('#importDataBtn');
  const importFileInput = $('#importFileInput');
  const resetAllBtn = $('#resetAllBtn');

  // Reminder toggle
  const reminderToggle = $('#reminderToggle');
  const reminderTimeRow = $('#reminderTimeRow');
  const habitReminderTime = $('#habitReminderTime');
  const radarIntervalInput = $('#radarInterval');

  // ─── Constants (user-scoped) ───
  const STORAGE_KEY = 'routine_tracker_data_' + currentUserId;
  const EVENTS_KEY = 'routine_tracker_events_' + currentUserId;
  const IDEAS_KEY = 'routine_tracker_ideas_' + currentUserId;
  const CATEGORIES_KEY = 'routine_tracker_categories_' + currentUserId;
  const THEME_KEY = 'routine_tracker_theme';
  const NOTIF_KEY = 'routine_tracker_notif_' + currentUserId;
  const RADAR_INTERVAL_KEY = 'routine_tracker_radar_interval_' + currentUserId;

  const DEFAULT_CATEGORIES = [
    { id: 'discipline', label: 'Discipline', icon: '🎯', color: '#a29bfe' },
    { id: 'health', label: 'Health', icon: '💪', color: '#00d68f' },
    { id: 'content', label: 'Content', icon: '📝', color: '#fdcb6e' },
    { id: 'skill', label: 'Skill', icon: '🧠', color: '#74b9ff' },
    { id: 'spiritual', label: 'Spiritual', icon: '🧘', color: '#e84393' },
  ];

  const PALETTE = ['#a29bfe', '#00d68f', '#fdcb6e', '#74b9ff', '#e84393', '#fd79a8', '#55efc4', '#ffeaa7', '#81ecec', '#dfe6e9'];

  // ─── Dynamic Categories ───
  function loadCategories() {
    try {
      const c = JSON.parse(localStorage.getItem(CATEGORIES_KEY));
      if (c && Array.isArray(c) && c.length > 0) return c;
      return [...DEFAULT_CATEGORIES];
    } catch { return [...DEFAULT_CATEGORIES]; }
  }

  function saveCategories(cats) {
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(cats));
  }

  let categories = loadCategories();

  function getCategoryIds() { return categories.map(c => c.id); }
  function getCategoryLabels() {
    const obj = {};
    categories.forEach(c => { obj[c.id] = c.label; });
    return obj;
  }
  function getCategoryIcons() {
    const obj = {};
    categories.forEach(c => { obj[c.id] = c.icon; });
    return obj;
  }
  function getCategoryColors() {
    const obj = {};
    categories.forEach(c => { obj[c.id] = c.color; });
    return obj;
  }

  // ─── Radar Interval ───
  function loadRadarInterval() {
    const v = parseInt(localStorage.getItem(RADAR_INTERVAL_KEY));
    return (v && v >= 3 && v <= 30) ? v : 10;
  }

  function saveRadarInterval(v) {
    localStorage.setItem(RADAR_INTERVAL_KEY, String(v));
  }

  let CYCLE_LENGTH = loadRadarInterval();

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
    if (tabName === 'ideas') renderIdeas();
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
    renderSettingsCategories();
    syncSettingsUI();
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
    const CATS = getCategoryIds();
    const LABELS = getCategoryLabels();
    const COLORS = getCategoryColors();
    radarChart = new Chart(ctx, {
      type: 'radar',
      data: {
        labels: CATS.map(c => LABELS[c]),
        datasets: [{
          label: 'Today',
          data: CATS.map(() => 0),
          backgroundColor: 'rgba(108, 92, 231, 0.15)',
          borderColor: '#6c5ce7',
          borderWidth: 2,
          pointBackgroundColor: CATS.map(c => COLORS[c]),
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

  function refreshRadarChartLabels() {
    if (!radarChart) return;
    const CATS = getCategoryIds();
    const LABELS = getCategoryLabels();
    const COLORS = getCategoryColors();
    radarChart.data.labels = CATS.map(c => LABELS[c]);
    radarChart.data.datasets[0].data = CATS.map(() => 0);
    radarChart.data.datasets[0].pointBackgroundColor = CATS.map(c => COLORS[c]);
    radarChart.update('none');
    updateRadarChart();
  }

  function getTodayScores() {
    const today = todayKey();
    const log = data.dailyLogs[today] || { completed: [] };
    const CATS = getCategoryIds();
    const scores = {};
    CATS.forEach(cat => {
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
    const CATS = getCategoryIds();
    const scores = getTodayScores();
    radarChart.data.datasets[0].data = CATS.map(c => scores[c] || 0);
    radarChart.update('default');
  }

  function renderCategoryScores() {
    const scores = getTodayScores();
    const CATS = getCategoryIds();
    const LABELS = getCategoryLabels();
    const ICONS = getCategoryIcons();
    const COLORS = getCategoryColors();
    categoryScores.innerHTML = '';
    CATS.forEach(cat => {
      const pct = scores[cat] || 0;
      const row = document.createElement('div');
      row.className = 'cat-score-row';
      row.innerHTML = `
        <span class="cat-score-icon">${ICONS[cat] || '📌'}</span>
        <div class="cat-score-info">
          <div class="cat-score-name">${LABELS[cat] || cat}</div>
          <div class="cat-score-bar-track">
            <div class="cat-score-bar-fill" style="width:${pct}%;background:${COLORS[cat] || '#6c5ce7'}"></div>
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
    cycleLengthLabel.textContent = CYCLE_LENGTH;
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
    const CATS = getCategoryIds();
    const cycleEntries = data.radarHistory.filter(e =>
      daysBetween(start, e.date) >= 0 && daysBetween(start, e.date) < CYCLE_LENGTH
    );
    const averages = {};
    CATS.forEach(cat => {
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
    const CATS = getCategoryIds();
    const LABELS = getCategoryLabels();
    const ICONS = getCategoryIcons();
    feedbackBody.innerHTML = '';
    CATS.forEach(cat => {
      const avg = averages[cat] || 0;
      const tier = getFeedbackTier(avg);
      const row = document.createElement('div');
      row.className = 'feedback-row';
      row.innerHTML = `
        <div class="feedback-left">
          <span class="feedback-cat">${ICONS[cat] || '📌'} ${LABELS[cat] || cat}</span>
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

    const LABELS = getCategoryLabels();
    habitList.innerHTML = '';
    if (total === 0) {
      emptyState.classList.remove('hidden');
    } else {
      emptyState.classList.add('hidden');
      data.habits.forEach(habit => {
        const isChecked = log.completed.includes(habit.id);
        const li = document.createElement('li');
        li.className = 'habit-item' + (isChecked ? ' completed' : '');
        const reminderBadge = habit.timed
          ? `<span class="habit-reminder-badge"><svg viewBox="0 0 18 18" fill="none"><path d="M9 1.5a5.5 5.5 0 0 1 5.5 5.5c0 2.5 1 4 1 4H2.5s1-1.5 1-4A5.5 5.5 0 0 1 9 1.5z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>${habit.reminderTime || ''}</span>`
          : '';
        li.innerHTML = `
          <input type="checkbox" class="habit-checkbox" data-id="${habit.id}" ${isChecked ? 'checked' : ''}>
          <span class="habit-name">${escapeHtml(habit.name)}</span>
          ${reminderBadge}
          <span class="category-badge" data-cat="${habit.category}">${LABELS[habit.category] || habit.category}</span>
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

  // ─── Update Category Select ───
  function updateCategorySelect() {
    categorySelect.innerHTML = '';
    categories.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat.id;
      opt.textContent = `${cat.icon} ${cat.label}`;
      categorySelect.appendChild(opt);
    });
  }

  // ─── Reminder Toggle in Add Form ───
  reminderToggle.addEventListener('change', () => {
    if (reminderToggle.checked) {
      reminderTimeRow.classList.add('visible');
    } else {
      reminderTimeRow.classList.remove('visible');
    }
  });

  // ─── Event Handlers (Schedule) ───
  addForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = habitInput.value.trim();
    if (!name) return;
    const isTimed = reminderToggle.checked;
    const newHabit = {
      id: generateId(),
      name,
      category: categorySelect.value,
      timed: isTimed,
      reminderTime: isTimed ? habitReminderTime.value : null,
    };
    data.habits.push(newHabit);
    autoResetIfNewDay();
    saveData(data);
    render();
    scheduleHabitReminders();
    habitInput.value = '';
    reminderToggle.checked = false;
    reminderTimeRow.classList.remove('visible');
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
      scheduleHabitReminders();
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
  // ─── Settings: Habit Categories ───
  // ═══════════════════════════════════════
  function renderSettingsCategories() {
    settingsCategoryList.innerHTML = '';
    categories.forEach(cat => {
      const chip = document.createElement('div');
      chip.className = 'settings-category-chip';
      const habitCount = data.habits.filter(h => h.category === cat.id).length;
      chip.innerHTML = `
        <span class="cat-chip-icon">${cat.icon}</span>
        <span class="cat-chip-name">${cat.label}</span>
        <button class="cat-chip-delete" data-catid="${cat.id}" title="${habitCount > 0 ? habitCount + ' habits use this' : 'Delete category'}" ${habitCount > 0 ? 'style="opacity:0.3;cursor:not-allowed"' : ''}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
        </button>
      `;
      settingsCategoryList.appendChild(chip);
    });
  }

  settingsCategoryList.addEventListener('click', (e) => {
    const btn = e.target.closest('.cat-chip-delete');
    if (!btn) return;
    const catId = btn.dataset.catid;
    const habitCount = data.habits.filter(h => h.category === catId).length;
    if (habitCount > 0) {
      alert(`Cannot delete: ${habitCount} habit(s) are using this category. Reassign or delete them first.`);
      return;
    }
    if (categories.length <= 1) {
      alert('You must keep at least one category.');
      return;
    }
    categories = categories.filter(c => c.id !== catId);
    saveCategories(categories);
    renderSettingsCategories();
    updateCategorySelect();
    refreshRadarChartLabels();
  });

  addCategoryForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const emoji = newCatEmoji.value.trim() || '📌';
    const name = newCatName.value.trim();
    if (!name) return;
    const id = name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    if (categories.some(c => c.id === id)) {
      alert('A category with that name already exists.');
      return;
    }
    const color = PALETTE[categories.length % PALETTE.length];
    categories.push({ id, label: name, icon: emoji, color });
    saveCategories(categories);
    renderSettingsCategories();
    updateCategorySelect();
    refreshRadarChartLabels();
    newCatEmoji.value = '';
    newCatName.value = '';
  });

  // ═══════════════════════════════════════
  // ─── Settings: Notifications ───
  // ═══════════════════════════════════════
  function loadNotifSettings() {
    try {
      return JSON.parse(localStorage.getItem(NOTIF_KEY)) || { enabled: false, time: '08:00' };
    } catch { return { enabled: false, time: '08:00' }; }
  }

  function saveNotifSettings(s) {
    localStorage.setItem(NOTIF_KEY, JSON.stringify(s));
  }

  let notifSettings = loadNotifSettings();
  let notifTimer = null;

  function syncNotifUI() {
    notifToggle.checked = notifSettings.enabled;
    notifTime.value = notifSettings.time;
    notifTimeRow.style.display = notifSettings.enabled ? 'flex' : 'none';
  }

  notifToggle.addEventListener('change', async () => {
    if (notifToggle.checked) {
      if ('Notification' in window) {
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') {
          notifToggle.checked = false;
          alert('Notification permission is required to set reminders.');
          return;
        }
      } else {
        alert('Your browser does not support notifications.');
        notifToggle.checked = false;
        return;
      }
      notifSettings.enabled = true;
    } else {
      notifSettings.enabled = false;
    }
    saveNotifSettings(notifSettings);
    syncNotifUI();
    scheduleNotification();
  });

  notifTime.addEventListener('change', () => {
    notifSettings.time = notifTime.value;
    saveNotifSettings(notifSettings);
    scheduleNotification();
  });

  function scheduleNotification() {
    if (notifTimer) { clearTimeout(notifTimer); notifTimer = null; }
    if (!notifSettings.enabled) return;
    const [h, m] = notifSettings.time.split(':').map(Number);
    const now = new Date();
    const target = new Date(now);
    target.setHours(h, m, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1);
    const delay = target - now;
    notifTimer = setTimeout(() => {
      if (Notification.permission === 'granted') {
        new Notification('Routine Tracker 🎯', {
          body: 'Time to check in with your daily habits!',
          icon: 'icons/icon-192.png',
        });
      }
      // Reschedule for next day
      scheduleNotification();
    }, delay);
  }

  // ─── Per-Habit Reminder Notifications ───
  let habitTimers = [];

  function scheduleHabitReminders() {
    // Clear existing habit timers
    habitTimers.forEach(t => clearTimeout(t));
    habitTimers = [];
    // Only schedule if notification permission is granted
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const today = todayKey();
    const log = data.dailyLogs[today] || { completed: [] };
    const timedHabits = data.habits.filter(h => h.timed && h.reminderTime);
    const now = new Date();
    timedHabits.forEach(habit => {
      // Skip if already completed today
      if (log.completed.includes(habit.id)) return;
      const [h, m] = habit.reminderTime.split(':').map(Number);
      const target = new Date(now);
      target.setHours(h, m, 0, 0);
      // Only schedule if the time is in the future today
      if (target <= now) return;
      const delay = target - now;
      const timer = setTimeout(() => {
        new Notification(`⏰ Habit Reminder`, {
          body: `Time for: ${habit.name}`,
          icon: 'icons/icon-192.png',
        });
      }, delay);
      habitTimers.push(timer);
    });
  }

  // ═══════════════════════════════════════
  // ─── Settings: Appearance ───
  // ═══════════════════════════════════════
  function loadTheme() {
    return localStorage.getItem(THEME_KEY) || 'dark';
  }

  function applyTheme(theme) {
    if (theme === 'light') {
      document.body.classList.add('light-theme');
      themeToggle.checked = true;
      themeIcon.textContent = '☀️';
      themeLabel.textContent = 'Light Mode';
    } else {
      document.body.classList.remove('light-theme');
      themeToggle.checked = false;
      themeIcon.textContent = '🌙';
      themeLabel.textContent = 'Dark Mode';
    }
    localStorage.setItem(THEME_KEY, theme);
    // Update radar chart colors for theme
    if (radarChart) {
      const isLight = theme === 'light';
      radarChart.options.scales.r.ticks.color = isLight ? '#888' : '#555568';
      radarChart.options.scales.r.grid.color = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)';
      radarChart.options.scales.r.angleLines.color = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)';
      radarChart.options.scales.r.pointLabels.color = isLight ? '#5a5a78' : '#8888a0';
      radarChart.options.plugins.tooltip.backgroundColor = isLight ? '#fff' : '#1c1c26';
      radarChart.options.plugins.tooltip.titleColor = isLight ? '#1a1a2e' : '#eaeaf0';
      radarChart.options.plugins.tooltip.bodyColor = isLight ? '#5a5a78' : '#8888a0';
      radarChart.options.plugins.tooltip.borderColor = isLight ? '#d8d8e5' : '#2a2a38';
      radarChart.update('none');
    }
  }

  themeToggle.addEventListener('change', () => {
    applyTheme(themeToggle.checked ? 'light' : 'dark');
  });

  // ═══════════════════════════════════════
  // ─── Settings: Data Backup ───
  // ═══════════════════════════════════════
  exportDataBtn.addEventListener('click', () => {
    const exportObj = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith('routine_tracker_')) {
        exportObj[key] = localStorage.getItem(key);
      }
    }
    const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `routine-tracker-backup-${todayKey()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  importDataBtn.addEventListener('click', () => {
    importFileInput.click();
  });

  importFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const imported = JSON.parse(ev.target.result);
        if (typeof imported !== 'object' || imported === null) {
          alert('Invalid backup file.');
          return;
        }
        // Validate it has routine_tracker keys
        const keys = Object.keys(imported);
        const validKeys = keys.filter(k => k.startsWith('routine_tracker_'));
        if (validKeys.length === 0) {
          alert('No valid routine tracker data found in file.');
          return;
        }
        if (!confirm(`Import ${validKeys.length} data entries? This will overwrite current data.`)) return;
        // Clear existing routine tracker data
        const toRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k.startsWith('routine_tracker_')) toRemove.push(k);
        }
        toRemove.forEach(k => localStorage.removeItem(k));
        // Import
        validKeys.forEach(k => localStorage.setItem(k, imported[k]));
        location.reload();
      } catch {
        alert('Failed to parse backup file. Please check the file format.');
      }
    };
    reader.readAsText(file);
    importFileInput.value = '';
  });

  resetAllBtn.addEventListener('click', () => {
    if (!confirm('⚠️ Reset ALL data?\n\nThis will permanently delete all your habits, history, events, ideas, and settings. This cannot be undone.')) return;
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k.startsWith('routine_tracker_')) toRemove.push(k);
    }
    toRemove.forEach(k => localStorage.removeItem(k));
    location.reload();
  });

  // ═══════════════════════════════════════
  // ─── Settings: Radar Interval ───
  // ═══════════════════════════════════════
  radarIntervalInput.value = CYCLE_LENGTH;

  radarIntervalInput.addEventListener('change', () => {
    let val = parseInt(radarIntervalInput.value);
    if (isNaN(val) || val < 3) val = 3;
    if (val > 30) val = 30;
    radarIntervalInput.value = val;
    CYCLE_LENGTH = val;
    saveRadarInterval(val);
    renderCycleIndicator();
  });

  // ─── Sync Settings UI ───
  function syncSettingsUI() {
    syncNotifUI();
    radarIntervalInput.value = CYCLE_LENGTH;
  }

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
    const CATS = getCategoryIds();
    const LABELS = getCategoryLabels();
    const ICONS = getCategoryIcons();

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
    CATS.forEach(cat => {
      const row = document.createElement('div');
      row.className = 'stat-row';
      row.innerHTML = `
        <span class="stat-row-icon">${ICONS[cat] || '📌'}</span>
        <div class="stat-row-info">
          <div class="stat-row-label">${LABELS[cat] || cat}</div>
          <div class="stat-row-detail">Today's completion</div>
        </div>
        <span class="stat-row-value">${todayScores[cat] || 0}%</span>
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
  function loadIdeasData() {
    try {
      const d = JSON.parse(localStorage.getItem(IDEAS_KEY));
      if (Array.isArray(d)) return d;
      // Migrate old string-based ideas
      const old = localStorage.getItem(IDEAS_KEY);
      if (old && typeof old === 'string' && old.trim()) {
        const migrated = old.split('\n').filter(l => l.trim()).map(text => ({
          id: generateId(), text: text.trim(), createdAt: new Date().toISOString(),
        }));
        saveIdeasData(migrated);
        return migrated;
      }
      return [];
    } catch { return []; }
  }

  function saveIdeasData(ideas) {
    localStorage.setItem(IDEAS_KEY, JSON.stringify(ideas));
  }

  let ideas = loadIdeasData();

  function formatRelativeDate(isoStr) {
    const d = new Date(isoStr);
    const now = new Date();
    const diffMs = now - d;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h ago`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return `${diffD}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function renderIdeas() {
    ideaList.innerHTML = '';
    if (ideas.length === 0) {
      ideaEmpty.style.display = 'flex';
      ideaCount.textContent = '';
    } else {
      ideaEmpty.style.display = 'none';
      ideaCount.textContent = `${ideas.length} idea${ideas.length !== 1 ? 's' : ''}`;
      ideas.forEach(idea => {
        const card = document.createElement('div');
        card.className = 'idea-card';
        card.innerHTML = `
          <div class="idea-card-top">
            <span class="idea-card-text">${escapeHtml(idea.text)}</span>
            <span class="idea-card-date">${formatRelativeDate(idea.createdAt)}</span>
          </div>
          <div class="idea-card-actions">
            <button class="idea-action-btn idea-to-habit" data-id="${idea.id}" title="Create as habit">
              <svg viewBox="0 0 18 18" fill="none"><path d="M3 9l4 4 8-8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
              Habit
            </button>
            <button class="idea-action-btn idea-to-event" data-id="${idea.id}" title="Add as calendar event">
              <svg viewBox="0 0 18 18" fill="none"><rect x="2" y="3" width="14" height="13" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M2 7h14" stroke="currentColor" stroke-width="1.5"/></svg>
              Event
            </button>
            <button class="idea-action-btn idea-delete" data-id="${idea.id}" title="Delete idea">
              <svg viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
              Delete
            </button>
          </div>
        `;
        ideaList.appendChild(card);
      });
    }
  }

  // Add idea
  function addIdea() {
    const text = ideaInput.value.trim();
    if (!text) return;
    ideas.unshift({ id: generateId(), text, createdAt: new Date().toISOString() });
    saveIdeasData(ideas);
    renderIdeas();
    ideaInput.value = '';
    ideaInput.focus();
  }

  ideaAddBtn.addEventListener('click', addIdea);
  ideaInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addIdea(); }
  });

  // Idea actions
  ideaList.addEventListener('click', (e) => {
    const btn = e.target.closest('.idea-action-btn');
    if (!btn) return;
    const id = btn.dataset.id;
    const idea = ideas.find(i => i.id === id);
    if (!idea) return;

    if (btn.classList.contains('idea-to-habit')) {
      // Convert to habit: pre-fill the habit input and switch to schedule tab
      habitInput.value = idea.text;
      switchTab('schedule');
      habitInput.focus();
      // Remove from ideas
      ideas = ideas.filter(i => i.id !== id);
      saveIdeasData(ideas);
    } else if (btn.classList.contains('idea-to-event')) {
      // Convert to event: switch to calendar, select today, pre-fill event
      switchTab('calendar');
      const today = todayKey();
      const dayNum = new Date().getDate();
      selectCalDay(today, dayNum);
      eventInput.value = idea.text;
      eventInput.focus();
      // Remove from ideas
      ideas = ideas.filter(i => i.id !== id);
      saveIdeasData(ideas);
    } else if (btn.classList.contains('idea-delete')) {
      ideas = ideas.filter(i => i.id !== id);
      saveIdeasData(ideas);
      renderIdeas();
    }
  });

  // ─── Init ───
  applyTheme(loadTheme());
  updateCategorySelect();
  renderDate();
  initRadarChart();
  initCalendar();
  render();
  switchTab('schedule');
  scheduleNotification();
  scheduleHabitReminders();

  // ─── Show user email ───
  const userEmailLabel = document.getElementById('userEmailLabel');
  if (userEmailLabel && currentSession.user) {
    userEmailLabel.textContent = currentSession.user.email || 'Logged in';
  }

  // ─── Logout ───
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await supaSignOut();
      window.location.href = 'auth.html';
    });
  }

})();
