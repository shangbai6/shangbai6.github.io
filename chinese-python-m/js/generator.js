(function (global) {
  'use strict';

  /* 代码生成器：把语法树（AST）翻译成标准 Python 代码。
     自动处理：中文函数名 → 英文函数名、自动补上缺失的 import。 */

  function generate(ast) {
    var used = new Set();      /* 用到过的库（代码名，如 math / tk） */
    var explicit = new Set();  /* 用户自己引入过的库 */
    var lines = [];
    var IND = '    ';
    var classDepth = 0;
    var repeatCounter = 0;     /* 重复执行生成的循环变量编号 */

    var libByName = {};
    LIBRARIES.forEach(function (l) {
      libByName[l.name] = l;
      libByName[l.module] = l;
    });

    function moduleCode(mod) {
      var lib = libByName[mod];
      if (!lib) return mod;
      return lib.alias || lib.module;
    }

    function importLine(code) {
      return code === 'tk' ? 'import tkinter as tk' : 'import ' + code;
    }

    function findLibBlock(zh) {
      for (var i = 0; i < LIBRARIES.length; i++) {
        var lib = LIBRARIES[i];
        var b = null;
        for (var j = 0; j < lib.blocks.length; j++) {
          if (lib.blocks[j].name === zh) { b = lib.blocks[j]; break; }
        }
        if (b) return { lib: lib, b: b };
      }
      return null;
    }

    function genArgs(args) {
      var out = [];
      for (var i = 0; i < args.length; i++) {
        var a = args[i];
        if (a && a.type === 'KwArg') out.push(a.name + '=' + genExpr(a.value));
        else out.push(genExpr(a));
      }
      return out.join(', ');
    }

    /* 模板块：如 获取网页内容("网址") → urllib.request.urlopen("网址").read().decode("utf-8")
       支持 @module@（库前缀）、@args@（全部参数）、@argN@（第 N 个参数） */
    function applyTemplate(tpl, args, modCode) {
      var s = tpl
        .replace(/@module@/g, modCode)
        .replace(/@arg(\d+)@/g, function (mm, i) { return genArgs(args.slice(+i - 1, +i)); })
        .replace(/@args@/g, genArgs(args));
      /* 模板里出现的其他子模块也补上 import（如 urllib.parse） */
      var sub = s.match(/urllib\.[a-z]+/g);
      if (sub) sub.forEach(function (x) { used.add(x); });
      return s;
    }

    function genExpr(node) {
      switch (node.type) {
      case 'Num': return node.value;
      case 'Str': {
        var v = String(node.value);
        var q = (v.indexOf('"') >= 0 && v.indexOf("'") < 0) ? "'" : '"';
        if (q === '"') v = v.replace(/"/g, '\\"');
        else v = v.replace(/'/g, "\\'");
        return (node.prefix || '') + q + v + q;
      }
        case 'Bool': return node.value ? 'True' : 'False';
        case 'None': return 'None';
        case 'Name': {
          var n = node.name;
          if (n === '圆周率') { used.add('math'); return 'math.pi'; }
          if (n === '自然常数') { used.add('math'); return 'math.e'; }
          if (n === '自身') return 'self';
          if (ERRORS[n]) {
            var et = ERRORS[n];
            var parts = et.split('.');
            if (parts.length > 1) used.add(parts.slice(0, -1).join('.'));
            return et;
          }
          return n; /* 中文变量名可以直接用在 Python 里 */
        }
        case 'Member': {
          var base = node.base;
          if (base.type === 'Name' && libByName[base.name]) {
            var lib = libByName[base.name];
            var blk = null;
            for (var j = 0; j < lib.blocks.length; j++) {
              if (lib.blocks[j].name === node.attr) { blk = lib.blocks[j]; break; }
            }
            if (blk) {
              var code = moduleCode(lib.module);
              used.add(code);
              if (blk.template) return applyTemplate(blk.template, [], code);
              return code + '.' + blk.target;
            }
            /* 库里没有这个名字：可能是同名变量在调用方法（如 窗口.销毁()） */
            var attr2 = PROPERTIES[node.attr] || METHODS[node.attr];
            if (attr2) return genExpr(base) + '.' + attr2;
            return genExpr(base) + '.' + node.attr;
          }
          var attr = PROPERTIES[node.attr] || METHODS[node.attr] || node.attr;
          return genExpr(base) + '.' + attr;
        }
        case 'Call': {
          var callee = node.callee;
          if (callee.type === 'Name') {
            var name = callee.name;
            if (BUILTINS[name] !== undefined) {
              return BUILTINS[name] + '(' + genArgs(node.args) + ')';
            }
            if (ERRORS[name]) {
              return genName(name) + '(' + genArgs(node.args) + ')';
            }
            var hit = findLibBlock(name);
            if (hit) {
              var code2 = moduleCode(hit.lib.module);
              used.add(code2);
              if (hit.b.template) return applyTemplate(hit.b.template, node.args, code2);
              return code2 + '.' + hit.b.target + '(' + genArgs(node.args) + ')';
            }
            return name + '(' + genArgs(node.args) + ')';
          }
          if (callee.type === 'Member') {
            return genExpr(callee) + '(' + genArgs(node.args) + ')';
          }
        }
        case 'BinOp': return genExpr(node.l) + ' ' + node.op + ' ' + genExpr(node.r);
        case 'Unary': {
          if (node.op === '-') return '-' + genExpr(node.expr);
          if (node.op === '~') return '~' + genExpr(node.expr);
          return 'not ' + genExpr(node.expr);
        }
        case 'Await': return 'await ' + genExpr(node.expr);
        case 'Paren': return '(' + genExpr(node.expr) + ')';
        case 'Index': return genExpr(node.base) + '[' + genExpr(node.index) + ']';
        case 'Slice': {
          return genExpr(node.base) + '[' +
            (node.start ? genExpr(node.start) : '') + ':' +
            (node.stop ? genExpr(node.stop) : '') +
            (node.step ? ':' + genExpr(node.step) : '') + ']';
        }
        case 'Lambda': return 'lambda ' + node.params.join(', ') + ': ' + genExpr(node.body);
        case 'IfExp': return genExpr(node.body) + ' if ' + genExpr(node.cond) + ' else ' + genExpr(node.orelse);
        case 'ListComp': {
          return '[' + genExpr(node.expr) + ' for ' + node.var.join(', ') + ' in ' + genExpr(node.iter) +
            (node.cond ? ' if ' + genExpr(node.cond) : '') + ']';
        }
        case 'List': {
          var lItems = [];
          for (var i2 = 0; i2 < node.items.length; i2++) lItems.push(genExpr(node.items[i2]));
          return '[' + lItems.join(', ') + ']';
        }
        case 'Tuple': {
          var tItems = [];
          for (var i6 = 0; i6 < node.items.length; i6++) tItems.push(genExpr(node.items[i6]));
          return '(' + tItems.join(', ') + ')';
        }
        case 'Dict': {
          var dItems = [];
          for (var i3 = 0; i3 < node.items.length; i3++) {
            dItems.push(genKey(node.items[i3].k) + ': ' + genExpr(node.items[i3].v));
          }
          return '{' + dItems.join(', ') + '}';
        }
      }
      throw new Error('无法翻译的表达式');
    }

    function genKey(k) {
      if (k.type === 'Name') return '"' + k.name + '"';
      return genExpr(k);
    }

    /* 错误类型名 → 英文（含 urllib.error 等需要 import 的） */
    function genName(n) {
      if (ERRORS[n]) {
        var parts = ERRORS[n].split('.');
        if (parts.length > 1) used.add(parts.slice(0, -1).join('.'));
        return ERRORS[n];
      }
      return n;
    }

    function genBlock(body, level, out) {
      if (!body.length) {
        out.push(IND.repeat(level) + 'pass');
        return;
      }
      for (var i = 0; i < body.length; i++) genStmt(body[i], level, out);
    }

    function genStmt(s, level, out) {
      var pad = IND.repeat(level);
      switch (s.type) {
        case 'Comment': out.push(pad + '#' + s.text); break;
        case 'Assign': {
          if (s.targets && s.targets.length > 1) {
            out.push(pad + s.targets.map(function (tg) { return tg.type === 'Name' ? tg.name : genExpr(tg); }).join(', ') + ' = ' + genExpr(s.expr));
          } else {
            var dst = (s.target && s.target.type !== 'Name') ? genExpr(s.target) : s.name;
            out.push(pad + dst + ' = ' + genExpr(s.expr));
          }
          break;
        }
        case 'AssignOp': {
          out.push(pad + s.name + ' ' + s.op + ' ' + genExpr(s.expr));
          break;
        }
        case 'ExprStmt': out.push(pad + genExpr(s.expr)); break;
        case 'Return': {
          var re = '';
          if (s.expr) {
            if (s.expr.type === 'Tuple' && s.expr.items.length > 1) {
              re = s.expr.items.map(genExpr).join(', '); /* return a, b 不加括号 */
            } else {
              re = genExpr(s.expr);
            }
          }
          out.push(pad + 'return' + (re ? ' ' + re : ''));
          break;
        }
        case 'Break': out.push(pad + 'break'); break;
        case 'Continue': out.push(pad + 'continue'); break;
        case 'Import': {
          s.modules.forEach(function (m) {
            var lib = libByName[m.name];
            if (lib && lib.alias && !m.alias) {
              explicit.add(lib.alias);
              out.push(pad + 'import ' + lib.module + ' as ' + lib.alias);
            } else {
              var c = lib ? lib.module : m.name;
              explicit.add(c);
              out.push(pad + 'import ' + c + (m.alias ? ' as ' + m.alias : ''));
            }
          });
          break;
        }
        case 'FromImport': {
          var code3 = moduleCode(s.module);
          explicit.add(code3);
          var lib3 = libByName[s.module];
          var names = [];
          for (var i2 = 0; i2 < s.names.length; i2++) {
            var n3 = s.names[i2];
            var b3 = null;
            if (lib3 && lib3.blocks) {
              for (var j = 0; j < lib3.blocks.length; j++) {
                if (lib3.blocks[j].name === n3) { b3 = lib3.blocks[j]; break; }
              }
            }
            names.push(b3 ? b3.target : n3);
          }
          out.push(pad + 'from ' + code3 + ' import ' + names.join(', '));
          break;
        }
        case 'FuncDef': case 'AsyncFuncDef': {
          var isAsync = (s.type === 'AsyncFuncDef');
          var fname = s.name;
          var params = s.params.slice();
          if (classDepth > 0) {
            /* 类里的特殊方法：初始化 → __init__ 等；第一个参数 自己 → self */
            var SPECIAL = { 初始化: '__init__', 字符串表示: '__str__', 长度: '__len__', 比较: '__eq__' };
            if (SPECIAL[fname]) fname = SPECIAL[fname];
            if (params[0] && params[0].name === '自己') params[0] = { name: 'self', default: params[0].default };
          }
          var plist = params.map(function (p) {
            return p.name + (p.default ? ' = ' + genExpr(p.default) : '');
          });
          out.push(pad + (isAsync ? 'async def ' : 'def ') + fname + '(' + plist.join(', ') + '):');
          genBlock(s.body, level + 1, out);
          break;
        }
        case 'ClassDef': {
          out.push(pad + 'class ' + s.name + ':');
          classDepth++;
          genBlock(s.body, level + 1, out);
          classDepth--;
          break;
        }
        case 'Try': {
          out.push(pad + 'try:');
          genBlock(s.body, level + 1, out);
          s.handlers.forEach(function (h) {
            var hd = '';
            if (h.types && h.types.length) {
              var mapped = h.types.map(function (t) { return genName(t); });
              hd = ' ' + (mapped.length > 1 ? '(' + mapped.join(', ') + ')' : mapped[0]);
            }
            out.push(pad + 'except' + hd + (h.var ? ' as ' + h.var : '') + ':');
            genBlock(h.body, level + 1, out);
          });
          if (s.finally) {
            out.push(pad + 'finally:');
            genBlock(s.finally, level + 1, out);
          }
          break;
        }
        case 'With': {
          out.push(pad + 'with ' + genExpr(s.expr) + (s.asname ? ' as ' + s.asname : '') + ':');
          genBlock(s.body, level + 1, out);
          break;
        }
        case 'Raise': out.push(pad + 'raise' + (s.expr ? ' ' + genExpr(s.expr) : '')); break;
        case 'Assert': out.push(pad + 'assert ' + genExpr(s.expr) + (s.msg ? ', ' + genExpr(s.msg) : '')); break;
        case 'Del': out.push(pad + 'del ' + s.names.join(', ')); break;
        case 'Pass': out.push(pad + 'pass'); break;
        case 'Yield': out.push(pad + 'yield' + (s.expr ? ' ' + genExpr(s.expr) : '')); break;
        case 'Global': out.push(pad + 'global ' + s.names.join(', ')); break;
        case 'Nonlocal': out.push(pad + 'nonlocal ' + s.names.join(', ')); break;
        case 'If': {
          out.push(pad + 'if ' + genExpr(s.cond) + ':');
          genBlock(s.body, level + 1, out);
          for (var i4 = 0; i4 < s.rest.length; i4++) {
            out.push(pad + 'elif ' + genExpr(s.rest[i4].cond) + ':');
            genBlock(s.rest[i4].body, level + 1, out);
          }
          if (s.orelse) {
            out.push(pad + 'else:');
            genBlock(s.orelse, level + 1, out);
          }
          break;
        }
        case 'While':
          out.push(pad + 'while ' + genExpr(s.cond) + ':');
          genBlock(s.body, level + 1, out);
          break;
        case 'Repeat': {
          /* 重复执行 N 次 → for _循环N in range(N) */
          var rv = '_循环' + (repeatCounter++);
          out.push(pad + 'for ' + rv + ' in range(' + genExpr(s.times) + '):');
          genBlock(s.body, level + 1, out);
          break;
        }
        case 'RepeatUntil': {
          /* 重复执行直到 条件 → while True: 内容 if 条件: break */
          out.push(pad + 'while True:');
          genBlock(s.body, level + 1, out);
          out.push(pad + '    if ' + genExpr(s.cond) + ':');
          out.push(pad + '        break');
          break;
        }
        case 'For':
          out.push(pad + 'for ' + s.varname.join(', ') + ' in ' + genExpr(s.iter) + ':');
          genBlock(s.body, level + 1, out);
          break;
        default: throw new Error('无法翻译的语句');
      }
      if (s.trailing !== undefined) {
        var last = out.length - 1;
        out[last] = out[last] + '  # ' + String(s.trailing).trim();
      }
    }

    for (var i5 = 0; i5 < ast.stmts.length; i5++) genStmt(ast.stmts[i5], 0, lines);

    /* 自动补上没用「引入」但用到过的库 */
    var missing = [];
    used.forEach(function (c) { if (!explicit.has(c)) missing.push(c); });
    if (missing.length) {
      var prep = [];
      LIBRARIES.forEach(function (l) {
        var c = moduleCode(l.module);
        if (missing.indexOf(c) >= 0 && prep.indexOf(importLine(c)) < 0) prep.push(importLine(c));
      });
      missing.forEach(function (c) {
        var line = importLine(c);
        if (prep.indexOf(line) < 0) prep.push(line);
      });
      lines.unshift.apply(lines, prep);
    }

    return { code: lines.join('\n') };
  }

  global.generate = generate;
})(typeof window !== 'undefined' ? window : globalThis);
