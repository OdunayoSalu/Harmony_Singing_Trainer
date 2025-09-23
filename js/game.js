import { loadCurrentOrDefault, saveDefaults, applyToForm, readFromForm, saveCurrent } from './settings.js';
import { randomMajorKey, rootMidiForKeyName, computeQuestion, midiToFreq, intervalName, solfege } from './music.js';
import { getAudioContext, ensurePiano, resumeContext, playNote, playChord, playCalibration, stopAll, playCorrectIfNeeded, setUpCorrectSound, cancelCalibration, startPianoDrone, stopPianoDrone } from './audio.js';
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
  isCalibrating: false,
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
  settingsPanel: document.getElementById('settingsPanel'),
  applyGameSettingsBtn: document.getElementById('applyGameSettingsBtn'),
  cancelGameSettingsBtn: document.getElementById('cancelGameSettingsBtn'),
  gameSettingsForm: document.getElementById('game-settings-form'),
  openSettingsBtn: document.getElementById('openSettingsBtn'),
  playAnswerBtn: document.getElementById('playAnswerBtn'),
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
    // Show UI immediately
    els.startPlayingBtn.style.display = 'none';
    els.gameControls.style.display = '';
    els.tunerSection.style.display = '';
    // Kick off set without blocking UI
    newSet(true);
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
  // stop any previous sounds and cancel ongoing calibration
  cancelCalibration();
  stopAll();
  stopDrone();
  state.isCalibrating = true;
  if (pickNewKey || !state.keyName) {
    state.keyName = randomMajorKey();
  }
  state.rootMidi = rootMidiForKeyName(state.keyName, 4);
  state.questionIndex = 0;
  state.totalQuestions = state.settings.questionCount;
  // Update status immediately for upcoming set
  els.status.textContent = `${state.keyName} major – Question 1 of ${state.totalQuestions}`;
  const { totalDurationSec } = await playCalibration(state.keyName, state.rootMidi, state.settings.chordTempo, state.settings.scaleTempo);
  // wait 1 second after calibration
  await delay(1);
  state.isCalibrating = false;
  nextQuestion();
}

function updateUIForShowQuestionDegree() {
  const show = !!state?.settings?.showQuestionDegree;
  els.questionDegree.style.display = show ? '' : 'none';
}

function nextQuestion() {
  if (state.isCalibrating) return; // don't start during calibration
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
  if (!state.isCalibrating) {
    playNote(state.currentQuestion.questionMidi, 95, 1.2);
  }

  // Set tuner target to target note frequency
  const targetHz = midiToFreq(targetMidi);
  if (state.tuner) state.tuner.setTargetHz(targetHz);
  els.status.textContent = `${state.keyName} major – Question ${state.questionIndex + 1} of ${state.totalQuestions}`;
  // Start or update question drone if enabled
  startDroneForCurrentQuestion();
}

els.replayCalibrationBtn.addEventListener('click', async () => {
  await resumeContext();
  cancelCalibration();
  stopAll();
  await playCalibration(state.keyName, state.rootMidi, state.settings.chordTempo, state.settings.scaleTempo);
});

els.replayQuestionBtn.addEventListener('click', async () => {
  if (state.currentQuestion) {
    await resumeContext();
    playNote(state.currentQuestion.questionMidi, 95, 1.2);
    // maintain drone as-is; if toggle on, ensure drone running
    startDroneForCurrentQuestion();
  }
});

els.newSetBtn.addEventListener('click', async () => {
  await resumeContext();
  newSet(true);
});

els.restartSetBtn.addEventListener('click', async () => {
  await resumeContext();
  newSet(false);
});

els.stopSetBtn.addEventListener('click', () => {
  stopAll();
  cancelCalibration();
  stopDrone();
  els.status.textContent = 'Set stopped. Press Start Playing to begin again or New set.';
  els.startPlayingBtn.style.display = '';
  els.gameControls.style.display = 'none';
});

els.nextQuestionBtn.addEventListener('click', () => {
  if (state.isCalibrating) return; // ignore during calibration
  state.questionIndex++;
  nextQuestion();
});

// Settings panel controls
els.openSettingsBtn.addEventListener('click', () => openSettingsPanel());
els.cancelGameSettingsBtn.addEventListener('click', () => {
  // discard changes: reset form to current settings
  applyToForm(els.gameSettingsForm, state.settings);
  closeSettingsPanel();
});
els.applyGameSettingsBtn.addEventListener('click', () => {
  state.settings = readFromForm(els.gameSettingsForm);
  saveCurrent(state.settings);
  updateUIForShowQuestionDegree();
  // Keep current question, but future questions use new settings
  closeSettingsPanel();
});

function openSettingsPanel() {
  applyToForm(els.gameSettingsForm, state.settings);
  els.settingsPanel.classList.add('open');
}

function closeSettingsPanel() {
  els.settingsPanel.classList.remove('open');
}

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

const TOLERANCE_CENTS = 25; // threshold
const HOLD_MS = 1000; // must hold for 1 second
let lastMeterWidth = 0;

function positionToleranceMarkers() {
  const meterWidth = els.tunerMeter.clientWidth;
  if (!meterWidth) return;
  if (meterWidth === lastMeterWidth) return;
  lastMeterWidth = meterWidth;
  const half = meterWidth / 2;
  const px = (TOLERANCE_CENTS / 100) * (half - 4); // using same scale as needle mapping
  const left = half - px;
  const right = half + px;
  const leftEl = document.getElementById('tunerThresholdLeft');
  const rightEl = document.getElementById('tunerThresholdRight');
  if (leftEl && rightEl) {
    leftEl.style.left = `${left}px`;
    rightEl.style.left = `${right}px`;
  }
}

window.addEventListener('resize', positionToleranceMarkers);

function onTunerUpdate(cents, rms, hz) {
  // Update needle and text
  const meterWidth = els.tunerMeter.clientWidth;
  const maxCents = 100; // clamp
  let displayCents = cents == null ? 0 : Math.max(-maxCents, Math.min(maxCents, cents));
  const px = (displayCents / maxCents) * (meterWidth / 2 - 4); // keep inside
  els.tunerNeedle.style.transform = `translateX(calc(-50% + ${px}px))`;
  els.tunerCents.textContent = cents == null ? '—' : `${displayCents.toFixed(0)} cents`;

  positionToleranceMarkers();

  // Determine correctness (octave-equivalent)
  const now = performance.now();
  const dt = state.lastUpdateTime ? (now - state.lastUpdateTime) : 0;
  state.lastUpdateTime = now;

  const within = cents != null && Math.abs(cents) < TOLERANCE_CENTS; // threshold
  if (within) {
    state.correctStreakMs += dt;
  } else {
    state.correctStreakMs = 0;
  }

  if (state.currentQuestion && state.correctStreakMs > HOLD_MS) {
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
    // Next Question is always enabled, nothing to toggle
  }
}

function revealText(q) {
  const qDeg = `${q.baseDegree} (${solfege(q.baseDegree)})`;
  const aDeg = `${q.targetDegree} (${solfege(q.targetDegree)})`;
  // Always reveal both after correct, regardless of the showQuestionDegree setting; each on a new line
  return `Question degree: ${qDeg}\nAnswer degree: ${aDeg}`;
}

// Play target answer note once
els.playAnswerBtn.addEventListener('click', async () => {
  if (!state.currentQuestion) return;
  await resumeContext();
  const { targetMidi } = state.currentQuestion;
  playNote(targetMidi, 95, 1.2);
});

function delay(sec) {
  return new Promise(res => setTimeout(res, sec * 1000));
}

// Drone: maintain soft question note if toggled
els.questionDroneToggle = document.getElementById('questionDroneToggle');

function stopDrone() {
  stopPianoDrone();
}

async function startDroneForCurrentQuestion() {
  stopDrone();
  if (!els.questionDroneToggle.checked) return;
  if (!state.currentQuestion) return;
  await resumeContext();
  // Seamless looping drone at soft velocity
  startPianoDrone(state.currentQuestion.questionMidi, 45, 0.45, 0.3);
}

els.questionDroneToggle.addEventListener('change', () => {
  if (els.questionDroneToggle.checked) {
    startDroneForCurrentQuestion();
  } else {
    stopDrone();
  }
});
