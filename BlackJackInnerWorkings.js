class Card {
  constructor(suit, rank) {
    this.suit = suit;
    this.rank = rank;
    this.worldOrder = null
  }

  getValue() {
    if (['J', 'Q', 'K'].includes(this.rank)) {
      return 10;
    } else if (this.rank === 'A') {
      return 11;
    } else {
      return parseInt(this.rank);
    }
  }
}



class Shoe {
  constructor(amountDecks, shoePen) {
    this.cards = [];
    // Guard the two numbers the whole shoe is built from: a deck count of 0,
    // "" or "abc" used to build an empty shoe, and a penetration outside
    // (0,1) either reshuffled every hand or never reshuffled at all.
    this.amountDecks = Nums.parse(amountDecks, Nums.SPEC.decksInShoe);
    this.shoePen = Nums.parse(shoePen, Nums.SPEC.deckPen);
    this.initialize();
    this.counter = 0
    this.trueCount = 0
    this.runningCount = 0
    this.stack = 0
    this.updateMeter()
  }

  initialize() {
    const suits = ['Hearts', 'Diamonds', 'Clubs', 'Spades'];
    const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    for (let i = 0; i < this.amountDecks; i++) {
      for (let suit of suits) {
        for (let rank of ranks) {
          this.cards.push(new Card(suit, rank));
        }
      }
    }
  }

  shuffle() {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]]; // Swap
    }
  }

  shuffleCheck() {
    return (this.cards.length<= 52*this.amountDecks*(1-this.shoePen)) 
  }
  

  deal(arg) {
    let newCard = this.cards.pop()
    newCard.worldOrder = this.counter
    
    let id = newCard.rank
    if (['J','Q','K'].includes(id)) {
      id = '10'
    }
    id = id+'S'
    
    // A blank or mistyped tag box used to make the running count NaN for the
    // rest of the shoe, which quietly broke the true count and every index.
    let plus = Nums.read(id, Nums.SPEC.countTag)
    if (arg==='Hidden') {
      this.stack = plus
    }
    else {
      this.runningCount += plus
    }

    this.trueCount = this.runningCount/(this.cards.length/52)
    this.counter += 1
    document.getElementById("runningCount").innerText = `Running Count: ${this.runningCount}`
    document.getElementById("trueCount").innerText = `True Count: ${this.trueCount.toFixed(2)}`
    this.updateMeter()
    return newCard
  }

  // The meter shows how much of THIS shoe is left, so it has to follow the
  // deck count the user picked - it used to be hardcoded to eight decks.
  updateMeter() {
    const decks = Number(this.amountDecks) || 0
    const total = 52 * decks
    const label = document.getElementById("shoe")
    if (label) {
      label.innerText = `Shoe: ${this.cards.length}/${total}`
    }
    const bar = document.getElementById("bar")
    if (bar && total > 0) {
      const left = 100 * (this.cards.length / total)
      bar.style.height = `${Math.max(0, Math.min(100, left))}%`
    }
    const text = document.getElementById("barText")
    if (text) {
      text.innerText = `${decks} deck${decks === 1 ? '' : 's'} -`
    }
    // Where the cut card sits. The bar is anchored to the TOP of the meter and
    // its height is the fraction of the shoe left, so the level's lower edge
    // sits (100 - height)% up from the bottom. The reshuffle fires at a height
    // of (1 - pen), which puts the line pen% up from the bottom - not
    // (1 - pen)%, which would mark the point where only pen% had been dealt.
    const cut = document.getElementById("cutCard")
    if (cut) {
      const pen = Number(this.shoePen)
      if (pen >= 0 && pen <= 1) {
        cut.style.display = 'block'
        cut.style.bottom = `${(Math.max(0, Math.min(100, 100 * pen))).toFixed(2)}%`
      } else {
        cut.style.display = 'none'
      }
    }
  }
}

class Bankroll {
  constructor(cash) {
    // The bankroll starts life as the text of a contenteditable div. Left as
    // a string, add() concatenates instead of adding.
    this.cash = Number(cash) || 0
  }
  add(arg) {
    this.cash = Number(this.cash) + Number(arg)
    CookieStore.setItem("Bank", bankroll.cash) 
  }
  give(arg) {
    this.cash = Number(this.cash) - Number(arg)
    document.getElementById("bankroll").innerText = `Bankroll: ${this.cash}`
    CookieStore.setItem("Bank", bankroll.cash)
    return arg
  }
}

class Hand {
  constructor(bet, placeId) {
    this.cards = []
    this.bet = bankroll.give(bet)
    this.bust = false
    this.score = 0
    this.placeId = placeId
    this.BJ = false
  
  }
  empty() {
    this.cards = []
    this.bet = 0
    this.score = 0
  }
  addCard(dubble) {
    let newCard = shoe.deal(this.cards.length)
    this.cards.push(newCard)
    this.score = handValue(this.cards)
    
    cardPlacer(this, newCard)

    if (dubble) {
      flipCard(newCard)
    }
  }
  bustCheck() {
    if (this.score > 21) {
      this.bet = 0
      displayBets()
      this.bust = true
      HANDPOOL.goNext()
    }
  }
  hit() {
    document.getElementById("surrenderButton").setAttribute('disabled',true)
    this.addCard()
    document.getElementById("dubbleButton").setAttribute("disabled", true)

    this.bustCheck()
    
  }
  dubble() {
    document.getElementById("surrenderButton").setAttribute('disabled',true)

    this.bet += bankroll.give(this.bet);
    this.addCard('dubble')
    if (this.score > 21) {
      this.bet = 0
      this.bust = true
    }

    this.score = handValue(this.cards)
    displayBets()
    HANDPOOL.goNext()
  }
  async split() { 
    // Splitting leaves this hand holding one card until its replacement is
    // dealt, and the split button stays enabled across that gap. Latch the
    // hand as busy so a second split cannot re-enter and pop the card the
    // first one is still waiting on.
    if (DEALING > 0) {
      return
    }
    DEALING += 1
    try {
    document.getElementById("surrenderButton").setAttribute('disabled',true)

    let newHand = new Hand(this.bet)
    HANDPOOL.POOL.splice(HANDPOOL.handIndex +1,0,newHand)
    newHand.placeId = this.placeId + '1'
    
    this.cards.reverse()
    cardMover(this.cards[1], newHand.placeId) 
    newHand.cards.push(this.cards.pop())
    this.placeId = this.placeId + '0'
    cardMover(this.cards[0], this.placeId) 
    await sleep(TIME)
    this.addCard()
    await sleep(TIME)
    //newHand.addCard()
    if (this.cards[0].getValue() === this.cards[1].getValue()) {
      document.getElementById("splitButton").removeAttribute("disabled")
    }
    else {
      document.getElementById("splitButton").setAttribute("disabled", true)
    }
    if (!DAS) {
      document.getElementById("dubbleButton").setAttribute("disabled", true)
    }
    displayBets()
    HANDPOOL.activateHand()
    } finally {
      DEALING -= 1
    }
  }

  stand() {
    document.getElementById("surrenderButton").setAttribute('disabled',true)

    this.score = handValue(this.cards)
    HANDPOOL.goNext()
  }
  surrender() {
    this.cashOut(0.5)
    this.bet=0
    displayBets()
    this.bust = true
    HANDPOOL.goNext()
  }
  cashOut(arg) {
    bankroll.cash += this.bet *arg
    document.getElementById("bankroll").innerText = `Bankroll: ${bankroll.cash}`
    
  }
} 


function handValue(hand) {
  let j = 0
  let aceCount = 0
  for (i in hand) {
    j += hand[i].getValue()
    if (hand[i].rank === 'A') {
      aceCount += 1
    }
  }
  while (j > 21 && aceCount > 0) {
    j -= 10
    aceCount -= 1
  }

  return j
}

async function waitAdd(arg) {
  await sleep(TIME)
  arg.addCard()
}

 
class Dealer {
  constructor() {
    this.cards = []
    this.score = 0
    this.bust = false
    this.placeId = 'D'
  }
  check17() {
    let k =0
    let p = 0
    for (i in this.cards) {
      if (this.cards[i].rank === 'A') {
        k +=1
      }
      p += this.cards[i].getValue()
    }
    return (!S17 && p == 17 && k > 0)
  }
  
  async addCard() {
    let newCard = shoe.deal(this.cards.length)
    this.cards.push(newCard)
    newDealerCard(newCard)
  }
  checkBJ() {
    this.score = handValue(this.cards)
    return (this.cards.length === 2 && this.score === 21)
  }
  async run() {
    showHiddenCard(this.cards)
    while (handValue(this.cards) < 17 || this.check17()) {
      
      await sleep(TIME)
      this.addCard()
    }
    
    this.score = handValue(this.cards)
    if (this.score > 21) {
      this.bust = true
    
    }
  }
  empty() {
    this.cards = []
    this.score = 0
    this.bust = false
  }
}

class HandPool {
  constructor() {
    this.POOL = []
    this.handIndex = 0
    this.HAND = null
  }
  empty() {
    this.POOL = []
    this.handIndex = 0
    this.HAND = null
  }
  activateHand() {
    this.HAND = this.POOL[this.handIndex]
    document.querySelectorAll('.activeBet').forEach(elem => {
      elem.classList.remove('activeBet')
    })
    if (!this.HAND) {
      return
    }
    let active = document.querySelector(`#bet-container [id='${this.HAND.placeId}']`)
    if (!active) {
      return
    }
    active.classList.add('activeBet')
  }
  async goNext() {
    this.handIndex += 1
    this.activateHand()
    if (this.HAND && this.HAND.cards.length == 1) {
      DEALING += 1
      try {
        await sleep(TIME)
        this.HAND.addCard()
      } finally {
        DEALING -= 1
      }
    }
    document.getElementById("dubbleButton").removeAttribute("disabled")
    if (!this.HAND) {
      document.getElementById("surrenderButton").removeAttribute("disabled")
      await sleep(TIME/2)
      RUNFINALEY()
    }
    else { 
      if (this.HAND.placeId === '1') {
        document.getElementById("surrenderButton").removeAttribute("disabled")
      }
      if (this.HAND.cards[0].getValue() === this.HAND.cards[1].getValue()) {
        document.getElementById("splitButton").removeAttribute("disabled")
      }
      else {
        document.getElementById("splitButton").setAttribute("disabled", true)
      }
      if (!DAS) {
        if (this.HAND.placeId == '0' || this.HAND.placeId == '1' || this.HAND.placeId == 'U') {
          document.getElementById("dubbleButton").removeAttribute("disabled")
        }
        else {
          document.getElementById("dubbleButton").setAttribute("disabled", true)

        }
      }
    
      if (this.HAND.BJ) {
        this.goNext()
      }
      
    }
  }
  add(arg) {
    this.POOL.push(arg)
    this.activateHand()
  }
 
}

async function RUNFINALEY() {
  
  let c = 0
  for (i in HANDPOOL.POOL) {
    if (HANDPOOL.POOL[i].bust || HANDPOOL.POOL[i].BJ) {
      c += 1
    }
  }
  if (c === HANDPOOL.POOL.length || dealer.checkBJ()) {
    showHiddenCard(dealer.cards)
    func()
  }
  else {
    dealer.run().then(() => {
      for (i in HANDPOOL.POOL) {
        let sub = HANDPOOL.POOL[i] 
        if (!dealer.bust) {
          if ((!sub.bust && !sub.BJ) && sub.score > dealer.score) {
            sub.bet *=2
            displayBets()
            sub.cashOut(1)
          }
          else if (sub.score < dealer.score) {
            sub.bet *=0
            displayBets()
            
          }
          else if (!sub.bust && sub.score === dealer.score) {
            sub.cashOut(1)
          }
        }
        else if (dealer.bust && !sub.BJ) {
          if (!sub.bust) {
            sub.bet *=2
            displayBets()
            sub.cashOut(1)
            
          }
          else if(sub.bust) {
            sub.bet *=0
            displayBets()
            
          }
          
        }    
      }
      
    
      //dealer.empty()
      func()
    })

    
  }

}
// Guards the auto-deal loop when "skip dealer blackjack" is on.
let AUTO_DEALT = 0
const AUTO_DEAL_LIMIT = 40

function skipDealerBlackjack() {
  const box = document.getElementById("check4")
  return !!(box && box.checked && dealer.checkBJ())
}

async function func() {
  await sleep(TIME)
  document.getElementById("goButton").removeAttribute("disabled")
  res = bankroll.cash -res
  if (res >= 0) {
    document.getElementById("result").innerText = `Gain: +${res}`
  }
  else if (res < 0) {
    document.getElementById("result").innerText = `Loss: ${res}`
  }
  CookieStore.setItem("Bank", bankroll.cash)

  // Dealer blackjack is a hand with no decisions in it. When the option is
  // on, settle it and deal again straight away instead of waiting for a
  // click - the cards still count, so the shoe stays honest.
  if (skipDealerBlackjack() && bankroll.cash >= activeBet && AUTO_DEALT < AUTO_DEAL_LIMIT) {
    AUTO_DEALT += 1
    await sleep(Math.min(300, TIME))
    startHand(false)
    return
  }
  AUTO_DEALT = 0

  document.getElementById("popup").style.display = "flex"

}

async function runGame(two,bet) {
  if (two) {
    await twoHand(bet)
    displayBets()
    checkBlackJack()
    HANDPOOL.activateHand()
  }
  else {
    await oneHand(bet)
    displayBets()
    checkBlackJack()
    HANDPOOL.activateHand()
  }
  
}

async function checkBlackJack() {
  let k = 0
  if (!dealer.checkBJ()) {
    for (i in HANDPOOL.POOL) {
      
      
      if (HANDPOOL.POOL[i].score === 21) {
        console.log(HANDPOOL.POOL[i])

        HANDPOOL.POOL[i].BJ = true
        HANDPOOL.POOL[i].bet *=2.5
        HANDPOOL.POOL[i].cashOut(1)
        displayBets()
        
        console.log(i)
        if (HANDPOOL.POOL[0].BJ) {
          HANDPOOL.goNext()
          
          console.log("UUUUUUUUU")
        }
        k += 1
        if (k === HANDPOOL.POOL.length && !HANDPOOL.POOL[0].BJ) {
          showHiddenCard(dealer.cards)
          
          func()
          
        }
      
      }
    }
  }
  else if (dealer.checkBJ()) {
    console.log(HANDPOOL.POOL)
    showHiddenCard(dealer.cards)
    if (handValue(HANDPOOL.POOL[0].cards) === 21) {
      HANDPOOL.POOL[0].cashOut(1)
    }
    else {
      HANDPOOL.POOL[0].bet *= 0
    }
    
    if (HANDPOOL.POOL[1] && handValue(HANDPOOL.POOL[1].cards) === 21) {
      HANDPOOL.POOL[1].cashOut(1)
    }
    else if (HANDPOOL.POOL[1]) {
      HANDPOOL.POOL[1].bet *= 0
      }
    
    displayBets()
    await sleep(TIME) 
    console.log("noo")
    RUNFINALEY()
  }

}

async function twoHand(arg) {
  HANDPOOL.empty()
  HANDPOOL.add(new Hand(arg, '0'))
  HANDPOOL.add(new Hand(arg, '1'))
  displayBets()

  HANDPOOL.POOL[0].addCard()
  await sleep(TIME)

  HANDPOOL.POOL[1].addCard()
  await sleep(TIME)

  dealer.addCard()
  await sleep(TIME)

  HANDPOOL.POOL[0].addCard()
  await sleep(TIME)

  HANDPOOL.POOL[1].addCard()
  await sleep(TIME)

  hiddenCard()
  dealer.cards.push(shoe.deal('Hidden'))
  if (HANDPOOL.POOL[0].cards[0].getValue() === HANDPOOL.POOL[0].cards[1].getValue()) {
    document.getElementById("splitButton").removeAttribute("disabled")
  }
  else {
    document.getElementById("splitButton").setAttribute("disabled", true)
  }
  
}

async function oneHand(arg) {
  HANDPOOL.empty()
  HANDPOOL.add(new Hand(arg, 'U'))
  displayBets()

  HANDPOOL.POOL[0].addCard()
  await sleep(TIME)

  dealer.addCard()
  await sleep(TIME)

  HANDPOOL.POOL[0].addCard()
  await sleep(TIME)

  hiddenCard()
  dealer.cards.push(shoe.deal('Hidden'))
  
  if (HANDPOOL.POOL[0].cards[0].getValue() === HANDPOOL.POOL[0].cards[1].getValue()) {
    document.getElementById("splitButton").removeAttribute("disabled")
  }
  else {
    document.getElementById("splitButton").setAttribute("disabled", true)
  }
}


function seeker(key, hand) {
  let down = 0
  let left = 0
  if (key[0] === '0') {
    left = 100*1100/2015.2
    down = 100*540/859.2
  }
  if (key[0] === '1') {
    left = 100*800/2015.2
    down = 100*540/859.2

  }
  if (key[0] === 'U') {
    left = 100*950/2015.2
    down = 100*540/859.2
  }
  for (let i = 0; i < hand.cards.length-1; i++) {
    left += (100*30/2015.2)
    down -= (100*40/859.2)*3.2
  }
  for (let i = 0; i < key.length-1; i++) {
    let pair1 = key[i+1]
    let pair2 =key[i]
    let x = 1.2
    if (pair1 === '0' && pair2 === '0') {
      left += 100*150 * x/2015.2
      down -= 3.2*(100*60 /859.2)
    }
    if (pair1 === '1' && pair2 === '0') {
      left -= 100*50/2015.2
      down -= 3.2*(100*60 /859.2)
    }
    if (pair1 === '0' && pair2 === '1'  ) {
      left += 100*50/2015.2
      down -= 3.2*(100*60 /859.2)
    }
    if (pair1 === '1' && pair2 === '1' ) {
      left -= 100*150 * x/2015.2
      down -= 3.2*(100*60 /859.2)
    }
    if (pair2 === 'U' && pair1 === '0') {
      left += 100*100/2015.2
      down -= 3.2*(100*60 /859.2)
    }
    if (pair2 === 'U' && pair1 === '1') {
      left -= 100*100/2015.2
      down -= 3.2*(100*60/859.2)
    } 
    
    x = x*x
  }
  return [left, down]
}

function cardPlacer(hand, card) {
  
  let key = hand.placeId
  
  newDisplayCard(card, seeker(key, hand), hand)
}

function cardMover(card, key) {
  id = card.worldOrder
  sub = document.getElementById(id)
  
  let down = 0
  let left = 0
  if (key[0] === '0') {
    left = 100*1100/2015.2
    down = 100*540/859.2
  }
  if (key[0] === '1') {
    left = 100*800/2015.2
    down = 100*540/859.2
  }
  if (key[0] === 'U') {
    left = 100*950/2015.2
    down = 100* 540/859.2
  }

  for (let i = 0; i < key.length-1; i++) {
    let pair1 = key[i+1]
    let pair2 =key[i]
    let x = 1.2
    if (pair1 === '0' && pair2 === '0') {
      left += 100*150 *x /2015.2
      down -= 3.2*100*60 /859.2
    }
    if (pair1 === '1' && pair2 === '0') {
      left -= 100*50/2015.2
      down -= 3.2*100*60 /859.2
    }
    if (pair1 === '0' && pair2 === '1') {
      left += 100*50/2015.2
      down -= 3.2*100*60 /859.2
    }
    if (pair1 === '1' && pair2 === '1') {
      left -= 100*150 * x/2015.2
      down -= 3.2*100*60/859.2
    }
    if (pair2 === 'U' && pair1 === '0') {
      left += 100*100/2015.2
      down -= 3.2*100*60/859.2
    }
    if (pair2 === 'U' && pair1 === '1') {
      left -= 100*100/2015.2
      down -= 3.2*100*60/859.2
    } 
    
    x = x*x
  }

  sub.style.left =`${left+3}%`
  sub.style.top = `${down-110}%`
  

}

function handBetPlacer(hand) {
  let key = hand.placeId
  let down = 0
  let left = 0
  if (key[0] === '0') {
    left = 100*1100/2015.2
    down = 100*700/900.2
  }
  if (key[0] === '1') {
    left = 100*800/2015.2
    down = 100*700/900.2
  }
  if (key[0] === 'U') {
    left = 100*950/2015.2
    down = 100*700/900.2
  }

  for (let i = 0; i < key.length-1; i++) {
    let pair1 = key[i+1]
    let pair2 =key[i]
    let x = 1.2
    if (pair1 === '0' && pair2 === '0') {
      left += 100*150 *x /2015.2
      down -= 3.2*100*60 /900.2
    }
    if (pair1 === '1' && pair2 === '0') {
      left -= 100*50/2015.2
      down -= 3.2*100*60/900.2
    }
    if (pair1 === '0' && pair2 === '1') {
      left += 100*50/2015.2
      down -= 3.2*100*60 /859.2
    }
    if (pair1 === '1' && pair2 === '1') {
      left -= 100*150 * x/2015.2
      down -= 3.2*100* 60/859.2
    }
    if (pair2 === 'U' && pair1 === '0') {
      left += 100*100/2015.2
      down -= 3.2*100*60/900.2
    }
    if (pair2 === 'U' && pair1 === '1') {
      left -= 100*100/2015.2
      down -= 3.2*100*60/900.2
    } 
    
    x = x*x
  }
  return [left, down]
  
}

function displayBets() {
  document.getElementById("bet-container").innerHTML = ''
  for (i in HANDPOOL.POOL) {
    let hand = HANDPOOL.POOL[i]
    let bet = document.createElement('div')
    let place = handBetPlacer(hand)
    bet.innerText = hand.bet
    bet.style.position = "absolute"
    bet.style.transform = "translate(25%,25%)"
    bet.style.color = "red"
    
    bet.style.fontSize ="2.4vw"
    bet.style.fontWeight = "bold"
    bet.style.left =`${place[0]}%`
    bet.style.top = `${place[1]-104}%`
    bet.id = hand.placeId
    document.getElementById("bet-container").appendChild(bet);

  }
  

}


const HANDPOOL = new HandPool
let shoe = new Shoe(amountDecks, deckPen);
const bankroll = new Bankroll(money)
if (CookieStore.getItem("Bank")) {
  bankroll.cash = Nums.parse(CookieStore.getItem("Bank"), { fallback: 0 })
  document.getElementById("bankroll").innerText = `Bankroll: ${bankroll.cash}`
}
else {
  document.getElementById("bankroll").innerText = `Bankroll: ${bankroll.cash}`
}
const dealer = new Dealer

TIME = Nums.setting('speed')
console.log(TIME)
shoe.shuffle()








function sleep(duration) {
  return new Promise(resolve => setTimeout(resolve, duration));
}

