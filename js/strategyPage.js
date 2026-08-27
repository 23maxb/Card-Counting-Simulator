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

  function buildTable(section, title, rowLabel) {
    var set = data.sets[currentSet];
    var rows = set[section];

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
        html += '<td class="' + cls + '">' + code + '</td>';
      });
      html += '</tr>';
    });

    html += '</tbody></table></div></section>';
    return html;
  }

  function render() {
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
    var set = data.sets[currentSet];
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

    var note = 'Loaded the ' + set.label.split(' — ')[0] + ' tables into the simulator. Open it to play.';
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

    document.getElementById('applyButton').addEventListener('click', applyToSimulator);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
