import { mkdir, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';

const engine = process.env.GEOQUIZ_BROWSER ?? 'chromium';
const { [engine]: type } = await import(process.env.PLAYWRIGHT_ENTRY ?? 'playwright');
const [label = 'after', url = 'http://127.0.0.1:4173/'] = process.argv.slice(2);
const folder = process.env.GEOQUIZ_TRACES ?? 'map-performance-traces';
const rounds = Number(process.env.GEOQUIZ_SAMPLES ?? 3);
const viewportSizes = {
  mobile: { width: 393, height: 852 },
  desktop: { width: 1366, height: 900 },
};

await mkdir(folder, { recursive: true });
const browser = await type.launch(process.env.GEOQUIZ_BROWSER_PATH ? { executablePath: process.env.GEOQUIZ_BROWSER_PATH } : {});
const results = [];
for (const [device, viewport] of Object.entries(viewportSizes)) {
  for (let run = 1; run <= rounds; run++) {
    const context = await browser.newContext({ viewport, isMobile: device === 'mobile', hasTouch: device === 'mobile' });
    try {
      const page = await context.newPage();
      const prefix = `${folder}/${label}-${engine}-${device}-${run}`;
      const cdp = engine === 'chromium' ? await context.newCDPSession(page) : undefined;
      const cpu = cdp && device === 'mobile' ? 4 : 1;
      await cdp?.send('Emulation.setCPUThrottlingRate', { rate: cpu });
      await page.goto(url);
      await page.locator('.world-map > g[transform]').waitFor({ state: 'attached' });
      await page.evaluate(() => document.fonts.ready);
      const map = page.locator('.world-map');
      await map.dispatchEvent('wheel', { deltaY: -1150, clientX: viewport.width * .42, clientY: viewport.height * .45 });
      await page.locator('.world-map[data-map-detail="detail"]').waitFor({ timeout: 35000 });
      if (process.env.GEOQUIZ_EXPECT_CANVAS === '1') {
        await page.locator('.world-raster[data-raster-level="detail"] .world-raster-base').last().waitFor({ timeout: 35000 });
      }
      await page.waitForTimeout(550);
      await context.tracing.start({ screenshots: false, snapshots: false, sources: false });
      if (cdp) {
        await cdp.send('Tracing.start', {
          categories: 'devtools.timeline,disabled-by-default-devtools.timeline.frame,blink.user_timing,v8,toplevel,cc',
          transferMode: 'ReturnAsStream',
        });
      }
      const phases = await page.evaluate(async () => {
        const phases = {};
        const svg = document.querySelector('.world-map');
        const x = innerWidth * .47, y = innerHeight * .48;
        const waitFrame = () => new Promise(resolve => requestAnimationFrame(resolve));
        const pause = (ms) => new Promise(resolve => setTimeout(resolve, ms));
        const mouse = (target, type, clientX, clientY, buttons) =>
          target.dispatchEvent(new MouseEvent(type, { view: window, bubbles: true, cancelable: true, clientX, clientY, buttons, button: 0 }));
        async function sample(name, duration, step, finish = () => {}) {
          let now = await waitFrame();
          const start = now;
          let last = now;
          const frames = [];
          performance.mark(`map-${name}-start`);
          while (now - start < duration) {
            step(now - start);
            now = await waitFrame();
            frames.push(now - last);
            last = now;
          }
          finish();
          performance.mark(`map-${name}-end`);
          phases[name] = frames;
          await pause(550);
        }

        mouse(svg, 'mousedown', x, y, 1);
        await sample('pan', 1150, (ms) => {
          mouse(window, 'mousemove', x + Math.sin(ms / 280) * 90, y + Math.sin(ms / 490) * 75, 1);
        }, () => mouse(window, 'mouseup', x, y, 0));

        let event = 0;
        await sample('zoom', 1250, (ms) => {
          if (event >= 12 || Math.floor(ms / 78) < event) return;
          svg.dispatchEvent(new WheelEvent('wheel', { clientX: x, clientY: y, deltaY: event < 6 ? -95 : 95,
            bubbles: true, cancelable: true }));
          event++;
        });

        await sample('flight', 1700, (ms) => {
          if (ms !== 0) return;
          const target = svg.querySelector('[data-country-id="DEU"][tabindex="0"]');
          if (!target) throw new Error('Germany must be keyboard-selectable');
          target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }));
        });
        return phases;
      });

      let trace;
      if (cdp) {
        const finished = new Promise(resolve => cdp.once('Tracing.tracingComplete', resolve));
        await cdp.send('Tracing.end');
        const { stream } = await finished;
        const chunks = [];
        for (;;) {
          const { data, eof, base64Encoded } = await cdp.send('IO.read', { handle: stream });
          chunks.push(Buffer.from(data, base64Encoded ? 'base64' : 'utf8'));
          if (eof) break;
        }
        await cdp.send('IO.close', { handle: stream });
        const raw = Buffer.concat(chunks);
        await writeFile(`${prefix}.chrome.json.gz`, gzipSync(raw));
        trace = JSON.parse(raw);
      }
      await context.tracing.stop({ path: `${prefix}.playwright.zip` });
      const row = { label, engine, device, cpu, run };
      for (const [name, frames] of Object.entries(phases)) {
        const sorted = [...frames].sort((a, b) => a - b);
        const round = n => Math.round(n * 10) / 10;
        row[name] = {
          fps: round(1000 * frames.length / frames.reduce((sum, time) => sum + time, 0)),
          p95: round(sorted[Math.ceil(sorted.length * .95) - 1]),
          max: round(sorted.at(-1)),
          over50: frames.filter(time => time > 50).length,
          ...(trace && summarizeTrace(trace.traceEvents, name)),
        };
      }
      console.log(JSON.stringify(row));
      results.push(row);
    } finally {
      await context.close();
    }
  }
}
await browser.close();
await writeFile(`${folder}/${label}-${engine}.json`, JSON.stringify(results, null, 2));

function summarizeTrace(events, phase) {
  const start = events.find(event => event.name === `map-${phase}-start` && event.cat?.includes('user_timing'));
  const end = events.find(event => event.name === `map-${phase}-end` && event.cat?.includes('user_timing'));
  if (!start || !end) throw new Error(`Missing Chromium timing marks for ${phase}`);
  const track = (events, names) => {
    const ranges = events.filter(event => event.ph === 'X' && names.includes(event.name) && event.dur > 0
      && event.ts < end.ts && event.ts + event.dur > start.ts)
      .map(event => [Math.max(event.ts, start.ts), Math.min(event.ts + event.dur, end.ts)]).sort((a, b) => a[0] - b[0]);
    const merged = [];
    for (const [left, right] of ranges) {
      const last = merged.at(-1);
      if (last && left <= last[1]) last[1] = Math.max(last[1], right);
      else merged.push([left, right]);
    }
    return merged;
  };
  const main = events.filter(event => event.pid === start.pid && event.tid === start.tid);
  const layout = track(main, ['UpdateLayoutTree', 'Layout', 'UpdateLayer', 'InvalidateLayout']);
  const paint = track(main, ['Paint', 'PaintImage', 'PrePaint', 'Layerize', 'CompositeLayers', 'Commit']);
  const script = track(main, ['FunctionCall', 'EvaluateScript', 'v8.run', 'EventDispatch', 'TimerFire', 'FireAnimationFrame']);
  const total = ranges => ranges.reduce((sum, [left, right]) => sum + right - left, 0);
  const layoutPaint = [];
  for (const [a, b] of script) {
    for (const [c, d] of [...layout, ...paint]) {
      const left = Math.max(a, c), right = Math.min(b, d);
      if (left < right) layoutPaint.push([left, right]);
    }
  }
  const raster = events.filter(event => event.name === 'RasterTask' && event.ph === 'X')
    .reduce((sum, event) => sum + Math.max(0, Math.min(event.ts + event.dur, end.ts) - Math.max(event.ts, start.ts)), 0);
  return { scriptMs: Math.round(Math.max(0, total(script) - total(layoutPaint)) / 1000),
    layoutMs: Math.round(total(layout) / 1000), paintMs: Math.round(total(paint) / 1000), rasterMs: Math.round(raster / 1000) };
}
