// Music theory utilities for major keys, diatonic degrees, and intervals

export const MAJOR_KEYS = [
  'C','G','D','A','E','B','F#','C#','F','Bb','Eb','Ab'
];

const NOTE_TO_SEMITONE = {
  'C':0,'C#':1,'Db':1,'D':2,'D#':3,'Eb':3,'E':4,'F':5,'F#':6,'Gb':6,'G':7,'G#':8,'Ab':8,'A':9,'A#':10,'Bb':10,'B':11
};

export const MAJOR_SCALE_STEPS = [0,2,4,5,7,9,11];

export function randomMajorKey() {
  return MAJOR_KEYS[Math.floor(Math.random() * MAJOR_KEYS.length)];
}

export function rootMidiForKeyName(keyName, octave=4) {
  const semis = NOTE_TO_SEMITONE[keyName];
  const cMidi = 12 * (octave + 1); // C4=60
  return cMidi + semis;
}

export function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function freqToMidi(freq) {
  return 69 + 12 * Math.log2(freq / 440);
}

export function degreeIndex(degreeNumber) {
  return (Number(degreeNumber) - 1) % 7;
}

export function noteMidiForDegree(rootMidi, degreeIdx, octaveOffset=0) {
  return rootMidi + MAJOR_SCALE_STEPS[degreeIdx] + 12 * octaveOffset;
}

export function directedSemitoneDelta(baseDegreeIdx, intervalSize, direction) {
  if (direction === 'up') {
    const wrap = Math.floor((baseDegreeIdx + intervalSize) / 7);
    const targetIdx = (baseDegreeIdx + intervalSize) % 7;
    const delta = (MAJOR_SCALE_STEPS[targetIdx] + 12 * wrap) - MAJOR_SCALE_STEPS[baseDegreeIdx];
    return delta;
  } else {
    let x = baseDegreeIdx - intervalSize;
    let wrap = 0;
    while (x < 0) { x += 7; wrap -= 1; }
    const delta = (MAJOR_SCALE_STEPS[x] + 12 * wrap) - MAJOR_SCALE_STEPS[baseDegreeIdx];
    return delta;
  }
}

export function isTritoneSemitone(delta) {
  return Math.abs(delta) % 12 === 6;
}

export function intervalName(size) {
  return ['Unison','2nd','3rd','4th','5th','6th','7th'][size] || `${size+1}th`;
}

export function solfege(degreeNumber) {
  return ['do','re','mi','fa','so','la','ti'][degreeIndex(degreeNumber)] || '';
}

export function chordDegreesRoman(roman) {
  switch(roman) {
    case 'I': return [1,3,5];
    case 'IV': return [4,6,1];
    case 'V': return [5,7,2];
    default: return [1,3,5];
  }
}

export function buildTriadMidisForRoman(rootMidi, roman, baseOctaveOffset=0) {
  const degs = chordDegreesRoman(roman).map(d => degreeIndex(d));
  // Build triad around base octave
  return degs.map((dIdx) => noteMidiForDegree(rootMidi, dIdx, baseOctaveOffset));
}

export function computeQuestion(keyName, settings) {
  const rootMidi = rootMidiForKeyName(keyName, 4);

  // Pick base degree, direction, interval. Avoid tritone targets.
  let question = null; let guard = 0;
  while (!question && guard++ < 1000) {
    const baseDegree = randomChoice(settings.degrees);
    const baseIdx = degreeIndex(baseDegree);
    const intervalSize = randomChoice(settings.intervals); // 0..6
    const direction = randomChoice(settings.directions);

    const delta = directedSemitoneDelta(baseIdx, intervalSize, direction);
    if (isTritoneSemitone(delta)) continue; // skip tritone occurrences (e.g., 4 -> 7 up)

    const questionMidi = noteMidiForDegree(rootMidi, baseIdx, 0);
    const targetMidi = questionMidi + delta;

    const targetDegreeIdx = direction === 'up'
      ? (baseIdx + intervalSize) % 7
      : ((baseIdx - intervalSize) % 7 + 7) % 7;

    question = {
      keyName,
      rootMidi,
      baseDegree,
      baseDegreeIdx: baseIdx,
      intervalSize,
      direction,
      questionMidi,
      targetMidi,
      targetDegree: targetDegreeIdx + 1,
    };
  }
  return question;
}

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
