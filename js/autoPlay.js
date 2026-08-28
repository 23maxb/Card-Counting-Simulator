/*
 * autoPlay.js
 * Plays the table by itself: bets the spread for the current true count and
 * plays every hand by basic strategy with Hi-Lo index plays applied.
 *
 * Decisions come from decisionEngine.js, the same module the strategy page
 * renders, so what auto-play does is exactly what the page shows at that
 * count.
 */
(function (global) {
  'use strict';

  // The game declares its state with let/const at script top level, so those
  // bindings are shared through the global lexical scope rather than hung off
  // window: shoe, dealer, bankroll, HANDPOOL, S17, douce and activeBet are all
  // reachable here as bare identifiers, and only as bare identifiers.

  var HANDS_KEY = 'autoPlayHands';
  var UNLIMITED = -1;

  var running = false;
  var timer = null;
  var button, statusEl, handsInput, oneButton;
  var savedAlertToggles = null;
  var lastNote = '';
  var handsDealt = 0;      // rounds dealt in this run
  var handLimit = UNLIMITED;

  var ACTION_BUTTONS = {
    H: 'hitButton',
    S: 'standButton',
    D: 'dubbleButton',
    P: 'splitButton',
    R: 'surrenderButton'
  };

  function byId(id) { return document.getElementById(id); }

  function tickInterval() {
    var speed = parseFloat(byId('speed').innerText);
    if (isNaN(speed)) speed = 500;
    return Math.max(180, speed);
  }

  function store() { return global.CookieStore || global.localStorage; }

  /**
   * How many hands to play: a positive count, or -1 for unlimited. Anything
   * else the field can hold (blank, 0, junk) is read as unlimited.
   */
  function readLimit() {
    var raw = handsInput ? handsInput.value : '';
    var n = parseInt(raw, 10);
    if (!isFinite(n) || n < 1) return UNLIMITED;
    return n;
  }

  function limitReached() {
    return handLimit !== UNLIMITED && handsDealt >= handLimit;
  }

  function handCounter() {
    return handLimit === UNLIMITED
      ? 'hand ' + handsDealt
      : 'hand ' + handsDealt + ' of ' + handLimit;
  }

  function enabled(id) {
    var el = byId(id);
    return !!el && !el.disabled;
  }

  function betweenHands() {
    var popup = byId('popup');
    return global.getComputedStyle(popup).display !== 'none';
  }

  // The round is dealt in stages, and the dealer's hole card goes down last -
  // so a two-card dealer hand is the signal that dealing has finished. Acting
  // before that point stands on a hand while cards are still coming out, and
  // walks the pool past its end into a settle the dealer has no hole card for.
  function roundIsDealt() {
    if (dealer && dealer.cards && dealer.cards.length >= 2) {
      // DEALING is also non-zero while a split is dealing its second card.
      return typeof DEALING === 'number' ? DEALING === 0 : true;
    }
    return false;
  }

  function note(text) {
    lastNote = text;
    if (statusEl) statusEl.textContent = text;
  }

  /* ---- betting ------------------------------------------------------- */

  // The bet spread grid is indexed by true count from -5 to +5. The row for
  // count i covers the band (i-1, i], which is how the game's own bet grader
  // reads it, so round up rather than to nearest.
  function spreadFor(trueCount) {
    var bucket = Math.max(-5, Math.min(5, Math.ceil(trueCount || 0)));
    var i = bucket + 5;
    var betCell = byId('B' + i);
    var handsCell = document.querySelector('#betGrid #H' + i);
    var amount = betCell ? parseInt(betCell.innerText, 10) : NaN;
    var hands = handsCell ? parseInt(handsCell.innerText, 10) : NaN;
    return {
      amount: isNaN(amount) ? 500 : amount,
      hands: isNaN(hands) ? 1 : hands,
      bucket: bucket
    };
  }

  function placeBetAndDeal() {
    // The check happens here rather than at settle time so the hand that
    // reaches the limit is played out in full before auto play stands down.
    if (limitReached()) {
      note('Finished ' + handsDealt + ' hand' + (handsDealt === 1 ? '' : 's') + '.');
      stop();
      return;
    }

    var tc = shoe ? shoe.trueCount : 0;
    var spread = spreadFor(tc);

    // A round can call for more than its opening bet - a double or a split
    // takes another wager per hand - and the game happily lets a bet overdraw
    // the bankroll. Keep enough behind to cover that before dealing again.
    var cash = bankroll ? Number(bankroll.cash) : 0;
    var needed = spread.amount * spread.hands * 2;
    if (bankroll && cash < needed) {
      note('Stopped: ' + cash + ' left, which will not cover a ' + spread.amount +
           ' bet on ' + spread.hands + ' hand' + (spread.hands > 1 ? 's' : '') +
           ' with a double or split.');
      stop();
      return;
    }

    // Prefer clicking the matching chip so the UI stays in step; otherwise
    // set the bet directly, since the spread can name amounts with no chip.
    var chips = document.querySelectorAll('#buttonContainer button');
    var clicked = false;
    for (var i = 0; i < chips.length; i++) {
      if (parseInt(chips[i].innerText, 10) === spread.amount) {
        chips[i].click();
        clicked = true;
        break;
      }
    }
    if (!clicked) {
      activeBet = spread.amount;
      byId('goButton').innerText = 'Bet: ' + spread.amount;
    }

    var wantsTwo = spread.hands >= 2;
    if (douce !== wantsTwo) byId('handSelector').click();

    handsDealt += 1;
    note(handCounter() + ' · TC ' + tc.toFixed(1) + ' → bet ' + spread.amount +
         ' on ' + (wantsTwo ? 2 : 1) + ' hand' + (wantsTwo ? 's' : ''));
    byId('goButton').click();
  }

  /* ---- playing ------------------------------------------------------- */

  function playHand(hand) {
    var dealerCard = dealer && dealer.cards[0];
    if (!dealerCard) return;

    var ranks = hand.cards.map(function (c) { return c.rank; });
    var result = global.Decision.decide({
      ranks: ranks,
      dealer: dealerCard.rank,
      trueCount: shoe ? shoe.trueCount : 0,
      setId: S17 ? 's17' : 'h17',
      canDouble: enabled('dubbleButton') && hand.cards.length === 2,
      canSplit: enabled('splitButton'),
      canSurrender: enabled('surrenderButton') && hand.cards.length === 2
    });

    var target = byId(ACTION_BUTTONS[result.action] || 'standButton');
    if (!target || target.disabled) target = byId('standButton');

    note(handCounter() + ' · ' + ranks.join('-') + ' vs ' + dealerCard.rank +
         ' → ' + result.action + (result.deviated ? ' (index play)' : ''));
    target.click();
  }

  function tick() {
    if (!running) return;
    if (bankroll && Number(bankroll.cash) < 0) {
      note('Stopped: the bankroll went negative.');
      stop();
      return;
    }
    try {
      if (betweenHands()) {
        placeBetAndDeal();
      } else {
        var hand = HANDPOOL && HANDPOOL.HAND;
        if (roundIsDealt() && hand && hand.cards && hand.cards.length >= 2 &&
            !hand.bust && !hand.BJ) {
          playHand(hand);
        }
      }
    } catch (err) {
      note('Stopped after an error: ' + err.message);
      console.error('[autoPlay]', err);
      stop();
      return;
    }
    timer = setTimeout(tick, tickInterval());
  }

  /* ---- start / stop --------------------------------------------------- */

  // The coaching alerts are modal, so they would freeze the loop. Silence
  // them while auto-play drives, and give the user their settings back after.
  function silenceAlerts() {
    savedAlertToggles = ['check1', 'check2', 'check3'].map(function (id) {
      var box = byId(id);
      var was = box.checked;
      box.checked = true;
      return { id: id, was: was };
    });
  }

  function restoreAlerts() {
    if (!savedAlertToggles) return;
    savedAlertToggles.forEach(function (entry) { byId(entry.id).checked = entry.was; });
    savedAlertToggles = null;
  }

  /**
   * @param {number} [limitOverride] play exactly this many hands, ignoring
   *   the Hands field - used by the one-hand button in the action row.
   */
  function start(limitOverride) {
    if (running) return;
    handLimit = typeof limitOverride === 'number' ? limitOverride : readLimit();
    // A round already on the table is the first of the run, not a freebie
    // before it: otherwise "play one hand" would finish this one and deal
    // another.
    handsDealt = betweenHands() ? 0 : 1;
    running = true;
    silenceAlerts();
    button.textContent = 'Auto play: on';
    button.classList.add('auto-on');
    statusEl.style.display = 'block';
    handsInput.disabled = true;
    if (oneButton) oneButton.disabled = true;
    note(handLimit === UNLIMITED
      ? 'Playing until you stop it…'
      : 'Playing ' + handLimit + ' hand' + (handLimit === 1 ? '' : 's') + '…');
    timer = setTimeout(tick, 200);
  }

  /** Play the hand on the table - or deal one and play it - then stand down. */
  function playOne() {
    if (running) return;
    start(1);
  }

  function stop() {
    running = false;
    if (timer) clearTimeout(timer);
    timer = null;
    restoreAlerts();
    button.textContent = 'Auto play';
    button.classList.remove('auto-on');
    if (handsInput) handsInput.disabled = false;
    if (oneButton) oneButton.disabled = false;
    note(lastNote ? lastNote + ' — stopped.' : 'Stopped.');
  }

  function init() {
    button = document.createElement('button');
    button.id = 'autoPlayButton';
    button.type = 'button';
    button.textContent = 'Auto play';
    button.title = 'Play the spread and every hand by the book, index plays included';

    handsInput = document.createElement('input');
    handsInput.id = 'autoPlayHands';
    handsInput.type = 'number';
    handsInput.step = '1';
    handsInput.min = '-1';
    handsInput.title = 'How many hands to play. -1 plays until you stop it.';
    var saved = null;
    try { saved = store().getItem(HANDS_KEY); } catch (e) { saved = null; }
    handsInput.value = saved === null || saved === undefined ? String(UNLIMITED) : saved;
    handsInput.addEventListener('change', function () {
      var value = readLimit();
      handsInput.value = String(value);
      try { store().setItem(HANDS_KEY, String(value)); } catch (e) { /* ignore */ }
    });

    statusEl = document.createElement('p');
    statusEl.id = 'autoPlayStatus';
    statusEl.style.display = 'none';

    button.addEventListener('click', function () { running ? stop() : start(); });

    // The one-hand button lives in the action row, next to hit and stand.
    oneButton = byId('autoOneButton');
    if (oneButton) oneButton.addEventListener('click', playOne);

    var wrap = document.createElement('div');
    wrap.id = 'autoPlayHandsWrap';
    var label = document.createElement('label');
    label.setAttribute('for', 'autoPlayHands');
    label.textContent = 'Hands';
    wrap.appendChild(label);
    wrap.appendChild(handsInput);

    document.body.appendChild(wrap);
    document.body.appendChild(button);
    document.body.appendChild(statusEl);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  global.AutoPlay = {
    start: start,
    stop: stop,
    playOne: playOne,
    isRunning: function () { return running; },
    spreadFor: spreadFor,
    roundIsDealt: roundIsDealt,
    handsDealt: function () { return handsDealt; },
    limit: function () { return handLimit; }
  };
})(window);
