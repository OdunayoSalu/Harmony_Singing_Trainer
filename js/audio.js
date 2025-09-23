// Audio engine: Smplr piano, calibration playback, note/chord helpers, correct sound
import { buildTriadMidisForRoman, noteMidiForDegree, degreeIndex, MAJOR_SCALE_STEPS, midiToFreq } from './music.js';

// Import Smplr ESM from CDN for browser use
import { SplendidGrandPiano } from 'https://unpkg.com/smplr/dist/index.mjs';

let audioContext = null;
let piano = null;
let pianoLoaded = false;
let correctAudio = null;

export function getAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
}

export async function ensurePiano() {
  if (!piano) {
    const ctx = getAudioContext();
    piano = new SplendidGrandPiano(ctx);
    await piano.load;
    pianoLoaded = true;
  }
  return piano;
}

export function resumeContext() {
  const ctx = getAudioContext();
  if (ctx.state !== 'running') return ctx.resume();
  return Promise.resolve();
}

export async function playNote(midi, velocity = 90, durationSec = 1.2, when = 0) {
  await ensurePiano();
  const ctx = getAudioContext();
  const startTime = ctx.currentTime + Math.max(0, when);
  return piano.start({ note: midi, velocity, time: startTime, duration: durationSec });
}

export async function playChord(midis, velocity = 80, durationSec = 2.0, when = 0) {
  await ensurePiano();
  const ctx = getAudioContext();
  const startTime = ctx.currentTime + Math.max(0, when);
  midis.forEach(m => piano.start({ note: m, velocity, time: startTime, duration: durationSec }));
}

export function stopAll() {
  if (piano) piano.stop();
}

export async function playCalibration(keyName, rootMidi, chordTempoBpm = 110, scaleTempoBpm = 175) {
  await ensurePiano();
  const ctx = getAudioContext();
  const now = ctx.currentTime + 0.1;

  const beatChord = 60 / chordTempoBpm; // seconds per beat
  const bar = beatChord * 4;

  // Chord progression I - IV - V - I
  const I = buildTriadMidisForRoman(rootMidi, 'I', 0);
  const IV = buildTriadMidisForRoman(rootMidi, 'IV', 0);
  const V = buildTriadMidisForRoman(rootMidi, 'V', 0);

  [[I,0],[IV,bar],[V,bar*2],[I,bar*3]].forEach(([triad, offset]) => {
    triad.forEach(m => piano.start({ note: m, velocity: 85, time: now + offset, duration: bar * 0.95 }));
  });

  // Major scale do..do
  const scaleDur = 60 / scaleTempoBpm;
  const scaleStart = now + bar * 4 + 0.1;
  for (let i = 0; i < 8; i++) {
    const degIdx = i % 7;
    const octaveOffset = i === 7 ? 1 : 0;
    const midi = rootMidi + MAJOR_SCALE_STEPS[degIdx] + (12 * octaveOffset);
    piano.start({ note: midi, velocity: 90, time: scaleStart + i * scaleDur, duration: scaleDur * 0.9 });
  }
}

export function setUpCorrectSound() {
  try {
    correctAudio = new Audio('Assets/Correct.mp3');
    correctAudio.preload = 'auto';
  } catch {
    correctAudio = null;
  }
}

export async function playCorrectSoundFallback() {
  // short success beep if Correct.mp3 missing or not loaded
  const ctx = getAudioContext();
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.value = 880;
  g.gain.setValueAtTime(0.0001, ctx.currentTime);
  g.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.01);
  g.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.2);
  o.connect(g).connect(ctx.destination);
  o.start();
  o.stop(ctx.currentTime + 0.25);
}

export async function playCorrectIfNeeded(skip=false) {
  if (skip) return; // when auto-proceed on
  try {
    if (!correctAudio) setUpCorrectSound();
    if (correctAudio) {
      await correctAudio.play();
    } else {
      await playCorrectSoundFallback();
    }
  } catch {
    await playCorrectSoundFallback();
  }
}
