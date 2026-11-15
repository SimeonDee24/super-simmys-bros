// Links carry messages between two machines. A link is just
//   { send(obj), close(), onmessage, onclose }
// The real ones are made in net/peer.js. The ones here join two rooms inside
// one program, with made-up lag, so the netcode can be tested without a network.

// net = makeNet({ delay, jitter, rand }): a pretend network with its own clock.
// Call net.advance(ms) to move time on and deliver whatever is due.
export function makeNet({ delay = 0, jitter = 0, rand = () => 0.5 } = {}) {
  const net = {
    now: 0, queue: [], delay, jitter, rand, seq: 0,
    advance(ms) {
      net.now += ms;
      for (;;) {
        // deliver in the order sent on each link, like a reliable ordered channel
        let best = -1;
        for (let i = 0; i < net.queue.length; i++) if (net.queue[i].due <= net.now && (best < 0 || net.queue[i].seq < net.queue[best].seq)) best = i;
        if (best < 0) break;
        const m = net.queue.splice(best, 1)[0];
        if (m.close) { if (!m.to.closed) { m.to.closed = true; if (m.to.onclose) m.to.onclose(); } }
        else if (!m.to.closed && m.to.onmessage) m.to.onmessage(JSON.parse(m.text));
      }
    },
    // two ends of one connection
    pair() {
      const end = () => ({
        other: null, closed: false, lastDue: 0, onmessage: null, onclose: null,
        post(m) { const due = Math.max(this.lastDue, net.now + net.delay + net.jitter * net.rand()); this.lastDue = due; net.queue.push({ ...m, to: this.other, due, seq: net.seq++ }); },
        send(obj) { if (!this.closed) this.post({ text: JSON.stringify(obj) }); },
        close() { if (this.closed) return; this.closed = true; this.post({ close: true }); },
      });
      const a = end(), b = end();
      a.other = b; b.other = a;
      return [a, b];
    },
  };
  return net;
}
