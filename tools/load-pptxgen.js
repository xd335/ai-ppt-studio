/**
 * 在 Node 中加载浏览器版 pptxgenjs 打包文件（该文件默认把 JSZip 挂到 window 上）。
 * 浏览器里直接 <script> 引入即可，这里只是为了让命令行验证跑起来。
 */
const fs = require('fs');
const vm = require('vm');

module.exports = function loadPptxGenJS(file) {
  const code = fs.readFileSync(file, 'utf8');
  const sandbox = {
    console,
    setTimeout, clearTimeout, setInterval, clearInterval, queueMicrotask,
    TextEncoder: global.TextEncoder,
    TextDecoder: global.TextDecoder,
    Blob: global.Blob,
    URL: global.URL,
    atob: global.atob,
    btoa: global.btoa,
    performance: global.performance
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: file });
  if (!sandbox.PptxGenJS) throw new Error('PptxGenJS 未能加载');
  return sandbox.PptxGenJS;
};
