/*
 * strategyData.js
 * Composition-independent basic strategy for 4-8 decks, double after split
 * allowed, late surrender allowed, dealer peeks for blackjack.
 *
 * Two rule sets: S17 (dealer stands on soft 17) and H17 (dealer hits it).
 *
 * Action codes
 *   H   hit                      S   stand
 *   D   double, else hit         Ds  double, else stand
 *   P   split
 *   Rh  surrender, else hit      Rs  surrender, else stand
 *   Rp  surrender, else split
 */
(function (global) {
  'use strict';

  var DEALER = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'A'];

  function row(str) { return str.trim().split(/\s+/); }

  /* ---- S17: dealer stands on soft 17 -------------------------------- */

  var S17 = {
    id: 's17',
    label: 'S17 — dealer stands on soft 17',
    hard: {
      '5':  row('H  H  H  H  H  H  H  H  H  H'),
      '6':  row('H  H  H  H  H  H  H  H  H  H'),
      '7':  row('H  H  H  H  H  H  H  H  H  H'),
      '8':  row('H  H  H  H  H  H  H  H  H  H'),
      '9':  row('H  D  D  D  D  H  H  H  H  H'),
      '10': row('D  D  D  D  D  D  D  D  H  H'),
      '11': row('D  D  D  D  D  D  D  D  D  H'),
      '12': row('H  H  S  S  S  H  H  H  H  H'),
      '13': row('S  S  S  S  S  H  H  H  H  H'),
      '14': row('S  S  S  S  S  H  H  H  H  H'),
      '15': row('S  S  S  S  S  H  H  H  Rh H'),
      '16': row('S  S  S  S  S  H  H  Rh Rh Rh'),
      '17': row('S  S  S  S  S  S  S  S  S  S'),
      '18+': row('S  S  S  S  S  S  S  S  S  S')
    },
    soft: {
      'A,2': row('H  H  H  D  D  H  H  H  H  H'),
      'A,3': row('H  H  H  D  D  H  H  H  H  H'),
      'A,4': row('H  H  D  D  D  H  H  H  H  H'),
      'A,5': row('H  H  D  D  D  H  H  H  H  H'),
      'A,6': row('H  D  D  D  D  H  H  H  H  H'),
      'A,7': row('Ds Ds Ds Ds Ds S  S  H  H  H'),
      'A,8': row('S  S  S  S  S  S  S  S  S  S'),
      'A,9': row('S  S  S  S  S  S  S  S  S  S')
    },
    pairs: {
      '2,2':   row('P  P  P  P  P  P  H  H  H  H'),
      '3,3':   row('P  P  P  P  P  P  H  H  H  H'),
      '4,4':   row('H  H  H  P  P  H  H  H  H  H'),
      '5,5':   row('D  D  D  D  D  D  D  D  H  H'),
      '6,6':   row('P  P  P  P  P  H  H  H  H  H'),
      '7,7':   row('P  P  P  P  P  P  H  H  H  H'),
      '8,8':   row('P  P  P  P  P  P  P  P  P  P'),
      '9,9':   row('P  P  P  P  P  S  P  P  S  S'),
      '10,10': row('S  S  S  S  S  S  S  S  S  S'),
      'A,A':   row('P  P  P  P  P  P  P  P  P  P')
    }
  };

  /* ---- H17: dealer hits soft 17 ------------------------------------- */
  // Built from S17 with the six cells that actually differ.

  function clone(table) {
    var out = {};
    for (var key in table) out[key] = table[key].slice();
    return out;
  }

  var H17 = {
    id: 'h17',
    label: 'H17 — dealer hits soft 17',
    hard: clone(S17.hard),
    soft: clone(S17.soft),
    pairs: clone(S17.pairs)
  };

  var A = DEALER.indexOf('A');
  var SIX = DEALER.indexOf('6');

  H17.hard['11'][A] = 'D';    // double eleven against an ace
  H17.hard['15'][A] = 'Rh';   // surrender fifteen against an ace
  H17.hard['17'][A] = 'Rs';   // surrender seventeen against an ace
  H17.hard['18+'][A] = 'S';   // (18-21 still stand)
  H17.soft['A,8'][SIX] = 'Ds';// double soft nineteen against a six
  H17.pairs['8,8'][A] = 'Rp'; // surrender eights against an ace

  var LEGEND = [
    { code: 'H',  text: 'Hit' },
    { code: 'S',  text: 'Stand' },
    { code: 'D',  text: 'Double if allowed, otherwise hit' },
    { code: 'Ds', text: 'Double if allowed, otherwise stand' },
    { code: 'P',  text: 'Split' },
    { code: 'Rh', text: 'Surrender if allowed, otherwise hit' },
    { code: 'Rs', text: 'Surrender if allowed, otherwise stand' },
    { code: 'Rp', text: 'Surrender if allowed, otherwise split' }
  ];

  var DIFFERENCES = [
    'Hard 11 vs A — double under H17, hit under S17.',
    'Hard 15 vs A — surrender under H17, hit under S17.',
    'Hard 17 vs A — surrender under H17, stand under S17.',
    'Soft 19 (A,8) vs 6 — double under H17, stand under S17.',
    '8,8 vs A — surrender under H17, split under S17.'
  ];

  /* ---- commonly misplayed hands ------------------------------------ */
  // Cells people get wrong most often: the ones that break the pattern of
  // the rows around them. Keyed by section/row with the dealer cards they
  // apply to, plus why the hand is easy to misplay.
  var TRICKY = [
    { section: 'hard', row: '12', dealers: ['2', '3'],
      why: 'Hard 12 hits against 2 and 3 even though 13-16 stand there.' },
    { section: 'hard', row: '16', dealers: ['9', '10', 'A'],
      why: 'Sixteen surrenders against 9, 10 and A - hitting is the fallback, never standing.' },
    { section: 'hard', row: '15', dealers: ['10', 'A'],
      why: 'Fifteen surrenders against 10 (and against A under H17 only).' },
    { section: 'hard', row: '11', dealers: ['A'],
      why: 'Eleven vs A is the headline S17/H17 split: hit under S17, double under H17.' },
    { section: 'hard', row: '9', dealers: ['2'],
      why: 'Nine doubles against 3-6 but only hits against 2.' },
    { section: 'hard', row: '10', dealers: ['10', 'A'],
      why: 'Ten doubles all the way to a dealer 9, then stops.' },
    { section: 'hard', row: '17', dealers: ['A'],
      why: 'The only surrendering seventeen, and only under H17.' },
    { section: 'soft', row: 'A,7', dealers: ['2', '7', '8', '9'],
      why: 'Soft 18 is the most misplayed hand in the game: double vs 2-6, stand vs 7-8, hit vs 9-A.' },
    { section: 'soft', row: 'A,8', dealers: ['6'],
      why: 'Soft 19 stands everywhere except vs a 6 under H17, where it doubles.' },
    { section: 'soft', row: 'A,2', dealers: ['4'],
      why: 'A,2 and A,3 start doubling at 5, while A,4 and A,5 start at 4 - easy to blur together.' },
    { section: 'soft', row: 'A,6', dealers: ['2'],
      why: 'Soft 17 doubles from 3 up, not from 2.' },
    { section: 'pairs', row: '9,9', dealers: ['7', '10', 'A'],
      why: 'Nines split against almost everything but stand against 7, 10 and A.' },
    { section: 'pairs', row: '4,4', dealers: ['5', '6'],
      why: 'Fours only split against 5 and 6, and only when double after split is allowed.' },
    { section: 'pairs', row: '7,7', dealers: ['8'],
      why: 'Sevens split through a dealer 7 and then hit - no standing.' },
    { section: 'pairs', row: '8,8', dealers: ['A'],
      why: 'Always split eights, except surrender them against an ace under H17.' },
    { section: 'pairs', row: '5,5', dealers: ['2', '9'],
      why: 'Never split fives - play them as a hard ten.' },
    { section: 'pairs', row: '6,6', dealers: ['2'],
      why: 'Sixes split against a 2 only when double after split is allowed.' }
  ];

  global.StrategyData = {
    TRICKY: TRICKY,
    DEALER: DEALER,
    LEGEND: LEGEND,
    DIFFERENCES: DIFFERENCES,
    sets: { s17: S17, h17: H17 },
    conditions: '4-8 decks · dealer peeks for blackjack · double after split allowed · late surrender allowed'
  };
})(window);
