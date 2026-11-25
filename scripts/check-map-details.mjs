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
    assert.equal(await svg.locator('.map-overview .map-lake').count(), 3);
    assert.equal(await svg.locator('.map-overview .map-river').first().evaluate(el => getComputedStyle(el).strokeWidth), '0.6px');
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
    assert.equal(await camera.getAttribute('transform'), zoomed);
    assert.equal(await svg.locator('.map-detail').first().evaluate(el => getComputedStyle(el).transitionDuration), '0.2s');
    assert.equal(await svg.getAttribute('data-minor-rivers'), null);
    assert.ok(await svg.locator('.map-detail .map-river-minor').first().isHidden());
    const overviewPath = await svg.locator('.map-overview [data-country-id="DEU"]').first().getAttribute('d');
    const detailPath = await svg.locator('.map-detail [data-country-id="DEU"]').first().getAttribute('d');
    assert.ok(detailPath !== overviewPath && detailPath.length > overviewPath.length);
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
    await page.waitForTimeout(220);
    assert.ok(await svg.locator('.map-detail .map-river-minor').first().isVisible());
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
    assert.ok(await svg.locator('.map-detail .map-water').first().isHidden());
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

    if (!mobile) {
      await input(page.getByRole('button', { name: 'Menü öffnen' }));
      await settledMenu();
      await choose('Üben');
      await settledMenu();
      await choose('Länder finden');
      await menu.waitFor({ state: 'hidden' });
      await page.waitForTimeout(1450);
      const target = await mapCoordinate([10.4, 51.2]);
      assert.ok(target);
      await zoomAt(target, -1250);
      await page.waitForTimeout(270);
      assert.equal(await svg.getAttribute('data-map-detail'), 'detail');
      assert.equal(await svg.locator('.atlas-capitals text').count(), 0);
      const hit = await page.evaluate(({ x, y }) => {
        const country = document.elementFromPoint(x, y);
        return [country?.dataset.countryId, Boolean(country?.closest('.map-detail'))];
      }, target);
      assert.deepEqual(hit, ['DEU', true]);
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
