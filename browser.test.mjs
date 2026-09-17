import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {chromium} from 'playwright';

const port = 8123;
const baseUrl = `http://127.0.0.1:${port}/`;
const server = spawn(process.execPath, ['server.mjs'], {
  cwd: import.meta.dirname,
  env: {...process.env, RESISTOLAB_PORT: String(port)},
  stdio: 'ignore'
});

async function waitForServer() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {
      // Le serveur démarre encore.
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Le serveur de test ne répond pas.');
}

function decodeBands(description) {
  const names = description
    .replace('Anneaux : ', '')
    .replace('.', '')
    .split(', ');
  const digits = {Noir: 0, Marron: 1, Rouge: 2, Orange: 3, Jaune: 4, Vert: 5, Bleu: 6, Violet: 7, Gris: 8, Blanc: 9};
  const nominal = (digits[names[0]] * 10 + digits[names[1]]) * (10 ** digits[names[2]]);
  const tolerance = names[3] === 'Argent' ? 10 : 5;
  return {
    nominal,
    low: nominal * (1 - tolerance / 100),
    high: nominal * (1 + tolerance / 100)
  };
}

async function fillAnswers(page, answers) {
  await page.locator('#nominal-value').fill(String(answers.nominal));
  await page.locator('#nominal-unit').selectOption('ohm');
  await page.locator('#low-value').fill(String(answers.low));
  await page.locator('#low-unit').selectOption('ohm');
  await page.locator('#high-value').fill(String(answers.high));
  await page.locator('#high-unit').selectOption('ohm');
  await page.locator('#black-port').selectOption('com');
  await page.locator('#red-port').selectOption('vohm');
  await page.locator('#dial').selectOption('ohm');
}

let browser;

try {
  await waitForServer();
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  browser = await chromium.launch({
    headless: true,
    ...(existsSync(edgePath) ? {executablePath: edgePath} : {})
  });

  const standalonePage = await browser.newPage();
  await standalonePage.goto(baseUrl);
  assert.equal(await standalonePage.locator('body').getAttribute('class'), null);
  assert.equal(await standalonePage.locator('#score-badge').innerText(), 'Essai libre');
  assert.equal(await standalonePage.locator('#nominal-value').isVisible(), true);
  await standalonePage.locator('[data-mode="competition"]').click();
  assert.match(await standalonePage.locator('#challenge-panel').innerText(), /note sur 20/);
  await standalonePage.locator('#start-challenge').click();
  assert.match(await standalonePage.locator('#score-badge').innerText(), /0\/20/);
  assert.equal(await standalonePage.locator('#resistor-progress').innerText(), 'Résistance 1/5');
  assert.equal(await standalonePage.locator('#validate-answers').isDisabled(), true);
  await standalonePage.close();

  const page = await browser.newPage();
  await page.addInitScript(() => {
    const prefix = 'resistolab-test:';
    window.API = {
      LMSInitialize() { return 'true'; },
      LMSGetValue(name) { return localStorage.getItem(prefix + name) ?? ''; },
      LMSSetValue(name, value) { localStorage.setItem(prefix + name, String(value)); return 'true'; },
      LMSCommit() { return 'true'; },
      LMSFinish() { return 'true'; }
    };
  });

  await page.goto(baseUrl);
  assert.equal(await page.locator('body').getAttribute('class'), 'scorm-mode');
  assert.match(await page.locator('#challenge-panel').innerText(), /note sur 20/);
  await page.locator('#start-challenge').click();

  const firstBands = await page.locator('#band-description').textContent();
  const observedNominals = new Set([decodeBands(firstBands).nominal]);
  assert.equal(await page.locator('#resistor-progress').innerText(), 'Résistance 1/5');
  assert.equal(await page.locator('#tolerance-name').innerText(), 'argent');
  await fillAnswers(page, {nominal: 1, low: 1, high: 1});
  await page.locator('#validate-answers').click();
  assert.match(await page.locator('#item-score').innerText(), /1\/4/);
  assert.match(await page.locator('#score-badge').innerText(), /1\/20/);

  await fillAnswers(page, decodeBands(firstBands));
  assert.equal(await page.locator('#power').isEnabled(), true);
  await page.locator('#power').click();
  assert.equal(await page.locator('#next-challenge').isVisible(), true);

  await page.reload();
  assert.equal(await page.locator('#band-description').textContent(), firstBands);
  assert.match(await page.locator('#item-score').innerText(), /1\/4/);
  assert.match(await page.locator('#score-badge').innerText(), /1\/20/);
  assert.equal(await page.locator('#next-challenge').isVisible(), true);
  assert.equal(await page.locator('#resistor-progress').innerText(), 'Résistance 1/5');

  await page.locator('#next-challenge').click();
  for (let index = 1; index < 5; index += 1) {
    const bands = await page.locator('#band-description').textContent();
    observedNominals.add(decodeBands(bands).nominal);
    assert.equal(await page.locator('#resistor-progress').innerText(), `Résistance ${index + 1}/5`);
    assert.equal(await page.locator('#tolerance-name').innerText(), index < 2 ? 'argent' : 'or');
    await fillAnswers(page, decodeBands(bands));
    await page.locator('#validate-answers').click();
    assert.match(await page.locator('#item-score').innerText(), /4\/4/);
    await page.locator('#power').click();
    await page.locator('#next-challenge').click();
  }

  assert.equal(observedNominals.size, 5);

  assert.equal(await page.locator('#result-dialog').isVisible(), true);
  assert.match(await page.locator('#final-score').innerText(), /17\/20/);
  assert.equal(await page.locator('#restart-challenge').isVisible(), false);
  assert.equal(await page.evaluate(() => localStorage.getItem('resistolab-test:cmi.core.score.raw')), '17');
  assert.equal(await page.evaluate(() => localStorage.getItem('resistolab-test:cmi.core.lesson_status')), 'completed');

  console.log('Le parcours SCORM complet et la reprise après actualisation sont validés.');
} finally {
  await browser?.close();
  server.kill();
}
