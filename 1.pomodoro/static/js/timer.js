/* ═══════════════════════════════════════════════
   ポモドーロタイマー – タイマー & ゲーミフィケーションJS
   ═══════════════════════════════════════════════ */

'use strict';

// ─── 定数 ─────────────────────────────────────────────
const DURATIONS = {
  pomodoro:    25 * 60,
  short_break:  5 * 60,
  long_break:  15 * 60,
};

const SESSION_LABELS = {
  pomodoro:    '集中タイム',
  short_break: '短い休憩',
  long_break:  '長い休憩',
};

const RING_CIRCUMFERENCE = 2 * Math.PI * 96; // ≈ 603.19

// 通知タイミングの定数（ミリ秒）
const TOAST_DISPLAY_DURATION    = 4000;
const LEVELUP_NOTIFICATION_DELAY = 1800;
const BADGE_NOTIFICATION_DELAY   = 2500;

const LEVEL_ICONS = ['⭐', '🌟', '💫', '✨', '🏅', '🥈', '🥇', '🎖️', '🏆', '👑'];

const BADGE_INFO = {
  first_step:   { name: '初めての一歩',         icon: '🎯' },
  total_10:     { name: '10回達成',              icon: '🥉' },
  total_50:     { name: '集中の達人',            icon: '🏆' },
  streak_3:     { name: '三日連続',              icon: '🔥' },
  streak_7:     { name: 'ストリークマスター',    icon: '⚡' },
  weekly_10:    { name: 'ウィークリーチャレンジ', icon: '📅' },
  monthly_30:   { name: '月間チャンピオン',      icon: '👑' },
  level_5:      { name: 'レベル5達成',           icon: '⭐' },
  level_10:     { name: '精鋭',                  icon: '💫' },
};

// ─── タイマー状態 ──────────────────────────────────────
let currentSession  = 'pomodoro';
let timeLeft        = DURATIONS.pomodoro;
let totalTime       = DURATIONS.pomodoro;
let isRunning       = false;
let intervalId      = null;
let pomodorosInSet  = 0;   // 連続セット内のポモドーロ数（4個で1セット）

// ─── チャートインスタンス ──────────────────────────────
let weeklyChart  = null;
let monthlyChart = null;

// ─── 初期化 ───────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  updateDisplay();
  loadUserData();
  loadStats();
});

// ─── タイマー制御 ──────────────────────────────────────

/** スタート/ポーズ切替 */
function toggleTimer() {
  isRunning ? pauseTimer() : startTimer();
}

function startTimer() {
  if (isRunning) return;
  isRunning = true;
  document.getElementById('start-btn').textContent = '⏸ ポーズ';
  intervalId = setInterval(tick, 1000);
}

function pauseTimer() {
  isRunning = false;
  clearInterval(intervalId);
  document.getElementById('start-btn').textContent = '▶ スタート';
}

function resetTimer() {
  pauseTimer();
  timeLeft  = DURATIONS[currentSession];
  totalTime = DURATIONS[currentSession];
  updateDisplay();
}

/** 毎秒のカウントダウン */
function tick() {
  if (timeLeft <= 0) {
    clearInterval(intervalId);
    isRunning = false;
    document.getElementById('start-btn').textContent = '▶ スタート';
    onSessionComplete();
    return;
  }
  timeLeft--;
  updateDisplay();
}

/** セッション種別切替 */
function switchSession(type) {
  if (currentSession === type) return;
  pauseTimer();
  currentSession = type;
  timeLeft  = DURATIONS[type];
  totalTime = DURATIONS[type];

  // タブのアクティブ状態
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.type === type);
  });

  // リングの色（休憩モード）
  const ring = document.getElementById('ring-progress');
  const isBreak = type !== 'pomodoro';
  ring.classList.toggle('break-mode', isBreak);

  updateDisplay();
}

// ─── セッション完了処理 ────────────────────────────────

async function onSessionComplete() {
  // ブラウザ通知（許可されている場合）
  if (Notification.permission === 'granted') {
    const label = SESSION_LABELS[currentSession];
    new Notification(`🍅 ${label}完了！`, { body: '次のセッションを始めましょう。' });
  }

  if (currentSession === 'pomodoro') {
    pomodorosInSet = (pomodorosInSet + 1) % 4;
    updatePomoDots();

    try {
      const res = await fetch('/api/session/complete', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ type: 'pomodoro' }),
      });
      const data = await res.json();

      if (data.success) {
        // XP獲得通知
        const bonusText = data.streak_bonus > 0 ? ` (+${data.streak_bonus} ストリークボーナス)` : '';
        showToast('🍅', 'ポモドーロ完了！',
                  `+${data.xp_gained} XP 獲得${bonusText}`);

        // レベルアップ通知
        if (data.level_up) {
          setTimeout(() => {
            showToast(LEVEL_ICONS[(data.level - 1) % LEVEL_ICONS.length],
                      `レベルアップ！`,
                      `Lv.${data.level} に到達しました！`);
          }, LEVELUP_NOTIFICATION_DELAY);
        }

        // バッジ獲得通知
        if (data.new_badges && data.new_badges.length > 0) {
          data.new_badges.forEach((badgeId, i) => {
            const info = BADGE_INFO[badgeId] || { name: badgeId, icon: '🏅' };
            setTimeout(() => {
              showToast(info.icon, 'バッジ獲得！', `「${info.name}」を取得しました`);
            }, (i + 1) * BADGE_NOTIFICATION_DELAY + (data.level_up ? LEVELUP_NOTIFICATION_DELAY : 0));
          });
        }

        // UI更新
        loadUserData();
        loadStats();
      }
    } catch (err) {
      console.error('セッション記録エラー:', err);
    }

    // 自動で短い休憩に切替提案
    setTimeout(() => switchSession('short_break'), 500);

  } else {
    // 休憩終了 → ポモドーロへ
    showToast('☕', '休憩終了！', '次の集中タイムを始めましょう');
    setTimeout(() => switchSession('pomodoro'), 500);
  }
}

// ─── 表示更新 ──────────────────────────────────────────

function updateDisplay() {
  const mins = String(Math.floor(timeLeft / 60)).padStart(2, '0');
  const secs = String(timeLeft % 60).padStart(2, '0');
  document.getElementById('timer-time').textContent = `${mins}:${secs}`;
  document.getElementById('timer-label').textContent = SESSION_LABELS[currentSession];

  // ページタイトル更新
  document.title = `${mins}:${secs} – 🍅 ポモドーロタイマー`;

  updateRing();
}

function updateRing() {
  const progress  = totalTime > 0 ? timeLeft / totalTime : 0;
  const offset    = RING_CIRCUMFERENCE * (1 - progress);
  document.getElementById('ring-progress').style.strokeDashoffset = offset;
}

function updatePomoDots() {
  for (let i = 0; i < 4; i++) {
    const dot = document.getElementById(`dot-${i}`);
    if (dot) dot.classList.toggle('done', i < pomodorosInSet);
  }
}

// ─── データ取得・UI反映 ────────────────────────────────

/** ユーザーデータ（XP / レベル / ストリーク / バッジ）を読み込む */
async function loadUserData() {
  try {
    const res  = await fetch('/api/user');
    const data = await res.json();
    renderUserStats(data);
    renderBadges(data.badges);
  } catch (err) {
    console.error('ユーザーデータ取得エラー:', err);
  }
}

/** ヘッダーのユーザーステータスを更新する */
function renderUserStats(data) {
  document.getElementById('level-text').textContent     = `Lv.${data.level}`;
  document.getElementById('level-icon').textContent     =
      LEVEL_ICONS[(data.level - 1) % LEVEL_ICONS.length];
  document.getElementById('xp-bar-fill').style.width    = `${data.xp_percent}%`;
  document.getElementById('xp-label').textContent       =
      `${data.xp_progress} / ${data.xp_needed} XP`;
  document.getElementById('streak-num').textContent     = data.current_streak;
}

/** バッジグリッドを描画する */
function renderBadges(badges) {
  const grid = document.getElementById('badges-grid');
  grid.innerHTML = '';

  badges.forEach(badge => {
    const card = document.createElement('div');
    card.className = `badge-card${badge.earned ? ' earned' : ''}`;
    card.title     = badge.earned
        ? `取得日: ${badge.earned_at ? badge.earned_at.slice(0, 10) : '—'}`
        : '未取得';

    card.innerHTML = `
      <div class="badge-icon">${badge.icon}</div>
      <div class="badge-name">${badge.name}</div>
      <div class="badge-desc">${badge.description}</div>
    `;
    grid.appendChild(card);
  });
}

/** 統計データを読み込んでグラフ・サマリーを更新する */
async function loadStats() {
  try {
    const res  = await fetch('/api/stats');
    const data = await res.json();
    renderStatsSummary(data);
    renderCharts(data);
  } catch (err) {
    console.error('統計データ取得エラー:', err);
  }
}

function renderStatsSummary(data) {
  document.getElementById('stat-total').textContent      = data.total;
  document.getElementById('stat-week').textContent       = data.this_week;
  document.getElementById('stat-month').textContent      = data.this_month;
  document.getElementById('stat-max-streak').textContent = data.max_streak;
}

// ─── Chart.js グラフ ───────────────────────────────────

const CHART_DEFAULTS = {
  responsive:          true,
  maintainAspectRatio: true,
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: ctx => `${ctx.parsed.y} ポモドーロ`,
      },
    },
  },
  scales: {
    x: {
      ticks: { color: '#8a8a9a', font: { size: 11 } },
      grid:  { color: 'rgba(255,255,255,0.05)' },
    },
    y: {
      beginAtZero: true,
      ticks: { color: '#8a8a9a', stepSize: 1, font: { size: 11 } },
      grid:  { color: 'rgba(255,255,255,0.05)' },
    },
  },
};

function renderCharts(data) {
  // ── 週間棒グラフ ──
  const wLabels = data.weekly.map(d => d.label);
  const wCounts = data.weekly.map(d => d.count);

  if (weeklyChart) {
    weeklyChart.data.labels          = wLabels;
    weeklyChart.data.datasets[0].data = wCounts;
    weeklyChart.update();
  } else {
    const ctx = document.getElementById('weekly-chart').getContext('2d');
    weeklyChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels:   wLabels,
        datasets: [{
          data:            wCounts,
          backgroundColor: 'rgba(231,76,60,0.7)',
          borderColor:     'rgba(231,76,60,1)',
          borderWidth:     2,
          borderRadius:    6,
        }],
      },
      options: { ...CHART_DEFAULTS },
    });
  }

  // ── 月間折れ線グラフ ──
  const mLabels = data.monthly.map(d => d.label);
  const mCounts = data.monthly.map(d => d.count);

  if (monthlyChart) {
    monthlyChart.data.labels           = mLabels;
    monthlyChart.data.datasets[0].data = mCounts;
    monthlyChart.update();
  } else {
    const ctx = document.getElementById('monthly-chart').getContext('2d');
    monthlyChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels:   mLabels,
        datasets: [{
          data:            mCounts,
          backgroundColor: 'rgba(241,196,15,0.15)',
          borderColor:     'rgba(241,196,15,0.9)',
          borderWidth:     2,
          pointBackgroundColor: 'rgba(241,196,15,1)',
          pointRadius:     5,
          fill:            true,
          tension:         0.35,
        }],
      },
      options: { ...CHART_DEFAULTS },
    });
  }
}

// ─── トースト通知 ──────────────────────────────────────

let toastTimer = null;

function showToast(icon, title, message) {
  const toast = document.getElementById('toast');
  document.getElementById('toast-icon').textContent  = icon;
  document.getElementById('toast-title').textContent = title;
  document.getElementById('toast-msg').textContent   = message;

  toast.classList.remove('hidden');
  toast.style.animation = 'none';
  // reflow
  void toast.offsetWidth;
  toast.style.animation = '';

  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add('hidden'), TOAST_DISPLAY_DURATION);
}

// ─── ブラウザ通知許可リクエスト ───────────────────────
if ('Notification' in window && Notification.permission === 'default') {
  Notification.requestPermission();
}
