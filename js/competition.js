/* Typely — competition.js (PLAN.md section 8)
 * Local + simulated competition: seeded bots, live race bars, ghost replay
 * of your best per-second curve, and a localStorage leaderboard.
 * Real-time multiplayer is intentionally deferred (see multiplayer note).
 *
 * Zero dependencies. IIFE. All DOM lookups are null-checked so this file
 * never throws when index.html IDs or the engine are absent.
 *
 * Engine contract (assumed, all optional):
 *   window.Typely = {
 *     state: { target, typedLen, finished, difficulty? },
 *     newTest(), useCustomText?
 *   }
 * Events on document:
 *   typely:tick       detail { wpm, raw, acc, elapsed }
 *   typely:result     detail { wpm, acc, ... }
 *   typely:textchange (no guaranteed detail)
 * Index.html IDs (all optional): race-bars, btn-start-race, btn-ghost-race,
 *   leaderboard, race-countdown, toast, multiplayer-note
 */
(function () {
  'use strict';

  /* ---------- constants ---------- */

  var LEADERBOARD_KEY = 'typely-leaderboard';
  var RESULTS_KEY = 'typely-results';
  var BEST_KEY = 'typely-best';
  var SETTINGS_KEY = 'typely-settings';

  // 8 seeded bots, baseline spread ~25-95 wpm before difficulty multiplier.
  var BOTS = [
    { name: 'Turbo Tortoise', baseWpm: 25 },
    { name: 'Casual Cass', baseWpm: 35 },
    { name: 'Steady Sam', baseWpm: 45 },
    { name: 'Rookie Ray', baseWpm: 55 },
    { name: 'Swift Sia', baseWpm: 65 },
    { name: 'Blaze Bo', baseWpm: 75 },
    { name: 'Vortex Vic', baseWpm: 85 },
    { name: 'Ghost Prime', baseWpm: 95 }
  ];

  var DIFF_MULT = { easy: 0.9, medium: 1.0, hard: 1.1 };
  var BOT_TICK_MS = 500; // jitter + advance applied every 500ms
  var JITTER = 0.15; // ±15%
  var RACE_TIMEOUT_MS = 120000; // 120s safety timeout
  var COUNTDOWN_STEP_MS = 700;
  var FALLBACK_TARGET_LEN = 240; // used only when engine exposes no target
  var LEADERBOARD_STORE_MAX = 20; // persisted; render shows top 10

  /* ---------- race state ---------- */

  var racing = false; // true during countdown + active race (blocks overlap)
  var mode = null; // 'bots' | 'ghost' | null
  var racers = []; // [{ name, you, ghost, effWpm, dispWpm, progress, rowEl, fillEl, wpmEl, cum?, perSec? }]
  var targetLen = 0;
  var startTime = 0;
  var lastTick = null; // { wpm, acc, elapsed }
  var youResult = null; // { wpm, acc } from typely:result
  var botTimer = null;
  var safetyTimer = null;
  var toastTimer = null;
  var lastInsertedId = null; // dateISO of the leaderboard row just inserted
  var lastInsertedIsPb = false;

  /* ---------- tiny helpers ---------- */

  function $id(id) {
    try {
      return document.getElementById(id);
    } catch (e) {
      return null;
    }
  }

  function toNum(v, fb) {
    var n = Number(v);
    return isFinite(n) ? n : fb;
  }

  function clamp01(v) {
    if (!(v > 0)) return 0;
    if (v > 1) return 1;
    return v;
  }

  function shuffleCopy(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  function nowISO() {
    try {
      return new Date().toISOString();
    } catch (e) {
      return '1970-01-01T00:00:00.000Z';
    }
  }

  function shortDate(iso) {
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return String(iso).slice(0, 10);
      return d.toLocaleDateString();
    } catch (e) {
      return String(iso).slice(0, 10);
    }
  }

  function reducedMotion() {
    try {
      return (
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
      );
    } catch (e) {
      return false;
    }
  }

  /* ---------- engine access (all defensive) ---------- */

  function getTypely() {
    try {
      return typeof window !== 'undefined' ? window.Typely || null : null;
    } catch (e) {
      return null;
    }
  }

  function getTargetLen() {
    try {
      var T = getTypely();
      if (T && T.state && T.state.target != null) {
        var len = T.state.target.length;
        if (typeof len === 'number' && len > 0) return Math.floor(len);
      }
    } catch (e) {
      /* fall through to 0 */
    }
    return 0;
  }

  function getYouProgress() {
    try {
      var T = getTypely();
      if (T && T.state) {
        var total = getTargetLen();
        var typed = toNum(T.state.typedLen, 0);
        if (total > 0 && typed >= 0) return clamp01(typed / total);
      }
    } catch (e) {
      /* ignore */
    }
    return 0;
  }

  function getDifficulty() {
    // 1) engine state, 2) persisted settings, 3) DOM, else medium.
    try {
      var T = getTypely();
      if (T && T.state && typeof T.state.difficulty === 'string') {
        var d0 = T.state.difficulty.toLowerCase();
        if (DIFF_MULT[d0] != null) return d0;
      }
    } catch (e) {
      /* ignore */
    }
    try {
      var raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        var s = JSON.parse(raw);
        if (s && typeof s.difficulty === 'string') {
          var d1 = s.difficulty.toLowerCase();
          if (DIFF_MULT[d1] != null) return d1;
        }
      }
    } catch (e) {
      /* ignore */
    }
    try {
      var el =
        document.querySelector('[name="difficulty"]:checked') ||
        document.querySelector('[data-difficulty].active') ||
        document.querySelector('.difficulty.active') ||
        document.querySelector('#sel-diff') ||
        document.querySelector('#difficulty') ||
        document.querySelector('#difficulty-select');
      if (el) {
        var v = '';
        try {
          v = String(el.value || (el.dataset && el.dataset.difficulty) || el.getAttribute('data-difficulty') || '').toLowerCase();
        } catch (err) {
          v = '';
        }
        if (DIFF_MULT[v] != null) return v;
      }
    } catch (e) {
      /* ignore */
    }
    return 'medium';
  }

  /* ---------- storage: leaderboard ---------- */

  function normalizeEntry(e) {
    if (!e || typeof e !== 'object') return null;
    var wpm = toNum(e.wpm, NaN);
    var acc = toNum(e.acc, NaN);
    if (typeof e.name !== 'string' || e.name === '' || !isFinite(wpm) || !isFinite(acc)) return null;
    var dateISO = typeof e.dateISO === 'string' && !isNaN(new Date(e.dateISO).getTime()) ? e.dateISO : nowISO();
    return {
      name: e.name.slice(0, 40),
      wpm: Math.max(0, Math.round(wpm)),
      acc: Math.min(100, Math.max(0, Math.round(acc * 10) / 10)),
      dateISO: dateISO,
      you: e.you === true
    };
  }

  function seedLeaderboard() {
    var now = Date.now();
    var accs = [93, 95, 91, 96, 92, 94, 90, 97];
    return BOTS.map(function (b, i) {
      return {
        name: b.name,
        wpm: b.baseWpm,
        acc: accs[i % accs.length],
        dateISO: new Date(now - (BOTS.length - i) * 86400000).toISOString(),
        you: false
      };
    }).sort(function (a, b) {
      return b.wpm - a.wpm;
    });
  }

  function loadLeaderboard() {
    var raw = null;
    try {
      raw = localStorage.getItem(LEADERBOARD_KEY);
    } catch (e) {
      return seedLeaderboard();
    }
    if (raw === null) {
      // First run: seed so the table is never empty.
      var seed = seedLeaderboard();
      try {
        localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(seed));
      } catch (e) {
        /* storage may be unavailable; still return the seed */
      }
      return seed;
    }
    try {
      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) throw new Error('leaderboard shape');
      var clean = [];
      for (var i = 0; i < parsed.length; i++) {
        var n = normalizeEntry(parsed[i]);
        if (n) clean.push(n);
      }
      return clean;
    } catch (e) {
      // Corrupt JSON: self-heal with a fresh seed.
      var fresh = seedLeaderboard();
      try {
        localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(fresh));
      } catch (err) {
        /* ignore */
      }
      return fresh;
    }
  }

  function saveLeaderboard(rows) {
    try {
      localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(rows.slice(0, LEADERBOARD_STORE_MAX)));
    } catch (e) {
      /* private mode etc.: leaderboard simply won't persist */
    }
  }

  function readPrevBestWpm() {
    // Compare against typely-best BEFORE inserting (engine/history owns this key).
    try {
      var raw = localStorage.getItem(BEST_KEY);
      if (raw === null) return null;
      var p = JSON.parse(raw);
      if (typeof p === 'number' && isFinite(p)) return p;
      if (p && typeof p === 'object' && isFinite(toNum(p.wpm, NaN))) return toNum(p.wpm, 0);
      return null;
    } catch (e) {
      return null;
    }
  }

  /* ---------- storage: ghost curve ---------- */

  function loadGhostCurve() {
    // Prefer the best typely-results entry that carries a perSec curve,
    // fall back to typely-best when it carries one. Null = no history.
    try {
      var raw = localStorage.getItem(RESULTS_KEY);
      if (raw) {
        var arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          var best = null;
          for (var i = 0; i < arr.length; i++) {
            var r = arr[i];
            if (!r || !Array.isArray(r.perSec) || r.perSec.length === 0) continue;
            var w = toNum(r.wpm, NaN);
            if (!isFinite(w)) continue;
            if (!best || w > best.wpm) {
              best = {
                wpm: w,
                acc: toNum(r.acc, 0),
                perSec: r.perSec.filter(function (v) {
                  return isFinite(toNum(v, NaN)) && toNum(v, 0) >= 0;
                })
              };
            }
          }
          if (best && best.perSec.length > 0) return best;
        }
      }
    } catch (e) {
      /* fall through to typely-best */
    }
    try {
      var braw = localStorage.getItem(BEST_KEY);
      if (braw) {
        var b = JSON.parse(braw);
        if (b && typeof b === 'object' && Array.isArray(b.perSec) && b.perSec.length > 0) {
          var bw = toNum(b.wpm, NaN);
          if (isFinite(bw)) {
            return {
              wpm: bw,
              acc: toNum(b.acc, 0),
              perSec: b.perSec.filter(function (v) {
                return isFinite(toNum(v, NaN)) && toNum(v, 0) >= 0;
              })
            };
          }
        }
      }
    } catch (e) {
      /* ignore */
    }
    return null;
  }

  /* ---------- toast + multiplayer note (never throw) ---------- */

  function toast(msg) {
    try {
      var el = $id('toast');
      if (!el) return;
      el.textContent = String(msg);
      el.setAttribute('role', 'status');
      try {
        el.classList.add('show');
      } catch (e) {
        /* ignore */
      }
      if (toastTimer) {
        try {
          clearTimeout(toastTimer);
        } catch (e) {
          /* ignore */
        }
      }
      toastTimer = setTimeout(function () {
        try {
          el.classList.remove('show');
        } catch (e) {
          /* ignore */
        }
        toastTimer = null;
      }, 4000);
    } catch (e) {
      /* toast is best-effort */
    }
  }

  function ensureMultiplayerNote() {
    // Deferred-multiplayer note: skip silently when the element is absent.
    try {
      var el = $id('multiplayer-note');
      if (!el || el.dataset.done === '1') return;
      el.textContent =
        'Online multiplayer is deferred in v1 — races run against local bots and your ghost. ' +
        'A future realtime layer (WebSocket/Firebase) can plug in here without touching the engine.';
      el.dataset.done = '1';
    } catch (e) {
      /* never throw */
    }
  }

  /* ---------- race bars UI ---------- */

  function clearBars() {
    try {
      var bars = $id('race-bars');
      if (!bars) return;
      while (bars.firstChild) bars.removeChild(bars.firstChild);
    } catch (e) {
      /* ignore */
    }
  }

  function renderBars() {
    var bars = $id('race-bars');
    if (!bars) return;
    clearBars();
    for (var i = 0; i < racers.length; i++) {
      (function (r) {
        var row, name, bar, fill, wpm;
        try {
          row = document.createElement('div');
          row.className = 'race-row' + (r.you ? ' you' : '') + (r.ghost ? ' ghost' : '');
          row.setAttribute('data-name', r.name);

          name = document.createElement('span');
          name.className = 'race-name';
          name.textContent = r.name;

          bar = document.createElement('div');
          bar.className = 'bar';
          fill = document.createElement('div');
          fill.className = 'fill';
          fill.style.width = Math.round(clamp01(r.progress) * 100) + '%';
          bar.appendChild(fill);

          wpm = document.createElement('span');
          wpm.className = 'race-wpm';
          wpm.textContent = Math.round(toNum(r.dispWpm, 0)) + ' wpm';

          row.appendChild(name);
          row.appendChild(bar);
          row.appendChild(wpm);
          bars.appendChild(row);

          r.rowEl = row;
          r.fillEl = fill;
          r.wpmEl = wpm;
        } catch (e) {
          /* one bad row must not kill the race */
        }
      })(racers[i]);
    }
  }

  function updateBars() {
    for (var i = 0; i < racers.length; i++) {
      (function (r) {
        try {
          if (r.fillEl) r.fillEl.style.width = Math.round(clamp01(r.progress) * 100) + '%';
          if (r.wpmEl) r.wpmEl.textContent = Math.round(toNum(r.dispWpm, 0)) + ' wpm';
        } catch (e) {
          /* ignore */
        }
      })(racers[i]);
    }
  }

  function showFinalOrder(order) {
    try {
      var bars = $id('race-bars');
      if (bars) {
        // Re-order rows to final rank.
        for (var i = 0; i < order.length; i++) {
          if (order[i].rowEl) bars.appendChild(order[i].rowEl);
        }
        var div = document.createElement('div');
        div.className = 'race-result';
        var parts = order.map(function (r, idx) {
          return idx + 1 + '. ' + r.name + ' (' + Math.round(toNum(r.dispWpm, 0)) + ' wpm)';
        });
        div.textContent = 'Final order: ' + parts.join(' · ');
        bars.appendChild(div);
      }
    } catch (e) {
      /* ignore */
    }
    toast('🏁 ' + order.map(function (r, idx) {
      return idx + 1 + '. ' + r.name;
    }).join(' · ') + (lastInsertedIsPb ? ' — new personal best!' : ''));
  }

  /* ---------- leaderboard render ---------- */

  function renderLeaderboard() {
    var el = $id('leaderboard');
    if (!el) return;
    var rows = loadLeaderboard()
      .slice()
      .sort(function (a, b) {
        return b.wpm - a.wpm;
      })
      .slice(0, 10);
    try {
      // index.html uses <table id="leaderboard"><thead>…<tbody></tbody></table>:
      // fill the existing tbody instead of nesting a table inside a table.
      var tag = '';
      try { tag = String(el.tagName || '').toUpperCase(); } catch (e) { tag = ''; }
      if (tag === 'TABLE') {
        var tbody = null;
        try { tbody = el.querySelector('tbody'); } catch (e) { tbody = null; }
        if (!tbody) {
          tbody = document.createElement('tbody');
          el.appendChild(tbody);
        }
        while (tbody.firstChild) tbody.removeChild(tbody.firstChild);
        rows.forEach(function (r, idx) {
          var tr = document.createElement('tr');
          if (r.you) {
            try { tr.classList.add('you'); } catch (e) { /* ignore */ }
          }
          var rank = document.createElement('td');
          rank.textContent = String(idx + 1);
          var name = document.createElement('td');
          name.textContent = r.name;
          if (r.you && r.dateISO === lastInsertedId && lastInsertedIsPb) {
            var badge = document.createElement('span');
            badge.className = 'pb-badge';
            badge.textContent = ' PB';
            name.appendChild(badge);
          }
          var wpm = document.createElement('td');
          wpm.textContent = String(r.wpm);
          var acc = document.createElement('td');
          acc.textContent = String(r.acc) + '%';
          var date = document.createElement('td');
          date.textContent = shortDate(r.dateISO);
          tr.appendChild(rank);
          tr.appendChild(name);
          tr.appendChild(wpm);
          tr.appendChild(acc);
          tr.appendChild(date);
          tbody.appendChild(tr);
        });
        return;
      }
      while (el.firstChild) el.removeChild(el.firstChild);
      var table = document.createElement('table');
      table.className = 'leaderboard-table';
      var thead = document.createElement('thead');
      var hr = document.createElement('tr');
      ['Rank', 'Name', 'WPM', 'Acc', 'Date'].forEach(function (h) {
        var th = document.createElement('th');
        th.textContent = h;
        hr.appendChild(th);
      });
      thead.appendChild(hr);
      table.appendChild(thead);
      var tbody = document.createElement('tbody');
      rows.forEach(function (r, idx) {
        var tr = document.createElement('tr');
        if (r.you) {
          try {
            tr.classList.add('you');
          } catch (e) {
            /* ignore */
          }
        }
        var rank = document.createElement('td');
        rank.textContent = String(idx + 1);
        var name = document.createElement('td');
        name.textContent = r.name;
        if (r.you && r.dateISO === lastInsertedId && lastInsertedIsPb) {
          var badge = document.createElement('span');
          badge.className = 'pb-badge';
          badge.textContent = ' PB';
          name.appendChild(badge);
        }
        var wpm = document.createElement('td');
        wpm.textContent = String(r.wpm);
        var acc = document.createElement('td');
        acc.textContent = String(r.acc) + '%';
        var date = document.createElement('td');
        date.textContent = shortDate(r.dateISO);
        tr.appendChild(rank);
        tr.appendChild(name);
        tr.appendChild(wpm);
        tr.appendChild(acc);
        tr.appendChild(date);
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      el.appendChild(table);
    } catch (e) {
      /* render is best-effort */
    }
  }

  /* ---------- finish ---------- */

  function yourScore() {
    var wpm = 0;
    var acc = 0;
    if (youResult) {
      wpm = toNum(youResult.wpm, 0);
      acc = toNum(youResult.acc, 0);
    } else if (lastTick) {
      wpm = toNum(lastTick.wpm, 0);
      acc = toNum(lastTick.acc, 0);
    }
    return { wpm: Math.max(0, Math.round(wpm)), acc: Math.min(100, Math.max(0, acc)) };
  }

  function finishRace() {
    if (!racing) return;
    // Clear all timers first so a finished race can never advance again.
    try {
      if (botTimer) clearInterval(botTimer);
    } catch (e) {
      /* ignore */
    }
    try {
      if (safetyTimer) clearTimeout(safetyTimer);
    } catch (e) {
      /* ignore */
    }
    botTimer = null;
    safetyTimer = null;

    var score = yourScore();
    var prevBest = readPrevBestWpm();
    lastInsertedIsPb = score.wpm > 0 && (prevBest === null || score.wpm > prevBest);

    var entry = { name: 'You', wpm: score.wpm, acc: score.acc, dateISO: nowISO(), you: true };
    lastInsertedId = entry.dateISO;
    var rows = loadLeaderboard();
    rows.push(entry);
    rows.sort(function (a, b) {
      return b.wpm - a.wpm;
    });
    saveLeaderboard(rows);
    renderLeaderboard();

    // Mark your live row finished and label it with the final score.
    for (var i = 0; i < racers.length; i++) {
      if (racers[i].you) {
        racers[i].progress = Math.max(racers[i].progress, youResult ? 1 : racers[i].progress);
        racers[i].dispWpm = score.wpm;
      }
    }
    updateBars();

    var order = racers.slice().sort(function (a, b) {
      return b.progress - a.progress;
    });
    showFinalOrder(order);

    racing = false;
    mode = null;
  }

  /* ---------- per-tick advancement ---------- */

  function botTick() {
    if (!racing || mode !== 'bots') return;
    var dt = BOT_TICK_MS / 1000; // seconds
    var done = true;
    for (var i = 0; i < racers.length; i++) {
      (function (r) {
        if (r.you || r.ghost) return;
        // chars = (wpm * 5 / 60) * dt, ±15% jitter, converted to a fraction.
        var jitter = 1 + (Math.random() * 2 - 1) * JITTER;
        r.dispWpm = r.effWpm * jitter;
        if (targetLen > 0) {
          r.progress = clamp01(r.progress + ((r.effWpm * 5) / 60) * dt * jitter / targetLen);
        }
        if (r.progress < 1) done = false;
      })(racers[i]);
    }
    updateBars();
    if (done) finishRace(); // all bots reached 100%
  }

  function ghostTick() {
    if (!racing || mode !== 'ghost') return;
    var elapsed = (Date.now() - startTime) / 1000;
    for (var i = 0; i < racers.length; i++) {
      (function (r) {
        if (!r.ghost || !r.cum) return;
        // Replay the cumulative per-second curve over wall-clock time.
        var idx = Math.floor(elapsed);
        var frac = elapsed - Math.floor(elapsed);
        var lo = r.cum[Math.min(idx, r.cum.length - 1)];
        var hi = r.cum[Math.min(idx + 1, r.cum.length - 1)];
        var chars = lo + (hi - lo) * frac;
        if (targetLen > 0) r.progress = clamp01(chars / targetLen);
        var ps = r.perSec[Math.min(idx, r.perSec.length - 1)];
        r.dispWpm = toNum(ps, r.effWpm);
        if (r.progress >= 1) r.done = true;
      })(racers[i]);
    }
    updateBars();
  }

  /* ---------- countdown + start ---------- */

  function runCountdown(done) {
    var cd = $id('race-countdown');
    if (!cd || reducedMotion()) {
      // Skipped animation: clear any stale number and start immediately.
      try {
        if (cd) cd.textContent = '';
      } catch (e) {
        /* ignore */
      }
      done();
      return;
    }
    var steps = ['3', '2', '1', 'Go!'];
    var i = 0;
    (function next() {
      if (i < steps.length) {
        try {
          cd.textContent = steps[i];
        } catch (e) {
          /* ignore */
        }
        i++;
        setTimeout(next, COUNTDOWN_STEP_MS);
      } else {
        try {
          cd.textContent = '';
        } catch (e) {
          /* ignore */
        }
        done();
      }
    })();
  }

  function armSafety() {
    try {
      if (safetyTimer) clearTimeout(safetyTimer);
    } catch (e) {
      /* ignore */
    }
    safetyTimer = setTimeout(function () {
      finishRace(); // 120s timeout
    }, RACE_TIMEOUT_MS);
  }

  function startBotRace() {
    if (racing) return; // no overlap
    racing = true;
    mode = 'bots';
    runCountdown(function () {
      try {
        var T = getTypely();
        if (T && typeof T.newTest === 'function') {
          try {
            T.newTest();
          } catch (e) {
            /* a failing engine reset must not kill the race */
          }
        }
        targetLen = getTargetLen() || FALLBACK_TARGET_LEN;
        var mult = DIFF_MULT[getDifficulty()] || 1;
        var picked = shuffleCopy(BOTS).slice(0, 3);
        racers = [
          { name: 'You', you: true, ghost: false, effWpm: 0, dispWpm: 0, progress: getYouProgress(), rowEl: null, fillEl: null, wpmEl: null }
        ];
        picked.forEach(function (b) {
          var eff = b.baseWpm * mult;
          racers.push({
            name: b.name,
            you: false,
            ghost: false,
            effWpm: eff,
            dispWpm: eff,
            progress: 0,
            rowEl: null,
            fillEl: null,
            wpmEl: null
          });
        });
        lastTick = null;
        youResult = null;
        startTime = Date.now();
        renderBars();
        try {
          if (botTimer) clearInterval(botTimer);
        } catch (e) {
          /* ignore */
        }
        botTimer = setInterval(botTick, BOT_TICK_MS);
        armSafety();
      } catch (e) {
        racing = false;
        mode = null;
        toast('Could not start the race. Please try again.');
      }
    });
  }

  function startGhostRace() {
    if (racing) return; // no overlap
    var curve = loadGhostCurve();
    if (!curve) {
      toast('No history yet — finish a typing test first to unlock ghost mode.');
      return;
    }
    racing = true;
    mode = 'ghost';
    runCountdown(function () {
      try {
        var T = getTypely();
        if (T && typeof T.newTest === 'function') {
          try {
            T.newTest();
          } catch (e) {
            /* ignore */
          }
        }
        targetLen = getTargetLen() || FALLBACK_TARGET_LEN;
        // Cumulative chars: perSec entries are WPM samples → chars/sec = wpm*5/60.
        var cum = [0];
        for (var i = 0; i < curve.perSec.length; i++) {
          cum.push(cum[i] + (toNum(curve.perSec[i], 0) * 5) / 60);
        }
        racers = [
          { name: 'You', you: true, ghost: false, effWpm: 0, dispWpm: 0, progress: getYouProgress(), rowEl: null, fillEl: null, wpmEl: null },
          {
            name: 'Ghost (PB ' + Math.round(curve.wpm) + ')',
            you: false,
            ghost: true,
            effWpm: curve.wpm,
            dispWpm: curve.wpm,
            progress: 0,
            perSec: curve.perSec,
            cum: cum,
            done: false,
            rowEl: null,
            fillEl: null,
            wpmEl: null
          }
        ];
        lastTick = null;
        youResult = null;
        startTime = Date.now();
        renderBars();
        try {
          if (botTimer) clearInterval(botTimer);
        } catch (e) {
          /* ignore */
        }
        botTimer = setInterval(ghostTick, BOT_TICK_MS);
        armSafety();
      } catch (e) {
        racing = false;
        mode = null;
        toast('Could not start the ghost race. Please try again.');
      }
    });
  }

  /* ---------- engine event listeners ---------- */

  function onTick(ev) {
    if (!racing) return;
    try {
      var d = (ev && ev.detail) || {};
      lastTick = { wpm: toNum(d.wpm, 0), acc: toNum(d.acc, 0), elapsed: toNum(d.elapsed, 0) };
      for (var i = 0; i < racers.length; i++) {
        if (racers[i].you) {
          racers[i].progress = getYouProgress();
          racers[i].dispWpm = lastTick.wpm;
        }
      }
      updateBars();
    } catch (e) {
      /* a bad tick must never break the race */
    }
  }

  function onResult(ev) {
    if (!racing) return;
    try {
      var d = (ev && ev.detail) || {};
      youResult = { wpm: toNum(d.wpm, 0), acc: toNum(d.acc, 0) };
    } catch (e) {
      youResult = { wpm: 0, acc: 0 };
    }
    finishRace(); // you finished → race over
  }

  function onTextChange() {
    // A new target mid-race (e.g. engine reset): adopt the new length.
    // Progress is stored as a fraction so rows stay valid.
    if (!racing) return;
    try {
      var len = getTargetLen();
      if (len > 0) targetLen = len;
    } catch (e) {
      /* ignore */
    }
  }

  /* ---------- init ---------- */

  function init() {
    try {
      var b1 = $id('btn-start-race') || $id('btn-race-start');
      if (b1) b1.addEventListener('click', startBotRace);
      var b2 = $id('btn-ghost-race') || $id('btn-ghost');
      if (b2) b2.addEventListener('click', startGhostRace);
    } catch (e) {
      /* buttons are optional */
    }
    try {
      document.addEventListener('typely:tick', onTick);
      document.addEventListener('typely:result', onResult);
      document.addEventListener('typely:textchange', onTextChange);
    } catch (e) {
      /* ignore */
    }
    try {
      renderLeaderboard();
    } catch (e) {
      /* ignore */
    }
    ensureMultiplayerNote();
  }

  try {
    if (typeof document !== 'undefined') {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
      } else {
        init();
      }
    }
  } catch (e) {
    /* never throw at load */
  }

  // Read-only debug handle (does not affect the engine).
  try {
    if (typeof window !== 'undefined') {
      window.TypelyCompetition = {
        bots: BOTS,
        leaderboardKey: LEADERBOARD_KEY,
        isRacing: function () {
          return racing;
        }
      };
    }
  } catch (e) {
    /* ignore */
  }
})();
