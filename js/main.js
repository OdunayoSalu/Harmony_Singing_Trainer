import { loadDefaults, saveDefaults, readFromForm, applyToForm, saveCurrent } from './settings.js';

const form = document.getElementById('settings-form');
const saveDefaultsBtn = document.getElementById('saveDefaultsBtn');

window.addEventListener('DOMContentLoaded', () => {
  const defaults = loadDefaults();
  applyToForm(form, defaults);
});

saveDefaultsBtn.addEventListener('click', () => {
  const s = readFromForm(form);
  saveDefaults(s);
  saveDefaultsBtn.textContent = 'Saved';
  setTimeout(() => (saveDefaultsBtn.textContent = 'Save defaults'), 1200);
});

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const s = readFromForm(form);
  saveCurrent(s);
  window.location.href = './game.html';
});
