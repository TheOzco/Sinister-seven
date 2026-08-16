// بازی ۷ خبیث - با Supabase

const SUITS = { H: '♥', D: '♦', C: '♣', S: '♠' };

// ⚠️ اینجا رو پر کن:
const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';

// Supabase API
class SupabaseClient {
  constructor(url, key) {
    this.url = url;
    this.key = key;
  }

  async query(table, method = 'GET', data = null, filter = null) {
    let endpoint = `${this.url}/rest/v1/${table}`;
    
    if (filter) {
      endpoint += `?${filter}`;
    }

    const options = {
      method,
      headers: {
        'apikey': this.key,
        'Authorization': `Bearer ${this.key}`,
        'Content-Type': 'application/json'
      }
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(endpoint, options);
      
      if (!response.ok) {
        const error = await response.text();
        console.error('API Error:', error);
        return null;
      }

      return await response.json();
    } catch (e) {
      console.error('Network Error:', e);
      return null;
    }
  }
}

const db = new SupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// State
let gameState = 'menu';
let currentTableId = null;
let currentPlayerId = null;
let currentPlayerName = '';
let pollInterval = null;
let games = {};

// ایجاد دسته کارت‌ها
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

// Load game from database
async function loadGame(code) {
  const result = await db.query('games', 'GET', null, `code=eq.${code}`);
  
  if (result && result.length > 0) {
    const game = result[0];
    return {
      code: game.code,
      status: game.status,
      direction: game.direction,
      currentPlayerIndex: game.current_player_index,
      selectedSuit: null,
      players: game.players,
      deck: game.deck,
      tableCards: game.table_cards
    };
  }
  
  return null;
}

// Save game to database
async function saveGame(game) {
  const data = {
    code: game.code,
    status: game.status,
    direction: game.direction,
    current_player_index: game.currentPlayerIndex,
    players: game.players,
    deck: game.deck,
    table_cards: game.tableCards
  };

  const result = await db.query(
    'games',
    'PATCH',
    data,
    `code=eq.${game.code}`
  );

  return result !== null;
}

// Start polling
function startPolling() {
  if (pollInterval) clearInterval(pollInterval);
  
  pollInterval = setInterval(async () => {
    if (gameState === 'lobby' && currentTableId) {
      const game = await loadGame(currentTableId);
      if (game) {
        games[currentTableId] = game;
        renderLobby();
      }
    } else if (gameState === 'game' && currentTableId) {
      const game = await loadGame(currentTableId);
      if (game) {
        games[currentTableId] = game;
        renderGame();
      }
    }
  }, 500);
}

// Stop polling
function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

// Render Menu
function renderMenu() {
  stopPolling();
  document.getElementById('root').innerHTML = `
    <div class="container menu">
      <h1>🎴 بازی ۷ خبیث</h1>
      <div class="menu-buttons">
        <button onclick="goToCreate()" class="btn btn-create">ایجاد میز جدید</button>
        <button onclick="goToJoin()" class="btn btn-join">جویین به میز</button>
      </div>
      <p style="margin-top: 20px; color: #999; font-size: 0.9em;">
        ☁️ متصل به Supabase (sync real-time)
      </p>
    </div>
  `;
}

// Render Create
function renderCreate() {
  stopPolling();
  document.getElementById('root').innerHTML = `
    <div class="container">
      <h2>ایجاد میز جدید</h2>
      <input id="playerNameInput" type="text" placeholder="نام شما را وارد کنید" class="input" />
      <button onclick="createTable()" class="btn btn-primary">ایجاد میز</button>
      <button onclick="goToMenu()" class="btn btn-secondary">بازگشت</button>
    </div>
  `;
  setTimeout(() => document.getElementById('playerNameInput')?.focus(), 100);
}

// Render Join
function renderJoin() {
  stopPolling();
  document.getElementById('root').innerHTML = `
    <div class="container">
      <h2>جویین به میز</h2>
      <input id="codeInput" type="text" placeholder="کد میز (۴ رقم)" class="input" maxLength="4" style="text-transform: uppercase;" />
      <input id="playerNameInput2" type="text" placeholder="نام شما را وارد کنید" class="input" />
      <button onclick="joinTable()" class="btn btn-primary">جویین کن</button>
      <button onclick="goToMenu()" class="btn btn-secondary">بازگشت</button>
    </div>
  `;
  setTimeout(() => document.getElementById('codeInput')?.focus(), 100);
}

// Render Lobby
function renderLobby() {
  const game = games[currentTableId];
  
  if (!game) {
    alert('میز حذف شده است!');
    goToMenu();
    return;
  }

  const isCreator = game.players[0].id === currentPlayerId;
  const canStart = game.players.length >= 2 && isCreator;

  document.getElementById('root').innerHTML = `
    <div class="container game-container">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
        <h2 style="margin: 0;">کد میز: <span style="color: #667eea;">${currentTableId}</span></h2>
        <button onclick="goToMenu()" class="btn btn-small">خروج</button>
      </div>
      
      <div class="players-list">
        <h3>بازیکنان (${game.players.length}/10)</h3>
        ${game.players.map(p => `
          <div class="player">
            <span>${p.name} ${p.id === currentPlayerId ? '(تو)' : ''}</span>
          </div>
        `).join('')}
      </div>

      ${canStart ? `
        <button onclick="startGame()" class="btn btn-start">شروع بازی ✅</button>
      ` : `
        <div style="text-align: center; color: #999; margin-top: 20px; padding: 15px; background: #f5f5f5; border-radius: 8px;">
          ${isCreator ? '⏳ منتظر حداقل ۲ بازیکن...' : `⏳ منتظر ${game.players[0].name}...`}
        </div>
      `}
    </div>
  `;
}

// Render Game
function renderGame() {
  const game = games[currentTableId];
  
  if (!game) {
    alert('بازی حذف شده است!');
    goToMenu();
    return;
  }

  const currentPlayer = game.players[game.currentPlayerIndex];
  const myPlayer = game.players.find(p => p.id === currentPlayerId);
  const isMyTurn = currentPlayer?.id === currentPlayerId;

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
          ` : '<p>منتظر شروع...</p>'}
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
            <p>⏳ نوبت ${currentPlayer?.name} است...</p>
          </div>
        `}
      </div>
    </div>
  `;
}

// Functions
function goToMenu() {
  gameState = 'menu';
  currentTableId = null;
  stopPolling();
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

async function createTable() {
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
    players: [{
      id: Math.random().toString(36).substr(2, 9),
      name,
      cards: [],
      score: 0
    }],
    deck: createDeck(),
    tableCards: []
  };

  // Save to Supabase
  const result = await db.query('games', 'POST', {
    id: Math.random().toString(36).substr(2, 9),
    code: newGame.code,
    status: newGame.status,
    direction: newGame.direction,
    current_player_index: newGame.currentPlayerIndex,
    players: newGame.players,
    deck: newGame.deck,
    table_cards: newGame.tableCards
  });

  if (result === null) {
    alert('خطا در ایجاد میز! لطفاً امتحان کنید');
    return;
  }

  games[code] = newGame;
  currentTableId = code;
  currentPlayerId = newGame.players[0].id;
  currentPlayerName = name;
  gameState = 'lobby';
  startPolling();
  renderLobby();
}

async function joinTable() {
  const code = document.getElementById('codeInput').value.toUpperCase().trim();
  const name = document.getElementById('playerNameInput2').value.trim();

  if (!code || !name) {
    alert('لطفاً کد و نام خود را وارد کنید!');
    return;
  }

  if (code.length !== 4) {
    alert('کد باید ۴ رقم باشد!');
    return;
  }

  const game = await loadGame(code);
  
  if (!game) {
    alert(`کد "${code}" وجود ندارد!`);
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
    score: 0
  };

  game.players.push(newPlayer);
  await saveGame(game);

  games[code] = game;
  currentTableId = code;
  currentPlayerId = newPlayer.id;
  currentPlayerName = name;
  gameState = 'lobby';
  startPolling();
  renderLobby();
}

async function startGame() {
  const game = games[currentTableId];
  
  if (game.players.length < 2) {
    alert('حداقل ۲ بازیکن!');
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

  game.tableCards = [deck.pop()];
  game.deck = deck;
  game.status = 'playing';
  game.currentPlayerIndex = 0;

  await saveGame(game);
  gameState = 'game';
  startPolling();
  renderGame();
}

function validateCard(card) {
  const game = games[currentTableId];
  if (game.tableCards.length === 0) return true;
  
  const lastCard = game.tableCards[game.tableCards.length - 1];
  if (card.rank === 'J') return true;
  
  return card.suit === lastCard.suit || card.rank === lastCard.rank;
}

async function playCard(cardId) {
  const game = games[currentTableId];
  const myPlayer = game.players.find(p => p.id === currentPlayerId);
  const card = myPlayer.cards.find(c => c.id === cardId);

  if (!card) return;
  if (game.players[game.currentPlayerIndex].id !== currentPlayerId) {
    alert('نوبت شما نیست!');
    return;
  }
  if (!validateCard(card)) {
    alert('کارت نامعتبر!');
    return;
  }

  myPlayer.cards = myPlayer.cards.filter(c => c.id !== cardId);
  game.tableCards.push(card);
  
  game.currentPlayerIndex = (game.currentPlayerIndex + game.direction + game.players.length) % game.players.length;

  await saveGame(game);
  renderGame();
}

async function drawCard() {
  const game = games[currentTableId];
  const myPlayer = game.players.find(p => p.id === currentPlayerId);

  if (game.players[game.currentPlayerIndex].id !== currentPlayerId) {
    alert('نوبت شما نیست!');
    return;
  }

  if (game.deck.length === 0) {
    const tableCardsExceptLast = game.tableCards.slice(0, -1);
    game.deck = tableCardsExceptLast;
    game.deck.sort(() => Math.random() - 0.5);
  }

  const newCard = game.deck.pop();
  myPlayer.cards.push(newCard);

  game.currentPlayerIndex = (game.currentPlayerIndex + game.direction + game.players.length) % game.players.length;

  await saveGame(game);
  renderGame();
}

// شروع
renderMenu();
