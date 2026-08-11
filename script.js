/* ============================================================
   TEKZIKO V4 — ad timeline controller
   ============================================================ */

(function () {
  "use strict";

  const TOTAL_DURATION = 30000; // ms

  const SCENES = [
    { id: 1, start: 0,     end: 2500  },
    { id: 2, start: 2500,  end: 5500  },
    { id: 3, start: 5500,  end: 8500  },
    { id: 4, start: 8500,  end: 13500 },
    { id: 5, start: 13500, end: 17500 },
    { id: 6, start: 17500, end: 20500 },
    { id: 7, start: 20500, end: 24000 },
    { id: 8, start: 24000, end: 27000 },
    { id: 9, start: 27000, end: 30000 }
  ];

  const body = document.body;
  const sceneEls = {};
  SCENES.forEach(s => { sceneEls[s.id] = document.getElementById("scene" + s.id); });

  const timelineFill = document.getElementById("timelineFill");
  const btnRestart = document.getElementById("btnRestart");
  const btnMute = document.getElementById("btnMute");
  const btnFullscreen = document.getElementById("btnFullscreen");
  const btnRecord = document.getElementById("btnRecord");
  const ctaButton = document.getElementById("ctaButton");

  let startTime = null;
  let rafId = null;
  let currentSceneId = null;
  let muted = false;

  /* ---------------- WebAudio synth SFX ---------------- */
  let actx = null;
  function ensureAudio() {
    if (!actx) {
      try { actx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) { actx = null; }
    }
    if (actx && actx.state === "suspended") actx.resume();
  }

  function tone(freq, type, t0, dur, peak) {
    const osc = actx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    const g = actx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + Math.min(0.03, dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(actx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noiseBurst(t0, dur, peak, filterType, freqFrom, freqTo) {
    const bufferSize = Math.floor(actx.sampleRate * dur);
    const buffer = actx.createBuffer(1, bufferSize, actx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    const src = actx.createBufferSource();
    src.buffer = buffer;
    const filter = actx.createBiquadFilter();
    filter.type = filterType || "bandpass";
    filter.frequency.setValueAtTime(freqFrom, t0);
    if (freqTo) filter.frequency.exponentialRampToValueAtTime(freqTo, t0 + dur);
    const g = actx.createGain();
    g.gain.setValueAtTime(0.001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + dur * 0.2);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter).connect(g).connect(actx.destination);
    src.start(t0);
    src.stop(t0 + dur);
  }

  function sfx(kind) {
    if (muted || !actx) return;
    const t0 = actx.currentTime;
    switch (kind) {
      case "impact-soft": noiseBurst(t0, 0.32, 0.13, "bandpass", 400, 1700); break;
      case "text-impact": tone(170, "sine", t0, 0.24, 0.22); noiseBurst(t0, 0.1, 0.09, "highpass", 3000); break;
      case "key-tick": tone(1200, "square", t0, 0.03, 0.03); break;
      case "click": tone(760, "sine", t0, 0.08, 0.13); break;
      case "browser-open": noiseBurst(t0, 0.4, 0.15, "bandpass", 300, 2200); tone(200, "sine", t0 + 0.05, 0.3, 0.11); break;
      case "confirm": [523.25, 659.25, 783.99].forEach((f, i) => tone(f, "sine", t0 + i * 0.06, 0.5, 0.1)); break;
      case "swipe": noiseBurst(t0, 0.16, 0.07, "highpass", 1500); break;
      case "reveal": [349.2, 440, 587.3].forEach((f, i) => tone(f, "sine", t0 + i * 0.09, 0.9, 0.09)); break;
      case "final": [440, 554.4, 659.25, 880].forEach((f, i) => tone(f, "sine", t0 + i * 0.05, 1.0, 0.09)); break;
    }
  }

  const SOUND_CUES = [
    { time: 0,     kind: "text-impact" },
    { time: 2500,  kind: "impact-soft" },
    { time: 5500,  kind: "impact-soft" },
    { time: 5900,  kind: "key-tick" },
    { time: 6100,  kind: "key-tick" },
    { time: 6300,  kind: "key-tick" },
    { time: 6500,  kind: "key-tick" },
    { time: 8500,  kind: "impact-soft" },
    { time: 9050,  kind: "browser-open" },
    { time: 10450, kind: "click" },
    { time: 12070, kind: "click" },
    { time: 12250, kind: "confirm" },
    { time: 13500, kind: "swipe" },
    { time: 14500, kind: "swipe" },
    { time: 15500, kind: "swipe" },
    { time: 16500, kind: "swipe" },
    { time: 17500, kind: "impact-soft" },
    { time: 20500, kind: "impact-soft" },
    { time: 24000, kind: "reveal" },
    { time: 27000, kind: "final" }
  ];
  let firedCues = new Set();

  function setScene(id) {
    if (id === currentSceneId) return;
    currentSceneId = id;
    Object.values(sceneEls).forEach(el => el && el.classList.remove("active"));
    if (sceneEls[id]) sceneEls[id].classList.add("active");
    body.setAttribute("data-scene", String(id));
  }

  function tick(ts) {
    if (startTime === null) startTime = ts;
    const elapsed = ts - startTime;

    const pct = Math.min(100, (elapsed / TOTAL_DURATION) * 100);
    timelineFill.style.width = pct + "%";

    const scene = SCENES.find(s => elapsed >= s.start && elapsed < s.end) || SCENES[SCENES.length - 1];
    setScene(scene.id);

    SOUND_CUES.forEach(cue => {
      if (!firedCues.has(cue.time) && elapsed >= cue.time) {
        firedCues.add(cue.time);
        sfx(cue.kind);
      }
    });

    if (elapsed < TOTAL_DURATION) {
      rafId = requestAnimationFrame(tick);
    }
  }

  function play() {
    cancelAnimationFrame(rafId);
    startTime = null;
    currentSceneId = null;
    firedCues = new Set();
    timelineFill.style.width = "0%";
    ensureAudio();
    rafId = requestAnimationFrame(tick);
  }

  function restart() { play(); }

  btnRestart.addEventListener("click", () => { ensureAudio(); restart(); });
  btnMute.addEventListener("click", () => { muted = !muted; btnMute.textContent = muted ? "🔇" : "🔊"; });
  btnFullscreen.addEventListener("click", () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
    else document.exitFullscreen();
  });

  let recordingMode = false;
  btnRecord.addEventListener("click", () => {
    recordingMode = !recordingMode;
    body.classList.toggle("recording-mode", recordingMode);
  });

  ctaButton.addEventListener("click", () => { sfx("click"); });

  window.addEventListener("keydown", (e) => {
    const key = e.key.toLowerCase();
    if (key === "r") { ensureAudio(); restart(); }
    if (key === "f") { btnFullscreen.click(); }
    if (key === "m") { btnMute.click(); }
  });

  ["click", "keydown", "touchstart"].forEach(evt => {
    window.addEventListener(evt, ensureAudio, { once: true });
  });

  window.addEventListener("load", () => {
    body.setAttribute("data-scene", "1");
    play();
  });
})();
