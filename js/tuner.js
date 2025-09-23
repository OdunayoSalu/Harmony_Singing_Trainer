// Simple tuner: mic input, pitch detection via auto-correlation, cents offset vs target
import { midiToFreq, freqToMidi } from './music.js';

export class Tuner {
  constructor(audioContext) {
    this.ctx = audioContext;
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.bufferLen = this.analyser.fftSize;
    this.buf = new Float32Array(this.bufferLen);
    this.targetHz = null;
    this.onUpdate = null; // (cents, rms, hz) => void
    this._raf = null;
    this.source = null;
    this.active = false;
  }

  async connectStream(stream) {
    if (this.source) this.source.disconnect();
    this.source = this.ctx.createMediaStreamSource(stream);
    this.source.connect(this.analyser);
  }

  setTargetHz(hz) { this.targetHz = hz; }

  start() {
    if (this.active) return;
    this.active = true;
    const update = () => {
      if (!this.active) return;
      const hz = this._detectPitch();
      let cents = null; let rms = 0;
      if (hz) {
        if (this.targetHz) {
          cents = centsDiff(hz, this.targetHz);
        } else {
          cents = null;
        }
      }
      if (this.onUpdate) this.onUpdate(cents, rms, hz || null);
      this._raf = requestAnimationFrame(update);
    };
    this._raf = requestAnimationFrame(update);
  }

  stop() {
    this.active = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
  }

  _detectPitch() {
    this.analyser.getFloatTimeDomainData(this.buf);
    const buf = this.buf;
    const sampleRate = this.ctx.sampleRate;

    // Compute RMS to detect silence
    let rms = 0; for (let i = 0; i < buf.length; i++) rms += buf[i]*buf[i]; rms = Math.sqrt(rms / buf.length);
    if (rms < 0.01) return null; // too quiet

    // Auto-correlation
    let bestOffset = -1; let bestCorrelation = 0; const size = buf.length;
    const MAX_SAMPLES = Math.floor(size / 2);
    let lastCorrelation = 1;
    for (let offset = 8; offset <= MAX_SAMPLES; offset++) {
      let correlation = 0;
      for (let i = 0; i < MAX_SAMPLES; i++) {
        correlation += Math.abs((buf[i]) - (buf[i + offset]));
      }
      correlation = 1 - (correlation / MAX_SAMPLES);
      if (correlation > 0.9 && correlation > lastCorrelation) {
        bestCorrelation = correlation;
        bestOffset = offset;
      } else if (bestCorrelation > 0.9 && correlation < lastCorrelation) {
        const shift = (interpolateShift(buf, bestOffset));
        const freq = sampleRate / (bestOffset + shift);
        return freq;
      }
      lastCorrelation = correlation;
    }
    if (bestCorrelation > 0.9) {
      const freq = sampleRate / bestOffset;
      return freq;
    }
    return null;
  }
}

function centsDiff(inputHz, targetHz) {
  // compute signed cents from target to nearest octave-equivalent to input
  const inputMidi = freqToMidi(inputHz);
  const targetMidi = freqToMidi(targetHz);
  // reduce to nearest modulo 12
  let diff = (inputMidi - targetMidi) * 100; // cents
  // normalize to [-600, 600)
  diff = ((diff + 600) % 1200) - 600;
  return diff;
}

function interpolateShift(buf, offset) {
  // Parabolic interpolation for maximum
  const x1 = offset - 1, x2 = offset, x3 = offset + 1;
  const y1 = correl(buf, x1), y2 = correl(buf, x2), y3 = correl(buf, x3);
  const denom = (y1 - 2*y2 + y3);
  if (denom === 0) return 0;
  return (y1 - y3) / (2 * denom);
}

function correl(buf, offset) {
  let sum = 0; const MAX = Math.floor(buf.length/2);
  for (let i=0;i<MAX;i++) sum += Math.abs(buf[i] - buf[i+offset]);
  return 1 - (sum / MAX);
}
