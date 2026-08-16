// بازی ۷ خبیث - Vanilla JavaScript

const SUITS = { H: '♥', D: '♦', C: '♣', S: '♠' };
const SUITS_NAMES = { H: 'قلب', D: 'الماس', C: 'دل', S: 'پیک' };

// ایجاد دسته کارت‌ها (۲ عدد)
function createDeck() {
  const deck = [];
  const suits = ['H', 'D', 'C', 'S'];
  const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  
  for (let d = 0; d < 2; d++) {
    for (let suit of suits) {
      for (let rank of ranks) {
        deck.push({ id: `${d}-${suit}-${rank}`, suit, rank });
      }
    }
  }
  
  return deck.sort(() => Math.random() - 0.5);
}

// State
let gameState = 'menu'; // menu, create, join, lobby, game
let games = JSON.parse(localStorage.getItem('haftKhabeGames')) || {};
let currentTableId = null;
let currentPlayerId = null;
let currentPlayerName = '';

// Render صفحه منو
function renderMenu() {
  document.getElementById('root').innerHTML = `
    <div class="container menu">
      <h1>🎴 بازی ۷ خبیث</h1>
      <div class="menu-buttons">
        <button onclick="goToCreate()" class="btn btn-create">
          ایجاد میز جدید
        </button>
        <button onclick="goToJoin()" class="btn btn-join">
          جویین به میز
        </button>
      </div>
    </div>
  `;
}

// Render صفحه ایجاد
function renderCreate() {
  document.getElementById('root').innerHTML = `
    <div class="container">
      <h2>ایجاد میز جدید</h2>
      <input 
        id="playerNameInput" 
        type="text" 
        placeholder="نام شما را وارد کنید" 
        class="input"
      />
      <button onclick="createTable()" class="btn btn-primary">ایجاد میز</button>
      <button onclick="goToMenu()" class="btn btn-secondary">بازگشت</button>
    </div>
  `;
  document.getElementById('playerNameInput').focus();
}

// Render صفحه جویین
function renderJoin() {
  document.getElementById('root').innerHTML = `
    <div class="container">
      <h2>جویین به میز</h2>
      <input 
        id="codeInput" 
        type="text" 
        placeholder="کد میز (۴ رقم)" 
        class="input"
        maxLength="4"
      />
      <input 
        id="playerNameInput2" 
        type="text" 
        placeholder="نام شما را وارد کنید" 
        class="input"
      />
      <button onclick="joinTable()" class="btn btn-primary">جویین کن</button>
      <button onclick="goToMenu()" class="btn btn-secondary">بازگشت</button>
    </div>
  `;
  document.getElementById('codeInput').focus();
}

// Render صفحه لابی
function renderLobby() {
  const game = games[currentTableId];
  const isCreator = game.players[0].id === currentPlayerId;

  document.getElementById('root').innerHTML = `
    <div class="container game-container">
      <h2>کد میز: <span style="color: #667eea; font-size: 1.5em;">${currentTableId}</span></h2>
      
      <div class="players-list">
        <h3>بازیکنان (${game.players.length}/10)</h3>
        ${game.players.map(p => `
          <div class="player">
            <span>${p.name} ${p.id === currentPlayerId ? '(تو)' : ''}</span>
          </div>
        `).join('')}
      </div>

      ${isCreator && game.players.length >= 2 ? `
        <button onclick="startGame()" class="btn btn-start">شروع بازی ✅</button>
      ` : `
        <div style="text-align: center; color: #999; margin-top: 20px;">
          ${isCreator ? 'منتظر بازیکنان دیگر...' : `منتظر ${game.players[0].name} برای شروع...`}
        </div>
      `}

      <button onclick="goToMenu()" class="btn btn-secondary">خروج</button>
    </div>
  `;
}

// Render صفحه بازی
function renderGame() {
  const game = games[currentTableId];
  const currentPlayer = game.players[game.currentPlayerIndex];
  const myPlayer = game.players.find(p => p.id === currentPlayerId);
  const isMyTurn = currentPlayer.id === currentPlayerId;

  document.getElementById('root').innerHTML = `
    <div class="game-container">
      <div class="game-header">
        <h2>کد میز: ${currentTableId}</h2>
        <button onclick="goToMenu()" class="btn btn-small">خروج</button>
      </div>

      <div class="players-list">
        <h3>بازیکنان</h3>
        ${game.players.map((p, idx) => `
          <div class="player ${game.currentPlayerIndex === idx ? 'active' : ''}">
            <span>${p.name} - ${p.cards.length} 🎴</span>
          </div>
        `).join('')}
      </div>

      <div class="game-board">
        <div class="table-cards">
          <h3>کارت‌های میز</h3>
          ${game.tableCards.length > 0 ? `
            <div class="card-stack">
              ${game.tableCards.slice(-3).map(card => `
                <div class="card">${card.rank}${SUITS[card.suit]}</div>
              `).join('')}
            </div>
          ` : '<p>هنوز کارتی بر روی میز نیست</p>'}
        </div>

        ${isMyTurn ? `
          <div class="my-turn">
            <h3>⭐ نوبت شما!</h3>
            <div class="my-cards">
              ${myPlayer.cards.map(card => `
                <button onclick="playCard('${card.id}')" class="card card-playable">
                  ${card.rank}${SUITS[card.suit]}
                </button>
              `).join('')}
            </div>
            <button onclick="drawCard()" class="btn btn-draw">برداشتن کارت</button>
          </div>
        ` : `
          <div class="waiting">
            <p>⏳ نوبت ${currentPlayer.name} است...</p>
          </div>
        `}
      </div>
    </div>
  `;
}

// Functions
function goToMenu() {
  gameState = 'menu';
  renderMenu();
}

function goToCreate() {
  gameState = 'create';
  renderCreate();
}

function goToJoin() {
  gameState = 'join';
  renderJoin();
}

function createTable() {
  const name = document.getElementById('playerNameInput').value.trim();
  
  if (!name) {
    alert('لطفاً نام خود را وارد کنید!');
    return;
  }

  const code = Math.random().toString(36).substr(2, 4).toUpperCase();
  const newGame = {
    code,
    status: 'waiting',
    direction: 1,
    currentPlayerIndex: 0,
    selectedSuit: null,
    deck: createDeck(),
    tableCards: [],
    players: [{
      id: Math.random().toString(36).substr(2, 9),
      name,
      cards: [],
      score: 0,
      status: 'active'
    }],
    createdAt: new Date().toISOString()
  };

  games[code] = newGame;
  localStorage.setItem('haftKhabeGames', JSON.stringify(games));

  currentTableId = code;
  currentPlayerId = newGame.players[0].id;
  currentPlayerName = name;
  gameState = 'lobby';
  renderLobby();
}

function joinTable() {
  const code = document.getElementById('codeInput').value.toUpperCase().trim();
  const name = document.getElementById('playerNameInput2').value.trim();

  if (!code || !name) {
    alert('لطفاً کد و نام خود را وارد کنید!');
    return;
  }

  const game = games[code];
  if (!game) {
    alert('کد میز غلط است!');
    return;
  }

  if (game.players.length >= 10) {
    alert('میز پر شده است!');
    return;
  }

  const newPlayer = {
    id: Math.random().toString(36).substr(2, 9),
    name,
    cards: [],
    score: 0,
    status: 'active'
  };

  game.players.push(newPlayer);
  localStorage.setItem('haftKhabeGames', JSON.stringify(games));

  currentTableId = code;
  currentPlayerId = newPlayer.id;
  currentPlayerName = name;
  gameState = 'lobby';
  renderLobby();
}

function startGame() {
  const game = games[currentTableId];
  
  if (game.players.length < 2) {
    alert('حداقل ۲ بازیکن لازم است!');
    return;
  }

  const deck = [...game.deck];
  
  game.players.forEach(player => {
    player.cards = [];
    for (let i = 0; i < 7; i++) {
      if (deck.length > 0) {
        player.cards.push(deck.pop());
      }
    }
  });

  const firstCard = deck.pop();
  game.tableCards = [firstCard];
  game.deck = deck;
  game.status = 'playing';
  game.currentPlayerIndex = 0;

  localStorage.setItem('haftKhabeGames', JSON.stringify(games));

  gameState = 'game';
  renderGame();
}

function validateCard(card) {
  const game = games[currentTableId];
  
  if (game.tableCards.length === 0) return true;
  
  const lastCard = game.tableCards[game.tableCards.length - 1];
  
  if (card.rank === 'J') return true;
  
  if (game.selectedSuit && card.suit === game.selectedSuit) return true;
  
  return card.suit === lastCard.suit || card.rank === lastCard.rank;
}

function playCard(cardId) {
  const game = games[currentTableId];
  const myPlayer = game.players.find(p => p.id === currentPlayerId);
  const card = myPlayer.cards.find(c => c.id === cardId);

  if (!card) return;

  if (game.players[game.currentPlayerIndex].id !== currentPlayerId) {
    alert('نوبت شما نیست!');
    return;
  }

  if (!validateCard(card)) {
    alert('این کارت معتبر نیست!');
    return;
  }

  // حذف کارت
  myPlayer.cards = myPlayer.cards.filter(c => c.id !== cardId);
  game.tableCards.push(card);

  // محاسبه بازیکن بعدی
  let nextPlayerIndex = (game.currentPlayerIndex + game.direction + game.players.length) % game.players.length;
  let newDirection = game.direction;
  let newSelectedSuit = null;

  // اعمال تأثیر کارت
  switch (card.rank) {
    case '2':
      const nextPlayer = game.players[nextPlayerIndex];
      const deck = game.deck;
      if (deck.length > 0) nextPlayer.cards.push(deck.pop());
      break;

    case '7':
      // بازیکن بعدی باید ۷ بذاره
      break;

    case '8':
      const currentP = game.players[game.currentPlayerIndex];
      if (game.deck.length > 0) currentP.cards.push(game.deck.pop());
      break;

    case 'A':
      if (game.players.length === 2) {
        const p = game.players[game.currentPlayerIndex];
        if (game.deck.length > 0) p.cards.push(game.deck.pop());
      } else {
        nextPlayerIndex = (nextPlayerIndex + game.direction + game.players.length) % game.players.length;
      }
      break;

    case '10':
      newDirection = -game.direction;
      const p10 = game.players[game.currentPlayerIndex];
      if (game.deck.length > 0) p10.cards.push(game.deck.pop());
      break;

    case 'J':
      const suits = ['H', 'D', 'C', 'S'];
      const suitInput = prompt(`خال را انتخاب کن:\nH: ♥\nD: ♦\nC: ♣\nS: ♠`);
      if (suits.includes(suitInput)) {
        newSelectedSuit = suitInput;
      }
      break;

    default:
      break;
  }

  game.currentPlayerIndex = nextPlayerIndex;
  game.direction = newDirection;
  game.selectedSuit = newSelectedSuit;

  localStorage.setItem('haftKhabeGames', JSON.stringify(games));
  renderGame();
}

function drawCard() {
  const game = games[currentTableId];
  const myPlayer = game.players.find(p => p.id === currentPlayerId);

  if (game.players[game.currentPlayerIndex].id !== currentPlayerId) {
    alert('نوبت شما نیست!');
    return;
  }

  let deck = game.deck;

  if (deck.length === 0) {
    const tableCardsExceptLast = game.tableCards.slice(0, -1);
    deck = tableCardsExceptLast;
    deck.sort(() => Math.random() - 0.5);
  }

  const newCard = deck.pop();
  myPlayer.cards.push(newCard);
  game.deck = deck;

  const nextPlayerIndex = (game.currentPlayerIndex + game.direction + game.players.length) % game.players.length;
  game.currentPlayerIndex = nextPlayerIndex;

  localStorage.setItem('haftKhabeGames', JSON.stringify(games));
  renderGame();
}

// شروع
renderMenu();
