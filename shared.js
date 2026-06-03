// Shared leaderboard helper for Class Games.
// Backed by jsonbin.io v3 — reliable, CORS-friendly, requires a free
// API key (X-Master-Key) created by the teacher once at jsonbin.io.

const JB_API = 'https://api.jsonbin.io/v3/b';
const LS_KEY = 'azia_apikey';
const LS_BIN = 'azia_binid';
const LS_PLAYER = 'azia_player';

function readHash() {
  return new URLSearchParams(window.location.hash.replace(/^#/, ''));
}
function writeHash(params) {
  history.replaceState(null, '', '#' + params.toString());
}

function getApiKey() {
  const fromHash = readHash().get('key');
  if (fromHash) {
    localStorage.setItem(LS_KEY, fromHash);
    return fromHash;
  }
  return localStorage.getItem(LS_KEY) || '';
}

function setApiKey(key) {
  const clean = (key || '').trim();
  localStorage.setItem(LS_KEY, clean);
  syncHash();
  return clean;
}

function getRoom() {
  const fromHash = readHash().get('room') || readHash().get('bin');
  if (fromHash) {
    localStorage.setItem(LS_BIN, fromHash);
    return fromHash;
  }
  return localStorage.getItem(LS_BIN) || '';
}

function setRoom(id) {
  localStorage.setItem(LS_BIN, id);
  syncHash();
  return id;
}

function syncHash() {
  const params = readHash();
  const room = localStorage.getItem(LS_BIN);
  const key = localStorage.getItem(LS_KEY);
  if (room) params.set('room', room); else params.delete('room');
  if (key) params.set('key', key); else params.delete('key');
  writeHash(params);
}

function getPlayer() {
  return localStorage.getItem(LS_PLAYER) || '';
}

function setPlayer(name) {
  const clean = (name || '').trim().slice(0, 24);
  localStorage.setItem(LS_PLAYER, clean);
  return clean;
}

async function createRoom() {
  const key = getApiKey();
  if (!key) throw new Error('Najprv vlož API key z jsonbin.io');
  const initial = { scores: [], createdAt: Date.now() };
  const ctrl = new AbortController();
  const timeoutId = setTimeout(() => ctrl.abort(), 15000);
  let res;
  try {
    res = await fetch(JB_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': key,
        'X-Bin-Private': 'false',
        'X-Bin-Name': 'Class Games ' + new Date().toISOString().slice(0, 10)
      },
      body: JSON.stringify(initial),
      signal: ctrl.signal
    });
  } catch (e) {
    clearTimeout(timeoutId);
    if (e.name === 'AbortError') throw new Error('jsonbin.io sa neozýva (timeout)');
    throw new Error('Sieťová chyba: ' + e.message);
  }
  clearTimeout(timeoutId);
  if (!res.ok) {
    let detail = '';
    try { detail = ' — ' + (await res.text()).slice(0, 120); } catch {}
    throw new Error('jsonbin.io vrátil ' + res.status + detail);
  }
  const data = await res.json();
  const id = data && data.metadata && data.metadata.id;
  if (!id) throw new Error('jsonbin.io: odpoveď neobsahuje bin ID');
  setRoom(id);
  return id;
}

async function fetchScores() {
  const room = getRoom();
  const key = getApiKey();
  if (!room || !key) return [];
  try {
    const res = await fetch(`${JB_API}/${room}/latest`, {
      headers: { 'X-Master-Key': key, 'X-Bin-Meta': 'false' }
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.scores) ? data.scores : [];
  } catch (e) {
    console.error('fetchScores', e);
    return [];
  }
}

async function submitScore(game, score, extras = {}) {
  const room = getRoom();
  const key = getApiKey();
  const player = getPlayer();
  if (!room || !key || !player) return false;
  try {
    const getRes = await fetch(`${JB_API}/${room}/latest`, {
      headers: { 'X-Master-Key': key, 'X-Bin-Meta': 'false' }
    });
    if (!getRes.ok) return false;
    const data = await getRes.json();
    if (!Array.isArray(data.scores)) data.scores = [];
    data.scores.push({ player, game, score: Number(score) || 0, ts: Date.now(), ...extras });
    const putRes = await fetch(`${JB_API}/${room}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Master-Key': key },
      body: JSON.stringify(data)
    });
    return putRes.ok;
  } catch (e) {
    console.error('submitScore', e);
    return false;
  }
}

function shareableUrl() {
  const room = getRoom();
  const key = getApiKey();
  const base = window.location.origin + window.location.pathname.replace(/[^/]*$/, '');
  if (!room || !key) return base;
  const params = new URLSearchParams({ room, key });
  return base + '#' + params.toString();
}

function aggregate(scores) {
  const byPlayerGame = new Map();
  scores.forEach(s => {
    const key = s.player + '||' + s.game;
    const prev = byPlayerGame.get(key);
    if (!prev || s.score > prev.score) byPlayerGame.set(key, s);
  });
  const totals = new Map();
  byPlayerGame.forEach(s => {
    const t = totals.get(s.player) || { player: s.player, total: 0, perGame: {} };
    t.total += s.score;
    t.perGame[s.game] = s.score;
    totals.set(s.player, t);
  });
  return Array.from(totals.values()).sort((a, b) => b.total - a.total);
}

window.Leaderboard = {
  getRoom, setRoom, getApiKey, setApiKey, getPlayer, setPlayer,
  createRoom, fetchScores, submitScore,
  shareableUrl, aggregate
};
