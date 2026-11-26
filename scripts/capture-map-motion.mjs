import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

const engine = process.env.GEOQUIZ_BROWSER ?? 'chromium';
const { [engine]: type } = await import(process.env.PLAYWRIGHT_ENTRY ?? 'playwright');
const [url = 'http://127.0.0.1:4173/'] = process.argv.slice(2);
const folder = process.env.GEOQUIZ_TRACES ?? 'map-performance-traces';
await mkdir(folder, { recursive: true });
const browser = await type.launch({
  ...(process.env.GEOQUIZ_BROWSER_PATH && { executablePath: process.env.GEOQUIZ_BROWSER_PATH }),
  ...(engine === 'chromium' && process.env.GEOQUIZ_WEBGL_SOFTWARE === '1' && { args: ['--enable-unsafe-swiftshader'] }),
});
const results = [];
try {
  for (const [device, width, height, ratio] of [['mobile', 393, 852, 3], ['desktop', 1366, 900, 1]]) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: ratio, isMobile: device === 'mobile', hasTouch: device === 'mobile' });
    try {
      await page.goto(url);
      await page.evaluate(() => document.fonts.ready);
      const map = page.locator('.world-map');
      const scene = map.locator(':scope > g[transform]');
      const surface = page.locator('.world-raster');
      const original = await scene.getAttribute('transform');
      const germany = map.locator('[data-country-id="DEU"][tabindex="0"]');
      await germany.press('Enter');
      await page.locator('.atlas-sheet:not([hidden])').waitFor();
      await page.waitForFunction(initial => document.querySelector('.world-map > g[transform]').getAttribute('transform') !== initial, original);
      await page.locator('.world-map:not([data-map-moving])').waitFor();
      await page.getByRole('button', { name: 'Steckbrief schließen' }).click();
      const position = await scene.evaluate(group => {
        const width = Number(group.ownerSVGElement.querySelector('pattern').getAttribute('width'));
        const y = lat => -width / (2 * Math.PI) * 1.25 * Math.log(Math.tan(Math.PI / 4 + .4 * lat * Math.PI / 180));
        const center = new DOMPoint((10.4 + 180) / 360 * width, y(51.2) - y(85));
        for (const copy of [0, -1, 1]) {
          const point = new DOMPoint(center.x + copy * width, center.y).matrixTransform(group.getScreenCTM());
          if (point.x > 0 && point.x < innerWidth && point.y > 0 && point.y < innerHeight) return { x: point.x, y: point.y };
        }
        throw new Error('Germany is outside the viewport');
      });
      await map.dispatchEvent('wheel', { deltaY: -870, clientX: position.x, clientY: position.y });
      await surface.locator('.world-raster-base').last().waitFor();
      await page.locator('.world-raster[data-raster-level="detail"][data-raster-water]').waitFor();
      await page.locator('.world-map:not([data-map-moving])').waitFor();
      const deck = await surface.getAttribute('data-renderer') === 'deck';
      const label = deck ? page.locator('.world-raster[data-map-labels]:not([data-map-labels="0"])')
        : map.locator('.map-capital[data-capital-country="DEU"][data-visible] text[data-visible]').first();
      await label.waitFor();
      const prefix = `${folder}/motion-${engine}-${device}`;
      await page.screenshot({ path: `${prefix}-still.png` });

      for (const action of ['pan', 'zoom']) {
        const before = await surface.getAttribute('data-raster-frame');
        const previous = await scene.getAttribute('transform');
        const snapshot = await page.evaluate(async ({ action, before, previous, position }) => {
          const map = document.querySelector('.world-map');
          const layer = document.querySelector('.world-raster');
          const camera = map.querySelector(':scope > g[transform]');
          const wheel = (deltaY) => map.dispatchEvent(new WheelEvent('wheel', {
            clientX: position.x, clientY: position.y, deltaY, bubbles: true, cancelable: true,
          }));
          const mouse = (target, type, dx, buttons) => target.dispatchEvent(new MouseEvent(type, {
            view: window, bubbles: true, cancelable: true, clientX: position.x + dx, clientY: position.y, button: 0, buttons,
          }));
          let start = performance.now();
          let lastWheel = -100;
          let stopped = false;
          if (action === 'pan') mouse(map, 'mousedown', 0, 1);
          function move(now) {
            if (stopped) return;
            if (action === 'pan') mouse(window, 'mousemove', Math.sin((now - start) / 260) * 42, 1);
            else if (now - start - lastWheel >= 80) {
              wheel(Math.floor((now - start) / 480) % 2 ? 50 : -50);
              lastWheel = now - start;
            }
            requestAnimationFrame(move);
          }
          window.stopMapEvidence = () => {
            stopped = true;
            if (action === 'pan') mouse(window, 'mouseup', 0, 0);
          };
          requestAnimationFrame(move);
          while (performance.now() - start < 6500) {
            await new Promise(resolve => requestAnimationFrame(resolve));
            const canvas = layer.querySelector('.world-raster-base:last-child');
            const labels = Number(layer.getAttribute('data-map-labels'))
              || document.querySelectorAll('.map-capital[data-visible] text[data-visible]').length;
            if (!map.hasAttribute('data-map-moving') || (action === 'zoom' && layer.hasAttribute('data-raster-bridge'))
              || !layer.hasAttribute('data-raster-water') || !labels
              || layer.getAttribute('data-raster-frame') === before || camera.getAttribute('transform') === previous
              || !canvas) continue;
            const cssWidth = canvas.style.width.endsWith('px') ? parseFloat(canvas.style.width) : canvas.clientWidth;
            return { frame: layer.getAttribute('data-raster-frame'), labels, canvasDpr: canvas.width / cssWidth };
          }
          throw new Error('No sharp frame with labels was presented during map motion');
        }, { action, before, previous, position });
        assert.ok(Math.abs(snapshot.canvasDpr - ratio) < .01);
        await page.screenshot({ path: `${prefix}-${action}.png` });
        assert.equal(await map.getAttribute('data-map-moving'), '');
        assert.ok(await label.isVisible());
        await page.evaluate(() => window.stopMapEvidence());
        await page.locator('.world-map:not([data-map-moving])').waitFor();
        results.push({ engine, device, action, ...snapshot });
      }
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
}
await writeFile(`${folder}/motion-${engine}.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results));
