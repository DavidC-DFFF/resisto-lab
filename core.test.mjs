import assert from 'node:assert/strict';
import {
  approximatelyEqual,
  createChallenge,
  createChallengeSequence,
  decodeResistance,
  evaluateChallengeItems,
  formatResistance,
  formatTolerance,
  measurementDisplay,
  toleranceBounds,
  toOhms,
  valueToBands
} from './core.js';

assert.equal(decodeResistance([1, 0], 100), 1000);
assert.equal(decodeResistance([4, 7], 0.1), 4.7);
assert.equal(formatResistance(1000), '1 kΩ');
assert.equal(formatResistance(4.7), '4,7 Ω');
assert.equal(formatTolerance(0.05), '0,05');

assert.deepEqual(toleranceBounds(10_000, 10), {low: 9_000, high: 11_000});
assert.equal(toOhms(2.2, 'kohm'), 2200);
assert.equal(approximatelyEqual(toOhms(2.2, 'kohm'), 2200), true);
assert.deepEqual(valueToBands(1_000, 'gold'), ['brown', 'black', 'red', 'gold']);

const challenge = createChallenge('E12', () => 0);
assert.equal(challenge.nominal, 10);
assert.equal(challenge.low, 9);
assert.equal(challenge.high, 11);
assert.equal(challenge.measurement, 9);

const sequence = createChallengeSequence(['E12', 'E12', 'E24', 'E24', 'E24'], () => 0);
assert.deepEqual(sequence.map(item => item.tolerance), [10, 10, 5, 5, 5]);
assert.equal(new Set(sequence.map(item => item.nominal)).size, 5);
assert.deepEqual(measurementDisplay(2_180), {value: 2.18, unit: 'kΩ'});

assert.deepEqual(evaluateChallengeItems(challenge, {
  nominal: 10,
  low: 9,
  high: 11,
  blackPort: 'com',
  redPort: 'vohm',
  dial: 'ohm'
}), {nominal: true, low: true, high: true, meter: true, points: 4});

assert.deepEqual(evaluateChallengeItems(challenge, {
  nominal: 10,
  low: 8,
  high: 11,
  blackPort: 'com',
  redPort: 'ma',
  dial: 'ohm'
}), {nominal: true, low: false, high: true, meter: false, points: 2});

console.log('Tous les tests de RésistoLab sont réussis.');
