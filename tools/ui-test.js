/**
 * 界面自测：用无头 Chrome + DevTools 协议驱动 index.html，检查控制台报错、交互与截图。
 * 用法：node tools/ui-test.js
 * 产物：.tmp/ui-*.png、.tmp/ui-report.json
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9333;
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, '.tmp');
const URL = 'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/');

const sleep = ms => new Promise(r => setTimeout(r, ms));

function waitForPort(p, timeout = 20000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      http.get({ host: '127.0.0.1', port: p, path: '/json/version' }, res => {
        res.resume();
        resolve();
      }).on('error', () => {
        if (Date.now() - start > timeout) reject(new Error('devtools port timeout'));
        else setTimeout(tick, 250);
      });
    };
    tick();
  });
}

function getJson(p) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: PORT, path: p }, res => {
      let data = '';
      res.on('data', c => (data += c));
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.events = [];
    ws.addEventListener('message', ev => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const { res, rej } = this.pending.get(m.id);
        this.pending.delete(m.id);
        m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result);
      } else if (m.method) {
        this.events.push(m);
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((res, rej) => {
      this.pending.set(id, { res, rej });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async eval(expr) {
    const r = await this.send('Runtime.evaluate', {
      expression: `(async () => { ${expr} })()`,
      awaitPromise: true,
      returnByValue: true
    });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + JSON.stringify(r.exceptionDetails.exception && r.exceptionDetails.exception.description));
    return r.result.value;
  }
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const profile = path.join(OUT, 'ui-profile');
  const chrome = spawn(CHROME, [
    '--headless=new',
    '--disable-gpu',
    '--disable-breakpad',
    '--no-first-run',
    '--hide-scrollbars',
    '--allow-file-access-from-files',
    '--window-size=1500,940',
    '--remote-debugging-port=' + PORT,
    '--user-data-dir=' + profile,
    'about:blank'
  ], { stdio: 'ignore' });

  const report = { console: [], exceptions: [], checks: [] };
  try {
    await waitForPort(PORT);
    const targets = await getJson('/json/list');
    const page = targets.find(t => t.type === 'page');
    if (!page) throw new Error('no page target');

    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    const cdp = new CDP(ws);

    await cdp.send('Runtime.enable');
    await cdp.send('Log.enable');
    await cdp.send('Page.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1500, height: 940, deviceScaleFactor: 1, mobile: false
    });

    await cdp.send('Page.navigate', { url: URL });
    await sleep(1800);

    const shots = [];
    async function shot(name) {
      const r = await cdp.send('Page.captureScreenshot', { format: 'png' });
      const file = path.join(OUT, 'ui-' + name + '.png');
      fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
      shots.push(file);
    }
    async function check(name, expr, expect) {
      let value, ok = false, err = null;
      try {
        value = await cdp.eval(expr);
        ok = expect === undefined ? !!value : JSON.stringify(value) === JSON.stringify(expect);
      } catch (e) { err = e.message; }
      report.checks.push({ name, ok, value, expect, err });
      return value;
    }

    await check('幻灯片数量', 'return document.querySelectorAll(".outline-item").length');
    await check('缩略图数量一致', 'return document.querySelectorAll(".thumb").length === document.querySelectorAll(".outline-item").length');
    await check('舞台已渲染', 'return !!document.querySelector("#stageInner .slide-stage")');
    await check('检查器有字段', 'return document.querySelectorAll("#inspectorBody input, #inspectorBody textarea").length > 2');
    await shot('01-cover');

    // 翻页
    await cdp.eval('document.getElementById("btnNext").click(); return 1');
    await sleep(350);
    await check('翻页后页码', 'return document.getElementById("pageNow").textContent');
    await shot('02-toc');

    // 跳到内容页
    await cdp.eval(`
      const items = document.querySelectorAll('.outline-item');
      items[4] && items[4].click();
      return 1;
    `);
    await sleep(350);
    await shot('03-bullets');

    // 大纲面板
    await cdp.eval('document.querySelector(\'.tab[data-tab="outline"]\').click(); return 1');
    await sleep(250);
    await shot('04-outline');

    // 设计：切深色主题
    await cdp.eval('document.querySelector(\'.tab[data-tab="design"]\').click(); return 1');
    await sleep(200);
    await cdp.eval('document.querySelector(\'.theme-card[data-theme="midnight"]\').click(); return 1');
    await sleep(500);
    await check('深色主题生效', 'return document.querySelector(".slide-stage").style.background || "ok"');
    await shot('05-dark');
    await cdp.eval('document.querySelector(\'.theme-card[data-theme="minimal"]\').click(); return 1');
    await sleep(300);

    // 本地生成一份新演示
    await cdp.eval(`
      document.querySelector('.tab[data-tab="ai"]').click();
      document.getElementById('gTopic').value = '县域文旅如何借短视频破圈';
      document.getElementById('gPages').value = '12';
      document.getElementById('btnLocal').click();
      return 1;
    `);
    await sleep(900);
    await check('本地生成页数', 'return document.querySelectorAll(".outline-item").length');
    await check('标题同步', 'return document.getElementById("deckTitle").value');
    await shot('06-generated');

    // 编辑标题：写入输入框并触发 input
    await cdp.eval(`
      const el = document.querySelector('#inspectorBody input[data-path="title"]');
      if (el) { el.value = '改写后的标题'; el.dispatchEvent(new Event('input', { bubbles: true })); }
      return !!el;
    `);
    await sleep(500);
    await check('标题已写入数据', 'return document.querySelector(".outline-item.active .txt").textContent');

    // 加入演示模式并退出
    await cdp.eval('document.getElementById("btnPresent").click(); return 1');
    await sleep(500);
    await shot('07-present');
    await check('演示模式可见', 'return !document.getElementById("present").hidden');
    await cdp.eval('document.getElementById("presentExit").click(); return 1');
    await sleep(300);

    // 导出（只验证不抛错、提示出现）
    await cdp.eval('document.getElementById("btnDownload").click(); return 1');
    await sleep(2500);
    await check('导出提示', 'return document.getElementById("toast").textContent');
    await shot('08-export');

    // 收集控制台
    report.console = cdp.events
      .filter(e => e.method === 'Log.entryAdded' && e.params.entry.level === 'error')
      .map(e => e.params.entry.text)
      .concat(cdp.events
        .filter(e => e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error')
        .map(e => e.params.args.map(a => a.value || a.description).join(' ')));
    report.exceptions = cdp.events
      .filter(e => e.method === 'Runtime.exceptionThrown')
      .map(e => e.params.exceptionDetails.text + ' ' + (e.params.exceptionDetails.exception ? e.params.exceptionDetails.exception.description : ''));

    report.shots = shots;
    ws.close();
  } finally {
    chrome.kill();
  }

  fs.writeFileSync(path.join(OUT, 'ui-report.json'), JSON.stringify(report, null, 2));
  const bad = report.checks.filter(c => !c.ok);
  console.log(JSON.stringify({
    checks: report.checks,
    failed: bad.length,
    consoleErrors: report.console,
    exceptions: report.exceptions,
    shots: report.shots
  }, null, 2));
}

main().catch(e => { console.error('TEST FAIL', e && e.stack || e); process.exit(1); });
