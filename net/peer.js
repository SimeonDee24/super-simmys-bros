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
      const p = new window.Peer(PREFIX + code);
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
    // losing the matchmaking server does not end the match, but new friends could not join: reconnect
    peer.on('disconnected', () => { if (!peer.destroyed) setTimeout(() => { if (!peer.destroyed) peer.reconnect(); }, 2000); });
    return { code, close() { peer.destroy(); } };
  }
  throw new Error('COULD NOT OPEN A ROOM. TRY AGAIN');
}

// Join the room with this code. Resolves to a link to the host.
export async function joinOnline(code) {
  await loadLib();
  return new Promise((resolve, reject) => {
    const peer = new window.Peer();
    let done = false;
    const fail = (text) => { if (done) return; done = true; clearTimeout(timer); peer.destroy(); reject(new Error(text)); };
    const timer = setTimeout(() => fail('COULD NOT CONNECT TO THAT ROOM'), 20000);
    peer.on('error', (e) => fail(e && e.type === 'peer-unavailable' ? 'NO ROOM WITH THAT CODE' : 'COULD NOT CONNECT. CHECK YOUR INTERNET'));
    peer.on('open', () => {
      const conn = peer.connect(PREFIX + code.toUpperCase(), { reliable: true, serialization: 'json' });
      conn.on('open', () => { if (done) return; done = true; clearTimeout(timer); resolve(wrap(conn, () => peer.destroy())); });
      conn.on('error', () => fail('COULD NOT CONNECT TO THAT ROOM'));
    });
  });
}
