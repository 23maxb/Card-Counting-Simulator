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

  var running = false;
  var timer = null;
  var button, statusEl;
  var savedAlertToggles = null;
  var lastNote = '';

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
    return !!(dealer && dealer.cards && dealer.cards.length >= 2);
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
    var tc = shoe ? shoe.trueCount : 0;
    var spread = spreadFor(tc);

    if (bankroll && Number(bankroll.cash) < spread.amount * spread.hands) {
      note('Stopped: bankroll is below the next bet.');
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

    note('TC ' + tc.toFixed(1) + ' → bet ' + spread.amount +
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

    note(ranks.join('-') + ' vs ' + dealerCard.rank + ' → ' + result.action +
         (result.deviated ? ' (index play)' : ''));
    target.click();
  }

  function tick() {
    if (!running) return;
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

  function start() {
    if (running) return;
    running = true;
    silenceAlerts();
    button.textContent = 'Auto play: on';
    button.classList.add('auto-on');
    statusEl.style.display = 'block';
    note('Starting…');
    timer = setTimeout(tick, 200);
  }

  function stop() {
    running = false;
    if (timer) clearTimeout(timer);
    timer = null;
    restoreAlerts();
    button.textContent = 'Auto play';
    button.classList.remove('auto-on');
    note(lastNote ? lastNote + ' — stopped.' : 'Stopped.');
  }

  function init() {
    button = document.createElement('button');
    button.id = 'autoPlayButton';
    button.type = 'button';
    button.textContent = 'Auto play';
    button.title = 'Play the spread and every hand by the book, index plays included';

    statusEl = document.createElement('p');
    statusEl.id = 'autoPlayStatus';
    statusEl.style.display = 'none';

    button.addEventListener('click', function () { running ? stop() : start(); });

    document.body.appendChild(button);
    document.body.appendChild(statusEl);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  global.AutoPlay = {
    start: start,
    stop: stop,
    isRunning: function () { return running; },
    spreadFor: spreadFor,
    roundIsDealt: roundIsDealt
  };
})(window);
