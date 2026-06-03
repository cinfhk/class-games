// Shared leaderboard helper for Class Games.
// Backed by jsonbin.io v3 — reliable, CORS-friendly, requires a free
// API key (X-Master-Key) created by the teacher once at jsonbin.io.

const JB_API = 'https://api.jsonbin.io/v3/b';
const LS_KEY = 'azia_apikey';
const LS_BIN = 'azia_binid';
const LS_PLAYER = 'azia_player';
const LS_TEACHER = 'azia_is_teacher';

// ⚠ Shared class API key for student mode.
// Paste your jsonbin.io X-Master-Key here so students don't need to.
// Rotate the key on jsonbin.io after every lesson to avoid abuse —
// this repo is public, so anyone can read it.
const CLASS_API_KEY = '$2a$10$yAFaloarFe1fmq4U9ZbqTuOSPkOvmje19t.Yy3Zd0Yik4SW0yfmzy';

function isTeacher() {
  const hash = readHash();
  if (hash.get('student') === '1') {
    localStorage.removeItem(LS_TEACHER);
    return false;
  }
  if (hash.get('teacher') === '1') {
    localStorage.setItem(LS_TEACHER, '1');
    return true;
  }
  return localStorage.getItem(LS_TEACHER) === '1';
}
function setTeacher(v) {
  if (v) localStorage.setItem(LS_TEACHER, '1');
  else localStorage.removeItem(LS_TEACHER);
}

function teacherUrl() {
  const room = localStorage.getItem(LS_BIN);
  const base = window.location.origin + window.location.pathname.replace(/[^/]*$/, '');
  const params = new URLSearchParams({ teacher: '1' });
  if (room) params.set('room', room);
  return base + '#' + params.toString();
}

function readHash() {
  return new URLSearchParams(window.location.hash.replace(/^#/, ''));
}
function writeHash(params) {
  history.replaceState(null, '', '#' + params.toString());
}

function getApiKey() {
  return CLASS_API_KEY || localStorage.getItem(LS_KEY) || '';
}

function setApiKey(key) {
  const clean = (key || '').trim();
  localStorage.setItem(LS_KEY, clean);
  syncHash();
  return clean;
}

// jsonbin bin IDs are 24-char lowercase hex strings.
function isValidRoomId(id) {
  return /^[a-f0-9]{24}$/i.test(String(id || ''));
}

// Accept raw IDs, share URLs, or `room=…&key=…` hash strings.
// Also extracts and stores the API key if found.
function parseRoomInput(raw) {
  if (!raw) return '';
  raw = String(raw).trim();
  // Try parsing as a full URL
  try {
    const url = new URL(raw);
    const hash = url.hash.startsWith('#') ? url.hash.slice(1) : url.hash;
    const params = new URLSearchParams(hash);
    const room = params.get('room') || params.get('bin');
    const key = params.get('key');
    if (key) setApiKey(key);
    if (room && isValidRoomId(room)) return room;
  } catch (_) {}
  // Maybe it's a bare hash/query string
  if (raw.includes('room=') || raw.includes('bin=')) {
    const cleaned = raw.replace(/^#/, '');
    const params = new URLSearchParams(cleaned);
    const room = params.get('room') || params.get('bin');
    const key = params.get('key');
    if (key) setApiKey(key);
    if (room && isValidRoomId(room)) return room;
  }
  // Or a raw ID
  if (isValidRoomId(raw)) return raw;
  return '';
}

function getRoom() {
  const hash = readHash();
  // Student page should not auto-join old/cached rooms.
  // Student must paste the room ID manually.
  if (hash.get('student') === '1' && !hash.get('room') && !hash.get('bin')) {
    localStorage.removeItem(LS_BIN);
    return '';
  }
  const raw =
    hash.get('room') ||
    hash.get('bin') ||
    localStorage.getItem(LS_BIN) ||
    '';
  const room = parseRoomInput(raw);
  if (!room) {
    localStorage.removeItem(LS_BIN);
    return '';
  }
  localStorage.setItem(LS_BIN, room);
  return room;
}

function setRoom(raw) {
  const room = parseRoomInput(raw);
  if (!room) {
    localStorage.removeItem(LS_BIN);
    throw new Error('Neplatné ID herne (musí byť 24 hex znakov)');
  }
  localStorage.setItem(LS_BIN, room);
  syncHash();
  return room;
}

function syncHash() {
  const params = readHash();
  const room = localStorage.getItem(LS_BIN);
  if (room && params.get('teacher') === '1') {
    params.set('room', room);
  } else {
    params.delete('room');
  }
  params.delete('key');
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
  const base = window.location.origin + window.location.pathname.replace(/[^/]*$/, '');
  return base + '#student=1';
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
  shareableUrl, teacherUrl, aggregate, parseRoomInput, isValidRoomId,
  isTeacher, setTeacher
};
