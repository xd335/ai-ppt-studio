/*!
 * AI PPT Studio - 排版内核
 * 幻灯片坐标一律使用英寸(in)，1in = 96px，导出与预览共用同一套几何，
 * 因此"所见即所得"。同时兼容浏览器全局与 Node 端（用于生成样张/自测）。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PPCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SLIDE_W = 13.333;
  var SLIDE_H = 7.5;
  var PX = 96; // 每英寸像素

  /* ------------------------------------------------------------------ 主题 */
  var THEMES = [
    {
      id: 'minimal',
      name: '极简白',
      desc: '干净、克制，适合汇报与方案',
      bg: '#FFFFFF', bgAlt: '#F4F6FA', ink: '#0F172A', body: '#495568',
      muted: '#94A3B8', accent: '#2563EB', accentSoft: '#E3ECFF', line: '#E4E9F2',
      sectionBg: '#1D4ED8', sectionInk: '#FFFFFF', dark: false
    },
    {
      id: 'midnight',
      name: '深空蓝',
      desc: '深色底，发布会与路演气质',
      bg: '#0B1220', bgAlt: '#152034', ink: '#F2F6FC', body: '#B9C6DA',
      muted: '#7A8AA0', accent: '#38BDF8', accentSoft: '#123043', line: '#22304A',
      sectionBg: '#12324C', sectionInk: '#F2F6FC', dark: true
    },
    {
      id: 'forest',
      name: '松林绿',
      desc: '稳重、专业，适合政企与规划',
      bg: '#FBFCFA', bgAlt: '#EEF4F0', ink: '#10241B', body: '#42594C',
      muted: '#85998C', accent: '#0F7B5F', accentSoft: '#DCEFE6', line: '#DCE7E0',
      sectionBg: '#0F7B5F', sectionInk: '#FFFFFF', dark: false
    },
    {
      id: 'sunset',
      name: '暖阳橙',
      desc: '有温度，适合培训与营销',
      bg: '#FFFDFB', bgAlt: '#FDF0E6', ink: '#2B1608', body: '#6B4B38',
      muted: '#A98B78', accent: '#DE5F1E', accentSoft: '#FBE2D2', line: '#F2E0D4',
      sectionBg: '#C74F14', sectionInk: '#FFFFFF', dark: false
    },
    {
      id: 'violet',
      name: '星云紫',
      desc: '年轻、有科技感，适合产品介绍',
      bg: '#FCFBFF', bgAlt: '#F2EEFE', ink: '#1B1233', body: '#54496E',
      muted: '#948AAE', accent: '#6D4AFF', accentSoft: '#E6DEFF', line: '#E8E3F7',
      sectionBg: '#5A34E0', sectionInk: '#FFFFFF', dark: false
    },
    {
      id: 'graphite',
      name: '石墨灰',
      desc: '中性高级，适合数据与咨询',
      bg: '#F7F7F8', bgAlt: '#ECEDEF', ink: '#121417', body: '#4C525C',
      muted: '#8A909A', accent: '#16181D', accentSoft: '#DDE0E5', line: '#DDDFE3',
      sectionBg: '#1B1E24', sectionInk: '#FFFFFF', dark: false
    }
  ];

  var FONTS = [
    { id: 'yahei', label: '微软雅黑', ppt: '微软雅黑', css: '"Microsoft YaHei","PingFang SC","Hiragino Sans GB",sans-serif' },
    { id: 'source', label: '思源黑体', ppt: '思源黑体 CN', css: '"Source Han Sans CN","Noto Sans SC","Microsoft YaHei",sans-serif' },
    { id: 'dengxian', label: '等线', ppt: '等线', css: '"DengXian","Microsoft YaHei",sans-serif' },
    { id: 'song', label: '宋体', ppt: '宋体', css: '"SimSun","Songti SC",serif' }
  ];

  function themeById(id) {
    for (var i = 0; i < THEMES.length; i++) if (THEMES[i].id === id) return THEMES[i];
    return THEMES[0];
  }
  function fontById(id) {
    for (var i = 0; i < FONTS.length; i++) if (FONTS[i].id === id) return FONTS[i];
    return FONTS[0];
  }

  /* ------------------------------------------------------------------ 颜色 */
  function rgb(hex) {
    var h = String(hex || '#000').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return {
      r: parseInt(h.slice(0, 2), 16) || 0,
      g: parseInt(h.slice(2, 4), 16) || 0,
      b: parseInt(h.slice(4, 6), 16) || 0
    };
  }
  function toHex(c) {
    var f = function (v) {
      v = Math.max(0, Math.min(255, Math.round(v)));
      return (v < 16 ? '0' : '') + v.toString(16);
    };
    return '#' + f(c.r) + f(c.g) + f(c.b);
  }
  /** 按比例混合两色，t=0 取 a，t=1 取 b */
  function mix(a, b, t) {
    var A = rgb(a), B = rgb(b);
    return toHex({ r: A.r + (B.r - A.r) * t, g: A.g + (B.g - A.g) * t, b: A.b + (B.b - A.b) * t });
  }
  function rgba(hex, alpha) {
    var c = rgb(hex);
    return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + alpha + ')';
  }
  /** pptx 需要不带 # 的十六进制；带透明度时由调用方单独处理 */
  function bare(hex) { return String(hex).replace('#', '').toUpperCase(); }

  /* -------------------------------------------------------------- 文本度量 */
  // 单字符宽度（以 em 为单位）的粗略估计。CJK 恰为 1em，拉丁字母按字宽分档。
  function emOf(ch) {
    var c = ch.codePointAt(0);
    if (c >= 0x2e80 && c <= 0x9fff) return 1.0;   // CJK 统一表意
    if (c >= 0x3000 && c <= 0x303f) return 1.0;   // CJK 标点
    if (c >= 0xff00 && c <= 0xffef) return 1.0;   // 全角
    if (c >= 0x1f300) return 1.0;                 // emoji
    if (ch === ' ') return 0.28;
    if ('iljtfrI.,;:!|/\\\'`()[]{}'.indexOf(ch) >= 0) return 0.30;
    if (ch >= 'A' && ch <= 'Z') return 0.67;
    if (ch >= '0' && ch <= '9') return 0.56;
    if (ch === '%') return 0.88;
    if (ch === 'm' || ch === 'w' || ch === 'M' || ch === 'W') return 0.85;
    return 0.53;
  }

  /** 估算一段文字在给定字号、给定宽度下会占几行 */
  function lineCount(text, sizePt, widthIn) {
    if (!text) return 1;
    var maxEm = (widthIn * 72) / sizePt;
    if (maxEm <= 1) return Math.max(1, Math.ceil(text.length));
    var lines = 0;
    var idx = 0;
    var chunks = String(text).split('\n');
    for (var k = 0; k < chunks.length; k++) {
      var s = chunks[k];
      if (!s.length) { lines += 1; continue; }
      var used = 0, n = 1;
      for (var i = 0; i < s.length; i++) {
        var w = emOf(s[i]);
        if (used + w > maxEm) { n++; used = w; }
        else used += w;
      }
      lines += n;
      idx += s.length;
    }
    return Math.max(1, lines);
  }

  /**
   * 计算一组段落的总高度（英寸）。段落结构见 layouts.js：
   * { runs:[{text,size,...}], align, lh, before, after }
   */
  function parasHeight(paras, widthIn) {
    var h = 0;
    for (var i = 0; i < paras.length; i++) {
      var p = paras[i];
      var size = paraSize(p);
      var lh = p.lh || 1.35;
      var text = paraText(p);
      var lines = lineCount(text, size, widthIn);
      h += (lines * size * lh) / 72 + (p.before || 0) / 72 + (p.after || 0) / 72;
    }
    return h;
  }

  function paraText(p) {
    var s = '';
    for (var i = 0; i < p.runs.length; i++) s += p.runs[i].text;
    return s;
  }
  function paraSize(p) {
    var m = 0;
    for (var i = 0; i < p.runs.length; i++) m = Math.max(m, p.runs[i].size || 0);
    return m || 14;
  }

  /**
   * 自动缩字号：把段落塞进 widthIn × heightIn 的盒子。
   * 逐级试缩（1 步 0.5pt），最多回到 minSize，返回新的段落数组。
   */
  function fitParas(paras, widthIn, heightIn, minSize) {
    minSize = minSize || 9;
    var guard = 0;
    var cur = cloneParas(paras);
    while (parasHeight(cur, widthIn) > heightIn && guard < 120) {
      var smallest = Infinity;
      for (var i = 0; i < cur.length; i++) {
        for (var j = 0; j < cur[i].runs.length; j++) smallest = Math.min(smallest, cur[i].runs[j].size);
      }
      if (smallest <= minSize) break;
      var k = smallest > 16 ? 0.94 : smallest > 12 ? 0.96 : 0.98;
      for (var a = 0; a < cur.length; a++) {
        for (var b = 0; b < cur[a].runs.length; b++) {
          cur[a].runs[b].size = Math.max(minSize, Math.round(cur[a].runs[b].size * k * 2) / 2);
        }
      }
      guard++;
    }
    return cur;
  }

  /** 字号缩到能在 maxLines 行内放下为止（避免末行只剩一个标点） */
  function fitLines(text, sizePt, widthIn, maxLines, minSize) {
    var s = sizePt;
    minSize = minSize || 12;
    while (s > minSize && lineCount(text, s, widthIn) > maxLines) s -= 0.5;
    return s;
  }

  function cloneParas(paras) {
    return paras.map(function (p) {
      return {
        align: p.align, lh: p.lh, before: p.before, after: p.after,
        runs: p.runs.map(function (r) {
          return { text: r.text, size: r.size, bold: r.bold, italic: r.italic, color: r.color, spacing: r.spacing };
        })
      };
    });
  }

  /* -------------------------------------------------------------- 构造助手 */
  /** 文本节点。opts: align/valign/lh/x/y/w/h */
  function T(x, y, w, h, paras, opts) {
    opts = opts || {};
    return {
      t: 'text', x: x, y: y, w: w, h: h,
      paras: paras,
      align: opts.align || 'left',
      valign: opts.valign || 'top',
      fit: opts.fit !== false,
      minSize: opts.minSize || 9
    };
  }
  /** 单段文本快捷构造 */
  function TXT(x, y, w, h, text, size, color, opts) {
    opts = opts || {};
    var p = {
      align: opts.align,
      lh: opts.lh,
      runs: [{ text: text, size: size, bold: !!opts.bold, italic: !!opts.italic, color: color, spacing: opts.spacing }]
    };
    return T(x, y, w, h, [p], opts);
  }
  function RECT(x, y, w, h, fill, opts) {
    opts = opts || {};
    return {
      t: 'rect', x: x, y: y, w: w, h: h,
      fill: fill || null,
      line: opts.line || null,
      lineW: opts.lineW || 0.75,
      radius: opts.radius || 0,
      fillAlpha: opts.fillAlpha
    };
  }
  function ELLIPSE(x, y, w, h, fill, opts) {
    opts = opts || {};
    return { t: 'ellipse', x: x, y: y, w: w, h: h, fill: fill || null, line: opts.line || null, fillAlpha: opts.fillAlpha };
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  return {
    SLIDE_W: SLIDE_W, SLIDE_H: SLIDE_H, PX: PX,
    THEMES: THEMES, FONTS: FONTS, themeById: themeById, fontById: fontById,
    rgb: rgb, mix: mix, rgba: rgba, bare: bare, toHex: toHex,
    emOf: emOf, lineCount: lineCount, parasHeight: parasHeight, paraSize: paraSize, paraText: paraText,
    fitParas: fitParas, fitLines: fitLines, cloneParas: cloneParas,
    T: T, TXT: TXT, RECT: RECT, ELLIPSE: ELLIPSE,
    pad2: pad2, uid: uid, clamp: clamp
  };
});
