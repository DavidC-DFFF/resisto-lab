import {
  SERIES,
  approximatelyEqual,
  createChallenge,
  digitColours,
  evaluateChallengeItems,
  measurementDisplay,
  multiplierColours,
  toOhms
} from './core.js';
import {connectScorm} from './scorm.js';

const CHALLENGE_LENGTH = 5;
const STATE_VERSION = 1;
const scorm = connectScorm(window);

const elements = {
  level: document.querySelector('#level'),
  seriesBadge: document.querySelector('#series-badge'),
  scoreBadge: document.querySelector('#score-badge'),
  newResistor: document.querySelector('#new-resistor'),
  bands: [...document.querySelectorAll('.visual-band')],
  bandDescription: document.querySelector('#band-description'),
  toleranceName: document.querySelector('#tolerance-name'),
  nominalValue: document.querySelector('#nominal-value'),
  nominalUnit: document.querySelector('#nominal-unit'),
  nominalField: document.querySelector('#nominal-field'),
  nominalFeedback: document.querySelector('#nominal-feedback'),
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
  validateAnswers: document.querySelector('#validate-answers'),
  itemScore: document.querySelector('#item-score'),
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
  nominal: document.querySelector('#check-nominal'),
  low: document.querySelector('#check-low'),
  high: document.querySelector('#check-high'),
  meter: document.querySelector('#check-meter')
};

let mode = 'training';
let challenge;
let challenges = [];
let challengeRunning = false;
let challengeIndex = 0;
let challengeScore = 0;
let assessments = [];
let currentAssessed = false;
let measured = false;
let persistTimer;

function parseNumber(value) {
  const normalized = value.trim().replace(/\s/g, '').replace(',', '.');
  return normalized === '' ? NaN : Number(normalized);
}

function enteredOhms(valueElement, unitElement) {
  return toOhms(parseNumber(valueElement.value), unitElement.value);
}

function answerState(entered, expected) {
  if (!Number.isFinite(entered)) return 'empty';
  return approximatelyEqual(entered, expected) ? 'correct' : 'incorrect';
}

function currentSubmission() {
  return {
    nominal: enteredOhms(elements.nominalValue, elements.nominalUnit),
    low: enteredOhms(elements.lowValue, elements.lowUnit),
    high: enteredOhms(elements.highValue, elements.highUnit),
    blackPort: elements.blackPort.value,
    redPort: elements.redPort.value,
    dial: elements.dial.value
  };
}

function configurationState() {
  const submission = currentSubmission();
  const nominal = answerState(submission.nominal, challenge.nominal);
  const low = answerState(submission.low, challenge.low);
  const high = answerState(submission.high, challenge.high);
  const meter = submission.blackPort === 'com'
    && submission.redPort === 'vohm'
    && submission.dial === 'ohm';
  const complete = Number.isFinite(submission.nominal)
    && Number.isFinite(submission.low)
    && Number.isFinite(submission.high)
    && submission.blackPort !== 'none'
    && submission.redPort !== 'none'
    && submission.dial !== 'off';

  return {
    submission,
    nominal,
    low,
    high,
    meter,
    complete,
    ready: nominal === 'correct' && low === 'correct' && high === 'correct' && meter
  };
}

function renderField(field, feedback, state, emptyLabel) {
  field.classList.toggle('correct', state === 'correct');
  field.classList.toggle('incorrect', state === 'incorrect');
  feedback.textContent = state === 'correct'
    ? 'Valeur exacte'
    : state === 'incorrect'
      ? 'À corriger'
      : emptyLabel;
}

function renderNeutralField(field, feedback) {
  field.classList.remove('correct', 'incorrect');
  feedback.textContent = 'À contrôler';
}

function refreshAuthorization() {
  const state = configurationState();
  const reveal = mode === 'training' || currentAssessed;

  if (reveal) {
    renderField(elements.nominalField, elements.nominalFeedback, state.nominal, 'À décoder');
    renderField(elements.lowField, elements.lowFeedback, state.low, 'À calculer');
    renderField(elements.highField, elements.highFeedback, state.high, 'À calculer');
    checkItems.nominal.classList.toggle('done', state.nominal === 'correct');
    checkItems.low.classList.toggle('done', state.low === 'correct');
    checkItems.high.classList.toggle('done', state.high === 'correct');
    checkItems.meter.classList.toggle('done', state.meter);
  } else {
    renderNeutralField(elements.nominalField, elements.nominalFeedback);
    renderNeutralField(elements.lowField, elements.lowFeedback);
    renderNeutralField(elements.highField, elements.highFeedback);
    Object.values(checkItems).forEach(item => item.classList.remove('done'));
  }

  const awaitingAssessment = mode === 'competition' && challengeRunning && !currentAssessed;
  elements.validateAnswers.hidden = !awaitingAssessment;
  elements.validateAnswers.disabled = awaitingAssessment && !state.complete;
  elements.power.disabled = awaitingAssessment || !state.ready || measured;
  elements.authorization.classList.toggle('ready', !awaitingAssessment && state.ready && !measured);

  if (measured) {
    elements.authorization.textContent = 'Mesure effectuée : l’inéquation est complète.';
  } else if (awaitingAssessment) {
    elements.authorization.textContent = state.complete
      ? 'Les quatre réponses sont prêtes à être contrôlées.'
      : 'Complète les quatre items avant le premier contrôle.';
  } else if (state.ready) {
    elements.authorization.textContent = 'Configuration validée. Le multimètre peut être allumé.';
  } else {
    elements.authorization.textContent = currentAssessed
      ? 'Corrige les éléments en rouge pour autoriser l’allumage.'
      : 'Complète les quatre contrôles pour autoriser l’allumage.';
  }
}

function preferredUnit(ohms) {
  if (ohms >= 1_000_000) return 'mohm';
  if (ohms >= 1_000) return 'kohm';
  return 'ohm';
}

function controlsState() {
  return {
    nominalValue: elements.nominalValue.value,
    nominalUnit: elements.nominalUnit.value,
    lowValue: elements.lowValue.value,
    lowUnit: elements.lowUnit.value,
    highValue: elements.highValue.value,
    highUnit: elements.highUnit.value,
    blackPort: elements.blackPort.value,
    redPort: elements.redPort.value,
    dial: elements.dial.value
  };
}

function showMeasurement() {
  const display = measurementDisplay(challenge.measurement);
  const formatted = new Intl.NumberFormat('fr-FR', {maximumFractionDigits: 3}).format(display.value);
  elements.meterDisplay.textContent = `${formatted} ${display.unit}`;
  elements.meterRange.textContent = display.unit;
}

function resetControls(saved = null, savedMeasured = false) {
  const defaultUnit = preferredUnit(challenge.nominal);
  currentAssessed = Boolean(assessments[challengeIndex]);
  measured = savedMeasured;
  elements.nominalValue.value = saved?.nominalValue ?? '';
  elements.nominalUnit.value = saved?.nominalUnit ?? defaultUnit;
  elements.lowValue.value = saved?.lowValue ?? '';
  elements.lowUnit.value = saved?.lowUnit ?? defaultUnit;
  elements.highValue.value = saved?.highValue ?? '';
  elements.highUnit.value = saved?.highUnit ?? defaultUnit;
  elements.blackPort.value = saved?.blackPort ?? 'none';
  elements.redPort.value = saved?.redPort ?? 'none';
  elements.dial.value = saved?.dial ?? 'off';
  elements.meterDisplay.textContent = '— — —';
  elements.meterRange.textContent = 'AUTO';
  elements.nextChallenge.hidden = !measured;
  elements.nextChallenge.textContent = challengeRunning && challengeIndex === CHALLENGE_LENGTH - 1
    ? 'Voir le résultat'
    : 'Résistance suivante';

  if (measured) showMeasurement();

  const assessment = assessments[challengeIndex];
  elements.itemScore.hidden = !assessment;
  elements.itemScore.textContent = assessment
    ? `${assessment.points}/4 points acquis sur cette résistance.`
    : '';
  refreshAuthorization();
}

function renderChallenge(savedControls = null, savedMeasured = false) {
  elements.bands.forEach((band, index) => { band.dataset.colour = challenge.bands[index]; });
  const names = challenge.bands.map(css => {
    const colour = [...digitColours, ...multiplierColours].find(item => item.css === css);
    return colour?.name ?? css;
  });
  elements.bandDescription.textContent = `Anneaux : ${names.join(', ')}.`;
  elements.toleranceName.textContent = challenge.tolerance === 10 ? 'argent' : 'or';
  elements.seriesBadge.textContent = `${challenge.series} · ±${challenge.tolerance} %`;
  resetControls(savedControls, savedMeasured);
}

function nextTrainingResistance() {
  challenge = createChallenge(elements.level.value);
  renderChallenge();
}

function updateScoreBadge() {
  elements.scoreBadge.textContent = challengeRunning
    ? `${challengeIndex + 1}/${CHALLENGE_LENGTH} · ${challengeScore}/20`
    : mode === 'training'
      ? 'Essai libre'
      : 'Prêt à démarrer';
}

function attemptState(status = 'incomplete') {
  return {
    version: STATE_VERSION,
    status,
    series: elements.level.value,
    index: challengeIndex,
    score: challengeScore,
    challenges,
    assessments,
    measured,
    controls: controlsState()
  };
}

function persistAttempt() {
  clearTimeout(persistTimer);
  if (scorm.connected && challengeRunning) scorm.saveState(attemptState());
}

function schedulePersist() {
  if (!scorm.connected || !challengeRunning) return;
  clearTimeout(persistTimer);
  persistTimer = setTimeout(persistAttempt, 250);
}

function startCompetition() {
  challengeRunning = true;
  challengeIndex = 0;
  challengeScore = 0;
  assessments = Array(CHALLENGE_LENGTH).fill(null);
  challenges = Array.from({length: CHALLENGE_LENGTH}, () => createChallenge(elements.level.value));
  challenge = challenges[0];
  elements.challengePanel.hidden = true;
  elements.level.disabled = true;
  elements.resultDialog.hidden = true;
  renderChallenge();
  updateScoreBadge();
  if (scorm.connected) scorm.beginAttempt(attemptState());
}

function endCompetition() {
  challengeRunning = false;
  const completedState = attemptState('completed');
  elements.finalScore.textContent = scorm.connected
    ? `Note enregistrée dans Moodle : ${challengeScore}/20.`
    : `Résultat du défi : ${challengeScore}/20.`;
  elements.resultDialog.hidden = false;
  elements.restartChallenge.hidden = scorm.connected;
  elements.scoreBadge.textContent = `${challengeScore}/20`;
  if (scorm.connected) scorm.complete(challengeScore, completedState);
}

function assessCurrentResistance() {
  if (!challengeRunning || currentAssessed) return;
  const state = configurationState();
  if (!state.complete) return;

  const result = evaluateChallengeItems(challenge, state.submission);
  assessments[challengeIndex] = result;
  challengeScore += result.points;
  currentAssessed = true;
  elements.itemScore.hidden = false;
  elements.itemScore.textContent = `${result.points}/4 points acquis sur cette résistance.`;
  refreshAuthorization();
  updateScoreBadge();
  persistAttempt();
}

function completeMeasurement() {
  showMeasurement();
  measured = true;
  refreshAuthorization();
  elements.nextChallenge.hidden = false;
  elements.nextChallenge.textContent = challengeRunning && challengeIndex === CHALLENGE_LENGTH - 1
    ? 'Voir le résultat'
    : 'Résistance suivante';
  persistAttempt();
}

function applyMode(nextMode) {
  mode = nextMode;
  elements.modeButtons.forEach(button => button.classList.toggle('active', button.dataset.mode === mode));
  elements.challengePanel.hidden = mode !== 'competition';
  elements.hintButton.hidden = mode === 'competition';
  elements.hint.hidden = true;
  elements.newResistor.hidden = mode === 'competition';
}

function selectMode(nextMode) {
  if (scorm.connected) return;
  challengeRunning = false;
  challengeScore = 0;
  assessments = [];
  applyMode(nextMode);
  elements.level.disabled = false;
  updateScoreBadge();
  nextTrainingResistance();
}

function validAttemptState(state) {
  return state
    && state.version === STATE_VERSION
    && Array.isArray(state.challenges)
    && state.challenges.length === CHALLENGE_LENGTH
    && Number.isInteger(state.index)
    && state.index >= 0
    && state.index < CHALLENGE_LENGTH;
}

function restoreAttempt(state) {
  applyMode('competition');
  challengeRunning = state.status !== 'completed';
  challengeIndex = state.index;
  challengeScore = Number(state.score) || 0;
  challenges = state.challenges;
  assessments = Array.isArray(state.assessments)
    ? state.assessments
    : Array(CHALLENGE_LENGTH).fill(null);
  elements.level.value = SERIES[state.series] ? state.series : challenges[0].series;
  elements.level.disabled = true;
  elements.challengePanel.hidden = true;
  challenge = challenges[challengeIndex];
  renderChallenge(state.controls, Boolean(state.measured));

  if (challengeRunning) {
    updateScoreBadge();
  } else {
    elements.finalScore.textContent = `Note enregistrée dans Moodle : ${challengeScore}/20.`;
    elements.resultDialog.hidden = false;
    elements.restartChallenge.hidden = true;
    elements.scoreBadge.textContent = `${challengeScore}/20`;
  }
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

function initialize() {
  buildColourTable();

  if (!scorm.connected) {
    nextTrainingResistance();
    return;
  }

  document.body.classList.add('scorm-mode');
  applyMode('competition');
  elements.restartChallenge.hidden = true;
  const savedState = scorm.loadState();
  const completed = ['completed', 'passed'].includes(scorm.status());

  if (validAttemptState(savedState)) {
    restoreAttempt({...savedState, status: completed ? 'completed' : savedState.status});
    return;
  }

  challenge = createChallenge(elements.level.value);
  renderChallenge();
  elements.challengePanel.hidden = false;
  elements.scoreBadge.textContent = completed ? `${scorm.score()}/20` : 'Prêt à démarrer';

  if (completed) {
    elements.finalScore.textContent = `Note déjà enregistrée dans Moodle : ${scorm.score()}/20.`;
    elements.resultDialog.hidden = false;
  }
}

const answerElements = [
  elements.nominalValue,
  elements.nominalUnit,
  elements.lowValue,
  elements.lowUnit,
  elements.highValue,
  elements.highUnit,
  elements.blackPort,
  elements.redPort,
  elements.dial
];

['input', 'change'].forEach(eventName => {
  answerElements.forEach(element => element.addEventListener(eventName, () => {
    refreshAuthorization();
    schedulePersist();
  }));
});

elements.validateAnswers.addEventListener('click', assessCurrentResistance);
elements.power.addEventListener('click', completeMeasurement);
elements.newResistor.addEventListener('click', nextTrainingResistance);
elements.level.addEventListener('change', nextTrainingResistance);
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
  if (!challengeRunning) return nextTrainingResistance();
  if (challengeIndex === CHALLENGE_LENGTH - 1) return endCompetition();
  challengeIndex += 1;
  challenge = challenges[challengeIndex];
  renderChallenge();
  updateScoreBadge();
  persistAttempt();
});

window.addEventListener('beforeunload', () => {
  clearTimeout(persistTimer);
  if (scorm.connected && challengeRunning) scorm.suspend(attemptState());
  scorm.finish();
});

initialize();
