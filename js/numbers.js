/*
 * Every setting on this page is a contenteditable div, so its value is
 * whatever the user typed - including nothing, or "abc". The game used to
 * hand that text straight to arithmetic, which produced silent nonsense:
 * an empty shoe at 0 decks, a running count stuck at NaN, a dealer speed of
 * NaN ms that dealt instantly. Nums.read() is the one place that turns a
 * field into a usable number, and normalize() writes the clamped value back
 * so what is on screen is what the game is actually using.
 */
(function (global) {
  'use strict';

  function clean(text) {
    return String(text == null ? '' : text).replace(/[^0-9.eE+-]/g, '').trim();
  }

  // opts: {fallback, min, max, integer}
  function parse(text, opts) {
    opts = opts || {};
    var n = parseFloat(clean(text));
    if (!isFinite(n)) n = opts.fallback;
    if (!isFinite(n)) n = 0;
    if (opts.integer) n = Math.round(n);
    if (typeof opts.min === 'number' && n < opts.min) n = opts.min;
    if (typeof opts.max === 'number' && n > opts.max) n = opts.max;
    return n;
  }

  function read(id, opts) {
    var el = typeof id === 'string' ? document.getElementById(id) : id;
    return parse(el ? el.innerText : '', opts);
  }

  // Read, then put the corrected value back in the field (unless the user is
  // still typing in it) so the display never disagrees with the game.
  function normalize(id, opts) {
    var el = typeof id === 'string' ? document.getElementById(id) : id;
    var n = parse(el ? el.innerText : '', opts);
    if (el && el !== document.activeElement && String(el.innerText).trim() !== String(n)) {
      el.innerText = String(n);
    }
    return n;
  }

  // The settings this file knows how to sanitize, in one place.
  var SPEC = {
    decksInShoe: { fallback: 6, min: 1, max: 12, integer: true },
    deckPen: { fallback: 0.8, min: 0.05, max: 0.95 },
    speed: { fallback: 500, min: 0, max: 10000 },
    setBankroll: { fallback: 10000, min: 0 },
    failMargin: { fallback: 0.05, min: 0 },
    countTag: { fallback: 0, min: -10, max: 10 },
    bet: { fallback: 0, min: 0, integer: true },
    // The table only ever deals one or two hands, so the spread's Hands
    // column cannot mean anything else - a 3 there could never be graded.
    hands: { fallback: 1, min: 1, max: 2, integer: true }
  };

  function setting(name, id) {
    return normalize(id || name, SPEC[name]);
  }

  // Tidy each settings field the moment the user leaves it.
  function watch() {
    ['decksInShoe', 'deckPen', 'speed', 'setBankroll', 'failMargin'].forEach(function (name) {
      var el = document.getElementById(name);
      if (!el) return;
      el.addEventListener('blur', function () { normalize(el, SPEC[name]); });
    });
    for (var i = 0; i < 11; i++) {
      bindCell(document.getElementById('B' + i), SPEC.bet);
      bindCell(document.querySelector('#betGrid #H' + i), SPEC.hands);
    }
  }

  function bindCell(el, spec) {
    if (!el) return;
    el.addEventListener('blur', function () { normalize(el, spec); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', watch);
  } else {
    watch();
  }

  global.Nums = { read: read, parse: parse, normalize: normalize, setting: setting, SPEC: SPEC };
}(window));
