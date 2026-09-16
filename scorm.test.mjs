import assert from 'node:assert/strict';
import {ScormRuntime, findScormApi} from './scorm.js';

function fakeApi(initial = {}) {
  const values = new Map(Object.entries(initial));
  const calls = [];
  return {
    values,
    calls,
    LMSInitialize(value) { calls.push(['initialize', value]); return 'true'; },
    LMSGetValue(name) { calls.push(['get', name]); return values.get(name) ?? ''; },
    LMSSetValue(name, value) { calls.push(['set', name, value]); values.set(name, value); return 'true'; },
    LMSCommit(value) { calls.push(['commit', value]); return 'true'; },
    LMSFinish(value) { calls.push(['finish', value]); return 'true'; }
  };
}

const api = fakeApi();
const runtime = new ScormRuntime(api);
assert.equal(runtime.initialize(), true);

const progress = {version: 1, status: 'incomplete', index: 2, score: 7};
assert.equal(runtime.beginAttempt(progress), true);
assert.equal(api.values.get('cmi.core.lesson_status'), 'incomplete');
assert.equal(api.values.get('cmi.core.score.max'), '20');
assert.deepEqual(runtime.loadState(), progress);

const completed = {...progress, status: 'completed', index: 4, score: 13};
assert.equal(runtime.complete(13, completed), true);
assert.equal(api.values.get('cmi.core.score.raw'), '13');
assert.equal(api.values.get('cmi.core.lesson_status'), 'completed');
assert.equal(runtime.finish(), true);

const nestedApi = fakeApi();
const root = {API: nestedApi};
root.parent = root;
const child = {parent: root, opener: null};
assert.equal(findScormApi(child), nestedApi);
assert.equal(findScormApi(null), null);

console.log('Tous les tests du pont SCORM sont réussis.');
