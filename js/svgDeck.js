/*
 * svgDeck.js
 * Procedurally drawn card faces used by the built-in vector skin packs.
 *
 * Nothing here touches the network or the filesystem: every face is an
 * inline SVG turned into a data: URI, so a vector pack works offline and
 * costs the repo no binary assets.
 */
(function (global) {
  'use strict';

  var RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '0', 'J', 'Q', 'K', 'A'];
  var SUITS = ['C', 'D', 'H', 'S'];

  var SUIT_GLYPH = { C: '♣', D: '♦', H: '♥', S: '♠' };
  var RANK_LABEL = { '0': '10' };

  var THEMES = {
    modern: {
      face: '#fdfdf7', edge: '#1d2433', red: '#c0392b', black: '#1d2433',
      backA: '#1d3f8f', backB: '#0d1c44', backInk: 'rgba(255,255,255,0.55)'
    },
    noir: {
      face: '#16181d', edge: '#5c6478', red: '#e2555f', black: '#e8ecf5',
      backA: '#2a2f3a', backB: '#0a0c10', backInk: 'rgba(226,85,95,0.55)'
    }
  };

  function label(rank) { return RANK_LABEL[rank] || rank; }

  function isRed(suit) { return suit === 'D' || suit === 'H'; }

  function corner(theme, rank, suit, x, y, flip) {
    var color = isRed(suit) ? theme.red : theme.black;
    var rot = flip ? ' transform="rotate(180 ' + x + ' ' + y + ')"' : '';
    return '<g' + rot + ' fill="' + color + '" text-anchor="middle" font-family="Helvetica,Arial,sans-serif">' +
      '<text x="' + x + '" y="' + y + '" font-size="26" font-weight="700">' + label(rank) + '</text>' +
      '<text x="' + x + '" y="' + (y + 25) + '" font-size="24">' + SUIT_GLYPH[suit] + '</text>' +
      '</g>';
  }

  function centre(theme, rank, suit) {
    var color = isRed(suit) ? theme.red : theme.black;
    var isCourt = rank === 'J' || rank === 'Q' || rank === 'K';
    if (isCourt) {
      return '<rect x="34" y="52" width="112" height="140" rx="8" fill="none" stroke="' + color + '" stroke-width="3"/>' +
        '<text x="90" y="132" font-size="62" font-weight="700" fill="' + color + '"' +
        ' text-anchor="middle" font-family="Helvetica,Arial,sans-serif">' + rank + '</text>' +
        '<text x="90" y="176" font-size="30" fill="' + color + '" text-anchor="middle">' + SUIT_GLYPH[suit] + '</text>';
    }
    return '<text x="90" y="148" font-size="96" fill="' + color + '" text-anchor="middle"' +
      ' font-family="Helvetica,Arial,sans-serif">' + SUIT_GLYPH[suit] + '</text>';
  }

  function faceSvg(theme, rank, suit) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 250" width="180" height="250">' +
      '<rect x="2" y="2" width="176" height="246" rx="14" fill="' + theme.face +
      '" stroke="' + theme.edge + '" stroke-width="3"/>' +
      corner(theme, rank, suit, 26, 40, false) +
      corner(theme, rank, suit, 154, 210, true) +
      centre(theme, rank, suit) +
      '</svg>';
  }

  function backSvg(theme) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 250" width="180" height="250">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="' + theme.backA + '"/>' +
      '<stop offset="1" stop-color="' + theme.backB + '"/></linearGradient>' +
      '<pattern id="p" width="20" height="20" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">' +
      '<path d="M0 0 V20" stroke="' + theme.backInk + '" stroke-width="2"/></pattern></defs>' +
      '<rect x="2" y="2" width="176" height="246" rx="14" fill="url(#g)" stroke="' + theme.edge + '" stroke-width="3"/>' +
      '<rect x="14" y="14" width="152" height="222" rx="9" fill="url(#p)" opacity="0.5"/>' +
      '<rect x="14" y="14" width="152" height="222" rx="9" fill="none" stroke="' + theme.backInk + '" stroke-width="2"/>' +
      '</svg>';
  }

  function encode(svg) {
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  /** Build a full { CODE: dataURI } image map for one named theme. */
  function buildDeck(themeName) {
    var theme = THEMES[themeName] || THEMES.modern;
    var images = {};
    for (var r = 0; r < RANKS.length; r++) {
      for (var s = 0; s < SUITS.length; s++) {
        images[RANKS[r] + SUITS[s]] = encode(faceSvg(theme, RANKS[r], SUITS[s]));
      }
    }
    images.back = encode(backSvg(theme));
    return images;
  }

  global.SvgDeck = {
    RANKS: RANKS,
    SUITS: SUITS,
    themes: Object.keys(THEMES),
    buildDeck: buildDeck
  };
})(window);
