/*!
 * AI PPT Studio - PPTX 导出渲染器
 * 与预览共用 layouts 的绘制指令，保证导出与屏幕一致。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./core.js'));
  else root.PPRender = factory(root.PPCore);
})(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';

  var NO_LINE = { color: 'FFFFFF', width: 0, transparency: 100 };

  function shapeOpts(nd) {
    var o = { x: nd.x, y: nd.y, w: nd.w, h: nd.h };
    if (nd.fill) {
      o.fill = nd.fillAlpha != null
        ? { color: C.bare(nd.fill), transparency: Math.round((1 - nd.fillAlpha) * 100) }
        : { color: C.bare(nd.fill) };
    } else {
      o.fill = { color: 'FFFFFF', transparency: 100 };
    }
    o.line = nd.line ? { color: C.bare(nd.line), width: nd.lineW || 0.75 } : NO_LINE;
    return o;
  }

  function textOpts(nd, fontFace) {
    var maxSize = 14, lh = 1.35;
    for (var i = 0; i < nd.paras.length; i++) {
      var p = nd.paras[i];
      if (p.lh) lh = Math.max(lh, p.lh);
      for (var j = 0; j < p.runs.length; j++) maxSize = Math.max(maxSize, p.runs[j].size || 14);
    }
    return {
      x: nd.x, y: nd.y, w: nd.w, h: nd.h,
      fontFace: fontFace,
      fontSize: maxSize,
      align: nd.align || 'left',
      valign: nd.valign || 'top',
      margin: 0,
      wrap: true,
      isTextBox: true,
      lineSpacing: Math.round(maxSize * lh * 10) / 10,
      fit: 'none',
      vert: 'horz'
    };
  }

  function richText(nd) {
    var out = [];
    for (var i = 0; i < nd.paras.length; i++) {
      var p = nd.paras[i];
      var runs = p.runs.length ? p.runs : [{ text: '' }];
      for (var j = 0; j < runs.length; j++) {
        var r = runs[j];
        var o = {};
        if (r.size) o.fontSize = r.size;
        if (r.color) o.color = C.bare(r.color);
        if (r.bold) o.bold = true;
        if (r.italic) o.italic = true;
        if (r.spacing) o.charSpacing = r.spacing;
        if (p.align) o.align = p.align;
        if (p.before) o.paraSpaceBefore = p.before;
        if (p.after) o.paraSpaceAfter = p.after;
        if (i === nd.paras.length - 1 && j === runs.length - 1) o.breakLine = false;
        else if (j === runs.length - 1) o.breakLine = true;
        out.push({ text: r.text == null ? '' : String(r.text), options: o });
      }
    }
    return out;
  }

  /**
   * 绘制一页到 pptx
   * @param {PptxGenJS} PptxGenJS 构造器
   * @param {object} deck  {title, author, subject}
   * @param {object} slide 页面数据
   * @param {object} theme 主题
   * @param {object} ctx   {page,total,fontFace,notes}
   */
  function createDeck(PptxGenJS, deck, theme, fontFace) {
    var pptx = new PptxGenJS();
    pptx.defineLayout({ name: 'W16x9', width: C.SLIDE_W, height: C.SLIDE_H });
    pptx.layout = 'W16x9';
    pptx.title = (deck && deck.title) || '未命名演示';
    pptx.author = (deck && deck.author) || 'AI PPT Studio';
    pptx.company = (deck && deck.company) || '';
    pptx.subject = (deck && deck.subject) || '';
    pptx.lang = 'zh-CN';
    pptx.theme = {
      headFontFace: fontFace,
      bodyFontFace: fontFace,
      lang: 'zh-CN'
    };
    return pptx;
  }

  function addSlide(pptx, slide, nodes, theme, ctx) {
    var s = pptx.addSlide();
    s.background = { color: C.bare(theme.bg) };
    if (ctx && ctx.fontFace) s._fontFace = ctx.fontFace;

    for (var i = 0; i < nodes.length; i++) {
      var nd = nodes[i];
      if (nd.t === 'text') {
        if (!nd.paras || !nd.paras.length) continue;
        s.addText(richText(nd), textOpts(nd, ctx.fontFace));
      } else {
        var type = nd.t === 'ellipse'
          ? pptx.ShapeType.ellipse
          : (nd.radius ? pptx.ShapeType.roundRect : pptx.ShapeType.rect);
        var o = shapeOpts(nd);
        if (nd.radius && nd.t !== 'ellipse') o.rectRadius = nd.radius;
        s.addShape(type, o);
      }
    }
    if (slide && slide.notes) {
      s.addNotes(String(slide.notes));
    }
    return s;
  }

  /** 完整导出：slides 为页面数组，返回 pptx 实例（由调用方 writeFile） */
  function build(PptxGenJS, slides, theme, fontFace, deck, hooks) {
    var pptx = createDeck(PptxGenJS, deck, theme, fontFace);
    var total = slides.length;
    for (var i = 0; i < total; i++) {
      var slide = slides[i];
      var nodes;
      if (hooks && hooks.render) nodes = hooks.render(slide, i, total);
      else nodes = [];
      addSlide(pptx, slide, nodes, theme, { fontFace: fontFace, page: i + 1, total: total });
    }
    return pptx;
  }

  return { build: build, addSlide: addSlide, createDeck: createDeck, richText: richText, textOpts: textOpts };
});
