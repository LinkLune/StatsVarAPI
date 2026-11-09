/*!
 * StatsVarAPI.js  v1.0.0（Stats Variable API 统计变量API）
 * -------------------------------------------------------------------
 * 本JS开发目的与介绍、还有使用说明（2026年11月6日）：
 * 有一个游戏，它叫《我的世界》，我从14岁开始运营自己的服务器，直到19岁结束。
 * 同样运营服务器的人应该都知道有款插件叫做 “PlaceHolderAPI”，很经典的插件。
 * 我在今天给我网页开发网页组件时忽然想起这个插件，就不禁开始思考了，
 * 为什么网页没有这个方便的东西？于是开发了这个插件，花费了我2.5天。
 * 别问我为什么这么久，我没Token了，只能慢慢写了，而且我还要吃饭休息打游戏呢。
 * 或许有别人开发过这个吧，但我没找到，而且自家养的应该也更健康，顺便水个项目。
 * 
 * 总之这个JS是用于自动统计页面上某个样式的，并且允许统计多个，且支持运算。
 * 这么说通俗易懂吧？不对啊，你都下载了看到这个了那应该已经懂了啊，白说了。
 * 
 * Copyright（C）2026 每渡惺忪（Aluner）
 * 本代码仅供学习、交流和个人非商业使用。
 * 允许查看、学习、修改和二次开发，但修改后的版本也不得用于商业用途。
 * 如需商用，请联系作者获得授权。
 * 
 * 
 * 
 * 占位符 → 元素数量统计替换脚本（纯原生 JS，无任何依赖）
 *
 * 用法：
 *   1) 页面里写：  <p>目前已收集卡片：%shouji_card_js%</p>
 *   2) 引入脚本：  <script src="StatsVarAPI.js"></script>
 *   3) 到本文件顶部【① 配置区】改统计规则即可
 *
 * 说明：
 *   - 占位符会被替换成「纯文本节点」，所以它会完整继承父元素
 *     （如 <p>）的 color / font-size / font-weight 等全部 CSS 样式。
 *   - 如果想让数字单独拥有样式，把占位符包进一个 <span> 里，
 *     再给这个 span 写样式即可，例如：
 *     <p>目前已收集卡片：<span class="num">%shouji_card_js%</span></p>
 * -------------------------------------------------------------------
 */
;(function (global) {
  'use strict';

  /* 防止同一个页面被重复引入两次 */
  if (global.StatsVarAPI && global.StatsVarAPI.__loaded) return;

  /* =====================================================================
   * ①  配置区（你基本只需要改这里，可以写多条）
   * =====================================================================
   *
   * displayname : 占位符本体，页面上写什么这里就写什么
   * Stats       : 统计目标，多个用「英文逗号 / 中文逗号 / 分号」分隔，防呆设计
   *               · 裸词（如 card）会自动当作 class，即 .card
   *               · 也可以写任意合法 CSS 选择器：
   *                 ".card"、"#list .card"、"[data-type=card]"、"li"
   * Formulas    : 计算方式  +  -  *  /    （仅当 Stats 有 2 个及以上时生效）
   *               也兼容：加/减/乘/除、×、÷、add/sub/mul/div
   *               从左到右依次计算；除法每一步都四舍五入取整
   * Contents    : 直接写内容。非空时 Stats 与 Formulas 全部不生效
   *               只支持纯文本，不支持 HTML 标签
   * ===================================================================== */
  var CONFIG = [
    {
      displayname: '%shouji_card%',
      Stats: '.test-card, test-card',
      Formulas: '+',
      Contents: ''
    }

    /* ---- 需要多个占位符就照这个格式继续往下写 ----
    ,{
      displayname: '%shouji_jinbi_js%',
      Stats: '.coin',
      Formulas: '',
      Contents: ''
    }
    ,{
      displayname: '%shouji_total_js%',
      Stats: '.card, .coin',
      Formulas: '+',
      Contents: ''
    }
    */
  ];

  /* ================================================================
   * ②  高级选项（一般不用改）
   * ================================================================ */
  var OPTIONS = {
    separator: ', ',          // Stats 多个 + Formulas 为空时，数字之间的分隔符
    observe: true,            // 动态增删卡片后自动重新统计
    debounce: 120,            // 自动刷新的防抖时间（毫秒）
    replaceAttributes: true   // 是否也替换属性里的占位符，如 title="%shouji_card_js%"
  };

  /* ================================================================
   * ③  实现代码（以下不用改）
   * ================================================================ */
  var VERSION = '1.0.0';

  var SPLIT_RE = /[,，;；|｜]/;

  var FORMULA_MAP = {
    '+': '+', '＋': '+', '加': '+', 'add': '+', 'plus': '+',
    '-': '-', '－': '-', '—': '-', '减': '-', 'sub': '-', 'minus': '-',
    '*': '*', '×': '*', 'x': '*', 'X': '*', '乘': '*', 'mul': '*', 'times': '*',
    '/': '/', '÷': '/', '除': '/', 'div': '/', 'divide': '/'
  };

  var SKIP_TAGS = {
    SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEXTAREA: 1,
    TEMPLATE: 1, IFRAME: 1, CANVAS: 1, SVG: 1, MATH: 1
  };

  var observer = null;
  var timer = null;

  /* ---------------- 小工具 ---------------- */

  function warn(msg) {
    if (global.console && global.console.warn) {
      global.console.warn('[StatsVarAPI] ' + msg);
    }
  }

  /* 不区分大小写地读取配置字段，Stats / stats / stats 都能读到 */
  function field(cfg, key) {
    if (!cfg) return '';
    var lower = key.toLowerCase();
    for (var k in cfg) {
      if (!Object.prototype.hasOwnProperty.call(cfg, k)) continue;
      if (k.toLowerCase() === lower) {
        var v = cfg[k];
        return (v === undefined || v === null) ? '' : v;
      }
    }
    return '';
  }

  /* 裸词 → .类名；其余原样当作 CSS 选择器 */
  function toSelector(raw) {
    var s = String(raw).trim();
    if (!s) return '';
    if (/^[A-Za-z_\-][\w\-]*$/.test(s)) return '.' + s;
    return s;
  }

  function parseStats(raw) {
    if (raw === undefined || raw === null) return [];
    var parts = String(raw).split(SPLIT_RE);
    var out = [];
    for (var i = 0; i < parts.length; i++) {
      var sel = toSelector(parts[i]);
      if (sel) out.push(sel);
    }
    return out;
  }

  function countMatches(selector) {
    if (!selector) return 0;
    try {
      return document.querySelectorAll(selector).length;
    } catch (e) {
      warn('选择器无效：' + selector + '（' + e.message + '），按 0 处理');
      return 0;
    }
  }

  function normalizeFormula(raw) {
    var s = String(raw === undefined || raw === null ? '' : raw).trim();
    if (!s) return '';
    if (FORMULA_MAP[s] !== undefined) return FORMULA_MAP[s];
    var lower = s.toLowerCase();
    if (FORMULA_MAP[lower] !== undefined) return FORMULA_MAP[lower];
    warn('无法识别的计算方式：「' + s + '」，将按「依次显示」处理');
    return '';
  }

  /* 从左到右计算；除法每一步都四舍五入取整 */
  function calculate(nums, formula) {
    var r = nums[0];
    for (var i = 1; i < nums.length; i++) {
      var b = nums[i];
      if (formula === '+') {
        r = r + b;
      } else if (formula === '-') {
        r = r - b;
      } else if (formula === '*') {
        r = r * b;
      } else if (formula === '/') {
        if (b === 0) {
          warn('除数为 0，该步结果按 0 处理');
          r = 0;
        } else {
          r = Math.round(r / b);
        }
      } else {
        r = r + b;
      }
    }
    return r;
  }

  /* 计算单条配置的最终显示内容；返回 null 表示配置无效 */
  function computeValue(cfg) {
    /* Contents 优先，非空就直接用 */
    var contents = String(field(cfg, 'Contents'));
    if (contents.trim() !== '') return contents;

    var selectors = parseStats(field(cfg, 'Stats'));
    if (!selectors.length) return null;

    var nums = [];
    for (var i = 0; i < selectors.length; i++) {
      nums.push(countMatches(selectors[i]));
    }

    /* 只写了一个 Stats：Formulas 不生效，直接显示数量 */
    if (selectors.length === 1) return String(nums[0]);

    var formula = normalizeFormula(field(cfg, 'Formulas'));

    /* 多个 Stats 且 Formulas 为空：按顺序依次显示 */
    if (!formula) return nums.join(OPTIONS.separator);

    return String(calculate(nums, formula));
  }

  /* 生成 { 占位符 -> 显示值 } 映射 */
  function buildMap() {
    var values = {};
    var keys = [];
    for (var i = 0; i < CONFIG.length; i++) {
      var cfg = CONFIG[i];
      if (!cfg) continue;

      var name = String(field(cfg, 'displayname'));
      if (!name) continue;

      if (keys.indexOf(name) !== -1) {
        warn('displayname 重复：「' + name + '」，后面的配置会覆盖前面的');
      } else {
        keys.push(name);
      }

      var val = computeValue(cfg);
      if (val === null) {
        warn('配置无效（Stats 与 Contents 都为空），已跳过：「' + name + '」');
        continue;
      }
      values[name] = val;
    }
    return { values: values, keys: keys };
  }

  /* 把一个字符串里的所有占位符替换掉 */
  function applyPlaceholders(text, values, keys) {
    if (!text) return text;
    var out = text;
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (out.indexOf(k) === -1) continue;

      var v = String(values[k]);
      /* 防止 Contents 里又写了占位符造成死循环 */
      if (v.indexOf(k) !== -1) {
        warn('占位符「' + k + '」的替换结果中又包含它自己，已跳过以免死循环');
        continue;
      }
      out = out.split(k).join(v);
    }
    return out;
  }

  /* 遍历整个 body，替换文本节点与（可选）属性值 */
  function replaceInDocument(values, keys) {
    if (!document.body) return;
    if (!keys.length) return;

    var filter = NodeFilter.SHOW_TEXT;
    if (OPTIONS.replaceAttributes) filter |= NodeFilter.SHOW_ELEMENT;

    var walker = document.createTreeWalker(document.body, filter, {
      acceptNode: function (node) {
        if (node.nodeType === 1) {
          var tag = node.nodeName ? node.nodeName.toUpperCase() : '';
          return SKIP_TAGS[tag] ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
        }
        var p = node.parentNode;
        if (p && p.nodeType === 1 && SKIP_TAGS[p.nodeName.toUpperCase()]) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    }, false);

    /* 先收集再修改，避免遍历过程中结构变化 */
    var batch = [];
    var n;
    while ((n = walker.nextNode())) batch.push(n);

    for (var i = 0; i < batch.length; i++) {
      var node = batch[i];

      /* ---- 文本节点 ---- */
      if (node.nodeType === 3) {
        var oldText = node.nodeValue;
        if (!oldText) continue;
        var newText = applyPlaceholders(oldText, values, keys);
        if (newText !== oldText) node.nodeValue = newText;
        continue;
      }

      /* ---- 元素属性（可选） ---- */
      if (node.nodeType === 1 && node.attributes && node.attributes.length) {
        var attrs = node.attributes;
        for (var j = 0; j < attrs.length; j++) {
          var attr = attrs[j];
          var oldVal = attr.value;
          if (!oldVal) continue;
          var newVal = applyPlaceholders(oldVal, values, keys);
          if (newVal === oldVal) continue;

          node.setAttribute(attr.name, newVal);

          /* input / textarea 的 value 属性同步到 property 上 */
          if (attr.name === 'value' && ('value' in node)) {
            try { node.value = newVal; } catch (e) { /* 忽略 */ }
          }
        }
      }
    }
  }

  /* 执行一次完整刷新 */
  function refresh() {
    if (!document.body) return;
    var built = buildMap();
    replaceInDocument(built.values, built.keys);
  }

  /* 监听 DOM 变化，动态增删卡片后自动更新 */
  function startObserver() {
    if (!OPTIONS.observe || !global.MutationObserver || !document.body) return;

    observer = new MutationObserver(function () {
      if (timer) clearTimeout(timer);
      timer = setTimeout(function () {
        timer = null;
        refresh();
      }, OPTIONS.debounce);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  function boot() {
    refresh();
    startObserver();
  }

  /* ---------------- 对外 API ---------------- */
  global.StatsVarAPI = {
    __loaded: true,
    version: VERSION,

    /* 直接改这两个对象也能动态调整，改完调 refresh() */
    config: CONFIG,
    options: OPTIONS,

    /* 手动重新统计并替换一次 */
    refresh: refresh,

    /* 停止 DOM 监听 */
    stop: function () {
      if (observer) { observer.disconnect(); observer = null; }
      if (timer) { clearTimeout(timer); timer = null; }
    },

    /* 查询某个占位符当前应显示的值（不修改 DOM） */
    value: function (name) {
      var target = String(name);
      for (var i = 0; i < CONFIG.length; i++) {
        if (String(field(CONFIG[i], 'displayname')) === target) {
          return computeValue(CONFIG[i]);
        }
      }
      return null;
    },

    /* 查询单个选择器命中的元素数量 */
    count: function (selector) {
      return countMatches(toSelector(selector));
    }
  };

  /* ---------------- 启动 ---------------- */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, false);
  } else {
    boot();
  }

})(typeof window !== 'undefined' ? window : this);