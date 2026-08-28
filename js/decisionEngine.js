/*
 * decisionEngine.js
 * Turns a hand, a dealer upcard and a true count into the correct play.
 *
 * Both consumers share this one path: the strategy page renders the tables it
 * produces, and auto-play asks it what to press. That means what auto-play
 * does and what the page shows can never drift apart.
 */
(function (global) {
  'use strict';

  var FACE = { J: 10, Q: 10, K: 10 };

  function rankValue(rank) {
    if (rank === 'A') return 11;
    if (FACE[rank]) return 10;
    return parseInt(rank, 10);
  }

  /** Best total for a hand, plus whether an ace is still counted as eleven. */
  function evaluate(ranks) {
    var total = 0;
    var aces = 0;
    ranks.forEach(function (r) {
      var v = rankValue(r);
      if (r === 'A') aces += 1;
      total += v;
    });
    while (total > 21 && aces > 0) { total -= 10; aces -= 1; }
    return { total: total, soft: aces > 0 };
  }

  function pairKey(ranks) {
    if (ranks.length !== 2) return null;
    var a = rankValue(ranks[0]);
    var b = rankValue(ranks[1]);
    if (a !== b) return null;
    if (a === 11) return 'A,A';
    if (a === 10) return '10,10';
    return a + ',' + a;
  }

  function dealerKey(rank) {
    if (rank === 'A') return 'A';
    if (FACE[rank]) return '10';
    return String(rank);
  }

  function tablesFor(setId, trueCount) {
    var set = global.StrategyData.sets[setId] || global.StrategyData.sets.s17;
    if (!global.Deviations || typeof trueCount !== 'number' || isNaN(trueCount)) {
      return { hard: set.hard, soft: set.soft, pairs: set.pairs, changed: {}, applied: [] };
    }
    return global.Deviations.applyTo(set, trueCount);
  }

  /**
   * Resolve a table code against what the table actually allows right now.
   * @param {string} code one of H S D Ds P Rh Rs Rp
   * @returns {string} H, S, D, P or R
   */
  function resolve(code, rules) {
    switch (code) {
      case 'D':  return rules.canDouble ? 'D' : 'H';
      case 'Ds': return rules.canDouble ? 'D' : 'S';
      case 'P':  return rules.canSplit ? 'P' : null;   // caller re-reads as a non-pair
      case 'Rh': return rules.canSurrender ? 'R' : 'H';
      case 'Rs': return rules.canSurrender ? 'R' : 'S';
      case 'Rp': return rules.canSurrender ? 'R' : (rules.canSplit ? 'P' : null);
      default:   return code;                          // H or S
    }
  }

  /**
   * @param {object} ctx
   *   ranks         array of card ranks, e.g. ['A','7']
   *   dealer        dealer upcard rank
   *   trueCount     current true count (deviations are applied at it)
   *   setId         's17' or 'h17'
   *   canDouble / canSplit / canSurrender   what the table offers right now
   * @returns {{action:string, code:string, source:string, row:string}}
   */
  function decide(ctx) {
    var rules = {
      canDouble: !!ctx.canDouble,
      canSplit: !!ctx.canSplit,
      canSurrender: !!ctx.canSurrender
    };
    var tables = tablesFor(ctx.setId || 's17', ctx.trueCount);
    var cols = global.StrategyData.DEALER;
    var col = cols.indexOf(dealerKey(ctx.dealer));
    if (col < 0) col = 0;

    var hand = evaluate(ctx.ranks);
    var key = pairKey(ctx.ranks);
    var changedAt = function (section, row) {
      return !!tables.changed[section + ':' + row + ':' + col];
    };

    // Pairs first: a split decision outranks the total.
    if (key && rules.canSplit && tables.pairs[key]) {
      var pairCode = tables.pairs[key][col];
      var pairAction = resolve(pairCode, rules);
      if (pairAction) {
        return { action: pairAction, code: pairCode, row: key, section: 'pairs',
                 deviated: changedAt('pairs', key) };
      }
    }

    // Soft totals, while the ace can still be counted as eleven.
    if (hand.soft && hand.total <= 21) {
      var n = hand.total - 11;
      if (n === 1) {
        // A,A that could not be split plays as soft twelve: always hit.
        return { action: 'H', code: 'H', row: 'A,A', section: 'soft', deviated: false };
      }
      var softRow = 'A,' + n;
      if (tables.soft[softRow]) {
        var softCode = tables.soft[softRow][col];
        return { action: resolve(softCode, rules) || 'H', code: softCode, row: softRow,
                 section: 'soft', deviated: changedAt('soft', softRow) };
      }
      return { action: 'S', code: 'S', row: 'soft ' + hand.total, section: 'soft', deviated: false };
    }

    // Hard totals.
    var hardRow;
    if (hand.total >= 18) hardRow = '18+';
    else if (hand.total <= 5) hardRow = '5';
    else hardRow = String(hand.total);

    var hardCode = (tables.hard[hardRow] || tables.hard['18+'])[col];
    return { action: resolve(hardCode, rules) || 'H', code: hardCode, row: hardRow,
             section: 'hard', deviated: changedAt('hard', hardRow) };
  }

  global.Decision = {
    rankValue: rankValue,
    evaluate: evaluate,
    pairKey: pairKey,
    dealerKey: dealerKey,
    tablesFor: tablesFor,
    decide: decide
  };
})(window);
