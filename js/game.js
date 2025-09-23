import { loadCurrentOrDefault, saveDefaults, applyToForm, readFromForm, saveCurrent } from './settings.js';
import { randomMajorKey, rootMidiForKeyName, computeQuestion, midiToFreq, intervalName, solfege } from './music.js';
import { getAudioContext, ensurePiano, resumeContext, playNote, playChord, playCalibration, stopAll, playCorrectIfNeeded, setUpCorrectSound } from './audio.js';
import { Tuner } from './tuner.js';

const state = {
  settings: null,
  keyName: null,
  rootMidi: null,
  questionIndex: 0,
  totalQuestions: 0,
  currentQuestion: null,
  micStream: null,
  tuner: null,
  correctStreakMs: 0,
  lastUpdateTime: 0,
};

const els = {
  status: document.getElementById('status'),
  startPlayingBtn: document.getElementById('startPlayingBtn'),
  questionText: document.getElementById('questionText'),
  questionDegree: document.getElementById('questionDegree'),
  revealDegrees: document.getElementById('revealDegrees'),
  gameControls: document.getElementById('gameControls'),
  replayCalibrationBtn: document.getElementById('replayCalibrationBtn'),
  replayQuestionBtn: document.getElementById('replayQuestionBtn'),
  newSetBtn: document.getElementById('newSetBtn'),
  restartSetBtn: document.getElementById('restartSetBtn'),
  stopSetBtn: document.getElementById('stopSetBtn'),
  nextQuestionBtn: document.getElementById('nextQuestionBtn'),
  tunerSection: document.getElementById('tunerSection'),
  tunerToggleBtn: document.getElementById('tunerToggleBtn'),
  tunerMeter: document.getElementById('tunerMeter'),
  tunerNeedle: document.getElementById('tunerNeedle'),
  tunerCents: document.getElementById('tunerCents'),
  toggleSettingsPanelBtn: document.getElementById('toggleSettingsPanelBtn'),
  toggleTunerVisibilityBtn: document.getElementById('toggleTunerVisibilityBtn'),
  settingsPanel: document.getElementById('settingsPanel'),
  applyGameSettingsBtn: document.getElementById('applyGameSettingsBtn'),
  collapseSettingsBtn: document.getElementById('collapseSettingsBtn'),
  gameSettingsForm: document.getElementById('game-settings-form'),
};

window.addEventListener('DOMContentLoaded', async () => {
  // Load settings and apply to form
  state.settings = loadCurrentOrDefault();
  applyToForm(els.gameSettingsForm, state.settings);
  updateUIForShowQuestionDegree();
  setUpCorrectSound();
});

els.startPlayingBtn.addEventListener('click', async () => {
  els.status.textContent = 'Initializing audio...';
  try {
    await resumeContext();
    await ensurePiano();
    await requestMic();
    els.status.textContent = 'Calibration playing...';
    await newSet(true);
    els.startPlayingBtn.style.display = 'none';
    els.gameControls.style.display = '';
    els.tunerSection.style.display = '';
  } catch (err) {
    console.error(err);
    els.status.textContent = 'Microphone access or audio init failed. Please allow mic and try again.';
  }
});

async function requestMic() {
  const constraints = { audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } };
  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  state.micStream = stream;
  const ctx = getAudioContext();
  state.tuner = new Tuner(ctx);
  await state.tuner.connectStream(stream);
  state.tuner.onUpdate = onTunerUpdate;
  state.tuner.start();
}

async function newSet(pickNewKey) {
  if (pickNewKey || !state.keyName) {
    state.keyName = randomMajorKey();
  }
  state.rootMidi = rootMidiForKeyName(state.keyName, 4);
  state.questionIndex = 0;
  state.totalQuestions = state.settings.questionCount;
  await playCalibration(state.keyName, state.rootMidi, state.settings.chordTempo, state.settings.scaleTempo);
  nextQuestion();
}

function updateUIForShowQuestionDegree() {
  const show = !!state?.settings?.showQuestionDegree;
  els.questionDegree.style.display = show ? '' : 'none';
}

function nextQuestion() {
  if (state.questionIndex >= state.totalQuestions) {
    els.status.textContent = `Set complete in ${state.keyName} major. Choose New set to continue.`;
    els.questionText.style.display = 'none';
    els.questionDegree.style.display = 'none';
    els.revealDegrees.style.display = 'none';
    return;
  }

  state.currentQuestion = computeQuestion(state.keyName, state.settings);
  state.correctStreakMs = 0; state.lastUpdateTime = performance.now();

  const { intervalSize, direction, baseDegree, targetMidi } = state.currentQuestion;
  const instruction = `Sing a ${intervalName(intervalSize)} ${direction}`;
  els.questionText.textContent = instruction;
  els.questionText.style.display = '';
  els.revealDegrees.style.display = 'none';

  if (state.settings.showQuestionDegree) {
    els.questionDegree.textContent = `Question degree: ${baseDegree} (${solfege(baseDegree)})`;
    els.questionDegree.style.display = '';
  } else {
    els.questionDegree.style.display = 'none';
  }

  // Play question note
  playNote(state.currentQuestion.questionMidi, 95, 1.2);

  // Set tuner target to target note frequency
  const targetHz = midiToFreq(targetMidi);
  if (state.tuner) state.tuner.setTargetHz(targetHz);

  els.nextQuestionBtn.disabled = true;
  els.status.textContent = `${state.keyName} major – Question ${state.questionIndex + 1} of ${state.totalQuestions}`;
}

els.replayCalibrationBtn.addEventListener('click', async () => {
  await resumeContext();
  await playCalibration(state.keyName, state.rootMidi, state.settings.chordTempo, state.settings.scaleTempo);
});

els.replayQuestionBtn.addEventListener('click', async () => {
  if (state.currentQuestion) {
    await resumeContext();
    playNote(state.currentQuestion.questionMidi, 95, 1.2);
  }
});

els.newSetBtn.addEventListener('click', async () => {
  await resumeContext();
  await newSet(true);
});

els.restartSetBtn.addEventListener('click', async () => {
  await resumeContext();
  await newSet(false);
});

els.stopSetBtn.addEventListener('click', () => {
  stopAll();
  els.status.textContent = 'Set stopped. Press Start Playing to begin again or New set.';
  els.startPlayingBtn.style.display = '';
  els.gameControls.style.display = 'none';
});

els.nextQuestionBtn.addEventListener('click', () => {
  state.questionIndex++;
  nextQuestion();
});

// Settings panel toggles
els.toggleSettingsPanelBtn.addEventListener('click', () => toggleSettingsPanel());
els.collapseSettingsBtn.addEventListener('click', () => toggleSettingsPanel(false));
els.applyGameSettingsBtn.addEventListener('click', () => {
  state.settings = readFromForm(els.gameSettingsForm);
  saveCurrent(state.settings);
  updateUIForShowQuestionDegree();
  // Keep current question, but future questions use new settings
});

function toggleSettingsPanel(forceOpen) {
  const open = forceOpen !== undefined ? forceOpen : !els.settingsPanel.classList.contains('open');
  if (open) {
    els.settingsPanel.classList.add('open');
  } else {
    els.settingsPanel.classList.remove('open');
  }
}

// Tuner visibility
els.toggleTunerVisibilityBtn.addEventListener('click', () => {
  if (els.tunerSection.style.display === 'none') {
    els.tunerSection.style.display = '';
  } else {
    els.tunerSection.style.display = 'none';
  }
});

els.tunerToggleBtn.addEventListener('click', () => {
  if (els.tunerMeter.style.display === 'none') {
    els.tunerMeter.style.display = '';
    els.tunerCents.style.display = '';
    els.tunerToggleBtn.textContent = 'Hide';
  } else {
    els.tunerMeter.style.display = 'none';
    els.tunerCents.style.display = 'none';
    els.tunerToggleBtn.textContent = 'Show';
  }
});

function onTunerUpdate(cents, rms, hz) {
  // Update needle and text
  const meterWidth = els.tunerMeter.clientWidth;
  const maxCents = 100; // clamp
  let displayCents = cents == null ? 0 : Math.max(-maxCents, Math.min(maxCents, cents));
  const px = (displayCents / maxCents) * (meterWidth / 2 - 4); // keep inside
  els.tunerNeedle.style.transform = `translateX(calc(-50% + ${px}px))`;
  els.tunerCents.textContent = cents == null ? '—' : `${displayCents.toFixed(0)} cents`;

  // Determine correctness (octave-equivalent)
  const now = performance.now();
  const dt = state.lastUpdateTime ? (now - state.lastUpdateTime) : 0;
  state.lastUpdateTime = now;

  const within = cents != null && Math.abs(cents) < 25; // threshold
  if (within) {
    state.correctStreakMs += dt;
  } else {
    state.correctStreakMs = 0;
  }

  if (state.currentQuestion && state.correctStreakMs > 400) {
    onAnswerCorrect();
  }
}

async function onAnswerCorrect() {
  // Prevent multiple triggers
  if (!state.currentQuestion) return;
  const q = state.currentQuestion;
  state.currentQuestion = null; // lock

  els.revealDegrees.textContent = revealText(q);
  els.revealDegrees.style.display = '';
  els.questionText.classList.add('correct-answer');
  setTimeout(() => els.questionText.classList.remove('correct-answer'), 600);

  await playCorrectIfNeeded(!!state.settings.autoProceed);

  if (state.settings.autoProceed) {
    state.questionIndex++;
    nextQuestion();
  } else {
    els.nextQuestionBtn.disabled = false;
  }
}

function revealText(q) {
  const qDeg = `${q.baseDegree} (${solfege(q.baseDegree)})`;
  const aDeg = `${q.targetDegree} (${solfege(q.targetDegree)})`;
  if (state.settings.showQuestionDegree) {
    return `Question degree: ${qDeg} · Answer degree: ${aDeg}`;
  } else {
    return `Answer degree: ${aDeg}`;
  }
}
