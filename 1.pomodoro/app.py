# Pomodoro Timer App - ゲーミフィケーション要素付き
from flask import Flask, render_template, request, jsonify
import sqlite3
import os
from datetime import datetime, date, timedelta

app = Flask(__name__)
DATABASE = os.path.join(os.path.dirname(__file__), 'pomodoro.db')

# レベルアップのXP閾値（レベル1〜10）
LEVEL_XP = [0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200, 4000]

# XP計算の定数
BASE_XP_PER_POMODORO = 25
STREAK_BONUS_PER_DAY = 5
MAX_STREAK_BONUS = 50


BADGE_DEFINITIONS = [
    {'id': 'first_step',   'name': '初めての一歩',         'description': '最初のポモドーロを完了',          'icon': '🎯'},
    {'id': 'total_10',     'name': '10回達成',              'description': '合計10回のポモドーロを完了',      'icon': '🥉'},
    {'id': 'total_50',     'name': '集中の達人',            'description': '合計50回のポモドーロを完了',      'icon': '🏆'},
    {'id': 'streak_3',     'name': '三日連続',              'description': '3日連続でポモドーロを完了',       'icon': '🔥'},
    {'id': 'streak_7',     'name': 'ストリークマスター',    'description': '7日連続でポモドーロを完了',       'icon': '⚡'},
    {'id': 'weekly_10',    'name': 'ウィークリーチャレンジ','description': '1週間で10回以上完了',             'icon': '📅'},
    {'id': 'monthly_30',   'name': '月間チャンピオン',      'description': '今月30回以上完了',                'icon': '👑'},
    {'id': 'level_5',      'name': 'レベル5達成',           'description': 'レベル5に到達',                   'icon': '⭐'},
    {'id': 'level_10',     'name': '精鋭',                  'description': 'レベル10に到達',                  'icon': '💫'},
]


def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    conn.execute('''
        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            type TEXT NOT NULL,
            completed INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL
        )
    ''')
    conn.execute('''
        CREATE TABLE IF NOT EXISTS user_stats (
            id INTEGER PRIMARY KEY DEFAULT 1,
            total_xp INTEGER NOT NULL DEFAULT 0,
            level INTEGER NOT NULL DEFAULT 1,
            current_streak INTEGER NOT NULL DEFAULT 0,
            max_streak INTEGER NOT NULL DEFAULT 0,
            last_session_date TEXT,
            total_pomodoros INTEGER NOT NULL DEFAULT 0
        )
    ''')
    conn.execute('''
        CREATE TABLE IF NOT EXISTS earned_badges (
            badge_id TEXT PRIMARY KEY,
            earned_at TEXT NOT NULL
        )
    ''')
    # ユーザー統計の初期化（初回のみ）
    existing = conn.execute('SELECT id FROM user_stats WHERE id = 1').fetchone()
    if not existing:
        conn.execute('''
            INSERT INTO user_stats
                (id, total_xp, level, current_streak, max_streak, total_pomodoros)
            VALUES (1, 0, 1, 0, 0, 0)
        ''')
    conn.commit()
    conn.close()


def calculate_level(total_xp):
    """XPからレベルを計算する"""
    level = 1
    for i, threshold in enumerate(LEVEL_XP):
        if total_xp >= threshold:
            level = i + 1
        else:
            break
    return min(level, len(LEVEL_XP))


def xp_for_level(level):
    """指定レベルに必要な累積XPを返す"""
    if 1 <= level <= len(LEVEL_XP):
        return LEVEL_XP[level - 1]
    return LEVEL_XP[-1] + (level - len(LEVEL_XP)) * 1000


def update_streak(conn, today_str):
    """今日のセッション完了に基づいてストリークを更新する"""
    stats = conn.execute('SELECT * FROM user_stats WHERE id = 1').fetchone()
    last_date = stats['last_session_date']
    current_streak = stats['current_streak']
    max_streak = stats['max_streak']

    if last_date is None:
        current_streak = 1
    else:
        last = date.fromisoformat(last_date)
        today = date.fromisoformat(today_str)
        delta = (today - last).days
        if delta == 0:
            pass  # 同日の複数セッション: ストリーク変更なし
        elif delta == 1:
            current_streak += 1
        else:
            current_streak = 1  # ストリーク途切れ

    max_streak = max(max_streak, current_streak)
    return current_streak, max_streak


def check_and_award_badges(conn, stats):
    """バッジ条件を確認し、新たに獲得したバッジIDのリストを返す"""
    earned = {
        row['badge_id']
        for row in conn.execute('SELECT badge_id FROM earned_badges').fetchall()
    }

    today = date.today()
    # 今週の完了数
    week_start = today - timedelta(days=today.weekday())
    weekly_count = conn.execute(
        "SELECT COUNT(*) FROM sessions WHERE type='pomodoro' AND completed=1 AND date>=?",
        (week_start.isoformat(),)
    ).fetchone()[0]

    # 今月の完了数
    month_start = date(today.year, today.month, 1)
    monthly_count = conn.execute(
        "SELECT COUNT(*) FROM sessions WHERE type='pomodoro' AND completed=1 AND date>=?",
        (month_start.isoformat(),)
    ).fetchone()[0]

    conditions = {
        'first_step':  stats['total_pomodoros'] >= 1,
        'total_10':    stats['total_pomodoros'] >= 10,
        'total_50':    stats['total_pomodoros'] >= 50,
        'streak_3':    stats['max_streak'] >= 3,
        'streak_7':    stats['max_streak'] >= 7,
        'weekly_10':   weekly_count >= 10,
        'monthly_30':  monthly_count >= 30,
        'level_5':     stats['level'] >= 5,
        'level_10':    stats['level'] >= 10,
    }

    now = datetime.now().isoformat()
    new_badges = []
    for badge_id, met in conditions.items():
        if met and badge_id not in earned:
            conn.execute(
                'INSERT OR IGNORE INTO earned_badges (badge_id, earned_at) VALUES (?, ?)',
                (badge_id, now)
            )
            new_badges.append(badge_id)
    return new_badges


# ─────────────────────────── ルート ───────────────────────────

@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/user')
def get_user():
    """ユーザーデータ（レベル、XP、ストリーク、バッジ）を返す"""
    conn = get_db()
    stats = dict(conn.execute('SELECT * FROM user_stats WHERE id = 1').fetchone())
    earned_badges = {
        row['badge_id']: row['earned_at']
        for row in conn.execute('SELECT * FROM earned_badges').fetchall()
    }
    conn.close()

    level = stats['level']
    total_xp = stats['total_xp']
    current_level_xp = xp_for_level(level)
    next_level_xp = xp_for_level(level + 1)
    xp_progress = total_xp - current_level_xp
    xp_needed = next_level_xp - current_level_xp

    badges_with_status = [
        {
            **badge,
            'earned': badge['id'] in earned_badges,
            'earned_at': earned_badges.get(badge['id'])
        }
        for badge in BADGE_DEFINITIONS
    ]

    return jsonify({
        'level': level,
        'total_xp': total_xp,
        'xp_progress': xp_progress,
        'xp_needed': xp_needed,
        'xp_percent': round(xp_progress / xp_needed * 100) if xp_needed > 0 else 100,
        'current_streak': stats['current_streak'],
        'max_streak': stats['max_streak'],
        'total_pomodoros': stats['total_pomodoros'],
        'badges': badges_with_status,
    })


@app.route('/api/session/complete', methods=['POST'])
def complete_session():
    """セッション完了を記録し、XP・ストリーク・バッジを更新する"""
    data = request.get_json() or {}
    session_type = data.get('type', 'pomodoro')
    today_str = date.today().isoformat()
    now = datetime.now().isoformat()

    conn = get_db()
    conn.execute(
        'INSERT INTO sessions (date, type, completed, created_at) VALUES (?, ?, 1, ?)',
        (today_str, session_type, now)
    )

    if session_type != 'pomodoro':
        conn.commit()
        conn.close()
        return jsonify({'success': True})

    # ストリーク更新
    current_streak, max_streak = update_streak(conn, today_str)

    # XP計算（基本XP + ストリークボーナス）
    base_xp = BASE_XP_PER_POMODORO
    streak_bonus = min(current_streak * STREAK_BONUS_PER_DAY, MAX_STREAK_BONUS)
    xp_gained = base_xp + streak_bonus

    prev_stats = dict(conn.execute('SELECT * FROM user_stats WHERE id = 1').fetchone())
    new_total_xp = prev_stats['total_xp'] + xp_gained
    new_total_pomodoros = prev_stats['total_pomodoros'] + 1
    new_level = calculate_level(new_total_xp)

    conn.execute('''
        UPDATE user_stats SET
            total_xp = ?,
            level = ?,
            current_streak = ?,
            max_streak = ?,
            last_session_date = ?,
            total_pomodoros = ?
        WHERE id = 1
    ''', (new_total_xp, new_level, current_streak, max_streak, today_str, new_total_pomodoros))

    updated_stats = {
        'total_xp': new_total_xp,
        'level': new_level,
        'current_streak': current_streak,
        'max_streak': max_streak,
        'total_pomodoros': new_total_pomodoros,
    }
    new_badges = check_and_award_badges(conn, updated_stats)

    conn.commit()
    conn.close()

    return jsonify({
        'success': True,
        'xp_gained': xp_gained,
        'base_xp': base_xp,
        'streak_bonus': streak_bonus,
        'total_xp': new_total_xp,
        'level': new_level,
        'level_up': new_level > prev_stats['level'],
        'current_streak': current_streak,
        'total_pomodoros': new_total_pomodoros,
        'new_badges': new_badges,
    })


@app.route('/api/stats')
def get_stats():
    """週間・月間統計データを返す"""
    conn = get_db()
    today = date.today()

    # 直近7日間の日別完了数
    weekly_data = []
    for i in range(6, -1, -1):
        d = today - timedelta(days=i)
        count = conn.execute(
            "SELECT COUNT(*) FROM sessions WHERE type='pomodoro' AND completed=1 AND date=?",
            (d.isoformat(),)
        ).fetchone()[0]
        weekly_data.append({'date': d.isoformat(), 'label': f'{d.month}/{d.day}', 'count': count})

    # 直近4週間の週別完了数
    monthly_data = []
    for week_offset in range(3, -1, -1):
        week_end = today - timedelta(days=week_offset * 7)
        week_start = week_end - timedelta(days=6)
        count = conn.execute(
            "SELECT COUNT(*) FROM sessions WHERE type='pomodoro' AND completed=1 AND date>=? AND date<=?",
            (week_start.isoformat(), week_end.isoformat())
        ).fetchone()[0]
        monthly_data.append({
            'label': f'{week_start.month}/{week_start.day}〜',
            'count': count
        })

    # 集計値
    total = conn.execute(
        "SELECT COUNT(*) FROM sessions WHERE type='pomodoro' AND completed=1"
    ).fetchone()[0]

    week_start_this = today - timedelta(days=today.weekday())
    this_week = conn.execute(
        "SELECT COUNT(*) FROM sessions WHERE type='pomodoro' AND completed=1 AND date>=?",
        (week_start_this.isoformat(),)
    ).fetchone()[0]

    month_start_this = date(today.year, today.month, 1)
    this_month = conn.execute(
        "SELECT COUNT(*) FROM sessions WHERE type='pomodoro' AND completed=1 AND date>=?",
        (month_start_this.isoformat(),)
    ).fetchone()[0]

    stats = dict(conn.execute('SELECT * FROM user_stats WHERE id = 1').fetchone())
    conn.close()

    return jsonify({
        'weekly': weekly_data,
        'monthly': monthly_data,
        'total': total,
        'this_week': this_week,
        'this_month': this_month,
        'max_streak': stats['max_streak'],
    })


if __name__ == '__main__':
    init_db()
    debug_mode = os.environ.get('FLASK_DEBUG', 'false').lower() == 'true'
    app.run(debug=debug_mode, port=5000)
