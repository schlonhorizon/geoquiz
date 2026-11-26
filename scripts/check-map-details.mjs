import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';

const engine = process.env.GEOQUIZ_BROWSER ?? 'webkit';
const { [engine]: type } = await import(process.env.PLAYWRIGHT_ENTRY ?? 'playwright');
const app = process.env.GEOQUIZ_PREVIEW ?? 'http://127.0.0.1:4173/';
const directory = `${process.env.GEOQUIZ_SCREENSHOTS ?? 'mobile-layout-screenshots'}/map-details`;
const entities = JSON.parse(await readFile('dist/data/sets/world/entities.json', 'utf8'));
const browser = await type.launch({
  ...(process.env.GEOQUIZ_BROWSER_PATH ? { executablePath: process.env.GEOQUIZ_BROWSER_PATH } : {}),
});
await mkdir(directory, { recursive: true });

async function verify(mobile) {
  const device = mobile ? 'phone' : 'desktop';
  const viewport = mobile ? { width: 393, height: 852 } : { width: 1366, height: 900 };
  const page = await browser.newPage({ viewport, isMobile: mobile, hasTouch: mobile });
  const svg = page.locator('svg.world-map');
  const camera = svg.locator(':scope > g[transform]');
  const menu = page.getByRole('dialog', { name: 'GeoQuiz' });
  const errors = [];
  const input = (button) => mobile ? button.tap() : button.click();
  const choose = (name) => input(menu.getByRole('button', { name, exact: true }));
  const settledMenu = () => page.waitForFunction(() => !document.querySelector('.menu-overlay').hasAttribute('data-transition'));
  const photograph = (name) => page.screenshot({ path: `${directory}/${device}-${name}.png` });
  const mapCoordinate = (point) => camera.evaluate((group, [longitude, latitude]) => {
    const width = Number(group.ownerSVGElement.querySelector('pattern').getAttribute('width'));
    const y = (lat) => -width / (2 * Math.PI) * 1.25 * Math.log(Math.tan(Math.PI / 4 + .4 * lat * Math.PI / 180));
    const worldPoint = new DOMPoint((longitude + 180) / 360 * width, y(latitude) - y(85));
    const matrix = group.getScreenCTM();
    for (const copy of [0, -1, 1]) {
      const view = new DOMPoint(worldPoint.x + copy * width, worldPoint.y).matrixTransform(matrix);
      if (view.x > 0 && view.x < innerWidth && view.y > 0 && view.y < innerHeight) return { x: view.x, y: view.y };
    }
  }, point);
  const zoomAt = (point, deltaY) => svg.dispatchEvent('wheel', {
    clientX: point.x, clientY: point.y, deltaY, bubbles: true, cancelable: true,
  });

  let requests = 0;
  let release;
  const available = new Promise((resolve) => { release = resolve; });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => { Math.random = () => .999999; });
  await page.route('**/entities.json', (route) => route.fulfill({
    json: [entities.find(({ id }) => id === 'DEU'), ...entities.filter(({ id }) => id !== 'DEU')],
  }));
  await page.route('**/map-detail.topojson', async (route) => {
    requests++;
    await available;
    await route.continue();
  });

  try {
    await page.goto(app);
    await camera.waitFor({ state: 'attached' });
    const origin = await camera.getAttribute('transform');
    assert.equal(await svg.getAttribute('data-map-detail'), 'overview');
    assert.equal(requests, 0);
    await page.locator('.world-raster[data-raster-level="overview"][data-raster-water]').waitFor();
    assert.equal(await svg.locator('.map-water text').count(), 0);
    await photograph('atlas-overview');

    const id = mobile ? 'USA' : 'DEU';
    const city = mobile ? [-77.03, 38.9] : [13.405, 52.52];
    const position = await mapCoordinate(city);
    assert.ok(position, `${device}: atlas city within viewport`);
    const marker = svg.locator(`.map-capital[data-capital-country="${id}"][data-visible] rect`);
    const measure = () => marker.evaluate(el => el.getBoundingClientRect().width);
    if (await marker.count()) assert.equal(await measure(), 6);

    const pending = page.waitForRequest('**/map-detail.topojson');
    await zoomAt(position, -900);
    await pending;
    await page.waitForTimeout(240);
    assert.equal(requests, 1);
    assert.equal(await svg.getAttribute('data-map-detail'), 'overview');
    const zoomed = await camera.getAttribute('transform');
    assert.notEqual(zoomed, origin);
    release();
    await page.waitForFunction(() => document.querySelector('.world-map').dataset.mapDetail === 'detail');
    await page.locator('.world-raster[data-raster-level="detail"]').waitFor();
    assert.equal(await camera.getAttribute('transform'), zoomed);
    assert.equal(await page.locator('.world-raster-fade').last().evaluate(el => getComputedStyle(el).animationDuration), '0.2s');
    assert.equal(await svg.getAttribute('data-minor-rivers'), null);
    assert.equal(await page.locator('.world-raster').getAttribute('data-raster-minor'), null);
    assert.equal(await svg.locator('.world-map-controls [data-country-id="DEU"][tabindex="0"]').count(), 1);
    await marker.waitFor();
    assert.equal(await measure(), 6);
    const cityLabel = svg.locator(`.map-capital[data-capital-country="${id}"][data-visible] text[data-visible]`);
    await cityLabel.waitFor();
    assert.equal(await cityLabel.evaluate(el => getComputedStyle(el).fontSize), '11px');
    const labels = await svg.locator('.map-capital[data-visible] text[data-visible]').evaluateAll(nodes =>
      nodes.map(node => node.getBoundingClientRect().toJSON()));
    for (const [index, a] of labels.entries()) {
      assert.ok(!labels.slice(index + 1).some(b => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom));
    }
    await page.waitForTimeout(220);
    await photograph('atlas-detail');

    await zoomAt(position, -630);
    await page.waitForFunction(() => document.querySelector('.world-map').hasAttribute('data-minor-rivers'));
    await page.locator('.world-raster[data-raster-minor]').waitFor();
    await page.locator('.world-raster[data-raster-water] .world-raster-base').last().waitFor({ state: 'visible' });
    assert.equal(await measure(), 6);
    await photograph('atlas-minor-rivers');

    await zoomAt(position, 2500);
    await page.waitForFunction(() => document.querySelector('.world-map').dataset.mapDetail === 'overview');
    await zoomAt(position, -900);
    await page.waitForFunction(() => document.querySelector('.world-map').dataset.mapDetail === 'detail');
    assert.equal(requests, 1);
    await input(page.getByRole('button', { name: 'Menü öffnen' }));
    await settledMenu();
    await choose('Einstellungen');
    const water = menu.getByRole('checkbox', { name: 'Seen und Flüsse' });
    assert.equal(await water.isChecked(), true);
    await input(water);
    await choose('Menü schließen');
    await menu.waitFor({ state: 'hidden' });
    await page.locator('.world-raster:not([data-raster-water])').waitFor();
    await photograph('water-off');

    await input(page.getByRole('button', { name: 'Menü öffnen' }));
    await settledMenu();
    await choose('Einstellungen');
    const toggle = menu.getByRole('checkbox', { name: 'Seen und Flüsse' });
    await input(toggle);
    await choose('Üben');
    await settledMenu();
    await choose('Hauptstädte auf der Karte');
    await menu.waitFor({ state: 'hidden' });
    assert.equal(await svg.locator('.atlas-capitals text').count(), 0);
    await page.locator('.point-stage .country-map[data-map-detail="detail"] .map-detail .map-lake').waitFor();
    await photograph('quiz-capital-water');
    const countryMap = page.locator('.point-stage .country-map');
    await countryMap.press('Enter');
    const line = countryMap.locator('.capital-line');
    assert.equal(await line.getAttribute('pathLength'), '1');
    const originalTransform = await line.evaluate(async (path) => {
      while (Number.parseFloat(getComputedStyle(path).strokeDashoffset) >= 1 && !path.hasAttribute('data-complete')) {
        await new Promise(resolve => requestAnimationFrame(resolve));
      }
      const dash = Number.parseFloat(getComputedStyle(path).strokeDashoffset);
      if (dash <= 0 || dash >= 1) throw new Error('The distance line must be tracing when the test starts to zoom');
      const svg = path.ownerSVGElement;
      const { left, top, width, height } = svg.getBoundingClientRect();
      const before = path.parentElement.getAttribute('transform');
      svg.dispatchEvent(new WheelEvent('wheel', { clientX: left + width / 2, clientY: top + height / 2, deltaY: -280,
        bubbles: true, cancelable: true }));
      return before;
    });
    await line.locator('xpath=..').evaluate(async (scene, previous) => {
      while (scene.getAttribute('transform') === previous) await new Promise(resolve => requestAnimationFrame(resolve));
    }, originalTransform);
    assert.deepEqual(await line.evaluate(path => {
      const css = getComputedStyle(path);
      return [css.strokeDasharray, Number.parseFloat(css.strokeDashoffset), path.getTotalLength() > 0];
    }), ['none', 0, true]);
    await photograph('quiz-capital-complete-line');

    if (!mobile) {
      // This checks hit detection after the switch. The atlas checks the animated transition above.
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await input(page.getByRole('button', { name: 'Menü öffnen' }));
      await settledMenu();
      await choose('Üben');
      await settledMenu();
      await choose('Länder finden');
      await menu.waitFor({ state: 'hidden' });
      await page.getByRole('heading', { name: /Wo liegt Deutschland/ }).waitFor();
      const germany = [10.4, 51.2];
      const anchor = await mapCoordinate(germany);
      assert.ok(anchor);
      await zoomAt(anchor, -1250);
      await page.locator('.world-map[data-map-detail="detail"]').waitFor();
      const target = await mapCoordinate(germany);
      assert.ok(target);
      assert.equal(await svg.locator('.atlas-capitals text').count(), 0);
      assert.equal(await svg.getAttribute('data-canvas-map'), '');
      await page.mouse.click(target.x, target.y);
      assert.equal(await page.locator('.verdict-title').textContent(), 'Richtig.');
    }
    assert.deepEqual(errors, []);
    console.log(`${engine} ${device}: lazy map switch, camera, water levels, capitals, settings and quiz checked.`);
  } catch (error) {
    console.error(`${engine} ${device}:`, ...errors);
    await photograph('failure').catch(() => {});
    throw error;
  } finally {
    release();
    await page.close();
  }
}

try {
  await verify(false);
  await verify(true);
} finally {
  await browser.close();
}
