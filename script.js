// بازی ۷ خبیث - نسخه دیباگ‌شده با Supabase

const SUITS = { H: '♥', D: '♦', C: '♣', S: '♠' };

// =========================
// Supabase
// =========================
// این دو مقدار را با اطلاعات پروژه خودت عوض کن.
const SUPABASE_URL = 'https://afbeifeyskhafvijqtby.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_7RklkTdXkAVc3DvEG5xMJw__XzKsTin';

class SupabaseClient {
  constructor(url, key) {
    this.url = url.replace(/\/$/, '');
    this.key = key;
  }

  async query(table, method = 'GET', data = null, filter = null) {
    let endpoint = `${this.url}/rest/v1/${table}`;
    if (filter) endpoint += `?${filter}`;

    const options = {
      method,
      headers: {
        apikey: this.key,
        Authorization: `Bearer ${this.key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      }
    };

    if (data !== null) options.body = JSON.stringify(data);

    try {
      const response = await fetch(endpoint, options);
      const text = await response.text();

      if (!response.ok) {
        console.error('Supabase API Error:', response.status, text);
        return null;
      }

      if (!text) return [];
      try { return JSON.parse(text); }
      catch { return []; }
    } catch (e) {
      console.error('Network Error:', e);
      return null;
    }
  }
}

const db = new SupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// =========================
// State
// =========================
let gameState = 'menu';
let currentTableId = null;
let currentPlayerId = null;
let currentPlayerName = '';
let pollInterval = null;
let games = {};
let rendering = false;

// =========================
// Deck
// =========================
function createDeck() {
  const deck = [];
  const suits = ['H', 'D', 'C', 'S'];
  const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

  // همان منطق فایل اصلی: دو دسته 52 کارتی
  for (let d = 0; d < 2; d++) {
    for (const suit of suits) {
      for (const rank of ranks) {
        deck.push({ id: `${d}-${suit}-${rank}`, suit, rank });
      }
    }
  }

  return shuffle(deck);
}

function shuffle(array) {
  const a = [...array];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generateRoomCode() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function generateId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

// =========================
// Database
// =========================
async function loadGame(code) {
  const safeCode = encodeURIComponent(code);
  const result = await db.query('games', 'GET', null, `code=eq.${safeCode}&limit=1`);

  if (!result || result.length === 0) return null;

  const game = result[0];
  return normalizeGame({
    code: game.code,
    status: game.status,
    direction: game.direction,
    currentPlayerIndex: game.current_player_index,
    selectedSuit: game.selected_suit ?? null,
    players: game.players ?? [],
    deck: game.deck ?? [],
    tableCards: game.table_cards ?? []
  });
}

function normalizeGame(game) {
  game.players = Array.isArray(game.players) ? game.players : [];
  game.deck = Array.isArray(game.deck) ? game.deck : [];
  game.tableCards = Array.isArray(game.tableCards) ? game.tableCards : [];
  game.direction = game.direction === -1 ? -1 : 1;
  game.currentPlayerIndex = Number.isInteger(game.currentPlayerIndex) ? game.currentPlayerIndex : 0;
  game.selectedSuit = game.selectedSuit ?? null;

  if (game.players.length > 0) {
    game.currentPlayerIndex = Math.max(0, Math.min(game.currentPlayerIndex, game.players.length - 1));
  }

  return game;
}

async function insertGame(game) {
  const data = {
    id: generateId(),
    code: game.code,
    status: game.status,
    direction: game.direction,
    current_player_index: game.currentPlayerIndex,
    selected_suit: game.selectedSuit,
    players: game.players,
    deck: game.deck,
    table_cards: game.tableCards
  };

  return await db.query('games', 'POST', data);
}

async function saveGame(game) {
  game = normalizeGame(game);

  const data = {
    status: game.status,
    direction: game.direction,
    current_player_index: game.currentPlayerIndex,
    selected_suit: game.selectedSuit,
    players: game.players,
    deck: game.deck,
    table_cards: game.tableCards
  };

  const result = await db.query(
    'games',
    'PATCH',
    data,
    `code=eq.${encodeURIComponent(game.code)}`
  );

  return result !== null;
}

// =========================
// Polling
// =========================
function startPolling() {
  stopPolling();

  pollInterval = setInterval(async () => {
    if (!currentTableId || !['lobby', 'game'].includes(gameState)) return;

    const game = await loadGame(currentTableId);
    if (!game) return;

    games[currentTableId] = game;

    if (game.status === 'playing' && gameState === 'lobby') {
      gameState = 'game';
    }

    if (game.status === 'waiting' && gameState === 'game') {
      gameState = 'lobby';
    }

    if (gameState === 'lobby') renderLobby();
    else if (gameState === 'game') renderGame();
  }, 1000);
}

function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

// =========================
// Menu
// =========================
function renderMenu() {
  stopPolling();
  document.getElementById('root').innerHTML = `
    <div class="container menu">
      <h1>🎴 بازی ۷ خبیث</h1>
      <div class="menu-buttons">
        <button onclick="goToCreate()" class="btn btn-create">ایجاد میز جدید</button>
        <button onclick="goToJoin()" class="btn btn-join">جویین به میز</button>
      </div>
      <p style="margin-top:20px;color:#999;font-size:.9em;">☁️ متصل به Supabase</p>
    </div>`;
}

function renderCreate() {
  stopPolling();
  document.getElementById('root').innerHTML = `
    <div class="container">
      <h2>ایجاد میز جدید</h2>
      <input id="playerNameInput" type="text" maxlength="30" placeholder="نام شما را وارد کنید" class="input" />
      <button onclick="createTable()" class="btn btn-primary">ایجاد میز</button>
      <button onclick="goToMenu()" class="btn btn-secondary">بازگشت</button>
    </div>`;
  setTimeout(() => document.getElementById('playerNameInput')?.focus(), 100);
}

function renderJoin() {
  stopPolling();
  document.getElementById('root').innerHTML = `
    <div class="container">
      <h2>جویین به میز</h2>
      <input id="codeInput" type="text" inputmode="numeric" pattern="[0-9]*" placeholder="کد میز (۴ رقم)" class="input" maxlength="4" />
      <input id="playerNameInput2" type="text" maxlength="30" placeholder="نام شما را وارد کنید" class="input" />
      <button onclick="joinTable()" class="btn btn-primary">جویین کن</button>
      <button onclick="goToMenu()" class="btn btn-secondary">بازگشت</button>
    </div>`;
  setTimeout(() => document.getElementById('codeInput')?.focus(), 100);
}

// =========================
// Lobby
// =========================
function renderLobby() {
  const game = games[currentTableId];
  if (!game) return;

  const creator = game.players[0];
  const isCreator = creator?.id === currentPlayerId;
  const canStart = game.players.length >= 2 && isCreator;

  document.getElementById('root').innerHTML = `
    <div class="container game-container">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;">
        <h2 style="margin:0">کد میز: <span style="color:#667eea">${escapeHtml(currentTableId)}</span></h2>
        <button onclick="goToMenu()" class="btn btn-small">خروج</button>
      </div>
      <div class="players-list">
        <h3>بازیکنان (${game.players.length}/10)</h3>
        ${game.players.map(p => `
          <div class="player">
            <span>${escapeHtml(p.name)} ${p.id === currentPlayerId ? '(تو)' : ''}</span>
          </div>`).join('')}
      </div>
      ${canStart
        ? '<button onclick="startGame()" class="btn btn-start">شروع بازی ✅</button>'
        : `<div style="text-align:center;color:#999;margin-top:20px;padding:15px;background:#f5f5f5;border-radius:8px;">⏳ ${isCreator ? 'منتظر حداقل ۲ بازیکن...' : `منتظر ${escapeHtml(creator?.name || 'سازنده')}...`}</div>`}
    </div>`;
}

// =========================
// Game UI
// =========================
function renderGame() {
  const game = games[currentTableId];
  if (!game) return;

  if (game.status === 'finished') {
    renderFinished(game);
    return;
  }

  const currentPlayer = game.players[game.currentPlayerIndex];
  const myPlayer = game.players.find(p => p.id === currentPlayerId);
  const isMyTurn = currentPlayer?.id === currentPlayerId;

  if (!myPlayer) {
    goToMenu();
    return;
  }

  const lastCard = game.tableCards.at(-1);
  const effectiveSuit = game.selectedSuit || lastCard?.suit || null;

  document.getElementById('root').innerHTML = `
    <div class="game-container">
      <div class="game-header">
        <h2>کد میز: ${escapeHtml(currentTableId)}</h2>
        <button onclick="goToMenu()" class="btn btn-small">خروج</button>
      </div>

      <div class="players-list">
        <h3>بازیکنان</h3>
        ${game.players.map((p, idx) => `
          <div class="player ${game.currentPlayerIndex === idx ? 'active' : ''}">
            <span>${escapeHtml(p.name)} - ${p.cards.length} 🎴 ${p.id === currentPlayerId ? '(تو)' : ''}</span>
          </div>`).join('')}
      </div>

      <div class="game-board">
        <div class="table-cards">
          <h3>کارت‌های میز</h3>
          ${game.tableCards.length ? `
            <div class="card-stack">
              ${game.tableCards.slice(-3).map(card => `<div class="card">${escapeHtml(card.rank)}${SUITS[card.suit]}</div>`).join('')}
            </div>
            ${effectiveSuit ? `<p>خال فعال: <strong>${SUITS[effectiveSuit]}</strong></p>` : ''}
          ` : '<p>منتظر شروع...</p>'}
        </div>

        ${isMyTurn ? `
          <div class="my-turn">
            <h3>⭐ نوبت شما!</h3>
            <div class="my-cards">
              ${myPlayer.cards.map(card => `
                <button onclick="playCard('${escapeHtml(card.id)}')" class="card card-playable">${escapeHtml(card.rank)}${SUITS[card.suit]}</button>
              `).join('')}
            </div>
            <button onclick="drawCard()" class="btn btn-draw">برداشتن کارت</button>
          </div>
        ` : `
          <div class="waiting"><p>⏳ نوبت ${escapeHtml(currentPlayer?.name || '')} است...</p></div>
        `}
      </div>
    </div>`;
}

function renderFinished(game) {
  const winner = game.players.find(p => p.cards.length === 0);
  document.getElementById('root').innerHTML = `
    <div class="container menu">
      <h1>🏆 بازی تمام شد!</h1>
      <h2>${escapeHtml(winner?.name || 'برنده مشخص نیست')}</h2>
      <button onclick="goToMenu()" class="btn btn-primary">بازگشت به منو</button>
    </div>`;
}

// =========================
// Navigation
// =========================
function goToMenu() {
  gameState = 'menu';
  currentTableId = null;
  currentPlayerId = null;
  currentPlayerName = '';
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

// =========================
// Create / Join
// =========================
async function createTable() {
  const input = document.getElementById('playerNameInput');
  const name = input?.value.trim();

  if (!name) return alert('لطفاً نام خود را وارد کنید!');

  let code = generateRoomCode();
  for (let i = 0; i < 10; i++) {
    const existing = await loadGame(code);
    if (!existing) break;
    code = generateRoomCode();
  }

  const player = { id: generateId(), name, cards: [], score: 0 };
  const newGame = {
    code,
    status: 'waiting',
    direction: 1,
    currentPlayerIndex: 0,
    selectedSuit: null,
    players: [player],
    deck: createDeck(),
    tableCards: []
  };

  const result = await insertGame(newGame);
  if (result === null) {
    alert('خطا در ایجاد میز!\nSupabase URL، ANON KEY و دسترسی جدول games را بررسی کن.');
    return;
  }

  games[code] = newGame;
  currentTableId = code;
  currentPlayerId = player.id;
  currentPlayerName = name;
  gameState = 'lobby';
  renderLobby();
  startPolling();
}

async function joinTable() {
  const code = document.getElementById('codeInput')?.value.trim();
  const name = document.getElementById('playerNameInput2')?.value.trim();

  if (!/^\d{4}$/.test(code)) return alert('کد باید دقیقاً ۴ رقم باشد!');
  if (!name) return alert('لطفاً نام خود را وارد کنید!');

  const game = await loadGame(code);
  if (!game) return alert(`کد «${code}» وجود ندارد!`);
  if (game.status !== 'waiting') return alert('این بازی قبلاً شروع شده است!');
  if (game.players.length >= 10) return alert('میز پر شده است!');

  // جلوگیری از ورود دوباره همان دستگاه/بازیکن در همان میز
  if (game.players.some(p => p.name === name)) {
    return alert('این نام قبلاً در میز استفاده شده است.');
  }

  const newPlayer = { id: generateId(), name, cards: [], score: 0 };
  game.players.push(newPlayer);

  if (!(await saveGame(game))) {
    alert('خطا در ثبت بازیکن در Supabase.');
    return;
  }

  games[code] = game;
  currentTableId = code;
  currentPlayerId = newPlayer.id;
  currentPlayerName = name;
  gameState = 'lobby';
  renderLobby();
  startPolling();
}

// =========================
// Start Game
// =========================
async function startGame() {
  const game = games[currentTableId];
  if (!game) return;
  if (game.players[0]?.id !== currentPlayerId) return alert('فقط سازنده میز می‌تواند بازی را شروع کند.');
  if (game.players.length < 2) return alert('حداقل ۲ بازیکن لازم است!');

  // دوباره آخرین نسخه دیتابیس را بگیر تا Start روی داده قدیمی انجام نشود.
  const fresh = await loadGame(currentTableId);
  if (!fresh) return alert('میز پیدا نشد!');
  if (fresh.players[0]?.id !== currentPlayerId) return alert('فقط سازنده میز می‌تواند بازی را شروع کند.');

  const deck = [...fresh.deck];
  fresh.players.forEach(player => {
    player.cards = [];
    for (let i = 0; i < 7 && deck.length; i++) player.cards.push(deck.pop());
  });

  if (!deck.length) return alert('کارت کافی برای شروع بازی وجود ندارد.');

  fresh.tableCards = [deck.pop()];
  fresh.deck = deck;
  fresh.status = 'playing';
  fresh.currentPlayerIndex = 0;
  fresh.selectedSuit = null;

  if (!(await saveGame(fresh))) {
    alert('خطا در شروع بازی.');
    return;
  }

  games[currentTableId] = fresh;
  gameState = 'game';
  renderGame();
  startPolling();
}

// =========================
// Rules
// =========================
function validateCard(card) {
  const game = games[currentTableId];
  if (!game?.tableCards.length) return true;

  const lastCard = game.tableCards.at(-1);
  if (!lastCard) return true;

  // J در نسخه اصلی به‌عنوان کارت آزاد تعریف شده بود.
  if (card.rank === 'J') return true;

  // اگر J قبلی بازی شده، خال انتخاب‌شده ملاک است.
  const activeSuit = game.selectedSuit || lastCard.suit;
  return card.suit === activeSuit || card.rank === lastCard.rank;
}

async function playCard(cardId) {
  const game = games[currentTableId];
  if (!game) return;

  const myIndex = game.players.findIndex(p => p.id === currentPlayerId);
  if (myIndex < 0) return;
  if (game.currentPlayerIndex !== myIndex) return alert('نوبت شما نیست!');

  const myPlayer = game.players[myIndex];
  const card = myPlayer.cards.find(c => c.id === cardId);
  if (!card) return;
  if (!validateCard(card)) return alert('کارت نامعتبر!');

  // برای J خال جدید را از کاربر می‌گیریم.
  if (card.rank === 'J') {
    const suit = prompt('خال جدید را انتخاب کن: H=♥ ، D=♦ ، C=♣ ، S=♠', 'H')?.toUpperCase();
    if (!['H', 'D', 'C', 'S'].includes(suit)) return alert('خال نامعتبر است.');
    game.selectedSuit = suit;
  } else {
    game.selectedSuit = null;
  }

  myPlayer.cards = myPlayer.cards.filter(c => c.id !== cardId);
  game.tableCards.push(card);

  // برد
  if (myPlayer.cards.length === 0) {
    game.status = 'finished';
    await saveGame(game);
    games[currentTableId] = game;
    renderFinished(game);
    return;
  }

  game.currentPlayerIndex = nextPlayerIndex(game);

  if (!(await saveGame(game))) {
    alert('خطا در ذخیره حرکت.');
    return;
  }

  games[currentTableId] = game;
  renderGame();
}

function nextPlayerIndex(game) {
  return (game.currentPlayerIndex + game.direction + game.players.length) % game.players.length;
}

async function drawCard() {
  const game = games[currentTableId];
  if (!game) return;

  const myIndex = game.players.findIndex(p => p.id === currentPlayerId);
  if (myIndex < 0) return;
  if (game.currentPlayerIndex !== myIndex) return alert('نوبت شما نیست!');

  // قبل از حرکت، Deck را در صورت نیاز بازسازی کن.
  if (game.deck.length === 0) refillDeck(game);

  if (game.deck.length === 0) {
    alert('دیگر کارتی برای برداشتن وجود ندارد.');
    return;
  }

  const newCard = game.deck.pop();
  if (!newCard) return;

  game.players[myIndex].cards.push(newCard);
  game.currentPlayerIndex = nextPlayerIndex(game);

  if (!(await saveGame(game))) {
    alert('خطا در ذخیره حرکت.');
    return;
  }

  games[currentTableId] = game;
  renderGame();
}

function refillDeck(game) {
  // آخرین کارت روی میز باید بماند؛ بقیه دوباره وارد Deck می‌شوند.
  if (game.tableCards.length <= 1) return;

  const lastCard = game.tableCards.at(-1);
  const recyclable = game.tableCards.slice(0, -1);
  game.tableCards = [lastCard];
  game.deck = shuffle([...game.deck, ...recyclable]);
}

// =========================
// Boot
// =========================
renderMenu();
