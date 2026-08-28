/*
 * deviations.js
 * Hi-Lo true-count index plays: the Illustrious 18 and the Fab 4 surrenders,
 * plus the machinery to fold them into the basic strategy tables at a given
 * true count.
 *
 * An index play fires when the true count reaches its threshold:
 *   dir '>=' - play the deviation at or above the index
 *   dir '<=' - play the deviation at or below the index
 *
 * Indexes are the standard Hi-Lo set for 4-8 decks. They are quoted for S17
 * and are close enough under H17 that the same numbers are taught for both;
 * where H17 changes the underlying basic strategy, the deviation is applied
 * on top of whichever base cell is showing.
 *
 * An index play replaces the cell outright, surrender included: "15 vs 10,
 * stand at +4" means stop surrendering that hand and stand once the count
 * gets there. So the surrender indexes are applied first and the hit/stand
 * and double indexes on top, letting the higher threshold win where a hand
 * appears in both lists.
 */
(function (global) {
  'use strict';

  // Insurance is not a table cell - it is listed for completeness and shown
  // on the strategy page, but the simulator does not offer the bet.
  var INSURANCE = { index: 3, dir: '>=', text: 'Take insurance at true count +3 or higher.' };

  var ILLUSTRIOUS_18 = [
    { section: 'hard',  row: '16',    dealer: '10', action: 'S', index: 0,  dir: '>=' },
    { section: 'hard',  row: '15',    dealer: '10', action: 'S', index: 4,  dir: '>=' },
    { section: 'pairs', row: '10,10', dealer: '5',  action: 'P', index: 5,  dir: '>=' },
    { section: 'pairs', row: '10,10', dealer: '6',  action: 'P', index: 4,  dir: '>=' },
    { section: 'hard',  row: '10',    dealer: '10', action: 'D', index: 4,  dir: '>=' },
    { section: 'hard',  row: '12',    dealer: '3',  action: 'S', index: 2,  dir: '>=' },
    { section: 'hard',  row: '12',    dealer: '2',  action: 'S', index: 3,  dir: '>=' },
    { section: 'hard',  row: '11',    dealer: 'A',  action: 'D', index: 1,  dir: '>=' },
    { section: 'hard',  row: '9',     dealer: '2',  action: 'D', index: 1,  dir: '>=' },
    { section: 'hard',  row: '10',    dealer: 'A',  action: 'D', index: 4,  dir: '>=' },
    { section: 'hard',  row: '9',     dealer: '7',  action: 'D', index: 3,  dir: '>=' },
    { section: 'hard',  row: '16',    dealer: '9',  action: 'S', index: 5,  dir: '>=' },
    { section: 'hard',  row: '13',    dealer: '2',  action: 'H', index: -1, dir: '<=' },
    { section: 'hard',  row: '12',    dealer: '4',  action: 'H', index: 0,  dir: '<=' },
    { section: 'hard',  row: '12',    dealer: '5',  action: 'H', index: -2, dir: '<=' },
    { section: 'hard',  row: '12',    dealer: '6',  action: 'H', index: -1, dir: '<=' },
    { section: 'hard',  row: '13',    dealer: '3',  action: 'H', index: -2, dir: '<=' }
  ];

  var FAB_4 = [
    { section: 'hard', row: '14', dealer: '10', action: 'R', index: 3, dir: '>=' },
    { section: 'hard', row: '15', dealer: '9',  action: 'R', index: 2, dir: '>=' },
    { section: 'hard', row: '15', dealer: 'A',  action: 'R', index: 1, dir: '>=' },
    { section: 'hard', row: '15', dealer: '10', action: 'R', index: 0, dir: '>=' }
  ];

  // Commonly taught indexes beyond the headline eighteen. They matter often
  // enough that leaving them out makes auto-play visibly sub-optimal.
  var EXTRA = [
    { section: 'soft',  row: 'A,8',   dealer: '6', action: 'Ds', index: 1, dir: '>=' },
    { section: 'soft',  row: 'A,8',   dealer: '5', action: 'Ds', index: 1, dir: '>=' },
    { section: 'soft',  row: 'A,8',   dealer: '4', action: 'Ds', index: 3, dir: '>=' },
    { section: 'soft',  row: 'A,6',   dealer: '2', action: 'D',  index: 1, dir: '>=' },
    { section: 'hard',  row: '8',     dealer: '6', action: 'D',  index: 2, dir: '>=' },
    { section: 'pairs', row: '10,10', dealer: '4', action: 'P',  index: 6, dir: '>=' }
  ];

  var ALL = FAB_4.concat(ILLUSTRIOUS_18, EXTRA);

  function label(dev) {
    var hand = dev.section === 'hard' ? 'Hard ' + dev.row : dev.row;
    return hand + ' vs ' + dev.dealer;
  }

  function describe(dev) {
    var verb = { S: 'stand', H: 'hit', D: 'double', Ds: 'double', P: 'split', R: 'surrender' }[dev.action];
    return label(dev) + ': ' + verb + ' at true count ' +
      (dev.dir === '>=' ? '+' + dev.index + ' or higher' : dev.index + ' or lower') + '.';
  }

  function fires(dev, trueCount) {
    return dev.dir === '>=' ? trueCount >= dev.index : trueCount <= dev.index;
  }

  var SURRENDER_CODES = { Rh: 'H', Rs: 'S', Rp: 'P' };

  /**
   * Merge one deviation action into a base cell.
   *
   * A surrender index ('R') turns the cell into the surrender form of
   * whatever it was, so the fallback stays right where surrender is off the
   * table. Every other index replaces the cell outright - including over a
   * surrender, which is exactly what a stand index on 15 vs 10 is for.
   */
  function merge(base, action) {
    if (action === 'R') {
      if (SURRENDER_CODES[base]) return base;
      if (base === 'S' || base === 'Ds') return 'Rs';
      if (base === 'P') return 'Rp';
      return 'Rh';
    }
    return action;
  }

  function cloneSection(section) {
    var out = {};
    for (var key in section) out[key] = section[key].slice();
    return out;
  }

  /**
   * Apply every firing index play to a rule set.
   * @returns {{hard,soft,pairs,changed:Object,applied:Array}} changed is keyed
   *   "section:row:col" so the renderer can highlight what moved.
   */
  function applyTo(set, trueCount) {
    var dealerCols = global.StrategyData.DEALER;
    var result = {
      hard: cloneSection(set.hard),
      soft: cloneSection(set.soft),
      pairs: cloneSection(set.pairs),
      changed: {},
      applied: []
    };

    // A surrender index is also a floor: below it, a hand that basic strategy
    // surrenders is played out instead. (Fab 4 "15 vs 10, surrender at 0"
    // means hit it at a negative count.)
    FAB_4.forEach(function (dev) {
      if (fires(dev, trueCount)) return;
      var row = result[dev.section][dev.row];
      if (!row) return;
      var col = dealerCols.indexOf(dev.dealer);
      if (col < 0) return;
      var fallback = SURRENDER_CODES[row[col]];
      if (!fallback) return;

      result.changed[dev.section + ':' + dev.row + ':' + col] =
        { from: row[col], to: fallback, dev: dev, lifted: true };
      row[col] = fallback;
    });

    ALL.forEach(function (dev) {
      if (!fires(dev, trueCount)) return;
      var table = result[dev.section];
      var row = table[dev.row];
      if (!row) return;
      var col = dealerCols.indexOf(dev.dealer);
      if (col < 0) return;

      var before = row[col];
      var after = merge(before, dev.action);
      result.applied.push({ dev: dev, from: before, to: after, changed: before !== after });
      if (after === before) return;

      row[col] = after;
      result.changed[dev.section + ':' + dev.row + ':' + col] = { from: before, to: after, dev: dev };
    });

    return result;
  }

  global.Deviations = {
    INSURANCE: INSURANCE,
    ILLUSTRIOUS_18: ILLUSTRIOUS_18,
    FAB_4: FAB_4,
    EXTRA: EXTRA,
    ALL: ALL,
    label: label,
    describe: describe,
    fires: fires,
    applyTo: applyTo
  };
})(window);
