/**
 * minChart.js – 軽量 Canvas グラフライブラリ（Chart.js代替）
 * bar / line の2種類をサポート
 */
'use strict';

window.Chart = (function () {

  const DEFAULTS = {
    responsive:          true,
    maintainAspectRatio: true,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: ctx => `${ctx.parsed.y}` } },
    },
    scales: {
      x: { ticks: { color: '#8a8a9a' }, grid: { color: 'rgba(255,255,255,0.05)' } },
      y: { beginAtZero: true, ticks: { color: '#8a8a9a', stepSize: 1 }, grid: { color: 'rgba(255,255,255,0.05)' } },
    },
  };

  class MinChart {
    constructor(ctx, config) {
      this.ctx    = ctx;
      this.canvas = ctx.canvas;
      this.type   = config.type;
      this.data   = config.data;
      this.options = this._merge(DEFAULTS, config.options || {});
      this._setupDPI();
      this.draw();
    }

    _merge(base, override) {
      const out = Object.assign({}, base);
      for (const key in override) {
        if (override[key] && typeof override[key] === 'object' && !Array.isArray(override[key])) {
          out[key] = this._merge(base[key] || {}, override[key]);
        } else {
          out[key] = override[key];
        }
      }
      return out;
    }

    _setupDPI() {
      const dpr    = window.devicePixelRatio || 1;
      const rect   = this.canvas.getBoundingClientRect();
      const w      = rect.width  || 300;
      const h      = rect.height || 200;
      this.canvas.width  = w * dpr;
      this.canvas.height = h * dpr;
      this.canvas.style.width  = w + 'px';
      this.canvas.style.height = h + 'px';
      this.ctx.scale(dpr, dpr);
      this._w = w;
      this._h = h;
    }

    update() {
      this.ctx.clearRect(0, 0, this._w, this._h);
      this.draw();
    }

    draw() {
      if (this.type === 'bar')  this._drawBar();
      if (this.type === 'line') this._drawLine();
    }

    _layout() {
      const PADDING = { left: 36, right: 12, top: 16, bottom: 32 };
      return {
        l: PADDING.left,          r: this._w - PADDING.right,
        t: PADDING.top,           b: this._h - PADDING.bottom,
        w: this._w - PADDING.left - PADDING.right,
        h: this._h - PADDING.top  - PADDING.bottom,
      };
    }

    _maxVal() {
      const vals = this.data.datasets.flatMap(ds => ds.data);
      return Math.max(...vals, 1);
    }

    _drawAxes(layout, maxVal) {
      const { ctx } = this;
      const { l, r, t, b, w, h } = layout;
      const labels  = this.data.labels || [];
      const MAX_GRID_STEPS = 5;
      const steps   = Math.min(maxVal, MAX_GRID_STEPS);

      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth   = 1;

      // 横グリッド
      for (let i = 0; i <= steps; i++) {
        const y = b - (h * i / steps);
        ctx.beginPath(); ctx.moveTo(l, y); ctx.lineTo(r, y); ctx.stroke();

        ctx.fillStyle = '#8a8a9a';
        ctx.font      = '10px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(Math.round(maxVal * i / steps), l - 4, y + 4);
      }

      // X軸ラベル
      ctx.fillStyle = '#8a8a9a';
      ctx.font      = '10px sans-serif';
      ctx.textAlign = 'center';
      const colW = w / labels.length;
      labels.forEach((label, i) => {
        const x = l + colW * i + colW / 2;
        ctx.fillText(label, x, b + 18);
      });
    }

    _drawBar() {
      const { ctx } = this;
      const layout  = this._layout();
      const { l, t, b, w, h } = layout;
      const maxVal  = this._maxVal();
      const labels  = this.data.labels || [];
      const ds      = this.data.datasets[0];

      this._drawAxes(layout, maxVal);

      const colW   = w / labels.length;
      const barW   = colW * 0.55;
      const radius = 4;

      ds.data.forEach((val, i) => {
        const x    = l + colW * i + (colW - barW) / 2;
        const barH = maxVal > 0 ? (val / maxVal) * h : 0;
        const y    = b - barH;

        ctx.fillStyle = ds.backgroundColor || 'rgba(231,76,60,0.7)';
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + barW - radius, y);
        ctx.quadraticCurveTo(x + barW, y, x + barW, y + radius);
        ctx.lineTo(x + barW, b);
        ctx.lineTo(x, b);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        ctx.fill();

        if (val > 0) {
          ctx.fillStyle = '#e8e8e8';
          ctx.font      = 'bold 11px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(val, x + barW / 2, y - 4);
        }
      });
    }

    _drawLine() {
      const { ctx } = this;
      const layout  = this._layout();
      const { l, t, b, w, h } = layout;
      const maxVal  = this._maxVal();
      const labels  = this.data.labels || [];
      const ds      = this.data.datasets[0];

      this._drawAxes(layout, maxVal);

      const points = ds.data.map((val, i) => ({
        x: l + (w / (labels.length - 1 || 1)) * i,
        y: b - (maxVal > 0 ? (val / maxVal) * h : 0),
        v: val,
      }));

      // 塗りつぶし
      if (ds.fill !== false) {
        ctx.beginPath();
        ctx.moveTo(points[0].x, b);
        points.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.lineTo(points[points.length - 1].x, b);
        ctx.closePath();
        ctx.fillStyle = ds.backgroundColor || 'rgba(241,196,15,0.15)';
        ctx.fill();
      }

      // 折れ線
      ctx.beginPath();
      ctx.strokeStyle = ds.borderColor || 'rgba(241,196,15,0.9)';
      ctx.lineWidth   = ds.borderWidth || 2;
      ctx.lineJoin    = 'round';
      points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
      ctx.stroke();

      // ポイント
      points.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = ds.pointBackgroundColor || 'rgba(241,196,15,1)';
        ctx.fill();

        if (p.v > 0) {
          ctx.fillStyle = '#e8e8e8';
          ctx.font      = 'bold 11px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(p.v, p.x, p.y - 10);
        }
      });
    }
  }

  return MinChart;
})();
