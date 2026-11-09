/*!
 * StatsVarAPI.js  v1.0.0（Stats Variable API）
 * --------------------------------------------------------------------------------------------------------------------------------------------------------------
 * The purpose and introduction of this JS development, as well as the usage instructions (November 6, 2026):
 * There is a game called Minecraft, and I started running my own Minecraft server at the age of 14 until I ended it at the age of 19.
 * Those who also operate Minecraft servers should know about a classic Minecraft server plugin called 'PlaceHolderAPI'.
 * When I was developing web components for my website today, I suddenly remembered this plugin and couldn't help but think of it,
 * Why doesn't the webpage have this convenient thing? So I developed this plugin, which took me 2.5 days.
 * Don't ask me why it's been so long, I don't have any tokens left, I can only write slowly, and I also have to eat, rest, and play games.
 * Perhaps someone else has developed a project with similar functionality, but I couldn't find it.
 * 
 * In short, this JS is used for automatically counting a certain style on a page, allowing for the counting of multiple styles and supporting their computation.
 * Is that easy to understand? No, you've already downloaded and seen this, so you should already understand. It's just a waste of time.
 * 
 * Copyright（C）2026 每渡惺忪（Aluner）
 * This code is for learning, communication, and personal non-commercial use only。
 * Allow viewing, learning, modification, and secondary development, but the modified version cannot be used for commercial purposes。
 * If commercial use is required, please contact the author for authorization。
 * 
 * 
 * 
 * Because my English is not good, I use machine translation. If there is a problem with this JS, 
 * it may be because I accidentally scraped the code during translation. 
 * You can download the Chinese version of JS to use, which will definitely work.
 * 
 * 
 * 
 * Placeholder → Element Count Replacement Script (pure native JS, no dependencies)
 *
 * usage：
 *   1) Write on the page：  <p>Currently collected cards：%shouji_card_js%</p>
 *   2) Introduce Script：  <script src="StatsVarAPI.js"></script>
 *   3) Go to the top of this document 【 ① Configuration Area 】 to change the statistical rules
 *
 * Explanation：
 *   - The placeholder will be replaced with a 「plain text node」, so it will inherit the parent element completely
 *     All CSS styles such as color/font size/font weight in (e.g.<p>)。
 *   - If you want numbers to have their own style, wrap placeholders in a <span>，
 *     Just write a style for this span, for example：
 *     <p>Currently collected cards：<span class="num">%shouji_card_js%</span></p>
 * --------------------------------------------------------------------------------------------------------------------------------------------------------------
 */
;(function (global) {
  'use strict';

  /* Prevent introducing this script twice on the same page from causing confusion */
  if (global.StatsVarAPI && global.StatsVarAPI.__loaded) return;

  /* =============================================================================================================================
   * ①  Configuration area (you only need to make changes here, you can write multiple entries)
   * =============================================================================================================================
   *
   * displayname : Placeholder ontology, write whatever is written on the page here
   * Stats       : Statistical objectives, multiple separated by "English comma/Chinese comma/semicolon", foolproof design
   *               · Naked words (such as' card ') will automatically be treated as a class, i.e.'. card '
   *               · You can also write any valid CSS selector：
   *                 ".card"、"#list .card"、"[data-type=card]"、"li"
   * Formulas    : calculation method  +  -  *  /    （Only effective when there are 2 or more 'Stats'）
   *               Also compatible：加/减/乘/除、×、÷、add/sub/mul/div
   *               Calculate from left to right in sequence; Each step of division is rounded to the nearest whole
   * Contents    : Write the content directly. Non empty time 'Stats' and' Formulas' do not take effect at all
   *               Only supports plain text, not HTML tags.
   * ============================================================================================================================= */
  var CONFIG = [
    {
      displayname: '%shouji_card%',
      Stats: '.test-card, test-card',
      Formulas: '+',
      Contents: ''
    }

    /* ---- When multiple placeholders are needed, continue writing in this format ----
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
   * ②  Advanced options (generally do not need to be changed)
   * ================================================================ */
  var OPTIONS = {
    separator: ', ',          // When there are multiple class names in the "Stats" project and "Formulas" is also empty, the delimiter between numbers
    observe: true,            // Automatically recalculate after dynamically adding or deleting cards
    debounce: 120,            // Automatic refresh anti shake time (milliseconds)
    replaceAttributes: true   // Do you also replace placeholders in attributes, such as: title="%shouji_card_js%"
  };

  /* ================================================================
   * ③  Implement code (no need to modify below)
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

  /* ---------------- gadget ---------------- */

  function warn(msg) {
    if (global.console && global.console.warn) {
      global.console.warn('[StatsVarAPI] ' + msg);
    }
  }

  /* Read configuration fields case insensitive，Stats/stats/stats can be read */
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

  /* Naked word → .class name; the rest remains as CSS selectors */
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
      warn('Invalid selector：' + selector + '（' + e.message + '），Handle as 0');
      return 0;
    }
  }

  function normalizeFormula(raw) {
    var s = String(raw === undefined || raw === null ? '' : raw).trim();
    if (!s) return '';
    if (FORMULA_MAP[s] !== undefined) return FORMULA_MAP[s];
    var lower = s.toLowerCase();
    if (FORMULA_MAP[lower] !== undefined) return FORMULA_MAP[lower];
    warn('Unrecognized calculation method：「' + s + '」，Process according to 「display in sequence」');
    return '';
  }

  /* Calculate from left to right; Each step of division is rounded to the nearest whole */
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
          warn('If the divisor is 0, the result of this step will be treated as 0');
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

  /* Calculate the final display content of a single configuration; Returning null indicates invalid configuration */
  function computeValue(cfg) {
    /* Contents priority, use directly if not empty */
    var contents = String(field(cfg, 'Contents'));
    if (contents.trim() !== '') return contents;

    var selectors = parseStats(field(cfg, 'Stats'));
    if (!selectors.length) return null;

    var nums = [];
    for (var i = 0; i < selectors.length; i++) {
      nums.push(countMatches(selectors[i]));
    }

    /* Only wrote one Stats: Formulas does not take effect, display quantity directly */
    if (selectors.length === 1) return String(nums[0]);

    var formula = normalizeFormula(field(cfg, 'Formulas'));

    /* Multiple Stats with empty Formulas: Display in order */
    if (!formula) return nums.join(OPTIONS.separator);

    return String(calculate(nums, formula));
  }

  /* Generate {Placeholder -> Display Value} mapping */
  function buildMap() {
    var values = {};
    var keys = [];
    for (var i = 0; i < CONFIG.length; i++) {
      var cfg = CONFIG[i];
      if (!cfg) continue;

      var name = String(field(cfg, 'displayname'));
      if (!name) continue;

      if (keys.indexOf(name) !== -1) {
        warn('displayname repeat：「' + name + '」，The subsequent configuration will overwrite the previous one');
      } else {
        keys.push(name);
      }

      var val = computeValue(cfg);
      if (val === null) {
        warn('Invalid configuration (both Stats and Contents are empty), skipped：「' + name + '」');
        continue;
      }
      values[name] = val;
    }
    return { values: values, keys: keys };
  }

  /* Replace all placeholders in a string */
  function applyPlaceholders(text, values, keys) {
    if (!text) return text;
    var out = text;
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (out.indexOf(k) === -1) continue;

      var v = String(values[k]);
      /* Prevent placeholders from being written in Contents and causing a dead loop */
      if (v.indexOf(k) !== -1) {
        warn('placeholder「' + k + '」The replacement result also includes itself, which has been skipped to avoid a dead loop');
        continue;
      }
      out = out.split(k).join(v);
    }
    return out;
  }

  /* Traverse the entire body, replace text nodes and (optional) attribute values */
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

    /* Collect first and then modify to avoid structural changes during traversal */
    var batch = [];
    var n;
    while ((n = walker.nextNode())) batch.push(n);

    for (var i = 0; i < batch.length; i++) {
      var node = batch[i];

      /* ---- Text Node ---- */
      if (node.nodeType === 3) {
        var oldText = node.nodeValue;
        if (!oldText) continue;
        var newText = applyPlaceholders(oldText, values, keys);
        if (newText !== oldText) node.nodeValue = newText;
        continue;
      }

      /* ---- Element attribute (optional) ---- */
      if (node.nodeType === 1 && node.attributes && node.attributes.length) {
        var attrs = node.attributes;
        for (var j = 0; j < attrs.length; j++) {
          var attr = attrs[j];
          var oldVal = attr.value;
          if (!oldVal) continue;
          var newVal = applyPlaceholders(oldVal, values, keys);
          if (newVal === oldVal) continue;

          node.setAttribute(attr.name, newVal);

          /* Synchronize the value attribute of input/textarea to property */
          if (attr.name === 'value' && ('value' in node)) {
            try { node.value = newVal; } catch (e) { /* Ignore */ }
          }
        }
      }
    }
  }

  /* Perform a complete refresh once */
  function refresh() {
    if (!document.body) return;
    var built = buildMap();
    replaceInDocument(built.values, built.keys);
  }

  /* Monitor DOM changes and automatically update after dynamically adding or deleting cards */
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

  /* ---------------- External API ---------------- */
  global.StatsVarAPI = {
    __loaded: true,
    version: VERSION,

    /* Modifying these two objects directly can also be dynamically adjusted. After modification, call refresh() */
    config: CONFIG,
    options: OPTIONS,

    /* Manually recalculate and replace once */
    refresh: refresh,

    /* Stop DOM listening */
    stop: function () {
      if (observer) { observer.disconnect(); observer = null; }
      if (timer) { clearTimeout(timer); timer = null; }
    },

    /* Query the current value that a placeholder should display (without modifying the DOM) */
    value: function (name) {
      var target = String(name);
      for (var i = 0; i < CONFIG.length; i++) {
        if (String(field(CONFIG[i], 'displayname')) === target) {
          return computeValue(CONFIG[i]);
        }
      }
      return null;
    },

    /* Query the number of elements hit by a single selector */
    count: function (selector) {
      return countMatches(toSelector(selector));
    }
  };

  /* ---------------- Start ---------------- */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, false);
  } else {
    boot();
  }

})(typeof window !== 'undefined' ? window : this);