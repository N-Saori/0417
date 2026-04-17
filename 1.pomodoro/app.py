# Pomodoro Timer App
"""
ポモドーロタイマー - パターンA: 視覚的フィードバック強化版

機能:
  - 円形プログレスバーのアニメーション（残り時間に応じて滑らかに減少）
  - 色の変化: 青 → 黄 → 赤 へグラデーションで変化
  - 背景パーティクルエフェクト・波紋アニメーション（集中時間中）

実行方法:
  python app.py
  ブラウザで http://localhost:8000 を開く
"""

import http.server
import socketserver
import os
import webbrowser

PORT = 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def log_message(self, format, *args):  # noqa: A002
        print(f"[{self.address_string()}] {format % args}")


if __name__ == "__main__":
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        url = f"http://localhost:{PORT}/index.html"
        print(f"ポモドーロタイマー起動中: {url}")
        webbrowser.open(url)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nサーバーを停止しました。")
