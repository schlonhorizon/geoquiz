import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';

const engine = process.env.GEOQUIZ_BROWSER ?? 'webkit';
const { [engine]: type } = await import(process.env.PLAYWRIGHT_ENTRY ?? 'playwright');
const url = process.env.GEOQUIZ_PREVIEW ?? 'http://127.0.0.1:4173/';
const output = process.env.GEOQUIZ_BORDER_SCREENSHOTS ?? 'mobile-layout-screenshots/map-borders';
const data = 'dist/data/sets/world';
const entities = JSON.parse(await readFile(`${data}/entities.json`, 'utf8'));
const viewport = { width: 1366, height: 900 };
const cases = [
  ['01-usa-kanada', 'USA', [-109, 49], 13],
  ['02-alaska-kanada', 'USA', [-141, 64.7], 14],
  ['03-aegypten-sudan', 'EGY', [31, 22], 24],
  ['04-aegypten-libyen', 'EGY', [24.98, 27], 23],
  ['05-algerien-mali', 'DZA', [2.2, 20.8], 20],
  ['06-libyen-tschad', 'LBY', [20, 22.7], 22],
  ['07-saudi-arabien-jemen', 'SAU', [47.3, 17.5], 24],
  ['08-namibia-botswana', 'NAM', [20.55, -22.6], 24],
];

await mkdir(output, { recursive: true });
const browser = await type.launch(process.env.GEOQUIZ_BROWSER_PATH ? { executablePath: process.env.GEOQUIZ_BROWSER_PATH } : {});
const tiers = new Map();
for (const minZoom of [0, 3, 6, 12, 24]) {
  const name = minZoom ? 'map-detail.topojson' : 'map.topojson';
  const bytes = await readFile(`${data}/${name}.render-${minZoom}.json.gz`);
  tiers.set(minZoom, JSON.parse(gunzipSync(bytes).toString()).shapes);
}

async function verifyPath(page, id) {
  const actual = await page.evaluate(country => {
    const svg = document.querySelector('.world-map');
    const canvas = document.querySelector('.world-raster');
    const selector = `.map-country[data-country-id="${country}"][data-state="highlighted"]`;
    const paths = [...svg.querySelectorAll(selector)].map(path => path.getAttribute('d'));
    const ring = svg.querySelector('.map-marker-ring[data-country-id="MCO"]');
    return { svgTier: svg.dataset.mapTier, canvasTier: canvas.dataset.rasterTier, paths,
      marker: [Number(ring.getAttribute('cx')), Number(ring.getAttribute('cy'))] };
  }, id);
  assert.equal(actual.svgTier, actual.canvasTier);
  const tier = tiers.get(Number(actual.canvasTier));
  const expected = tier.filter(shape => shape.id === id).map(shape => shape.d).join('');
  assert.ok(expected.length);
  assert.equal(actual.paths.length, 3);
  for (const path of actual.paths) assert.equal(path, expected);
  const example = tier.filter(shape => shape.id === 'MCO').sort((a, b) => b.area - a.area)[0];
  assert.deepEqual(actual.marker, example.anchor);
  return Number(actual.canvasTier);
}

async function waitForCamera(page) {
  await page.waitForFunction(() => {
    const svg = document.querySelector('.world-map');
    const target = svg.__zoom;
    const matrix = svg.querySelector('.world-map-camera').getScreenCTM();
    const width = Number(svg.querySelector('pattern').getAttribute('width'));
    const center = (innerWidth / 2 - target.x) / target.k;
    const wrapped = ((center % width) + width) % width;
    const x = innerWidth / 2 - wrapped * target.k;
    return !svg.hasAttribute('data-map-moving') && Math.abs(matrix.a - target.k) < 1e-4
      && Math.abs(matrix.e - x) < .01 && Math.abs(matrix.f - target.y) < .01;
  });
}

async function centerMap(page, [longitude, latitude], scale) {
  await setScale(page, scale);
  const camera = page.locator('.world-map-camera');
  await camera.evaluate((group, point) => {
    const svg = group.ownerSVGElement;
    const width = Number(svg.querySelector('pattern').getAttribute('width'));
    const millerY = lat => -width / (2 * Math.PI) * 1.25 * Math.log(Math.tan(Math.PI / 4 + .4 * lat * Math.PI / 180));
    const [lon, lat] = point;
    const matrix = group.getScreenCTM();
    const rawX = (lon + 180) / 360 * width;
    const rawY = millerY(lat) - millerY(85);
    const centerX = innerWidth * .50, centerY = innerHeight * .47;
    const step = matrix.a * width;
    const screen = new DOMPoint(rawX, rawY).matrixTransform(matrix);
    const x = screen.x + Math.round((centerX - screen.x) / step) * step;
    const mouse = (target, type, clientX, clientY, buttons) => target.dispatchEvent(new MouseEvent(type, {
      view: window, bubbles: true, cancelable: true, clientX, clientY, buttons, button: 0,
    }));
    mouse(svg, 'mousedown', centerX, centerY, 1);
    mouse(window, 'mousemove', 2 * centerX - x, 2 * centerY - screen.y, 1);
    mouse(window, 'mouseup', 2 * centerX - x, 2 * centerY - screen.y, 0);
  }, [longitude, latitude]);
  await waitForCamera(page);
  const [dx, dy] = await camera.evaluate((group, [lon, lat]) => {
    const width = Number(group.ownerSVGElement.querySelector('pattern').getAttribute('width'));
    const y = degrees => -width / (2 * Math.PI) * 1.25 * Math.log(Math.tan(Math.PI / 4 + .4 * degrees * Math.PI / 180));
    const matrix = group.getScreenCTM();
    const screen = new DOMPoint((lon + 180) / 360 * width, y(lat) - y(85)).matrixTransform(matrix);
    const deltaX = screen.x - innerWidth * .5;
    const repeat = matrix.a * width;
    return [deltaX - Math.round(deltaX / repeat) * repeat, screen.y - innerHeight * .47];
  }, [longitude, latitude]);
  assert.ok(Math.abs(dx) < 1 && Math.abs(dy) < 1, `Border outside the screenshot center by ${dx}, ${dy} pixels`);
}

async function setScale(page, scale) {
  await waitForCamera(page);
  const camera = page.locator('.world-map-camera');
  await camera.evaluate((group, target) => {
    const current = group.getScreenCTM().a;
    group.ownerSVGElement.dispatchEvent(new WheelEvent('wheel', {
      clientX: innerWidth * .5, clientY: innerHeight * .47, deltaY: -Math.log2(target / current) / .002,
      cancelable: true, bubbles: true,
    }));
  }, scale);
  await waitForCamera(page);
}

const verified = [];
try {
  for (const [name, id, point, scale] of cases) {
    const page = await browser.newPage({ viewport, deviceScaleFactor: 2, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      await page.addInitScript(() => {
        Math.random = () => .999999;
        window.mapTierMismatches = [];
        const observe = new MutationObserver(() => {
          const svg = document.querySelector('.world-map[data-canvas-map]');
          const canvas = document.querySelector('.world-raster[data-raster-tier]');
          if (svg && canvas && svg.dataset.mapTier !== canvas.dataset.rasterTier) {
            window.mapTierMismatches.push([svg.dataset.mapTier, canvas.dataset.rasterTier]);
          }
        });
        observe.observe(document, { attributes: true, subtree: true, attributeFilter: ['data-map-tier', 'data-raster-tier'] });
      });
      await page.route('**/entities.json', route => route.fulfill({
        json: [entities.find(entity => entity.id === id), ...entities.filter(entity => entity.id !== id)],
      }));
      await page.goto(url);
      const raster = page.locator('.world-raster');
      await raster.locator('canvas').waitFor();
      const menu = page.getByRole('dialog', { name: 'GeoQuiz' });
      await page.getByRole('button', { name: 'Menü öffnen' }).click();
      await menu.getByRole('button', { name: 'Üben', exact: true }).click();
      await menu.getByRole('button', { name: 'Länder benennen', exact: true }).click();
      await menu.waitFor({ state: 'hidden' });
      await page.locator(`.map-country[data-country-id="${id}"][data-state="highlighted"]`).first().waitFor({ state: 'attached' });
      await centerMap(page, point, scale);
      await page.locator('.world-raster[data-raster-level="detail"]').waitFor();
      if (name === cases[0][0]) {
        // At the same highlighted border, check all actual worker handoffs, including zooming back.
        const unit = await page.evaluate(() => {
          const worldHeight = Number(document.querySelector('.world-map pattern').getAttribute('height'));
          const worldWidth = Number(document.querySelector('.world-map pattern').getAttribute('width'));
          return Math.max(innerWidth / worldWidth, innerHeight / worldHeight);
        });
        for (const minZoom of [0, 3, 6, 12, 24, 6]) {
          await setScale(page, unit * (minZoom === 0 ? 2 : minZoom === 24 ? 24.1 : minZoom + .4));
          await page.locator(`.world-raster[data-raster-tier="${minZoom}"]`).waitFor();
          assert.equal(await verifyPath(page, id), minZoom);
        }
        await centerMap(page, point, scale);
      }
      const tier = await verifyPath(page, id);
      assert.deepEqual(await page.evaluate(() => window.mapTierMismatches), []);
      assert.deepEqual(errors, []);
      await page.screenshot({ path: `${output}/${name}.png` });
      verified.push({ name, country: id, tier });
      console.log(`${engine}: ${name}, tier ${tier}, exact Canvas/SVG paths`);
    } catch (error) {
      await page.screenshot({ path: `${output}/${name}-failure.png` }).catch(() => {});
      throw error;
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
}
await writeFile(`${output}/verified.json`, JSON.stringify(verified, null, 2) + '\n');
