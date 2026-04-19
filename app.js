const STORAGE_KEY = "still-meditation-settings-v3";

const DEFAULT_SETTINGS = {
  minutes: 10,
  startBell: true,
  endBell: true,
  intervalBell: false,
  guided: false,
  voiceStyle: "female",
  speechRate: 0.9,
  backgroundSoundEnabled: false,
  backgroundSoundType: "pink",
  backgroundVolume: 35
};

const GUIDED_PROMPTS = [
  "Settle into stillness. Feel the body supported. Let the breath arrive just as it is.",
  "Notice the inhale, and notice the exhale. There is nothing to force and nothing to fix.",
  "When the mind wanders, gently acknowledge it and return to this breath.",
  "See if you can soften the jaw, the shoulders, and the space around the eyes.",
  "Let sounds come and go in the background while your attention rests here in the present.",
  "Notice sensations in the body with curiosity, not judgment.",
  "If a thought appears, let it pass like weather. Come back to breathing.",
  "Rest attention on one full breath at a time, allowing each exhale to lengthen slightly.",
  "You do not need to clear the mind. You only need to notice and begin again.",
  "As you sit here, allow a little more ease, a little less effort, and a little more presence."
];

let state = {
  ...DEFAULT_SETTINGS,
  durationSeconds: DEFAULT_SETTINGS.minutes * 60,
  remainingSeconds: DEFAULT_SETTINGS.minutes * 60,
  intervalId: null,
  endAt: null,
  isRunning: false,
  hasStartedOnce: false,
  spokenCheckpoints: new Set(),
  voices: [],
  backgroundAudioEl: null,
  noiseNode: null,
  noiseGainNode: null
};

const els = {
  timeDisplay: document.getElementById("timeDisplay"),
  statusText: document.getElementById("statusText"),
  progressBar: document.getElementById("progressBar"),
  ringProgress: document.getElementById("ringProgress"),
  presetButtons: Array.from(document.querySelectorAll(".preset-btn")),
  startBtn: document.getElementById("startBtn"),
  pauseBtn: document.getElementById("pauseBtn"),
  resumeBtn: document.getElementById("resumeBtn"),
  resetBtn: document.getElementById("resetBtn"),
  startBellToggle: document.getElementById("startBellToggle"),
  endBellToggle: document.getElementById("endBellToggle"),
  intervalBellToggle: document.getElementById("intervalBellToggle"),
  guidedToggle: document.getElementById("guidedToggle"),
  voiceStyle: document.getElementById("voiceStyle"),
  speechRate: document.getElementById("speechRate"),
  speechRateValue: document.getElementById("speechRateValue"),
  backgroundSoundToggle: document.getElementById("backgroundSoundToggle"),
  backgroundSoundType: document.getElementById("backgroundSoundType"),
  backgroundVolume: document.getElementById("backgroundVolume"),
  backgroundVolumeValue: document.getElementById("backgroundVolumeValue")
};

const ringRadius = 96;
const ringCircumference = 2 * Math.PI * ringRadius;
els.ringProgress.style.strokeDasharray = `${ringCircumference}`;
els.ringProgress.style.strokeDashoffset = `${ringCircumference}`;

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);

    state.minutes = saved.minutes ?? DEFAULT_SETTINGS.minutes;
    state.startBell = saved.startBell ?? DEFAULT_SETTINGS.startBell;
    state.endBell = saved.endBell ?? DEFAULT_SETTINGS.endBell;
    state.intervalBell = saved.intervalBell ?? DEFAULT_SETTINGS.intervalBell;
    state.guided = saved.guided ?? DEFAULT_SETTINGS.guided;
    state.voiceStyle = saved.voiceStyle ?? DEFAULT_SETTINGS.voiceStyle;
    state.speechRate = saved.speechRate ?? DEFAULT_SETTINGS.speechRate;
    state.backgroundSoundEnabled = saved.backgroundSoundEnabled ?? DEFAULT_SETTINGS.backgroundSoundEnabled;
    state.backgroundSoundType = saved.backgroundSoundType ?? DEFAULT_SETTINGS.backgroundSoundType;
    state.backgroundVolume = saved.backgroundVolume ?? DEFAULT_SETTINGS.backgroundVolume;

    state.durationSeconds = state.minutes * 60;
    state.remainingSeconds = state.durationSeconds;
  } catch (e) {
    console.warn("Settings load failed", e);
  }
}

function saveSettings() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      minutes: state.minutes,
      startBell: state.startBell,
      endBell: state.endBell,
      intervalBell: state.intervalBell,
      guided: state.guided,
      voiceStyle: state.voiceStyle,
      speechRate: state.speechRate,
      backgroundSoundEnabled: state.backgroundSoundEnabled,
      backgroundSoundType: state.backgroundSoundType,
      backgroundVolume: state.backgroundVolume
    })
  );
}

function applySettingsToUI() {
  els.startBellToggle.checked = state.startBell;
  els.endBellToggle.checked = state.endBell;
  els.intervalBellToggle.checked = state.intervalBell;
  els.guidedToggle.checked = state.guided;
  els.voiceStyle.value = state.voiceStyle;
  els.speechRate.value = String(state.speechRate);
  els.speechRateValue.textContent = `${Number(state.speechRate).toFixed(2)}×`;
  els.backgroundSoundToggle.checked = state.backgroundSoundEnabled;
  els.backgroundSoundType.value = state.backgroundSoundType;
  els.backgroundVolume.value = String(state.backgroundVolume);
  els.backgroundVolumeValue.textContent = `${state.backgroundVolume}%`;

  els.presetButtons.forEach((button) => {
    button.classList.toggle("active", Number(button.dataset.minutes) === state.minutes);
  });

  updateDisplay();
  updateProgress();
  updateStatus("Ready");
  updateButtonStates();
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function updateDisplay() {
  els.timeDisplay.textContent = formatTime(Math.max(0, state.remainingSeconds));
}

function updateStatus(text) {
  els.statusText.textContent = text;
}

function updateProgress() {
  const elapsed = state.durationSeconds - state.remainingSeconds;
  const progress = state.durationSeconds > 0 ? elapsed / state.durationSeconds : 0;
  const clamped = Math.min(1, Math.max(0, progress));
  const offset = ringCircumference * (1 - clamped);

  els.ringProgress.style.strokeDashoffset = `${offset}`;
  els.progressBar.style.width = `${clamped * 100}%`;
}

function updateButtonStates() {
  els.startBtn.disabled = state.isRunning;
  els.pauseBtn.disabled = !state.isRunning;
  els.resumeBtn.disabled = state.isRunning || state.remainingSeconds <= 0 || !state.hasStartedOnce;

  els.pauseBtn.classList.toggle("hidden", !state.isRunning);
  els.resumeBtn.classList.toggle("hidden", state.isRunning || !state.hasStartedOnce || state.remainingSeconds <= 0);
}

function setDuration(minutes) {
  if (state.isRunning) return;

  state.minutes = minutes;
  state.durationSeconds = minutes * 60;
  state.remainingSeconds = state.durationSeconds;
  state.hasStartedOnce = false;
  state.spokenCheckpoints.clear();

  els.presetButtons.forEach((button) => {
    button.classList.toggle("active", Number(button.dataset.minutes) === minutes);
  });

  updateDisplay();
  updateProgress();
  updateStatus("Ready");
  updateButtonStates();
  saveSettings();
}

function randomPrompt() {
  const index = Math.floor(Math.random() * GUIDED_PROMPTS.length);
  return GUIDED_PROMPTS[index];
}

function getCheckpointPrompt(phase) {
  const base = randomPrompt();
  if (phase === "start") return `Begin by settling in. ${base}`;
  if (phase === "middle") return `Halfway through. ${base}`;
  return `Your session is ending. Notice this moment clearly. ${base}`;
}

function populateVoices() {
  if (!("speechSynthesis" in window)) return;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length) state.voices = voices;
}

function pickVoice(style = "female") {
  if (!state.voices.length) return null;

  const englishVoices = state.voices.filter((v) => /^en(-|_)/i.test(v.lang || ""));
  const pool = englishVoices.length ? englishVoices : state.voices;

  const femaleHints = ["female", "samantha", "ava", "victoria", "karen", "moira", "serena", "susan"];
  const maleHints = ["male", "daniel", "alex", "fred", "jorge", "thomas", "arthur", "tom"];
  const hints = style === "male" ? maleHints : femaleHints;

  const matched = pool.find((voice) =>
    hints.some((hint) => voice.name.toLowerCase().includes(hint))
  );

  return matched || pool.find((voice) => voice.default) || pool[0] || null;
}

function speakText(text) {
  if (!state.guided) return;
  if (!("speechSynthesis" in window)) return;

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = Number(state.speechRate) || 0.9;
  utterance.pitch = 1;
  utterance.volume = 1;
  utterance.lang = "en-US";

  const chosenVoice = pickVoice(state.voiceStyle);
  if (chosenVoice) utterance.voice = chosenVoice;

  window.speechSynthesis.speak(utterance);
}

async function ensureAudioContext() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;

  if (!window.__stillAudioContext) {
    window.__stillAudioContext = new AudioCtx();
  }

  const ctx = window.__stillAudioContext;
  if (ctx.state === "suspended") {
    await ctx.resume();
  }

  return ctx;
}

async function playBell(type = "start") {
  const ctx = await ensureAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const frequencies =
    type === "end"
      ? [523.25, 659.25, 783.99]
      : type === "interval"
      ? [440, 554.37]
      : [392, 523.25];

  frequencies.forEach((freq, index) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.value = freq;

    gain.gain.setValueAtTime(0.0001, now + index * 0.12);
    gain.gain.exponentialRampToValueAtTime(0.12, now + index * 0.12 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.12 + 1.8);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + index * 0.12);
    osc.stop(now + index * 0.12 + 1.85);
  });
}

function maybeSpeakCheckpoint() {
  if (!state.guided || !state.durationSeconds) return;

  const elapsed = state.durationSeconds - state.remainingSeconds;
  const ratio = elapsed / state.durationSeconds;

  if (!state.spokenCheckpoints.has("start") && elapsed <= 2) {
    state.spokenCheckpoints.add("start");
    speakText(getCheckpointPrompt("start"));
    return;
  }

  if (!state.spokenCheckpoints.has("middle") && ratio >= 0.5) {
    state.spokenCheckpoints.add("middle");
    speakText(getCheckpointPrompt("middle"));
  }
}

function maybePlayIntervalBell() {
  if (!state.intervalBell) return;
  if (state.remainingSeconds <= 0) return;

  const elapsed = state.durationSeconds - state.remainingSeconds;
  if (elapsed > 0 && elapsed % 300 === 0) {
    playBell("interval");
  }
}

function createWhiteNoiseBuffer(ctx, durationSeconds = 2) {
  const sampleRate = ctx.sampleRate;
  const length = sampleRate * durationSeconds;
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  return buffer;
}

function createPinkNoiseBuffer(ctx, durationSeconds = 2) {
  const sampleRate = ctx.sampleRate;
  const length = sampleRate * durationSeconds;
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);

  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.96900 * b2 + white * 0.1538520;
    b3 = 0.86650 * b3 + white * 0.3104856;
    b4 = 0.55000 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.0168980;
    data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
    b6 = white * 0.115926;
  }

  return buffer;
}

function createBrownNoiseBuffer(ctx, durationSeconds = 2) {
  const sampleRate = ctx.sampleRate;
  const length = sampleRate * durationSeconds;
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);

  let lastOut = 0;

  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    lastOut = (lastOut + 0.02 * white) / 1.02;
    data[i] = lastOut * 3.5;
  }

  return buffer;
}

function getBackgroundVolumeGain() {
  return Math.max(0, Math.min(1, state.backgroundVolume / 100));
}

async function stopBackgroundSound() {
  if (state.noiseNode) {
    try {
      state.noiseNode.stop();
    } catch (_) {}
    state.noiseNode.disconnect();
    state.noiseNode = null;
  }

  if (state.noiseGainNode) {
    state.noiseGainNode.disconnect();
    state.noiseGainNode = null;
  }

  if (state.backgroundAudioEl) {
    try {
      state.backgroundAudioEl.pause();
      state.backgroundAudioEl.currentTime = 0;
    } catch (_) {}
    state.backgroundAudioEl = null;
  }
}

async function startGeneratedNoise(type) {
  const ctx = await ensureAudioContext();
  if (!ctx) return;

  await stopBackgroundSound();

  let buffer;
  if (type === "white") buffer = createWhiteNoiseBuffer(ctx);
  else if (type === "brown") buffer = createBrownNoiseBuffer(ctx);
  else buffer = createPinkNoiseBuffer(ctx);

  const source = ctx.createBufferSource();
  const gain = ctx.createGain();

  source.buffer = buffer;
  source.loop = true;
  gain.gain.value = getBackgroundVolumeGain();

  source.connect(gain);
  gain.connect(ctx.destination);

  source.start();

  state.noiseNode = source;
  state.noiseGainNode = gain;
}

async function startAmbientTrack(type) {
  await stopBackgroundSound();

  const src = type === "rain" ? "./rain.mp3" : "./stream.mp3";
  const audio = new Audio(src);
  audio.loop = true;
  audio.preload = "auto";
  audio.volume = getBackgroundVolumeGain();

  try {
    await audio.play();
    state.backgroundAudioEl = audio;
  } catch (e) {
    console.warn("Ambient audio failed to start", e);
  }
}

async function syncBackgroundSound() {
  if (!state.backgroundSoundEnabled || !state.isRunning) {
    await stopBackgroundSound();
    return;
  }

  const type = state.backgroundSoundType;
  if (type === "white" || type === "pink" || type === "brown") {
    await startGeneratedNoise(type);
  } else {
    await startAmbientTrack(type);
  }
}

function updateBackgroundVolumeLive() {
  const gainValue = getBackgroundVolumeGain();

  if (state.noiseGainNode) {
    state.noiseGainNode.gain.value = gainValue;
  }

  if (state.backgroundAudioEl) {
    state.backgroundAudioEl.volume = gainValue;
  }
}

function tick() {
  const now = Date.now();
  state.remainingSeconds = Math.max(0, Math.ceil((state.endAt - now) / 1000));

  updateDisplay();
  updateProgress();
  maybeSpeakCheckpoint();
  maybePlayIntervalBell();

  if (state.remainingSeconds <= 0) {
    finishSession();
  }
}

async function startSession() {
  if (state.isRunning) return;

  state.durationSeconds = state.minutes * 60;

  if (!state.hasStartedOnce || state.remainingSeconds <= 0 || state.remainingSeconds > state.durationSeconds) {
    state.remainingSeconds = state.durationSeconds;
  }

  state.endAt = Date.now() + state.remainingSeconds * 1000;
  state.isRunning = true;
  state.hasStartedOnce = true;
  state.spokenCheckpoints.clear();

  if (state.startBell) {
    playBell("start");
  }

  await syncBackgroundSound();

  updateStatus("In session");
  updateButtonStates();

  tick();
  state.intervalId = window.setInterval(tick, 1000);
}

async function pauseSession() {
  if (!state.isRunning) return;

  window.clearInterval(state.intervalId);
  state.intervalId = null;
  state.isRunning = false;

  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }

  await stopBackgroundSound();

  updateStatus("Paused");
  updateButtonStates();
}

async function resumeSession() {
  if (state.isRunning || state.remainingSeconds <= 0) return;

  state.endAt = Date.now() + state.remainingSeconds * 1000;
  state.isRunning = true;

  await syncBackgroundSound();

  updateStatus("In session");
  updateButtonStates();

  tick();
  state.intervalId = window.setInterval(tick, 1000);
}

async function resetSession() {
  window.clearInterval(state.intervalId);
  state.intervalId = null;
  state.isRunning = false;
  state.hasStartedOnce = false;
  state.spokenCheckpoints.clear();
  state.remainingSeconds = state.minutes * 60;
  state.durationSeconds = state.minutes * 60;

  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }

  await stopBackgroundSound();

  updateDisplay();
  updateProgress();
  updateStatus("Ready");
  updateButtonStates();
}

async function finishSession() {
  window.clearInterval(state.intervalId);
  state.intervalId = null;
  state.isRunning = false;
  state.remainingSeconds = 0;

  await stopBackgroundSound();

  updateDisplay();
  updateProgress();
  updateStatus("Complete");
  updateButtonStates();

  if (state.endBell) {
    playBell("end");
  }

  if (state.guided) {
    speakText(getCheckpointPrompt("end"));
  }
}

function bindEvents() {
  els.presetButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setDuration(Number(button.dataset.minutes));
    });
  });

  els.startBtn.addEventListener("click", async () => {
    await ensureAudioContext();
    populateVoices();
    await startSession();
  });

  els.pauseBtn.addEventListener("click", async () => {
    await pauseSession();
  });

  els.resumeBtn.addEventListener("click", async () => {
    await ensureAudioContext();
    populateVoices();
    await resumeSession();
  });

  els.resetBtn.addEventListener("click", async () => {
    await resetSession();
  });

  els.startBellToggle.addEventListener("change", (e) => {
    state.startBell = e.target.checked;
    saveSettings();
  });

  els.endBellToggle.addEventListener("change", (e) => {
    state.endBell = e.target.checked;
    saveSettings();
  });

  els.intervalBellToggle.addEventListener("change", (e) => {
    state.intervalBell = e.target.checked;
    saveSettings();
  });

  els.guidedToggle.addEventListener("change", (e) => {
    state.guided = e.target.checked;
    saveSettings();
  });

  els.voiceStyle.addEventListener("change", (e) => {
    state.voiceStyle = e.target.value;
    saveSettings();
  });

  els.speechRate.addEventListener("input", (e) => {
    state.speechRate = Number(e.target.value);
    els.speechRateValue.textContent = `${state.speechRate.toFixed(2)}×`;
    saveSettings();
  });

  els.backgroundSoundToggle.addEventListener("change", async (e) => {
    state.backgroundSoundEnabled = e.target.checked;
    saveSettings();
    await syncBackgroundSound();
  });

  els.backgroundSoundType.addEventListener("change", async (e) => {
    state.backgroundSoundType = e.target.value;
    saveSettings();
    await syncBackgroundSound();
  });

  els.backgroundVolume.addEventListener("input", (e) => {
    state.backgroundVolume = Number(e.target.value);
    els.backgroundVolumeValue.textContent = `${state.backgroundVolume}%`;
    updateBackgroundVolumeLive();
    saveSettings();
  });

  if ("speechSynthesis" in window) {
    populateVoices();
    window.speechSynthesis.onvoiceschanged = populateVoices;
  }
}

function init() {
  loadSettings();
  applySettingsToUI();
  bindEvents();
}

init();
