/* apps/typely/js/engine.js
 * Typely core typing engine (PLAN.md sections 3 + 9).
 * IIFE, 'use strict', zero dependencies. Works over file:// (no modules).
 *
 * Owns: target render, input handling, timer, live metrics, i18n dict,
 * results modal, toast, settings persistence.
 *
 * Public API: window.Typely = { state, newTest, useCustomText, getResult,
 *   onTick, t, applyLang, toast }.
 * Events (dispatched on document AND window):
 *   typely:tick       { wpm, raw, acc, elapsed }
 *   typely:key        { key, expected, correct }
 *   typely:textchange { lang, difficulty, mode, text, idx }
 *   typely:result     { dateISO, wpm, raw, acc, consistency, correctChars,
 *                       typedLen, correctKeys, totalKeys, corrections,
 *                       uncorrected, mode, modeLabel, lang, difficulty, perSec[] }
 */
(function () {
  'use strict';

  /* ---------------- constants ---------------- */
  var VALID_LANGS = ['en', 'fr', 'ar'];
  var VALID_DIFFS = ['easy', 'medium', 'hard'];
  var VALID_THEMES = ['ember', 'light', 'dark'];
  var TIME_SECS = [15, 30, 60, 120];
  var WORD_COUNTS = [25, 50];
  var SETTINGS_KEY = 'typely-settings';
  var TICK_MS = 250;
  var SHAKE_MS = 300;
  var TOAST_MS = 2500;

  var FALLBACK_TEXTS = [
    'the quick brown fox jumps over the lazy dog near the quiet river while the birds sing softly in the tall green trees',
    'pack my box with five dozen liquor jugs and watch the stars come out over the calm sea as the night grows dark'
  ];

  /* ---------------- i18n (PLAN.md section 9) ---------------- */
  var I18N = {
    en: {
      'skip': 'Skip to main content',
      'nav.test': 'Test', 'nav.history': 'History', 'nav.custom': 'Custom', 'nav.compete': 'Compete',
      'keyboard.toggle': 'Toggle virtual keyboard',
      'theme.toggle': 'Toggle theme',
      'test.title': 'Typing speed test',
      'label.language': 'Language', 'label.difficulty': 'Difficulty', 'label.mode': 'Mode',
      'lang.en': 'English', 'lang.fr': 'French', 'lang.ar': 'Arabic',
      'diff.easy': 'Easy', 'diff.medium': 'Medium', 'diff.hard': 'Hard',
      'mode.time15': '15 seconds', 'mode.time30': '30 seconds',
      'mode.time60': '60 seconds', 'mode.time120': '120 seconds',
      'mode.words25': '25 words', 'mode.words50': '50 words',
      'test.new': 'New text',
      'stats.wpm': 'WPM', 'stats.acc': 'Accuracy', 'stats.time': 'Time',
      'test.inputPlaceholder': 'Start typing here…',
      'test.hiddenInput': 'Typing input (hidden)',
      'results.title': 'Results', 'results.consistency': 'Consistency',
      'results.chars': 'Characters', 'results.retry': 'Retry', 'results.close': 'Close',
      'history.title': 'History', 'history.graph': 'WPM over tests',
      'history.clear': 'Clear history', 'history.export': 'Export CSV',
      'custom.title': 'Custom tests',
      'custom.label': 'Paste or write your own text (50–2000 characters)',
      'custom.placeholder': 'Paste your text here…',
      'custom.file': 'Or import a .txt file',
      'custom.save': 'Save', 'custom.use': 'Use for test', 'custom.share': 'Share link',
      'compete.title': 'Compete',
      'compete.note': 'Race against simulated bots or your own ghost. Real multiplayer is planned for later.',
      'compete.start': 'Start race', 'compete.ghost': 'Race my ghost',
      'compete.leaderboard': 'Leaderboard', 'compete.rank': '#',
      'compete.name': 'Name', 'compete.date': 'Date',
      'footer.note': 'Typely — offline typing test. Your results never leave this browser.',
      'toast.customLoaded': 'Custom text loaded.',
      'toast.emptyText': 'Text is empty.',
      'toast.newTest': 'New test ready.'
    },
    fr: {
      'skip': 'Aller au contenu principal',
      'nav.test': 'Test', 'nav.history': 'Historique', 'nav.custom': 'Perso', 'nav.compete': 'Duel',
      'keyboard.toggle': 'Afficher / masquer le clavier virtuel',
      'theme.toggle': 'Basculer le thème',
      'test.title': 'Test de vitesse de frappe',
      'label.language': 'Langue', 'label.difficulty': 'Difficulté', 'label.mode': 'Mode',
      'lang.en': 'Anglais', 'lang.fr': 'Français', 'lang.ar': 'Arabe',
      'diff.easy': 'Facile', 'diff.medium': 'Moyen', 'diff.hard': 'Difficile',
      'mode.time15': '15 secondes', 'mode.time30': '30 secondes',
      'mode.time60': '60 secondes', 'mode.time120': '120 secondes',
      'mode.words25': '25 mots', 'mode.words50': '50 mots',
      'test.new': 'Nouveau texte',
      'stats.wpm': 'MPM', 'stats.acc': 'Précision', 'stats.time': 'Temps',
      'test.inputPlaceholder': 'Commencez à taper ici…',
      'test.hiddenInput': 'Zone de frappe (masquée)',
      'results.title': 'Résultats', 'results.consistency': 'Régularité',
      'results.chars': 'Caractères', 'results.retry': 'Recommencer', 'results.close': 'Fermer',
      'history.title': 'Historique', 'history.graph': 'MPM au fil des tests',
      'history.clear': 'Effacer l’historique', 'history.export': 'Exporter CSV',
      'custom.title': 'Tests personnalisés',
      'custom.label': 'Collez ou écrivez votre texte (50–2000 caractères)',
      'custom.placeholder': 'Collez votre texte ici…',
      'custom.file': 'Ou importez un fichier .txt',
      'custom.save': 'Enregistrer', 'custom.use': 'Utiliser', 'custom.share': 'Partager',
      'compete.title': 'Duel',
      'compete.note': 'Affrontez des robots simulés ou votre propre fantôme. Le vrai multijoueur viendra plus tard.',
      'compete.start': 'Lancer la course', 'compete.ghost': 'Défier mon fantôme',
      'compete.leaderboard': 'Classement', 'compete.rank': 'N°',
      'compete.name': 'Nom', 'compete.date': 'Date',
      'footer.note': 'Typely — test de frappe hors ligne. Vos résultats ne quittent jamais ce navigateur.',
      'toast.customLoaded': 'Texte personnalisé chargé.',
      'toast.emptyText': 'Le texte est vide.',
      'toast.newTest': 'Nouveau test prêt.'
    },
    ar: {
      'skip': 'تخطَّ إلى المحتوى الرئيسي',
      'nav.test': 'اختبار', 'nav.history': 'السجل', 'nav.custom': 'مخصص', 'nav.compete': 'تحدَّ',
      'keyboard.toggle': 'إظهار / إخفاء لوحة المفاتيح',
      'theme.toggle': 'تبديل السمة',
      'test.title': 'اختبار سرعة الكتابة',
      'label.language': 'اللغة', 'label.difficulty': 'الصعوبة', 'label.mode': 'النمط',
      'lang.en': 'الإنجليزية', 'lang.fr': 'الفرنسية', 'lang.ar': 'العربية',
      'diff.easy': 'سهل', 'diff.medium': 'متوسط', 'diff.hard': 'صعب',
      'mode.time15': '١٥ ثانية', 'mode.time30': '٣٠ ثانية',
      'mode.time60': '٦٠ ثانية', 'mode.time120': '١٢٠ ثانية',
      'mode.words25': '٢٥ كلمة', 'mode.words50': '٥٠ كلمة',
      'test.new': 'نص جديد',
      'stats.wpm': 'ك/د', 'stats.acc': 'الدقة', 'stats.time': 'الوقت',
      'test.inputPlaceholder': 'ابدأ الكتابة هنا…',
      'test.hiddenInput': 'حقل الكتابة (مخفي)',
      'results.title': 'النتائج', 'results.consistency': 'الثبات',
      'results.chars': 'الأحرف', 'results.retry': 'إعادة', 'results.close': 'إغلاق',
      'history.title': 'السجل', 'history.graph': 'السرعة عبر الاختبارات',
      'history.clear': 'مسح السجل', 'history.export': 'تصدير CSV',
      'custom.title': 'اختبارات مخصصة',
      'custom.label': 'الصق أو اكتب نصك الخاص (٥٠–٢٠٠٠ حرف)',
      'custom.placeholder': 'الصق نصك هنا…',
      'custom.file': 'أو استورد ملف .txt',
      'custom.save': 'حفظ', 'custom.use': 'استخدام', 'custom.share': 'مشاركة',
      'compete.title': 'تحدَّ',
      'compete.note': 'تسابق مع روبوتات محاكاة أو مع شبحك. اللعب الجماعي الحقيقي قادم لاحقا.',
      'compete.start': 'ابدأ السباق', 'compete.ghost': 'تحدَّ شبحي',
      'compete.leaderboard': 'لوحة الصدارة', 'compete.rank': '#',
      'compete.name': 'الاسم', 'compete.date': 'التاريخ',
      'footer.note': 'تايبلي — اختبار كتابة دون إنترنت. نتائجك لا تغادر هذا المتصفح أبدا.',
      'toast.customLoaded': 'تم تحميل النص المخصص.',
      'toast.emptyText': 'النص فارغ.',
      'toast.newTest': 'اختبار جديد جاهز.'
    }
  };

  /* ---------------- state ---------------- */
  var state = {
    target: '',
    typed: [],
    typedLen: 0, /* numeric mirror of typed.length (keyboard/competition compat) */
    startTime: 0,
    elapsed: 0,
    timerId: 0,
    perSec: [], /* raw keystrokes per elapsed second */
    correctKeys: 0,
    totalKeys: 0,
    corrections: 0,
    mode: { type: 'time', sec: 30 },
    modeLabel: 'time30',
    lang: 'en',
    difficulty: 'easy',
    theme: 'ember',
    finished: false,
    started: false,
    lastIdx: -1,
    isCustom: false
  };

  var lastResult = null;
  var lastValue = ''; /* last synced value of the inputs */
  var composing = false;
  var statsQueued = false;
  var toastTimer = 0;

  var els = {};

  /* ---------------- tiny helpers ---------------- */
  function $(id) {
    try {
      return typeof document !== 'undefined' ? document.getElementById(id) : null;
    } catch (_) {
      return null;
    }
  }
  function clamp(v, lo, hi) {
    if (!isFinite(v)) return lo;
    if (v < lo) return lo;
    if (v > hi) return hi;
    return v;
  }
  function r1(v) {
    if (!isFinite(v)) return 0;
    return Math.round(v * 10) / 10;
  }
  function validLang(v) {
    return typeof v === 'string' && VALID_LANGS.indexOf(v.toLowerCase()) >= 0
      ? v.toLowerCase() : null;
  }
  function validDiff(v) {
    return typeof v === 'string' && VALID_DIFFS.indexOf(v.toLowerCase()) >= 0
      ? v.toLowerCase() : null;
  }
  function validTheme(v) {
    return typeof v === 'string' && VALID_THEMES.indexOf(v.toLowerCase()) >= 0
      ? v.toLowerCase() : null;
  }

  /* history.js listens on window, keyboard.js on document ->
     dispatch on both (CustomEvent defaults to bubbles:false). */
  function emit(name, detail) {
    var targets = [];
    try {
      if (typeof document !== 'undefined') targets.push(document);
      if (typeof window !== 'undefined' && window !== document) targets.push(window);
    } catch (_) { /* noop */ }
    targets.forEach(function (target) {
      try {
        target.dispatchEvent(new CustomEvent(name, { detail: detail }));
      } catch (_) {
        try {
          var e = document.createEvent('CustomEvent');
          e.initCustomEvent(name, false, false, detail);
          target.dispatchEvent(e);
        } catch (__) { /* noop */ }
      }
    });
  }

  /* ---------------- settings ---------------- */
  function loadSettings() {
    var fb = { lang: 'en', difficulty: 'easy', mode: 'time30', theme: 'ember' };
    try {
      var raw = window.localStorage.getItem(SETTINGS_KEY);
      if (!raw) return fb;
      var s = JSON.parse(raw);
      if (!s || typeof s !== 'object') return fb;
      return {
        lang: validLang(s.lang) || fb.lang,
        difficulty: validDiff(s.difficulty) || fb.difficulty,
        mode: typeof s.mode === 'string' && parseModeString(s.mode) ? s.mode : fb.mode,
        theme: validTheme(s.theme) || fb.theme
      };
    } catch (_) {
      return fb; /* corrupt JSON / blocked storage -> defaults */
    }
  }
  function saveSettings() {
    try {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({
        lang: state.lang,
        difficulty: state.difficulty,
        mode: state.modeLabel,
        theme: state.theme || 'ember'
      }));
    } catch (_) { /* storage blocked -> ignore */ }
  }

  /* ---------------- theme (ember dark default + light) ---------------- */
  function syncThemeDom(theme) {
    try {
      document.documentElement.dataset.theme = theme;
    } catch (_) { /* noop */ }
    try {
      var meta = document.querySelector('meta[name="color-scheme"]');
      if (meta) meta.setAttribute('content', theme === 'light' ? 'light' : 'dark');
    } catch (_) { /* noop */ }
    try {
      var btn = document.getElementById('btn-theme');
      if (btn) {
        var isDark = theme !== 'light';
        btn.setAttribute('aria-pressed', isDark ? 'true' : 'false');
        /* moon in dark, sun in light; label comes from i18n */
        btn.textContent = isDark ? '\u263E' : '\u2600';
      }
    } catch (_) { /* noop */ }
  }
  function applyTheme(theme) {
    var next = validTheme(theme) || 'ember';
    state.theme = next;
    syncThemeDom(next);
    saveSettings();
    return next;
  }
  function cycleTheme() {
    /* ember -> light -> dark -> ember (dark is the same warm palette as ember) */
    var order = ['ember', 'light', 'dark'];
    var i = order.indexOf(state.theme);
    if (i < 0) i = 0;
    return applyTheme(order[(i + 1) % order.length]);
  }

  /* ---------------- i18n ---------------- */
  function t(k) {
    var L = I18N[state.lang] || {};
    if (L[k] != null) return L[k];
    if (I18N.en[k] != null) return I18N.en[k];
    return k;
  }
  function applyLang(lang) {
    if (validLang(lang)) state.lang = lang;
    var l = state.lang;
    try {
      document.documentElement.setAttribute('lang', l);
      document.documentElement.setAttribute('dir', l === 'ar' ? 'rtl' : 'ltr');
    } catch (_) { /* noop */ }
    try {
      var nodes = document.querySelectorAll('[data-i18n]');
      for (var i = 0; i < nodes.length; i++) {
        var k = nodes[i].getAttribute('data-i18n');
        var v = t(k);
        /* leaf labels only: never wipe child markup */
        if (v !== k && nodes[i].children.length === 0) nodes[i].textContent = v;
      }
      var ph = document.querySelectorAll('[data-i18n-placeholder]');
      for (var j = 0; j < ph.length; j++) {
        var k2 = ph[j].getAttribute('data-i18n-placeholder');
        var v2 = t(k2);
        if (v2 !== k2) ph[j].setAttribute('placeholder', v2);
      }
      var al = document.querySelectorAll('[data-i18n-aria-label]');
      for (var m = 0; m < al.length; m++) {
        var k3 = al[m].getAttribute('data-i18n-aria-label');
        var v3 = t(k3);
        if (v3 !== k3) al[m].setAttribute('aria-label', v3);
      }
    } catch (_) { /* noop */ }
    saveSettings();
  }

  /* ---------------- modes ---------------- */
  /* Accepts 'time15' | 'time-15' | 'time_15' | 'time 15' | '15' (time),
     same family for words ('words25', '25'), or { type, sec|count }. */
  function parseModeString(s) {
    if (typeof s !== 'string') return null;
    var norm = s.trim().toLowerCase().replace(/[\s_-]+/g, '');
    var m = norm.match(/^(time|words)(\d+)$/);
    var type = null;
    var n = 0;
    if (m) {
      type = m[1];
      n = parseInt(m[2], 10);
    } else if (/^\d+$/.test(norm)) {
      n = parseInt(norm, 10);
      type = TIME_SECS.indexOf(n) >= 0 ? 'time'
        : (WORD_COUNTS.indexOf(n) >= 0 ? 'words' : null);
    }
    if (!type || !isFinite(n)) return null;
    if (type === 'time' && TIME_SECS.indexOf(n) >= 0) {
      return { mode: { type: 'time', sec: n }, label: 'time' + n };
    }
    if (type === 'words' && WORD_COUNTS.indexOf(n) >= 0) {
      return { mode: { type: 'words', count: n }, label: 'words' + n };
    }
    return null;
  }
  function resolveModeInput(input) {
    if (input == null) return null;
    if (typeof input === 'object') {
      try {
        if (input.type === 'time') {
          var s = Math.round(Number(input.sec));
          if (TIME_SECS.indexOf(s) >= 0) return { mode: { type: 'time', sec: s }, label: 'time' + s };
        } else if (input.type === 'words') {
          var c = Math.round(Number(input.count));
          if (WORD_COUNTS.indexOf(c) >= 0) return { mode: { type: 'words', count: c }, label: 'words' + c };
        }
      } catch (_) { /* fall through to null */ }
      return null;
    }
    return parseModeString(input);
  }
  function selVal(el) {
    try {
      return el && typeof el.value === 'string' ? el.value : '';
    } catch (_) {
      return '';
    }
  }

  /* ---------------- corpus ---------------- */
  function pickText(lang, diff, excludeIdx) {
    var corpus = null;
    try {
      if (window.TYPELY_TEXTS && window.TYPELY_TEXTS[lang] && window.TYPELY_TEXTS[lang][diff]) {
        corpus = window.TYPELY_TEXTS[lang][diff];
      }
    } catch (_) { corpus = null; }
    if (Array.isArray(corpus) && corpus.length > 0) {
      if (typeof window.TypelyPick === 'function') {
        try {
          var r = window.TypelyPick(lang, diff, excludeIdx);
          if (r && typeof r.text === 'string' && r.text.length > 0) return r;
        } catch (_) { /* fall through to local pick */ }
      }
      var idx = Math.floor(Math.random() * corpus.length);
      if (corpus.length > 1 && idx === excludeIdx) idx = (idx + 1) % corpus.length;
      return { text: corpus[idx], idx: idx };
    }
    if (typeof window.TypelyPick === 'function') {
      try {
        var r2 = window.TypelyPick(lang, diff, excludeIdx);
        if (r2 && typeof r2.text === 'string' && r2.text.length > 0) return r2;
      } catch (_) { /* fall through */ }
    }
    var fb = Math.floor(Math.random() * FALLBACK_TEXTS.length);
    return { text: FALLBACK_TEXTS[fb], idx: -1 };
  }

  /* ---------------- render ---------------- */
  function render() {
    var d = els.display;
    if (!d) return;
    try {
      d.innerHTML = '';
      d.setAttribute('lang', state.lang);
      var word = null;
      for (var i = 0; i < state.target.length; i++) {
        var ch = state.target.charAt(i);
        var s = document.createElement('span');
        if (i < state.typed.length) {
          s.className = state.typed[i] === ch ? 'ch correct' : 'ch incorrect err';
        } else if (i === state.typed.length) {
          s.className = 'ch current';
        } else {
          s.className = 'ch pending';
        }
        s.textContent = ch;
        s.setAttribute('data-i', String(i));
        if (ch === ' ') {
          word = null;
          s.className += ' space';
          d.appendChild(s);
        } else {
          if (!word) {
            word = document.createElement('span');
            word.className = 'word';
            d.appendChild(word);
          }
          word.appendChild(s);
        }
      }
      var cur = d.querySelector('.ch.current');
      if (cur && cur.scrollIntoView) {
        try {
          cur.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        } catch (_) { /* old browsers */ }
      }
    } catch (_) { /* render must never break typing */ }
  }

  function reducedMotion() {
    try {
      return typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (_) {
      return false;
    }
  }
  function shakeWord() {
    if (reducedMotion()) return;
    try {
      var d = els.display;
      if (!d) return;
      /* shake the word holding the last incorrect char */
      var errs = d.querySelectorAll('.ch.incorrect');
      var anchor = errs.length > 0 ? errs[errs.length - 1] : d.querySelector('.ch.current');
      var w = null;
      if (anchor && anchor.parentElement &&
          anchor.parentElement.classList.contains('word')) {
        w = anchor.parentElement;
      }
      if (!w) {
        var words = d.querySelectorAll('.word');
        if (words.length > 0) w = words[words.length - 1];
      }
      if (!w) return;
      w.classList.remove('shake');
      void w.offsetWidth; /* restart animation */
      w.classList.add('shake');
      window.setTimeout(function () {
        try { w.classList.remove('shake'); } catch (_) { /* noop */ }
      }, SHAKE_MS);
    } catch (_) { /* noop */ }
  }

  /* ---------------- metrics (PLAN.md section 3) ---------------- */
  /* WPM = (correctChars / 5) / minutes; Raw = (typedLen / 5) / minutes;
     Acc = correctKeys / totalKeys * 100 (100 when no keys yet). */
  function countCorrect() {
    var n = 0;
    for (var i = 0; i < state.typed.length; i++) {
      if (state.typed[i] === state.target.charAt(i)) n++;
    }
    return n;
  }
  function refreshElapsed() {
    if (state.started && !state.finished) {
      state.elapsed = Date.now() - state.startTime;
      if (!isFinite(state.elapsed) || state.elapsed < 0) state.elapsed = 0;
    }
  }
  function computeMetrics() {
    refreshElapsed();
    var typedLen = state.typed.length;
    var correctChars = countCorrect();
    var minutes = state.elapsed / 60000;
    var wpm = 0;
    var raw = 0;
    if (minutes > 0) { /* clamped: no division by zero */
      wpm = (correctChars / 5) / minutes;
      raw = (typedLen / 5) / minutes;
    }
    var acc = state.totalKeys > 0
      ? (state.correctKeys / state.totalKeys) * 100 : 100;
    return { wpm: wpm, raw: raw, acc: acc, elapsed: state.elapsed, correctChars: correctChars, typedLen: typedLen };
  }
  /* Consistency = 100 - CV*100 over per-second raw buckets, clamped 0..100.
     Only complete seconds count (partial tail second excluded). */
  function computeConsistency() {
    try {
      var secs = Math.floor(state.elapsed / 1000);
      var arr = state.perSec.slice(0, secs);
      if (arr.length < 2) return 100;
      var sum = 0;
      var i;
      for (i = 0; i < arr.length; i++) sum += arr[i];
      var mean = sum / arr.length;
      if (!(mean > 0)) return 100; /* clamped: no division by zero */
      var variance = 0;
      for (i = 0; i < arr.length; i++) {
        var dev = arr[i] - mean;
        variance += dev * dev;
      }
      var cv = Math.sqrt(variance / arr.length) / mean;
      return r1(clamp(100 - cv * 100, 0, 100));
    } catch (_) {
      return 100;
    }
  }

  function updateStats() {
    var m = computeMetrics();
    try {
      if (els.wpm) els.wpm.textContent = String(Math.round(m.wpm));
      if (els.acc) els.acc.textContent = r1(m.acc) + '%';
      if (els.time) {
        if (state.mode.type === 'time') {
          var remain = Math.max(0, Math.ceil(state.mode.sec - m.elapsed / 1000));
          els.time.textContent = remain + 's';
        } else {
          els.time.textContent = Math.floor(m.elapsed / 1000) + 's';
        }
      }
    } catch (_) { /* noop */ }
    emit('typely:tick', {
      wpm: r1(m.wpm), raw: r1(m.raw), acc: r1(m.acc), elapsed: Math.round(m.elapsed)
    });
    return m;
  }
  function scheduleStats() { /* rAF throttle */
    if (statsQueued) return;
    statsQueued = true;
    var run = function () { statsQueued = false; updateStats(); };
    try {
      if (typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(run);
      } else {
        window.setTimeout(run, 16);
      }
    } catch (_) {
      statsQueued = false;
    }
  }

  /* ---------------- timer ---------------- */
  function startTimer() {
    if (state.started) return;
    state.started = true;
    state.startTime = Date.now();
    state.elapsed = 0;
    try {
      state.timerId = window.setInterval(onInterval, TICK_MS);
    } catch (_) {
      state.timerId = 0;
    }
  }
  function stopTimer() {
    if (state.timerId) {
      try { window.clearInterval(state.timerId); } catch (_) { /* noop */ }
      state.timerId = 0;
    }
  }
  function onInterval() {
    if (!state.started || state.finished) return;
    refreshElapsed();
    if (state.mode.type === 'time' && state.elapsed >= state.mode.sec * 1000) {
      updateStats();
      finish();
      return;
    }
    updateStats();
  }

  /* ---------------- input ---------------- */
  function bucketHit() {
    try {
      var idx = Math.floor((Date.now() - state.startTime) / 1000);
      if (!isFinite(idx) || idx < 0) idx = 0;
      while (state.perSec.length <= idx) state.perSec.push(0);
      state.perSec[idx]++;
    } catch (_) { /* noop */ }
  }
  function insertChar(ch) {
    if (state.finished) return;
    if (state.typed.length >= state.target.length) return; /* cap at target */
    if (!state.started) startTimer();
    var pos = state.typed.length;
    var expected = state.target.charAt(pos);
    var correct = ch === expected;
    state.typed.push(ch);
    state.typedLen = state.typed.length;
    state.totalKeys++;
    if (correct) state.correctKeys++;
    bucketHit();
    emit('typely:key', { key: ch, expected: expected, correct: correct });
    render();
    if (!correct) shakeWord();
    scheduleStats();
    if (state.typed.length >= state.target.length) finish(); /* timeout or completion */
  }
  function doBackspace(n) {
    if (state.finished) return;
    var removed = 0;
    for (var i = 0; i < n; i++) {
      if (state.typed.length === 0) break;
      state.typed.pop();
      removed++;
    }
    if (removed > 0) {
      state.typedLen = state.typed.length;
      state.corrections += removed; /* only when actually deleting a char */
      render();
      scheduleStats();
    }
  }
  function syncInputs() {
    lastValue = state.typed.join('');
    try {
      if (els.hidden && els.hidden.value !== lastValue) els.hidden.value = lastValue;
      if (els.visible && els.visible.value !== lastValue) els.visible.value = lastValue;
    } catch (_) { /* noop */ }
  }
  /* Both hidden-input (desktop) and typing-input (mobile) feed here.
     Reconcile via longest-common-prefix diff so inserts, backspaces,
     pastes and autocorrect replacements all normalize correctly. */
  function onInput(e) {
    var el = null;
    try { el = e.target; } catch (_) { return; }
    if (!el || composing) return;
    try { if (e.isComposing) return; } catch (_) { /* noop */ }
    var cur = '';
    try { cur = String(el.value == null ? '' : el.value).replace(/\r/g, ''); } catch (_) { return; }
    if (cur === lastValue) return;
    if (state.finished) { syncInputs(); return; }
    var common = 0;
    var max = Math.min(cur.length, lastValue.length);
    while (common < max && cur.charAt(common) === lastValue.charAt(common)) common++;
    var back = lastValue.length - common;
    var added = cur.slice(common);
    if (back > 0) doBackspace(back);
    for (var i = 0; i < added.length; i++) {
      var ch = added.charAt(i);
      if (ch === '\n') continue;
      insertChar(ch);
      if (state.finished) break;
    }
    syncInputs();
  }
  function focusInput() {
    try {
      var target = els.hidden || els.visible;
      if (target && target.focus) {
        try { target.focus({ preventScroll: true }); }
        catch (_) { target.focus(); }
      }
    } catch (_) { /* noop */ }
  }

  /* ---------------- results ---------------- */
  function buildResult() {
    var typedLen = state.typed.length;
    var correctChars = countCorrect();
    var minutes = state.elapsed / 60000;
    var wpm = minutes > 0 ? (correctChars / 5) / minutes : 0;
    var raw = minutes > 0 ? (typedLen / 5) / minutes : 0;
    var acc = state.totalKeys > 0 ? (state.correctKeys / state.totalKeys) * 100 : 100;
    var uncorrected = 0;
    for (var i = 0; i < typedLen; i++) {
      if (state.typed[i] !== state.target.charAt(i)) uncorrected++;
    }
    var modeCopy = state.mode.type === 'time'
      ? { type: 'time', sec: state.mode.sec }
      : { type: 'words', count: state.mode.count };
    return {
      dateISO: new Date().toISOString(),
      wpm: Math.round(wpm),
      raw: Math.round(raw),
      acc: r1(acc),
      consistency: computeConsistency(),
      correctChars: correctChars,
      typedLen: typedLen,
      correctKeys: state.correctKeys,
      totalKeys: state.totalKeys,
      corrections: state.corrections,
      uncorrected: uncorrected,
      mode: modeCopy,
      modeLabel: state.modeLabel,
      lang: state.lang,
      difficulty: state.difficulty,
      perSec: state.perSec.slice()
    };
  }
  function fillModal(res) {
    try {
      if (els.resWpm) els.resWpm.textContent = String(res.wpm);
      if (els.resAcc) els.resAcc.textContent = res.acc + '%';
      if (els.resCon) els.resCon.textContent = res.consistency + '%';
      if (els.resChars) {
        /* correct / incorrect / extra / missed (matches 0/0/0/0 shell) */
        var incorrect = Math.max(0, res.typedLen - res.correctChars);
        var extra = 0; /* typed is capped at target length */
        var missed = Math.max(0, state.target.length - res.typedLen);
        els.resChars.textContent = res.correctChars + '/' + incorrect + '/' + extra + '/' + missed;
      }
      var resRaw = $('res-raw');
      if (resRaw) resRaw.textContent = String(res.raw);
    } catch (_) { /* noop */ }
  }
  function showModal() {
    var m = els.modal;
    if (!m) return;
    try {
      m.removeAttribute('hidden');
      if (m.classList) {
        m.classList.remove('hidden');
        m.classList.add('open');
      }
      m.setAttribute('aria-hidden', 'false');
    } catch (_) { /* noop */ }
  }
  function hideModal() {
    var m = els.modal;
    if (!m) return;
    try {
      if (m.classList) {
        m.classList.remove('open');
        m.classList.add('hidden');
      }
      m.setAttribute('hidden', '');
      m.setAttribute('aria-hidden', 'true');
    } catch (_) { /* noop */ }
  }
  function finish() {
    if (state.finished) return;
    state.finished = true;
    stopTimer();
    /* freeze the clock: refreshElapsed() is a no-op once finished */
    if (state.started) {
      state.elapsed = Date.now() - state.startTime;
      if (!isFinite(state.elapsed) || state.elapsed < 0) state.elapsed = 0;
    }
    updateStats();
    lastResult = buildResult();
    fillModal(lastResult);
    showModal();
    emit('typely:result', lastResult);
  }
  function getResult() {
    if (state.finished && lastResult) {      var c = {};
      for (var k in lastResult) {
        if (Object.prototype.hasOwnProperty.call(lastResult, k)) c[k] = lastResult[k];
      }
      c.mode = { type: lastResult.mode.type };
      if (lastResult.mode.sec != null) c.mode.sec = lastResult.mode.sec;
      if (lastResult.mode.count != null) c.mode.count = lastResult.mode.count;
      c.perSec = lastResult.perSec.slice();
      return c;
    }
    refreshElapsed();
    return buildResult(); /* live snapshot with fresh elapsed */
  }
  function onTick(fn) {
    if (typeof fn !== 'function') return function () { /* noop */ };
    var handler = function (e) {
      try { fn(e && e.detail ? e.detail : { wpm: 0, raw: 0, acc: 100, elapsed: 0 }); }
      catch (_) { /* subscriber errors must not break the engine */ }
    };
    try {
      document.addEventListener('typely:tick', handler);
    } catch (_) { /* noop */ }
    return function () {
      try { document.removeEventListener('typely:tick', handler); } catch (_) { /* noop */ }
    };
  }

  /* ---------------- test lifecycle ---------------- */
  function newTest(opts) {
    opts = opts || {};
    var prevLang = state.lang;
    var lang = validLang(opts.lang) || validLang(selVal(els.lang)) || prevLang || 'en';
    var diff = validDiff(opts.diff != null ? opts.diff : opts.difficulty) ||
      validDiff(selVal(els.diff)) || state.difficulty || 'easy';
    var parsed = resolveModeInput(opts.mode) || parseModeString(selVal(els.mode)) ||
      { mode: { type: state.mode.type }, label: state.modeLabel };
    if (!parsed.mode.sec && !parsed.mode.count) {
      parsed = state.mode.type === 'time'
        ? { mode: { type: 'time', sec: state.mode.sec || 30 }, label: state.modeLabel }
        : { mode: { type: 'words', count: state.mode.count || 25 }, label: state.modeLabel };
    }
    var custom = !!opts.custom;
    var text = typeof opts.text === 'string' && opts.text.length > 0 ? opts.text : null;
    var picked;
    var isCustom;
    if (text != null) {
      picked = { text: text, idx: state.lastIdx };
      isCustom = custom;
    } else {
      var exclude = (!state.isCustom && lang === state.lang && diff === state.difficulty)
        ? state.lastIdx : -1;
      picked = pickText(lang, diff, exclude);
      isCustom = false;
    }
    if (!picked || typeof picked.text !== 'string' || picked.text.length === 0) {
      toast(t('toast.emptyText'));
      return false;
    }
    stopTimer();
    state.target = picked.text;
    state.typed = [];
    state.typedLen = 0;
    state.startTime = 0;
    state.elapsed = 0;
    state.perSec = [];
    state.correctKeys = 0;
    state.totalKeys = 0;
    state.corrections = 0;
    state.mode = parsed.mode;
    state.modeLabel = parsed.label;
    state.lang = lang;
    state.difficulty = diff;
    state.finished = false;
    state.started = false;
    state.isCustom = isCustom;
    state.lastIdx = isCustom ? -1 : picked.idx;
    lastResult = null;
    try {
      if (els.lang) els.lang.value = lang;
      if (els.langHeader) els.langHeader.value = lang;
      if (els.diff) els.diff.value = diff;
      if (els.mode) els.mode.value = parsed.label;
    } catch (_) { /* option may be absent */ }
    syncInputs();
    hideModal();
    if (lang !== prevLang) applyLang(lang); else saveSettings();
    render();
    updateStats();
    emit('typely:textchange', {
      lang: lang, difficulty: diff, mode: parsed.label, text: state.target, idx: state.lastIdx
    });
    return true;
  }
  function useCustomText(text) {
    if (typeof text !== 'string') { toast(t('toast.emptyText')); return false; }
    var clean = '';
    try {
      clean = text.replace(/\r/g, '').replace(/\n/g, ' ').trim();
    } catch (_) {
      toast(t('toast.emptyText'));
      return false;
    }
    if (!clean) { toast(t('toast.emptyText')); return false; }
    if (clean.length > 2000) clean = clean.slice(0, 2000);
    var ok = newTest({ text: clean, custom: true });
    if (ok) {
      toast(t('toast.customLoaded'));
      focusInput();
    }
    return !!ok;
  }

  /* ---------------- toast ---------------- */
  function toast(msg) {
    try {
      var el = els.toast;
      if (!el) return;
      el.textContent = String(msg);
      if (el.removeAttribute) el.removeAttribute('hidden');
      if (el.classList) el.classList.add('show');
      if (toastTimer) window.clearTimeout(toastTimer);
      toastTimer = window.setTimeout(function () {
        try { if (el.classList) el.classList.remove('show'); } catch (_) { /* noop */ }
      }, TOAST_MS);
    } catch (_) { /* toast must never break the app */ }
  }

  /* ---------------- wiring ---------------- */
  function bindOnce(el, action, type, fn) {
    if (!el) return;
    var key = '__typely_' + action;
    try {
      if (el[key]) return;
      el[key] = true;
      el.addEventListener(type, fn);
    } catch (_) { /* noop */ }
  }
  function bindAny(selectors, action, type, fn) {
    selectors.forEach(function (sel) {
      var list = null;
      try { list = document.querySelectorAll(sel); } catch (_) { return; }
      for (var i = 0; i < list.length; i++) bindOnce(list[i], action, type, fn);
    });
  }
  function retryTest() {
    newTest({ text: state.target, lang: state.lang, diff: state.difficulty, mode: state.modeLabel, custom: state.isCustom });
    focusInput();
  }

  function init() {
    els = {
      lang: $('sel-lang'),
      langHeader: $('sel-lang-header'),
      diff: $('sel-diff'),
      mode: $('sel-mode'),
      display: $('text-display'),
      hidden: $('hidden-input'),
      visible: $('typing-input'),
      wpm: $('stat-wpm'),
      acc: $('stat-acc'),
      time: $('stat-time'),
      modal: $('results-modal'),
      resWpm: $('res-wpm'),
      resAcc: $('res-acc'),
      resCon: $('res-consistency'),
      resChars: $('res-chars'),
      toast: $('toast')
    };

    var stored = loadSettings();
    state.lang = stored.lang;
    state.difficulty = stored.difficulty;
    state.theme = validTheme(stored.theme) || 'ember';
    syncThemeDom(state.theme);
    var pm = parseModeString(stored.mode);
    if (pm) { state.mode = pm.mode; state.modeLabel = pm.label; }
    try {
      if (els.lang) els.lang.value = state.lang;
      if (els.langHeader) els.langHeader.value = state.lang;
      if (els.diff) els.diff.value = state.difficulty;
      if (els.mode) els.mode.value = state.modeLabel;
    } catch (_) { /* noop */ }

    /* input events from both desktop + mobile fields */
    [els.hidden, els.visible].forEach(function (input) {
      if (!input) return;
      try {
        input.addEventListener('input', onInput);
        input.addEventListener('compositionstart', function () { composing = true; });
        input.addEventListener('compositionend', function () { composing = false; });
        input.addEventListener('focus', function () {
          /* keep the unfocused field from producing a phantom diff */
          try { if (input.value !== lastValue) input.value = lastValue; } catch (_) { /* noop */ }
        });
      } catch (_) { /* noop */ }
    });

    /* click-to-focus proxy */
    if (els.display) {
      try {
        els.display.addEventListener('click', focusInput);
      } catch (_) { /* noop */ }
    }

    /* buttons: real index.html IDs first, planned-ID fallbacks after */
    bindAny(['#btn-theme'], 'theme', 'click', function () { cycleTheme(); });
    bindAny(['#new-text', '[data-action="new-text"]', '#btn-new-text', '#new-text-btn'],
      'newtext', 'click', function () { newTest(); focusInput(); });
    bindAny(['#btn-retry', '[data-action="retry"]', '#retry-btn'],
      'retry', 'click', retryTest);
    bindAny(['#btn-new', '[data-action="new"]'],
      'modalnew', 'click', function () { newTest(); focusInput(); });
    bindAny(['#btn-modal-close', '[data-action="close"]', '[data-action="close-modal"]',
      '#modal-close', '#results-close'],
      'closemodal', 'click', function () { hideModal(); focusInput(); });

    /* backdrop click closes */
    if (els.modal) {
      try {
        els.modal.addEventListener('click', function (e) {
          if (e && e.target === els.modal) hideModal();
        });
      } catch (_) { /* noop */ }
    }

    /* settings changes -> persist + fresh test */
    [els.lang, els.langHeader].forEach(function (sel) {
      if (!sel) return;
      try {
        sel.addEventListener('change', function () {
          var v = validLang(selVal(sel));
          if (!v) return;
          try {
            if (els.lang) els.lang.value = v;
            if (els.langHeader) els.langHeader.value = v;
          } catch (_) { /* noop */ }
          state.lang = v;
          applyLang(v);
          newTest();
          focusInput();
        });
      } catch (_) { /* noop */ }
    });
    [els.diff, els.mode].forEach(function (sel) {
      if (!sel) return;
      try {
        sel.addEventListener('change', function () { newTest(); focusInput(); });
      } catch (_) { /* noop */ }
    });

    /* tab switching: [data-tab] buttons toggle panel-* sections */
    try {
      var tabs = document.querySelectorAll ? document.querySelectorAll('[data-tab]') : [];
      Array.prototype.forEach.call(tabs, function (btn) {
        btn.addEventListener('click', function () {
          var name = btn.getAttribute && btn.getAttribute('data-tab');
          if (!name) return;
          Array.prototype.forEach.call(tabs, function (b) {
            var on = b === btn;
            try {
              b.classList.toggle('is-active', on);
              b.setAttribute('aria-selected', on ? 'true' : 'false');
            } catch (_) { /* noop */ }
          });
          ['test', 'history', 'custom', 'compete'].forEach(function (n) {
            var panel = document.getElementById('panel-' + n);
            if (!panel) return;
            try {
              if (n === name) panel.removeAttribute('hidden');
              else panel.setAttribute('hidden', '');
            } catch (_) { /* noop */ }
          });
          if (name === 'test') focusInput();
        });
      });
    } catch (_) { /* noop */ }

    /* typing anywhere focuses the hidden input; Esc closes the modal */
    try {
      document.addEventListener('keydown', function (e) {
        try {
          if (e.key === 'Escape' && els.modal && !els.modal.hasAttribute('hidden')) {
            hideModal();
            return;
          }
          var tag = e.target && e.target.tagName ? String(e.target.tagName).toLowerCase() : '';
          if (tag === 'input' || tag === 'textarea' || tag === 'select' || tag === 'button') return;
          if (e.ctrlKey || e.metaKey || e.altKey) return;
          if (typeof e.key === 'string' && e.key.length === 1) focusInput();
        } catch (_) { /* noop */ }
      });
    } catch (_) { /* noop */ }

    applyLang(state.lang);

    /* #t= share hash (custom.js owns creation; engine owns loading) */
    var fromHash = false;
    try {
      var h = window.location && window.location.hash ? String(window.location.hash) : '';
      if (h.indexOf('#t=') === 0) {
        var shared = decodeURIComponent(h.slice(3));
        if (shared && shared.trim()) {
          fromHash = useCustomText(shared);
        }
      }
    } catch (_) { fromHash = false; }
    if (!fromHash) newTest();
  }

  /* ---------------- public API ---------------- */
  if (typeof window !== 'undefined') {
    window.Typely = {
      state: state,
      newTest: newTest,
      useCustomText: useCustomText,
      getResult: getResult,
      onTick: onTick,
      t: t,
      applyLang: applyLang,
      toast: toast,
      setTheme: applyTheme,
      cycleTheme: cycleTheme
    };
  }

  if (typeof document !== 'undefined') {
    try {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
      } else {
        init();
      }
    } catch (_) { /* noop */ }
  }
})();
