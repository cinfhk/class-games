// Shared leaderboard helper for Class Games.
// Uses jsonblob.com — free, no signup, CORS-enabled JSON storage.
// One "room" = one shared bin. The room ID lives in the URL hash so
// any classmate opening the same link sees the same scoreboard.

const LB_API = 'https://jsonblob.com/api/jsonBlob';
const LS_PLAYER = 'azia_player';
const LS_ROOM = 'azia_room';

function readHashParams() {
  return new URLSearchParams(window.location.hash.replace(/^#/, ''));
}

function writeHashParams(params) {
  history.replaceState(null, '', '#' + params.toString());
}

function getRoom() {
  const fromHash = readHashParams().get('room');
  if (fromHash) {
    localStorage.setItem(LS_ROOM, fromHash);
    return fromHash;
  }
  return localStorage.getItem(LS_ROOM);
}

function setRoom(id) {
  localStorage.setItem(LS_ROOM, id);
  const params = readHashParams();
  params.set('room', id);
  writeHashParams(params);
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
  const initial = { scores: [], createdAt: Date.now() };
  const res = await fetch(LB_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(initial)
  });
  if (!res.ok) throw new Error('Create room failed: ' + res.status);
  const location = res.headers.get('Location') || '';
  const id = location.split('/').pop();
  if (!id) throw new Error('No room id returned');
  setRoom(id);
  return id;
}

async function fetchScores() {
  const room = getRoom();
  if (!room) return [];
  const res = await fetch(`${LB_API}/${room}`, { headers: { 'Accept': 'application/json' } });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data.scores) ? data.scores : [];
}

async function submitScore(game, score, extras = {}) {
  const room = getRoom();
  const player = getPlayer();
  if (!room || !player) return false;
  try {
    const getRes = await fetch(`${LB_API}/${room}`);
    if (!getRes.ok) return false;
    const data = await getRes.json();
    if (!Array.isArray(data.scores)) data.scores = [];
    data.scores.push({ player, game, score: Number(score) || 0, ts: Date.now(), ...extras });
    const putRes = await fetch(`${LB_API}/${room}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(data)
    });
    return putRes.ok;
  } catch (e) {
    console.error('submitScore failed', e);
    return false;
  }
}

function shareableUrl() {
  const room = getRoom();
  const base = window.location.origin + window.location.pathname.replace(/[^/]*$/, '');
  return room ? `${base}#room=${room}` : base;
}

// Aggregate: best score per player per game, plus combined total
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
  getRoom, setRoom, getPlayer, setPlayer,
  createRoom, fetchScores, submitScore,
  shareableUrl, aggregate
};
