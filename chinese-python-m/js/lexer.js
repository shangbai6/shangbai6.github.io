(function (global) {
  'use strict';

  /* 词法分析器：把中文代码切成一个个“单词”（记号）。
     支持中文关键字、中文运算符词（加/减/乘/且/或…）、全角标点，
     也支持运算符与变量紧贴的写法：a大于等于1、年龄大于等于18、n乘n。 */

  var WORD_OPS = {
    '等于': '==', '不等于': '!=', '大于': '>', '小于': '<',
    '大于等于': '>=', '小于等于': '<=',
    '加': '+', '减': '-', '乘': '*', '除以': '/', '取余': '%', '取整': '//', '幂': '**',
    '增加': '+=', '减少': '-=',
    '且': 'and', '或': 'or', '非': 'not', '并且': 'and', '或者': 'or', '不': 'not',
    '属于': 'in', '不属于': 'not in',
    '是': 'is', '不是': 'is not',
    '位与': '&', '位或': '|', '异或': '^', '左移': '<<', '右移': '>>', '取反': '~',
  };

  /* 中文运算符词，按长度从长到短（贪心匹配） */
  var ZH_OP_KEYS = Object.keys(WORD_OPS).filter(function (k) {
    return /[\u4e00-\u9fa5]/.test(k);
  }).sort(function (a, b) { return b.length - a.length; });

  /* 全角标点 → 半角 */
  var PUNCT = {
    '（': '(', '）': ')', '：': ':', '，': ',', '、': ',', '．': '.',
    '＝': '=', '＋': '+', '－': '-', '＊': '*', '／': '/', '％': '%',
    '＜': '<', '＞': '>', '【': '[', '】': ']',
  };

  var INDENT_RE = /^[ \t\u3000]*/;
  var CJK = /[\u4e00-\u9fa5]/;
  var NUM_CHAR = /[0-9.]/;

  /* 把一段中文按已知运算符词切分，如 年龄大于等于 → 年龄 + 大于等于 */
  function splitZhOps(zh) {
    var parts = []; /* {op: 运算符} 或 {id: 普通文字} */
    var buf = '';
    var i = 0;
    while (i < zh.length) {
      var m = null;
      for (var ki = 0; ki < ZH_OP_KEYS.length; ki++) {
        var key = ZH_OP_KEYS[ki];
        if (zh.slice(i, i + key.length) === key) { m = key; break; }
      }
      if (m) {
        if (buf) { parts.push({ id: buf }); buf = ''; }
        parts.push({ op: m });
        i += m.length;
      } else {
        buf += zh[i];
        i++;
      }
    }
    if (buf) parts.push({ id: buf });
    return parts;
  }

  function lex(code) {
    var tokens = [];
    var indentStack = [0];
    var lines = String(code).replace(/\r/g, '').split('\n');

    for (var li = 0; li < lines.length; li++) {
      var lineNo = li + 1;
      var line = lines[li];
      var m = INDENT_RE.exec(line);
      var indent = m[0].length;
      line = line.slice(indent);

      if (line.trim() === '') continue; /* 空行不参与结构 */

      /* 缩进 → INDENT / DEDENT */
      if (indent > indentStack[indentStack.length - 1]) {
        tokens.push({ type: 'INDENT', value: '', line: lineNo });
        indentStack.push(indent);
      } else {
        while (indent < indentStack[indentStack.length - 1]) {
          tokens.push({ type: 'DEDENT', value: '', line: lineNo });
          indentStack.pop();
        }
      }

      var i = 0;
      var pending = '';   /* 待合并的中文/英文标识符 */
      var prevSeg = null; /* 前一段是 'en' 还是 'num'（用于紧贴判断） */
      function flush() {
        if (pending) {
          tokens.push({ type: 'IDENT', value: pending, line: lineNo });
          pending = '';
        }
      }

      while (i < line.length) {
        var c = line[i];
        if (c === ' ' || c === '\t' || c === '\u3000') { flush(); prevSeg = null; i++; continue; }

        if (c === '#') { flush(); tokens.push({ type: 'COMMENT', value: line.slice(i + 1).trim(), line: lineNo }); break; }
        if (/^注释/.test(line.slice(i))) { flush(); tokens.push({ type: 'COMMENT', value: line.slice(i + 2).trim(), line: lineNo }); break; }

        if (c === '"' || c === "'" || c === '「' || /^[frbFRB]["']/.test(line.slice(i))) {
          /* 字符串（支持 f"..." r"..." 等前缀，原样保留） */
          flush();
          var sm = /^([frbFRB]?)(["']|「)/.exec(line.slice(i));
          var close = sm[2] === '「' ? '」' : sm[2];
          var j = i + sm[0].length;
          while (j < line.length && line[j] !== close) {
            if (line[j] === '\\') j++;
            j++;
          }
          tokens.push({ type: 'STR', prefix: sm[1] || '', value: line.slice(i + sm[0].length, Math.min(j, line.length)), line: lineNo });
          i = Math.min(j + 1, line.length);
          prevSeg = null;
          continue;
        }

        if (/[0-9]/.test(c)) {
          flush();
          var j2 = i;
          while (j2 < line.length && NUM_CHAR.test(line[j2])) j2++;
          tokens.push({ type: 'NUM', value: line.slice(i, j2), line: lineNo });
          i = j2;
          prevSeg = 'num';
          continue;
        }

        if (/[A-Za-z_]/.test(c)) {
          var j3 = i;
          while (j3 < line.length && /[A-Za-z0-9_]/.test(line[j3])) j3++;
          pending += line.slice(i, j3);
          i = j3;
          prevSeg = 'en';
          continue;
        }

        if (CJK.test(c)) {
          var j4 = i;
          while (j4 < line.length && CJK.test(line[j4])) j4++;
          var zh = line.slice(i, j4);
          i = j4;
          if (WORD_OPS[zh] !== undefined) {
            /* 整段就是运算符词：小于、且、乘… */
            flush();
            tokens.push({ type: 'OP', value: WORD_OPS[zh], line: lineNo });
            prevSeg = null;
            continue;
          }
          var nextChar = line[i];
          var frontTouching = (prevSeg === 'en' || prevSeg === 'num');
          var backTouching = (nextChar !== undefined && (/[0-9A-Za-z_]/.test(nextChar) || CJK.test(nextChar)));
          var parts = (frontTouching || backTouching) ? splitZhOps(zh) : [{ id: zh }];
          var hasOp = parts.some(function (p) { return p.op !== undefined; });
          if (hasOp) {
            /* 与数字/字母紧贴且能切出运算符（a大于等于1、年龄大于等于18） */
            for (var pi = 0; pi < parts.length; pi++) {
              if (parts[pi].op !== undefined) {
                flush(); /* 先把已累积的名字放出来，再推运算符，保持顺序 */
                tokens.push({ type: 'OP', value: WORD_OPS[parts[pi].op], line: lineNo });
              } else {
                pending += parts[pi].id;
              }
            }
            prevSeg = null;
          } else {
            pending += zh;
            /* 中文名后紧贴的字母数字是名字的一部分（标签1、答案2） */
            var j5 = i;
            while (j5 < line.length && /[A-Za-z0-9_]/.test(line[j5])) j5++;
            if (j5 > i) {
              pending += line.slice(i, j5);
              i = j5;
              prevSeg = 'en';
            } else {
              prevSeg = null;
            }
          }
          continue;
        }

        flush();
        if (c === '。' || c === '；' || c === ';') {
          tokens.push({ type: 'NEWLINE', value: '', line: lineNo });
          i++;
          prevSeg = null;
          continue;
        }

        var p = PUNCT[c];
        if (p !== undefined) { tokens.push({ type: 'OP', value: p, line: lineNo }); i++; prevSeg = null; continue; }

        var two = line.slice(i, i + 2);
        if (two === '==' || two === '!=' || two === '<=' || two === '>=' || two === '//' || two === '**' || two === '<<' || two === '>>') {
          tokens.push({ type: 'OP', value: two, line: lineNo });
          i += 2;
          prevSeg = null;
          continue;
        }

        if ('()[]{},:.<>=+-*/%!&|^~'.indexOf(c) >= 0) {
          tokens.push({ type: 'OP', value: c, line: lineNo });
          i++;
          prevSeg = null;
          continue;
        }

        i++; /* 未知字符跳过 */
        prevSeg = null;
      }
      flush();
      tokens.push({ type: 'NEWLINE', value: '', line: lineNo });
    }

    while (indentStack.length > 1) {
      tokens.push({ type: 'DEDENT', value: '', line: lines.length });
      indentStack.pop();
    }
    tokens.push({ type: 'EOF', value: '', line: lines.length });
    return tokens;
  }

  global.lex = lex;
})(typeof window !== 'undefined' ? window : globalThis);
