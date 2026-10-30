/**
 * 生成样张：本地引擎 → pptx，用于自测导出链路与视觉校验。
 * 用法：node tools/build-demo.js [主题id] [输出路径]
 */
const fs = require('fs');
const path = require('path');
const C = require('../assets/js/core.js');
const L = require('../assets/js/layouts.js');
const R = require('../assets/js/render-pptx.js');
const G = require('../assets/js/generator.js');
const loadPptx = require('./load-pptxgen.js');

const PptxGenJS = loadPptx(path.join(__dirname, '..', 'assets/vendor/pptxgenjs/pptxgen.bundle.js'));

async function main() {
  const themeId = process.argv[2] || 'minimal';
  const out = process.argv[3] || path.join(__dirname, '..', 'demo-' + themeId + '.pptx');
  const theme = C.themeById(themeId);
  const font = C.fontById('yahei');

  const deck = G.localOutline({
    topic: 'AI 如何重塑企业知识生产',
    audience: '业务负责人',
    scene: '内部汇报',
    pages: 14
  });

  const pptx = R.build(PptxGenJS, deck.slides, theme, font.ppt, { title: deck.title }, {
    render: (slide, i) => L.render(slide, theme, { page: i + 1, total: deck.slides.length })
  });
  const buf = await pptx.write({ outputType: 'arraybuffer' });
  fs.writeFileSync(out, Buffer.from(buf));
  console.log('OK ->', out, 'slides=' + deck.slides.length);
}

main().catch(e => { console.error('FAIL', e && e.stack || e); process.exit(1); });
