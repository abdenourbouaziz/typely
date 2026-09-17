/* apps/typely/js/history.js
 * Typely local history: persist test results, render stats + SVG graphs, CSV export.
 *
 * Zero dependencies. Listens for CustomEvent('typely:result', { detail: result })
 * where result = { dateISO, wpm, raw, acc, consistency, correctChars, typedLen,
 *                   mode, lang, difficulty, perSec[] }.
 * All DOM lookups are null-checked so the module never throws when markup is absent.
 * Supports both the planned button IDs (btn-clear-history / btn-export-csv) and the
 * IDs present in index.html (btn-history-clear / btn-history-export).
 */
(function () {
  'use strict';

  var RESULTS_KEY = 'typely-results';
  var BEST_KEY = 'typely-best';
  var MAX_RESULTS = 100;
  var LIST_LIMIT = 15;
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var CSV_HEADER = 'date,wpm,raw,acc,consistency,mode,lang,difficulty';
  var CHART_W = 600;
  var CHART_H = 200;

  /* ---------------- null-safe DOM helpers ---------------- */
  function $(id) {
    return typeof document !== 'undefined' ? document.getElementById(id) : null;
  }
  function pickAll(ids) {
    var out = [];
    ids.forEach(function (id) {
      var el = $(id);
      if (el && out.indexOf(el) === -1) out.push(el);
    });
    return out;
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  function isNum(n) {
    return typeof n === 'number' && isFinite(n);
  }
  function numOr(v, fb) {
    return isNum(v) ? v : fb;
  }
  function svgEl(tag, attrs) {
    var el = document.createElementNS(SVG_NS, tag);
    Object.keys(attrs).forEach(function (k) {
      el.setAttribute(k, String(attrs[k]));
    });
    return el;
  }
  function toast(msg) {
    try {
      var el = $('toast');
      if (!el) return;
      el.textContent = String(msg);
      if (el.classList) el.classList.add('show');
      window.clearTimeout(toast._t);
      toast._t = window.setTimeout(function () {
        try {
          if (el.classList) el.classList.remove('show');
        } catch (e) { /* ignore */ }
      }, 2600);
    } catch (e) { /* toast must never break the app */ }
  }
  function fmtDate(iso) {
    try {
      var d = new Date(iso);
      if (!isNaN(d.getTime())) return d.toLocaleString();
    } catch (e) { /* fall through */ }
    return String(iso || '');
  }

  /* ---------------- storage ---------------- */
  function loadResults() {
    try {
      var raw = window.localStorage.getItem(RESULTS_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      // Shape validation: keep entries with numeric wpm/acc, drop the rest.
      return parsed.filter(function (e) {
        return e && typeof e === 'object' && isNum(e.wpm) && isNum(e.acc);
      });
    } catch (e) {
      return []; // corrupt JSON -> start fresh, never throw
    }
  }
  function saveResults(all) {
    try {
      var capped = all.length > MAX_RESULTS ? all.slice(all.length - MAX_RESULTS) : all;
      window.localStorage.setItem(RESULTS_KEY, JSON.stringify(capped));
    } catch (e) { /* storage full/blocked -> ignore */ }
  }
  function loadStoredBest() {
    try {
      var v = parseFloat(window.localStorage.getItem(BEST_KEY));
      return isNum(v) ? v : 0;
    } catch (e) {
      return 0;
    }
  }
  function bumpBest(wpm) {
    try {
      if (isNum(wpm) && wpm > loadStoredBest()) {
        window.localStorage.setItem(BEST_KEY, String(wpm));
      }
    } catch (e) { /* ignore */ }
  }
  function getBest() {
    var best = loadStoredBest();
    loadResults().forEach(function (r) {
      if (r.wpm > best) best = r.wpm;
    });
    return best;
  }

  /* ---------------- result intake ---------------- */
  function onResultEvent(e) {
    var r = e && e.detail;
    if (!r || !isNum(r.wpm) || !isNum(r.acc)) return;
    var entry = {
      dateISO:
        typeof r.dateISO === 'string' && r.dateISO
          ? r.dateISO
          : new Date().toISOString(),
      wpm: r.wpm,
      raw: numOr(r.raw, r.wpm),
      acc: r.acc,
      consistency: numOr(r.consistency, 0),
      correctChars: numOr(r.correctChars, 0),
      typedLen: numOr(r.typedLen, 0),
      mode: typeof r.mode === 'string' ? r.mode : '',
      lang: typeof r.lang === 'string' ? r.lang : '',
      difficulty: typeof r.difficulty === 'string' ? r.difficulty : '',
      perSec: Array.isArray(r.perSec) ? r.perSec.filter(isNum).slice(0, 600) : []
    };
    var all = loadResults();
    all.push(entry);
    if (all.length > MAX_RESULTS) all = all.slice(all.length - MAX_RESULTS);
    saveResults(all);
    bumpBest(entry.wpm);
    renderAll();
  }

  /* ---------------- render: stats ---------------- */
  function renderStats(results) {
    var el = $('history-stats');
    if (!el) return;
    if (!results.length) {
      el.innerHTML = '<p class="muted">No results yet — finish a test to start your history.</p>';
      return;
    }
    var sumWpm = 0;
    var sumAcc = 0;
    results.forEach(function (r) {
      sumWpm += r.wpm;
      sumAcc += r.acc;
    });
    var avgWpm = sumWpm / results.length;
    var avgAcc = sumAcc / results.length;
    var last = results[results.length - 1];
    el.innerHTML =
      '<div class="hstat"><span class="hstat-label">Best</span>' +
      '<span class="hstat-value">' + Math.round(getBest()) + ' WPM</span></div>' +
      '<div class="hstat"><span class="hstat-label">Average</span>' +
      '<span class="hstat-value">' + Math.round(avgWpm) + ' WPM</span></div>' +
      '<div class="hstat"><span class="hstat-label">Last</span>' +
      '<span class="hstat-value">' + Math.round(last.wpm) + ' WPM</span></div>' +
      '<div class="hstat"><span class="hstat-label">Avg accuracy</span>' +
      '<span class="hstat-value">' + avgAcc.toFixed(1) + '%</span></div>' +
      '<div class="hstat"><span class="hstat-label">Tests</span>' +
      '<span class="hstat-value">' + results.length + '</span></div>';
  }

  /* ---------------- render: WPM line chart ---------------- */
  function renderChart(results) {
    var svg = $('graph-wpm');
    if (!svg) return;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    svg.setAttribute('viewBox', '0 0 ' + CHART_W + ' ' + CHART_H);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    if (!results.length) {
      var t = document.createElementNS(SVG_NS, 'text');
      t.setAttribute('x', String(CHART_W / 2));
      t.setAttribute('y', String(CHART_H / 2));
      t.setAttribute('text-anchor', 'middle');
      t.setAttribute('fill', 'currentColor');
      t.setAttribute('font-size', '14');
      t.textContent = 'No results yet — finish a test to see your graph.';
      svg.appendChild(t);
      return;
    }

    var wpms = results.map(function (r) {
      return r.wpm;
    });
    var max = Math.max.apply(null, wpms);
    var min = Math.min.apply(null, wpms);
    if (max === min) {
      max += 5;
      min = Math.max(0, min - 5);
    }
    var padL = 40;
    var padR = 14;
    var padT = 14;
    var padB = 26;
    var iw = CHART_W - padL - padR;
    var ih = CHART_H - padT - padB;
    function X(i) {
      if (results.length === 1) return padL + iw / 2;
      return padL + (iw * i) / (results.length - 1);
    }
    function Y(w) {
      return padT + ih - ((w - min) / (max - min)) * ih;
    }

    // Baseline + min/max gridlines with axis labels.
    [[max, padT], [min, padT + ih]].forEach(function (pair) {
      var val = pair[0];
      var y = pair[1];
      var grid = svgEl('line', {
        x1: padL,
        y1: y.toFixed(1),
        x2: CHART_W - padR,
        y2: y.toFixed(1),
        stroke: 'currentColor',
        'stroke-opacity': 0.25,
        'stroke-width': 1
      });
      svg.appendChild(grid);
      var label = svgEl('text', {
        x: padL - 5,
        y: (y + 4).toFixed(1),
        'text-anchor': 'end',
        fill: 'currentColor',
        'font-size': 11
      });
      label.textContent = String(Math.round(val));
      svg.appendChild(label);
    });

    // WPM line path.
    var d = results
      .map(function (r, i) {
        return (i === 0 ? 'M' : 'L') + X(i).toFixed(1) + ' ' + Y(r.wpm).toFixed(1);
      })
      .join(' ');
    svg.appendChild(
      svgEl('path', {
        d: d,
        fill: 'none',
        stroke: 'currentColor',
        'stroke-width': 2,
        'stroke-linejoin': 'round',
        'stroke-linecap': 'round'
      })
    );

    // One dot per test.
    var dotR = results.length > 40 ? 2 : 3.5;
    results.forEach(function (r, i) {
      svg.appendChild(
        svgEl('circle', {
          cx: X(i).toFixed(1),
          cy: Y(r.wpm).toFixed(1),
          r: dotR,
          fill: 'currentColor'
        })
      );
    });

    // X-axis labels: first / last test index.
    var first = svgEl('text', {
      x: padL,
      y: CHART_H - 8,
      'text-anchor': 'start',
      fill: 'currentColor',
      'font-size': 11
    });
    first.textContent = '1';
    svg.appendChild(first);
    if (results.length > 1) {
      var lastLbl = svgEl('text', {
        x: CHART_W - padR,
        y: CHART_H - 8,
        'text-anchor': 'end',
        fill: 'currentColor',
        'font-size': 11
      });
      lastLbl.textContent = String(results.length);
      svg.appendChild(lastLbl);
    }
  }

  /* ---------------- render: history list ---------------- */
  function sparklineSVG(perSec) {
    var pts = Array.isArray(perSec) ? perSec.filter(isNum) : [];
    if (pts.length < 2) return '<span class="spark-empty">—</span>';
    var w = 96;
    var h = 28;
    var max = Math.max.apply(null, pts);
    var min = Math.min.apply(null, pts);
    if (max === min) max = min + 1;
    var step = pts
      .map(function (v, i) {
        var x = pts.length === 1 ? w / 2 : (w * i) / (pts.length - 1);
        var y = h - 3 - ((v - min) / (max - min)) * (h - 6);
        return x.toFixed(1) + ',' + y.toFixed(1);
      })
      .join(' ');
    return (
      '<svg class="sparkline" viewBox="0 0 ' + w + ' ' + h + '" width="' + w +
      '" height="' + h + '" aria-hidden="true" focusable="false">' +
      '<polyline points="' + step + '" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>'
    );
  }

  function renderList(results) {
    var ul = $('history-list');
    if (!ul) return;
    ul.innerHTML = '';
    if (!results.length) return;
    var items = results
      .map(function (r, idx) {
        return { r: r, idx: idx };
      })
      .slice(-LIST_LIMIT)
      .reverse(); // newest first
    var html = items
      .map(function (item) {
        var r = item.r;
        var meta = [r.mode, r.lang, r.difficulty].filter(Boolean).join(' · ');
        return (
          '<li class="history-row">' +
          '<div class="history-main"><span class="history-wpm">' + Math.round(r.wpm) + ' WPM</span> ' +
          '<span class="history-acc">' + Number(r.acc).toFixed(1) + '%</span> ' +
          (meta ? '<span class="history-meta">' + esc(meta) + '</span>' : '') +
          '</div>' +
          '<div class="history-sub"><span class="history-date">' + esc(fmtDate(r.dateISO)) + '</span> ' +
          sparklineSVG(r.perSec) +
          ' <button type="button" class="btn btn-ghost btn-icon" data-del="' + item.idx +
          '" aria-label="Delete this result">×</button></div>' +
          '</li>'
        );
      })
      .join('');
    ul.innerHTML = html;
    Array.prototype.forEach.call(ul.querySelectorAll('button[data-del]'), function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(btn.getAttribute('data-del'), 10);
        var all = loadResults();
        if (!isNaN(idx) && idx >= 0 && idx < all.length) {
          all.splice(idx, 1);
          saveResults(all);
          renderAll();
          toast('Result deleted.');
        }
      });
    });
  }

  function renderAll() {
    var results = loadResults();
    renderStats(results);
    renderChart(results);
    renderList(results);
  }

  /* ---------------- buttons ---------------- */
  function onClear() {
    try {
      if (typeof window.confirm === 'function' && !window.confirm('Clear all test history?')) {
        return;
      }
      window.localStorage.removeItem(RESULTS_KEY);
      window.localStorage.removeItem(BEST_KEY);
      renderAll();
      toast('History cleared.');
    } catch (e) { /* ignore */ }
  }
  function csvCell(v) {
    if (v == null) return '';
    var s = String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function onExport() {
    try {
      var results = loadResults();
      var lines = [CSV_HEADER];
      results.forEach(function (r) {
        lines.push(
          [
            csvCell(r.dateISO),
            csvCell(r.wpm),
            csvCell(r.raw),
            csvCell(r.acc),
            csvCell(r.consistency),
            csvCell(r.mode),
            csvCell(r.lang),
            csvCell(r.difficulty)
          ].join(',')
        );
      });
      var blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'results.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.setTimeout(function () {
        try {
          URL.revokeObjectURL(url);
        } catch (e) { /* ignore */ }
      }, 1000);
      toast(results.length ? 'History exported to results.csv.' : 'Nothing to export yet.');
    } catch (e) {
      toast('Export failed in this browser.');
    }
  }
  function bindButtons() {
    pickAll(['btn-clear-history', 'btn-history-clear']).forEach(function (btn) {
      btn.addEventListener('click', onClear);
    });
    pickAll(['btn-export-csv', 'btn-history-export']).forEach(function (btn) {
      btn.addEventListener('click', onExport);
    });
  }

  /* ---------------- init ---------------- */
  window.TypelyHistory = {
    getAll: loadResults,
    getBest: getBest
  };
  window.addEventListener('typely:result', onResultEvent);
  bindButtons();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderAll);
  } else {
    renderAll();
  }
})();
