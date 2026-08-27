/*
 * skins.js
 * Card skin registry: resolves a card code (e.g. "AS", "0H", "back") to an
 * image URL for whichever pack is active, and re-skins cards already on the
 * table when the pack changes.
 *
 * Pack sources
 *   built-in  - the PNGs shipped in the repo root, plus vector packs drawn
 *               by svgDeck.js
 *   uploaded  - packs the user drags in, kept in IndexedDB (too large for
 *               cookies) with only the selected pack id in the cookie store
 */
(function (global) {
  'use strict';

  var DB_NAME = 'bjcs-skins';
  var DB_STORE = 'packs';
  var ACTIVE_KEY = 'activeSkin';

  var builtIn = [
    { id: 'classic', name: 'Classic (original PNGs)', kind: 'files', ext: 'png', base: '' },
    { id: 'vector-modern', name: 'Vector Modern', kind: 'vector', theme: 'modern' },
    { id: 'vector-noir', name: 'Vector Noir', kind: 'vector', theme: 'noir' }
  ];

  var packs = {};        // id -> { id, name, images, builtIn }
  var activeId = 'classic';
  var listeners = [];
  var objectUrls = [];   // revoked when an uploaded pack is swapped out

  function store() {
    return global.CookieStore || global.localStorage;
  }

  /* ---- IndexedDB (uploaded packs) ---------------------------------- */

  function openDb() {
    return new Promise(function (resolve, reject) {
      if (!global.indexedDB) return reject(new Error('IndexedDB unavailable'));
      var req = global.indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function () {
        if (!req.result.objectStoreNames.contains(DB_STORE)) {
          req.result.createObjectStore(DB_STORE, { keyPath: 'id' });
        }
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function dbRequest(mode, run) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(DB_STORE, mode);
        var req = run(tx.objectStore(DB_STORE));
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () { reject(req.error); };
      });
    });
  }

  function loadUploadedPacks() {
    return dbRequest('readonly', function (os) { return os.getAll(); })
      .then(function (rows) {
        (rows || []).forEach(function (row) {
          packs[row.id] = { id: row.id, name: row.name, images: blobsToUrls(row.images), builtIn: false };
        });
      })
      .catch(function (err) {
        console.warn('[skins] could not read uploaded packs', err);
      });
  }

  function blobsToUrls(images) {
    var out = {};
    for (var code in images) {
      var value = images[code];
      if (typeof value === 'string') {
        out[code] = value;
      } else {
        var url = URL.createObjectURL(value);
        objectUrls.push(url);
        out[code] = url;
      }
    }
    return out;
  }

  /* ---- registry ---------------------------------------------------- */

  function registerBuiltIns() {
    builtIn.forEach(function (spec) {
      var images = null;
      if (spec.kind === 'vector' && global.SvgDeck) images = global.SvgDeck.buildDeck(spec.theme);
      packs[spec.id] = {
        id: spec.id,
        name: spec.name,
        images: images,          // null => fall back to file naming
        base: spec.base || '',
        ext: spec.ext || 'png',
        builtIn: true
      };
    });
  }

  function resolveIn(packId, code) {
    var pack = packs[packId] || packs.classic;
    if (pack.images && pack.images[code]) return pack.images[code];
    if (pack.images) {
      // Pack is missing this face: fall back to the classic art so the table
      // never renders a broken image.
      return (packs.classic.base || '') + code + '.png';
    }
    return pack.base + code + '.' + pack.ext;
  }

  function resolve(code) {
    return resolveIn(activeId, code);
  }

  /* ---- applying to the DOM ----------------------------------------- */

  function reskinDocument() {
    var imgs = document.querySelectorAll('img[data-card]');
    for (var i = 0; i < imgs.length; i++) {
      imgs[i].src = resolve(imgs[i].getAttribute('data-card'));
    }
  }

  function notify() {
    reskinDocument();
    listeners.forEach(function (fn) {
      try { fn(activeId); } catch (e) { console.warn('[skins] listener failed', e); }
    });
  }

  var Skins = {
    /** Image URL for a card code such as "AS", "0H" or "back". */
    src: function (code) { return resolve(code); },

    /** Same, but for a specific pack - used to preview packs in the picker. */
    srcFor: function (packId, code) { return resolveIn(packId, code); },

    back: function () { return resolve('back'); },

    list: function () {
      return Object.keys(packs).map(function (id) {
        return { id: id, name: packs[id].name, builtIn: packs[id].builtIn };
      });
    },

    active: function () { return activeId; },

    setActive: function (id) {
      if (!packs[id]) return false;
      activeId = id;
      try { store().setItem(ACTIVE_KEY, id); } catch (e) { /* ignore */ }
      notify();
      return true;
    },

    onChange: function (fn) { listeners.push(fn); },

    /**
     * Save an uploaded pack. images is { CODE: Blob|dataURI }; codes are the
     * same rank+suit codes the game uses, plus "back".
     */
    savePack: function (id, name, images) {
      return dbRequest('readwrite', function (os) {
        return os.put({ id: id, name: name, images: images });
      }).then(function () {
        packs[id] = { id: id, name: name, images: blobsToUrls(images), builtIn: false };
        return id;
      });
    },

    deletePack: function (id) {
      if (packs[id] && packs[id].builtIn) return Promise.reject(new Error('built-in packs cannot be deleted'));
      return dbRequest('readwrite', function (os) { return os.delete(id); }).then(function () {
        delete packs[id];
        if (activeId === id) Skins.setActive('classic');
        else notify();
      });
    },

    /** Resolves once uploaded packs are loaded and the saved pack is active. */
    ready: null
  };

  registerBuiltIns();

  Skins.ready = loadUploadedPacks().then(function () {
    var saved;
    try { saved = store().getItem(ACTIVE_KEY); } catch (e) { saved = null; }
    if (saved && packs[saved]) activeId = saved;
    notify();
    return activeId;
  });

  global.Skins = Skins;
})(window);
