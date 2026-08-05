(function (global) {
  'use strict';

  /* 数据分析器：对语法树做静态分析，找出：
     1) 变量：名称、推断类型、值（中文写法）、来源（输入 / 函数 / 计算 / 赋值）
     2) 函数：名称、参数、返回值与返回类型
     供「数据窗口」和「变量」分类积木使用。 */

  var OP_CN = {
    '+': '加', '-': '减', '*': '乘', '/': '除以', '%': '取余', '//': '取整', '**': '幂',
    '==': '等于', '!=': '不等于', '>': '大于', '<': '小于', '>=': '大于等于', '<=': '小于等于',
    'and': '且', 'or': '或', 'in': '属于', 'not in': '不属于',
    'is': '是', 'is not': '不是',
    '&': '位与', '|': '位或', '^': '异或', '<<': '左移', '>>': '右移',
  };

  var BUILTIN_TYPES = {
    打印: null, 输入: '文本', 长度: '整数', 范围: '列表', 整数: '整数', 小数: '小数',
    字符串: '文本', 列表: '列表', 字典: '字典', 集合: '集合', 类型: '文本',
    最大值: '数字', 最小值: '数字', 求和: '数字', 排序: '列表', 绝对值: '数字',
    四舍五入: '数字', 枚举: '列表', 反转: '列表', 打开: '文件',
    元组: '元组', 字节串: '字节串', 布尔: '布尔', 二进制: '文本', 八进制: '文本',
    十六进制: '文本', 字符: '文本', 编码序号: '整数', 格式化: '文本',
    全部全真: '布尔', 任一: '布尔', 压缩: '列表', 映射: '列表', 筛选: '列表',
    帮助: null, 详情: '列表',
  };

  var METHOD_TYPES = {
    追加: null, 移除: null, 弹出: '未知', 插入: null, 清除: null, 复制: '未知',
    反转: null, 排序: null, 分隔: '列表', 连接: '文本', 替换: '文本',
    大写: '文本', 小写: '文本', 去除空白: '文本', 开始于: '布尔', 结束于: '布尔',
    获取: '未知', 键: '列表', 值: '列表', 条目: '列表', 索引: '整数', 数量: '整数',
    添加: null, 更新: null, 读取: '文本', 解码: '文本', 编码: '文本',
    查找: '整数', 数字判断: '布尔', 字母判断: '布尔', 数字或字母: '布尔',
    空白判断: '布尔', 首字母大写: '文本', 标题化: '文本', 居中对齐: '文本',
    左对齐: '文本', 右对齐: '文本', 删除左空白: '文本', 删除右空白: '文本',
    交换大小写: '文本', 扩展: null, 弹出项: '未知', 设置默认: '未知',
    检查错误: null, 发送请求: '响应', 放置: '响应',
  };

  /* 库函数（按英文目标名）的结果类型 */
  var TARGET_TYPES = {
    sqrt: '小数', pow: '数字', sin: '小数', cos: '小数', tan: '小数', log: '小数',
    ceil: '整数', floor: '整数', pi: '小数', e: '小数',
    randint: '整数', random: '小数', uniform: '小数', choice: '未知', shuffle: '无',
    sleep: '无', time: '小数', now: '日期时间', date: '日期',
    listdir: '列表', makedirs: '无', getcwd: '文本', exists: '布尔',
    remove: '无', rename: '无', join: '文本',
    dumps: '文本', loads: '未知',
    forward: '无', backward: '无', left: '无', right: '无', circle: '无',
    penup: '无', pendown: '无', color: '无', speed: '无', pensize: '无',
    begin_fill: '无', end_fill: '无', hideturtle: '无', done: '无',
    Tk: '窗口', title: '无', geometry: '无', Label: '控件', Button: '控件',
    Entry: '控件', pack: '无', mainloop: '无',
    urlopen: '响应', quote: '文本', unquote: '文本', urlencode: '文本',
    get: '响应', post: '响应', put: '响应', delete: '响应', patch: '响应', Session: '会话',
    urlsplit: '网址组件', urljoin: '文本', urlunsplit: '文本',
  };

  function findLibBlock(zh) {
    for (var i = 0; i < LIBRARIES.length; i++) {
      var lib = LIBRARIES[i];
      for (var j = 0; j < lib.blocks.length; j++) {
        if (lib.blocks[j].name === zh) return { lib: lib, b: lib.blocks[j] };
      }
    }
    return null;
  }

  /* 把表达式还原成中文写法（用于显示） */
  function textOf(e) {
    if (!e) return '无';
    switch (e.type) {
      case 'Num': return e.value;
      case 'Str': return '"' + e.value + '"';
      case 'Bool': return e.value ? '真' : '假';
      case 'None': return '无';
      case 'Name': return e.name;
      case 'List': return '[' + e.items.map(textOf).join(', ') + ']';
      case 'Tuple': return '(' + e.items.map(textOf).join(', ') + ')';
      case 'Dict': return '{' + e.items.map(function (p) { return textOf(p.k) + ': ' + textOf(p.v); }).join(', ') + '}';
      case 'Call': {
        var c = e.callee;
        if (c.type === 'Member') {
          return textOf(c.base) + '.' + (METHODS[c.attr] || c.attr) + '(' + e.args.map(textOf).join(', ') + ')';
        }
        return c.name + '(' + e.args.map(textOf).join(', ') + ')';
      }
      case 'KwArg': return e.name + '=' + textOf(e.value);
      case 'Lambda': return '匿名函数 ' + e.params.join(', ') + '：' + textOf(e.body);
      case 'Member': return textOf(e.base) + '.' + (METHODS[e.attr] || e.attr);
      case 'Index': return textOf(e.base) + '[' + textOf(e.index) + ']';
      case 'Slice': return textOf(e.base) + '[' + (e.start ? textOf(e.start) : '') + ':' + (e.stop ? textOf(e.stop) : '') + (e.step ? ':' + textOf(e.step) : '') + ']';
      case 'BinOp': return textOf(e.l) + ' ' + (OP_CN[e.op] || e.op) + ' ' + textOf(e.r);
      case 'Unary': return (e.op === '-' ? '-' : e.op === '~' ? '取反 ' : '非 ') + textOf(e.expr);
      case 'ListComp': {
        return '[' + textOf(e.expr) + ' 对于 ' + e.var.join(', ') + ' 在 ' + textOf(e.iter) +
          (e.cond ? ' 如果 ' + textOf(e.cond) : '') + ']';
      }
      case 'Paren': return '(' + textOf(e.expr) + ')';
      case 'IfExp': return textOf(e.body) + ' 如果 ' + textOf(e.cond) + ' 否则 ' + textOf(e.orelse);
      case 'Await': return '等待 ' + textOf(e.expr);
    }
    return '?';
  }

  /* 推断表达式结果的类型 */
  function typeOf(e, ctx) {
    if (!e) return '未知';
    switch (e.type) {
      case 'Num': return e.value.indexOf('.') >= 0 ? '小数' : '整数';
      case 'Str': return '文本';
      case 'Bool': return '布尔';
      case 'None': return '空';
      case 'List': return '列表';
      case 'Tuple': return '元组';
      case 'Dict': return '字典';
      case 'Name': return ERRORS[e.name] ? '错误' : (ctx.varTypes[e.name] || '未知');
      case 'BinOp': {
        if (['==', '!=', '>', '<', '>=', '<=', 'in', 'not in'].indexOf(e.op) >= 0) return '布尔';
        if (e.op === '+') {
          var lt = typeOf(e.l, ctx), rt = typeOf(e.r, ctx);
          if (lt === '文本' || rt === '文本') return '文本';
        }
        return '数字';
      }
      case 'Unary': return typeOf(e.expr, ctx);
      case 'Member': return METHOD_TYPES[e.attr] || typeOf(e.base, ctx);
      case 'Index': return '未知';
      case 'Slice': return '列表';
      case 'Call': {
        var c = e.callee;
        if (c.type === 'Member') {
          return METHOD_TYPES[c.attr] || typeOf(c.base, ctx);
        }
        var n = c.name;
        if (ERRORS[n]) return '错误';
        if (BUILTIN_TYPES[n]) return BUILTIN_TYPES[n];
        if (ctx.fnTypes[n]) return ctx.fnTypes[n];
        var hit = findLibBlock(n);
        if (hit) {
          if (hit.b.template) return '文本';
          return TARGET_TYPES[hit.b.target] || '未知';
        }
        return '未知';
      }
      case 'Lambda': return '函数';
      case 'ListComp': return '列表';
      case 'Paren': return typeOf(e.expr, ctx);
      case 'IfExp': return typeOf(e.body, ctx) || typeOf(e.orelse, ctx);
      case 'Await': return '未知';
    }
    return '未知';
  }

  /* 拆掉一层转换函数（整数(输入(...)) → 输入(...)），用于判断数据来源 */
  var CONVERTERS = { 整数: 1, 小数: 1, 字符串: 1, 列表: 1, 字典: 1, 集合: 1, 类型: 1 };
  function unwrap(e) {
    while (e && e.type === 'Call' && e.callee.type === 'Name' && CONVERTERS[e.callee.name] && e.args.length === 1) {
      e = e.args[0];
    }
    return e;
  }

  /* 判断赋值表达式的来源：输入 / 函数 / 计算 / 赋值 */
  function sourceOf(expr, fnTypes) {
    var u = unwrap(expr);
    if (u.type === 'Call') {
      var c = u.callee;
      if (c.type === 'Name') {
        if (c.name === '输入') return '输入';
        if (fnTypes && fnTypes[c.name]) return '函数 ' + c.name;
        return '计算';
      }
      return '计算';
    }
    if (u.type === 'BinOp' || u.type === 'Unary') return '计算';
    return '赋值';
  }

  /* 同名变量保留最新一次赋值 */
  function upsert(list, entry) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].name === entry.name) { list[i] = entry; return; }
    }
    list.push(entry);
  }

  function analyze(ast) {
    var fnTypes = {};
    var variables = [];
    var functions = [];
    var ctx = { varTypes: {}, fnTypes: fnTypes };
    var curFn = null;

    function collectReturns(stmts) {
      stmts.forEach(function (s) {
        if (s.body) collectReturns(s.body);
        if (s.rest) s.rest.forEach(function (r) { collectReturns(r.body); });
        if (s.orelse) collectReturns(s.orelse);
        if (s.handlers) s.handlers.forEach(function (h) { collectReturns(h.body); });
        if (s.finally) collectReturns(s.finally);
        if (s.type === 'FuncDef' && s.body) {
          var returns = [];
          collectReturnsInner(s.body, returns);
          fnTypes[s.name] = returns.length ? typeOf(returns[0], { varTypes: {}, fnTypes: fnTypes }) : '未知';
        }
      });
    }
    function collectReturnsInner(stmts, acc) {
      stmts.forEach(function (s) {
        if (s.type === 'Return' && s.expr) acc.push(s.expr);
        if (s.body) collectReturnsInner(s.body, acc);
        if (s.rest) s.rest.forEach(function (r) { collectReturnsInner(r.body, acc); });
        if (s.orelse) collectReturnsInner(s.orelse, acc);
        if (s.handlers) s.handlers.forEach(function (h) { collectReturnsInner(h.body, acc); });
        if (s.finally) collectReturnsInner(s.finally, acc);
      });
    }

    /* 第二遍：收集变量与函数信息 */
    function walkStmts(stmts) {
      stmts.forEach(walkNode);
    }
    function walkNode(s) {
      if (s.type === 'Assign' || s.type === 'AssignOp') {
        if (s.targets && s.targets.length > 1) {
          /* 多目标赋值：a，b = 表达式 → 每个名字都算一个变量 */
          var mt = typeOf(s.expr, ctx);
          s.targets.forEach(function (tg) {
            if (tg.type !== 'Name') return;
            ctx.varTypes[tg.name] = mt;
            upsert(variables, { name: tg.name, type: mt, value: textOf(s.expr), source: sourceOf(s.expr, fnTypes) });
          });
          return;
        }
        if (s.target && s.target.type !== 'Name') return; /* 属性/下标赋值（自身.x = y）不算新变量 */
        var t = typeOf(s.expr, ctx);
        ctx.varTypes[s.name] = t;
        var valueText = textOf(s.expr);
        if (s.type === 'AssignOp') {
          valueText = s.name + ' ' + (s.op === '+=' ? '增加' : '减少') + ' ' + valueText;
        }
        upsert(variables, { name: s.name, type: t, value: valueText, source: sourceOf(s.expr, fnTypes) });
        return;
      }
      if (s.type === 'FuncDef') {
        var f = { name: s.name, params: s.params, returns: [] };
        functions.push(f);
        var prev = curFn;
        curFn = f;
        walkStmts(s.body);
        curFn = prev;
        return; /* body 已走完，避免重复 */
      }
      if (s.type === 'Return' && s.expr && curFn) {
        curFn.returns.push(s.expr);
        return;
      }
      if (s.body) walkStmts(s.body);
      if (s.rest) s.rest.forEach(function (r) { walkStmts(r.body); });
      if (s.orelse) walkStmts(s.orelse);
      if (s.handlers) s.handlers.forEach(function (h) { walkStmts(h.body); });
      if (s.finally) walkStmts(s.finally);
    }

    function upsert(list, entry) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].name === entry.name) { list[i] = entry; return; }
      }
      list.push(entry);
    }

    collectReturns(ast.stmts);
    walkStmts(ast.stmts);

    functions.forEach(function (f) {
      if (f.returns.length) {
        f.returnText = textOf(f.returns[0]);
        f.returnType = typeOf(f.returns[0], ctx);
      }
    });

    return { variables: variables, functions: functions };
  }

  /* 容错分析：先整体分析；如果代码某处有语法错误，
     就逐行扫描，哪一行能解析出变量就收集哪一行，不因一行错误而全部停止。 */
  function analyzeRobust(code) {
    try {
      var ast = new Parser(lex(code)).parseProgram();
      var r = analyze(ast);
      r.partial = false;
      return r;
    } catch (e) { /* 整体失败，进入逐行容错 */ }

    var lines = String(code).replace(/\r/g, '').split('\n');
    var variables = [];
    var functions = [];
    var ctx = { varTypes: {}, fnTypes: {} };
    lines.forEach(function (raw) {
      var text = raw.replace(/^[ \t\u3000]+/, '');
      if (!text.trim()) return;
      try {
        var toks = lex(text + '\n');
        var ast2 = new Parser(toks).parseProgram();
        ast2.stmts.forEach(function (s) {
          if ((s.type === 'Assign' || s.type === 'AssignOp') && s.target && s.target.type === 'Name') {
            var t = typeOf(s.expr, ctx);
            ctx.varTypes[s.name] = t;
            var valueText = textOf(s.expr);
            if (s.type === 'AssignOp') {
              valueText = s.name + ' ' + (s.op === '+=' ? '增加' : '减少') + ' ' + valueText;
            }
            upsert(variables, { name: s.name, type: t, value: valueText, source: sourceOf(s.expr, ctx.fnTypes) });
          } else if (s.type === 'FuncDef') {
            functions.push({ name: s.name, params: s.params });
          }
        });
      } catch (e2) { /* 这一行有语法错误，跳过，继续下一行 */ }
    });
    return { variables: variables, functions: functions, partial: true };
  }

  global.analyze = analyze;
  global.analyzeRobust = analyzeRobust;
})(typeof window !== 'undefined' ? window : globalThis);
