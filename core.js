export const digitColours = [
  {name: 'Noir', value: 0, css: 'black'},
  {name: 'Marron', value: 1, css: 'brown'},
  {name: 'Rouge', value: 2, css: 'red'},
  {name: 'Orange', value: 3, css: 'orange'},
  {name: 'Jaune', value: 4, css: 'yellow'},
  {name: 'Vert', value: 5, css: 'green'},
  {name: 'Bleu', value: 6, css: 'blue'},
  {name: 'Violet', value: 7, css: 'violet'},
  {name: 'Gris', value: 8, css: 'grey'},
  {name: 'Blanc', value: 9, css: 'white'}
];

export const multiplierColours = [
  ...digitColours.map(colour => ({...colour, multiplier: 10 ** colour.value})),
  {name: 'Or', value: -1, multiplier: 0.1, css: 'gold'},
  {name: 'Argent', value: -2, multiplier: 0.01, css: 'silver'}
];

export const toleranceColours = [
  {name: 'Marron', tolerance: 1, css: 'brown'},
  {name: 'Rouge', tolerance: 2, css: 'red'},
  {name: 'Vert', tolerance: 0.5, css: 'green'},
  {name: 'Bleu', tolerance: 0.25, css: 'blue'},
  {name: 'Violet', tolerance: 0.1, css: 'violet'},
  {name: 'Gris', tolerance: 0.05, css: 'grey'},
  {name: 'Or', tolerance: 5, css: 'gold'},
  {name: 'Argent', tolerance: 10, css: 'silver'}
];

export const SERIES = {
  E12: {values: [10, 12, 15, 18, 22, 27, 33, 39, 47, 56, 68, 82], tolerance: 10, toleranceColour: 'silver'},
  E24: {values: [10, 11, 12, 13, 15, 16, 18, 20, 22, 24, 27, 30, 33, 36, 39, 43, 47, 51, 56, 62, 68, 75, 82, 91], tolerance: 5, toleranceColour: 'gold'}
};

const DECADES = [1, 10, 100, 1_000, 10_000];

export function decodeResistance(digits, multiplier) {
  return Number(digits.join('')) * multiplier;
}

export function toleranceBounds(value, tolerance) {
  const delta = value * tolerance / 100;
  return {low: value - delta, high: value + delta};
}

export function approximatelyEqual(first, second) {
  const scale = Math.max(1, Math.abs(first), Math.abs(second));
  return Math.abs(first - second) <= scale * 1e-9;
}

export function toOhms(value, unit) {
  const factors = {ohm: 1, kohm: 1_000, mohm: 1_000_000};
  return Number(value) * factors[unit];
}

export function valueToBands(ohms, toleranceColour) {
  const exponent = Math.floor(Math.log10(ohms)) - 1;
  const significant = Math.round(ohms / (10 ** exponent));
  const digits = String(significant).padStart(2, '0').slice(0, 2).split('').map(Number);
  const multiplier = multiplierColours.find(colour => colour.value === exponent);
  if (!multiplier) throw new RangeError('Valeur incompatible avec un code à quatre anneaux.');
  return [digitColours[digits[0]].css, digitColours[digits[1]].css, multiplier.css, toleranceColour];
}

function challengeFromNominal(seriesName, nominal, random) {
  const series = SERIES[seriesName];
  const {low, high} = toleranceBounds(nominal, series.tolerance);
  const measurement = low + random() * (high - low);
  return {
    series: seriesName,
    nominal,
    tolerance: series.tolerance,
    low,
    high,
    measurement,
    bands: valueToBands(nominal, series.toleranceColour)
  };
}

function nominalCandidates(seriesName) {
  const series = SERIES[seriesName];
  if (!series) throw new RangeError(`Série inconnue : ${seriesName}`);
  return series.values.flatMap(base => DECADES.map(decade => base * decade));
}

function randomItem(items, random) {
  const index = Math.min(items.length - 1, Math.floor(random() * items.length));
  return items[index];
}

export function createChallenge(seriesName, random = Math.random) {
  const nominal = randomItem(nominalCandidates(seriesName), random);
  return challengeFromNominal(seriesName, nominal, random);
}

export function createChallengeSequence(seriesNames, random = Math.random) {
  const usedNominals = new Set();

  return seriesNames.map(seriesName => {
    const available = nominalCandidates(seriesName).filter(nominal => !usedNominals.has(nominal));
    if (available.length === 0) {
      throw new RangeError(`Plus aucune valeur distincte disponible pour la série ${seriesName}.`);
    }
    const nominal = randomItem(available, random);
    usedNominals.add(nominal);
    return challengeFromNominal(seriesName, nominal, random);
  });
}

export function formatResistance(ohms, maximumFractionDigits = 3) {
  const units = [
    {limit: 1_000_000, divisor: 1_000_000, symbol: 'MΩ'},
    {limit: 1_000, divisor: 1_000, symbol: 'kΩ'},
    {limit: 0, divisor: 1, symbol: 'Ω'}
  ];
  const unit = units.find(item => ohms >= item.limit);
  const value = ohms / unit.divisor;
  return `${new Intl.NumberFormat('fr-FR', {maximumFractionDigits}).format(value)} ${unit.symbol}`;
}

export function formatTolerance(value) {
  return new Intl.NumberFormat('fr-FR', {maximumFractionDigits: 2}).format(value);
}

export function measurementDisplay(ohms) {
  if (ohms >= 1_000_000) return {value: ohms / 1_000_000, unit: 'MΩ'};
  if (ohms >= 1_000) return {value: ohms / 1_000, unit: 'kΩ'};
  return {value: ohms, unit: 'Ω'};
}

export function evaluateChallengeItems(challenge, submission) {
  const nominal = approximatelyEqual(submission.nominal, challenge.nominal);
  const low = approximatelyEqual(submission.low, challenge.low);
  const high = approximatelyEqual(submission.high, challenge.high);
  const meter = submission.blackPort === 'com'
    && submission.redPort === 'vohm'
    && submission.dial === 'ohm';

  return {
    nominal,
    low,
    high,
    meter,
    points: [nominal, low, high, meter].filter(Boolean).length
  };
}
