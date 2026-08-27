/*
 * gameSettings.js
 * Persists the simulator's checkbox options in the cookie store.
 *
 * The editable strategy grids are saved by the game's own "Save Changes"
 * button; the alert toggles and the skip-dealer-blackjack option are saved
 * the moment they change, since there is nothing to review before saving.
 */
(function (global) {
  'use strict';

  var BOXES = ['check1', 'check2', 'check3', 'check4'];
  var PREFIX = 'opt_';

  function store() { return global.CookieStore || global.localStorage; }

  function restore() {
    BOXES.forEach(function (id) {
      var box = document.getElementById(id);
      if (!box) return;
      var saved = store().getItem(PREFIX + id);
      if (saved !== null && saved !== undefined) box.checked = saved === 'true';
      box.addEventListener('change', function () {
        store().setItem(PREFIX + id, box.checked ? 'true' : 'false');
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', restore);
  else restore();
})(window);
