export const STORAGE_DEFAULTS_KEY = 'hst:defaults';
export const STORAGE_CURRENT_KEY = 'hst:current';

export const DEFAULT_SETTINGS = {
  intervals: [0,1,2,3,4,5,6], // 0=unison .. 6=7th
  directions: ['up','down'],
  degrees: [1,2,3,4,5,6,7],
  questionCount: 10,
  autoProceed: false,
  chordTempo: 110,
  scaleTempo: 175,
  showQuestionDegree: true,
};

export function loadDefaults() {
  try {
    const raw = localStorage.getItem(STORAGE_DEFAULTS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const obj = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...obj };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveDefaults(settings) {
  localStorage.setItem(STORAGE_DEFAULTS_KEY, JSON.stringify(settings));
}

export function loadCurrentOrDefault() {
  try {
    const raw = sessionStorage.getItem(STORAGE_CURRENT_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return loadDefaults();
}

export function saveCurrent(settings) {
  sessionStorage.setItem(STORAGE_CURRENT_KEY, JSON.stringify(settings));
}

function getCheckedValues(form, name) {
  return Array.from(form.querySelectorAll(`input[name="${name}"]:checked`)).map(el => {
    const v = el.value;
    if (name === 'intervals') return Number(v);
    if (name === 'degrees') return Number(v);
    return v;
  });
}

function setCheckedValues(form, name, values) {
  const set = new Set(values.map(v => String(v)));
  form.querySelectorAll(`input[name="${name}"]`).forEach(el => {
    el.checked = set.has(el.value);
  });
}

export function readFromForm(form) {
  const intervals = getCheckedValues(form, 'intervals');
  const directions = getCheckedValues(form, 'directions');
  const degrees = getCheckedValues(form, 'degrees');
  const questionCount = Number(form.querySelector('[name="questionCount"]').value || 10);
  const chordTempo = Number(form.querySelector('[name="chordTempo"]').value || 110);
  const scaleTempo = Number(form.querySelector('[name="scaleTempo"]').value || 175);
  const autoProceed = !!form.querySelector('[name="autoProceed"]').checked;
  const showQuestionDegree = !!form.querySelector('[name="showQuestionDegree"]').checked;

  return {
    intervals: intervals.length ? intervals : [...DEFAULT_SETTINGS.intervals],
    directions: directions.length ? directions : [...DEFAULT_SETTINGS.directions],
    degrees: degrees.length ? degrees : [...DEFAULT_SETTINGS.degrees],
    questionCount: clamp(questionCount, 1, 200),
    chordTempo: clamp(chordTempo, 40, 220),
    scaleTempo: clamp(scaleTempo, 40, 260),
    autoProceed,
    showQuestionDegree,
  };
}

export function applyToForm(form, settings) {
  setCheckedValues(form, 'intervals', settings.intervals);
  setCheckedValues(form, 'directions', settings.directions);
  setCheckedValues(form, 'degrees', settings.degrees);
  form.querySelector('[name="questionCount"]').value = settings.questionCount;
  form.querySelector('[name="chordTempo"]').value = settings.chordTempo;
  form.querySelector('[name="scaleTempo"]').value = settings.scaleTempo;
  form.querySelector('[name="autoProceed"]').checked = !!settings.autoProceed;
  form.querySelector('[name="showQuestionDegree"]').checked = !!settings.showQuestionDegree;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}
