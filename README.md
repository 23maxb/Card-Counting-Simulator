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
js/strategyPage.js        strategy page rendering and export
css/skins.css             skins panel styling
css/strategy.css          strategy page styling
```

Card codes are the game's own: rank plus suit initial, with ten written as
`0` — `AS`, `0H`, `2C`, plus `back`.
