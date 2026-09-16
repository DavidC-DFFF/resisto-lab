import {
  SERIES,
  approximatelyEqual,
  createChallenge,
  digitColours,
  formatResistance,
  measurementDisplay,
  multiplierColours,
  toOhms
} from './core.js';

const elements = {
  level: document.querySelector('#level'),
  seriesBadge: document.querySelector('#series-badge'),
  scoreBadge: document.querySelector('#score-badge'),
  newResistor: document.querySelector('#new-resistor'),
  bands: [...document.querySelectorAll('.visual-band')],
  bandDescription: document.querySelector('#band-description'),
  toleranceName: document.querySelector('#tolerance-name'),
  lowValue: document.querySelector('#low-value'),
  lowUnit: document.querySelector('#low-unit'),
  highValue: document.querySelector('#high-value'),
  highUnit: document.querySelector('#high-unit'),
  lowField: document.querySelector('#low-field'),
  highField: document.querySelector('#high-field'),
  lowFeedback: document.querySelector('#low-feedback'),
  highFeedback: document.querySelector('#high-feedback'),
  dial: document.querySelector('#dial'),
  blackPort: document.querySelector('#black-port'),
  redPort: document.querySelector('#red-port'),
  meterDisplay: document.querySelector('#meter-display'),
  meterRange: document.querySelector('#meter-range'),
  power: document.querySelector('#power'),
  authorization: document.querySelector('#authorization'),
  nextChallenge: document.querySelector('#next-challenge'),
  hintButton: document.querySelector('#hint-button'),
  hint: document.querySelector('#hint'),
  colourTable: document.querySelector('#colour-table'),
  modeButtons: [...document.querySelectorAll('.mode-button')],
  challengePanel: document.querySelector('#challenge-panel'),
  startChallenge: document.querySelector('#start-challenge'),
  resultDialog: document.querySelector('#result-dialog'),
  finalScore: document.querySelector('#final-score'),
  restartChallenge: document.querySelector('#restart-challenge')
};

const checkItems = {
  low: document.querySelector('#check-low'),
  high: document.querySelector('#check-high'),
  leads: document.querySelector('#check-leads'),
  dial: document.querySelector('#check-dial')
};

let mode = 'training';
let challenge;
let challengeRunning = false;
let challengeIndex = 0;
let errors = 0;
let startedAt = 0;
let timerId;
let measured = false;
let errorFlags = new Set();

function parseNumber(value) {
  const normalized = value.trim().replace(/\s/g, '').replace(',', '.');
  return normalized === '' ? NaN : Number(normalized);
}

function boundState(side) {
  const valueElement = side === 'low' ? elements.lowValue : elements.highValue;
  const unitElement = side === 'low' ? elements.lowUnit : elements.highUnit;
  const expected = challenge[side];
  const entered = toOhms(parseNumber(valueElement.value), unitElement.value);
  if (!Number.isFinite(entered)) return 'empty';
  return approximatelyEqual(entered, expected) ? 'correct' : 'incorrect';
}

function renderBound(side, state) {
  const field = side === 'low' ? elements.lowField : elements.highField;
  const feedback = side === 'low' ? elements.lowFeedback : elements.highFeedback;
  field.classList.toggle('correct', state === 'correct');
  field.classList.toggle('incorrect', state === 'incorrect');
  feedback.textContent = state === 'correct' ? 'Valeur exacte' : state === 'incorrect' ? 'À recalculer' : 'À calculer';
  checkItems[side].classList.toggle('done', state === 'correct');
}

function configurationState() {
  const low = boundState('low');
  const high = boundState('high');
  const leads = elements.blackPort.value === 'com' && elements.redPort.value === 'vohm';
  const dial = elements.dial.value === 'ohm';
  return {low, high, leads, dial, ready: low === 'correct' && high === 'correct' && leads && dial};
}

function refreshAuthorization() {
  const state = configurationState();
  renderBound('low', state.low);
  renderBound('high', state.high);
  checkItems.leads.classList.toggle('done', state.leads);
  checkItems.dial.classList.toggle('done', state.dial);
  elements.power.disabled = !state.ready || measured;
  elements.authorization.classList.toggle('ready', state.ready && !measured);
  elements.authorization.textContent = measured
    ? 'Mesure effectuée : l’inéquation est complète.'
    : state.ready
      ? 'Configuration validée. Le multimètre peut être allumé.'
      : 'Complète les quatre contrôles pour autoriser l’allumage.';
}

function preferredUnit(ohms) {
  if (ohms >= 1_000_000) return 'mohm';
  if (ohms >= 1_000) return 'kohm';
  return 'ohm';
}

function resetControls() {
  measured = false;
  errorFlags = new Set();
  elements.lowValue.value = '';
  elements.highValue.value = '';
  elements.lowUnit.value = preferredUnit(challenge.nominal);
  elements.highUnit.value = preferredUnit(challenge.nominal);
  elements.blackPort.value = 'none';
  elements.redPort.value = 'none';
  elements.dial.value = 'off';
  elements.meterDisplay.textContent = '— — —';
  elements.meterRange.textContent = 'AUTO';
  elements.nextChallenge.hidden = true;
  refreshAuthorization();
}

function renderChallenge() {
  elements.bands.forEach((band, index) => { band.dataset.colour = challenge.bands[index]; });
  const names = challenge.bands.map(css => {
    const colour = [...digitColours, ...multiplierColours].find(item => item.css === css);
    return colour?.name ?? css;
  });
  elements.bandDescription.textContent = `Anneaux : ${names.join(', ')}.`;
  elements.toleranceName.textContent = challenge.tolerance === 10 ? 'argent' : 'or';
  elements.seriesBadge.textContent = `${challenge.series} · ±${challenge.tolerance} %`;
  resetControls();
}

function nextResistance() {
  challenge = createChallenge(elements.level.value);
  renderChallenge();
}

function formatElapsed(milliseconds) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function updateTimer() {
  if (!challengeRunning) return;
  elements.scoreBadge.textContent = `${challengeIndex + 1}/5 · ${errors} erreur${errors > 1 ? 's' : ''} · ${formatElapsed(Date.now() - startedAt)}`;
}

function startCompetition() {
  challengeRunning = true;
  challengeIndex = 0;
  errors = 0;
  startedAt = Date.now();
  elements.challengePanel.hidden = true;
  elements.level.disabled = true;
  clearInterval(timerId);
  timerId = setInterval(updateTimer, 250);
  nextResistance();
  updateTimer();
}

function endCompetition() {
  challengeRunning = false;
  clearInterval(timerId);
  const elapsed = Date.now() - startedAt;
  elements.finalScore.textContent = `5 contrôles réussis · ${errors} erreur${errors > 1 ? 's' : ''} · temps ${formatElapsed(elapsed)}.`;
  elements.resultDialog.hidden = false;
  elements.scoreBadge.textContent = `5/5 · ${formatElapsed(elapsed)}`;
}

function noteError(key, isIncorrect) {
  if (!challengeRunning || !isIncorrect || errorFlags.has(key)) return;
  errorFlags.add(key);
  errors += 1;
  updateTimer();
}

function completeMeasurement() {
  const display = measurementDisplay(challenge.measurement);
  const formatted = new Intl.NumberFormat('fr-FR', {maximumFractionDigits: 3}).format(display.value);
  elements.meterDisplay.textContent = `${formatted} ${display.unit}`;
  elements.meterRange.textContent = display.unit;
  measured = true;
  refreshAuthorization();
  elements.nextChallenge.hidden = false;
  elements.nextChallenge.textContent = challengeRunning && challengeIndex === 4 ? 'Voir le résultat' : 'Résistance suivante';
}

function selectMode(nextMode) {
  mode = nextMode;
  challengeRunning = false;
  clearInterval(timerId);
  elements.modeButtons.forEach(button => button.classList.toggle('active', button.dataset.mode === mode));
  elements.challengePanel.hidden = mode !== 'competition';
  elements.hintButton.hidden = mode === 'competition';
  elements.hint.hidden = true;
  elements.newResistor.hidden = mode === 'competition';
  elements.level.disabled = false;
  elements.scoreBadge.textContent = mode === 'training' ? 'Essai libre' : 'Prêt à démarrer';
  nextResistance();
}

function buildColourTable() {
  elements.colourTable.innerHTML = digitColours.map(colour => `
    <div class="colour-cell">
      <i data-colour="${colour.css}" aria-hidden="true"></i>
      <span>${colour.name}</span>
      <strong>${colour.value}</strong>
      <small>×10<sup>${colour.value}</sup></small>
    </div>
  `).join('');
}

['input', 'change'].forEach(eventName => {
  [elements.lowValue, elements.lowUnit, elements.highValue, elements.highUnit].forEach(element => element.addEventListener(eventName, refreshAuthorization));
});
elements.lowValue.addEventListener('blur', () => noteError('low', boundState('low') === 'incorrect'));
elements.highValue.addEventListener('blur', () => noteError('high', boundState('high') === 'incorrect'));

[elements.blackPort, elements.redPort, elements.dial].forEach(element => element.addEventListener('change', () => {
  refreshAuthorization();
  if (element === elements.blackPort) noteError('black', element.value !== 'none' && element.value !== 'com');
  if (element === elements.redPort) noteError('red', element.value !== 'none' && element.value !== 'vohm');
  if (element === elements.dial) noteError('dial', element.value !== 'off' && element.value !== 'ohm');
}));

elements.power.addEventListener('click', completeMeasurement);
elements.newResistor.addEventListener('click', nextResistance);
elements.level.addEventListener('change', nextResistance);
elements.hintButton.addEventListener('click', () => {
  elements.hint.hidden = !elements.hint.hidden;
  elements.hintButton.textContent = elements.hint.hidden ? 'Voir la méthode' : 'Masquer la méthode';
});
elements.modeButtons.forEach(button => button.addEventListener('click', () => selectMode(button.dataset.mode)));
elements.startChallenge.addEventListener('click', startCompetition);
elements.restartChallenge.addEventListener('click', () => {
  elements.resultDialog.hidden = true;
  startCompetition();
});
elements.nextChallenge.addEventListener('click', () => {
  if (!challengeRunning) return nextResistance();
  if (challengeIndex === 4) return endCompetition();
  challengeIndex += 1;
  nextResistance();
  updateTimer();
});

buildColourTable();
nextResistance();
