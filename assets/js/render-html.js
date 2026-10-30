/*!
 * AI PPT Studio - 预览渲染器
 * 把 layouts 生成的绘制指令翻译成绝对定位的 DOM，1in = 96px。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./core.js'));
  else root.PPHtml = factory(root.PPCore);
})(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';

  var PXPERIN = 96;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function px(inch) { return (inch * PXPERIN).toFixed(2) + 'px'; }

  /**
   * @param {HTMLElement} box 幻灯片容器（会被设成 1280×720）
   * @param {Array} nodes 绘制指令
   * @param {object} opts {fontCss, scale}
   */
  function paint(box, nodes, opts) {
    opts = opts || {};
    var scale = opts.scale == null ? 1 : opts.scale;
    var fontCss = opts.fontCss || '"Microsoft YaHei",sans-serif';

    box.innerHTML = '';
    box.style.position = 'relative';
    box.style.width = px(C.SLIDE_W * scale);
    box.style.height = px(C.SLIDE_H * scale);
    box.style.overflow = 'hidden';
    box.style.fontFamily = fontCss;

    var frag = document.createDocumentFragment();
    for (var i = 0; i < nodes.length; i++) {
      var nd = nodes[i];
      var el;
      if (nd.t === 'text') el = textNode(nd, fontCss);
      else el = shapeNode(nd);
      el.style.position = 'absolute';
      el.style.left = px(nd.x * scale);
      el.style.top = px(nd.y * scale);
      el.style.width = px(nd.w * scale);
      el.style.height = px(nd.h * scale);
      frag.appendChild(el);
    }
    box.appendChild(frag);
    return box;
  }

  function shapeNode(nd) {
    var el = document.createElement('div');
    el.style.position = 'absolute';
    el.style.background = nd.fill || 'transparent';
    if (nd.fillAlpha != null && nd.fill) el.style.opacity = String(nd.fillAlpha);
    if (nd.line) {
      el.style.border = (nd.lineW || 0.75) * 1.333 + 'px solid ' + nd.line;
      el.style.boxSizing = 'border-box';
    }
    if (nd.t === 'ellipse') el.style.borderRadius = '50%';
    else if (nd.radius) el.style.borderRadius = (nd.radius * PXPERIN).toFixed(2) + 'px';
    return el;
  }

  function textNode(nd, fontCss) {
    var el = document.createElement('div');
    el.style.position = 'absolute';
    el.style.display = 'flex';
    el.style.flexDirection = 'column';
    el.style.justifyContent = nd.valign === 'middle' ? 'center' : (nd.valign === 'bottom' ? 'flex-end' : 'flex-start');
    el.style.alignItems = nd.align === 'center' ? 'center' : (nd.align === 'right' ? 'flex-end' : 'stretch');
    el.style.overflow = 'hidden';
    el.style.fontFamily = fontCss;
    el.style.textAlign = nd.align || 'left';

    var paras = nd.paras || [];
    for (var i = 0; i < paras.length; i++) {
      var p = paras[i];
      var pe = document.createElement('div');
      pe.style.width = '100%';
      pe.style.textAlign = p.align || nd.align || 'left';
      if (p.lh) pe.style.lineHeight = String(p.lh);
      if (p.before) pe.style.marginTop = (p.before * 1.333).toFixed(2) + 'px';
      if (p.after) pe.style.marginBottom = (p.after * 1.333).toFixed(2) + 'px';
      pe.style.whiteSpace = 'pre-wrap';
      pe.style.wordBreak = 'break-word';

      for (var j = 0; j < p.runs.length; j++) {
        var r = p.runs[j];
        var sp = document.createElement('span');
        sp.textContent = r.text;
        sp.style.fontSize = ((r.size || 14) * 1.3333).toFixed(2) + 'px';
        sp.style.color = r.color || '#111';
        if (r.bold) sp.style.fontWeight = '700';
        if (r.italic) sp.style.fontStyle = 'italic';
        if (r.spacing) sp.style.letterSpacing = (r.spacing * 1.3333).toFixed(2) + 'px';
        pe.appendChild(sp);
      }
      if (!p.runs.length) pe.textContent = '';
      el.appendChild(pe);
    }
    return el;
  }

  /** 渲染成可缩放的舞台：外层负责缩放，内层保持 1280×720 逻辑尺寸 */
  function mount(host, nodes, opts) {
    opts = opts || {};
    host.innerHTML = '';
    var stage = document.createElement('div');
    stage.className = 'slide-stage';
    stage.style.position = 'relative';
    stage.style.width = (C.SLIDE_W * PXPERIN) + 'px';
    stage.style.height = (C.SLIDE_H * PXPERIN) + 'px';
    stage.style.transformOrigin = 'top left';
    paint(stage, nodes, { fontCss: opts.fontCss });
    host.appendChild(stage);
    return stage;
  }

  return { paint: paint, mount: mount, esc: esc, PXPERIN: PXPERIN };
});
