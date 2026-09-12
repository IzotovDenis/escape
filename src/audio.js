// Procedural effects stay available offline and start only after a user gesture.
export function createAudio() {
  let context, master, noise, muted = false;
  const voices = new Set();
  function init() {
    if (context) return;
    context = new (window.AudioContext || window.webkitAudioContext)();
    master = context.createGain(); master.gain.value = muted ? 0 : 0.7;
    const limiter = context.createDynamicsCompressor();
    limiter.threshold.value = -10; limiter.ratio.value = 5;
    master.connect(limiter); limiter.connect(context.destination);
    noise = context.createBuffer(1, context.sampleRate, context.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  async function unlock() {
    try { init(); if (context.state !== 'running') await context.resume(); } catch { /* Audio is optional. */ }
  }
  function layer({ frequency = 400, end = frequency, duration = 0.15, volume = 0.2, type = 'sine', delay = 0, pan = 0, noise: hiss = false, q = 1 }) {
    if (muted || context?.state !== 'running' || voices.size >= 48) return;
    const t = context.currentTime + delay;
    const source = hiss ? context.createBufferSource() : context.createOscillator();
    const gain = context.createGain(), filter = context.createBiquadFilter(), stereo = context.createStereoPanner();
    if (hiss) { source.buffer = noise; source.loop = true; }
    else { source.type = type; source.frequency.setValueAtTime(frequency, t); source.frequency.exponentialRampToValueAtTime(Math.max(20, end), t + duration); }
    filter.type = 'bandpass'; filter.frequency.value = frequency; filter.Q.value = q;
    gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(volume, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    stereo.pan.value = Math.max(-1, Math.min(1, pan));
    if (hiss) { source.connect(filter); filter.connect(gain); } else source.connect(gain);
    gain.connect(stereo); stereo.connect(master);
    voices.add(source); source.start(t); source.stop(t + duration + 0.02);
    source.onended = () => { voices.delete(source); source.disconnect(); filter.disconnect(); gain.disconnect(); stereo.disconnect(); };
  }
  function effect(kind, volume = 1, pan = 0) {
    const play = opts => layer({ ...opts, volume: (opts.volume ?? 0.2) * volume, pan });
    if (kind === 'step') {
      play({ frequency: 230 + Math.random() * 50, end: 95, duration: 0.11, volume: 0.28 });
      play({ noise: true, frequency: 1700, duration: 0.075, volume: 0.4 });
      play({ noise: true, frequency: 950, duration: 0.15, delay: 0.06, volume: 0.12 });
    } else if (kind === 'door-open') {
      play({ noise: true, frequency: 2600, duration: 0.08, volume: 0.45 });
      play({ frequency: 680, end: 230, type: 'triangle', duration: 0.55, delay: 0.06, volume: 0.14 });
      play({ noise: true, frequency: 700, duration: 0.45, delay: 0.08, volume: 0.2 });
    } else if (kind === 'door-close' || kind === 'locked') {
      play({ frequency: 190, end: 65, duration: 0.24, volume: 0.48 });
      play({ noise: true, frequency: 900, duration: 0.2, volume: 0.5 });
      play({ noise: true, frequency: 2900, duration: 0.06, delay: 0.13, volume: 0.22 });
    } else if (kind === 'cat') {
      play({ frequency: 650, end: 950, duration: 0.18, type: 'triangle', volume: 0.15 });
      play({ frequency: 950, end: 420, duration: 0.4, delay: 0.14, type: 'triangle', volume: 0.17 });
      for (let i = 0; i < 18; i++) play({ noise: true, frequency: 180, duration: 0.06, delay: 0.55 + i * 0.04, volume: 0.24 });
    } else if (kind === 'dog') {
      for (const delay of [0, 0.23]) {
        play({ frequency: 330, end: 110, duration: 0.17, type: 'sawtooth', volume: 0.08, delay });
        play({ noise: true, frequency: 600, duration: 0.13, volume: 0.22, delay });
      }
    } else if (kind === 'splat') {
      play({ noise: true, frequency: 650, duration: 0.25, volume: 0.5 });
      play({ frequency: 190, end: 45, duration: 0.18, volume: 0.26 });
    } else if (kind === 'book') {
      play({ noise: true, frequency: 3400, duration: 0.25, volume: 0.18 });
    }
  }
  function stop() { for (const source of voices) { try { source.stop(); } catch {} } }
  function setMuted(value) {
    muted = value;
    if (master) master.gain.setTargetAtTime(muted ? 0 : 0.7, context.currentTime, 0.015);
    if (muted) stop();
  }
  return { unlock, layer, effect, setMuted, stop };
}
