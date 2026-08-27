/*
 * skinName.js
 * Maps an uploaded file name to the game's card code.
 *
 * The game names cards RANK + SUIT-initial, with ten written as "0"
 * (e.g. "AS" = ace of spades, "0H" = ten of hearts, "back" = card back).
 * Uploads are accepted in the common naming styles people actually have:
 *   AS.png  10H.png  th.png  ace_of_spades.png  spades-queen.jpg  back.png
 */
(function (global) {
  'use strict';

  var RANK_WORDS = {
    A: 'A', ACE: 'A', ONE: 'A',
    K: 'K', KING: 'K',
    Q: 'Q', QUEEN: 'Q',
    J: 'J', JACK: 'J',
    T: '0', TEN: '0', '10': '0', '0': '0',
    '9': '9', NINE: '9', '8': '8', EIGHT: '8', '7': '7', SEVEN: '7',
    '6': '6', SIX: '6', '5': '5', FIVE: '5', '4': '4', FOUR: '4',
    '3': '3', THREE: '3', '2': '2', TWO: '2'
  };

  var SUIT_WORDS = {
    C: 'C', CLUB: 'C', CLUBS: 'C',
    D: 'D', DIAMOND: 'D', DIAMONDS: 'D',
    H: 'H', HEART: 'H', HEARTS: 'H',
    S: 'S', SPADE: 'S', SPADES: 'S'
  };

  function stripExtension(name) {
    return name.replace(/\.[a-z0-9]+$/i, '');
  }

  function baseName(path) {
    var parts = String(path).split(/[\\/]/);
    return parts[parts.length - 1];
  }

  function splitCompact(token) {
    // "AS", "10H", "0h" -> ["A","S"] / ["10","H"] / ["0","H"]
    var m = /^(10|[2-9AKQJT0])([CDHS])$/.exec(token);
    if (m) return [m[1], m[2]];
    m = /^([CDHS])(10|[2-9AKQJT0])$/.exec(token);   // "S A" reversed, e.g. "HQ"
    if (m) return [m[2], m[1]];
    return null;
  }

  /**
   * @returns {string|null} card code ("AS", "0H", "back"), or null if the
   *   file name carries no recognisable card identity.
   */
  function toCardCode(fileName) {
    var name = stripExtension(baseName(fileName)).toUpperCase();
    if (!name) return null;
    if (/(^|[^A-Z])BACK([^A-Z]|$)/.test(name) || name === 'BACK') return 'back';

    var tokens = name.split(/[^A-Z0-9]+/).filter(Boolean);
    var rank = null;
    var suit = null;

    for (var i = 0; i < tokens.length; i++) {
      var t = tokens[i];
      if (t === 'OF') continue;
      if (!rank && RANK_WORDS[t] && !SUIT_WORDS[t]) { rank = RANK_WORDS[t]; continue; }
      if (!suit && SUIT_WORDS[t] && !RANK_WORDS[t]) { suit = SUIT_WORDS[t]; continue; }
      // "S" is both a suit letter and nothing else; resolve by what is missing.
      if (!suit && SUIT_WORDS[t]) { suit = SUIT_WORDS[t]; continue; }
      if (!rank && RANK_WORDS[t]) { rank = RANK_WORDS[t]; continue; }
      var pair = splitCompact(t);
      if (pair) {
        if (!rank) rank = RANK_WORDS[pair[0]];
        if (!suit) suit = SUIT_WORDS[pair[1]];
      }
    }

    if (rank && suit) return rank + suit;
    return null;
  }

  global.SkinName = { toCardCode: toCardCode };
})(window);
