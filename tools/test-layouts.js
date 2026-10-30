/**
 * 版式与生成的边界测试：极端内容不应抛错，也不应产生越界节点。
 * 用法：node tools/test-layouts.js
 */
const C = require('../assets/js/core.js');
const L = require('../assets/js/layouts.js');
const G = require('../assets/js/generator.js');

const W = C.SLIDE_W, H = C.SLIDE_H;
let failures = 0;

function assert(cond, msg) {
  if (!cond) { failures++; console.log('  ✗ ' + msg); }
}

function bounds(nodes, label) {
  nodes.forEach((n, i) => {
    assert(typeof n.x === 'number' && !isNaN(n.x), `${label}#${i} x 非法`);
    assert(typeof n.w === 'number' && n.w > 0, `${label}#${i} w 非法`);
    // 允许装饰图形超出边界，但文字必须在画布内
    if (n.t === 'text') {
      assert(n.x >= -0.2 && n.x + n.w <= W + 0.2, `${label}#${i} 文字越界 x=${n.x.toFixed(2)} w=${n.w.toFixed(2)}`);
      assert(n.y >= -0.2 && n.y + n.h <= H + 0.2, `${label}#${i} 文字越界 y=${n.y.toFixed(2)} h=${n.h.toFixed(2)}`);
      if (n.paras) {
        n.paras.forEach(p => p.runs.forEach(r => {
          assert(r.size >= 8 && r.size <= 200, `${label}#${i} 字号异常 ${r.size}`);
        }));
      }
    }
  });
}

const LONG = '这是一段刻意写得很长的文字，用来验证自动缩字号与换行是否会把版面撑破，同时检查末行是否会只剩一个标点符号。'.repeat(3);

const cases = {
  cover: [
    { type: 'cover', title: '短标题' },
    { type: 'cover', title: LONG.slice(0, 60), subtitle: LONG.slice(0, 60), kicker: 'KICKER', meta: 'META' },
    { type: 'cover' }
  ],
  toc: [
    { type: 'toc', title: '目录', items: [] },
    { type: 'toc', title: '目录', items: ['一', '二', '三', '四', '五', '六', '七', '八'] }
  ],
  section: [{ type: 'section', index: '01', title: LONG.slice(0, 40) }, { type: 'section', title: '无编号' }],
  bullets: [
    { type: 'bullets', title: '空要点', items: [] },
    { type: 'bullets', title: '六条', lead: LONG.slice(0, 40), items: Array.from({ length: 6 }, (_, i) => ({ head: '要点' + i, text: LONG.slice(0, 50) })) },
    { type: 'bullets', title: '只有正文', items: [{ text: LONG.slice(0, 80) }, { text: '短句' }] },
    { type: 'bullets', title: '只有小标题', items: [{ head: '一' }, { head: '二' }] }
  ],
  twoCol: [
    { type: 'twoCol', title: '空', columns: [] },
    { type: 'twoCol', title: '满', columns: [{ title: '左', items: ['a', 'b', 'c', 'd', 'e'] }, { title: '右', items: [LONG.slice(0, 40)] }] }
  ],
  stats: [
    { type: 'stats', title: '一个', items: [{ value: '1', label: 'x' }] },
    { type: 'stats', title: '四个', items: Array.from({ length: 4 }, (_, i) => ({ value: '10' + i + '%', label: '指标' + i, note: LONG.slice(0, 30) })) }
  ],
  timeline: [
    { type: 'timeline', title: '两步', items: [{ title: 'A', text: LONG.slice(0, 40) }, { title: 'B', text: 'x' }] },
    { type: 'timeline', title: '五步', items: Array.from({ length: 5 }, (_, i) => ({ title: '第' + (i + 1) + '步', text: LONG.slice(0, 36) })) }
  ],
  compare: [
    { type: 'compare', title: '空', left: {}, right: {} },
    { type: 'compare', title: '满', left: { title: '左', items: ['1', '2', '3', '4', '5'] }, right: { title: '右', items: [LONG.slice(0, 40)] } }
  ],
  quote: [{ type: 'quote', text: LONG.slice(0, 70) }, { type: 'quote', text: '短句', author: '某人' }],
  end: [{ type: 'end', title: '谢谢观看' }, { type: 'end', title: LONG.slice(0, 30), subtitle: LONG.slice(0, 40), meta: 'x' }]
};

console.log('版式边界测试');
Object.keys(cases).forEach(type => {
  cases[type].forEach((slide, idx) => {
    const label = `${type}[${idx}]`;
    let nodes;
    try {
      nodes = L.render(slide, C.themeById('minimal'), { page: 1, total: 3 });
    } catch (e) {
      failures++;
      console.log(`  ✗ ${label} 抛错：${e.message}`);
      return;
    }
    assert(Array.isArray(nodes) && nodes.length > 0, `${label} 没有节点`);
    bounds(nodes, label);
  });
});

console.log('本地引擎测试');
[8, 12, 16, 20].forEach(pages => {
  const deck = G.localOutline({ topic: '测试主题', pages });
  const n = deck.slides.length;
  assert(n >= pages - 4 && n <= pages + 3, `页数偏差过大：目标 ${pages}，实际 ${n}`);
  deck.slides.forEach((s, i) => {
    try {
      bounds(L.render(s, C.themeById('forest'), { page: i + 1, total: n }), `local-${pages}-${i}`);
    } catch (e) { failures++; console.log(`  ✗ local-${pages}-${i} 抛错 ${e.message}`); }
  });
});
console.log('  ✓ 本地引擎 ' + [8, 12, 16, 20].map(p => p + '页').join(' / '));

console.log('Markdown 转换测试');
const md = `# 2026 年度计划

## 回顾
- 收入：同比增长 32%
- 效率：人效提升 18%
- 组织：新增两个交付组

## 问题
- 交付周期偏长，平均 6 周
- 复用率低，重复造轮子

> 把重复的部分交给系统，把判断留给人。

## 目标
- 规模：进入华东前五
- 质量：续约率 90% 以上
`;
const deck2 = G.markdownToOutline(md);
assert(deck2.slides.length >= 5, 'md 页数不足：' + deck2.slides.length);
assert(deck2.slides[0].type === 'cover', 'md 首页应为封面');
assert(deck2.slides[0].title === '2026 年度计划', 'md 首个 H1 应作为标题，实际：' + deck2.slides[0].title);
assert(deck2.slides.some(s => s.type === 'quote'), 'md 应识别引用');
assert(deck2.slides.filter(s => s.type === 'bullets').length >= 3, 'md 内容页不足');
deck2.slides.forEach((s, i) => bounds(L.render(s, C.themeById('violet'), { page: i + 1, total: deck2.slides.length }), 'md-' + i));
console.log('  ✓ ' + deck2.slides.length + ' 页：' + deck2.slides.map(s => s.type).join(','));

console.log('异常 JSON 容错');
const bad = [
  '```json\n{"title":"t","slides":[{"type":"bullets","title":"a","items":["x","y"]}]}\n```',
  '{"title":"t","slides":[{"type":"unknown","title":"z"}]}',
  '{"title":"t","slides":[]}',
  '前缀说明文字 {"title":"t","slides":[{"type":"cover","title":"c"}]} 后缀'
];
bad.forEach((txt, i) => {
  try {
    const obj = G.extractJson(txt);
    const deck = G.normalize(obj);
    assert(deck.slides.length > 0, '容错 ' + i + ' 没页面');
  } catch (e) { failures++; console.log('  ✗ 容错 ' + i + ' 抛错：' + e.message); }
});
console.log('  ✓ 4 组容错输入通过');

console.log(failures === 0 ? '\n全部通过 ✅' : `\n失败 ${failures} 项 ❌`);
process.exit(failures === 0 ? 0 : 1);
