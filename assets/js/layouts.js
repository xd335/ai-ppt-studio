/*!
 * AI PPT Studio - 版式库
 * 每个版式函数返回一组绘制指令（rect / ellipse / text），单位英寸。
 * 预览与 PPTX 导出把它们翻译成各自的原语，因此同一份指令渲染出同一个版面。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./core.js'));
  else root.PPLayouts = factory(root.PPCore);
})(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';

  var W = C.SLIDE_W, H = C.SLIDE_H;
  var ML = 0.95;                    // 左右留白
  var CW = W - ML * 2;              // 内容宽度 11.433
  var BODY_TOP = 1.98;
  var BODY_BOTTOM = 6.62;

  var SLIDE_TYPES = [
    { id: 'cover', label: '封面' },
    { id: 'toc', label: '目录' },
    { id: 'section', label: '章节页' },
    { id: 'bullets', label: '要点页' },
    { id: 'twoCol', label: '双栏页' },
    { id: 'stats', label: '数据页' },
    { id: 'timeline', label: '流程页' },
    { id: 'compare', label: '对比页' },
    { id: 'quote', label: '金句页' },
    { id: 'end', label: '结束页' }
  ];
  function typeLabel(id) {
    for (var i = 0; i < SLIDE_TYPES.length; i++) if (SLIDE_TYPES[i].id === id) return SLIDE_TYPES[i].label;
    return '页面';
  }

  /* -------------------------------------------------------------- 公共构件 */
  function header(s, t, opts) {
    opts = opts || {};
    var nodes = [];
    nodes.push(C.RECT(ML, 0.63, 0.42, 0.075, t.accent, { radius: 0.04 }));
    var title = s.title || '未命名页面';
    nodes.push(C.TXT(ML, 0.79, CW - 0.4, 0.82, title, opts.titleSize || 26, t.ink, {
      bold: true, lh: 1.22, fit: true, minSize: 18
    }));
    return nodes;
  }
  function footer(s, t, page, total) {
    var nodes = [];
    if (s.brand !== false) {
      nodes.push(C.TXT(ML, 6.98, 5.2, 0.3, (s.confidential || ''), 9, t.muted, { lh: 1.2 }));
    }
    if (page) {
      nodes.push(C.TXT(W - ML - 1.6, 6.96, 1.6, 0.3,
        (page < 10 ? '0' : '') + page + (total ? ' / ' + total : ''), 9, t.muted,
        { align: 'right', lh: 1.2 }));
    }
    return nodes;
  }
  function fitNode(node, boxW, boxH, minSize) {
    if (node.fit) node.paras = C.fitParas(node.paras, boxW, boxH, minSize || node.minSize || 9);
    return node;
  }
  function runs(text, size, color, opts) {
    opts = opts || {};
    return { runs: [{ text: text, size: size, bold: !!opts.bold, italic: !!opts.italic, color: color, spacing: opts.spacing }], lh: opts.lh, align: opts.align };
  }

  /** 把若干高度在 avail 内均匀分布，返回每项的 {y,h}；整体垂直居中，但顶部留白有上限 */
  function stack(heights, avail, minGap, maxGap, maxTopPad) {
    var total = 0, i;
    for (i = 0; i < heights.length; i++) total += heights[i];
    var gap = heights.length > 1
      ? Math.min(maxGap, Math.max(minGap, (avail - total) / (heights.length - 1)))
      : 0;
    var used = total + gap * (heights.length - 1);
    var y = Math.min(Math.max(0, (avail - used) / 2), maxTopPad == null ? 999 : maxTopPad);
    var out = [];
    for (i = 0; i < heights.length; i++) {
      out.push({ y: y, h: heights[i] });
      y += heights[i] + gap;
    }
    return out;
  }

  /* ------------------------------------------------------------------ 封面 */
  function cover(s, t) {
    var n = [];
    n.push(C.RECT(0, 0, W, H, t.bg));
    // 右下装饰
    n.push(C.ELLIPSE(9.7, 3.15, 5.6, 5.6, C.mix(t.bg, t.accent, t.dark ? 0.16 : 0.07)));
    n.push(C.ELLIPSE(11.15, 4.85, 2.5, 2.5, C.mix(t.bg, t.accent, t.dark ? 0.34 : 0.16)));
    n.push(C.RECT(0, 0, W, 0.11, t.accent));

    var x = ML + 0.05;
    var titleText = s.title || '在这里写标题';
    var tsize = C.fitLines(titleText, 42, 9.7, 2, 25);
    var th = C.lineCount(titleText, tsize, 9.7) * tsize * 1.16 / 72;
    var hasKicker = !!(s.kicker && s.kicker.trim());
    var sub = (s.subtitle || '').trim();
    var subSize = C.fitLines(sub, 16.5, 8.6, 2, 11);
    var subH = Math.max(0.42, C.lineCount(sub, subSize, 8.6) * subSize * 1.55 / 72);

    // 整块内容垂直居中，随标题行数自适应
    var blockH = (hasKicker ? 0.34 + 0.30 : 0) + th + 0.20 + 0.075 + (sub ? 0.24 + subH : 0);
    var y = Math.max(1.05, 3.68 - blockH / 2);

    if (hasKicker) {
      n.push(C.TXT(x, y, 9.0, 0.34, s.kicker, 11.5, t.accent, { bold: true, spacing: 1.5, lh: 1.2 }));
      y += 0.34 + 0.30;
    }
    n.push(C.TXT(x, y, 9.7, th + 0.08, titleText, tsize, t.ink, {
      bold: true, lh: 1.16, fit: true, minSize: 24
    }));
    y += th + 0.20;
    n.push(C.RECT(x + 0.03, y, 1.45, 0.075, t.accent, { radius: 0.04 }));
    y += 0.075 + 0.24;

    if (sub) {
      n.push(C.T(x, y, 8.6, subH + 0.05, [runs(sub, subSize, t.body, { lh: 1.55 })], {}));
    }
    if (s.meta) {
      n.push(C.TXT(x, 6.42, 8.2, 0.35, s.meta, 10.5, t.muted, { lh: 1.2 }));
    }
    return n;
  }

  /* ------------------------------------------------------------------ 目录 */
  function toc(s, t, page, total) {
    var items = (s.items || []).filter(Boolean).slice(0, 8);
    var n = [];
    n.push(C.RECT(0, 0, W, H, t.bg));
    n = n.concat(header(s, t, { titleSize: 25 }));

    var two = items.length > 5;
    var rows = two ? Math.ceil(items.length / 2) : items.length;
    var colW = two ? (CW - 0.5) / 2 : CW;
    var top = 2.05;
    var rowH = Math.min(1.0, (BODY_BOTTOM - top) / Math.max(rows, 1));

    for (var i = 0; i < items.length; i++) {
      var col = two ? (i < rows ? 0 : 1) : 0;
      var row = two ? (i < rows ? i : i - rows) : i;
      var x = ML + col * (colW + 0.5);
      var y = top + row * rowH;
      n.push(C.TXT(x, y, 0.8, rowH, (i + 1 < 10 ? '0' : '') + (i + 1), 19, t.accent, {
        bold: true, lh: 1.2, valign: 'middle'
      }));
      var node = C.TXT(x + 0.82, y, colW - 0.95, rowH, items[i], 15.5, t.ink, {
        lh: 1.3, valign: 'middle', fit: true, minSize: 11
      });
      n.push(node);
      n.push(C.RECT(x, y + rowH - 0.015, colW - 0.1, 0.012, t.line));
    }
    n = n.concat(footer(s, t, page, total));
    return n;
  }

  /* ------------------------------------------------------------------ 章节 */
  function section(s, t) {
    var n = [];
    n.push(C.RECT(0, 0, W, H, t.sectionBg));
    var idx = s.index || '';
    if (idx) {
      n.push(C.TXT(7.6, 1.25, 4.9, 3.7, String(idx), 148, C.mix(t.sectionBg, t.sectionInk, 0.17), {
        bold: true, align: 'right', lh: 1.0, valign: 'middle'
      }));
    }
    var kicker = s.kicker || (idx ? 'PART ' + idx : '');
    if (kicker) {
      n.push(C.TXT(ML + 0.12, 2.18, 6.4, 0.36, kicker, 11.5, C.mix(t.sectionBg, t.sectionInk, 0.72), {
        bold: true, spacing: 2.4, lh: 1.2
      }));
    }
    n.push(C.TXT(ML + 0.12, 2.55, 8.1, 1.75, s.title || '', 33, t.sectionInk, {
      bold: true, lh: 1.28, valign: 'bottom', fit: true, minSize: 22
    }));
    n.push(C.RECT(ML + 0.14, 4.5, 1.25, 0.07, C.mix(t.sectionBg, t.sectionInk, 0.85), { radius: 0.04 }));
    return n;
  }

  /* ---------------------------------------------------------------- 要点页 */
  function bullets(s, t, page, total) {
    var n = [];
    n.push(C.RECT(0, 0, W, H, t.bg));
    n = n.concat(header(s, t));

    var hasLead = !!(s.lead && s.lead.trim());
    var top = hasLead ? 2.44 : 1.98;
    if (hasLead) {
      n.push(C.TXT(ML, 1.70, CW - 1.4, 0.62, s.lead, 13, t.body, { lh: 1.5, fit: true, minSize: 10.5 }));
    }

    var items = (s.items || []).filter(function (it) { return it && (it.head || it.text); }).slice(0, 6);
    if (!items.length) items = [{ head: '在这里写要点', text: '' }];

    var avail = BODY_BOTTOM - top;
    var textW = CW - 0.78;

    var rows = items.map(function (it) {
      var hasHead = !!(it.head && it.head.trim());
      var hasText = !!(it.text && it.text.trim());
      var headH = hasHead ? Math.min(0.66, C.lineCount(it.head, 16, textW) * 16 * 1.32 / 72) : 0;
      var textH = hasText ? C.parasHeight([runs(it.text, 12.6, t.body, { lh: 1.62 })], textW) : 0;
      return {
        it: it, hasHead: hasHead, hasText: hasText, headH: headH, textH: textH,
        h: (hasHead ? headH : 0) + (hasText ? 0.15 + textH : 0)
      };
    });

    var totalH = rows.reduce(function (a, r) { return a + r.h; }, 0);
    var gap = rows.length > 1 ? Math.min(0.92, Math.max(0.44, (avail - totalH) / (rows.length - 1))) : 0;
    var used = totalH + gap * (rows.length - 1);
    var y = top + Math.max(0, (avail - used) / 2);

    // 内容超出可用高度时按比例压缩每一项（字号由 fitParas 继续收缩）
    if (used > avail) {
      gap = 0.28;
      var room = Math.max(0.6, avail - gap * (rows.length - 1));
      var k = totalH > 0 ? Math.min(1, room / totalH) : 1;
      rows.forEach(function (r) {
        r.headH *= k;
        r.textH *= k;
        r.h *= k;
      });
      totalH = rows.reduce(function (a, r) { return a + r.h; }, 0);
      used = totalH + gap * (rows.length - 1);
      y = top;
    }

    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var it = r.it;
      n.push(C.RECT(ML, y + 0.02, 0.34, 0.34, t.accentSoft, { radius: 0.09 }));
      n.push(C.TXT(ML, y + 0.02, 0.34, 0.34, String(i + 1), 11.5, t.accent, {
        bold: true, align: 'center', valign: 'middle', lh: 1.0
      }));

      var gapHead = Math.min(0.15, r.h * 0.16);
      if (r.hasHead) {
        n.push(C.TXT(ML + 0.6, y, textW, Math.max(0.22, r.headH + 0.04), it.head, 16, t.ink, {
          bold: true, lh: 1.32, fit: true, minSize: 12
        }));
      }
      if (r.hasText) {
        var ty = y + (r.hasHead ? r.headH + gapHead : 0);
        var th = Math.max(0.2, r.h - (r.hasHead ? r.headH + gapHead : 0));
        var size = r.hasHead ? 12.6 : 14.5;
        n.push(C.T(ML + 0.6, ty, textW, th,
          C.fitParas([runs(it.text, size, t.body, { lh: 1.62 })], textW, th, 9.5), {}));
      }
      y += r.h + gap;
    }
    n = n.concat(footer(s, t, page, total));
    return n;
  }

  /* ---------------------------------------------------------------- 双栏页 */
  function twoCol(s, t, page, total) {
    var n = [];
    n.push(C.RECT(0, 0, W, H, t.bg));
    n = n.concat(header(s, t));

    var cols = (s.columns || []).slice(0, 2);
    while (cols.length < 2) cols.push({ title: '', items: [] });

    var gapX = 0.36;
    var cw = (CW - gapX) / 2;
    var iw = cw - 0.95;
    var FS = 15, LH = 1.55;
    var headZone = 0.92, bottomPad = 0.5, gapY = 0.42;
    var bodyH = BODY_BOTTOM - 1.98;

    var prepared = cols.map(function (c) {
      var items = (c.items || []).filter(Boolean).slice(0, 5);
      var hs = items.map(function (x) { return Math.max(0.42, C.parasHeight([runs(x, FS, t.body, { lh: LH })], iw)); });
      var need = headZone + hs.reduce(function (a, b) { return a + b; }, 0) + gapY * Math.max(0, items.length - 1) + bottomPad;
      return { c: c, items: items, hs: hs, need: need };
    });

    var cardH = Math.min(bodyH, Math.max.apply(null, prepared.map(function (p) { return p.need; })));
    cardH = Math.max(2.7, cardH);
    var top = 1.98 + (bodyH - cardH) / 2;

    for (var i = 0; i < 2; i++) {
      var p = prepared[i];
      var c = p.c;
      var x = ML + i * (cw + gapX);
      n.push(C.RECT(x, top, cw, cardH, t.bgAlt, { radius: 0.1 }));
      n.push(C.RECT(x, top, 0.055, cardH, i === 0 ? t.muted : t.accent, { radius: 0.03 }));
      if (c.title) {
        n.push(C.TXT(x + 0.38, top + 0.30, cw - 0.72, 0.46, c.title, 15.5, i === 0 ? t.ink : t.accent, {
          bold: true, lh: 1.2, fit: true, minSize: 12
        }));
      }
      var avail = cardH - headZone - bottomPad;
      var pos = stack(p.hs, avail, 0.30, 0.54, 0);
      var listTop = top + headZone;
      for (var j = 0; j < p.items.length; j++) {
        var y = listTop + pos[j].y;
        n.push(C.ELLIPSE(x + 0.40, y + 0.14, 0.1, 0.1, i === 0 ? t.muted : t.accent));
        n.push(C.T(x + 0.62, y, iw, pos[j].h,
          C.fitParas([runs(p.items[j], FS, t.body, { lh: LH })], iw, pos[j].h, 10), {}));
      }
    }
    n = n.concat(footer(s, t, page, total));
    return n;
  }

  /* ---------------------------------------------------------------- 数据页 */
  function stats(s, t, page, total) {
    var n = [];
    n.push(C.RECT(0, 0, W, H, t.bg));
    n = n.concat(header(s, t));

    var items = (s.items || []).slice(0, 4);
    if (!items.length) items = [{ value: '0', label: '指标', note: '' }];
    var count = items.length;
    var gap = 0.30;
    var iw = (CW - gap * (count - 1)) / count;
    var top = 2.42;

    for (var i = 0; i < count; i++) {
      var it = items[i];
      var x = ML + i * (iw + gap);
      if (i > 0) n.push(C.RECT(x - gap / 2, top, 0.012, 2.85, t.line));
      n.push(C.RECT(x, top, 0.62, 0.055, t.accent, { radius: 0.03 }));
      var vsize = count > 3 ? 38 : 46;
      n.push(C.TXT(x, top + 0.32, iw - 0.1, 1.05, String(it.value || ''), vsize, t.accent, {
        bold: true, lh: 1.1, fit: true, minSize: 22
      }));
      n.push(C.TXT(x, top + 1.42, iw - 0.1, 0.75, it.label || '', 13.5, t.ink, {
        bold: true, lh: 1.35, fit: true, minSize: 10.5
      }));
      if (it.note) {
        n.push(C.T(x, top + 2.2, iw - 0.15, 1.25,
          C.fitParas([runs(it.note, 11, t.muted, { lh: 1.55 })], iw - 0.15, 1.25, 8.5), {}));
      }
    }
    n = n.concat(footer(s, t, page, total));
    return n;
  }

  /* ---------------------------------------------------------------- 流程页 */
  function timeline(s, t, page, total) {
    var n = [];
    n.push(C.RECT(0, 0, W, H, t.bg));
    n = n.concat(header(s, t));

    var items = (s.items || []).slice(0, 5);
    if (!items.length) items = [{ title: '步骤一', text: '' }];
    var count = items.length;
    var colW = CW / count;
    var cy = 2.72;
    var r = 0.29;

    for (var i = 0; i < count - 1; i++) {
      var x1 = ML + colW * i + colW / 2 + r;
      var x2 = ML + colW * (i + 1) + colW / 2 - r;
      n.push(C.RECT(x1, cy + r - 0.014, x2 - x1, 0.028, t.line));
    }
    for (var k = 0; k < count; k++) {
      var it = items[k];
      var cx = ML + colW * k + colW / 2;
      n.push(C.ELLIPSE(cx - r, cy, r * 2, r * 2, t.accent));
      n.push(C.TXT(cx - r, cy, r * 2, r * 2, String(k + 1), 13, t.dark ? t.bg : '#FFFFFF', {
        bold: true, align: 'center', valign: 'middle', lh: 1.0
      }));
      n.push(C.TXT(cx - colW / 2 + 0.14, cy + r + 0.26, colW - 0.28, 0.5, it.title || '', 14, t.ink, {
        bold: true, align: 'center', lh: 1.3, fit: true, minSize: 11
      }));
      if (it.text) {
        n.push(C.T(cx - colW / 2 + 0.16, cy + r + 0.82, colW - 0.32, 2.1,
          C.fitParas([runs(it.text, 11.4, t.body, { lh: 1.6, align: 'center' })], colW - 0.32, 2.1, 8.5),
          { align: 'center' }));
      }
    }
    n = n.concat(footer(s, t, page, total));
    return n;
  }

  /* ---------------------------------------------------------------- 对比页 */
  function compare(s, t, page, total) {
    var n = [];
    n.push(C.RECT(0, 0, W, H, t.bg));
    n = n.concat(header(s, t));

    var gapX = 0.42;
    var cw = (CW - gapX) / 2;
    var iw = cw - 1.1;
    var FS = 14, LH = 1.55;
    var headZone = 0.98, bottomPad = 0.5, gapY = 0.42;
    var bodyH = BODY_BOTTOM - 1.98;

    var sides = [
      { d: s.left || {}, fill: t.bgAlt, head: t.ink, mark: t.muted, x: ML },
      { d: s.right || {}, fill: C.mix(t.bg, t.accentSoft, 0.85), head: t.accent, mark: t.accent, x: ML + cw + gapX }
    ];

    var prepared = sides.map(function (side) {
      var items = (side.d.items || []).filter(Boolean).slice(0, 5);
      var hs = items.map(function (x) { return Math.max(0.4, C.parasHeight([runs(x, FS, t.body, { lh: LH })], iw)); });
      var need = headZone + hs.reduce(function (a, b) { return a + b; }, 0) + gapY * Math.max(0, items.length - 1) + bottomPad;
      return { items: items, hs: hs, need: need };
    });

    var cardH = Math.min(bodyH, Math.max.apply(null, prepared.map(function (p) { return p.need; })));
    cardH = Math.max(2.7, cardH);
    var top = 1.98 + (bodyH - cardH) / 2;

    for (var i = 0; i < 2; i++) {
      var side = sides[i], p = prepared[i];
      n.push(C.RECT(side.x, top, cw, cardH, side.fill, { radius: 0.1 }));
      n.push(C.TXT(side.x + 0.4, top + 0.32, cw - 0.8, 0.48, side.d.title || '', 16, side.head, {
        bold: true, lh: 1.2, fit: true, minSize: 12
      }));
      var avail = cardH - headZone - bottomPad;
      var pos = stack(p.hs, avail, 0.30, 0.54, 0);
      var listTop = top + headZone;
      for (var j = 0; j < p.items.length; j++) {
        var y = listTop + pos[j].y;
        n.push(C.RECT(side.x + 0.42, y + 0.13, 0.115, 0.115, side.mark, { radius: 0.02 }));
        n.push(C.T(side.x + 0.68, y, iw, pos[j].h,
          C.fitParas([runs(p.items[j], FS, t.body, { lh: LH })], iw, pos[j].h, 10), {}));
      }
    }
    n = n.concat(footer(s, t, page, total));
    return n;
  }

  /* ---------------------------------------------------------------- 金句页 */
  function quote(s, t, page, total) {
    var n = [];
    n.push(C.RECT(0, 0, W, H, t.bg));
    n.push(C.TXT(0.85, -0.15, 3.0, 2.6, '“', 150, C.mix(t.bg, t.accent, t.dark ? 0.45 : 0.22), {
      bold: true, lh: 1.0
    }));
    var text = s.text || '';
    var boxW = 10.6, boxH = 2.7;
    // 先按宽度把字号收到最多两行，避免末行只剩标点
    var qsize = C.fitLines(text, 25, boxW, 2, 15);
    var paras = C.fitParas([runs(text, qsize, t.ink, { lh: 1.62, align: 'center' })], boxW, boxH, 12);
    n.push(C.T((W - boxW) / 2, 2.05, boxW, boxH, paras, { align: 'center', valign: 'middle' }));
    n.push(C.RECT((W - 0.9) / 2, 5.0, 0.9, 0.05, t.accent, { radius: 0.03 }));
    if (s.author) {
      n.push(C.TXT((W - 8) / 2, 5.22, 8, 0.36, '—— ' + s.author, 12, t.muted, { align: 'center', lh: 1.3 }));
    }
    n = n.concat(footer(s, t, page, total));
    return n;
  }

  /* ---------------------------------------------------------------- 结束页 */
  function end(s, t) {
    var n = [];
    n.push(C.RECT(0, 0, W, H, t.sectionBg));
    n.push(C.ELLIPSE(-1.6, 4.2, 4.6, 4.6, C.mix(t.sectionBg, t.sectionInk, 0.08)));
    n.push(C.ELLIPSE(10.6, -1.9, 5.2, 5.2, C.mix(t.sectionBg, t.sectionInk, 0.08)));
    n.push(C.TXT(ML, 2.62, CW, 0.95, s.title || '谢谢观看', 38, t.sectionInk, {
      bold: true, align: 'center', lh: 1.2, fit: true, minSize: 24
    }));
    n.push(C.RECT((W - 0.9) / 2, 3.72, 0.9, 0.055, C.mix(t.sectionBg, t.sectionInk, 0.6), { radius: 0.03 }));
    if (s.subtitle) {
      n.push(C.TXT(ML, 3.95, CW, 0.5, s.subtitle, 14, C.mix(t.sectionBg, t.sectionInk, 0.78), {
        align: 'center', lh: 1.4
      }));
    }
    if (s.meta) {
      n.push(C.TXT(ML, 6.35, CW, 0.4, s.meta, 10.5, C.mix(t.sectionBg, t.sectionInk, 0.55), {
        align: 'center', lh: 1.3
      }));
    }
    return n;
  }

  /* ------------------------------------------------------------------ 分发 */
  var MAP = {
    cover: cover, toc: toc, section: section, bullets: bullets, twoCol: twoCol,
    stats: stats, timeline: timeline, compare: compare, quote: quote, end: end
  };

  /**
   * 生成一页的绘制指令
   * @param {object} slide 页面数据
   * @param {object} theme 主题
   * @param {object} ctx   {page, total, font}
   */
  function render(slide, theme, ctx) {
    ctx = ctx || {};
    var fn = MAP[slide.type] || bullets;
    var nodes;
    try {
      nodes = fn(slide, theme, ctx.page, ctx.total);
    } catch (e) {
      nodes = bullets({ title: slide.title || '内容', items: [{ head: '渲染出错', text: String(e && e.message) }] }, theme);
    }
    return nodes;
  }

  return {
    SLIDE_TYPES: SLIDE_TYPES,
    typeLabel: typeLabel,
    render: render,
    map: MAP
  };
});
