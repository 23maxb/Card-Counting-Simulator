# Card Counting Simulator

A blackjack card-counting trainer. Fork of
[Mabbai/Card-Counting-Simulator](https://github.com/Mabbai/Card-Counting-Simulator)
with card skin packs, cookie-backed settings, a standalone basic strategy
reference, and a couple of drilling conveniences.

Play it: **https://23maxb.github.io/Card-Counting-Simulator/**

## What this fork adds

### Card skin packs

The **Skins** button (top right of the table) opens a picker with three
built-in packs:

| Pack | Source |
| --- | --- |
| Classic | the original PNGs in the repo root |
| Vector Modern | drawn as SVG at runtime, no assets needed |
| Vector Noir | the same, dark |

You can also upload your own. Pick up to 53 images and give the pack a name;
files are matched to cards by their names, so all of these work:

```
AS.png   10H.png   th.png   ace_of_spades.png   spades-queen.jpg   back.png
```

Any face the pack does not include falls back to the classic art, so partial
packs are fine. Uploaded packs live in this browser's IndexedDB (images are
far too large for cookies) and the chosen pack is remembered in the cookie
store. Switching packs re-skins the cards already on the table.

### Settings saved in cookies

Everything the settings panel holds — the basic strategy grids, the deviation
boxes, bet spreads, count tags, error margin, decks in shoe, penetration,
dealer speed, bankroll, the alert toggles and the chosen skin — is stored in
cookies rather than local storage. The whole store is one JSON blob split
across numbered `bjcs_*` cookies, so it stays under the per-cookie size
limit. Settings saved by an older version are migrated on first load.

The Skins panel can **export** the store to a JSON file and **import** it
back, which is how you move a setup between machines.

Cookies need an http origin. Opening `BlackJack.html` straight off disk works,
but falls back to local storage; to use cookies locally, serve the folder:

```sh
python3 -m http.server 8000   # then open http://localhost:8000/
```

### Auto play

The **Auto play** button on the table plays for you: it bets the spread for
the current true count, then plays every hand by basic strategy with Hi-Lo
index plays applied. Decisions come from the same module the strategy page
renders, so what auto-play does is exactly what the page shows at that count.

The **Hands** field beside the button sets how many hands to play; **-1**
plays until you stop it. The count is remembered between visits, the field
locks while a run is going, and the hand that reaches the limit is played out
in full before auto play stands down. Blank, `0` or anything else unusable is
read as unlimited.

It reads the bet spread grid for the sizing and the number of hands, stops
when the bankroll can no longer cover a round with a double or split in it,
and puts the coaching alerts back
the way it found them when you switch it off. (They are silenced while it
runs, since a modal alert would freeze the loop.) The status line in the
corner shows the hand number, the last decision, and flags the ones that were
index plays.

One wrinkle worth knowing: the grid the simulator ships with is not quite an
S17 chart. Two cells hold H17 plays — soft 19 (A,8) vs 6 doubles, and 11 vs A
hits — so with the shipped defaults the trainer will occasionally flag
auto-play for making the correct S17 play. Hitting **Load into simulator** on
the strategy page fixes both cells and the two agree completely; the grids
stay editable either way, so nothing here is forced on you.

### Basic strategy page

[`basic_strategy.html`](basic_strategy.html) — reachable from the **Basic
Strategy** button on the table — holds the full hard/soft/pairs charts for
4-8 decks, DAS and late surrender, in both dealer rules:

- **S17** — dealer stands on soft 17
- **H17** — dealer hits soft 17

Toggles on that page:

- **Highlight S17 / H17 differences** — outlines the five cells that change.
- **Highlight tricky hands** — marks the cells people misplay most often
  (soft 18, hard 12 vs 2-3, 9,9 vs 7, the surrender range …) and lists why
  each one is easy to get wrong.

#### True count and deviations

Type a true count (or drag the slider) and the tables redraw with the Hi-Lo
index plays folded in. Every cell an index play moved is outlined in amber
with a dot in its corner, hovering one shows what it changed from, and the
panel above lists the changes. The **Hi-Lo indexes** column lists the full
index set with the ones currently in force lit up. Clear the field to go back
to plain basic strategy.

The set is the Illustrious 18 and the Fab 4 surrenders, plus a handful of
commonly taught extras (soft 19 doubles, 8 vs 6, splitting tens against a 4).
Two rules govern how they land on the table:

- An index play replaces the cell outright, surrender included — "15 vs 10,
  stand at +4" means stop surrendering that hand once the count gets there.
- A surrender index is also a floor: below it, a hand that basic strategy
  surrenders gets played out instead.

**Load into simulator** writes the displayed table into the simulator's own
editable grids through the shared cookie store, including the surrender grid
and the S17/H17 switch. Two H17 calls have no cell to live in — hard 17 vs A
surrender, and 8,8 vs A surrender — so they are noted rather than written.

### Skip dealer blackjack

A dealer blackjack is a hand with no decisions in it. Tick **Skip dealer
blackjack hands** in the settings panel and those hands settle and deal the
next one immediately, with no popup to click through. The cards are still
dealt and still counted, so the shoe and the count stay honest. Auto-dealing
stops if the bankroll drops below the current bet, or after 40 hands in a row.

## Layout

```
BlackJack.html            the table
basic_strategy.html       strategy reference
js/cookieStore.js         cookie-backed settings store
js/skins.js               skin registry and resolution
js/skinName.js            file name -> card code
js/skinUI.js              skins panel
js/svgDeck.js             vector card faces
js/gameSettings.js        checkbox persistence
js/strategyData.js        S17 and H17 tables
js/deviations.js          Hi-Lo index plays and how they fold into a table
js/decisionEngine.js      hand + upcard + count -> the correct play
js/autoPlay.js            plays the table by itself
js/strategyPage.js        strategy page rendering and export
css/skins.css             skins panel styling
css/strategy.css          strategy page styling
```

Card codes are the game's own: rank plus suit initial, with ten written as
`0` — `AS`, `0H`, `2C`, plus `back`.

## Fixes to the original

Four bugs in the upstream code turned up while building the above, all of
them fixed here:

- The bet spread grid's "hands" cells are `id="H0"`..`"H10"`, which collide
  with the hard totals grid's `H00`..`H99` — `H10` exists in both.
  `getElementById` returned the strategy cell, so bets at true count +5 were
  graded against a strategy letter, and both grids shared one saved value.
  The bet grid is now queried within `#betGrid` and saves under its own key.
- The bet grader duplicated the true-count-zero row into the middle of its
  list, shifting every positive band down one row, so high counts were graded
  against the wrong bet.
- Deviation rules name the dealer's card as `10`, but the code compared
  against the raw rank, so a dealer J, Q or K never matched a `10` rule and
  the index play was silently skipped.
- Hard deviation rules matched on total alone, so `H(16,10) => S` fired on a
  soft 16 (A,5) and told you to stand on it.
- A hand could be split again while the first split was still dealing its
  replacement card, which popped a card out from under the pending split and
  threw. Dealing a card to a hand now latches it as busy.
- A hand could be acted on mid-deal, before the dealer's hole card was out.
  Standing that early walked the pool past its last hand and settled the round
  against a one-card dealer, so the hole card was never turned over and the
  round ended early. The action buttons and keyboard shortcuts now ignore
  input until the deal finishes, and turning over a card that is not there is
  a no-op rather than an exception.
