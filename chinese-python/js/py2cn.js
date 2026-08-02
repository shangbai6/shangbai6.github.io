(function (global) {
  'use strict';

  /* 反向翻译：把 Python 代码翻译回中文（Python → 中文）。
     内置 Python 子集解析器，产出与正向翻译相同的 AST 节点，
     再由中文渲染器输出中文代码，可与正向翻译互相往返。
     支持：f-string、三引号多行字符串、import as 别名、关键字参数、
     lambda 匿名函数、类型标注与默认参数、多变量 for、多返回值、
     调用后下标链、except 元组类型、is 比较、行内注释保留等。 */

  var PY_KW = {
    if: 1, elif: 1, else: 1, while: 1, for: 1, def: 1, return: 1, import: 1, from: 1, as: 1,
    class: 1, try: 1, except: 1, finally: 1, with: 1, raise: 1, assert: 1, del: 1, pass: 1,
    break: 1, continue: 1, yield: 1, global: 1, nonlocal: 1, async: 1, await: 1, lambda: 1,
    not: 1, and: 1, or: 1, in: 1, is: 1, True: 1, False: 1, None: 1,
  };

  function perr(msg, line) {
    return new Error('第 ' + (line || '?') + ' 行：' + msg);
  }

  /* ---------- Python 词法 ---------- */
  function pyLex(code) {
    var tokens = [];
    var indentStack = [0];
    var lines = String(code).replace(/\r/g, '').split('\n');
    var li = 0;
    var bracketDepth = 0; /* 跨行括号（( [ { ）深度 */
    while (li < lines.length) {
      var lineNo = li + 1;
      var line = lines[li];
      if (bracketDepth === 0) {
        var m = /^[ \t]*/.exec(line)[0];
        var indent = m.length;
        line = line.slice(indent);
        if (!line.trim()) { li++; continue; }
        /* 注释行也参与缩进比较（顶格注释会结束所在块），但不产生结构错误 */
        if (indent > indentStack[indentStack.length - 1]) {
          tokens.push({ type: 'INDENT', value: '', line: lineNo });
          indentStack.push(indent);
        } else {
          while (indent < indentStack[indentStack.length - 1]) {
            tokens.push({ type: 'DEDENT', value: '', line: lineNo });
            indentStack.pop();
          }
        }
        if (/^#/.test(line.trim())) {
          tokens.push({ type: 'COMMENT', value: line.replace(/^#/, '').trim(), line: lineNo });
          tokens.push({ type: 'NEWLINE', value: '', line: lineNo });
          li++;
          continue;
        }
      } else {
        /* 括号内：整行内容参与扫描，不做缩进处理 */
        if (!line.trim() || /^#/.test(line.trim())) { li++; continue; }
      }
      var i = 0;
      while (i < line.length) {
        var c = line[i];
        if (c === ' ' || c === '\t') { i++; continue; }
        if (c === '#') { tokens.push({ type: 'COMMENT', value: line.slice(i + 1).trim(), line: lineNo }); break; }

        /* 三引号多行字符串（跨行读取） */
        if (/^"""|^'''/.test(line.slice(i))) {
          var q3 = line.slice(i, i + 3);
          var e1 = line.indexOf(q3, i + 3);
          var raw = '';
          if (e1 >= 0) {
            raw = line.slice(i + 3, e1);
            i = e1 + 3;
          } else {
            raw = line.slice(i + 3);
            li++;
            var found = false;
            while (li < lines.length) {
              var nl = lines[li];
              var e2 = nl.indexOf(q3);
              if (e2 >= 0) {
                raw += '\n' + nl.slice(0, e2);
                li++;
                found = true;
                break;
              }
              raw += '\n' + nl;
              li++;
            }
            if (!found) raw += '\n';
            tokens.push({ type: 'STR', prefix: '', quote: q3[0], value: raw, multiline: true, line: lineNo });
            tokens.push({ type: 'NEWLINE', value: '', line: lineNo });
            li--; /* 主循环 li++ 后会到下一行；这里直接跳出行扫描 */
            break;
          }
          tokens.push({ type: 'STR', prefix: '', quote: q3[0], value: raw, multiline: false, line: lineNo });
          continue;
        }

        var sm = /^(([fFrRbBuU])?(["']))/.exec(line.slice(i));
        if (sm) {
          var quote = sm[3];
          var j = i + sm[0].length;
          var end = -1;
          while (j < line.length) {
            if (line[j] === quote) { end = j; break; }
            if (line[j] === '\\') j++;
            j++;
          }
          var inner = line.slice(i + sm[0].length, end < 0 ? line.length : end);
          tokens.push({ type: 'STR', prefix: sm[2] || '', quote: quote, value: inner, line: lineNo });
          i = end < 0 ? line.length : end + 1;
          continue;
        }
        if (/[0-9]/.test(c)) {
          var j2 = i;
          while (j2 < line.length && /[0-9a-zA-Z_.]/.test(line[j2])) j2++;
          tokens.push({ type: 'NUM', value: line.slice(i, j2), line: lineNo });
          i = j2;
          continue;
        }
        if (/[A-Za-z_\u4e00-\u9fa5]/.test(c)) {
          var j3 = i;
          while (j3 < line.length && /[A-Za-z0-9_\u4e00-\u9fa5]/.test(line[j3])) j3++;
          var w = line.slice(i, j3);
          tokens.push({ type: PY_KW[w] ? 'KW' : 'IDENT', value: w, line: lineNo });
          i = j3;
          continue;
        }
        if (c === ';') { tokens.push({ type: 'NEWLINE', value: '', line: lineNo }); i++; continue; }
        var two = line.slice(i, i + 2);
        if (['==', '!=', '<=', '>=', '//', '**', '<<', '>>', '+=', '-=', '*=', '/=', '%=', '->'].indexOf(two) >= 0) {
          tokens.push({ type: 'OP', value: two, line: lineNo });
          i += 2;
          continue;
        }
        if ('()[]{},:.<>=+-*/%!&|^~'.indexOf(c) >= 0) {
          tokens.push({ type: 'OP', value: c, line: lineNo });
          if (c === '(' || c === '[' || c === '{') bracketDepth++;
          if (c === ')' || c === ']' || c === '}') bracketDepth--;
          i++;
          continue;
        }
        i++;
      }
      if (bracketDepth === 0) tokens.push({ type: 'NEWLINE', value: '', line: lineNo });
      li++;
    }
    while (indentStack.length > 1) {
      tokens.push({ type: 'DEDENT', value: '', line: lines.length });
      indentStack.pop();
    }
    tokens.push({ type: 'EOF', value: '', line: lines.length });
    return tokens;
  }

  /* ---------- Python 语法（→ 与正向相同的 AST 节点） ---------- */
  function Parser(tokens) {
    this.tokens = tokens;
    this.pos = 0;
  }
  Parser.prototype.peek = function (o) {
    o = o || 0;
    return this.tokens[Math.min(this.pos + o, this.tokens.length - 1)];
  };
  Parser.prototype.next = function () { return this.tokens[this.pos++]; };
  Parser.prototype.expect = function (type, val) {
    var t = this.peek();
    if (t.type !== type || (val !== undefined && t.value !== val)) {
      throw perr('期望「' + (val !== undefined ? val : type) + '」，却看到「' + (t.value !== undefined ? t.value : t.type) + '」', t.line);
    }
    return this.next();
  };
  Parser.prototype.isOp = function (v) {
    var t = this.peek();
    return t.type === 'OP' && t.value === v;
  };
  Parser.prototype.isKw = function (v) {
    var t = this.peek();
    return t.type === 'KW' && t.value === v;
  };
  Parser.prototype.skipJunk = function () {
    /* 不跳过 COMMENT：注释要保留并翻译 */
    while (this.peek().type === 'NEWLINE' || this.peek().type === 'DEDENT') this.pos++;
  };
  Parser.prototype.isLineEnd = function () {
    var t = this.peek();
    return t.type === 'NEWLINE' || t.type === 'EOF' || t.type === 'DEDENT' || t.type === 'COMMENT';
  };
  Parser.prototype.parseStmtWithTrailing = function () {
    var s = this.parseStatement();
    /* 只有与语句紧挨着（中间没有换行）的注释才是行内注释 */
    var prevTok = this.peek(-1);
    if (this.peek().type === 'COMMENT' && prevTok.type !== 'NEWLINE' && prevTok.type !== 'DEDENT') {
      s.trailing = this.peek().value;
      this.pos++;
    }
    return s;
  };

  Parser.prototype.parseProgram = function () {
    var stmts = [];
    while (true) {
      this.skipJunk();
      while (this.peek().type === 'INDENT') this.pos++; /* 容错：注释错位产生的裸缩进 */
      if (this.peek().type === 'EOF') break;
      stmts.push(this.parseStmtWithTrailing());
    }
    return { type: 'Program', stmts: stmts };
  };

  Parser.prototype.parseStatement = function () {
    this.skipJunk();
    var t = this.peek();
    if (t.type === 'COMMENT') { this.pos++; return { type: 'Comment', text: t.value }; }
    if (t.type === 'KW') {
      switch (t.value) {
        case 'if': return this.parseIf();
        case 'while': return this.parseWhile();
        case 'for': return this.parseFor();
        case 'def': return this.parseFuncDef(false);
        case 'async': {
          this.pos++;
          if (!this.isKw('def')) throw perr('格式为：async def 函数名(...)：', this.peek().line);
          return this.parseFuncDef(true);
        }
        case 'class': return this.parseClass();
        case 'try': return this.parseTry();
        case 'with': return this.parseWith();
        case 'return': {
          this.pos++;
          var e = null;
          if (!this.isLineEnd()) {
            e = this.parseExpr();
            if (this.isOp(',')) {
              var items = [e];
              while (this.isOp(',')) {
                this.pos++;
                if (this.isLineEnd()) break;
                items.push(this.parseExpr());
              }
              e = { type: 'Tuple', items: items };
            }
          }
          return { type: 'Return', expr: e };
        }
        case 'import': return this.parseImport();
        case 'from': return this.parseFromImport();
        case 'raise': {
          this.pos++;
          var re = null;
          if (!this.isLineEnd()) re = this.parseExpr();
          return { type: 'Raise', expr: re };
        }
        case 'assert': {
          this.pos++;
          var ae = this.parseExpr();
          var msg = null;
          if (this.isOp(',')) { this.pos++; msg = this.parseExpr(); }
          return { type: 'Assert', expr: ae, msg: msg };
        }
        case 'del': return this.parseNames('Del');
        case 'global': return this.parseNames('Global');
        case 'nonlocal': return this.parseNames('Nonlocal');
        case 'pass': this.pos++; return { type: 'Pass' };
        case 'break': this.pos++; return { type: 'Break' };
        case 'continue': this.pos++; return { type: 'Continue' };
        case 'yield': {
          this.pos++;
          var y = null;
          if (!this.isLineEnd()) y = this.parseExpr();
          return { type: 'Yield', expr: y };
        }
      }
    }
    return this.parseAssignOrExpr();
  };

  Parser.prototype.parseAssignOrExpr = function () {
    var t = this.peek();
    if (t.type === 'IDENT') {
      var i = 1;
      while (true) {
        var n = this.peek(i);
        if (n.type === 'OP' && n.value === ',') {
          var nx = this.peek(i + 1);
          if (nx.type !== 'IDENT') return this.parseExprStmt();
          i += 2;
          continue;
        }
        if (n.type === 'OP' && n.value === '.') {
          var a = this.peek(i + 1);
          if (a.type !== 'IDENT') return this.parseExprStmt();
          i += 2;
          continue;
        }
        if (n.type === 'OP' && n.value === '[') {
          var depth = 0, j = i;
          while (true) {
            var tk = this.peek(j);
            if (tk.type === 'EOF') return this.parseExprStmt();
            if (tk.type === 'OP' && tk.value === '[') depth++;
            if (tk.type === 'OP' && tk.value === ']') { depth--; if (depth === 0) break; }
            j++;
          }
          i = j + 1;
          continue;
        }
        if (n.type === 'OP' && (n.value === '=' || n.value === '+=' || n.value === '-=' || n.value === '*=' || n.value === '/=')) {
          return this.parseAssign();
        }
        return this.parseExprStmt();
      }
    }
    return this.parseExprStmt();
  };

  Parser.prototype.parseExprStmt = function () {
    var expr = this.parseExpr();
    var nt = this.peek();
    if (nt.type !== 'NEWLINE' && nt.type !== 'EOF' && nt.type !== 'DEDENT' && nt.type !== 'COMMENT') {
      throw perr('这一句写错了，出现了多余的内容「' + (nt.value !== undefined ? nt.value : nt.type) + '」', nt.line);
    }
    return { type: 'ExprStmt', expr: expr };
  };

  Parser.prototype.parseAssign = function () {
    var targets = [];
    while (true) {
      var t = this.expect('IDENT');
      var target = { type: 'Name', name: t.value };
      while (true) {
        var n = this.peek();
        if (n.type === 'OP' && n.value === '.') {
          this.pos++;
          var a = this.peek();
          if (a.type !== 'IDENT') throw perr('「.」后面要跟名字', a.line);
          this.pos++;
          target = { type: 'Member', base: target, attr: a.value };
          continue;
        }
        if (n.type === 'OP' && n.value === '[') {
          this.pos++;
          var idx = this.parseExpr();
          this.expect('OP', ']');
          target = { type: 'Index', base: target, index: idx };
          continue;
        }
        break;
      }
      targets.push(target);
      if (this.isOp(',')) { this.pos++; continue; }
      break;
    }
    var op = this.peek().value;
    this.pos++;
    var expr = this.parseExpr();
    if (op !== '=') {
      return { type: 'AssignOp', name: targets[0].type === 'Name' ? targets[0].name : null, target: targets[0], op: op, expr: expr };
    }
    if (targets.length === 1) {
      return { type: 'Assign', name: targets[0].type === 'Name' ? targets[0].name : null, target: targets[0], expr: expr };
    }
    return { type: 'Assign', name: null, target: null, targets: targets, expr: expr };
  };

  Parser.prototype.parseImport = function () {
    this.pos++;
    var modules = [];
    while (true) {
      var t = this.peek();
      if (t.type !== 'IDENT') throw perr('「import」后面要写模块名', t.line);
      var name = t.value;
      this.pos++;
      while (this.isOp('.')) {
        var a = this.peek(1);
        if (a.type !== 'IDENT') break;
        name += '.' + a.value;
        this.pos += 2;
      }
      var alias = null;
      if (this.isKw('as')) {
        this.pos++;
        alias = this.expect('IDENT').value;
      }
      modules.push({ name: name, alias: alias });
      if (this.isOp(',')) { this.pos++; continue; }
      break;
    }
    return { type: 'Import', modules: modules };
  };

  Parser.prototype.parseFromImport = function () {
    this.pos++;
    var mod = this.expect('IDENT').value;
    while (this.isOp('.')) {
      var a = this.peek(1);
      if (a.type !== 'IDENT') break;
      mod += '.' + a.value;
      this.pos += 2;
    }
    if (!this.isKw('import')) throw perr('格式为：from 模块 import 名字', this.peek().line);
    this.pos++;
    var names = [];
    while (true) {
      var t = this.peek();
      if (t.type === 'IDENT') { names.push(t.value); this.pos++; }
      else if (t.type === 'KW' && t.value === 'as') {
        this.pos++;
        this.expect('IDENT');
        throw perr('暂不支持 from ... import ... as 别名', t.line);
      } else {
        throw perr('「import」后面要写名字', t.line);
      }
      if (this.isOp(',')) { this.pos++; continue; }
      break;
    }
    return { type: 'FromImport', module: mod, names: names };
  };

  Parser.prototype.parseFuncDef = function (isAsync) {
    this.pos++;
    var name = this.expect('IDENT').value;
    this.expect('OP', '(');
    var params = [];
    while (!this.isOp(')')) {
      var p = this.peek();
      if (p.type !== 'IDENT') throw perr('参数名写错（暂不支持 *args / **kwargs）', p.line);
      var paramName = p.value;
      this.pos++;
      var def = null;
      if (this.isOp(':')) {
        /* 类型标注：跳过到 = 或逗号或右括号 */
        while (!this.isOp('=') && !this.isOp(',') && !this.isOp(')') && this.peek().type !== 'EOF') this.pos++;
        if (this.isOp('=')) {
          this.pos++;
          def = this.parseExpr();
        }
      } else if (this.isOp('=')) {
        this.pos++;
        def = this.parseExpr();
      }
      params.push({ name: paramName, default: def });
      if (this.isOp(',')) { this.pos++; continue; }
      if (this.isOp(')')) break;
      throw perr('参数列表缺少右括号', p.line);
    }
    this.expect('OP', ')');
    /* 返回类型标注：-> 类型（停在冒号处） */
    if (this.isOp('->')) {
      this.pos++;
      while (!this.isOp(':') && !this.isLineEnd()) this.pos++;
    }
    this.expectColon();
    var body = this.parseBlock();
    return { type: isAsync ? 'AsyncFuncDef' : 'FuncDef', name: name, params: params, body: body };
  };

  Parser.prototype.parseClass = function () {
    this.pos++;
    var name = this.expect('IDENT').value;
    var t = this.peek();
    if (t.type === 'OP' && t.value === '(') throw perr('暂不支持类的继承', t.line);
    this.expectColon();
    var body = this.parseBlock();
    return { type: 'ClassDef', name: name, body: body };
  };

  Parser.prototype.parseIf = function () {
    this.pos++;
    var cond = this.parseExpr();
    this.expectColon();
    var body = this.parseBlock();
    var rest = [];
    var orelse = null;
    while (true) {
      var t = this.peek();
      if (t.type === 'KW' && t.value === 'elif') {
        this.pos++;
        var c = this.parseExpr();
        this.expectColon();
        var b = this.parseBlock();
        rest.push({ cond: c, body: b });
        continue;
      }
      if (t.type === 'KW' && t.value === 'else') {
        this.pos++;
        this.expectColon();
        orelse = this.parseBlock();
        break;
      }
      break;
    }
    return { type: 'If', cond: cond, body: body, rest: rest, orelse: orelse };
  };

  Parser.prototype.parseWhile = function () {
    this.pos++;
    var cond = this.parseExpr();
    this.expectColon();
    var body = this.parseBlock();
    if (this.isKw('else')) throw perr('暂不支持 while...else', this.peek().line);
    return { type: 'While', cond: cond, body: body };
  };

  Parser.prototype.parseFor = function () {
    this.pos++;
    var vars = [this.expect('IDENT').value];
    while (this.isOp(',')) {
      this.pos++;
      vars.push(this.expect('IDENT').value);
    }
    if (!this.isKw('in')) throw perr('格式为：for 变量 in 列表：', this.peek().line);
    this.pos++;
    var iter = this.parseExpr();
    this.expectColon();
    var body = this.parseBlock();
    if (this.isKw('else')) throw perr('暂不支持 for...else', this.peek().line);
    return { type: 'For', varname: vars, iter: iter, body: body };
  };

  Parser.prototype.parseTry = function () {
    this.pos++;
    this.expectColon();
    var body = this.parseBlock();
    var handlers = [];
    while (true) {
      var t = this.peek();
      if (!(t.type === 'KW' && t.value === 'except')) break;
      this.pos++;
      var types = [];
      var varName = null;
      var inParen = this.isOp('(');
      if (inParen) this.pos++;
      if (this.peek().type === 'IDENT') {
        while (true) {
          if (this.peek().type !== 'IDENT') throw perr('except 类型写错', this.peek().line);
          var tname = this.next().value;
          while (this.isOp('.')) {
            this.pos++;
            tname += '.' + this.expect('IDENT').value;
          }
          types.push(tname);
          if (this.isOp(',')) { this.pos++; continue; }
          break;
        }
      }
      if (inParen) this.expect('OP', ')');
      if (this.isKw('as')) {
        this.pos++;
        varName = this.expect('IDENT').value;
      }
      this.expectColon();
      var hb = this.parseBlock();
      handlers.push({ types: types, var: varName, body: hb });
    }
    var fin = null;
    if (this.isKw('else')) throw perr('暂不支持 try...else', this.peek().line);
    if (this.isKw('finally')) {
      this.pos++;
      this.expectColon();
      fin = this.parseBlock();
    }
    return { type: 'Try', body: body, handlers: handlers, finally: fin };
  };

  Parser.prototype.parseWith = function () {
    this.pos++;
    var expr = this.parseExpr();
    var asname = null;
    if (this.isKw('as')) {
      this.pos++;
      asname = this.expect('IDENT').value;
    }
    this.expectColon();
    var body = this.parseBlock();
    return { type: 'With', expr: expr, asname: asname, body: body };
  };

  Parser.prototype.parseNames = function (kind) {
    this.pos++;
    var names = [];
    while (true) {
      var t = this.peek();
      if (t.type !== 'IDENT') throw perr('这里要写变量名', t.line);
      names.push(t.value);
      this.pos++;
      if (this.isOp(',')) { this.pos++; continue; }
      break;
    }
    return { type: kind, names: names };
  };

  Parser.prototype.expectColon = function () {
    var t = this.peek();
    if (t.type === 'OP' && t.value === ':') { this.pos++; return; }
    throw perr('这里要写冒号「:」', t.line);
  };

  Parser.prototype.parseBlock = function () {
    var headComments = [];
    var t = this.peek();
    /* 块头行内注释：while a <= 100:  # 说明 → 保留为块内第一条注释 */
    while (t.type === 'COMMENT') {
      headComments.push({ type: 'Comment', text: t.value });
      this.pos++;
      t = this.peek();
    }
    if (t.type === 'NEWLINE') {
      this.pos++;
      while (this.peek().type === 'NEWLINE') this.pos++;
      while (this.peek().type === 'COMMENT') {
        headComments.push({ type: 'Comment', text: this.peek().value });
        this.pos++;
      }
      if (this.peek().type !== 'INDENT') {
        while (this.peek().type === 'COMMENT') this.pos++;
        if (this.peek().type !== 'INDENT') return headComments;
      }
      this.pos++;
      var stmts = [];
      while (true) {
        while (this.peek().type === 'NEWLINE') this.pos++;
        var p = this.peek();
        if (p.type === 'DEDENT' || p.type === 'EOF') break;
        stmts.push(this.parseStmtWithTrailing());
      }
      if (this.peek().type === 'DEDENT') this.pos++;
      return headComments.concat(stmts);
    }
    if (t.type === 'COMMENT') { this.pos++; return []; }
    return headComments.concat([this.parseStmtWithTrailing()]);
  };

  /* 表达式 */
  Parser.prototype.parseExpr = function () {
    var l = this.parseOr();
    if (this.isKw('if')) {
      this.pos++;
      var cond = this.parseOr();
      if (!this.isKw('else')) throw perr('三目表达式要写：值 if 条件 else 另一个值', this.peek().line);
      this.pos++;
      var alt = this.parseOr();
      return { type: 'IfExp', body: l, cond: cond, orelse: alt };
    }
    return l;
  };
  Parser.prototype.parseOr = function () {
    var l = this.parseAnd();
    while (this.isKw('or')) { this.pos++; var r = this.parseAnd(); l = { type: 'BinOp', op: 'or', l: l, r: r }; }
    return l;
  };
  Parser.prototype.parseAnd = function () {
    var l = this.parseNot();
    while (this.isKw('and')) { this.pos++; var r = this.parseNot(); l = { type: 'BinOp', op: 'and', l: l, r: r }; }
    return l;
  };
  Parser.prototype.parseNot = function () {
    if (this.isKw('not')) {
      this.pos++;
      return { type: 'Unary', op: 'not', expr: this.parseNot() };
    }
    return this.parseCompare();
  };
  Parser.prototype.parseCompare = function () {
    var l = this.parseBitOr();
    while (true) {
      var t = this.peek();
      var op = null;
      if (t.type === 'OP' && ['==', '!=', '>', '<', '>=', '<='].indexOf(t.value) >= 0) op = t.value;
      else if (t.type === 'KW' && t.value === 'in') op = 'in';
      else if (t.type === 'KW' && t.value === 'not' && this.peek(1).type === 'KW' && this.peek(1).value === 'in') op = 'not in';
      else if (t.type === 'KW' && t.value === 'is' && this.peek(1).type === 'KW' && this.peek(1).value === 'not') op = 'is not';
      else if (t.type === 'KW' && t.value === 'is') op = 'is';
      if (!op) break;
      if (op === 'not in' || op === 'is not') this.pos += 2; else this.pos++;
      var r = this.parseBitOr();
      l = { type: 'BinOp', op: op, l: l, r: r };
    }
    return l;
  };
  Parser.prototype.parseBitOr = function () {
    var l = this.parseBitXor();
    while (this.isOp('|')) { this.pos++; var r = this.parseBitXor(); l = { type: 'BinOp', op: '|', l: l, r: r }; }
    return l;
  };
  Parser.prototype.parseBitXor = function () {
    var l = this.parseBitAnd();
    while (this.isOp('^')) { this.pos++; var r = this.parseBitAnd(); l = { type: 'BinOp', op: '^', l: l, r: r }; }
    return l;
  };
  Parser.prototype.parseBitAnd = function () {
    var l = this.parseShift();
    while (this.isOp('&')) { this.pos++; var r = this.parseShift(); l = { type: 'BinOp', op: '&', l: l, r: r }; }
    return l;
  };
  Parser.prototype.parseShift = function () {
    var l = this.parseAdd();
    while (this.isOp('<<') || this.isOp('>>')) {
      var op = this.peek().value; this.pos++;
      var r = this.parseAdd();
      l = { type: 'BinOp', op: op, l: l, r: r };
    }
    return l;
  };
  Parser.prototype.parseAdd = function () {
    var l = this.parseMul();
    while (this.isOp('+') || this.isOp('-')) {
      var op = this.peek().value; this.pos++;
      var r = this.parseMul();
      l = { type: 'BinOp', op: op, l: l, r: r };
    }
    return l;
  };
  Parser.prototype.parseMul = function () {
    var l = this.parseUnary();
    while (this.isOp('*') || this.isOp('/') || this.isOp('%') || this.isOp('//') || this.isOp('**')) {
      var op = this.peek().value; this.pos++;
      var r = this.parseUnary();
      l = { type: 'BinOp', op: op, l: l, r: r };
    }
    return l;
  };
  Parser.prototype.parseUnary = function () {
    if (this.isOp('-')) { this.pos++; return { type: 'Unary', op: '-', expr: this.parseUnary() }; }
    if (this.isOp('~')) { this.pos++; return { type: 'Unary', op: '~', expr: this.parseUnary() }; }
    if (this.isKw('await')) { this.pos++; return { type: 'Await', expr: this.parseUnary() }; }
    return this.parsePrimary();
  };
  Parser.prototype.parsePrimary = function () {
    var t = this.peek();
    if (t.type === 'NUM') { this.pos++; return { type: 'Num', value: t.value }; }
    if (t.type === 'STR') {
      this.pos++;
      var sv = t.value;
      /* 相邻字符串字面量自动拼接："a" "b" → "ab" */
      while (this.peek().type === 'STR') {
        var nx = this.next();
        sv += nx.value;
      }
      var node = { type: 'Str', value: sv, prefix: t.prefix || '', quote: t.quote || '"', multiline: !!t.multiline };
      /* 字符串后还能取字符 / 调用方法："你好"[0]、"a".upper() */
      while (true) {
        if (this.isOp('[')) {
          this.pos++;
          if (this.isOp(']')) throw perr('下标不能为空', this.peek().line);
          var idx = null;
          if (!this.isOp(':') && !this.isOp(']')) idx = this.parseExpr();
          if (this.isOp(':')) {
            this.pos++;
            var stop = null, step = null;
            if (!this.isOp(':') && !this.isOp(']')) stop = this.parseExpr();
            if (this.isOp(':')) {
              this.pos++;
              if (!this.isOp(']')) step = this.parseExpr();
            }
            this.expect('OP', ']');
            node = { type: 'Slice', base: node, start: idx, stop: stop, step: step };
          } else {
            this.expect('OP', ']');
            node = { type: 'Index', base: node, index: idx };
          }
          continue;
        }
        if (this.isOp('.')) {
          this.pos++;
          var a2 = this.peek();
          if (a2.type !== 'IDENT') throw perr('「.」后面要跟名字', a2.line);
          this.pos++;
          node = { type: 'Member', base: node, attr: a2.value };
          continue;
        }
        if (this.isOp('(')) {
          var args = [];
          this.expect('OP', '(');
          if (!this.isOp(')')) {
            while (true) {
              var kwt = this.peek();
              if (kwt.type === 'IDENT' && this.peek(1).type === 'OP' && this.peek(1).value === '=') {
                var kwName = kwt.value;
                this.pos += 2;
                args.push({ type: 'KwArg', name: kwName, value: this.parseExpr() });
              } else {
                args.push(this.parseExpr());
              }
              if (this.isOp(',')) { this.pos++; continue; }
              break;
            }
          }
          this.expect('OP', ')');
          node = { type: 'Call', callee: node, args: args };
          continue;
        }
        break;
      }
      return node;
    }
    if (t.type === 'KW') {
      if (t.value === 'True') { this.pos++; return { type: 'Bool', value: true }; }
      if (t.value === 'False') { this.pos++; return { type: 'Bool', value: false }; }
      if (t.value === 'None') { this.pos++; return { type: 'None' }; }
      if (t.value === 'lambda') {
        /* lambda 参数: 表达式 */
        this.pos++;
        var lparams = [];
        while (!this.isOp(':')) {
          if (this.peek().type !== 'IDENT') throw perr('lambda 要写：lambda 参数: 表达式', this.peek().line);
          lparams.push(this.next().value);
          if (this.isOp(',')) { this.pos++; continue; }
          break;
        }
        this.expect('OP', ':');
        var lbody = this.parseExpr();
        return { type: 'Lambda', params: lparams, body: lbody };
      }
      throw perr('这里不能出现关键字「' + t.value + '」', t.line);
    }
    if (this.isOp('(')) {
      this.pos++;
      if (this.isOp(')')) { this.pos++; return { type: 'Tuple', items: [] }; }
      var e = this.parseExpr();
      if (this.isOp(',')) {
        var items = [e];
        while (this.isOp(',')) {
          this.pos++;
          if (this.isOp(')')) break;
          items.push(this.parseExpr());
        }
        this.expect('OP', ')');
        return { type: 'Tuple', items: items };
      }
      this.expect('OP', ')');
      return { type: 'Paren', expr: e }; /* 保留括号，防止运算符优先级变化 */
    }
    if (this.isOp('[')) {
      this.pos++;
      if (this.isOp(']')) { this.pos++; return { type: 'List', items: [] }; }
      var first = this.parseExpr();
      if (this.isKw('for')) {
        this.pos++;
        var vn = [this.expect('IDENT').value];
        while (this.isOp(',')) {
          this.pos++;
          vn.push(this.expect('IDENT').value);
        }
        if (!this.isKw('in')) throw perr('推导式要写：[表达式 for 变量 in 列表]', this.peek().line);
        this.pos++;
        var it = this.parseOr();
        var cond = null;
        if (this.isKw('if')) { this.pos++; cond = this.parseExpr(); }
        this.expect('OP', ']');
        return { type: 'ListComp', expr: first, var: vn, iter: it, cond: cond };
      }
      var items = [first];
      while (this.isOp(',')) {
        this.pos++;
        if (this.isOp(']')) break; /* 尾随逗号 */
        items.push(this.parseExpr());
      }
      this.expect('OP', ']');
      return { type: 'List', items: items };
    }
    if (this.isOp('{')) {
      this.pos++;
      var pairs = [];
      if (!this.isOp('}')) {
        while (true) {
          if (this.isOp('}')) break;
          var k = this.parseExpr();
          if (!this.isOp(':')) throw perr('字典要写成 键: 值', this.peek().line);
          this.pos++;
          var v = this.parseExpr();
          pairs.push({ k: k, v: v });
          if (this.isOp(',')) { this.pos++; continue; }
          break;
        }
      }
      this.expect('OP', '}');
      return { type: 'Dict', items: pairs };
    }
    if (t.type === 'IDENT') {
      this.pos++;
      var node = { type: 'Name', name: t.value };
      while (true) {
        if (this.isOp('.')) {
          this.pos++;
          var a = this.peek();
          if (a.type !== 'IDENT') throw perr('「.」后面要跟名字', a.line);
          this.pos++;
          node = { type: 'Member', base: node, attr: a.value };
          continue;
        }
        if (this.isOp('[')) {
          this.pos++;
          if (this.isOp(']')) throw perr('下标不能为空', this.peek().line);
          var idx = null;
          if (!this.isOp(':') && !this.isOp(']')) idx = this.parseExpr();
          if (this.isOp(':')) {
            /* 切片：a[起点:终点:步长] */
            this.pos++;
            var stop = null, step = null;
            if (!this.isOp(':') && !this.isOp(']')) stop = this.parseExpr();
            if (this.isOp(':')) {
              this.pos++;
              if (!this.isOp(']')) step = this.parseExpr();
            }
            this.expect('OP', ']');
            node = { type: 'Slice', base: node, start: idx, stop: stop, step: step };
          } else {
            this.expect('OP', ']');
            node = { type: 'Index', base: node, index: idx };
          }
          continue;
        }
        if (this.isOp('(')) {
          var args = [];
          this.expect('OP', '(');
          if (!this.isOp(')')) {
            while (true) {
              var kwt = this.peek();
              if (kwt.type === 'IDENT' && this.peek(1).type === 'OP' && this.peek(1).value === '=') {
                var kwName = kwt.value;
                this.pos += 2;
                args.push({ type: 'KwArg', name: kwName, value: this.parseExpr() });
              } else {
                args.push(this.parseExpr());
              }
              if (this.isOp(',')) { this.pos++; continue; }
              break;
            }
          }
          this.expect('OP', ')');
          node = { type: 'Call', callee: node, args: args };
          continue; /* 调用后还能继续 . [ ( 链 */
        }
        break;
      }
      return node;
    }
    throw perr('这里写错了：' + (t.value !== undefined ? t.value : t.type), t.line);
  };

  /* ---------- 反查表 ---------- */
  function buildRev(map) {
    var rev = {};
    Object.keys(map).forEach(function (k) { rev[map[k]] = k; });
    return rev;
  }
  var BUILTIN_REV = buildRev(BUILTINS);
  delete BUILTIN_REV.e; /* e 是 math 常量，函数名 e(...) 不应被映射 */
  var METHODS_REV = buildRev(METHODS);
  var PROPERTIES_REV = buildRev(PROPERTIES);
  var ERRORS_REV = buildRev(ERRORS);
  var CONSTANT_REV = { pi: '圆周率', e: '自然常数' };
  var LIBRARY_FN_REV = {};
  LIBRARIES.forEach(function (lib) {
    lib.blocks.forEach(function (b) {
      if (b.target && b.kind !== 'constant' && !LIBRARY_FN_REV[b.target]) LIBRARY_FN_REV[b.target] = b.name;
    });
  });
  var MODULE_REV = {};
  LIBRARIES.forEach(function (lib) {
    if (!MODULE_REV[lib.module]) MODULE_REV[lib.module] = lib.name;
    if (lib.alias && !MODULE_REV[lib.alias]) MODULE_REV[lib.alias] = lib.name;
  });
  var SPECIAL_METHOD_REV = { __init__: '初始化', __str__: '字符串表示', __len__: '长度', __eq__: '比较' };
  var OP_CN = {
    '+': '加', '-': '减', '*': '乘', '/': '除以', '%': '取余', '//': '取整', '**': '幂',
    '==': '等于', '!=': '不等于', '>': '大于', '<': '小于', '>=': '大于等于', '<=': '小于等于',
    'and': '且', 'or': '或', 'in': '属于', 'not in': '不属于',
    'is': '是', 'is not': '不是',
    '&': '位与', '|': '位或', '^': '异或', '<<': '左移', '>>': '右移',
  };

  function memberPath(n) {
    if (n.type === 'Name') return n.name;
    if (n.type === 'Member') {
      var b = memberPath(n.base);
      return b ? b + '.' + n.attr : null;
    }
    return null;
  }

  /* ---------- 中文渲染 ---------- */
  function escapeMultiline(s) {
    /* 多行字符串转成单行：真实换行 → \n，字面双引号 → \"，已有转义保留 */
    var out = '';
    for (var i = 0; i < s.length; i++) {
      var ch = s[i];
      if (ch === '\\' && i + 1 < s.length) { out += ch + s[i + 1]; i++; continue; }
      if (ch === '\n') { out += '\\n'; continue; }
      if (ch === '"') { out += '\\"'; continue; }
      out += ch;
    }
    return out;
  }

  function cnExpr(node, inClass) {
    switch (node.type) {
      case 'Num': return node.value;
      case 'Str': {
        var v = node.value;
        if (node.multiline) {
          /* 多行字符串转成单行（真实换行 → \n、字面双引号 → \"、已有转义保留） */
          var out = '';
          for (var si = 0; si < v.length; si++) {
            var ch = v[si];
            if (ch === '\\' && si + 1 < v.length) { out += ch + v[si + 1]; si++; continue; }
            if (ch === '\n') { out += '\\n'; continue; }
            if (ch === '"') { out += '\\"'; continue; }
            out += ch;
          }
          return (node.prefix || '') + '"' + out + '"';
        }
        var q = (v.indexOf('"') >= 0 && v.indexOf("'") < 0) ? "'" : '"';
        if (q === '"') v = v.replace(/"/g, '\\"');
        else v = v.replace(/'/g, "\\'");
        return (node.prefix || '') + q + v + q;
      }
      case 'Bool': return node.value ? '真' : '假';
      case 'None': return '无';
      case 'Name': return node.name === 'self' ? '自身' : node.name;
      case 'Index': return cnExpr(node.base, inClass) + '[' + cnExpr(node.index, inClass) + ']';
      case 'Slice': {
        return cnExpr(node.base, inClass) + '[' +
          (node.start ? cnExpr(node.start, inClass) : '') + ':' +
          (node.stop ? cnExpr(node.stop, inClass) : '') +
          (node.step ? ':' + cnExpr(node.step, inClass) : '') + ']';
      }
      case 'Lambda': return '匿名函数 ' + node.params.join(', ') + '：' + cnExpr(node.body, inClass);
      case 'Member': {
        var b = node.base;
        var baseStr;
        if (b.type === 'Name' && MODULE_REV[b.name]) baseStr = MODULE_REV[b.name];
        else baseStr = cnExpr(b, inClass);
        if (CONSTANT_REV[node.attr]) return baseStr + '.' + CONSTANT_REV[node.attr];
        var p2 = PROPERTIES_REV[node.attr];
        if (p2) return baseStr + '.' + p2;
        var m2 = METHODS_REV[node.attr];
        if (m2) return baseStr + '.' + m2;
        return baseStr + '.' + node.attr;
      }
      case 'Call': {
        var callee = node.callee;
        var args = node.args.map(function (a) {
          if (a.type === 'KwArg') return a.name + '=' + cnExpr(a.value, inClass);
          return cnExpr(a, inClass);
        }).join(', ');
        if (callee.type === 'Name') {
          var n = callee.name;
          if (BUILTIN_REV[n]) return BUILTIN_REV[n] + '(' + args + ')';
          if (LIBRARY_FN_REV[n]) return LIBRARY_FN_REV[n] + '(' + args + ')';
          return n + '(' + args + ')';
        }
        if (callee.type === 'Member') {
          var path = memberPath(callee.base);
          if (path && MODULE_REV[path]) {
            var fn = LIBRARY_FN_REV[callee.attr];
            if (fn) return fn + '(' + args + ')';
            return MODULE_REV[path] + '.' + callee.attr + '(' + args + ')';
          }
          var m = METHODS_REV[callee.attr];
          if (m) return cnExpr(callee.base, inClass) + '.' + m + '(' + args + ')';
          var p = PROPERTIES_REV[callee.attr];
          if (p) return cnExpr(callee.base, inClass) + '.' + p + '()';
          return cnExpr(callee.base, inClass) + '.' + callee.attr + '(' + args + ')';
        }
        return cnExpr(callee, inClass) + '(' + args + ')';
      }
      case 'BinOp': {
        return cnExpr(node.l, inClass) + ' ' + (OP_CN[node.op] || node.op) + ' ' + cnExpr(node.r, inClass);
      }
      case 'Unary': {
        if (node.op === '-') return '-' + cnExpr(node.expr, inClass);
        if (node.op === '~') return '取反 ' + cnExpr(node.expr, inClass);
        return '非 ' + cnExpr(node.expr, inClass);
      }
      case 'Await': return '等待 ' + cnExpr(node.expr, inClass);
      case 'Paren': return '(' + cnExpr(node.expr, inClass) + ')';
      case 'IfExp': return cnExpr(node.body, inClass) + ' 如果 ' + cnExpr(node.cond, inClass) + ' 否则 ' + cnExpr(node.orelse, inClass);
      case 'ListComp': {
        return '[' + cnExpr(node.expr, inClass) + ' 对于 ' + node.var.join(', ') + ' 在 ' + cnExpr(node.iter, inClass) +
          (node.cond ? ' 如果 ' + cnExpr(node.cond, inClass) : '') + ']';
      }
      case 'List': return '[' + node.items.map(function (x) { return cnExpr(x, inClass); }).join(', ') + ']';
      case 'Tuple': return '(' + node.items.map(function (x) { return cnExpr(x, inClass); }).join(', ') + ')';
      case 'Dict': {
        return '{' + node.items.map(function (p) {
          var k = p.k.type === 'Name' ? '"' + p.k.name + '"' : cnExpr(p.k, inClass);
          return k + ': ' + cnExpr(p.v, inClass);
        }).join(', ') + '}';
      }
    }
    throw new Error('无法翻译成中文的表达式');
  }

  function cnTarget(target, inClass) {
    if (!target || target.type === 'Name') return target ? target.name : '';
    return cnExpr(target, inClass);
  }

  function cnStmt(s, level, out, inClass) {
    var pad = '    '.repeat(level);
    switch (s.type) {
      case 'Comment': out.push(pad + '注释 ' + s.text); break;
      case 'Assign': {
        if (s.targets && s.targets.length > 1) {
          out.push(pad + s.targets.map(function (tg) { return cnTarget(tg, inClass); }).join('，') + ' = ' + cnExpr(s.expr, inClass));
        } else {
          out.push(pad + cnTarget(s.target, inClass) + ' = ' + cnExpr(s.expr, inClass));
        }
        break;
      }
      case 'AssignOp': {
        var name = cnTarget(s.target, inClass);
        var e = cnExpr(s.expr, inClass);
        if (s.op === '+=') out.push(pad + name + ' 增加 ' + e);
        else if (s.op === '-=') out.push(pad + name + ' 减少 ' + e);
        else if (s.op === '*=') out.push(pad + name + ' = ' + name + ' 乘 ' + e);
        else if (s.op === '/=') out.push(pad + name + ' = ' + name + ' 除以 ' + e);
        else out.push(pad + name + ' = ' + name + ' ' + OP_CN[s.op] + ' ' + e);
        break;
      }
      case 'ExprStmt': out.push(pad + cnExpr(s.expr, inClass)); break;
      case 'Return': out.push(pad + '返回' + (s.expr ? ' ' + cnExpr(s.expr, inClass) : '')); break;
      case 'Break': out.push(pad + '断'); break;
      case 'Continue': out.push(pad + '继续'); break;
      case 'Pass': out.push(pad + '传递'); break;
      case 'Del': out.push(pad + '删除 ' + s.names.join('，')); break;
      case 'Global': out.push(pad + '全局 ' + s.names.join('，')); break;
      case 'Nonlocal': out.push(pad + '非局部 ' + s.names.join('，')); break;
      case 'Yield': out.push(pad + '生成' + (s.expr ? ' ' + cnExpr(s.expr, inClass) : '')); break;
      case 'Raise': out.push(pad + '抛出' + (s.expr ? ' ' + cnExpr(s.expr, inClass) : '')); break;
      case 'Assert': out.push(pad + '断言 ' + cnExpr(s.expr, inClass) + (s.msg ? '，' + cnExpr(s.msg, inClass) : '')); break;
      case 'Import': {
        out.push(pad + '引入 ' + s.modules.map(function (m) {
          var cnName = MODULE_REV[m.name] || m.name;
          return m.alias ? cnName + ' 作为 ' + m.alias : cnName;
        }).join('，'));
        break;
      }
      case 'FromImport': {
        var lib = MODULE_REV[s.module] || s.module;
        var names = s.names.map(function (n) {
          var rev = null;
          var libObj = null;
          LIBRARIES.forEach(function (l) { if (l.module === s.module && !libObj) libObj = l; });
          if (libObj) libObj.blocks.forEach(function (b) { if (b.target === n && !rev) rev = b.name; });
          return rev || n;
        });
        out.push(pad + '从 ' + lib + ' 引入 ' + names.join('，'));
        break;
      }
      case 'FuncDef': case 'AsyncFuncDef': {
        var fname = s.name;
        var params = s.params.map(function (p) {
          var pn = p.name;
          if (inClass && pn === 'self') pn = '自己';
          return pn + (p.default ? ' = ' + cnExpr(p.default, inClass) : '');
        });
        if (inClass) fname = SPECIAL_METHOD_REV[fname] || fname;
        out.push(pad + (s.type === 'AsyncFuncDef' ? '异步 定义 ' : '定义 ') + fname + '(' + params.join(', ') + ')：');
        cnBlock(s.body, level + 1, out, inClass);
        break;
      }
      case 'ClassDef': {
        out.push(pad + '类 ' + s.name + '：');
        cnBlock(s.body, level + 1, out, true);
        break;
      }
      case 'If': {
        out.push(pad + '如果 ' + cnExpr(s.cond, inClass) + '：');
        cnBlock(s.body, level + 1, out, inClass);
        s.rest.forEach(function (r) {
          out.push(pad + '否则如果 ' + cnExpr(r.cond, inClass) + '：');
          cnBlock(r.body, level + 1, out, inClass);
        });
        if (s.orelse) {
          out.push(pad + '否则：');
          cnBlock(s.orelse, level + 1, out, inClass);
        }
        break;
      }
      case 'While': {
        out.push(pad + '当 ' + cnExpr(s.cond, inClass) + '：');
        cnBlock(s.body, level + 1, out, inClass);
        break;
      }
      case 'For': {
        out.push(pad + '遍历 ' + s.varname.join(', ') + ' 在 ' + cnExpr(s.iter, inClass) + '：');
        cnBlock(s.body, level + 1, out, inClass);
        break;
      }
      case 'Try': {
        out.push(pad + '尝试：');
        cnBlock(s.body, level + 1, out, inClass);
        s.handlers.forEach(function (h) {
          var hd = '';
          if (h.types && h.types.length) hd = ' ' + h.types.map(function (t) { return ERRORS_REV[t] || t; }).join('，');
          out.push(pad + '捕获' + hd + (h.var ? ' 作为 ' + h.var : '') + '：');
          cnBlock(h.body, level + 1, out, inClass);
        });
        if (s.finally) {
          out.push(pad + '最后：');
          cnBlock(s.finally, level + 1, out, inClass);
        }
        break;
      }
      case 'With': {
        out.push(pad + '使用 ' + cnExpr(s.expr, inClass) + (s.asname ? ' 作为 ' + s.asname : '') + '：');
        cnBlock(s.body, level + 1, out, inClass);
        break;
      }
      default: throw new Error('无法翻译成中文的语句：' + s.type);
    }
    if (s.trailing !== undefined) {
      var last = out.length - 1;
      out[last] = out[last] + '  # ' + String(s.trailing).trim();
    }
  }

  function cnBlock(stmts, level, out, inClass) {
    if (!stmts.length) { out.push('    '.repeat(level) + '注释 这里写代码'); return; }
    for (var i = 0; i < stmts.length; i++) cnStmt(stmts[i], level, out, inClass);
  }

  function pythonToChinese(code) {
    try {
      var tokens = pyLex(code);
      var ast = new Parser(tokens).parseProgram();
      var out = [];
      for (var i = 0; i < ast.stmts.length; i++) cnStmt(ast.stmts[i], 0, out, false);
      return { ok: true, code: out.join('\n') };
    } catch (e) {
      return { ok: false, err: e.message };
    }
  }

  global.pythonToChinese = pythonToChinese;
  global.pyLex = pyLex;
})(typeof window !== 'undefined' ? window : globalThis);
