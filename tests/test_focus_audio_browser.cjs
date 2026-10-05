/* Actual staged demo audio QA. Does not replace playback or simulate completion.
 * Required: HZN_DEMO_ROOT (parent containing try/, or try/ itself),
 *           HZN_CHROMIUM_EXECUTABLE (installed Chromium binary).
 * Optional: HZN_QA_OUTPUT (report folder; defaults to focus-audio-browser-results).
 * HZN_AUDIO_EDGE_ONLY=1 runs only delayed-boot and failed-audio/retry cases.
 * Requires Playwright available to Node, for example via NODE_PATH.
 * Starts an HTTP server on a dynamic loopback port in this same process.
 */
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const location = process.env.HZN_DEMO_ROOT;
const executablePath = process.env.HZN_CHROMIUM_EXECUTABLE;
if (!location || !executablePath) {
  throw new Error('Set HZN_DEMO_ROOT and HZN_CHROMIUM_EXECUTABLE to the staged demo and installed Chromium.');
}
const resolved = path.resolve(location);
const folder = path.basename(resolved) === 'try' ? path.dirname(resolved) : resolved;
assert.ok(fs.existsSync(path.join(folder, 'try/index.html')), 'HZN_DEMO_ROOT must contain try/index.html');
const output = path.resolve(process.env.HZN_QA_OUTPUT || 'focus-audio-browser-results');
fs.mkdirSync(output, { recursive: true });
const report = { scope: 'Actual staged demo recordings; native Chromium playback, no simulated ended events', tests: [], errors: [], requests: [], startedAt: new Date().toISOString() };
const mime = { '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.webp': 'image/webp', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    let file = path.resolve(folder, '.' + pathname);
    if (file !== folder && !file.startsWith(folder + path.sep)) {
      res.writeHead(403); return res.end();
    }
    if (fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    const buffer = fs.readFileSync(file);
    res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
    res.setHeader('Accept-Ranges', 'bytes');
    if (req.headers.range) {
      const match = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range);
      if (match) {
        const start = Number(match[1]);
        const end = match[2] ? Math.min(Number(match[2]), buffer.length - 1) : buffer.length - 1;
        if (start > end || start >= buffer.length) {
          res.writeHead(416, { 'Content-Range': `bytes */${buffer.length}` }); return res.end();
        }
        res.writeHead(206, { 'Content-Range': `bytes ${start}-${end}/${buffer.length}`, 'Content-Length': end - start + 1 });
        return res.end(buffer.subarray(start, end + 1));
      }
    }
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);
  } catch {
    res.writeHead(404); res.end('Missing');
  }
});
let browser, page;
const edgeOnly = process.env.HZN_AUDIO_EDGE_ONLY === '1';
let delayedSources = 0, injectedFailures = 0, failNextAudio = false;

(async () => {
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  browser = await chromium.launch({ executablePath, args: ['--single-process', '--no-zygote'], headless: true });
  page = await browser.newPage({ viewport: { width: 1366, height: 620 } });
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('response', response => {
    if (/\.(mp3|wav)(?:\?|$)/.test(response.url())) {
      report.requests.push({ path: new URL(response.url()).pathname, status: response.status() });
    }
  });
  await page.addInitScript(() => {
    window.__audioQa = { plays: [], pauses: [], events: [], elements: [] };
    const nativePlay = HTMLMediaElement.prototype.play;
    const nativePause = HTMLMediaElement.prototype.pause;
    const audioPath = value => value ? new URL(value, location.href).pathname : '';
    HTMLMediaElement.prototype.play = function () {
      const qa = window.__audioQa;
      if (!qa.elements.includes(this)) {
        qa.elements.push(this);
        for (const type of ['playing', 'ended', 'pause', 'error', 'loadedmetadata']) {
          this.addEventListener(type, () => qa.events.push({
            type, src: audioPath(this.currentSrc), time: this.currentTime, duration: this.duration,
            error: this.error?.code, at: performance.now()
          }));
        }
      }
      qa.plays.push({ src: audioPath(this.src), at: performance.now() });
      return nativePlay.call(this);
    };
    HTMLMediaElement.prototype.pause = function () {
      window.__audioQa.pauses.push({ src: audioPath(this.src), time: this.currentTime, at: performance.now() });
      return nativePause.call(this);
    };
  });
  if (edgeOnly) await page.route('**/*', async route => {
    const pathname = new URL(route.request().url()).pathname;
    if (/\/(workbook-data|workbook)\.js$/.test(pathname)) {
      delayedSources++; await new Promise(resolve => setTimeout(resolve, 300));
    }
    if (failNextAudio && /\.(mp3|wav)$/.test(pathname)) {
      failNextAudio = false; injectedFailures++;
      return route.fulfill({ status: 503, contentType: 'audio/mpeg', body: '' });
    }
    await route.continue();
  });
  const bootStarted = Date.now();
  await page.goto(`http://127.0.0.1:${server.address().port}/try/?lang=ar`);
  await page.waitForFunction(() => window.HORIZONS_BOOT?.ready);
  const bootElapsedMs = Date.now() - bootStarted;
  await page.locator('#course-nav [data-course="catalog"]').click();
  await page.locator('[data-chapter="baa"]').click();

  const snapshot = () => page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('horizons-arabic-level1|demo|1'));
    return {
      heard: state.heard, attempts: state.attempts, word: state.word, quiz: state.quiz, tab: state.tab,
      progress: document.querySelector('#progress-label').textContent,
      progressWidth: document.querySelector('#progress-bar').style.width,
      plays: window.__audioQa.plays.length,
      ended: window.__audioQa.events.filter(event => event.type === 'ended').length,
      active: window.__audioQa.elements.map(element => ({ paused: element.paused, time: element.currentTime, duration: element.duration })),
      feedback: document.querySelector('.feedback')?.textContent,
      selected: document.querySelector('[data-answer].correct')?.getAttribute('data-answer')
    };
  });
  const same = (before, after, keys) => keys.forEach(key => assert.deepEqual(after[key], before[key], key + ' changed'));
  const passed = (name, detail) => { report.tests.push({ name, status: 'pass', ...detail }); console.log(name + ': PASS'); };
  const playing = () => page.waitForFunction(() => window.__audioQa.elements.some(element => !element.paused && element.currentTime > 0));
  const unchanged = ['heard', 'attempts', 'word', 'quiz', 'tab', 'progress', 'progressWidth', 'plays', 'ended'];

  if (edgeOnly) {
    assert.equal(delayedSources, 2, 'Expected both essential workbook source/data scripts to be delayed');
    assert.ok(bootElapsedMs >= 300);
    assert.equal(report.errors.length, 0);
    passed('delayed-initial-source-and-data-eventually-ready', { delayedSources, injectedDelayMs: 300, bootElapsedMs });

    const button = page.locator('[data-audio^="word."]').first();
    const key = await button.getAttribute('data-audio');
    const beforeFailure = await snapshot();
    assert.equal(key, 'word.baa-01');
    assert.ok(!beforeFailure.heard[key]);
    failNextAudio = true;
    await button.click();
    await page.waitForFunction(() => {
      const toast = document.querySelector('#toast');
      return toast && !toast.hidden && toast.textContent.trim() && window.__audioQa.events.some(event => event.type === 'error');
    }, null, { timeout: 10000 });
    const afterFailure = await snapshot();
    const errorText = await page.locator('#toast').innerText();
    assert.equal(injectedFailures, 1);
    assert.ok(errorText.trim(), 'Expected visible localized error');
    same(beforeFailure, afterFailure, ['heard', 'attempts', 'word', 'quiz', 'tab', 'progress', 'progressWidth', 'ended']);
    assert.equal(afterFailure.plays, beforeFailure.plays + 1);
    assert.equal(await button.getAttribute('aria-pressed'), 'false');
    assert.ok(afterFailure.active.every(audio => audio.paused));
    passed('failed-first-word-audio-shows-error-without-credit', { key, status: 503, errorText, before: beforeFailure, after: afterFailure });

    await button.click();
    await playing();
    await page.waitForFunction(audioKey => JSON.parse(localStorage.getItem('horizons-arabic-level1|demo|1')).heard[audioKey] === true, key, { timeout: 10000 });
    const afterRetry = await snapshot();
    assert.equal(afterRetry.plays, afterFailure.plays + 1, 'Retry must invoke exactly one new native play');
    assert.equal(afterRetry.ended, afterFailure.ended + 1, 'Retry must complete exactly once');
    assert.deepEqual(afterRetry.attempts, beforeFailure.attempts, 'Audio retry must not assess an answer');
    assert.equal(Object.keys(afterRetry.heard).filter(id => afterRetry.heard[id]).length, 1);
    assert.equal(injectedFailures, 1);
    assert.ok(report.requests.some(request => request.status === 503));
    assert.ok(report.requests.some(request => request.status === 200 || request.status === 206));
    assert.equal(report.errors.length, 0);
    await page.screenshot({ path: path.join(output, 'audio-retry-success.png') });
    passed('retry-same-word-completes-once-without-duplicate-handlers', { key, after: afterRetry });
    report.pass = true;
    return;
  }

  for (const kind of ['word', 'sentence']) {
    const selector = `[data-audio^="${kind}."]`;
    const key = await page.locator(selector).first().getAttribute('data-audio');
    const before = await snapshot();
    assert.ok(!before.heard[key]);
    await page.locator(selector).first().click();
    await playing();
    const during = await snapshot();
    assert.ok(!during.heard[key], 'Recording marked heard before native ended');
    await page.waitForFunction(audioKey => JSON.parse(localStorage.getItem('horizons-arabic-level1|demo|1')).heard[audioKey] === true, key, { timeout: 30000 });
    const after = await snapshot();
    assert.equal(after.ended, before.ended + 1);
    assert.equal(after.plays, before.plays + 1);
    assert.equal(await page.locator(selector).first().getAttribute('aria-pressed'), 'false');
    passed(kind + '-native-playback-and-completion', { key, before, during, after });
  }
  assert.equal((await snapshot()).progressWidth, '5%', 'One word plus its sentence should complete 1 of 20');

  await page.locator('#next').click();
  const interruptedKey = await page.locator('[data-audio^="sentence."]').getAttribute('data-audio');
  const beforeNav = await snapshot();
  await page.locator('[data-audio^="sentence."]').click();
  await playing();
  await page.locator('#next').click();
  const afterNav = await snapshot();
  assert.ok(afterNav.active.every(audio => audio.paused && audio.time === 0));
  assert.ok(!afterNav.heard[interruptedKey]);
  assert.equal(afterNav.ended, beforeNav.ended);
  passed('navigation-stops-incomplete-audio', { key: interruptedKey, before: beforeNav, after: afterNav });

  const beforeIdle = await snapshot();
  await page.locator('#settings-button').click();
  await page.locator('#close-settings').click();
  const afterIdle = await snapshot();
  same(beforeIdle, afterIdle, unchanged);
  passed('idle-settings-no-audio-or-progress', { before: beforeIdle, after: afterIdle });

  const activeKey = await page.locator('[data-audio^="sentence."]').getAttribute('data-audio');
  await page.locator('[data-audio^="sentence."]').click();
  await playing();
  const beforeSettings = await snapshot();
  await page.locator('#settings-button').click();
  const openedSettings = await snapshot();
  same(beforeSettings, openedSettings, unchanged);
  assert.ok(openedSettings.active.every(audio => audio.paused && audio.time === 0));
  await page.locator('#close-settings').click();
  same(beforeSettings, await snapshot(), unchanged);
  assert.ok(!(await snapshot()).heard[activeKey]);
  passed('active-settings-stop-prior-audio-without-new-playback', { key: activeKey, before: beforeSettings, after: openedSettings });

  await page.locator('#stages [data-tab="quiz"]').click();
  const endedBefore = (await snapshot()).ended;
  const quizKey = await page.locator('.quiz-audio [data-audio]').getAttribute('data-audio');
  await page.locator('.quiz-audio [data-audio]').click();
  await page.waitForFunction(count => window.__audioQa.events.filter(event => event.type === 'ended').length > count, endedBefore, { timeout: 30000 });
  const current = await snapshot();
  await page.locator(`[data-answer="${current.quiz}"]`).click();
  const quizBefore = await snapshot();
  assert.equal(quizBefore.selected, String(current.quiz));
  assert.ok(Object.values(quizBefore.attempts).some(attempt => attempt.completed && attempt.count === 1));
  await page.locator('#settings-button').click();
  await page.locator('#close-settings').click();
  const quizAfter = await snapshot();
  same(quizBefore, quizAfter, [...unchanged, 'selected', 'feedback']);
  passed('settings-preserve-completed-quiz-answer-and-score', { key: quizKey, before: quizBefore, after: quizAfter });

  assert.equal(report.errors.length, 0, 'Browser reported JavaScript errors');
  assert.ok(report.requests.length >= 4, 'Expected real audio HTTP requests');
  assert.ok(report.requests.every(request => request.status === 200 || request.status === 206), 'Audio HTTP response failed');
  report.pass = true;
})().catch(error => {
  report.pass = false;
  report.failure = error.stack;
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  if (page) {
    report.nativeAudio = await page.evaluate(() => ({
      plays: window.__audioQa?.plays, pauses: window.__audioQa?.pauses, events: window.__audioQa?.events
    })).catch(() => null);
  }
  report.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(output, 'demo-audio-results.json'), JSON.stringify(report, null, 2));
  await browser?.close();
  if (server.listening) await new Promise(resolve => server.close(resolve));
  console.log(JSON.stringify({ pass: report.pass, tests: report.tests.length, errors: report.errors, report: path.join(output, 'demo-audio-results.json') }));
});
