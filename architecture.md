# Webアプリケーションアーキテクチャ案

## 概要
このプロジェクトでは、ポモドーロタイマーのWebアプリケーションを作成します。以下に、FlaskとHTML/CSS/JavaScriptを使用したアーキテクチャ案をまとめます。

---

## ディレクトリ構成
```
1.pomodoro/
├── app.py                  # Flaskアプリ本体
├── requirements.txt        # 依存パッケージ
├── static/
│   ├── css/
│   │   └── style.css       # スタイルシート
│   └── js/
│       └── timer.js        # タイマーロジック
└── templates/
    └── index.html          # メインHTMLテンプレート
```

---

## 各層の役割

### Flask (`app.py`)
- **ルートエンドポイント**: `index.html` を返す
- **設定API**: 作業時間や休憩時間の設定を取得・保存する（必要に応じて）
- **データ永続化**: 必要であればSQLiteなどを使用してポモドーロの履歴を保存

#### サンプルコード
```python
from flask import Flask, render_template, request, jsonify

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/settings', methods=['GET', 'POST'])
def settings():
    if request.method == 'POST':
        # 設定を保存
        data = request.json
        return jsonify({"message": "Settings saved"}), 200
    else:
        # デフォルト設定を返す
        return jsonify({"work_time": 25, "short_break": 5, "long_break": 15}), 200

if __name__ == '__main__':
    app.run(debug=True)
```

---

### HTML/CSS (`index.html`, `style.css`)
- **円形タイマー**: SVGまたはCSSでプログレスリングを表現
- **フェーズ表示**: 作業中、短い休憩、長い休憩を表示
- **操作ボタン**: スタート、一時停止、リセット
- **設定モーダル**: 作業時間や休憩時間を変更可能

#### サンプルHTML
```html
<div class="timer-container">
  <div class="progress-ring">
    <svg>
      <!-- 円形プログレスバー -->
    </svg>
    <div class="time-display">25:00</div>
  </div>
  <div class="controls">
    <button id="start-btn">スタート</button>
    <button id="pause-btn">一時停止</button>
    <button id="reset-btn">リセット</button>
  </div>
</div>
```

---

### JavaScript (`timer.js`)
- **タイマー状態**: 作業中、短い休憩、長い休憩
- **時間管理**: `setInterval` を使用してカウントダウン
- **フェーズ遷移**: 作業→休憩→作業のサイクルを管理

#### サンプルコード
```javascript
let timer = {
  phase: "work", // "work", "short_break", "long_break"
  remaining: 25 * 60, // 秒単位
  isRunning: false,
};

function startTimer() {
  if (!timer.isRunning) {
    timer.isRunning = true;
    timer.interval = setInterval(() => {
      timer.remaining--;
      updateDisplay();
      if (timer.remaining <= 0) {
        nextPhase();
      }
    }, 1000);
  }
}

function pauseTimer() {
  clearInterval(timer.interval);
  timer.isRunning = false;
}

function resetTimer() {
  pauseTimer();
  timer.remaining = 25 * 60; // デフォルト値
  updateDisplay();
}

function updateDisplay() {
  const minutes = Math.floor(timer.remaining / 60);
  const seconds = timer.remaining % 60;
  document.querySelector(".time-display").textContent = `${minutes}:${seconds}`;
}

function nextPhase() {
  // フェーズ遷移ロジック
}
```

---

## ユニットテストのしやすさを考慮した改善点

### バックエンド（Flask）
- **ルーティングの分離**: FlaskのルートやAPIエンドポイントをモジュール化
- **設定の依存性注入**: 環境変数や設定ファイルから設定値を読み込む
- **テスト用設定の導入**: テスト環境用の設定を用意

### フロントエンド（JavaScript）
- **ロジックの分離**: タイマーの状態管理（`TimerState`）とUI更新（`UIRenderer`）を完全に分離
- **テスト可能なUI更新ロジック**: DOM操作を関数化

---

## CI/CDの導入
- **自動テストの実行**: GitHub Actionsを使用して、コード変更時に自動でテストを実行

#### サンプルGitHub Actions設定
```yaml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: 3.9
      - name: Install dependencies
        run: pip install -r requirements.txt
      - name: Run tests
        run: pytest
```