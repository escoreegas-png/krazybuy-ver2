"use strict";

/* =========================================================
   TEKZIKO — Instagram SaaS Ad Controller
========================================================= */

const TOTAL_DURATION = 30000;

const scenes = [
  {
    id: 1,
    start: 0,
    end: 3500
  },
  {
    id: 2,
    start: 3500,
    end: 7000
  },
  {
    id: 3,
    start: 7000,
    end: 10500
  },
  {
    id: 4,
    start: 10500,
    end: 14500
  },
  {
    id: 5,
    start: 14500,
    end: 19000
  },
  {
    id: 6,
    start: 19000,
    end: 22500
  },
  {
    id: 7,
    start: 22500,
    end: 26000
  },
  {
    id: 8,
    start: 26000,
    end: 30000
  }
];


const ad = document.getElementById("ad");

const progressFill =
  document.getElementById("progressFill");

const restartButton =
  document.getElementById("restart");

const muteButton =
  document.getElementById("mute");

const recordButton =
  document.getElementById("record");


let startTime = null;

let animationFrame = null;

let currentScene = null;

let muted = false;

let recordingMode = false;

let audioContext = null;


/* =========================================================
   AUDIO
========================================================= */

function initAudio() {

  if (!audioContext) {

    try {

      audioContext =
        new (
          window.AudioContext ||
          window.webkitAudioContext
        )();

    } catch (error) {

      audioContext = null;

    }

  }

  if (
    audioContext &&
    audioContext.state === "suspended"
  ) {

    audioContext.resume();

  }

}


function sound(type) {

  if (muted || !audioContext) {
    return;
  }

  const now =
    audioContext.currentTime;


  const gain =
    audioContext.createGain();

  gain.connect(
    audioContext.destination
  );


  if (type === "click") {

    const oscillator =
      audioContext.createOscillator();

    oscillator.type = "sine";

    oscillator.frequency.setValueAtTime(
      800,
      now
    );

    oscillator.frequency.exponentialRampToValueAtTime(
      350,
      now + .08
    );

    gain.gain.setValueAtTime(
      .001,
      now
    );

    gain.gain.exponentialRampToValueAtTime(
      .08,
      now + .01
    );

    gain.gain.exponentialRampToValueAtTime(
      .001,
      now + .1
    );

    oscillator.connect(gain);

    oscillator.start(now);

    oscillator.stop(now + .11);

  }


  if (type === "whoosh") {

    const oscillator =
      audioContext.createOscillator();

    oscillator.type = "triangle";

    oscillator.frequency.setValueAtTime(
      160,
      now
    );

    oscillator.frequency.exponentialRampToValueAtTime(
      1000,
      now + .25
    );

    gain.gain.setValueAtTime(
      .001,
      now
    );

    gain.gain.exponentialRampToValueAtTime(
      .05,
      now + .04
    );

    gain.gain.exponentialRampToValueAtTime(
      .001,
      now + .3
    );

    oscillator.connect(gain);

    oscillator.start(now);

    oscillator.stop(now + .31);

  }


  if (type === "impact") {

    const oscillator =
      audioContext.createOscillator();

    oscillator.type = "sine";

    oscillator.frequency.setValueAtTime(
      120,
      now
    );

    oscillator.frequency.exponentialRampToValueAtTime(
      45,
      now + .3
    );

    gain.gain.setValueAtTime(
      .001,
      now
    );

    gain.gain.exponentialRampToValueAtTime(
      .15,
      now + .02
    );

    gain.gain.exponentialRampToValueAtTime(
      .001,
      now + .4
    );

    oscillator.connect(gain);

    oscillator.start(now);

    oscillator.stop(now + .41);

  }

}


/* =========================================================
   SCENE MANAGEMENT
========================================================= */

function getScene(elapsed) {

  return (
    scenes.find(
      scene =>
        elapsed >= scene.start &&
        elapsed < scene.end
    )
    ||
    scenes[scenes.length - 1]
  );

}


function activateScene(scene) {

  if (
    !scene ||
    currentScene === scene.id
  ) {

    return;

  }

  currentScene = scene.id;


  document
    .querySelectorAll(".scene")
    .forEach(element => {

      element.classList.remove(
        "active"
      );

    });


  const target =
    document.querySelector(
      `.scene-${scene.id}`
    );


  if (target) {

    target.classList.add(
      "active"
    );

  }

}


/* =========================================================
   TIMELINE
========================================================= */

function animationLoop(timestamp) {

  if (startTime === null) {

    startTime = timestamp;

  }


  const elapsed =
    timestamp - startTime;


  const progress =
    Math.min(
      100,
      (elapsed / TOTAL_DURATION) * 100
    );


  progressFill.style.width =
    `${progress}%`;


  const scene =
    getScene(elapsed);


  activateScene(scene);


  if (elapsed < TOTAL_DURATION) {

    animationFrame =
      requestAnimationFrame(
        animationLoop
      );

  } else {

    progressFill.style.width =
      "100%";

  }

}


/* =========================================================
   SOUND CUES
========================================================= */

const soundCues = [

  {
    time: 0,
    sound: "whoosh"
  },

  {
    time: 3500,
    sound: "click"
  },

  {
    time: 7000,
    sound: "whoosh"
  },

  {
    time: 10500,
    sound: "impact"
  },

  {
    time: 14500,
    sound: "click"
  },

  {
    time: 19000,
    sound: "whoosh"
  },

  {
    time: 22500,
    sound: "whoosh"
  },

  {
    time: 26000,
    sound: "impact"
  }

];


let firedSounds =
  new Set();


function checkSounds(elapsed) {

  soundCues.forEach(cue => {

    if (
      elapsed >= cue.time &&
      !firedSounds.has(cue.time)
    ) {

      firedSounds.add(
        cue.time
      );

      sound(cue.sound);

    }

  });

}


/* =========================================================
   MAIN LOOP WITH SOUND
========================================================= */

function run(timestamp) {

  if (startTime === null) {

    startTime = timestamp;

  }


  const elapsed =
    timestamp - startTime;


  const progress =
    Math.min(
      100,
      elapsed / TOTAL_DURATION * 100
    );


  progressFill.style.width =
    `${progress}%`;


  activateScene(
    getScene(elapsed)
  );


  checkSounds(elapsed);


  if (
    elapsed < TOTAL_DURATION
  ) {

    animationFrame =
      requestAnimationFrame(
        run
      );

  }

}


/* =========================================================
   PLAY
========================================================= */

function play() {

  cancelAnimationFrame(
    animationFrame
  );

  startTime = null;

  currentScene = null;

  firedSounds.clear();

  progressFill.style.width =
    "0%";


  document
    .querySelectorAll(".scene")
    .forEach(scene => {

      scene.classList.remove(
        "active"
      );

    });


  const firstScene =
    document.querySelector(
      ".scene-1"
    );

  if (firstScene) {

    firstScene.classList.add(
      "active"
    );

  }


  currentScene = 1;


  animationFrame =
    requestAnimationFrame(
      run
    );

}


/* =========================================================
   RESTART
========================================================= */

restartButton.addEventListener(
  "click",
  () => {

    initAudio();

    play();

  }
);


/* =========================================================
   MUTE
========================================================= */

muteButton.addEventListener(
  "click",
  () => {

    muted = !muted;

    muteButton.textContent =
      muted ? "🔇" : "🔊";

  }
);


/* =========================================================
   RECORDING MODE
========================================================= */

recordButton.addEventListener(
  "click",
  () => {

    recordingMode =
      !recordingMode;

    document.body.classList.toggle(
      "recording",
      recordingMode
    );

    recordButton.textContent =
      recordingMode
        ? "EXIT"
        : "REC MODE";

  }
);


/* =========================================================
   KEYBOARD
========================================================= */

window.addEventListener(
  "keydown",
  event => {

    const key =
      event.key.toLowerCase();


    if (key === "r") {

      initAudio();

      play();

    }


    if (key === "m") {

      muteButton.click();

    }


    if (key === " ") {

      initAudio();

      play();

    }


    if (key === "f") {

      if (
        !document.fullscreenElement
      ) {

        document.documentElement
          .requestFullscreen()
          .catch(() => {});

      } else {

        document
          .exitFullscreen()
          .catch(() => {});

      }

    }

  }
);


/* =========================================================
   AUDIO UNLOCK
========================================================= */

[
  "click",
  "keydown",
  "touchstart"
].forEach(eventName => {

  window.addEventListener(
    eventName,
    initAudio,
    {
      once: true
    }
  );

});


/* =========================================================
   START
========================================================= */

window.addEventListener(
  "load",
  () => {

    document.body
      .setAttribute(
        "data-ready",
        "true"
      );

    play();

  }
);
