(function () {
  'use strict';

  var CONTAINER_ID = 'virtual-keyboard';
  var TOGGLE_ID = 'kb-toggle';
  var SEL_LANG_ID = 'sel-lang';
  var HINT_TOGGLE_ID = 'toggle-hint';
  var SETTINGS_KEY = 'typely-settings';

  var container = null;
  var currentLang = null;

  /* ------------------------------------------------------------------ */
  /* Layout maps: array of rows, each row array of { label, code?, w? }. */
  /* code defaults to label. Specials: Shift w:1.5, Backspace w:2,      */
  /* Space w:6. Labels for Arabic are single chars (no joining issues). */
  /* ------------------------------------------------------------------ */

  // EN — QWERTY: 3 letter rows + space row.
  var QWERTY = [
    [
      { label: 'q' }, { label: 'w' }, { label: 'e' }, { label: 'r' },
      { label: 't' }, { label: 'y' }, { label: 'u' }, { label: 'i' },
      { label: 'o' }, { label: 'p' },
      { label: '\u232B', code: 'Backspace', w: 2 }
    ],
    [
      { label: 'a' }, { label: 's' }, { label: 'd' }, { label: 'f' },
      { label: 'g' }, { label: 'h' }, { label: 'j' }, { label: 'k' },
      { label: 'l' }
    ],
    [
      { label: 'Shift', code: 'Shift', w: 1.5 },
      { label: 'z' }, { label: 'x' }, { label: 'c' }, { label: 'v' },
      { label: 'b' }, { label: 'n' }, { label: 'm' }
    ],
    [
      { label: 'Space', code: 'Space', w: 6 }
    ]
  ];

  // FR — AZERTY: a/z and q/w rows swapped vs QWERTY, m moved, accents.
  var AZERTY = [
    [
      { label: 'a' }, { label: 'z' }, { label: 'e' }, { label: 'r' },
      { label: 't' }, { label: 'y' }, { label: 'u' }, { label: 'i' },
      { label: 'o' }, { label: 'p' },
      { label: '\u232B', code: 'Backspace', w: 2 }
    ],
    [
      { label: 'q' }, { label: 's' }, { label: 'd' }, { label: 'f' },
      { label: 'g' }, { label: 'h' }, { label: 'j' }, { label: 'k' },
      { label: 'l' }, { label: 'm' }, { label: '\u00F9' }
    ],
    [
      { label: 'Shift', code: 'Shift', w: 1.5 },
      { label: 'w' }, { label: 'x' }, { label: 'c' }, { label: 'v' },
      { label: 'b' }, { label: 'n' },
      { label: '\u00E9' }, { label: '\u00E8' },
      { label: '\u00E7' }, { label: '\u00E0' }
    ],
    [
      { label: 'Space', code: 'Space', w: 6 }
    ]
  ];

  // AR — Arabic 101 (simplified, single-char labels join natively).
  var ARABIC = [
    [
      { label: '\u0636' }, { label: '\u0635' }, { label: '\u062B' },
      { label: '\u0642' }, { label: '\u0641' }, { label: '\u063A' },
      { label: '\u0639' }, { label: '\u0647' }, { label: '\u062E' },
      { label: '\u062D' }, { label: '\u062C' }, { label: '\u062F' },
      { label: '\u232B', code: 'Backspace', w: 2 }
    ],
    [
      { label: '\u0634' }, { label: '\u0633' }, { label: '\u064A' },
      { label: '\u0628' }, { label: '\u0644' }, { label: '\u0627' },
      { label: '\u062A' }, { label: '\u0646' }, { label: '\u0645' },
      { label: '\u0643' }, { label: '\u0637' }
    ],
    [
      { label: 'Shift', code: 'Shift', w: 1.5 },
      { label: '\u0626' }, { label: '\u0621' }, { label: '\u0624' },
      { label: '\u0631' }, { label: '\u0649' }, { label: '\u0629' },
      { label: '\u0648' }, { label: '\u0632' }, { label: '\u0638' },
      { label: '\u0630' }
    ],
    [
      { label: 'Space', code: 'Space', w: 6 }
    ]
  ];

  function layoutFor(lang) {
    var l = (lang == null ? '' : String(lang)).toLowerCase().trim();
    if (l === 'fr' || l === 'french' || l === 'francais' || l === 'fran\u00E7ais') return AZERTY;
    if (l === 'ar' || l === 'arabic' || l === 'arabe' || l.indexOf('ar-') === 0) return ARABIC;
    return QWERTY;
  }

  function normalizeLogical(raw) {
    if (raw == null) return '';
    var s = String(raw);
    if (s === ' ') return 'space';
    if (s === 'Spacebar') return 'space';
    return s.toLowerCase();
  }

  function keyCodeOf(def) {
    if (def && def.code != null && def.code !== '') return String(def.code);
    if (def && def.label != null) return String(def.label);
    return '';
  }

  function findKeyEls(raw) {
    if (!container || raw == null) return [];
    var want = normalizeLogical(raw);
    if (!want) return [];
    var out = [];
    var nodes = null;
    try {
      nodes = container.querySelectorAll('.key');
    } catch (_e) {
      return [];
    }
    if (!nodes) return [];
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var dk = null;
      try {
        dk = el.getAttribute('data-key');
      } catch (_e2) {
        dk = null;
      }
      if (dk != null && normalizeLogical(dk) === want) out.push(el);
    }
    return out;
  }

  function findKeyEl(raw) {
    var els = findKeyEls(raw);
    return els.length ? els[0] : null;
  }

  function clearActive() {
    if (!container) return;
    var actives = null;
    try {
      actives = container.querySelectorAll('.key.active');
    } catch (_e) {
      return;
    }
    for (var i = 0; i < actives.length; i++) {
      try {
        actives[i].classList.remove('active');
      } catch (_e2) { /* noop */ }
    }
  }

  function clearHint() {
    if (!container) return;
    var hints = null;
    try {
      hints = container.querySelectorAll('.key.hint');
    } catch (_e) {
      return;
    }
    for (var i = 0; i < hints.length; i++) {
      try {
        hints[i].classList.remove('hint');
      } catch (_e2) { /* noop */ }
    }
  }

  function isHintEnabled() {
    // Default ON. Disabled only when typely-settings.hint === false.
    // A present #toggle-hint checkbox also gates it (unchecked = off).
    try {
      var toggle = document.getElementById(HINT_TOGGLE_ID);
      if (toggle && typeof toggle.checked === 'boolean' && toggle.type === 'checkbox') {
        return toggle.checked;
      }
    } catch (_e) { /* fall through to storage */ }
    try {
      var raw = window.localStorage.getItem(SETTINGS_KEY);
      if (!raw) return true;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return true;
      return parsed.hint !== false;
    } catch (_e2) {
      return true;
    }
  }

  function readEngineState() {
    try {
      if (typeof window === 'undefined') return null;
      var t = window.Typely;
      if (!t || typeof t !== 'object') return null;
      var st = t.state;
      if (!st || typeof st !== 'object') return null;
      return st;
    } catch (_e) {
      return null;
    }
  }

  function nextExpectedChar() {
    var st = readEngineState();
    if (!st) return null;
    var target = null;
    if (typeof st.target === 'string') target = st.target;
    else if (typeof st.targetText === 'string') target = st.targetText;
    else if (typeof st.text === 'string') target = st.text;
    else if (Array.isArray(st.target)) target = st.target.join('');
    if (typeof target !== 'string' || !target.length) return null;
    var len = st.typedLen;
    if (typeof len !== 'number' || len < 0) {
      if (typeof st.position === 'number') len = st.position;
      else if (typeof st.index === 'number') len = st.index;
      else if (typeof st.typedLength === 'number') len = st.typedLength;
      else return null;
    }
    if (len < 0 || len >= target.length) return null;
    return target.charAt(len);
  }

  function updateHint() {
    if (!container) return;
    clearHint();
    try {
      if (!isHintEnabled()) return;
    } catch (_e) {
      return;
    }
    var next = null;
    try {
      next = nextExpectedChar();
    } catch (_e2) {
      return;
    }
    if (next == null || next === '') return;
    var el = null;
    try {
      el = findKeyEl(next);
    } catch (_e3) {
      return;
    }
    if (el) {
      try {
        el.classList.add('hint');
      } catch (_e4) { /* noop */ }
    }
  }

  function getStoredLang() {
    try {
      var raw = window.localStorage.getItem(SETTINGS_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (parsed && typeof parsed.lang === 'string' && parsed.lang) return parsed.lang;
      return null;
    } catch (_e) {
      return null;
    }
  }

  function getSelLang() {
    try {
      var sel = document.getElementById(SEL_LANG_ID);
      if (sel && typeof sel.value === 'string' && sel.value) return sel.value;
    } catch (_e) { /* noop */ }
    return null;
  }

  function getEngineLang() {
    var st = readEngineState();
    if (st && typeof st.lang === 'string' && st.lang) return st.lang;
    return null;
  }

  function detectLang() {
    return getEngineLang() || getSelLang() || getStoredLang() || 'en';
  }

  function renderLayout(lang) {
    if (!container) {
      try {
        container = document.getElementById(CONTAINER_ID);
      } catch (_e) {
        container = null;
      }
      if (!container) return;
    }
    var resolved = (lang != null && lang !== '') ? lang : detectLang();
    var norm = (resolved == null ? 'en' : String(resolved)).toLowerCase().trim();
    if (norm === currentLang && container.childNodes.length > 0) {
      // Same language and already rendered: just refresh the hint.
      updateHint();
      return;
    }
    currentLang = norm;
    var layout = layoutFor(norm);
    try {
      while (container.firstChild) container.removeChild(container.firstChild);
    } catch (_e) {
      try {
        container.innerHTML = '';
      } catch (_e2) { return; }
    }
    for (var r = 0; r < layout.length; r++) {
      var row = layout[r];
      if (!Array.isArray(row)) continue;
      var rowEl = null;
      try {
        rowEl = document.createElement('div');
      } catch (_e3) {
        continue;
      }
      rowEl.className = 'kb-row';
      for (var k = 0; k < row.length; k++) {
        var def = row[k];
        if (!def || typeof def !== 'object') continue;
        var label = def.label != null ? String(def.label) : '';
        if (!label) continue;
        var code = keyCodeOf(def);
        if (!code) code = label;
        var btn = null;
        try {
          btn = document.createElement('button');
        } catch (_e4) {
          continue;
        }
        btn.type = 'button';
        btn.className = 'key';
        try {
          btn.tabIndex = -1;
        } catch (_e5) { /* noop */ }
        try {
          btn.setAttribute('data-key', code);
          btn.setAttribute('tabindex', '-1');
          btn.setAttribute('aria-label', code === 'Space' ? 'Space' : label);
        } catch (_e6) { /* noop */ }
        var w = Number(def.w);
        if (w && isFinite(w) && w !== 1) {
          try {
            btn.style.flex = w + ' 1 0';
            btn.classList.add(w >= 6 ? 'key-space' : 'key-wide');
          } catch (_e7) { /* noop */ }
        }
        try {
          btn.textContent = label;
        } catch (_e8) { /* noop */ }
        try {
          rowEl.appendChild(btn);
        } catch (_e9) { /* noop */ }
      }
      try {
        container.appendChild(rowEl);
      } catch (_e10) { /* noop */ }
    }
    updateHint();
  }

  function ensureCollapseToggle() {
    var c = null;
    try {
      c = document.getElementById(CONTAINER_ID);
    } catch (_e) {
      return;
    }
    if (!c) return;
    container = container || c;
    var btn = null;
    try {
      btn = document.getElementById(TOGGLE_ID);
    } catch (_e2) {
      btn = null;
    }
    if (!btn) {
      try {
        btn = document.createElement('button');
        btn.type = 'button';
        btn.id = TOGGLE_ID;
        btn.textContent = '\u2328 Keyboard';
        btn.setAttribute('aria-expanded', 'true');
        btn.setAttribute('aria-controls', CONTAINER_ID);
        if (c.parentNode) c.parentNode.insertBefore(btn, c);
        else if (c.ownerDocument && c.ownerDocument.body) c.ownerDocument.body.appendChild(btn);
      } catch (_e3) {
        return;
      }
    }
    if (!btn || btn.__typelyKbWired) return;
    try {
      btn.addEventListener('click', function () {
        var box = null;
        try {
          box = document.getElementById(CONTAINER_ID);
        } catch (_e4) {
          return;
        }
        if (!box) return;
        var collapsed = false;
        try {
          box.classList.toggle('collapsed');
          collapsed = box.classList.contains('collapsed');
        } catch (_e5) {
          return;
        }
        try {
          btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
        } catch (_e6) { /* noop */ }
      });
      btn.__typelyKbWired = true;
    } catch (_e7) { /* noop */ }
  }

  function onKeyDown(e) {
    // Must animate even when focus is inside inputs/textareas: no target checks.
    if (!e || !container) return;
    var k = null;
    try {
      k = e.key;
    } catch (_e) {
      return;
    }
    if (k == null) return;
    var els = null;
    try {
      els = findKeyEls(k);
    } catch (_e2) {
      return;
    }
    for (var i = 0; i < els.length; i++) {
      try {
        els[i].classList.add('active');
      } catch (_e3) { /* noop */ }
    }
  }

  function onKeyUp(e) {
    if (!e || !container) return;
    var k = null;
    try {
      k = e.key;
    } catch (_e) {
      return;
    }
    if (k == null) return;
    var els = null;
    try {
      els = findKeyEls(k);
    } catch (_e2) {
      return;
    }
    for (var i = 0; i < els.length; i++) {
      try {
        els[i].classList.remove('active');
      } catch (_e3) { /* noop */ }
    }
  }

  function onTypelyKey(e) {
    if (!container) return;
    var d = null;
    try {
      d = (e && e.detail) || {};
    } catch (_e) {
      return;
    }
    var correct = d.correct;
    var expected = d.expected != null ? d.expected : d.key;
    if (!correct && expected != null && expected !== '') {
      var el = null;
      try {
        el = findKeyEl(expected);
      } catch (_e2) {
        el = null;
      }
      if (el) {
        try {
          el.classList.add('miss');
          window.setTimeout(function () {
            try {
              el.classList.remove('miss');
            } catch (_e3) { /* noop */ }
          }, 250);
        } catch (_e4) { /* noop */ }
      }
    }
    try {
      updateHint();
    } catch (_e5) { /* noop */ }
  }

  function onTextChange() {
    if (!container) return;
    // Re-resolve layout from engine state; renderLayout no-ops if unchanged.
    var lang = null;
    try {
      lang = getEngineLang();
    } catch (_e) {
      lang = null;
    }
    try {
      if (lang) renderLayout(lang);
      else updateHint();
    } catch (_e2) { /* noop */ }
  }

  function wireEvents() {
    try {
      document.addEventListener('keydown', onKeyDown);
    } catch (_e) { /* noop */ }
    try {
      document.addEventListener('keyup', onKeyUp);
    } catch (_e2) { /* noop */ }
    try {
      window.addEventListener('blur', clearActive);
    } catch (_e3) { /* noop */ }
    try {
      document.addEventListener('typely:key', onTypelyKey);
    } catch (_e4) { /* noop */ }
    try {
      document.addEventListener('typely:textchange', onTextChange);
    } catch (_e5) { /* noop */ }
    try {
      document.addEventListener('typely:tick', updateHint);
    } catch (_e6) { /* noop */ }

    // Delegated change: works whether #sel-lang / #toggle-hint exist
    // now or are injected later by the engine.
    try {
      document.addEventListener('change', function (e) {
        var t = null;
        try {
          t = e ? e.target : null;
        } catch (_e7) {
          return;
        }
        if (!t) return;
        var id = null;
        try {
          id = t.id;
        } catch (_e8) {
          return;
        }
        if (id === SEL_LANG_ID) {
          var v = null;
          try {
            v = t.value;
          } catch (_e9) {
            v = null;
          }
          if (v) {
            try {
              renderLayout(v);
            } catch (_e10) { /* noop */ }
          }
        } else if (id === HINT_TOGGLE_ID) {
          try {
            updateHint();
          } catch (_e11) { /* noop */ }
        }
      });
    } catch (_e12) { /* noop */ }

    // Direct wiring when present at init (delegated listener covers the rest).
    try {
      var sel = document.getElementById(SEL_LANG_ID);
      if (sel && !sel.__typelyKbWired) {
        sel.addEventListener('change', function () {
          var v = null;
          try {
            v = sel.value;
          } catch (_e13) {
            v = null;
          }
          if (v) {
            try {
              renderLayout(v);
            } catch (_e14) { /* noop */ }
          }
        });
        sel.__typelyKbWired = true;
      }
    } catch (_e15) { /* noop */ }
    try {
      var ht = document.getElementById(HINT_TOGGLE_ID);
      if (ht && !ht.__typelyKbWired) {
        ht.addEventListener('change', function () {
          try {
            updateHint();
          } catch (_e16) { /* noop */ }
        });
        ht.__typelyKbWired = true;
      }
    } catch (_e17) { /* noop */ }

    // Virtual key clicks: visual press only (never steal focus / type).
    try {
      var box = document.getElementById(CONTAINER_ID);
      if (box && !box.__typelyKbClickWired) {
        box.addEventListener('mousedown', function (ev) {
          try {
            ev.preventDefault();
          } catch (_e18) { /* noop */ }
        });
        box.addEventListener('click', function (ev) {
          var el = null;
          try {
            var tgt = ev ? ev.target : null;
            if (tgt && tgt.closest) el = tgt.closest('.key');
          } catch (_e19) {
            el = null;
          }
          if (!el) return;
          try {
            el.classList.add('active');
            window.setTimeout(function () {
              try {
                el.classList.remove('active');
              } catch (_e20) { /* noop */ }
            }, 120);
          } catch (_e21) { /* noop */ }
        });
        box.__typelyKbClickWired = true;
      }
    } catch (_e22) { /* noop */ }
  }

  function init() {
    try {
      container = document.getElementById(CONTAINER_ID);
    } catch (_e) {
      container = null;
    }
    if (!container) return;
    try {
      ensureCollapseToggle();
    } catch (_e2) { /* noop */ }
    try {
      wireEvents();
    } catch (_e3) { /* noop */ }
    try {
      renderLayout(detectLang());
    } catch (_e4) { /* noop */ }
    try {
      updateHint();
    } catch (_e5) { /* noop */ }
  }

  function domReady(fn) {
    try {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', fn, { once: true });
      } else {
        fn();
      }
    } catch (_e) {
      try {
        fn();
      } catch (_e2) { /* noop */ }
    }
  }

  try {
    domReady(init);
  } catch (_e) { /* never throw: engine-absent safe */ }

  // Debug / integration hook (optional, never required by engine).
  try {
    window.TypelyKeyboard = {
      renderLayout: renderLayout,
      updateHint: updateHint,
      layouts: { qwerty: QWERTY, azerty: AZERTY, arabic: ARABIC }
    };
  } catch (_e) { /* noop */ }
})();
