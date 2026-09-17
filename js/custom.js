/* apps/typely/js/custom.js
 * Typely custom tests: textarea validation, saved list, .txt import, #t= share links.
 *
 * Zero dependencies. Uses window.Typely.useCustomText(text) when the engine exposes
 * it, and clicks [data-tab="test"] (with a manual hidden-panel fallback) to switch
 * back to the test tab. All DOM lookups are null-checked so nothing throws when
 * markup is absent. Supports both the planned button IDs (btn-save-custom /
 * btn-use-custom / btn-share-custom) and the IDs present in index.html
 * (btn-custom-save / btn-custom-use / btn-custom-share).
 */
(function () {
  'use strict';

  var STORE_KEY = 'typely-custom';
  var MAX_SAVED = 20;
  var MIN_LEN = 50;
  var MAX_LEN = 2000;
  var PREVIEW_LEN = 80;
  var SHARE_LEN = 1200;
  var lastAppliedHashText = null;

  /* ---------------- null-safe helpers ---------------- */
  function $(id) {
    return typeof document !== 'undefined' ? document.getElementById(id) : null;
  }
  function pick(ids) {
    for (var i = 0; i < ids.length; i++) {
      var el = $(ids[i]);
      if (el) return el;
    }
    return null;
  }
  function pickAll(ids) {
    var out = [];
    ids.forEach(function (id) {
      var el = $(id);
      if (el && out.indexOf(el) === -1) out.push(el);
    });
    return out;
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
  function currentLang() {
    try {
      var sel = $('custom-lang') || $('sel-lang');
      if (sel && typeof sel.value === 'string' && sel.value) return sel.value;
      var htmlLang = document.documentElement && document.documentElement.lang;
      if (typeof htmlLang === 'string' && htmlLang) return htmlLang.slice(0, 2);
    } catch (e) { /* ignore */ }
    return 'en';
  }
  function makeId() {
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  /* ---------------- storage ---------------- */
  function loadCustom() {
    try {
      var raw = window.localStorage.getItem(STORE_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(function (e) {
        return e && typeof e === 'object' && typeof e.text === 'string' && e.text.length > 0;
      });
    } catch (e) {
      return []; // corrupt JSON -> start fresh, never throw
    }
  }
  function saveCustom(all) {
    try {
      var capped = all.length > MAX_SAVED ? all.slice(all.length - MAX_SAVED) : all;
      window.localStorage.setItem(STORE_KEY, JSON.stringify(capped));
    } catch (e) { /* storage full/blocked -> ignore */ }
  }

  /* ---------------- validation + live counter ---------------- */
  function textarea() {
    return $('custom-text');
  }
  function trimmedInput() {
    var ta = textarea();
    if (!ta || typeof ta.value !== 'string') return '';
    return ta.value.trim();
  }
  function ensureCounter() {
    try {
      var existing = $('custom-count');
      if (existing) return existing;
      var ta = textarea();
      if (!ta || !ta.parentNode) return null;
      var p = document.createElement('p');
      p.id = 'custom-count';
      p.className = 'muted custom-count';
      p.setAttribute('aria-live', 'polite');
      if (ta.nextSibling) ta.parentNode.insertBefore(p, ta.nextSibling);
      else ta.parentNode.appendChild(p);
      return p;
    } catch (e) {
      return null;
    }
  }
  function updateCounter() {
    try {
      var ta = textarea();
      var counter = $('custom-count') || ensureCounter();
      if (!ta || !counter) return;
      var len = typeof ta.value === 'string' ? ta.value.trim().length : 0;
      counter.textContent = len + ' / ' + MAX_LEN + ' (min ' + MIN_LEN + ')';
      var invalid = len > 0 && (len < MIN_LEN || len > MAX_LEN);
      ta.setAttribute('aria-invalid', invalid ? 'true' : 'false');
    } catch (e) { /* ignore */ }
  }
  // Returns { ok, text, error }. Rule: trimmed length must be 50–2000 chars.
  function validate(text) {
    var t = typeof text === 'string' ? text.trim() : '';
    if (t.length < MIN_LEN) {
      return { ok: false, text: t, error: 'Too short — ' + t.length + '/' + MIN_LEN + ' minimum characters.' };
    }
    if (t.length > MAX_LEN) {
      return { ok: false, text: t, error: 'Too long — ' + t.length + '/' + MAX_LEN + ' maximum characters.' };
    }
    return { ok: true, text: t, error: '' };
  }

  /* ---------------- engine + tab helpers ---------------- */
  function useText(text) {
    try {
      if (window.Typely && typeof window.Typely.useCustomText === 'function') {
        window.Typely.useCustomText(text);
        switchToTestTab();
        return true;
      }
    } catch (e) {
      return false;
    }
    return false;
  }
  function switchToTestTab() {
    try {
      // Preferred: let the tab owner (engine/keyboard module) handle the switch.
      var btn = document.querySelector('[data-tab="test"]');
      if (btn && typeof btn.click === 'function') {
        btn.click();
        return;
      }
      // Fallback: toggle known panels directly. Skipped silently if absent.
      ['test', 'history', 'custom', 'compete'].forEach(function (name) {
        var panel = $('panel-' + name);
        if (!panel) return;
        if (name === 'test') panel.removeAttribute('hidden');
        else panel.setAttribute('hidden', '');
      });
      var tabs = document.querySelectorAll ? document.querySelectorAll('[data-tab]') : [];
      Array.prototype.forEach.call(tabs, function (b) {
        var active = b.getAttribute && b.getAttribute('data-tab') === 'test';
        if (b.classList) b.classList.toggle('is-active', !!active);
        if (b.setAttribute) b.setAttribute('aria-selected', active ? 'true' : 'false');
      });
    } catch (e) { /* never throw */ }
  }
  function copyText(text, done) {
    function fallback() {
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        var ok = false;
        try {
          ok = document.execCommand('copy');
        } catch (e) {
          ok = false;
        }
        document.body.removeChild(ta);
        done(!!ok);
      } catch (e) {
        done(false);
      }
    }
    try {
      if (navigator && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        navigator.clipboard.writeText(text).then(
          function () {
            done(true);
          },
          fallback
        );
      } else {
        fallback();
      }
    } catch (e) {
      fallback();
    }
  }
  function shareText(text) {
    var t = typeof text === 'string' ? text : '';
    if (!t) {
      toast('Nothing to share yet.');
      return;
    }
    try {
      lastAppliedHashText = t.slice(0, SHARE_LEN);
      window.location.hash = '#t=' + encodeURIComponent(lastAppliedHashText);
    } catch (e) { /* hash assignment failed -> still try to copy */ }
    try {
      copyText(window.location.href, function (ok) {
        toast(ok ? 'Share link copied to clipboard.' : 'Share link is in the address bar.');
      });
    } catch (e) {
      toast('Share link is in the address bar.');
    }
  }

  /* ---------------- saved-list render ---------------- */
  function renderList() {
    var ul = $('custom-list');
    if (!ul) return;
    while (ul.firstChild) ul.removeChild(ul.firstChild);
    var items = loadCustom().slice().reverse(); // newest first
    if (!items.length) {
      var empty = document.createElement('li');
      empty.className = 'muted';
      empty.textContent = 'No saved custom texts yet.';
      ul.appendChild(empty);
      return;
    }
    items.forEach(function (item) {
      var li = document.createElement('li');
      li.className = 'custom-row';

      var preview = document.createElement('span');
      preview.className = 'custom-preview';
      preview.textContent =
        item.text.length > PREVIEW_LEN ? item.text.slice(0, PREVIEW_LEN) + '…' : item.text;
      li.appendChild(preview);

      var meta = document.createElement('span');
      meta.className = 'muted custom-meta';
      var dateStr = '';
      try {
        var d = new Date(item.dateISO);
        dateStr = isNaN(d.getTime()) ? '' : d.toLocaleDateString() + ' ';
      } catch (e) { /* ignore */ }
      meta.textContent = dateStr + '(' + (item.lang || 'en') + ', ' + item.text.length + ' chars)';
      li.appendChild(meta);

      var actions = document.createElement('span');
      actions.className = 'row-actions';

      var btnUse = document.createElement('button');
      btnUse.type = 'button';
      btnUse.className = 'btn btn-secondary';
      btnUse.textContent = 'Use';
      btnUse.setAttribute('aria-label', 'Use this custom text for a test');
      btnUse.addEventListener('click', function () {
        if (useText(item.text)) toast('Custom text loaded — good luck!');
        else toast('Engine is not ready yet — try again in a moment.');
      });

      var btnShare = document.createElement('button');
      btnShare.type = 'button';
      btnShare.className = 'btn btn-ghost';
      btnShare.textContent = 'Share';
      btnShare.setAttribute('aria-label', 'Copy a share link for this text');
      btnShare.addEventListener('click', function () {
        shareText(item.text);
      });

      var btnDel = document.createElement('button');
      btnDel.type = 'button';
      btnDel.className = 'btn btn-ghost btn-icon';
      btnDel.textContent = '×';
      btnDel.setAttribute('aria-label', 'Delete this custom text');
      btnDel.addEventListener('click', function () {
        var all = loadCustom().filter(function (e) {
          return e.id !== item.id;
        });
        saveCustom(all);
        renderList();
        toast('Custom text deleted.');
      });

      actions.appendChild(btnUse);
      actions.appendChild(btnShare);
      actions.appendChild(btnDel);
      li.appendChild(actions);
      ul.appendChild(li);
    });
  }

  /* ---------------- button handlers ---------------- */
  function onSave() {
    var v = validate(trimmedInput());
    updateCounter();
    if (!v.ok) {
      toast(v.error);
      return;
    }
    var all = loadCustom();
    all.push({ id: makeId(), dateISO: new Date().toISOString(), text: v.text.slice(0, MAX_LEN), lang: currentLang() });
    saveCustom(all);
    renderList();
    toast('Custom text saved.');
  }
  function onUse() {
    var v = validate(trimmedInput());
    updateCounter();
    if (!v.ok) {
      toast(v.error);
      return;
    }
    if (useText(v.text)) toast('Custom text loaded — good luck!');
    else toast('Engine is not ready yet — try again in a moment.');
  }
  function onShare() {
    var v = validate(trimmedInput());
    updateCounter();
    if (!v.ok) {
      toast(v.error);
      return;
    }
    shareText(v.text);
  }
  function onFileChange(e) {
    try {
      var input = e && e.target;
      var file = input && input.files && input.files[0];
      if (!file) return;
      if (typeof FileReader === 'undefined') {
        toast('File import is not supported in this browser.');
        return;
      }
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var text = String(reader.result || '').slice(0, MAX_LEN);
          var ta = textarea();
          if (ta) ta.value = text;
          updateCounter();
          toast('Imported ' + (file.name || 'file') + ' (' + text.length + ' chars).');
        } catch (err) {
          toast('Could not read that file.');
        }
      };
      reader.onerror = function () {
        toast('Could not read that file.');
      };
      reader.readAsText(file);
      try {
        input.value = ''; // allow re-selecting the same file
      } catch (err) { /* ignore */ }
    } catch (e) {
      toast('Could not read that file.');
    }
  }

  /* ---------------- #t= share links ---------------- */
  function textFromHash() {
    try {
      var h = window.location && window.location.hash;
      if (typeof h === 'string' && h.indexOf('#t=') === 0) {
        var decoded = decodeURIComponent(h.slice(3));
        if (decoded) return decoded;
      }
    } catch (e) { /* malformed hash -> ignore */ }
    return null;
  }
  function applyHash() {
    var text = textFromHash();
    if (!text || text === lastAppliedHashText) return;
    lastAppliedHashText = text;
    if (useText(text)) toast('Shared custom text loaded.');
  }

  /* ---------------- init ---------------- */
  function init() {
    var ta = textarea();
    if (ta) {
      try {
        if (!ta.getAttribute('maxlength')) ta.setAttribute('maxlength', String(MAX_LEN));
      } catch (e) { /* ignore */ }
      ta.addEventListener('input', updateCounter);
    }
    pickAll(['btn-save-custom', 'btn-custom-save']).forEach(function (b) {
      b.addEventListener('click', onSave);
    });
    pickAll(['btn-use-custom', 'btn-custom-use']).forEach(function (b) {
      b.addEventListener('click', onUse);
    });
    pickAll(['btn-share-custom', 'btn-custom-share']).forEach(function (b) {
      b.addEventListener('click', onShare);
    });
    var file = $('custom-file');
    if (file) file.addEventListener('change', onFileChange);
    window.addEventListener('hashchange', applyHash);
    updateCounter();
    renderList();
    applyHash();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
