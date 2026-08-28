/*
 * strategyPage.js
 * Renders the S17 / H17 basic strategy tables and can push either set into
 * the simulator's own editable grids (via the shared cookie store).
 */
(function (global) {
  'use strict';

  var data = global.StrategyData;
  var currentSet = 's17';
  var showDiff = false;
  var showTricky = false;
  var trueCount = null;      // the count in the field, or null when never set
  var applyCount = false;    // false = plain basic strategy, no index plays
  var deviated = null;       // cached result of applying deviations at trueCount

  // section -> row -> Set of dealer column indexes flagged as tricky
  var trickyIndex = (function () {
    var index = {};
    data.TRICKY.forEach(function (item) {
      index[item.section] = index[item.section] || {};
      index[item.section][item.row] = index[item.section][item.row] || [];
      item.dealers.forEach(function (d) {
        var col = data.DEALER.indexOf(d);
        if (col >= 0) index[item.section][item.row].push(col);
      });
    });
    return index;
  })();

  function isTricky(section, rowKey, col) {
    var rows = trickyIndex[section];
    return !!(rows && rows[rowKey] && rows[rowKey].indexOf(col) >= 0);
  }

  function cellClass(code) {
    return 'act act-' + code.toLowerCase();
  }

  function differs(section, rowKey, col) {
    var a = data.sets.s17[section][rowKey];
    var b = data.sets.h17[section][rowKey];
    return a && b && a[col] !== b[col];
  }

  function countIsLive() {
    return applyCount && trueCount !== null;
  }

  function activeTables() {
    var set = data.sets[currentSet];
    if (!countIsLive()) return { hard: set.hard, soft: set.soft, pairs: set.pairs, changed: {} };
    return global.Deviations.applyTo(set, trueCount);
  }

  function buildTable(section, title, rowLabel) {
    var rows = deviated[section];

    var html = '<section class="table-block"><h2>' + title + '</h2>';
    html += '<div class="table-scroll"><table><thead><tr><th class="corner">' + rowLabel + '</th>';
    data.DEALER.forEach(function (d) { html += '<th>' + d + '</th>'; });
    html += '</tr></thead><tbody>';

    Object.keys(rows).forEach(function (key) {
      html += '<tr><th class="rowhead">' + key + '</th>';
      rows[key].forEach(function (code, col) {
        var cls = cellClass(code);
        if (showDiff && differs(section, key, col)) cls += ' act-diff';
        if (showTricky && isTricky(section, key, col)) cls += ' act-tricky';
        var moved = deviated.changed[section + ':' + key + ':' + col];
        if (moved) cls += ' act-moved';
        var titleAttr = moved ? ' title="' + moved.from + ' \u2192 ' + moved.to + ' at this true count"' : '';
        html += '<td class="' + cls + '"' + titleAttr + '>' + code + '</td>';
      });
      html += '</tr>';
    });

    html += '</tbody></table></div></section>';
    return html;
  }

  function render() {
    deviated = activeTables();
    renderCountSummary();
    document.getElementById('tables').innerHTML =
      buildTable('hard', 'Hard totals', 'Player') +
      buildTable('soft', 'Soft totals', 'Player') +
      buildTable('pairs', 'Pairs', 'Player');

    document.getElementById('setLabel').textContent = data.sets[currentSet].label;
    document.getElementById('trickyPanel').style.display = showTricky ? 'block' : 'none';

    ['s17', 'h17'].forEach(function (id) {
      var btn = document.getElementById('tab-' + id);
      btn.className = 'tab' + (id === currentSet ? ' tab-active' : '');
    });
  }

  /* ---- true count controls ------------------------------------------- */

  function renderCountSummary() {
    var box = document.getElementById('countSummary');
    var list = document.getElementById('deviationList');

    if (!countIsLive()) {
      box.textContent = 'Showing plain basic strategy. Enter a true count to fold in Hi-Lo index plays.';
      box.className = 'count-summary';
      list.innerHTML = '';
      document.getElementById('changePanel').style.display = 'none';
      renderIndexReference(null);
      return;
    }

    var moved = Object.keys(deviated.changed).length;
    box.innerHTML = 'At true count <b>' + formatCount(trueCount) + '</b>: ' +
      (moved ? moved + ' cell' + (moved === 1 ? '' : 's') + ' changed, highlighted below.'
             : 'no index play changes the table yet.') +
      (trueCount === 0 && moved
        ? ' A true count of zero is still a real count - several indexes fire at 0. ' +
          'Untick <b>Apply index plays</b> for the plain chart.'
        : '');
    box.className = 'count-summary count-summary-live';

    var html = '';
    Object.keys(deviated.changed).forEach(function (key) {
      var change = deviated.changed[key];
      html += '<li><b>' + global.Deviations.label(change.dev) + '</b>: ' +
        change.from + ' \u2192 ' + change.to + '</li>';
    });
    list.innerHTML = html;
    document.getElementById('changePanel').style.display = html ? 'block' : 'none';

    renderIndexReference(countIsLive() ? trueCount : null);
  }

  function formatCount(n) {
    return (n > 0 ? '+' : '') + (Math.round(n * 10) / 10);
  }

  // The full index list, with the ones currently in force marked.
  function renderIndexReference(tc) {
    var html = '';
    var ins = global.Deviations.INSURANCE;
    var insLive = tc !== null && tc >= ins.index;
    html += '<li class="' + (insLive ? 'index-live' : '') + '">' + ins.text + '</li>';

    global.Deviations.ALL.forEach(function (dev) {
      var live = tc !== null && global.Deviations.fires(dev, tc);
      html += '<li class="' + (live ? 'index-live' : '') + '">' + global.Deviations.describe(dev) + '</li>';
    });
    document.getElementById('indexList').innerHTML = html;
  }

  /**
   * @param {*} value the count to show, or null to clear it entirely.
   * @param {boolean} [live] whether index plays are applied. Touching the
   *   field or the slider turns them on; only Clear and the checkbox turn
   *   them off, so the slider resting at 0 is never mistaken for "off".
   */
  function setTrueCount(value, live) {
    var input = document.getElementById('countInput');
    var check = document.getElementById('countApply');

    if (value === null || value === '' || isNaN(parseFloat(value))) {
      trueCount = null;
      input.value = '';
    } else {
      trueCount = parseFloat(value);
    }

    if (live !== undefined) applyCount = live;
    if (trueCount === null) applyCount = false;
    check.checked = applyCount;

    document.getElementById('countSlider').value = trueCount === null ? 0 : Math.max(-6, Math.min(10, trueCount));
    render();
  }

  /* ---- pushing a table into the simulator ---------------------------- */

  // The simulator's hard grid has no surrender codes of its own; surrender
  // lives in its own small grid, so hard cells store the fallback action.
  function hardFallback(code) {
    if (code === 'Rh') return 'H';
    if (code === 'Rs') return 'S';
    return code;
  }

  function applyToSimulator() {
    if (!global.CookieStore) return status('Cookie store not loaded.', true);
    var set = deviated;   // whatever the page is showing, index plays included
    var d;

    // Hard totals 8-17 -> H{dealer}{17 - total}
    for (var total = 8; total <= 17; total++) {
      var hardRow = set.hard[String(total)];
      for (d = 0; d < 10; d++) {
        global.CookieStore.setItem('H' + d + (17 - total), hardFallback(hardRow[d]));
      }
    }

    // Soft A,2 - A,9 -> S{dealer}{9 - n}
    for (var n = 2; n <= 9; n++) {
      var softRow = set.soft['A,' + n];
      for (d = 0; d < 10; d++) {
        global.CookieStore.setItem('S' + d + (9 - n), softRow[d]);
      }
    }

    // Pairs -> P{dealer}{index}, stored as the simulator's Y/N answer.
    var pairOrder = ['A,A', '10,10', '9,9', '8,8', '7,7', '6,6', '5,5', '4,4', '3,3', '2,2'];
    pairOrder.forEach(function (key, i) {
      var pairRow = set.pairs[key];
      for (var c = 0; c < 10; c++) {
        var isSplit = pairRow[c] === 'P' || pairRow[c] === 'Rp';
        global.CookieStore.setItem('P' + c + i, isSplit ? 'Y' : 'N');
      }
    });

    // Surrender grid covers hard 16, 15, 14 -> U{dealer}{16 - total}
    for (var t = 14; t <= 16; t++) {
      var srow = set.hard[String(t)];
      for (d = 0; d < 10; d++) {
        var isSurrender = srow[d] === 'Rh' || srow[d] === 'Rs';
        global.CookieStore.setItem('U' + d + (16 - t), isSurrender ? 'U' : '');
      }
    }

    global.CookieStore.setItem('S17D', currentSet === 's17' ? 'true' : 'false');
    global.CookieStore.flush();

    var note = 'Loaded the ' + data.sets[currentSet].label.split(' \u2014 ')[0] + ' tables into the simulator. Open it to play.';
    if (countIsLive()) {
      note = 'Loaded the ' + data.sets[currentSet].label.split(' \u2014 ')[0] +
        ' tables as they stand at true count ' + formatCount(trueCount) +
        ' into the simulator. Open it to play.';
    }
    if (currentSet === 'h17') {
      note += ' Two H17 calls have nowhere to live in the simulator grids: hard 17 vs A surrender, ' +
        'and 8,8 vs A surrender (stored as a split).';
    }
    status(note);
  }

  function status(text, isError) {
    var el = document.getElementById('applyStatus');
    el.textContent = text;
    el.className = 'apply-status' + (isError ? ' apply-status-error' : '');
  }

  /* ---- static page furniture ---------------------------------------- */

  function renderLegend() {
    var html = '';
    data.LEGEND.forEach(function (item) {
      html += '<li><span class="' + cellClass(item.code) + '">' + item.code + '</span>' + item.text + '</li>';
    });
    document.getElementById('legend').innerHTML = html;

    var tricky = '';
    data.TRICKY.forEach(function (item) {
      var label = item.section === 'pairs' ? item.row : (item.section === 'soft' ? item.row : 'Hard ' + item.row);
      tricky += '<li><b>' + label + ' vs ' + item.dealers.join(', ') + '</b> — ' + item.why + '</li>';
    });
    document.getElementById('trickyList').innerHTML = tricky;

    var diffs = '';
    data.DIFFERENCES.forEach(function (line) { diffs += '<li>' + line + '</li>'; });
    document.getElementById('differences').innerHTML = diffs;

    document.getElementById('conditions').textContent = data.conditions;
  }

  function init() {
    renderLegend();
    render();

    ['s17', 'h17'].forEach(function (id) {
      document.getElementById('tab-' + id).addEventListener('click', function () {
        currentSet = id;
        render();
      });
    });

    document.getElementById('diffToggle').addEventListener('change', function (e) {
      showDiff = e.target.checked;
      render();
    });

    document.getElementById('trickyToggle').addEventListener('change', function (e) {
      showTricky = e.target.checked;
      render();
    });

    var input = document.getElementById('countInput');
    var slider = document.getElementById('countSlider');

    input.addEventListener('input', function () { setTrueCount(input.value, true); });
    slider.addEventListener('input', function () {
      input.value = slider.value;
      setTrueCount(slider.value, true);
    });
    document.getElementById('countClear').addEventListener('click', function () { setTrueCount(null, false); });
    document.getElementById('countApply').addEventListener('change', function (e) {
      // Ticking the box with an empty field means "apply at zero".
      if (e.target.checked && trueCount === null) {
        // Ticking with an empty field means "apply at zero" - show that.
        document.getElementById('countInput').value = '0';
        return setTrueCount(0, true);
      }
      setTrueCount(trueCount, e.target.checked);
    });

    document.getElementById('applyButton').addEventListener('click', applyToSimulator);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
