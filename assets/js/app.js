/*!
 * AI PPT Studio - 应用层
 */
(function () {
  'use strict';

  var C = window.PPCore;
  var L = window.PPLayouts;
  var H = window.PPHtml;
  var R = window.PPRender;
  var G = window.PPGen;

  var STORE_KEY = 'aippt.studio.v1';
  var DECK_W = 1280, DECK_H = 720;

  var state = {
    deck: null,
    themeId: 'minimal',
    fontId: 'yahei',
    current: 0,
    cfg: { baseUrl: '', apiKey: '', model: '' },
    busy: false,
    presenting: false,
    presentIndex: 0
  };

  var $ = function (id) { return document.getElementById(id); };

  /* ------------------------------------------------------------ 初始化 */
  function boot() {
    buildFontSelect();
    restoreState();
    buildThemeGrid();
    bindEvents();
    if (!state.deck) {
      state.deck = G.localOutline({
        topic: 'AI 如何重塑企业知识生产',
        audience: '业务负责人',
        scene: '内部汇报',
        pages: 14
      });
    }
    state.current = Math.min(state.current, Math.max(0, state.deck.slides.length - 1));
    updateApiDot();
    syncDeckTitle();
    renderAll();
    fitStage();
  }

  function buildThemeGrid() {
    var box = $('themeGrid');
    box.innerHTML = '';
    C.THEMES.forEach(function (t) {
      var b = document.createElement('button');
      b.className = 'theme-card' + (t.id === state.themeId ? ' active' : '');
      b.dataset.theme = t.id;
      b.innerHTML = '<div class="swatch">'
        + '<i style="background:' + t.bg + '"></i>'
        + '<i style="background:' + t.ink + '"></i>'
        + '<i style="background:' + t.accent + '"></i>'
        + '<i style="background:' + t.accentSoft + '"></i>'
        + '</div><b>' + H.esc(t.name) + '</b><small>' + H.esc(t.desc) + '</small>';
      b.addEventListener('click', function () {
        state.themeId = t.id;
        Array.prototype.forEach.call(box.children, function (c) { c.classList.toggle('active', c.dataset.theme === t.id); });
        renderStage(true);
        renderThumbs();
        save();
      });
      box.appendChild(b);
    });
  }

  function buildFontSelect() {
    var sel = $('fontSelect');
    sel.innerHTML = '';
    C.FONTS.forEach(function (f) {
      var o = document.createElement('option');
      o.value = f.id;
      o.textContent = f.label;
      sel.appendChild(o);
    });
    sel.addEventListener('change', function () {
      state.fontId = sel.value;
      renderStage(true);
      renderThumbs();
      save();
    });
  }

  /* -------------------------------------------------------------- 事件 */
  function bindEvents() {
    document.querySelectorAll('.tab').forEach(function (t) {
      t.addEventListener('click', function () { switchTab(t.dataset.tab); });
    });

    $('btnGenerate').addEventListener('click', generateWithAI);
    $('btnLocal').addEventListener('click', generateLocal);
    $('btnConvert').addEventListener('click', convertDoc);
    $('btnDownload').addEventListener('click', downloadPptx);
    $('btnPresent').addEventListener('click', openPresent);
    $('btnPrev').addEventListener('click', function () { go(state.current - 1); });
    $('btnNext').addEventListener('click', function () { go(state.current + 1); });
    $('btnDel').addEventListener('click', deleteCurrent);
    $('btnDup').addEventListener('click', duplicateCurrent);
    $('btnAdd').addEventListener('click', toggleAddMenu);
    $('btnCloseInspector').addEventListener('click', function () {
      $('inspector').classList.remove('open');
    });
    $('btnToggleInspector').addEventListener('click', function () {
      $('inspector').classList.toggle('open');
    });
    $('deckTitle').addEventListener('input', function () {
      state.deck.title = this.value;
      save();
    });
    $('metaTitle').addEventListener('input', function () {
      state.deck.title = this.value;
      $('deckTitle').value = this.value;
      save();
    });
    $('metaSubtitle').addEventListener('input', function () {
      state.deck.subtitle = this.value;
      save();
    });

    $('btnSaveCfg').addEventListener('click', saveCfg);
    $('btnClearCfg').addEventListener('click', clearCfg);

    $('btnImport').addEventListener('click', function () { $('fileInput').click(); });
    $('fileInput').addEventListener('change', importFile);
    $('btnExportJson').addEventListener('click', exportJson);
    $('btnSample').addEventListener('click', loadSample);
    $('btnReset').addEventListener('click', resetAll);

    $('presentPrev').addEventListener('click', function () { presentGo(state.presentIndex - 1); });
    $('presentNext').addEventListener('click', function () { presentGo(state.presentIndex + 1); });
    $('presentExit').addEventListener('click', closePresent);

    $('inspectorBody').addEventListener('input', onInspectorInput);
    $('inspectorBody').addEventListener('change', onInspectorInput);

    window.addEventListener('resize', function () {
      fitStage();
      if (state.presenting) layoutPresent();
    });

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('click', function (e) {
      var menu = $('addMenu');
      if (!menu.classList.contains('hidden') && !menu.contains(e.target) && e.target !== $('btnAdd')) {
        menu.classList.add('hidden');
      }
    });
  }

  function switchTab(name) {
    document.querySelectorAll('.tab').forEach(function (t) { t.classList.toggle('active', t.dataset.tab === name); });
    document.querySelectorAll('.tab-body').forEach(function (p) { p.classList.toggle('hidden', p.dataset.panel !== name); });
  }

  function onKeyDown(e) {
    if (state.presenting) {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); presentGo(state.presentIndex + 1); }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); presentGo(state.presentIndex - 1); }
      if (e.key === 'Escape') { e.preventDefault(); closePresent(); }
      return;
    }
    var tag = (e.target && e.target.tagName) || '';
    if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); go(state.current + 1); }
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(state.current - 1); }
    if (e.key === 'F5') { e.preventDefault(); openPresent(); }
    if ((e.key === 'Delete' || e.key === 'Backspace') && !e.metaKey && !e.ctrlKey) {
      if (document.activeElement === document.body) { e.preventDefault(); deleteCurrent(); }
    }
  }

  /* ------------------------------------------------------------ 生成逻辑 */
  function readGenOptions() {
    return {
      topic: $('gTopic').value.trim() || '如何把一件事讲清楚',
      scene: $('gScene').value,
      audience: $('gAudience').value.trim() || '同事与领导',
      pages: parseInt($('gPages').value, 10) || 12,
      extra: $('gExtra').value.trim()
    };
  }

  function generateLocal() {
    var o = readGenOptions();
    applyDeck(G.localOutline(o));
    toast('已用本地模板生成 ' + state.deck.slides.length + ' 页，可逐页修改');
  }

  function generateWithAI() {
    var cfg = readCfg();
    if (!cfg.apiKey) {
      toast('还没填 API Key，先用本地模板生成');
      generateLocal();
      $('apiBox').open = true;
      return;
    }
    if (state.busy) return;
    var o = readGenOptions();
    setBusy(true, '正在调用 ' + (cfg.model || '模型') + ' 生成大纲…');
    G.requestOutline(cfg, o).then(function (deck) {
      applyDeck(deck);
      toast('AI 生成完成：' + deck.slides.length + ' 页');
    }).catch(function (err) {
      toast('生成失败：' + (err.message || err), 6000);
    }).then(function () { setBusy(false); });
  }

  function convertDoc() {
    var text = $('docText').value.trim();
    if (!text) { toast('先粘贴一些文稿'); return; }
    applyDeck(G.markdownToOutline(text, {}));
    switchTab('outline');
    toast('已转换成 ' + state.deck.slides.length + ' 页');
  }

  function applyDeck(deck) {
    state.deck = G.normalize(deck);
    state.current = 0;
    syncDeckTitle();
    renderAll();
  }

  function loadSample() {
    applyDeck(G.localOutline({
      topic: 'AI 如何重塑企业知识生产',
      audience: '业务负责人',
      scene: '内部汇报',
      pages: 14
    }));
    toast('已载入示例');
  }

  function resetAll() {
    if (!confirm('清空当前演示并重新开始？')) return;
    state.deck = G.normalize({ title: '未命名演示', slides: [{ type: 'cover', title: '在这里写标题', subtitle: '' }, { type: 'end', title: '谢谢观看' }] });
    state.current = 0;
    syncDeckTitle();
    renderAll();
    save();
  }

  /* ------------------------------------------------------------ 渲染主体 */
  function theme() { return C.themeById(state.themeId); }
  function font() { return C.fontById(state.fontId); }
  function slides() { return state.deck.slides; }
  function currentSlide() { return slides()[state.current] || null; }

  function nodesFor(slide, index) {
    return L.render(slide, theme(), { page: index + 1, total: slides().length });
  }

  function renderAll() {
    renderOutline();
    renderStage(false);
    renderThumbs();
    renderInspector();
    updateNav();
    $('emptyState').classList.toggle('hidden', slides().length > 0);
    $('metaTitle').value = state.deck.title || '';
    $('metaSubtitle').value = state.deck.subtitle || '';
  }

  function renderStage(keepFit) {
    var slide = currentSlide();
    if (!slide) { $('stageInner').innerHTML = ''; return; }
    var stage = H.mount($('stageInner'), nodesFor(slide, state.current), { fontCss: font().css });
    stage.dataset.base = '1';
    fitStage();
  }

  function fitStage() {
    var stage = $('stageInner').firstElementChild;
    if (!stage) return;
    var host = $('stageHost');
    var w = host.clientWidth - 40;
    var h = host.clientHeight - 16;
    var s = Math.min(w / DECK_W, h / DECK_H);
    s = Math.max(0.2, s);
    stage.style.transform = 'scale(' + s + ')';
    var frame = $('slideFrame');
    frame.style.width = Math.round(DECK_W * s) + 'px';
    frame.style.height = Math.round(DECK_H * s) + 'px';
  }

  function renderThumbs() {
    var strip = $('thumbStrip');
    strip.innerHTML = '';
    var frag = document.createDocumentFragment();
    slides().forEach(function (slide, i) {
      var d = document.createElement('div');
      d.className = 'thumb' + (i === state.current ? ' active' : '');
      d.dataset.index = i;
      var canvas = document.createElement('div');
      canvas.className = 'tcanvas';
      d.appendChild(canvas);
      var num = document.createElement('span');
      num.className = 'num';
      num.textContent = i + 1;
      d.appendChild(num);
      var st = H.mount(canvas, nodesFor(slide, i), { fontCss: font().css });
      st.style.transform = 'scale(' + (150 / DECK_W) + ')';
      d.addEventListener('click', function () { go(i); });
      frag.appendChild(d);
    });
    strip.appendChild(frag);
  }

  function renderOutline() {
    var list = $('outlineList');
    list.innerHTML = '';
    $('slideCount').textContent = slides().length;
    slides().forEach(function (s, i) {
      var li = document.createElement('li');
      li.className = 'outline-item' + (i === state.current ? ' active' : '');
      li.draggable = true;
      li.dataset.index = i;
      var title = s.title || s.text || s.kicker || '';
      li.innerHTML = '<span class="num">' + (i + 1) + '</span>'
        + '<span class="txt">' + H.esc(title || '（空页）') + '</span>'
        + '<span class="tag">' + H.esc(L.typeLabel(s.type)) + '</span>';
      li.addEventListener('click', function () { go(i); });
      li.addEventListener('dragstart', function (e) {
        e.dataTransfer.setData('text/plain', String(i));
        li.classList.add('dragging');
      });
      li.addEventListener('dragend', function () { li.classList.remove('dragging'); });
      li.addEventListener('dragover', function (e) { e.preventDefault(); li.classList.add('drop-target'); });
      li.addEventListener('dragleave', function () { li.classList.remove('drop-target'); });
      li.addEventListener('drop', function (e) {
        e.preventDefault();
        li.classList.remove('drop-target');
        var from = parseInt(e.dataTransfer.getData('text/plain'), 10);
        var to = i;
        if (isNaN(from) || from === to) return;
        var arr = slides();
        var moved = arr.splice(from, 1)[0];
        arr.splice(to, 0, moved);
        state.current = to;
        renderAll();
        save();
      });
      list.appendChild(li);
    });
  }

  function updateNav() {
    $('pageNow').textContent = state.current + 1;
    $('pageTotal').textContent = slides().length;
    var s = currentSlide();
    $('stageTitle').textContent = s ? (s.title || s.text || '') : '';
    var items = document.querySelectorAll('.thumb');
    items.forEach(function (t) { t.classList.toggle('active', parseInt(t.dataset.index, 10) === state.current); });
    var active = document.querySelector('.outline-item.active');
    if (active) active.scrollIntoView({ block: 'nearest' });
  }

  function go(i) {
    if (!slides().length) return;
    state.current = Math.max(0, Math.min(slides().length - 1, i));
    renderStage();
    updateNav();
    renderInspector();
    renderOutline();
    var active = document.querySelectorAll('.thumb')[state.current];
    if (active && active.scrollIntoView) active.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }

  /* ------------------------------------------------------------ 检查器 */
  var FIELDS = {
    cover: [['kicker', '眉标（小字）'], ['title', '主标题'], ['subtitle', '副标题'], ['meta', '页脚信息']],
    toc: [['title', '页面标题'], ['items', '条目（每行一条）', 'lines']],
    section: [['index', '编号'], ['kicker', '眉标'], ['title', '章节标题']],
    bullets: [['title', '页面标题'], ['lead', '导语（可选）'], ['items', '要点 · 每行「小标题｜说明」', 'kv']],
    twoCol: [['title', '页面标题'], ['columns', '', 'columns']],
    stats: [['title', '页面标题'], ['items', '指标 · 每行「数值｜名称｜说明」', 'kvstats']],
    timeline: [['title', '页面标题'], ['items', '步骤 · 每行「阶段｜说明」', 'kv']],
    compare: [['title', '页面标题'], ['left', '', 'side'], ['right', '', 'side']],
    quote: [['text', '金句', 'area'], ['author', '署名']],
    end: [['title', '主标题'], ['subtitle', '副标题'], ['meta', '页脚信息']]
  };

  function fieldValue(slide, key, kind) {
    var v = slide[key];
    if (kind === 'lines') return (v || []).join('\n');
    if (kind === 'kv') return (v || []).map(function (it) { return [it.head, it.text].filter(Boolean).join('｜'); }).join('\n');
    if (kind === 'kvstats') return (v || []).map(function (it) { return [it.value, it.label, it.note].filter(Boolean).join('｜'); }).join('\n');
    return v == null ? '' : String(v);
  }

  function parseLines(raw) {
    return raw.split('\n').map(function (t) { return t.trim(); }).filter(Boolean);
  }

  function renderInspector() {
    var s = currentSlide();
    var body = $('inspectorBody');
    if (!s) { body.innerHTML = '<p class="hint">还没有页面。</p>'; return; }

    var html = '';
    html += '<label class="field"><span>页面类型</span><select data-path="__type" data-kind="type">'
      + L.SLIDE_TYPES.map(function (t) {
        return '<option value="' + t.id + '"' + (t.id === s.type ? ' selected' : '') + '>' + H.esc(t.label) + '</option>';
      }).join('')
      + '</select></label>';

    (FIELDS[s.type] || FIELDS.bullets).forEach(function (f) {
      var key = f[0], label = f[1], kind = f[2] || 'text';
      if (kind === 'columns') {
        html += '<div class="side-box"><b>左栏</b>'
          + inputHtml('columns.0.title', '标题', (s.columns && s.columns[0] && s.columns[0].title) || '')
          + textareaHtml('columns.0.items', '条目（每行一条）', ((s.columns && s.columns[0] && s.columns[0].items) || []).join('\n'), 4)
          + '</div><div class="side-box"><b>右栏</b>'
          + inputHtml('columns.1.title', '标题', (s.columns && s.columns[1] && s.columns[1].title) || '')
          + textareaHtml('columns.1.items', '条目（每行一条）', ((s.columns && s.columns[1] && s.columns[1].items) || []).join('\n'), 4)
          + '</div>';
      } else if (kind === 'side') {
        var d = s[key] || {};
        html += '<div class="side-box"><b>' + (key === 'left' ? '左侧' : '右侧') + '</b>'
          + inputHtml(key + '.title', '标题', d.title || '')
          + textareaHtml(key + '.items', '条目（每行一条）', (d.items || []).join('\n'), 4)
          + '</div>';
      } else if (kind === 'area') {
        html += textareaHtml(key, label, fieldValue(s, key), 3);
      } else if (kind === 'lines' || kind === 'kv' || kind === 'kvstats') {
        html += textareaHtml(key, label, fieldValue(s, key, kind), kind === 'lines' ? 5 : 6);
      } else {
        html += inputHtml(key, label, fieldValue(s, key));
      }
    });

    html += '<label class="field" style="margin-top:14px"><span>演讲备注（导出到 PPT 备注栏）</span>'
      + '<textarea data-path="notes" data-kind="text" rows="3" placeholder="这一页你想怎么讲">' + H.esc(s.notes || '') + '</textarea></label>';

    body.innerHTML = html;
  }

  function inputHtml(path, label, value) {
    return '<label class="field"><span>' + H.esc(label) + '</span>'
      + '<input type="text" data-path="' + path + '" data-kind="text" value="' + H.esc(value) + '" /></label>';
  }
  function textareaHtml(path, label, value, rows) {
    return '<label class="field"><span>' + H.esc(label) + '</span>'
      + '<textarea data-path="' + path + '" data-kind="text" rows="' + (rows || 4) + '">' + H.esc(value) + '</textarea></label>';
  }

  var editTimer = null;
  function onInspectorInput(e) {
    var el = e.target;
    var path = el.dataset && el.dataset.path;
    if (!path) return;
    if (el.dataset.kind === 'type') {
      changeType(el.value);
      return;
    }
    applyPath(currentSlide(), path, el.value);
    clearTimeout(editTimer);
    editTimer = setTimeout(function () {
      renderStage();
      renderThumbs();
      renderOutline();
      updateNav();
      save();
    }, 220);
  }

  function applyPath(slide, path, raw) {
    var parts = path.split('.');
    if (parts.length === 1) {
      if (parts[0] === 'items') {
        slide.items = parseLines(raw).map(function (line) {
          var m = line.split(/[｜|]/);
          return { head: (m[0] || '').trim(), text: (m[1] || '').trim() };
        });
        if (slide.type === 'stats') {
          slide.items = parseLines(raw).map(function (line) {
            var m = line.split(/[｜|]/);
            return { value: (m[0] || '').trim(), label: (m[1] || '').trim(), note: (m[2] || '').trim() };
          });
        }
      } else if (parts[0] === 'columns' || parts[0] === 'left' || parts[0] === 'right') {
        return;
      } else {
        slide[parts[0]] = raw;
      }
      return;
    }
    // columns.0.items / left.title
    var key = parts[0];
    if (!slide[key]) slide[key] = {};
    if (key === 'columns') {
      var idx = parseInt(parts[1], 10);
      if (!slide.columns) slide.columns = [];
      slide.columns[idx] = slide.columns[idx] || { title: '', items: [] };
      if (parts[2] === 'items') slide.columns[idx].items = parseLines(raw);
      else slide.columns[idx].title = raw;
      return;
    }
    if (!slide[key]) slide[key] = { title: '', items: [] };
    if (parts[1] === 'items') slide[key].items = parseLines(raw);
    else slide[key].title = raw;
  }

  function changeType(type) {
    var s = currentSlide();
    var old = s;
    var base = { type: type, notes: old.notes || '' };
    var title = old.title || '';
    if (type === 'cover') { base.title = title; base.subtitle = old.lead || ''; base.kicker = old.kicker || ''; }
    else if (type === 'toc') {
      base.title = '目录';
      base.items = (old.items || []).map(function (it) { return it.head || it.text || it; }).slice(0, 6);
    } else if (type === 'section') { base.index = old.index || '01'; base.title = title; base.kicker = old.kicker || ''; }
    else if (type === 'bullets') {
      base.title = title;
      base.lead = old.lead || '';
      base.items = (old.items || []).map(function (it) {
        return typeof it === 'string' ? { head: it, text: '' } : { head: it.head || it.label || '', text: it.text || it.note || '' };
      });
    } else if (type === 'twoCol') {
      base.title = title;
      var flat = (old.items || []).map(function (it) { return typeof it === 'string' ? it : (it.head || it.text); });
      var half = Math.ceil(flat.length / 2);
      base.columns = [{ title: '左侧', items: flat.slice(0, half) }, { title: '右侧', items: flat.slice(half) }];
    } else if (type === 'stats') {
      base.title = title;
      base.items = (old.items || []).slice(0, 4).map(function (it) {
        return { value: it.value || '--', label: it.label || it.head || '', note: it.note || it.text || '' };
      });
    } else if (type === 'timeline') {
      base.title = title;
      base.items = (old.items || []).slice(0, 5).map(function (it) {
        return { title: it.head || it.title || '', text: it.text || '' };
      });
    } else if (type === 'compare') {
      base.title = title;
      var li = (old.items || []).map(function (it) { return typeof it === 'string' ? it : (it.head || it.text); });
      base.left = { title: '现状', items: li.slice(0, Math.ceil(li.length / 2)) };
      base.right = { title: '目标', items: li.slice(Math.ceil(li.length / 2)) };
    } else if (type === 'quote') { base.text = old.lead || title || ''; base.author = ''; }
    else if (type === 'end') { base.title = '谢谢观看'; base.subtitle = ''; }

    slides()[state.current] = G.normalizeSlide(base);
    renderStage();
    renderThumbs();
    renderOutline();
    renderInspector();
    updateNav();
    save();
  }

  /* ------------------------------------------------------------ 增删页 */
  function blankSlide(type) {
    var base = { type: type, notes: '' };
    if (type === 'cover') { base.title = '在这里写标题'; base.subtitle = '一句话说清价值'; base.kicker = '2026'; }
    else if (type === 'toc') { base.title = '目录'; base.items = ['第一部分', '第二部分', '第三部分']; }
    else if (type === 'section') { base.index = '01'; base.title = '章节标题'; base.kicker = 'PART 01'; }
    else if (type === 'bullets') { base.title = '页面标题'; base.lead = ''; base.items = [{ head: '要点一', text: '一句话说明' }, { head: '要点二', text: '一句话说明' }]; }
    else if (type === 'twoCol') { base.title = '对比'; base.columns = [{ title: '左侧', items: ['要点'] }, { title: '右侧', items: ['要点'] }]; }
    else if (type === 'stats') { base.title = '关键数据'; base.items = [{ value: '100%', label: '指标', note: '说明' }]; }
    else if (type === 'timeline') { base.title = '实施路径'; base.items = [{ title: '第一步', text: '说明' }, { title: '第二步', text: '说明' }]; }
    else if (type === 'compare') { base.title = '对比'; base.left = { title: '现状', items: ['要点'] }; base.right = { title: '目标', items: ['要点'] }; }
    else if (type === 'quote') { base.text = '一句值得记住的话'; base.author = ''; }
    else if (type === 'end') { base.title = '谢谢观看'; base.subtitle = '欢迎交流'; }
    return G.normalizeSlide(base);
  }

  function toggleAddMenu() {
    var menu = $('addMenu');
    if (menu.classList.contains('hidden')) {
      menu.innerHTML = L.SLIDE_TYPES.map(function (t) {
        return '<button data-type="' + t.id + '">' + H.esc(t.label) + '</button>';
      }).join('');
      menu.querySelectorAll('button').forEach(function (b) {
        b.addEventListener('click', function () {
          var s = blankSlide(b.dataset.type);
          slides().splice(state.current + 1, 0, s);
          state.current = state.current + 1;
          menu.classList.add('hidden');
          renderAll();
          save();
        });
      });
      menu.classList.remove('hidden');
    } else menu.classList.add('hidden');
  }

  function deleteCurrent() {
    if (slides().length <= 1) { toast('至少保留一页'); return; }
    slides().splice(state.current, 1);
    state.current = Math.min(state.current, slides().length - 1);
    renderAll();
    save();
  }

  function duplicateCurrent() {
    var copy = JSON.parse(JSON.stringify(currentSlide()));
    copy.id = C.uid();
    slides().splice(state.current + 1, 0, copy);
    state.current = state.current + 1;
    renderAll();
    save();
  }

  /* ------------------------------------------------------------ 配置存取 */
  function readCfg() {
    return {
      baseUrl: $('cfgBase').value.trim() || 'https://api.deepseek.com/v1',
      apiKey: $('cfgKey').value.trim(),
      model: $('cfgModel').value.trim() || 'deepseek-chat'
    };
  }

  function saveCfg() {
    state.cfg = readCfg();
    save();
    updateApiDot();
    toast('接口配置已保存在本机浏览器');
  }

  function clearCfg() {
    state.cfg = { baseUrl: '', apiKey: '', model: '' };
    $('cfgBase').value = '';
    $('cfgKey').value = '';
    $('cfgModel').value = '';
    save();
    updateApiDot();
    toast('已清除接口配置');
  }

  function updateApiDot() {
    var on = !!(state.cfg && state.cfg.apiKey);
    $('apiDot').classList.toggle('on', on);
    $('apiDot').title = on ? '已配置，可调用真实模型' : '未配置，将使用本地模板';
    $('apiHint').textContent = on
      ? '已配置：将调用 ' + (state.cfg.model || '模型') + ' 生成大纲。'
      : '未配置时自动使用本地模板生成，仍然可以导出。';
  }

  /* ------------------------------------------------------------ 导出 */
  function safeName(s) {
    return String(s || '演示').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 40) || '演示';
  }

  function downloadPptx() {
    if (!slides().length) { toast('还没有内容'); return; }
    if (typeof window.PptxGenJS !== 'function') { toast('导出库未加载，请检查 assets/vendor 目录'); return; }
    if (state.busy) return;
    setBusy(true, '正在生成 PPTX…');
    setTimeout(function () {
      try {
        var t = theme(), f = font();
        var pptx = R.build(window.PptxGenJS, slides(), t, f.ppt,
          { title: state.deck.title, author: 'AI PPT Studio', subject: state.deck.subtitle || '' },
          { render: function (slide, i, total) { return L.render(slide, t, { page: i + 1, total: total }); } });
        var name = safeName(state.deck.title) + '.pptx';
        pptx.writeFile({ fileName: name }).then(function () {
          setBusy(false);
          toast('已导出 ' + name + '（' + slides().length + ' 页）');
        }).catch(function (e) {
          setBusy(false);
          toast('导出失败：' + (e && e.message ? e.message : e), 6000);
        });
      } catch (e) {
        setBusy(false);
        toast('导出失败：' + (e && e.message ? e.message : e), 6000);
      }
    }, 60);
  }

  function exportJson() {
    var data = {
      app: 'ai-ppt-studio',
      version: 1,
      deck: state.deck,
      themeId: state.themeId,
      fontId: state.fontId
    };
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = safeName(state.deck.title) + '.json';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  function importFile(e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(String(reader.result));
        var deck = data.deck || data;
        state.deck = G.normalize(deck);
        if (data.themeId) { state.themeId = data.themeId; buildThemeGrid(); }
        if (data.fontId) { state.fontId = data.fontId; $('fontSelect').value = data.fontId; }
        state.current = 0;
        syncDeckTitle();
        renderAll();
        save();
        toast('已导入：' + state.deck.slides.length + ' 页');
      } catch (err) {
        toast('导入失败：文件格式不对');
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  }

  /* ------------------------------------------------------------ 演示模式 */
  function openPresent() {
    if (!slides().length) return;
    state.presenting = true;
    state.presentIndex = state.current;
    $('present').hidden = false;
    $('toast').hidden = true;
    presentGo(state.presentIndex);
    // 进入后短暂显示控制条，随后隐藏，鼠标移入再出现
    var bar = document.querySelector('.present-bar');
    bar.classList.add('show');
    clearTimeout(openPresent._t);
    openPresent._t = setTimeout(function () { bar.classList.remove('show'); }, 2600);
  }

  function closePresent() {
    state.presenting = false;
    $('present').hidden = true;
    clearTimeout(openPresent._t);
    var bar = document.querySelector('.present-bar');
    if (bar) bar.classList.remove('show');
  }

  function presentGo(i) {
    if (!slides().length) return;
    state.presentIndex = Math.max(0, Math.min(slides().length - 1, i));
    var stage = H.mount($('presentStage'), nodesFor(slides()[state.presentIndex], state.presentIndex), { fontCss: font().css });
    stage.dataset.present = '1';
    $('presentIndex').textContent = (state.presentIndex + 1) + ' / ' + slides().length;
    layoutPresent();
  }

  function layoutPresent() {
    var stage = $('presentStage').firstElementChild;
    if (!stage) return;
    var s = Math.min(window.innerWidth / DECK_W, (window.innerHeight - 40) / DECK_H);
    $('presentStage').style.width = Math.round(DECK_W * s) + 'px';
    $('presentStage').style.height = Math.round(DECK_H * s) + 'px';
    stage.style.transform = 'scale(' + s + ')';
  }

  /* ------------------------------------------------------------ 状态保存 */
  var saveTimer = null;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify({
          deck: state.deck,
          themeId: state.themeId,
          fontId: state.fontId,
          cfg: state.cfg,
          current: state.current
        }));
      } catch (e) { /* 隐私模式下忽略 */ }
    }, 350);
  }

  function restoreState() {
    var raw = null;
    try { raw = localStorage.getItem(STORE_KEY); } catch (e) { raw = null; }
    if (!raw) return;
    try {
      var data = JSON.parse(raw);
      if (data.deck && Array.isArray(data.deck.slides) && data.deck.slides.length) {
        state.deck = G.normalize(data.deck);
      }
      if (data.themeId) state.themeId = data.themeId;
      if (data.fontId) state.fontId = data.fontId;
      if (data.cfg) state.cfg = data.cfg;
      if (typeof data.current === 'number') state.current = data.current;
    } catch (e) { /* 忽略损坏的存档 */ }
    $('cfgBase').value = state.cfg.baseUrl || '';
    $('cfgKey').value = state.cfg.apiKey || '';
    $('cfgModel').value = state.cfg.model || '';
    $('fontSelect').value = state.fontId;
    updateApiDot();
  }

  function syncDeckTitle() {
    $('deckTitle').value = state.deck.title || '未命名演示';
    $('metaTitle').value = state.deck.title || '';
    $('metaSubtitle').value = state.deck.subtitle || '';
  }

  /* ------------------------------------------------------------ 小工具 */
  var toastTimer = null;
  function toast(msg, ms) {
    var el = $('toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, ms || 2600);
  }

  function setBusy(on, text) {
    state.busy = on;
    var box = $('loadingBox');
    if (!box) {
      box = document.createElement('div');
      box.id = 'loadingBox';
      box.className = 'loading';
      box.innerHTML = '<div class="spinner"></div><div class="loading-text"></div>';
      document.body.appendChild(box);
    }
    box.querySelector('.loading-text').textContent = text || '处理中…';
    box.hidden = !on;
    ['btnGenerate', 'btnLocal', 'btnDownload', 'btnConvert'].forEach(function (id) {
      var b = $(id);
      if (b) b.disabled = on;
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
