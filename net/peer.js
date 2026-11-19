// Real connections between browsers, using WebRTC data channels through the
// PeerJS library and its free public matchmaking server. The game data goes
// straight from browser to browser; the server only introduces them.
//
// A room code is four letters. The host registers as "<PREFIX><code>" and
// friends connect to that name.
const LIB = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
const PREFIX = 'super-simmys-bros-room-';
export const CODE_LENGTH = 4;
export const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';   // no I or O: they look like 1 and 0

// How browsers find a way to reach each other: public STUN servers first;
// if the network blocks a direct connection (some campus and phone
// networks do), the data goes through PeerJS's free relay (TURN) instead.
const OPTIONS = {
  config: {
    iceServers: [
      { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
      { urls: ['turn:0.peerjs.com:3478', 'turn:0.peerjs.com:3478?transport=tcp'], username: 'peerjs', credential: 'peerjsp' },
    ],
  },
};

let lib = null;
function loadLib() {
  if (!lib) {
    lib = new Promise((resolve, reject) => {
      if (window.Peer) { resolve(); return; }
      const s = document.createElement('script');
      s.src = LIB;
      s.onload = () => (window.Peer ? resolve() : reject(new Error('COULD NOT LOAD THE ONLINE LIBRARY')));
      s.onerror = () => { lib = null; reject(new Error('COULD NOT LOAD THE ONLINE LIBRARY. CHECK YOUR INTERNET')); };
      document.head.appendChild(s);
    });
  }
  return lib;
}

// Turn a PeerJS connection into a link. Messages that arrive before anyone
// is listening are kept and handed over as soon as onmessage is set.
function wrap(conn, onDone) {
  const waiting = [];
  let handler = null, closed = false;
  const link = {
    send(obj) { if (!closed && conn.open) conn.send(obj); },
    close() { if (closed) return; closed = true; try { conn.close(); } catch (e) { /* already gone */ } if (onDone) onDone(); },
    get onmessage() { return handler; },
    set onmessage(fn) { handler = fn; while (handler && waiting.length) handler(waiting.shift()); },
    onclose: null,
  };
  const ended = () => { if (closed) return; closed = true; if (link.onclose) link.onclose(); if (onDone) onDone(); };
  conn.on('data', (d) => { if (handler) handler(d); else waiting.push(d); });
  conn.on('close', ended);
  conn.on('error', ended);
  // a closed tab does not always say goodbye: watch the connection itself too
  const pc = conn.peerConnection;
  if (pc) pc.addEventListener('iceconnectionstatechange', () => { if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'closed') ended(); });
  return link;
}

const randomCode = () => Array.from({ length: CODE_LENGTH }, () => CODE_LETTERS[Math.floor(Math.random() * CODE_LETTERS.length)]).join('');

// Open a room. onLink(link) is called for every friend who connects.
// Resolves to { code, close() }.
export async function hostOnline(onLink) {
  await loadLib();
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = randomCode();
    const peer = await new Promise((resolve, reject) => {
      const p = new window.Peer(PREFIX + code, OPTIONS);
      const timer = setTimeout(() => { p.destroy(); reject(new Error('COULD NOT REACH THE MATCHMAKING SERVER')); }, 15000);
      p.on('open', () => { clearTimeout(timer); resolve(p); });
      p.on('error', (e) => {
        clearTimeout(timer);
        if (e && e.type === 'unavailable-id') { p.destroy(); resolve(null); }   // code in use: try another
        else reject(new Error('COULD NOT REACH THE MATCHMAKING SERVER'));
      });
    });
    if (!peer) continue;
    peer.on('connection', (conn) => conn.on('open', () => onLink(wrap(conn))));
    // Losing the matchmaking server does not end a match, but new friends
    // could not find the room: keep reconnecting, and check every few seconds
    // (a sleeping laptop or a tab in the background can drop it quietly).
    const keepAlive = () => { if (!peer.destroyed && peer.disconnected) { try { peer.reconnect(); } catch (e) { /* tries again next time */ } } };
    peer.on('disconnected', () => setTimeout(keepAlive, 1000));
    peer.on('error', () => setTimeout(keepAlive, 1000));
    const timer = setInterval(keepAlive, 5000);
    const onVisible = () => { if (document.visibilityState === 'visible') keepAlive(); };
    document.addEventListener('visibilitychange', onVisible);
    return { code, close() { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); peer.destroy(); } };
  }
  throw new Error('COULD NOT OPEN A ROOM. TRY AGAIN');
}

// Join the room with this code. Resolves to a link to the host. Tries a few
// times: a first attempt can fail on a flaky network, or while the host's
// browser is reconnecting to the matchmaking server. onStatus(text) reports
// progress.
export async function joinOnline(code, onStatus = () => {}) {
  await loadLib();
  let last = null;
  for (let tries = 1; tries <= 3; tries++) {
    if (tries > 1) { onStatus('TRYING AGAIN (' + tries + ' OF 3)...'); await new Promise((r) => setTimeout(r, 1500)); }
    try { return await joinOnce(code); } catch (e) { last = e; }
  }
  throw last;
}
function joinOnce(code) {
  return new Promise((resolve, reject) => {
    const peer = new window.Peer(OPTIONS);
    let done = false;
    const fail = (text) => { if (done) return; done = true; clearTimeout(timer); peer.destroy(); reject(new Error(text)); };
    const timer = setTimeout(() => fail('FOUND THE ROOM BUT COULD NOT CONNECT. YOUR NETWORK MAY BE BLOCKING IT: TRY ANOTHER WI-FI OR A HOTSPOT'), 25000);
    peer.on('error', (e) => fail(e && e.type === 'peer-unavailable' ? 'NO ROOM WITH THAT CODE. CHECK THE CODE, AND THAT THE HOST STILL HAS THE ROOM OPEN'
      : e && (e.type === 'network' || e.type === 'server-error' || e.type === 'socket-error') ? 'COULD NOT REACH THE MATCHMAKING SERVER. CHECK YOUR INTERNET' : 'COULD NOT CONNECT TO THAT ROOM'));
    peer.on('open', () => {
      const conn = peer.connect(PREFIX + code.toUpperCase(), { reliable: true, serialization: 'json' });
      conn.on('open', () => { if (done) return; done = true; clearTimeout(timer); resolve(wrap(conn, () => peer.destroy())); });
      conn.on('error', () => fail('COULD NOT CONNECT TO THAT ROOM'));
    });
  });
}
