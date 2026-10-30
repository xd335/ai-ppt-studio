/*!
 * AI PPT Studio - 大纲生成
 * 1) 调用 OpenAI 兼容接口（DeepSeek / 通义 / Kimi / 本地 Ollama ...）生成结构化大纲
 * 2) 不联网时的本地规则引擎：按主题生成可编辑的专业骨架
 * 3) Markdown / 长文一键转大纲
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PPGen = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var LIMIT = { title: 22, head: 18, text: 60, lead: 44, item: 34, value: 8, label: 12 };

  function cut(s, n) {
    s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
    return s.length > n ? s.slice(0, n) : s;
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function asArray(v) { return Array.isArray(v) ? v : []; }
  function str(v, n) { return cut(v == null ? '' : v, n == null ? 999 : n); }
  /** 短句结尾不保留句号：版面更干净，也减少"末行只剩一个标点" */
  function tidy(v) { return String(v == null ? '' : v).replace(/[。．.]+$/, '').trim(); }

  /* ------------------------------------------------------------------ 模板 */
  var CHAPTERS = [
    {
      name: '背景与现状',
      pages: [
        {
          title: '行业背景：为什么是现在',
          lead: '需求侧与供给侧同时发生变化，窗口期已经打开。',
          items: [
            { head: '需求侧变化', text: '用户对{{topic}}的期待，从"能用"升级为"好用、快用、敢用"。' },
            { head: '供给侧变化', text: '工具链、算力与数据成本下降，过去做不起的方案现在具备可行性。' },
            { head: '竞争格局', text: '先行者已建立体验优势，后进入者需要更清晰的差异化切口。' }
          ]
        },
        {
          title: '我们观察到的三个信号',
          lead: '',
          items: [
            { head: '信号一：决策变快', text: '从立项到验证的周期被压缩，试错成本显著下降。' },
            { head: '信号二：标准抬高', text: '一次性交付不再被接受，持续迭代能力成为基本要求。' },
            { head: '信号三：边界模糊', text: '内容、工具与服务的界限被打通，单点产品难以独立存活。' }
          ]
        }
      ]
    },
    {
      name: '关键问题',
      pages: [
        {
          title: '目标与现实之间的差距',
          lead: '把问题拆开看，真正卡住的往往不是资源，而是协作方式。',
          items: [
            { head: '流程割裂', text: '环节之间靠人工对齐，信息在传递中失真、返工。' },
            { head: '重复投入', text: '同类工作反复从零开始，经验无法沉淀为资产。' },
            { head: '标准缺失', text: '缺少统一的评估口径，好坏只能靠主观判断。' }
          ]
        },
        {
          title: '现状对照',
          lead: '',
          type: 'twoCol',
          columns: [
            { title: '现在的做法', items: ['依赖个人经验，质量波动大', '交付周期长，反馈滞后', '知识留在个人手里'] },
            { title: '期望的状态', items: ['流程标准化，质量可预期', '快速迭代，按周验证', '经验沉淀为可复用模板'] }
          ]
        }
      ]
    },
    {
      name: '解决路径',
      pages: [
        {
          title: '总体思路：一个底座，三类能力',
          lead: '用统一底座承载内容与流程，再向上生长具体能力。',
          items: [
            { head: '统一底座', text: '把素材、模板与规范集中管理，避免各做一套。' },
            { head: '智能生成', text: '以 AI 承接结构化与初稿环节，把人力留给判断与表达。' },
            { head: '可复用资产', text: '每次产出都回流到模板库，下一次起点更高。' }
          ]
        },
        {
          title: '落地三步走',
          lead: '',
          type: 'timeline',
          items: [
            { title: '第一步 · 试点', text: '选 1—2 个高频场景跑通闭环，拿到可量化的效率数据。' },
            { title: '第二步 · 铺开', text: '沉淀模板与规范，把验证过的做法复制到更多团队。' },
            { title: '第三步 · 运营', text: '建立指标与复盘机制，让工具与业务一起演进。' }
          ]
        }
      ]
    },
    {
      name: '价值与展望',
      pages: [
        {
          title: '预期收益',
          lead: '效率、质量与可复用性同时改善，收益可以被度量。',
          type: 'stats',
          items: [
            { value: '70%', label: '初稿时间缩短', note: '把重复劳动交给工具，人专注判断' },
            { value: '3×', label: '产出效率提升', note: '同一批人承接更多项目' },
            { value: '1 套', label: '统一规范', note: '品牌与表达口径保持一致' }
          ]
        },
        {
          title: '风险与应对',
          lead: '',
          type: 'compare',
          left: { title: '可能的风险', items: ['内容同质化，缺乏辨识度', '过度依赖工具，判断力退化', '数据与合规边界不清'] },
          right: { title: '我们的应对', items: ['保留人工终审与风格调优', '把工具定位为放大器而非替代', '建立素材来源与授权清单'] }
        }
      ]
    }
  ];

  function fill(text, ctx) {
    return String(text || '')
      .replace(/\{\{topic\}\}/g, ctx.topic)
      .replace(/\{\{audience\}\}/g, ctx.audience)
      .replace(/\{\{scene\}\}/g, ctx.scene);
  }

  function clonePage(p, ctx) {
    var out = JSON.parse(JSON.stringify(p));
    if (out.title) out.title = fill(out.title, ctx);
    if (out.lead) out.lead = fill(out.lead, ctx);
    if (out.items) {
      out.items = out.items.map(function (it) {
        if (typeof it === 'string') return fill(it, ctx);
        var o = {};
        for (var k in it) o[k] = fill(it[k], ctx);
        return o;
      });
    }
    if (out.columns) {
      out.columns = out.columns.map(function (c) {
        return { title: fill(c.title, ctx), items: c.items.map(function (x) { return fill(x, ctx); }) };
      });
    }
    if (out.left) out.left = { title: fill(out.left.title, ctx), items: out.left.items.map(function (x) { return fill(x, ctx); }) };
    if (out.right) out.right = { title: fill(out.right.title, ctx), items: out.right.items.map(function (x) { return fill(x, ctx); }) };
    return out;
  }

  /* -------------------------------------------------------- 本地规则引擎 */
  /**
   * @param {object} o {topic, audience, scene, pages}
   * @returns {{title,subtitle,slides:[]}}
   */
  function localOutline(o) {
    o = o || {};
    var ctx = {
      topic: cut(o.topic || '本项目', 20),
      audience: cut(o.audience || '团队', 14),
      scene: cut(o.scene || '汇报', 10)
    };
    var want = Math.max(6, Math.min(24, o.pages || 12));
    var withQuote = want >= 14;
    // 预算：封面 + 目录 + 结尾 + 结论段 固定占 5 页（含金句时 6 页）
    var remain = Math.max(2, want - (withQuote ? 6 : 5));
    var chapterCount = Math.max(2, Math.min(4, Math.round(remain / 3)));
    var perChapter = Math.max(1, Math.min(2, Math.round(remain / chapterCount) - 1));
    var chapters = CHAPTERS.slice(0, chapterCount);

    var slides = [];
    slides.push({
      type: 'cover',
      title: ctx.topic,
      subtitle: cut('面向' + ctx.audience + '的' + ctx.scene + '方案', 26),
      kicker: ctx.scene + ' · ' + new Date().getFullYear(),
      meta: '汇报人 / 日期'
    });

    var tocItems = [];
    for (var c = 0; c < chapters.length; c++) tocItems.push(chapters[c].name);
    tocItems.push('结论与行动');
    slides.push({ type: 'toc', title: '目录', items: tocItems });

    for (var i = 0; i < chapters.length; i++) {
      var ch = chapters[i];
      slides.push({
        type: 'section',
        index: (i + 1 < 10 ? '0' : '') + (i + 1),
        title: ch.name,
        kicker: 'PART ' + (i + 1)
      });
      for (var p = 0; p < Math.min(perChapter, ch.pages.length); p++) {
        var page = clonePage(ch.pages[p], ctx);
        page.type = page.type || 'bullets';
        page.notes = '讲解提示：先用一句话点明结论，再展开'
          + (page.items && page.items[0] ? (page.items[0].head || '') : '细节') + '。';
        slides.push(page);
      }
    }

    var last = chapters.length + 1;
    slides.push({
      type: 'section', index: (last < 10 ? '0' : '') + last, title: '结论与下一步', kicker: 'PART ' + last
    });
    slides.push({
      type: 'bullets',
      title: '下一步的三个动作',
      lead: '从最小闭环开始，用两周拿到第一组数据。',
      items: [
        { head: '本周：定范围', text: '确认试点场景、成功标准与负责人。' },
        { head: '下周：跑通一版', text: '用现有工具完成一次完整交付，记录耗时与问题。' },
        { head: '两周后：复盘', text: '按数据判断是否扩大范围，并沉淀为模板。' }
      ],
      notes: '把讨论落到具体的负责人和时间点上。'
    });
    if (withQuote) {
      slides.push({
        type: 'quote',
        text: cut(o.quote || '真正的效率提升，来自把重复的部分交给工具，把判断留给专业的人。', 60),
        author: ''
      });
    }
    slides.push({
      type: 'end',
      title: '谢谢观看',
      subtitle: '欢迎交流与指正',
      meta: ctx.topic + ' · ' + ctx.scene
    });

    return normalize({ title: ctx.topic, subtitle: slides[0].subtitle, slides: slides, engine: 'local' });
  }

  /* ------------------------------------------------------ Markdown 转大纲 */
  function markdownToOutline(text, opts) {
    opts = opts || {};
    var lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
    var slides = [];
    var cur = null;
    var pending = [];

    function flush() {
      if (!cur) return;
      if (cur.items.length || cur.lead) slides.push(cur);
      else if (cur.title) {
        slides.push({
          type: 'section',
          index: pad2(slides.filter(function (s) { return s.type === 'section'; }).length + 1),
          title: cur.title
        });
      }
      cur = null;
    }
    function start(title) {
      flush();
      cur = { type: 'bullets', title: title, lead: '', items: [] };
    }

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) continue;
      if (/^(---|\*\*\*|___)$/.test(line)) { flush(); continue; }

      var m = /^(#{1,6})\s+(.*)$/.exec(line);
      if (m) {
        var level = m[1].length;
        var h = m[2].replace(/\s*#+\s*$/, '').trim();
        if (level <= 2) {
          if (!slides.length && !cur && level === 1) { pending.push(h); continue; }
          start(h);
        } else {
          if (!cur) start(h);
          else cur.items.push({ head: cut(h, LIMIT.head), text: '' });
        }
        continue;
      }

      if (/^>\s?/.test(line)) {
        flush();
        slides.push({ type: 'quote', text: line.replace(/^>\s?/, '').trim(), author: '' });
        continue;
      }

      var bm = /^([-*+·]|\d+[.)、])\s+(.*)$/.exec(line);
      if (bm) {
        if (!cur) start(pending.shift() || '内容');
        cur.items.push(splitItem(bm[2]));
        continue;
      }

      if (!cur) {
        start(pending.shift() || cut(line, LIMIT.title));
        if (line !== cur.title) cur.items.push(splitItem(line));
      } else if (!cur.items.length && !cur.lead) {
        cur.lead = cut(line, LIMIT.lead);
      } else {
        cur.items.push(splitItem(line));
      }
    }
    flush();

    var out = [];
    for (var k = 0; k < slides.length; k++) {
      var s = slides[k];
      if (s.type === 'bullets' && s.items.length > 5) {
        for (var q = 0; q < s.items.length; q += 5) {
          out.push({
            type: 'bullets',
            title: s.title + (q ? '（续）' : ''),
            lead: q === 0 ? s.lead : '',
            items: s.items.slice(q, q + 5)
          });
        }
      } else out.push(s);
    }

    var title = pending.length ? pending[0] : (out.length ? out[0].title : '未命名演示');
    var deck = normalize({ title: title, subtitle: '', slides: [] });
    deck.slides = [{ type: 'cover', title: title, subtitle: opts.subtitle || '', meta: '' }]
      .concat(out)
      .concat([{ type: 'end', title: '谢谢观看', subtitle: '' }]);
    deck.engine = 'markdown';
    return normalize(deck);
  }

  function splitItem(body) {
    var t = String(body || '').replace(/\*\*/g, '').trim();
    var m = /^(.*?)[：:]\s*(.+)$/.exec(t);
    if (m && m[1].length <= LIMIT.head) {
      return { head: cut(m[1], LIMIT.head), text: cut(m[2], LIMIT.text) };
    }
    if (t.length <= LIMIT.head) return { head: t, text: '' };
    return { head: cut(t, LIMIT.head), text: cut(t.slice(LIMIT.head), LIMIT.text) };
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  /* ------------------------------------------------------------- 规范化 */
  function normalizeSlide(raw) {
    var s = raw || {};
    var type = s.type || 'bullets';
    var out = { type: type, notes: str(s.notes, 500) };
    if (s.brand === false) out.brand = false;

    if (type === 'cover') {
      out.title = str(s.title, LIMIT.title * 2);
      out.subtitle = str(s.subtitle, 40);
      out.kicker = str(s.kicker, 18);
      out.meta = str(s.meta, 40);
    } else if (type === 'toc') {
      out.title = str(s.title || '目录', LIMIT.title);
      out.items = asArray(s.items).map(function (x) { return tidy(str(x, LIMIT.item + 4)); }).filter(Boolean).slice(0, 8);
    } else if (type === 'section') {
      out.index = str(s.index, 3);
      out.title = str(s.title, LIMIT.title + 8);
      out.kicker = str(s.kicker, 16);
    } else if (type === 'bullets') {
      out.title = str(s.title || '内容', LIMIT.title);
      out.lead = str(s.lead, LIMIT.lead);
      out.items = asArray(s.items).map(function (it) {
        if (typeof it === 'string') return { head: str(it, LIMIT.head + 6), text: '' };
        return { head: str(it && it.head, LIMIT.head + 6), text: str(it && it.text, LIMIT.text + 20) };
      }).filter(function (it) { return it.head || it.text; }).slice(0, 6);
    } else if (type === 'twoCol') {
      out.title = str(s.title || '对比', LIMIT.title);
      out.columns = asArray(s.columns).slice(0, 2).map(function (c) {
        return {
          title: str(c && c.title, LIMIT.head + 4),
          items: asArray(c && c.items).map(function (x) { return tidy(str(x, LIMIT.text)); }).filter(Boolean).slice(0, 5)
        };
      });
      while (out.columns.length < 2) out.columns.push({ title: '', items: [] });
    } else if (type === 'stats') {
      out.title = str(s.title || '关键数据', LIMIT.title);
      out.items = asArray(s.items).slice(0, 4).map(function (it) {
        it = it || {};
        return { value: str(it.value, LIMIT.value), label: str(it.label, LIMIT.label + 4), note: tidy(str(it.note, LIMIT.text)) };
      });
    } else if (type === 'timeline') {
      out.title = str(s.title || '实施路径', LIMIT.title);
      out.items = asArray(s.items).slice(0, 5).map(function (it) {
        it = it || {};
        return { title: str(it.title || it.head, LIMIT.head), text: tidy(str(it.text, LIMIT.text + 10)) };
      });
    } else if (type === 'compare') {
      out.title = str(s.title || '对比', LIMIT.title);
      ['left', 'right'].forEach(function (k) {
        var d = s[k] || {};
        out[k] = {
          title: str(d.title, LIMIT.head + 2),
          items: asArray(d.items).map(function (x) { return tidy(str(x, LIMIT.text)); }).filter(Boolean).slice(0, 5)
        };
      });
    } else if (type === 'quote') {
      out.text = tidy(str(s.text, 70));
      out.author = str(s.author, 20);
    } else if (type === 'end') {
      out.title = str(s.title || '谢谢观看', 20);
      out.subtitle = str(s.subtitle, 40);
      out.meta = str(s.meta, 40);
    } else {
      out.type = 'bullets';
      out.title = str(s.title || '内容', LIMIT.title);
      out.lead = str(s.lead, LIMIT.lead);
      out.items = asArray(s.items).map(function (it) {
        return typeof it === 'string'
          ? { head: str(it, LIMIT.head + 6), text: '' }
          : { head: str(it && it.head, LIMIT.head + 6), text: str(it && it.text, LIMIT.text) };
      }).slice(0, 6);
    }
    out.id = s.id || uid();
    return out;
  }

  function normalize(deck) {
    var d = deck || {};
    var slides = asArray(d.slides).map(normalizeSlide);
    if (!slides.length) slides = localOutline({}).slides;
    return {
      title: str(d.title || (slides[0] && slides[0].title) || '未命名演示', 60),
      subtitle: str(d.subtitle, 60),
      slides: slides,
      engine: d.engine || 'ai'
    };
  }

  /* --------------------------------------------------------------- 提示词 */
  function buildPrompt(o) {
    o = o || {};
    var pages = o.pages || 12;
    var scene = o.scene || '工作汇报';
    var audience = o.audience || '同事与领导';
    var tone = o.tone || '专业、克制、有观点';

    var sys = [
      '你是一位顶尖的演示文稿策划师兼版面设计师，擅长把想法组织成结构清晰、有说服力的中文 PPT。',
      '你只输出 JSON，不输出任何解释文字，不使用 Markdown 代码块。',
      '输出必须是一个 JSON 对象，结构如下：',
      '{"title":"整份演示的标题","subtitle":"一句话价值主张","slides":[ ... ]}',
      'slides 数组中每个元素的 type 只能取以下值，字段必须齐全：',
      '1. {"type":"cover","title":"主标题","subtitle":"副标题","kicker":"场景或年份","meta":"汇报人 / 日期"}',
      '2. {"type":"toc","title":"目录","items":["章节名1","章节名2","章节名3"]}',
      '3. {"type":"section","index":"01","title":"章节标题","kicker":"PART 01"}',
      '4. {"type":"bullets","title":"页面标题","lead":"一句结论","items":[{"head":"小标题","text":"一句话说明"}]}',
      '5. {"type":"twoCol","title":"页面标题","columns":[{"title":"左栏标题","items":["要点"]},{"title":"右栏标题","items":["要点"]}]}',
      '6. {"type":"stats","title":"页面标题","items":[{"value":"70%","label":"指标名","note":"补充说明"}]}',
      '7. {"type":"timeline","title":"页面标题","items":[{"title":"阶段名","text":"一句话说明"}]}',
      '8. {"type":"compare","title":"页面标题","left":{"title":"左标题","items":["要点"]},"right":{"title":"右标题","items":["要点"]}}',
      '9. {"type":"quote","text":"金句","author":"—— 署名（可空）"}',
      '10. {"type":"end","title":"谢谢观看","subtitle":"一句话收尾","meta":"联系方式（可空）"}',
      '写作要求：',
      '- 中文简体，观点先行，句子短，拒绝空话和套话；每页只讲一件事。',
      '- 标题不超过 18 字，lead 不超过 40 字，要点正文不超过 45 字，每条要点的小标题不超过 14 字。',
      '- bullets 每页 3—5 条；两栏每栏 3—4 条；stats 2—4 个；timeline 3—5 步。',
      '- 结构建议：封面 → 目录 → 2—4 个章节（每章 1 个 section 页 + 1—2 个内容页）→ 结论/行动 → 结尾。',
      '- 不要在标题里写"第一部分""内容如下"之类的过渡语。',
      '- 每个内容页都要给出 notes 字段：一句给演讲者的提示。'
    ].join('\n');

    var usr = [
      '主题：' + (o.topic || ''),
      '场合：' + scene,
      '听众：' + audience,
      '期望篇幅：约 ' + pages + ' 页',
      '语言风格：' + tone,
      o.extra ? '补充要求：' + o.extra : '',
      '请直接输出该主题的完整 JSON 大纲。'
    ].filter(Boolean).join('\n');

    return [{ role: 'system', content: sys }, { role: 'user', content: usr }];
  }

  function extractJson(text) {
    if (!text) throw new Error('模型返回为空');
    var s = String(text).trim();
    var fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(s);
    if (fence) s = fence[1].trim();
    var start = s.indexOf('{');
    var end = s.lastIndexOf('}');
    if (start >= 0 && end > start) s = s.slice(start, end + 1);
    try {
      return JSON.parse(s);
    } catch (e) {
      var repaired = s.replace(/[“”]/g, '"').replace(/,\s*([}\]])/g, '$1').replace(/\n/g, ' ');
      return JSON.parse(repaired);
    }
  }

  /** 调用 OpenAI 兼容的 /chat/completions */
  function chat(cfg, messages, opts) {
    opts = opts || {};
    var base = String(cfg.baseUrl || 'https://api.deepseek.com/v1').trim().replace(/\/+$/, '');
    if (!/\/chat\/completions$/.test(base)) base += '/chat/completions';
    var body = {
      model: cfg.model || 'deepseek-chat',
      messages: messages,
      temperature: opts.temperature == null ? 0.7 : opts.temperature,
      max_tokens: opts.maxTokens || 4096,
      stream: false
    };
    if (opts.json !== false) body.response_format = { type: 'json_object' };

    return fetch(base, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + (cfg.apiKey || '')
      },
      body: JSON.stringify(body)
    }).then(function (res) {
      return res.text().then(function (t) {
        if (!res.ok) {
          var msg = t;
          try {
            var j = JSON.parse(t);
            msg = (j.error && (j.error.message || j.error)) || t;
          } catch (e) { /* 保留原文 */ }
          throw new Error('接口返回 ' + res.status + '：' + String(msg).slice(0, 300));
        }
        var data;
        try { data = JSON.parse(t); } catch (e) { throw new Error('接口返回的不是 JSON：' + t.slice(0, 200)); }
        if (data.error) throw new Error(data.error.message || '接口错误');
        var choice = (data.choices && data.choices[0]) || {};
        return (choice.message && choice.message.content) || '';
      });
    }).catch(function (err) {
      var m = String((err && err.message) || err);
      if (/Failed to fetch|NetworkError|load failed|fetch failed/i.test(m)) {
        throw new Error('无法连接接口：地址可能有误，或浏览器跨域(CORS)被拦截。可改用「本地模板」，或把地址指向你自己的代理。');
      }
      throw err;
    });
  }

  function requestOutline(cfg, o) {
    return chat(cfg, buildPrompt(o), {
      temperature: 0.75,
      maxTokens: Math.min(8192, 1200 + (o.pages || 12) * 260)
    }).then(function (content) {
      var json = extractJson(content);
      json.engine = 'ai';
      return normalize(json);
    });
  }

  return {
    LIMIT: LIMIT,
    localOutline: localOutline,
    markdownToOutline: markdownToOutline,
    normalize: normalize,
    normalizeSlide: normalizeSlide,
    buildPrompt: buildPrompt,
    chat: chat,
    requestOutline: requestOutline,
    extractJson: extractJson
  };
});
