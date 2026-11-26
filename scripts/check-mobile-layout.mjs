import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';

const engine = process.env.GEOQUIZ_BROWSER ?? 'webkit';
const { [engine]: browserType, devices } = await import(process.env.PLAYWRIGHT_ENTRY ?? 'playwright');
const app = process.env.GEOQUIZ_PREVIEW ?? 'http://127.0.0.1:4173/';
const artifacts = process.env.GEOQUIZ_SCREENSHOTS ?? 'mobile-layout-screenshots';
const countryData = JSON.parse(await readFile('dist/data/sets/world/entities.json', 'utf8'));
const browser = await browserType.launch({
  ...(process.env.GEOQUIZ_BROWSER_PATH ? { executablePath: process.env.GEOQUIZ_BROWSER_PATH } : {}),
});
const viewports = [
  ['iphone-16', 393, 852], ['iphone-se', 375, 667], ['wide-phone', 430, 932], ['landscape', 852, 393],
];

async function verify([device, width, height]) {
  const directory = `${artifacts}/${device}`;
  await mkdir(directory, { recursive: true });
  const context = await browser.newContext({
    ...(devices['iPhone 16'] ?? devices['iPhone 15'] ?? devices['iPhone 13']),
    viewport: { width, height }, screen: { width, height }, deviceScaleFactor: 1, isMobile: true, hasTouch: true,
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  const errors = [];
  const diagnostics = [];
  const snap = (name, options = {}) => page.screenshot({ path: `${directory}/${name}.png`, ...options });
  const menu = page.getByRole('dialog', { name: 'GeoQuiz' });
  const choose = (name) => menu.getByRole('button', { name, exact: true }).tap();
  const settle = () => page.waitForFunction(() => !document.querySelector('.menu-overlay').hasAttribute('data-transition'));
  const atlas = page.locator('.atlas-sheet');
  const verdict = page.locator('.verdict-title');
  const next = page.getByRole('button', { name: 'Weiter', exact: true });
  const dock = page.locator('.answer-dock');
  const question = page.locator('.question');
  const box = (locator) => locator.boundingBox();
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') diagnostics.push(message.text()); });
  page.setDefaultTimeout(12000);
  await page.addInitScript(() => { Math.random = () => .999999; });
  await page.route('**/entities.json', (route) => route.fulfill({
    json: [countryData.find(({ id }) => id === 'DEU'), ...countryData.filter(({ id }) => id !== 'DEU')],
  }));

  async function home() {
    await page.getByRole('button', { name: 'Menü öffnen' }).tap();
    await menu.waitFor();
    await settle();
  }
  async function practice() {
    await home();
    await choose('Üben');
    await settle();
  }
  async function start(name) {
    await practice();
    await choose(name);
    await menu.waitFor({ state: 'hidden' });
  }
  async function customFlags(direction) {
    await practice();
    await choose('Flaggen anpassen');
    await settle();
    await choose(direction);
    await choose('Runde starten');
    await menu.waitFor({ state: 'hidden' });
  }
  async function dragGrip(sheet, delta) {
    const grip = await box(sheet.locator('.profile-grip'));
    await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
    await page.mouse.down();
    await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2 + delta, { steps: 6 });
    await page.mouse.up();
  }
  async function assertSheet(sheet, expanded) {
    const frame = await box(sheet);
    assert.ok(frame && Math.abs(frame.y + frame.height - height) <= 2, `${device}: sheet bottom ${JSON.stringify(frame)}`);
    assert.equal(frame.width, width);
    assert.ok(expanded ? frame.height > height * .8 : Math.abs(frame.height - height / 2) <= 2);
    assert.equal(await sheet.locator('.profile-content').evaluate(el => getComputedStyle(el).overscrollBehaviorY), 'contain');
  }
  async function assertPanel() {
    const button = await box(next);
    const panel = await box(dock);
    assert.ok(button && panel);
    assert.ok(Math.abs(button.width - panel.width) <= 4 && Math.abs(button.height - 56) <= 1);
    assert.equal(await page.locator('.answer-dock > .answer-sheet .continue-overlay').count(), 1);
    assert.equal(await verdict.evaluate(el => getComputedStyle(el).fontSize), '28px');
    const rows = await page.locator('.answer-row[data-muted]').evaluateAll(rows => rows.map(el => Math.round(el.getBoundingClientRect().height)));
    assert.ok(rows.every(value => value === 0), `${device}: rows ${rows}`);
    const visible = page.locator('.answer-content');
    assert.equal(await visible.evaluate(el => getComputedStyle(el).overflowY), 'auto');
    if (await page.locator('#quiz[data-country-round]').count() === 0) {
      assert.ok(panel.y >= 0 && panel.y + panel.height <= height + 1);
      assert.ok(button.y >= 0 && button.y + button.height <= height + 1);
    }
  }
  async function assertFourOptions() {
    const area = await box(dock);
    const header = await box(page.locator('.quiz-bar'));
    const buttons = page.locator('.answers button:enabled');
    assert.equal(await buttons.count(), 4);
    for (const button of await buttons.all()) {
      const rect = await box(button);
      assert.ok(rect.height >= 44 && rect.width >= 44 && rect.y >= area.y && rect.y >= header.y + header.height - 1,
        `${device}: option in dock ${JSON.stringify({ rect, area, header })}`);
      assert.ok(rect.y + rect.height <= area.y + area.height + 1, `${device}: option bottom ${JSON.stringify({ rect, area })}`);
      if (height > 500 && !await button.evaluate(el => el.classList.contains('flag-option'))) {
        assert.ok(rect.width >= area.width - 4);
      }
    }
  }
  async function answerChoice(name) {
    await snap(`${name}-before`);
    await page.locator('.answers button:enabled').first().tap();
    await verdict.waitFor();
    await page.waitForFunction(() => [...document.querySelectorAll('.answer-row[data-muted]')]
      .every(row => Math.round(row.getBoundingClientRect().height) === 0));
    if (name === 'flag-to-land') {
      await page.waitForFunction(() => Math.round(document.querySelector('.question-flag').getBoundingClientRect().width) === 96);
    }
    await assertPanel();
    await snap(`${name}-after`);
  }

  try {
    await page.goto(app);
    await page.locator('svg.world-map > g[transform]').waitFor({ state: 'attached' });
    await page.evaluate(() => document.fonts.ready);
    await snap('atlas-map');
    const scene = page.locator('svg.world-map > g[transform]');
    const overview = await scene.getAttribute('transform');
    await page.locator('.world-map [data-country-id="DEU"][tabindex="0"]').focus();
    await page.keyboard.press('Enter');
    await atlas.waitFor();
    await assertSheet(atlas, false);
    await page.waitForFunction(before => document.querySelector('svg.world-map > g[transform]').getAttribute('transform') !== before, overview);
    await snap('atlas-half');
    const before = await scene.getAttribute('transform');
    const scroller = atlas.locator('.profile-content');
    assert.ok(await scroller.evaluate(el => {
      el.scrollTop = 120;
      return el.scrollTop > 0;
    }));
    assert.equal(await scene.getAttribute('transform'), before);
    await scroller.evaluate(el => { el.scrollTop = 0; });
    await dragGrip(atlas, -95);
    await assertSheet(atlas, true);
    await snap('atlas-full');
    await dragGrip(atlas, 155);
    await atlas.waitFor({ state: 'hidden' });

    await home();
    await snap('menu-level-1');
    await choose('Üben');
    await settle();
    await snap('menu-level-2');
    assert.equal(await menu.getByRole('button', { name: 'Fällige Wiederholungen' }).isDisabled(), true);
    await choose('Runde zusammenstellen');
    await settle();
    await snap('round-builder');
    await menu.getByRole('button', { name: 'Runde starten' }).scrollIntoViewIfNeeded();
    assert.ok((await box(menu.getByRole('button', { name: 'Runde starten' }))).height >= 44);
    await menu.getByRole('button', { name: 'Zurück' }).tap();
    await settle();
    await menu.getByRole('button', { name: 'Zurück' }).tap();
    await settle();
    await choose('Menü schließen');

    await start('Länder finden');
    await snap('find-before');
    await page.keyboard.press('s');
    await assertPanel();
    await snap('find-after');
    await page.locator('.verdict-profiles button').first().tap();
    const overlay = page.locator('.quiz-profile');
    await assertSheet(overlay, false);
    await snap('quiz-profile-half');
    await overlay.locator('.profile-grip').tap();
    await assertSheet(overlay, true);
    await snap('quiz-profile-full');
    await dragGrip(overlay, 155);
    await overlay.waitFor({ state: 'hidden' });
    assert.equal(await verdict.textContent(), 'Übersprungen.');

    for (const [preset, name] of [['Länder benennen', 'name'], ['Hauptstädte', 'capitals'], ['Alles gemischt', 'mixed']]) {
      await start(preset);
      await assertFourOptions();
      await answerChoice(name);
    }

    await customFlags('Land → Kategorie');
    await assertFourOptions();
    await answerChoice('land-to-flag');
    await customFlags('Kategorie → Land');
    await assertFourOptions();
    const flag = page.locator('.question-flag');
    assert.ok((await box(flag)).height <= Math.min(240, height * .28) + 1);
    if (device === 'iphone-16') {
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      assert.match(await page.locator('.answer-row').first().evaluate(el => getComputedStyle(el).transitionDuration), /0\.35s/);
      assert.match(await flag.evaluate(el => getComputedStyle(el).transitionDuration), /0\.4s/);
    }
    await answerChoice('flag-to-land');
    assert.equal(Math.round((await box(flag)).width), 96);
    await page.emulateMedia({ reducedMotion: 'reduce' });

    await start('Hauptstädte auf der Karte');
    await snap('capital-map-before');
    await page.locator('.point-stage .country-map').press('Enter');
    await assertPanel();
    await snap('capital-map-after');

    await start('Ein Land komplett');
    await page.locator('.answers').scrollIntoViewIfNeeded();
    await answerChoice('country-round');
    await next.tap();
    await page.keyboard.press('s');
    await next.tap();
    await page.locator('.country-hero-point .country-map').scrollIntoViewIfNeeded();
    await snap('country-capital-map-before');
    await page.locator('.country-hero-point .country-map').press('Enter');
    await next.scrollIntoViewIfNeeded();
    await assertPanel();
    await snap('country-capital-map-after');
    await next.tap();
    const remaining = await page.locator('.country-progress-cell:not([data-outcome])').count();
    for (let i = 0; i < remaining; i++) {
      await page.keyboard.press('s');
      await next.tap();
    }
    await page.getByRole('button', { name: 'Im Atlas öffnen' }).scrollIntoViewIfNeeded();
    await snap('country-result');

    await practice();
    await choose('Länder benennen anpassen');
    await settle();
    await choose('Tippen');
    await choose('Runde starten');
    await menu.waitFor({ state: 'hidden' });
    const entry = page.locator('#country-answer');
    await entry.tap();
    const available = height <= 500 ? 184 : height - 287;
    await page.evaluate((available) => {
      const viewport = window.visualViewport;
      Object.defineProperty(viewport, 'height', { configurable: true, value: available });
      viewport.dispatchEvent(new Event('resize'));
    }, available);
    await page.locator('.quiz-stage[data-keyboard]').waitFor({ state: 'attached' });
    assert.ok((await box(entry)).y + (await box(entry)).height <= available, `${device}: input above emulated keyboard`);
    await snap('typed-keyboard-viewport', { clip: { x: 0, y: 0, width, height: available } });
    await entry.fill('Atlantis');
    await entry.press('Enter');
    await assertPanel();
    await snap('typed-after');
    assert.deepEqual(errors, []);
    console.log(`${engine} ${width} × ${height}: navigated every preset and verified mobile layout.`);
  } catch (error) {
    console.error(`${engine} ${device}:`, ...errors, ...diagnostics);
    await snap('failure').catch(() => {});
    throw error;
  } finally {
    await context.close();
  }
}

try {
  const selected = process.argv.slice(2);
  const results = await Promise.allSettled(viewports.filter(([device]) => !selected.length || selected.includes(device)).map(verify));
  const failed = results.filter(result => result.status === 'rejected');
  for (const failure of failed) console.error(failure.reason);
  if (failed.length) process.exitCode = 1;
} finally {
  await browser.close();
}
