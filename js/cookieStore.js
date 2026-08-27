/*
 * cookieStore.js
 * Cookie backed key/value store with a localStorage compatible API.
 *
 * All simulator settings (strategy grids, deviations, bet spreads, house
 * rules, bankroll, chosen skin) live in cookies so they survive across
 * browsers/profiles that clear site storage but keep cookies, and so they
 * can be exported/imported as a single string.
 *
 * A single cookie is capped at ~4 KB, so the whole store is serialised to
 * one JSON blob and split across numbered chunk cookies.
 */
(function (global) {
  'use strict';

  var PREFIX = 'bjcs';
  var CHUNK_SIZE = 3000;       // encoded chars per cookie, safely under 4096
  var MAX_CHUNKS = 24;         // hard ceiling so a bug cannot spam cookies
  var MAX_AGE = 60 * 60 * 24 * 365; // one year

  var memory = {};   // in-memory mirror of the store
  var usable = true; // false when the browser refuses cookies (e.g. file://)
  var flushTimer = null;

  function rawCookies() {
    try {
      return typeof document !== 'undefined' ? (document.cookie || '') : '';
    } catch (e) {
      return '';
    }
  }

  function writeCookie(name, value) {
    try {
      document.cookie = name + '=' + value + ';path=/;max-age=' + MAX_AGE + ';SameSite=Lax';
      return true;
    } catch (e) {
      return false;
    }
  }

  function deleteCookie(name) {
    try {
      document.cookie = name + '=;path=/;max-age=0;SameSite=Lax';
    } catch (e) { /* ignore */ }
  }

  function cookieMap() {
    var map = {};
    var parts = rawCookies().split(';');
    for (var i = 0; i < parts.length; i++) {
      var piece = parts[i].trim();
      if (!piece) continue;
      var eq = piece.indexOf('=');
      if (eq < 0) continue;
      map[piece.slice(0, eq)] = piece.slice(eq + 1);
    }
    return map;
  }

  function cookiesEnabled() {
    var probe = PREFIX + '_probe';
    if (!writeCookie(probe, '1')) return false;
    var ok = cookieMap()[probe] === '1';
    deleteCookie(probe);
    return ok;
  }

  /* ---- persistence ------------------------------------------------- */

  function readChunks() {
    var map = cookieMap();
    var joined = '';
    for (var i = 0; i < MAX_CHUNKS; i++) {
      var chunk = map[PREFIX + '_' + i];
      if (chunk === undefined) break;
      joined += chunk;
    }
    if (!joined) return null;
    try {
      return JSON.parse(decodeURIComponent(joined));
    } catch (e) {
      console.warn('[cookieStore] corrupt cookie data, starting fresh', e);
      return null;
    }
  }

  function writeChunks() {
    if (!usable) {
      try { global.localStorage.setItem(PREFIX + '_fallback', JSON.stringify(memory)); } catch (e) { /* ignore */ }
      return;
    }
    var encoded = encodeURIComponent(JSON.stringify(memory));
    var count = Math.ceil(encoded.length / CHUNK_SIZE) || 1;
    if (count > MAX_CHUNKS) {
      console.warn('[cookieStore] settings exceed cookie capacity; keeping last good state');
      return;
    }
    for (var i = 0; i < count; i++) {
      writeCookie(PREFIX + '_' + i, encoded.substr(i * CHUNK_SIZE, CHUNK_SIZE));
    }
    // Clear any chunks left over from a previously larger payload.
    var map = cookieMap();
    for (var j = count; j < MAX_CHUNKS; j++) {
      if (map[PREFIX + '_' + j] === undefined) break;
      deleteCookie(PREFIX + '_' + j);
    }
  }

  // Grid saves fire hundreds of setItem calls in a row; batch the writes.
  function scheduleFlush() {
    if (flushTimer !== null) return;
    flushTimer = setTimeout(function () {
      flushTimer = null;
      writeChunks();
    }, 0);
  }

  /* ---- bootstrap --------------------------------------------------- */

  usable = cookiesEnabled();

  var loaded = usable ? readChunks() : null;
  if (!loaded && !usable) {
    try { loaded = JSON.parse(global.localStorage.getItem(PREFIX + '_fallback') || 'null'); } catch (e) { loaded = null; }
  }

  if (loaded) {
    memory = loaded;
  } else {
    // First run on this browser: adopt anything the pre-cookie version saved.
    try {
      for (var k = 0; k < global.localStorage.length; k++) {
        var key = global.localStorage.key(k);
        if (key && key.indexOf(PREFIX) !== 0) memory[key] = global.localStorage.getItem(key);
      }
    } catch (e) { /* localStorage unavailable, nothing to migrate */ }
    if (Object.keys(memory).length) writeChunks();
  }

  /* ---- public API -------------------------------------------------- */

  var CookieStore = {
    usingCookies: function () { return usable; },

    getItem: function (key) {
      var k = String(key);
      return Object.prototype.hasOwnProperty.call(memory, k) ? memory[k] : null;
    },

    setItem: function (key, value) {
      memory[String(key)] = String(value);
      scheduleFlush();
    },

    removeItem: function (key) {
      delete memory[String(key)];
      scheduleFlush();
    },

    clear: function () {
      memory = {};
      if (usable) {
        var map = cookieMap();
        for (var name in map) {
          if (name.indexOf(PREFIX + '_') === 0) deleteCookie(name);
        }
      } else {
        try { global.localStorage.removeItem(PREFIX + '_fallback'); } catch (e) { /* ignore */ }
      }
    },

    key: function (i) {
      return Object.keys(memory)[i] || null;
    },

    // Snapshot helpers used by the settings export/import buttons.
    toJSON: function () { return JSON.stringify(memory, null, 2); },

    fromJSON: function (text) {
      var parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object') throw new Error('not a settings object');
      memory = {};
      for (var key in parsed) memory[key] = String(parsed[key]);
      writeChunks();
    },

    flush: writeChunks
  };

  Object.defineProperty(CookieStore, 'length', {
    get: function () { return Object.keys(memory).length; }
  });

  global.CookieStore = CookieStore;
})(window);
