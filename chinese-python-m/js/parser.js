(function (global) {
  'use strict';

  /* 语法分析器：把记号流解析成语法树（AST），出错时报中文提示。 */

  function perr(msg, line) {
    return new Error('第 ' + (line || '?') + ' 行：' + msg);
  }

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
  Parser.prototype.skipJunk = function () {
    /* 不跳过 COMMENT：注释要保留并翻译，交给 parseStatement 处理 */
    while (this.peek().type === 'NEWLINE' || this.peek().type === 'DEDENT') this.pos++;
  };
  Parser.prototype.isLineEnd = function () {
    var t = this.peek();
    return t.type === 'NEWLINE' || t.type === 'EOF' || t.type === 'DEDENT' || t.type === 'COMMENT';
  };

  /* 解析一条语句，并把紧跟在语句后面的行内注释（# 说明）挂到语句上 */
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

    if (t.type === 'IDENT') {
      switch (t.value) {
        case '引入': return this.parseImport();
        case '从': return this.parseFromImport();
        case '定义': return this.parseFuncDef(false);
        case '异步': return this.parseAsyncFunc();
        case '如果': return this.parseIf();
        case '当': return this.parseWhile();
        case '遍历': return this.parseFor();
        case '重复执行': return this.parseRepeatTimes();
        case '重复执行直到': return this.parseRepeatUntil();
        case '类': return this.parseClass();
        case '尝试': return this.parseTry();
        case '使用': return this.parseWith();
        case '抛出': return this.parseRaise();
        case '断言': return this.parseAssert();
        case '删除': return this.parseDel();
        case '传递': this.pos++; return { type: 'Pass' };
        case '生成': {
          this.pos++;
          var y = null;
          if (!this.isLineEnd()) y = this.parseExpr();
          return { type: 'Yield', expr: y };
        }
        case '全局': return this.parseNames('Global');
        case '非局部': return this.parseNames('Nonlocal');
        case '如果': return this.parseIf();
        case '当': return this.parseWhile();
        case '遍历': return this.parseFor();
        case '返回': {
          this.pos++;
          var e = null;
          if (!this.isLineEnd()) {
            e = this.parseExpr();
            if (this.isOp(',')) {
              /* 一次返回多个值：返回 a，b → return a, b */
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
        case '令': case '让': case '设': { this.pos++; return this.parseAssign(); }
        case '断': this.pos++; return { type: 'Break' };
        case '继续': this.pos++; return { type: 'Continue' };
        case '注释': {
          this.pos++;
          var parts = [];
          while (!this.isLineEnd()) { parts.push(this.peek().value); this.pos++; }
          return { type: 'Comment', text: parts.join(' ') };
        }
      }
    }

    /* 没有关键字的直接赋值：x = 5 / x 等于 5 / 自身.名字 = 值 / x 增加 1 */
    if (this.isAssignStart()) {
      var pv = this.peek(1).value;
      if (pv === '+=' || pv === '-=') return this.parseAssignOp();
      return this.parseAssign();
    }

    var expr = this.parseExpr();
    var nt = this.peek();
    if (nt.type !== 'NEWLINE' && nt.type !== 'EOF' && nt.type !== 'DEDENT' && nt.type !== 'COMMENT') {
      throw perr('这一句写错了，出现了多余的内容「' + (nt.value !== undefined ? nt.value : nt.type) + '」', nt.line);
    }
    return { type: 'ExprStmt', expr: expr };
  };

  Parser.prototype.parseImport = function () {
    this.pos++;
    var modules = [];
    while (true) {
      var t = this.peek();
      if (t.type !== 'IDENT') throw perr('「引入」后面要写库的名字，如：引入 数学', t.line);
      var name = t.value;
      this.pos++;
      while (this.isOp('.')) {
        var a = this.peek(1);
        if (a.type !== 'IDENT') break;
        name += '.' + a.value;
        this.pos += 2;
      }
      var alias = null;
      if (this.peek().type === 'IDENT' && this.peek().value === '作为') {
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
    var t = this.peek();
    if (!(t.type === 'IDENT' && t.value === '引入')) {
      throw perr('格式为：从 库名 引入 函数名，如：从 随机 引入 随机整数', t.line);
    }
    this.pos++;
    var names = [];
    while (true) {
      var x = this.peek();
      if (x.type === 'IDENT') { names.push(x.value); this.pos++; }
      else throw perr('「引入」后面要写函数名', x.line);
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
      if (p.type !== 'IDENT') throw perr('参数名写错', p.line);
      var paramName = p.value;
      this.pos++;
      var def = null;
      if (this.isOp('=')) {
        this.pos++;
        def = this.parseExpr();
      }
      params.push({ name: paramName, default: def });
      if (this.isOp(',')) { this.pos++; continue; }
      if (this.isOp(')')) break;
      throw perr('参数列表缺少右括号', p.line);
    }
    this.expect('OP', ')');
    this.expectColon();
    var body = this.parseBlock();
    return { type: isAsync ? 'AsyncFuncDef' : 'FuncDef', name: name, params: params, body: body };
  };

  Parser.prototype.parseAsyncFunc = function () {
    this.pos++;
    var t = this.peek();
    if (!(t.type === 'IDENT' && t.value === '定义')) {
      throw perr('格式为：异步 定义 函数名(参数)：', t.line);
    }
    return this.parseFuncDef(true);
  };

  Parser.prototype.parseClass = function () {
    this.pos++;
    var name = this.expect('IDENT').value;
    this.expectColon();
    var body = this.parseBlock();
    return { type: 'ClassDef', name: name, body: body };
  };

  Parser.prototype.parseTry = function () {
    this.pos++;
    this.expectColon();
    var body = this.parseBlock();
    var handlers = [];
    while (true) {
      var t = this.peek();
      if (!(t.type === 'IDENT' && t.value === '捕获')) break;
      this.pos++;
      var types = [];
      var varName = null;
      while (this.peek().type === 'IDENT' && this.peek().value !== '作为') {
        var tname = this.peek().value;
        this.pos++;
        while (this.isOp('.')) {
          this.pos++;
          tname += '.' + this.expect('IDENT').value;
        }
        types.push(tname);
        if (this.isOp(',')) { this.pos++; continue; }
        break;
      }
      var tt = this.peek();
      if (tt.type === 'IDENT' && tt.value === '作为') {
        this.pos++;
        varName = this.expect('IDENT').value;
      }
      this.expectColon();
      var hb = this.parseBlock();
      handlers.push({ types: types, var: varName, body: hb });
    }
    var fin = null;
    var t2 = this.peek();
    if (t2.type === 'IDENT' && t2.value === '最后') {
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
    var t = this.peek();
    if (t.type === 'IDENT' && t.value === '作为') {
      this.pos++;
      asname = this.expect('IDENT').value;
    }
    this.expectColon();
    var body = this.parseBlock();
    return { type: 'With', expr: expr, asname: asname, body: body };
  };

  Parser.prototype.parseRaise = function () {
    this.pos++;
    var expr = null;
    if (!this.isLineEnd()) expr = this.parseExpr();
    return { type: 'Raise', expr: expr };
  };

  Parser.prototype.parseAssert = function () {
    this.pos++;
    var expr = this.parseExpr();
    var msg = null;
    if (this.isOp(',')) {
      this.pos++;
      msg = this.parseExpr();
    }
    return { type: 'Assert', expr: expr, msg: msg };
  };

  Parser.prototype.parseDel = function () {
    this.pos++;
    var names = [];
    while (true) {
      var t = this.peek();
      if (t.type !== 'IDENT') throw perr('「删除」后面要写变量名', t.line);
      names.push(t.value);
      this.pos++;
      if (this.isOp(',')) { this.pos++; continue; }
      break;
    }
    return { type: 'Del', names: names };
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

  Parser.prototype.parseIf = function () {
    this.pos++;
    var cond = this.parseExpr();
    this.expectColon();
    var body = this.parseBlock();
    var rest = [];
    var orelse = null;
    while (true) {
      var t = this.peek();
      if (!(t.type === 'IDENT' && (t.value === '否则' || t.value === '否则如果'))) break;
      this.pos++;
      var isElif = (t.value === '否则如果');
      if (!isElif && this.peek().type === 'IDENT' && this.peek().value === '如果') {
        this.pos++;
        isElif = true;
      }
      if (isElif) {
        var c = this.parseExpr();
        this.expectColon();
        var b = this.parseBlock();
        rest.push({ cond: c, body: b });
        continue;
      }
      this.expectColon();
      orelse = this.parseBlock();
      break;
    }
    return { type: 'If', cond: cond, body: body, rest: rest, orelse: orelse };
  };

  Parser.prototype.parseWhile = function () {
    this.pos++;
    var cond = this.parseExpr();
    this.expectColon();
    var body = this.parseBlock();
    return { type: 'While', cond: cond, body: body };
  };

  Parser.prototype.parseFor = function () {
    this.pos++;
    var vars = [this.expect('IDENT').value];
    while (this.isOp(',')) {
      this.pos++;
      vars.push(this.expect('IDENT').value);
    }
    var t = this.peek();
    if (!(t.type === 'IDENT' && t.value === '在')) throw perr('格式为：遍历 变量 在 列表', t.line);
    this.pos++;
    var iter = this.parseExpr();
    this.expectColon();
    var body = this.parseBlock();
    return { type: 'For', varname: vars, iter: iter, body: body };
  };

  /* 重复执行 次数 次： */
  Parser.prototype.parseRepeatTimes = function () {
    this.pos++;
    var times = this.parseExpr();
    var t = this.peek();
    if (!(t.type === 'IDENT' && t.value === '次')) throw perr('格式为：重复执行 次数 次：', t.line);
    this.pos++;
    this.expectColon();
    var body = this.parseBlock();
    return { type: 'Repeat', times: times, body: body };
  };

  /* 重复执行直到 条件： */
  Parser.prototype.parseRepeatUntil = function () {
    this.pos++;
    var cond = this.parseExpr();
    this.expectColon();
    var body = this.parseBlock();
    return { type: 'RepeatUntil', cond: cond, body: body };
  };

  /* 判断当前位置是否是一个赋值语句（支持 变量 = / 自身.属性 = / x[0] = / a，b = / 变量 增加 值） */
  Parser.prototype.isAssignStart = function () {
    var t = this.peek();
    if (t.type !== 'IDENT') return false;
    var i = 1;
    while (true) {
      var n = this.peek(i);
      if (n.type === 'OP' && n.value === ',') {
        var nx = this.peek(i + 1);
        if (nx.type !== 'IDENT') return false;
        i += 2;
        continue;
      }
      if (n.type === 'OP' && n.value === '.') {
        var a = this.peek(i + 1);
        if (a.type !== 'IDENT' && a.type !== 'NUM') return false;
        i += 2;
        continue;
      }
      if (n.type === 'OP' && n.value === '[') {
        var depth = 0;
        var j = i;
        while (true) {
          var tk = this.peek(j);
          if (tk.type === 'EOF') return false;
          if (tk.type === 'OP' && tk.value === '[') depth++;
          if (tk.type === 'OP' && tk.value === ']') {
            depth--;
            if (depth === 0) break;
          }
          j++;
        }
        i = j + 1;
        continue;
      }
      return (n.type === 'OP' && (n.value === '=' || n.value === '==' || n.value === '+=' || n.value === '-='));
    }
  };

  /* 复合赋值：x 增加 1 / x 减少 1 → x += 1 / x -= 1 */
  Parser.prototype.parseAssignOp = function () {
    var name = this.expect('IDENT').value;
    var op = this.expect('OP').value;
    var expr = this.parseExpr();
    return { type: 'AssignOp', name: name, target: { type: 'Name', name: name }, op: op, expr: expr };
  };

  Parser.prototype.parseAssign = function () {
    var targets = [];
    while (true) {
      var t = this.expect('IDENT');
      var target = { type: 'Name', name: t.value };
      while (this.isOp('.') || this.isOp('[')) {
        if (this.isOp('.')) {
          this.pos++;
          var a = this.peek();
          if (a.type !== 'IDENT' && a.type !== 'NUM') throw perr('「.」后面要跟名字', a.line);
          this.pos++;
          target = { type: 'Member', base: target, attr: String(a.value) };
        } else {
          this.pos++;
          var idx = this.parseExpr();
          this.expect('OP', ']');
          target = { type: 'Index', base: target, index: idx };
        }
      }
      targets.push(target);
      if (this.isOp(',')) { this.pos++; continue; }
      break;
    }
    var eq = this.peek();
    if (!(eq.type === 'OP' && (eq.value === '=' || eq.value === '=='))) {
      throw perr('赋值要写「=」，如：令 x = 5', eq.line);
    }
    this.pos++;
    var expr = this.parseExpr();
    if (targets.length === 1) {
      return { type: 'Assign', name: targets[0].type === 'Name' ? targets[0].name : null, target: targets[0], expr: expr };
    }
    return { type: 'Assign', name: null, target: null, targets: targets, expr: expr };
  };

  Parser.prototype.expectColon = function () {
    var t = this.peek();
    if (t.type === 'OP' && t.value === ':') { this.pos++; return; }
    throw perr('这里要写冒号「：」', t.line);
  };

  Parser.prototype.parseBlock = function () {
    var headComments = [];
    var t = this.peek();
    /* 块头行内注释：当 a <= 100：  # 说明 → 保留为块内第一条注释 */
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
        /* 宽容处理：冒号后没有缩进代码时当作空块（翻译时生成 pass），不报错 */
        while (this.peek().type === 'COMMENT') this.pos++; /* 块头注释行 */
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
    return headComments.concat([this.parseStmtWithTrailing()]); /* 同一行简写：如果 x：打印(1) */
  };

  /* ---- 表达式：优先级从低到高 ---- */
  Parser.prototype.parseExpr = function () {
    var l = this.parseOr();
    /* 三目表达式：值 如果 条件 否则 另一个值 */
    var t = this.peek();
    if (t.type === 'IDENT' && t.value === '如果') {
      this.pos++;
      var cond = this.parseOr();
      var e2 = this.peek();
      if (!(e2.type === 'IDENT' && e2.value === '否则')) {
        throw perr('三目表达式要写：值 如果 条件 否则 另一个值', e2.line);
      }
      this.pos++;
      var alt = this.parseOr();
      return { type: 'IfExp', body: l, cond: cond, orelse: alt };
    }
    return l;
  };

  Parser.prototype.parseOr = function () {
    var l = this.parseAnd();
    while (this.isOp('or')) {
      this.pos++;
      var r = this.parseAnd();
      l = { type: 'BinOp', op: 'or', l: l, r: r };
    }
    return l;
  };

  Parser.prototype.parseAnd = function () {
    var l = this.parseNot();
    while (this.isOp('and')) {
      this.pos++;
      var r = this.parseNot();
      l = { type: 'BinOp', op: 'and', l: l, r: r };
    }
    return l;
  };

  Parser.prototype.parseNot = function () {
    if (this.isOp('not')) {
      this.pos++;
      return { type: 'Unary', op: 'not', expr: this.parseNot() };
    }
    return this.parseCompare();
  };

  Parser.prototype.parseCompare = function () {
    var l = this.parseBitOr();
    var ops = ['==', '!=', '>', '<', '>=', '<=', 'in', 'not in', 'is', 'is not'];
    while (this.peek().type === 'OP' && ops.indexOf(this.peek().value) >= 0) {
      var op = this.peek().value;
      this.pos++;
      var r = this.parseBitOr();
      l = { type: 'BinOp', op: op, l: l, r: r };
    }
    return l;
  };

  Parser.prototype.parseBitOr = function () {
    var l = this.parseBitXor();
    while (this.peek().type === 'OP' && this.peek().value === '|') {
      this.pos++;
      var r = this.parseBitXor();
      l = { type: 'BinOp', op: '|', l: l, r: r };
    }
    return l;
  };

  Parser.prototype.parseBitXor = function () {
    var l = this.parseBitAnd();
    while (this.peek().type === 'OP' && this.peek().value === '^') {
      this.pos++;
      var r = this.parseBitAnd();
      l = { type: 'BinOp', op: '^', l: l, r: r };
    }
    return l;
  };

  Parser.prototype.parseBitAnd = function () {
    var l = this.parseShift();
    while (this.peek().type === 'OP' && this.peek().value === '&') {
      this.pos++;
      var r = this.parseShift();
      l = { type: 'BinOp', op: '&', l: l, r: r };
    }
    return l;
  };

  Parser.prototype.parseShift = function () {
    var l = this.parseAdd();
    while (this.peek().type === 'OP' && (this.peek().value === '<<' || this.peek().value === '>>')) {
      var op = this.peek().value;
      this.pos++;
      var r = this.parseAdd();
      l = { type: 'BinOp', op: op, l: l, r: r };
    }
    return l;
  };

  Parser.prototype.parseAdd = function () {
    var l = this.parseMul();
    while (this.peek().type === 'OP' && (this.peek().value === '+' || this.peek().value === '-')) {
      var op = this.peek().value;
      this.pos++;
      var r = this.parseMul();
      l = { type: 'BinOp', op: op, l: l, r: r };
    }
    return l;
  };

  Parser.prototype.parseMul = function () {
    var l = this.parseUnary();
    var ops = ['*', '/', '%', '//', '**'];
    while (this.peek().type === 'OP' && ops.indexOf(this.peek().value) >= 0) {
      var op = this.peek().value;
      this.pos++;
      var r = this.parseUnary();
      l = { type: 'BinOp', op: op, l: l, r: r };
    }
    return l;
  };

  Parser.prototype.parseUnary = function () {
    if (this.isOp('-')) {
      this.pos++;
      return { type: 'Unary', op: '-', expr: this.parseUnary() };
    }
    if (this.isOp('~')) {
      this.pos++;
      return { type: 'Unary', op: '~', expr: this.parseUnary() };
    }
    var w = this.peek();
    if (w.type === 'IDENT' && w.value === '等待') {
      this.pos++;
      return { type: 'Await', expr: this.parseUnary() };
    }
    return this.parsePrimary();
  };

  Parser.prototype.parsePrimary = function () {
    var t = this.peek();

    if (t.type === 'NUM') { this.pos++; return { type: 'Num', value: t.value }; }
    if (t.type === 'STR') {
      this.pos++;
      var node = { type: 'Str', value: t.value, prefix: t.prefix || '' };
      /* 字符串后还能取字符 / 调用方法："你好"[0]、"a".大写() */
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
          var a3 = this.peek();
          if (a3.type !== 'IDENT' && a3.type !== 'NUM') throw perr('「.」后面要跟名字', a3.line);
          this.pos++;
          node = { type: 'Member', base: node, attr: String(a3.value) };
          continue;
        }
        if (this.isOp('(')) {
          node = { type: 'Call', callee: node, args: this.parseArgs() };
          continue;
        }
        break;
      }
      return node;
    }

    if (this.isOp('(')) {
      this.pos++;
      if (this.isOp(')')) { this.pos++; return { type: 'Tuple', items: [] }; }
      var e = this.parseExpr();
      if (this.isOp(',')) {
        /* 元组字面量：(1, 2, 3) */
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
      /* 列表推导式：[表达式 对于 变量 在 列表 如果 条件] */
      var tc = this.peek();
      if (tc.type === 'IDENT' && tc.value === '对于') {
        this.pos++;
        var vn = [this.expect('IDENT').value];
        while (this.isOp(',')) {
          this.pos++;
          vn.push(this.expect('IDENT').value);
        }
        var tt = this.peek();
        if (!(tt.type === 'IDENT' && tt.value === '在')) throw perr('推导式要写：表达式 对于 变量 在 列表', tt.line);
        this.pos++;
        var it = this.parseOr(); /* 迭代部分到「如果/」为止，避免误判三目表达式 */
        var cond = null;
        var pf = this.peek();
        if (pf.type === 'IDENT' && pf.value === '如果') {
          this.pos++;
          cond = this.parseExpr();
        }
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
          if (!this.isOp(':')) throw perr('字典要写成 键：值', this.peek().line);
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
      if (t.value === '真') { this.pos++; return { type: 'Bool', value: true }; }
      if (t.value === '假') { this.pos++; return { type: 'Bool', value: false }; }
      if (t.value === '无') { this.pos++; return { type: 'None' }; }
      /* 匿名函数：匿名函数 x，y：表达式 */
      if (t.value === '匿名函数') {
        this.pos++;
        var lparams = [];
        while (!this.isOp(':')) {
          if (this.peek().type !== 'IDENT') throw perr('匿名函数要写：匿名函数 参数：表达式', this.peek().line);
          lparams.push(this.next().value);
          if (this.isOp(',')) { this.pos++; continue; }
          break;
        }
        this.expect('OP', ':');
        var lbody = this.parseExpr();
        return { type: 'Lambda', params: lparams, body: lbody };
      }
      this.pos++;
      var node = { type: 'Name', name: t.value };
      while (true) {
        if (this.isOp('.')) {
          this.pos++;
          var a = this.peek();
          if (a.type !== 'IDENT' && a.type !== 'NUM') throw perr('「.」后面要跟名字', a.line);
          this.pos++;
          node = { type: 'Member', base: node, attr: String(a.value) };
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
          node = { type: 'Call', callee: node, args: this.parseArgs() };
          continue; /* 调用后还能继续 . 和 [：f(x).y[0] */
        }
        break;
      }
      return node;
    }

    throw perr('这里写错了：' + (t.value !== undefined ? t.value : t.type), t.line);
  };

  Parser.prototype.parseArgs = function () {
    this.expect('OP', '(');
    var args = [];
    if (this.isOp(')')) { this.pos++; return args; }
    while (true) {
      /* 关键字参数：名字 = 值 */
      var kwt = this.peek();
      if (kwt.type === 'IDENT' && this.peek(1).type === 'OP' && this.peek(1).value === '=') {
        var kwName = kwt.value;
        this.pos += 2;
        var kwVal = this.parseExpr();
        args.push({ type: 'KwArg', name: kwName, value: kwVal });
      } else {
        args.push(this.parseExpr());
      }
      if (this.isOp(',')) { this.pos++; continue; }
      if (this.isOp(')')) { this.pos++; break; }
      throw perr('参数之间用逗号分隔，并用右括号结尾', this.peek().line);
    }
    return args;
  };

  global.Parser = Parser;
})(typeof window !== 'undefined' ? window : globalThis);
