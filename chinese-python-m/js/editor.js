(function () {
  'use strict';

  /* 编辑器主逻辑：
     1) 中文代码区：语法高亮、实时自动提示（积木补全）、函数参数提示、
        括号/引号自动配对、模板占位符（插入后自动选中待填部分）
     2) 积木面板：分类选择器 + 搜索
     3) 实时翻译、复制与下载 */

  function $(id) { return document.getElementById(id); }

  var codeInput = $('code-input');
  var hlPre = $('highlight');
  var lineNums = $('line-nums');
  var scrollBox = $('scroll-box');
  var blockList = $('block-list');
  var blockSearch = $('block-search');
  var catTabs = $('cat-tabs');
  var outputPre = $('python-output');
  var errorBox = $('error-box');
  var statusBar = $('editor-status');
  var exampleSelect = $('example-select');
  var btnSave = $('btn-save');
  var btnClear = $('btn-clear');
  var btnCopy = $('btn-copy');
  var acEl = $('autocomplete');
  var sigEl = $('sig-hint');
  var btnData = $('btn-data');
  var dataWindow = $('data-window');
  var dwHeader = $('dw-header');
  var dwBody = $('dw-body');
  var dwRefresh = $('dw-refresh');
  var dwClose = $('dw-close');
  var outTab = $('out-tab');
  var reverseTab = $('reverse-tab');
  var reversePanel = $('reverse-panel');
  var pyInput = $('py-input');
  var cnOutput = $('cn-output');
  var reverseError = $('reverse-error');
  var btnApply = $('btn-apply');
  var btnReverseCopy = $('btn-reverse-copy');
  var STORE_KEY = 'zhpy-src';
  var DW_KEY = 'zhpy-dw';
  var prevVal = null;
  var lastAnalysis = null;
  var pendingPhs = []; /* 模板里待填写的占位符，Tab 逐个跳转 */

  /* ---------- 语法高亮 ---------- */

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function wordClass(w) {
    if (KEYWORDS.indexOf(w) >= 0) return 'kw';
    if (LIB_NAMES.indexOf(w) >= 0) return 'mod';
    if (NAME_INDEX[w]) return 'fn';
    return 'var';
  }

  function highlight(text) {
    var out = '';
    var i = 0;
    var n = text.length;
    while (i < n) {
      var c = text[i];
      if (c === '\n') { out += '\n'; i++; continue; }
      if (c === '"' || c === "'" || c === '「') {
        var close = (c === '「') ? '」' : c;
        var j = i + 1;
        while (j < n && text[j] !== close) j++;
        out += '<span class="tok-str">' + esc(text.slice(i, Math.min(j + 1, n))) + '</span>';
        i = j + 1;
        continue;
      }
      if (c === '#') {
        var j2 = i;
        while (j2 < n && text[j2] !== '\n') j2++;
        out += '<span class="tok-comment">' + esc(text.slice(i, j2)) + '</span>';
        i = j2;
        continue;
      }
      if (/[0-9]/.test(c)) {
        var j3 = i;
        while (j3 < n && /[0-9.]/.test(text[j3])) j3++;
        out += '<span class="tok-num">' + esc(text.slice(i, j3)) + '</span>';
        i = j3;
        continue;
      }
      if (/[A-Za-z_\u4e00-\u9fa5]/.test(c)) {
        var j4 = i;
        while (j4 < n && /[\w\u4e00-\u9fa5]/.test(text[j4])) j4++;
        var w = text.slice(i, j4);
        out += '<span class="tok-' + wordClass(w) + '">' + esc(w) + '</span>';
        i = j4;
        continue;
      }
      out += esc(c);
      i++;
    }
    return out;
  }

  function syncEditor() {
    hlPre.innerHTML = highlight(codeInput.value) + '\n';
    var count = codeInput.value.split('\n').length;
    var nums = '';
    for (var k = 1; k <= count; k++) nums += '<span>' + k + '</span>';
    lineNums.innerHTML = nums;
    codeInput.style.height = (hlPre.scrollHeight + 2) + 'px';
    codeInput.style.width = Math.max(scrollBox.clientWidth, hlPre.scrollWidth + 2) + 'px';
  }

  scrollBox.addEventListener('scroll', function () {
    lineNums.scrollTop = scrollBox.scrollTop;
  });

  /* ---------- 实时翻译 ---------- */

  var timer = null;
  function scheduleTranslate() {
    clearTimeout(timer);
    timer = setTimeout(translate, 250);
  }

  function translate() {
    try {
      var tokens = lex(codeInput.value);
      var ast = new Parser(tokens).parseProgram();
      var res = generate(ast);
      outputPre.textContent = res.code;
      errorBox.classList.add('hidden');
      errorBox.textContent = '';
      outputPre.classList.remove('has-error');
      statusBar.textContent = '✓ 翻译成功';
      lastAnalysis = analyze(ast);
      renderDataWindow();
      renderVarBlocks();
    } catch (e) {
      outputPre.textContent = '（翻译失败，见下方错误提示）';
      errorBox.classList.remove('hidden');
      errorBox.textContent = '✗ ' + e.message;
      outputPre.classList.add('has-error');
      statusBar.textContent = '✗ 翻译失败';
      /* 翻译失败也要尽量分析：逐行扫描能产生变量的行 */
      lastAnalysis = analyzeRobust(codeInput.value);
      renderDataWindow();
      renderVarBlocks();
    }
  }

  /* ---------- 编辑操作 ---------- */

  /* 插入文本。模板里的 @@占位@@ 会被去掉标记并自动选中第一个，之后按 Tab 跳到下一个。 */
  function insertText(str) {
    var s = codeInput.selectionStart;
    var e = codeInput.selectionEnd;
    var val = codeInput.value;
    var phs = [];
    var clean = '';
    var re = /@@([^@]*)@@/g;
    var m;
    var last = 0;
    while ((m = re.exec(str)) !== null) {
      clean += str.slice(last, m.index);
      var phStart = s + clean.length;
      clean += m[1];
      phs.push({ s: phStart, e: phStart + m[1].length });
      last = re.lastIndex;
    }
    clean += str.slice(last);
    codeInput.value = val.slice(0, s) + clean + val.slice(e);
    pendingPhs = phs;
    if (phs.length) {
      codeInput.selectionStart = phs[0].s;
      codeInput.selectionEnd = phs[0].e;
    } else {
      codeInput.selectionStart = s + clean.length;
      codeInput.selectionEnd = s + clean.length;
    }
    codeInput.focus();
    prevVal = codeInput.value;
    syncEditor();
    scheduleTranslate();
  }

  /* 插入普通文本（缩进、换行），不影响占位符列表，只把后面的占位符位置顺移 */
  function insertRaw(str) {
    var s = codeInput.selectionStart;
    var e = codeInput.selectionEnd;
    var val = codeInput.value;
    codeInput.value = val.slice(0, s) + str + val.slice(e);
    var pos = s + str.length;
    codeInput.selectionStart = pos;
    codeInput.selectionEnd = pos;
    if (pendingPhs.length) {
      var delta = str.length - (e - s);
      var upd = [];
      for (var i = 0; i < pendingPhs.length; i++) {
        var ph = pendingPhs[i];
        if (ph.e <= ph.s) continue;
        if (ph.s <= s && s < ph.e) continue; /* 光标在占位符里 → 跳过这个占位符 */
        if (ph.s >= s) { ph.s += delta; ph.e += delta; }
        if (ph.e > ph.s) upd.push(ph);
      }
      pendingPhs = upd;
    }
    codeInput.focus();
    prevVal = codeInput.value;
    syncEditor();
    scheduleTranslate();
  }

  /* 跳转到下一个待填写的占位符 */
  function jumpToNextPlaceholder() {
    if (!pendingPhs.length) return false;
    var cur = codeInput.selectionStart;
    var next = null;
    for (var i = 0; i < pendingPhs.length; i++) {
      if (pendingPhs[i].s >= cur) { next = pendingPhs[i]; break; }
    }
    if (!next) next = pendingPhs[0];
    if (next.e <= next.s) { pendingPhs = []; return false; }
    codeInput.setSelectionRange(next.s, next.e);
    codeInput.focus();
    return true;
  }

  codeInput.addEventListener('keydown', function (ev) {
    if (ev.isComposing || ev.keyCode === 229) return; /* 中文输入法组词中 */
    if (acVisible) {
      if (ev.key === 'ArrowDown') { ev.preventDefault(); acMove(1); return; }
      if (ev.key === 'ArrowUp') { ev.preventDefault(); acMove(-1); return; }
      if (ev.key === 'Enter' || ev.key === 'Tab') { ev.preventDefault(); acPick(); return; }
      if (ev.key === 'Escape') { ev.preventDefault(); hideAc(); return; }
      return;
    }
    if (ev.key === 'Tab') {
      ev.preventDefault();
      if (!jumpToNextPlaceholder()) insertRaw('    ');
      return;
    }
    if (ev.key === 'Enter') {
      ev.preventDefault();
      var val = codeInput.value;
      var s = codeInput.selectionStart;
      var lineStart = val.lastIndexOf('\n', s - 1) + 1;
      var line = val.slice(lineStart, s);
      var ind = line.match(/^[ \t]*/)[0];
      var extra = (/[:：]\s*$/.test(line)) ? '    ' : '';
      insertRaw('\n' + ind + extra);
      return;
    }
    if (ev.key === 'Escape') { hideSig(); return; }
    /* 自动成对括号/引号：再按一次闭口时跳过它 */
    var closes = { ')': ')', '）': '）', '"': '"', "'": "'", '」': '」' };
    if (closes[ev.key] !== undefined) {
      var cur = codeInput.selectionStart;
      if (codeInput.value.charAt(cur) === closes[ev.key]) {
        ev.preventDefault();
        codeInput.selectionStart = cur + 1;
        codeInput.selectionEnd = cur + 1;
        updateSigHint();
      }
    }
  });

  codeInput.addEventListener('input', function (ev) {
    /* 自动成对：输入 （ ( 「 " ' 时补上闭口 */
    var v = codeInput.value;
    var prev = prevVal;
    if (prev !== null) {
      var p = 0;
      while (p < prev.length && p < v.length && prev[p] === v[p]) p++;
      var q1 = prev.length - 1;
      var q2 = v.length - 1;
      while (q1 >= p && q2 >= p && prev[q1] === v[q2]) { q1--; q2--; }
      var inserted = v.slice(p, q2 + 1);
      if (inserted.length === 1) {
        var close = { '（': '）', '(': ')', '「': '」', '"': '"', "'": "'" }[inserted];
        if (close) {
          var caret = codeInput.selectionStart;
          if (v.charAt(caret) !== close) {
            v = v.slice(0, caret) + close + v.slice(caret);
            codeInput.value = v;
          }
        }
      }
    }
    prevVal = codeInput.value;
    /* 占位符位置随编辑顺移；填完的（光标停在其中的）自动移除 */
    if (pendingPhs.length) {
      var caret = codeInput.selectionStart;
      var delta = codeInput.value.length - prev.length;
      var upd = [];
      for (var i = 0; i < pendingPhs.length; i++) {
        var ph = pendingPhs[i];
        if (ph.e <= ph.s) continue;
        if (ph.s <= caret && caret <= ph.e) continue;
        if (caret <= ph.s) { ph.s += delta; ph.e += delta; }
        if (ph.e > ph.s) upd.push(ph);
      }
      pendingPhs = upd;
    }
    syncEditor();
    scheduleTranslate();
    updateAutocomplete();
    updateSigHint();
    try { localStorage.setItem(STORE_KEY, codeInput.value); } catch (e) { /* 忽略 */ }
  });

  codeInput.addEventListener('blur', function () { hideAc(); hideSig(); });
  codeInput.addEventListener('click', function () { updateAutocomplete(); updateSigHint(); });
  codeInput.addEventListener('keyup', updateSigHint);

  /* ---------- 输入自动提示（积木补全） ---------- */

  var acItems = [];
  var acIndex = 0;
  var acVisible = false;
  var acWordStart = -1;

  function caretPos() {
    var mirror = document.createElement('div');
    var st = getComputedStyle(codeInput);
    ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing',
      'paddingLeft', 'paddingRight', 'paddingTop', 'paddingBottom', 'tabSize', 'whiteSpace'
    ].forEach(function (prop) {
      try { mirror.style[prop] = st[prop]; } catch (e) { /* 忽略 */ }
    });
    mirror.style.position = 'absolute';
    mirror.style.left = '-9999px';
    mirror.style.top = '0';
    mirror.style.visibility = 'hidden';
    mirror.style.whiteSpace = 'pre';
    var upTo = codeInput.value.slice(0, codeInput.selectionStart);
    mirror.textContent = upTo;
    var sp = document.createElement('span');
    sp.textContent = '一';
    mirror.appendChild(sp);
    document.body.appendChild(mirror);
    var mr = mirror.getBoundingClientRect();
    var sr = sp.getBoundingClientRect();
    var x = sr.left - mr.left;
    var y = sr.top - mr.top;
    document.body.removeChild(mirror);
    return { x: x, y: y };
  }

  function catLabel(b) {
    if (b.lib) return b.lib.name;
    if (b.cat) return b.cat.replace('库·', '');
    return '';
  }

  function updateAutocomplete() {
    var s = codeInput.selectionStart;
    var before = codeInput.value.slice(0, s);
    var m = before.match(/[\w\u4e00-\u9fa5]+$/);
    if (!m) { hideAc(); return; }
    var word = m[0];
    var items = [];
    var seen = {};
    FN_NAMES.forEach(function (n) {
      if (!seen[n] && n.indexOf(word) === 0) {
        seen[n] = 1;
        items.push(NAME_INDEX[n]);
      }
    });
    KEYWORDS.forEach(function (k) {
      if (!seen[k] && k.indexOf(word) === 0) {
        seen[k] = 1;
        var b = NAME_INDEX[k];
        items.push(b ? b : { name: k, snippet: k, desc: '中文关键字' });
      }
    });
    if (lastAnalysis) {
      lastAnalysis.variables.forEach(function (v) {
        if (!seen[v.name] && v.name.indexOf(word) === 0) {
          seen[v.name] = 1;
          items.push({ name: v.name, snippet: v.name, desc: '变量 · ' + v.type });
        }
      });
    }
    if (!items.length) { hideAc(); return; }
    acItems = items.slice(0, 8);
    acIndex = 0;
    acWordStart = s - word.length;
    acEl.innerHTML = '';
    acItems.forEach(function (it, idx) {
      var d = document.createElement('div');
      d.className = 'ac-item' + (idx === 0 ? ' selected' : '');
      var nm = document.createElement('span');
      nm.className = 'ac-name';
      nm.textContent = it.name;
      var cat = document.createElement('span');
      cat.className = 'ac-cat';
      cat.textContent = catLabel(it);
      var ds = document.createElement('span');
      ds.className = 'ac-desc';
      ds.textContent = (it.desc || it.example || '');
      d.appendChild(nm);
      d.appendChild(cat);
      d.appendChild(ds);
      d.addEventListener('mousedown', function (ev) { ev.preventDefault(); acPick(); });
      acEl.appendChild(d);
    });
    var cp = caretPos();
    var st = getComputedStyle(codeInput);
    acEl.style.top = (cp.y + parseFloat(st.lineHeight) + 4 - scrollBox.scrollTop) + 'px';
    acEl.style.left = (cp.x - scrollBox.scrollLeft + 6) + 'px';
    acEl.classList.remove('hidden');
    acVisible = true;
  }

  function acMove(d) {
    acIndex = (acIndex + d + acItems.length) % acItems.length;
    var nodes = acEl.children;
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].className = 'ac-item' + (i === acIndex ? ' selected' : '');
    }
    var sel = nodes[acIndex];
    if (sel && sel.scrollIntoView) sel.scrollIntoView({ block: 'nearest' });
  }

  function acPick() {
    if (!acVisible || acIndex < 0) return;
    var it = acItems[acIndex];
    var snippet = it.snippet || it.name;
    hideAc();
    if (acWordStart >= 0) {
      var end = codeInput.selectionStart;
      codeInput.setSelectionRange(acWordStart, end);
      insertText(snippet);
    }
  }

  function hideAc() {
    acVisible = false;
    acEl.classList.add('hidden');
    acEl.innerHTML = '';
  }

  /* ---------- 函数参数提示（语法辅助） ---------- */

  function hideSig() {
    sigEl.classList.add('hidden');
    sigEl.innerHTML = '';
  }

  function libCode(lib) { return lib.alias || lib.module; }

  function updateSigHint() {
    if (document.activeElement !== codeInput) { hideSig(); return; }
    var s = codeInput.selectionStart;
    var before = codeInput.value.slice(0, s);
    var openIdx = before.lastIndexOf('(');
    if (openIdx < 0) { hideSig(); return; }
    if (before.slice(openIdx + 1).indexOf(')') >= 0) { hideSig(); return; }
    var m = before.slice(0, openIdx).match(/[\w\u4e00-\u9fa5]+$/);
    if (!m) { hideSig(); return; }
    var name = m[0];
    var b = NAME_INDEX[name];
    if (!b) { hideSig(); return; }

    /* 判断是不是函数调用（名字后面跟括号） */
    var callLike = false;
    var sigArgs = '…';
    if (b.lib) {
      callLike = true;
    } else if (b.snippet) {
      var cleaned = b.snippet.replace(/@@([^@]*)@@/g, '$1');
      var mm = cleaned.match(/^[\w\u4e00-\u9fa5]+\(([^)]*)\)/);
      if (mm) { callLike = true; sigArgs = mm[1]; }
    }
    if (!callLike) { hideSig(); return; }

    var en = '';
    if (b.lib) en = b.template ? b.template.replace(/@module@/g, libCode(b.lib)).replace(/@args@/g, '…') : libCode(b.lib) + '.' + b.target + '(…)';
    else if (BUILTINS[name]) en = BUILTINS[name] + '(…)';

    sigEl.innerHTML =
      '<div><span class="sig-name">' + esc(name) + '(' + esc(sigArgs) + ')</span>' +
      (en ? ' <span class="sig-en">→ ' + esc(en) + '</span>' : '') + '</div>' +
      (b.desc ? '<div class="sig-desc">' + esc(b.desc) + '</div>' : '') +
      (b.example ? '<div class="sig-ex">示例：' + esc(b.example) + '</div>' : '');

    var cp = caretPos();
    var st = getComputedStyle(codeInput);
    sigEl.style.top = (cp.y + parseFloat(st.lineHeight) + 4 - scrollBox.scrollTop) + 'px';
    sigEl.style.left = (cp.x - scrollBox.scrollLeft + 6) + 'px';
    sigEl.classList.remove('hidden');
  }

  /* ---------- 积木面板（分类选择器 + 搜索） ---------- */

  var currentCat = '全部';

  function buildCatTabs() {
    var tabs = ['全部', '变量', '逻辑', '数据', '运算符', '列表', '文本', '进阶', '错误'];
    LIBRARIES.forEach(function (l) { tabs.push(l.name); });
    catTabs.innerHTML = '';
    tabs.forEach(function (t) {
      var d = document.createElement('span');
      d.className = 'cat-tab' + (t === currentCat ? ' active' : '');
      d.textContent = t;
      d.addEventListener('click', function () {
        currentCat = t;
        renderCatTabs();
        renderBlockList();
      });
      catTabs.appendChild(d);
    });
  }

  function renderCatTabs() {
    var tabs = catTabs.children;
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].className = 'cat-tab' + (tabs[i].textContent === currentCat ? ' active' : '');
    }
  }

  function makeBlockEl(b) {
    var d = document.createElement('div');
    d.className = 'block';
    var nm = document.createElement('div');
    nm.className = 'b-name';
    nm.textContent = b.name;
    var ds = document.createElement('div');
    ds.className = 'b-desc';
    ds.textContent = b.desc || '';
    d.appendChild(nm);
    d.appendChild(ds);
    if (b.example) d.title = '示例：' + b.example;
    d.addEventListener('click', function () { insertText(b.snippet || b.name); });
    return d;
  }

  function renderBlockList() {
    blockList.innerHTML = '';
    if (currentCat === '变量') { renderVarBlocks(); return; }
    if (currentCat === '全部') {
      var groups = [
        ['变量', VAR_BLOCKS],
        ['逻辑', LOGIC_BLOCKS],
        ['数据', DATA_BLOCKS],
        ['列表', LIST_BLOCKS],
        ['文本', TEXT_BLOCKS],
        ['运算符', OP_BLOCKS],
        ['进阶', ADV_BLOCKS],
        ['错误', ERR_BLOCKS]
      ];
      LIBRARIES.forEach(function (lib) {
        groups.push(['库·' + lib.name, lib.blocks.map(function (b) {
          return { name: b.name, snippet: b.name, desc: b.desc, example: b.example };
        })]);
      });
      groups.forEach(function (g) {
        var title = document.createElement('div');
        title.className = 'cat-head';
        title.textContent = g[0];
        blockList.appendChild(title);
        g[1].forEach(function (b) { blockList.appendChild(makeBlockEl(b)); });
      });
      return;
    }
    var blocks = null;
    if (currentCat === '逻辑') blocks = LOGIC_BLOCKS;
    else if (currentCat === '数据') blocks = DATA_BLOCKS;
    else if (currentCat === '运算符') blocks = OP_BLOCKS;
    else if (currentCat === '列表') blocks = LIST_BLOCKS;
    else if (currentCat === '文本') blocks = TEXT_BLOCKS;
    else if (currentCat === '进阶') blocks = ADV_BLOCKS;
    else if (currentCat === '错误') blocks = ERR_BLOCKS;
    else {
      var lib = null;
      for (var i = 0; i < LIBRARIES.length; i++) {
        if (LIBRARIES[i].name === currentCat) { lib = LIBRARIES[i]; break; }
      }
      if (lib) {
        blocks = lib.blocks.map(function (b) {
          return { name: b.name, snippet: b.name, desc: b.desc, example: b.example };
        });
      } else {
        blocks = [];
      }
    }
    blocks.forEach(function (b) { blockList.appendChild(makeBlockEl(b)); });
  }

  blockSearch.addEventListener('input', function () {
    var q = blockSearch.value.trim();
    var blocks = blockList.querySelectorAll('.block');
    var heads = blockList.querySelectorAll('.cat-head');
    blocks.forEach(function (b) {
      b.style.display = (!q || b.textContent.indexOf(q) >= 0) ? '' : 'none';
    });
    heads.forEach(function (h) {
      var any = false;
      var cur = h.nextElementSibling;
      while (cur && !cur.classList.contains('cat-head')) {
        if (cur.style.display !== 'none') any = true;
        cur = cur.nextElementSibling;
      }
      h.style.display = any ? '' : 'none';
    });
  });

  /* ---------- 反向翻译（Python → 中文） ---------- */

  var lastCnCode = null;

  function setOutMode(reverse) {
    outTab.classList.toggle('active', !reverse);
    reverseTab.classList.toggle('active', reverse);
    reversePanel.classList.toggle('hidden', !reverse);
    $('python-output').classList.toggle('hidden', reverse);
    errorBox.classList.toggle('hidden', reverse);
  }
  outTab.addEventListener('click', function () { setOutMode(false); });
  reverseTab.addEventListener('click', function () { setOutMode(true); pyInput.focus(); });

  var reverseTimer = null;
  function doReverse() {
    var r = pythonToChinese(pyInput.value);
    if (r.ok) {
      lastCnCode = r.code;
      cnOutput.textContent = r.code;
      reverseError.classList.add('hidden');
      reverseError.textContent = '';
      cnOutput.classList.remove('has-error');
    } else {
      lastCnCode = null;
      cnOutput.textContent = '';
      reverseError.classList.remove('hidden');
      reverseError.textContent = '✗ ' + r.err;
      cnOutput.classList.add('has-error');
    }
  }
  pyInput.addEventListener('input', function () {
    clearTimeout(reverseTimer);
    reverseTimer = setTimeout(doReverse, 250);
  });

  btnApply.addEventListener('click', function () {
    if (!lastCnCode) return;
    codeInput.value = lastCnCode;
    prevVal = lastCnCode;
    pendingPhs = [];
    codeInput.focus();
    syncEditor();
    translate();
    try { localStorage.setItem(STORE_KEY, lastCnCode); } catch (e) { /* 忽略 */ }
  });

  btnReverseCopy.addEventListener('click', function () {
    var t = cnOutput.textContent;
    if (!t) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t).then(function () {
        btnReverseCopy.textContent = '已复制';
        setTimeout(function () { btnReverseCopy.textContent = '复制'; }, 1200);
      }).catch(function () { copyFallback(t, btnReverseCopy); });
    } else {
      copyFallback(t, btnReverseCopy);
    }
  });

  /* ---------- 数据窗口（变量与数据 / 函数返回） ---------- */

  function chipClass(t) {
    var map = {
      整数: 'num', 小数: 'num', 数字: 'num', 文本: 'str', 布尔: 'bool',
      列表: 'list', 集合: 'list', 字典: 'dict', 元组: 'list', 空: 'none', 未知: 'unknown',
      响应: 'resp', 会话: 'resp', 网址组件: 'resp', 窗口: 'obj', 控件: 'obj',
      文件: 'obj', 错误: 'obj', 字节串: 'str', 日期时间: 'date', 日期: 'date'
    };
    return map[t] || 'unknown';
  }

  function renderDataWindow() {
    dwBody.innerHTML = '';
    if (!lastAnalysis) {
      var ne = document.createElement('div');
      ne.className = 'dw-empty';
      ne.textContent = '（当前有语法错误，无法分析数据）';
      dwBody.appendChild(ne);
      return;
    }
    if (lastAnalysis.partial) {
      var tip = document.createElement('div');
      tip.className = 'dw-empty';
      tip.textContent = '（代码里有语法错误，已尽力分析：能解析的行照常收集变量）';
      dwBody.appendChild(tip);
    }

    /* 变量与数据 */
    if (lastAnalysis.variables.length) {
      var sec = document.createElement('div');
      sec.className = 'dw-sec';
      sec.textContent = '变量与数据（点击插入）';
      dwBody.appendChild(sec);
      lastAnalysis.variables.forEach(function (v) {
        var row = document.createElement('div');
        row.className = 'dw-row';
        row.title = '点击插入「' + v.name + '」';
        var l1 = document.createElement('div');
        l1.className = 'dw-line1';
        var nm = document.createElement('span');
        nm.className = 'dw-name';
        nm.textContent = v.name;
        var chip = document.createElement('span');
        chip.className = 'chip chip-' + chipClass(v.type);
        chip.textContent = v.type || '未知';
        var src = document.createElement('span');
        src.className = 'dw-src';
        src.textContent = v.source;
        l1.appendChild(nm);
        l1.appendChild(chip);
        l1.appendChild(src);
        var val = document.createElement('div');
        val.className = 'dw-val';
        val.textContent = '= ' + v.value;
        row.appendChild(l1);
        row.appendChild(val);
        row.addEventListener('click', function () { insertVarName(v.name); });
        dwBody.appendChild(row);
      });
    } else {
      var e = document.createElement('div');
      e.className = 'dw-empty';
      e.textContent = '还没有变量。用「令 变量 = 值」或「变量 = 输入("提示")」创建变量。';
      dwBody.appendChild(e);
    }

    /* 函数返回 */
    if (lastAnalysis.functions.length) {
      var sec2 = document.createElement('div');
      sec2.className = 'dw-sec';
      sec2.textContent = '函数返回（点击插入调用）';
      dwBody.appendChild(sec2);
      lastAnalysis.functions.forEach(function (f) {
        var row = document.createElement('div');
        row.className = 'dw-row';
        row.title = '点击插入「' + f.name + '(' + '」';
        var l1 = document.createElement('div');
        l1.className = 'dw-line1';
        var nm = document.createElement('span');
        nm.className = 'dw-name';
        nm.textContent = f.name + '(' + f.params.join(', ') + ')';
        l1.appendChild(nm);
        if (f.returnType) {
          var chip = document.createElement('span');
          chip.className = 'chip chip-' + chipClass(f.returnType);
          chip.textContent = f.returnType;
          l1.appendChild(chip);
        }
        var val = document.createElement('div');
        val.className = 'dw-val';
        val.textContent = f.returnText !== undefined ? '返回：' + f.returnText : '（此函数没有返回值）';
        row.appendChild(l1);
        row.appendChild(val);
        row.addEventListener('click', function () { insertText(f.name + '(@@@@)'); });
        dwBody.appendChild(row);
      });
    }
  }

  /* 「变量」分类：变量操作积木 + 已声明的变量（可点击插入） */
  function renderVarBlocks() {
    blockList.innerHTML = '';
    VAR_BLOCKS.forEach(function (b) { blockList.appendChild(makeBlockEl(b)); });
    var title = document.createElement('div');
    title.className = 'cat-head';
    title.textContent = '已声明的变量（点击插入）';
    blockList.appendChild(title);
    if (!lastAnalysis || !lastAnalysis.variables.length) {
      var h = document.createElement('div');
      h.className = 'dw-empty';
      h.textContent = '（还没有变量。用「令 变量 = 值」或「变量 = 输入("提示")」创建后，会出现在这里）';
      blockList.appendChild(h);
      return;
    }
    lastAnalysis.variables.forEach(function (v) {
      var d = document.createElement('div');
      d.className = 'block';
      var nm = document.createElement('div');
      nm.className = 'b-name';
      nm.textContent = v.name;
      var ds = document.createElement('div');
      ds.className = 'b-desc';
      ds.textContent = v.type + '｜' + v.value;
      d.appendChild(nm);
      d.appendChild(ds);
      d.addEventListener('click', function () { insertText(v.name); });
      blockList.appendChild(d);
    });
  }

  function insertVarName(name) {
    codeInput.focus();
    insertText(name);
  }

  /* 数据窗口的开关与拖动 */
  var dwOpenState = 'open';
  try { dwOpenState = localStorage.getItem(DW_KEY) || 'open'; } catch (e) { /* 忽略 */ }
  function setDwOpen(open) {
    dataWindow.classList.toggle('hidden', !open);
    btnData.classList.toggle('active', open);
    try { localStorage.setItem(DW_KEY, open ? 'open' : 'closed'); } catch (e) { /* 忽略 */ }
  }
  btnData.addEventListener('click', function () {
    setDwOpen(dataWindow.classList.contains('hidden'));
  });
  dwClose.addEventListener('click', function () { setDwOpen(false); });
  dwRefresh.addEventListener('click', translate);

  var dragging = false, dragX = 0, dragY = 0;
  dwHeader.addEventListener('mousedown', function (ev) {
    if (ev.target.tagName === 'BUTTON') return;
    var r = dataWindow.getBoundingClientRect();
    dragX = ev.clientX - r.left;
    dragY = ev.clientY - r.top;
    dragging = true;
    ev.preventDefault();
  });
  document.addEventListener('mousemove', function (ev) {
    if (!dragging) return;
    var x = ev.clientX - dragX;
    var y = ev.clientY - dragY;
    x = Math.max(0, Math.min(x, window.innerWidth - 60));
    y = Math.max(0, Math.min(y, window.innerHeight - 40));
    dataWindow.style.left = x + 'px';
    dataWindow.style.top = y + 'px';
  });
  document.addEventListener('mouseup', function () { dragging = false; });

  /* ---------- 顶部按钮 ---------- */

  exampleSelect.innerHTML = '';
  EXAMPLES.forEach(function (ex, i) {
    var o = document.createElement('option');
    o.value = i;
    o.textContent = ex.name;
    exampleSelect.appendChild(o);
  });
  exampleSelect.addEventListener('change', function () {
    var ex = EXAMPLES[+exampleSelect.value];
    if (!ex) return;
    codeInput.value = ex.code;
    prevVal = ex.code;
    pendingPhs = [];
    codeInput.focus();
    syncEditor();
    translate();
  });

  btnSave.addEventListener('click', function () {
    var blob = new Blob([outputPre.textContent], { type: 'text/x-python' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '中文程序.py';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  });

  btnClear.addEventListener('click', function () {
    codeInput.value = '';
    prevVal = '';
    pendingPhs = [];
    codeInput.focus();
    syncEditor();
    translate();
    try { localStorage.removeItem(STORE_KEY); } catch (e) { /* 忽略 */ }
  });

  function copyFallback(t, btn) {
    btn = btn || btnCopy;
    var ta = document.createElement('textarea');
    ta.value = t;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); btn.textContent = '已复制'; }
    catch (e) { btn.textContent = '复制失败'; }
    document.body.removeChild(ta);
    setTimeout(function () { btn.textContent = '复制'; }, 1200);
  }

  btnCopy.addEventListener('click', function () {
    var t = outputPre.textContent;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t).then(function () {
        btnCopy.textContent = '已复制';
        setTimeout(function () { btnCopy.textContent = '复制'; }, 1200);
      }).catch(function () { copyFallback(t); });
    } else {
      copyFallback(t);
    }
  });

  /* ---------- 初始化 ---------- */

  buildCatTabs();
  renderBlockList();
  var mobileViewport = window.matchMedia('(max-width: 767px)');
  if (mobileViewport.matches) {
    document.querySelector('.help').open = false;
  }
  var initCode = null;
  try { initCode = localStorage.getItem(STORE_KEY); } catch (e) { /* 忽略 */ }
  if (initCode === null || initCode === '') initCode = EXAMPLES[0].code;
  codeInput.value = initCode;
  prevVal = initCode;
  pendingPhs = [];
  syncEditor();
  translate();
  setDwOpen(mobileViewport.matches ? false : dwOpenState === 'open');
  if (!mobileViewport.matches) codeInput.focus();
  window.addEventListener('resize', function () {
    if (mobileViewport.matches) syncEditor();
  });
})();
