/* 翻译器测试：node test.js */
'use strict';

function load(p) { require('./' + p); }
['js/libraries.js', 'js/blocks.js', 'js/lexer.js', 'js/parser.js', 'js/generator.js', 'js/analysis.js', 'js/py2cn.js', 'js/examples.js'].forEach(load);

var pass = 0, fail = 0;

function run(code) {
  try {
    var tokens = lex(code);
    var ast = new Parser(tokens).parseProgram();
    var res = generate(ast);
    return { ok: true, code: res.code };
  } catch (e) {
    return { ok: false, err: e.message };
  }
}

function check(name, code, expect) {
  var r = run(code);
  var good = r.ok && r.code.indexOf(expect) >= 0;
  if (good) {
    pass++;
    console.log('PASS  ' + name);
  } else {
    fail++;
    console.log('FAIL  ' + name);
    console.log('      期望包含: ' + JSON.stringify(expect));
    console.log('      实际结果: ' + JSON.stringify(r.ok ? r.code : '错误: ' + r.err));
  }
}

/* 内置示例 */
check('示例：你好世界', '打印("你好，世界！")\n注释 说明', 'print("你好，世界！")');
check('示例：画五角星', '引入 海龟\n\n定义 画五角星(大小)：\n    遍历 边 在 范围(5)：\n        前进(大小)\n        右转(144)\n\n画五角星(100)\n完成()', 'turtle.done()');
check('示例：猜数字', '引入 随机\n\n答案 = 随机整数(1, 10)\n猜测 = 整数(输入("请猜："))\n如果 猜测 == 答案：\n    打印("对")\n否则：\n    打印("错")', 'int(input(');
check('示例：圆面积', '引入 数学\n\n半径 = 5\n面积 = 数学.次方(半径, 2) 乘 圆周率\n打印(面积)', 'math.pow(半径, 2) * math.pi');
check('示例：收集水果', '水果 = ["苹果", "香蕉"]\n遍历 每个 在 水果：\n    打印(每个)\n水果.追加("葡萄")', '水果.append("葡萄")');
check('示例：年龄判断', '年龄 = 12\n如果 年龄 大于等于 18 且 年龄 小于 60：\n    打印("成年")\n否则如果 年龄 小于 18：\n    打印("少年")\n否则：\n    打印("老年")', 'elif 年龄 < 18:');
check('示例：随机抽奖', '引入 随机\n奖品 = ["铅笔", "橡皮"]\n幸运者 = 随机选择(奖品)', 'random.choice(奖品)');
check('示例：倒计时', '引入 时间\n数字 = 3\n当 数字 大于 0：\n    数字 = 数字 减 1\n    睡眠(1)', 'while 数字 > 0:');

/* 基本语法 */
check('打印', '打印("a")', 'print("a")');
check('输入', '输入("提示")', 'input("提示")');
check('赋值-等号', '令 x = 5', 'x = 5');
check('赋值-中文等于', '令 x 等于 5', 'x = 5');
check('直接赋值', 'x = 5 + 3', 'x = 5 + 3');
check('中文词运算', 'a = 3 乘 2 加 1', '3 * 2 + 1');
check('字符串拼接', '打印("你" + 名)', '"你" + 名');
check('比较', '如果 a 不等于 b：\n    打印(1)', 'if a != b:');
check('逻辑词', '如果 a 且 b 或 c：\n    打印(1)', 'a and b or c');
check('属于', '如果 x 属于 列表：\n    打印(1)', 'if x in 列表:');
check('非', '如果 非 x：\n    打印(1)', 'if not x:');
check('布尔', '如果 真：\n    打印(1)', 'if True:');
check('循环-当', '当 i 小于 3：\n    断', 'while i < 3:');
check('循环-继续', '当 i 小于 3：\n    继续', 'continue');
check('循环-遍历', '遍历 x 在 范围(3)：\n    打印(x)', 'for x in range(3):');
check('函数定义-返回', '定义 加法(a, b)：\n    返回 a 加 b', 'def 加法(a, b):\n    return a + b');
check('空函数', '定义 f()：\n    返回', 'def f():');
/* 空块：冒号后没写代码 → 宽容生成 pass，不报错 */
var rEmpty = run('如果 x：\n\n打印(1)');
console.log((rEmpty.ok && rEmpty.code.indexOf('if x:\n    pass') >= 0 ? 'PASS  ' : 'FAIL  ') + '空块容错为 pass: ' + JSON.stringify(rEmpty.ok ? rEmpty.code : rEmpty.err));
if (rEmpty.ok && rEmpty.code.indexOf('pass') >= 0) pass++; else fail++;

/* 用户示例：当循环空块 + 注释模板 */
check('模板块-当循环', '当 a大于等于1：\n    注释 要做的事', 'while a >= 1:\n    # 要做的事');
check('模板块-如果注释', '如果 x：\n    注释 要做的事', 'if x:\n    # 要做的事');
check('忘缩进容错', '如果 x：\n打印(1)', 'if x:\n    pass');
check('无空格运算符-比较', '当 a大于等于1：\n    断', 'while a >= 1:');
check('无空格运算符-运算', 'x = n乘n 加 1', 'n * n + 1');
check('无空格运算符-中文变量', '年龄大于等于18', '年龄 >= 18');
check('无空格运算符-属于', 'x属于列表', 'x in 列表');
check('中文名不被拆坏', '定义 加法(a, b)：\n    返回 a 加 b', 'def 加法(a, b):');
check('无空格-数字结尾', '数字大于0', '数字 > 0');
check('同行简写块', '如果 x：打印(1)', 'if x:\n    print(1)');
check('列表', 'a = [1, 2, 3]', '[1, 2, 3]');
check('字典', 'd = {"苹果": 3}', '"苹果": 3');
check('方法调用', 'a = [1]\na.追加(2)\na.移除(1)', 'a.append(2)');
check('全角括号逗号', '打印（1，2）', 'print(1, 2)');
check('句号结尾', '打印("x")。\n打印("y")', 'print("y")');

/* 库 */
check('库-自动引入', '前进(100)', 'import turtle\nturtle.forward(100)');
check('库-显式引入', '引入 数学\n打印(数学.平方根(9))', 'import math\nprint(math.sqrt(9))');
check('库-从引入', '从 随机 引入 随机整数', 'from random import randint');
check('库-常量', '打印(圆周率)', 'math.pi');
check('库-窗口', '引入 窗口\nw = 创建窗口()\n设置标题("Hi")', 'import tkinter as tk');
  check('库-窗口调用', '引入 窗口\nw = 创建窗口()\n主循环(w)', 'w.mainloop()');
check('库-系统', '引入 系统\n打印(列出文件("."))', 'import os\nprint(os.listdir("."))');
check('库-数据格式', '引入 数据格式\nd = 读取文本("{}")', 'json.loads("{}")');
check('库-日期时间', '引入 日期时间\n打印(现在())', 'datetime.now()');
check('库-不加库名前缀', '打印(随机整数(1, 6))', 'random.randint(1, 6)');

/* 错误提示（不应崩溃，且应带行号） */
var r2 = run('打印(1\n');
console.log((!r2.ok ? 'PASS  ' : 'FAIL  ') + '残缺语句报错: ' + (r2.err || '无错误'));
if (!r2.ok) pass++; else fail++;

/* 容错分析：某一行出错，不影响其他行收集变量 */
(function () {
  function t(name, cond) {
    if (cond) { pass++; console.log('PASS  ' + name); }
    else { fail++; console.log('FAIL  ' + name); }
  }
  var ar = analyzeRobust('x = 5\n错误行 = = 3\ny = 输入("a")\n当 i 小于 3：\n    i = i 加 1');
  var by = {};
  ar.variables.forEach(function (v) { by[v.name] = v; });
  t('容错分析-标记部分', ar.partial === true);
  t('容错分析-x 照常收集', by['x'] && by['x'].type === '整数');
  t('容错分析-y 照常收集', by['y'] && by['y'].type === '文本' && by['y'].source === '输入');
  t('容错分析-块内变量照常收集', by['i'] && by['i'].type === '数字');
  var ar2 = analyzeRobust('a = 1\n当 a大于等于1：\n    注释 要做的事');
  t('容错分析-无错时走整体分析', ar2.partial !== true && ar2.variables.length === 1);
})();

/* 数据分析（变量类型推断 / 数据来源 / 函数返回） */
(function () {
  function t(name, cond) {
    if (cond) { pass++; console.log('PASS  ' + name); }
    else { fail++; console.log('FAIL  ' + name); }
  }
  var ast1 = new Parser(lex('猜测 = 整数(输入("a"))\n答案 = 随机整数(1, 10)\n水果 = ["苹果"]\n年龄 = 25\n年龄 = 26')).parseProgram();
  var an = analyze(ast1);
  var by = {};
  an.variables.forEach(function (v) { by[v.name] = v; });
  t('分析-变量数量', an.variables.length === 4);
  t('分析-猜测类型', by['猜测'] && by['猜测'].type === '整数');
  t('分析-猜测来源为输入', by['猜测'] && by['猜测'].source === '输入');
  t('分析-答案类型', by['答案'] && by['答案'].type === '整数');
  t('分析-答案来源为计算', by['答案'] && by['答案'].source === '计算');
  t('分析-水果类型', by['水果'] && by['水果'].type === '列表');
  t('分析-重复赋值取最新', by['年龄'] && by['年龄'].value === '26');
  t('分析-中文写法还原', by['答案'] && by['答案'].value === '随机整数(1, 10)');

  var ast2 = new Parser(lex('定义 加法(a, b)：\n    返回 a 加 b\n总和 = 加法(1, 2)')).parseProgram();
  var an2 = analyze(ast2);
  t('分析-函数返回文本', an2.functions.length === 1 && an2.functions[0].returnText === 'a 加 b');
  t('分析-函数返回类型', an2.functions[0].returnType === '数字');
  t('分析-调用函数来源', an2.variables[0] && an2.variables[0].source === '函数 加法');
  t('分析-调用函数类型', an2.variables[0] && an2.variables[0].type === '数字');

  check('网络-模板块翻译', '引入 网络\n内容 = 获取网页内容("http://x.com")', 'urllib.request.urlopen("http://x.com").read().decode("utf-8")');
  check('网络-属性访问', '引入 网络请求\n响应 = 请求获取("http://x.com")\n打印(响应.获取文本)', 'print(响应.text)');
  check('网络-网址编码', '引入 网址编码\n打印(编码网址("你好"))', 'urllib.parse.quote("你好")');
  check('网络-模板块自动引入', '内容 = 获取网页内容("http://x.com")', 'import urllib.request');
  check('网络-创建请求+发送', '引入 网络\n请求 = 创建请求("http://x.com")\n发送请求(请求)', 'urllib.request.Request("http://x.com")');
  check('网络-提交表单', '提交表单("http://x.com", {"q": "你好"})', 'urllib.request.urlopen("http://x.com", data=urllib.parse.urlencode({"q": "你好"}).encode("utf-8"))');
  check('网络-下载文件', '引入 网络\n下载文件("http://x.com/a", "a.zip")', 'urlretrieve("http://x.com/a", "a.zip")');
  check('网络-解析网址', '引入 网址解析\n部分 = 解析网址("https://x.com/a?b=1")', 'urllib.parse.urlsplit("https://x.com/a?b=1")');
  check('网络-请求带超时', '引入 网络请求\n请求获取带超时("http://x.com", 3)', 'requests.get("http://x.com", timeout=3)');
  check('网络-发送JSON', '引入 网络请求\n发送JSON数据("http://x.com", {"a": 1})', 'requests.post("http://x.com", json={"a": 1})');
  check('网络-会话与方法', '引入 网络请求\n会话 = 创建会话()\n响应 = 会话.获取("http://x.com")\n打印(响应.状态码)', '会话.get("http://x.com")');

  /* 新语法：类 / 异常 / 推导式 / 位运算 / 异步 等 */
  check('类-定义与初始化', '类 小狗：\n    定义 初始化(自己，名字)：\n        自身.名字 = 名字', 'def __init__(self, 名字):\n        self.名字 = 名字');
  check('类-字符串表示', '类 小狗：\n    定义 字符串表示(自己)：\n        返回 "小狗"', 'def __str__(self):');
  check('尝试-捕获-最后', '尝试：\n    打印(1)\n捕获 值错误 作为 错误：\n    打印(错误)\n最后：\n    打印(2)', 'except ValueError as 错误:');
  check('尝试-多类型捕获', '尝试：\n    打印(1)\n捕获 值错误，类型错误：\n    打印(2)', 'except (ValueError, TypeError):');
  check('尝试-无类型捕获', '尝试：\n    打印(1)\n捕获：\n    打印(2)', 'except:');
  check('使用-上下文', '使用 打开("a.txt") 作为 文件：\n    内容 = 文件.读取()', 'with open("a.txt") as 文件:');
  check('抛出-错误', '抛出 值错误("错了")', 'raise ValueError("错了")');
  check('断言', '断言 x 大于 0', 'assert x > 0');
  check('断言-带信息', '断言 x 大于 0，x', 'assert x > 0, x');
  check('删除', '删除 x，y', 'del x, y');
  check('传递', '如果 x：\n    传递', 'if x:\n    pass');
  check('生成', '定义 计数()：\n    生成 1', 'yield 1');
  check('全局', '全局 总数', 'global 总数');
  check('非局部', '非局部 计数', 'nonlocal 计数');
  check('异步-定义', '异步 定义 取数()：\n    等待 某事()', 'async def 取数():\n    await 某事()');
  check('三目表达式', 'x = 5 如果 a 否则 3', 'x = 5 if a else 3');
  check('列表推导式', '平方 = [n 乘 n 对于 n 在 范围(5)]', '[n * n for n in range(5)]');
  check('列表推导式-带筛选', '大 = [x 对于 x 在 列表 如果 x 大于 2]', 'for x in 列表 if x > 2');
  check('位运算', 'a = 5 位与 3 位或 1\nb = 1 左移 2 右移 1', '5 & 3 | 1');
  check('取反', 'a = 取反 5', '~5');
  check('重复执行-次数', '重复执行 5 次：\n    注释 要做的事', 'for _循环0 in range(5):');
  check('重复执行-表达式次数', '重复执行 长度(列表) 次：\n    断', 'in range(len(列表)):');
  check('重复执行直到', '重复执行直到 x 大于 10：\n    注释 要做的事', 'while True:');
  check('重复执行直到-条件', '重复执行直到 x 大于 10：\n    注释 要做的事', 'if x > 10:');
  check('重复执行直到-break', '重复执行直到 x 大于 10：\n    注释 要做的事', 'break');
  check('新内置函数', '打印(十六进制(255))\n打印(字符(65))\n打印(编码序号("A"))', 'print(hex(255))');
  check('错误类型映射', '尝试：\n    抛出 网络错误("x")\n捕获 网络错误 作为 e：\n    打印(e)', 'except urllib.error.URLError as e:');

  /* 数据分析：新语法 */
  var ast3 = new Parser(lex('x = [n 乘 n 对于 n 在 范围(3)]\ny = 元组([1])\nz = 5 如果 a 否则 2\n错误 = 值错误')).parseProgram();
  var an3 = analyze(ast3);
  var by3 = {};
  an3.variables.forEach(function (v) { by3[v.name] = v; });
  t('分析-推导式类型', by3['x'] && by3['x'].type === '列表');
  t('分析-元组类型', by3['y'] && by3['y'].type === '元组');
  t('分析-三目类型', by3['z'] && by3['z'].type === '整数');
  t('分析-错误类型', by3['错误'] && by3['错误'].type === '错误');

  /* 模板完整性：每个积木都要有模板和说明 */
  (function () {
    var bad = 0;
    LIBRARIES.forEach(function (lib) {
      lib.blocks.forEach(function (b) {
        if (!b.snippet) { bad++; console.log('FAIL  库积木缺模板: ' + lib.name + '.' + b.name); }
        else if (((b.snippet.match(/@/g) || []).length % 2) !== 0) { bad++; console.log('FAIL  模板占位符不配对: ' + b.name); }
        else if (b.snippet.indexOf('@@@@') >= 0) { bad++; console.log('FAIL  模板有空占位: ' + b.name); }
        if (!b.desc) { bad++; console.log('FAIL  库积木缺说明: ' + b.name); }
      });
    });
    ALL_BLOCKS.forEach(function (b) {
      if (!b.snippet) { bad++; console.log('FAIL  积木缺模板: ' + b.name); }
      else if (b.snippet.indexOf('@@@@') >= 0) { bad++; console.log('FAIL  积木有空占位: ' + b.name); }
    });
    /* 分类完整性：每个积木的分类都在预期集合里 */
    var EXPECTED_CATS = {
      '变量': 1, '逻辑': 1, '数据': 1, '列表': 1, '文本': 1, '运算符': 1, '进阶': 1, '错误': 1,
      '库·数学': 1, '库·随机': 1, '库·时间': 1, '库·日期时间': 1, '库·系统': 1, '库·数据格式': 1,
      '库·海龟绘图': 1, '库·窗口': 1, '库·网络': 1, '库·网址编码': 1, '库·网址解析': 1, '库·网络请求': 1
    };
    ALL_BLOCKS.forEach(function (b) {
      if (!EXPECTED_CATS[b.cat]) { bad++; console.log('FAIL  积木分类不在预期集合: ' + b.name + ' → ' + b.cat); }
    });
    if (bad === 0) { pass++; console.log('PASS  全部积木都有完整模板且分类正确'); }
    else fail += bad;
  })();

  /* 新积木：取字符 / 创建列表 / 创建字典 */
  check('取字符-正向', 'x = 文本[0]', '文本[0]');
  check('取字符-负数', 'x = 文本[-1]', '文本[-1]');
  check('创建列表', '水果 = [1, 2]', '水果 = [1, 2]');
  check('创建字典', '成绩 = {"小明": 95}', '成绩 = {"小明": 95}');
  check('文本-字数', '打印(长度("你好"))', 'len("你好")');
  check('列表-项数', '打印(长度(水果))', 'len(水果)');
  (function () {
    var rr0 = pythonToChinese('n = len(s)');
    if (rr0.ok && rr0.code === 'n = 长度(s)') { pass++; console.log('PASS  长度-反向'); }
    else { fail++; console.log('FAIL  长度-反向: ' + (rr0.ok ? rr0.code : rr0.err)); }
  })();
  (function () {
    var rr1 = pythonToChinese('x = s[0]');
    if (rr1.ok && rr1.code === 'x = s[0]') { pass++; console.log('PASS  取字符-反向'); }
    else { fail++; console.log('FAIL  取字符-反向: ' + (rr1.ok ? rr1.code : rr1.err)); }
    var rr2 = pythonToChinese('首 = "你好"[0]');
    if (rr2.ok && rr2.code === '首 = "你好"[0]') { pass++; console.log('PASS  取字符-反向文本'); }
    else { fail++; console.log('FAIL  取字符-反向文本: ' + (rr2.ok ? rr2.code : rr2.err)); }
  })();

  /* 复合赋值：x 增加 1 → x += 1 */
  check('复合赋值-增加', 'x 增加 1', 'x += 1');
  check('复合赋值-减少', 'x 减少 5', 'x -= 5');
  check('复合赋值-无空格', 'x增加1', 'x += 1');
  check('复合赋值-表达式', 'x 增加 2 乘 3', 'x += 2 * 3');
  check('复合赋值-循环计数', '数字 = 0\n当 数字 小于 3：\n    数字 增加 1', 'while 数字 < 3:');
  (function () {
    var astc = new Parser(lex('x = 1\nx 增加 2\nx 减少 1')).parseProgram();
    var anc = analyze(astc);
    var byc = {};
    anc.variables.forEach(function (v) { byc[v.name] = v; });
    t('分析-复合赋值类型', byc['x'] && byc['x'].type === '整数');
    t('分析-复合赋值显示', byc['x'] && byc['x'].value === 'x 减少 1');
  })();

  /* 元组字面量与列表/文本方法积木 */
  check('元组字面量', 'a = (1, 2, 3)', '(1, 2, 3)');
  check('列表积木-索引', '水果.索引("苹果")', '水果.index("苹果")');
  check('列表积木-扩展', '列表1.扩展(列表2)', '列表1.extend(列表2)');
  check('文本积木-大写', '文本.大写()', '文本.upper()');
  check('文本积木-分隔', '文本.分隔("，")', '文本.split("，")');
  check('文本积木-编码', '文本.编码("utf-8")', '文本.encode("utf-8")');

  /* 模板插入后应能直接翻译（示例占位可运行） */
  check('模板-打开网址', '打开网址("https://example.com")', 'urllib.request.urlopen("https://example.com")');
  check('模板-删除文件', '删除文件("要删除的文件.txt")', 'os.remove("要删除的文件.txt")');
  check('模板-组装网址', '组装网址(("https", "example.com", "/a", "", ""))', 'urllib.parse.urlunsplit(("https", "example.com", "/a", "", ""))');
  check('模板-使用文件', '使用 打开("文件.txt") 作为 文件：\n    内容 = 文件.读取()', 'with open("文件.txt") as 文件:');
  check('模板-随机选择', '随机选择(["苹果", "香蕉"])', 'random.choice(["苹果", "香蕉"])');
  check('模板-发送JSON', '发送JSON数据("https://example.com", {"年龄": 18})', 'requests.post("https://example.com", json={"年龄": 18})');

  /* 反向翻译：Python → 中文 */
  (function () {
    function cn(py, expect) {
      var r = pythonToChinese(py);
      var good = r.ok && r.code === expect;
      if (good) { pass++; console.log('PASS  反向-' + expect.slice(0, 20)); }
      else { fail++; console.log('FAIL  反向\n      期望: ' + JSON.stringify(expect) + '\n      实际: ' + JSON.stringify(r.ok ? r.code : '错误: ' + r.err)); }
    }
    cn('print("hi")', '打印("hi")');
    cn('x = int(input("a"))', 'x = 整数(输入("a"))');
    cn('if x >= 5:\n    y = 1', '如果 x 大于等于 5：\n    y = 1');
    cn('for i in range(3):\n    print(i)', '遍历 i 在 范围(3)：\n    打印(i)');
    cn('def add(a, b):\n    return a + b', '定义 add(a, b)：\n    返回 a 加 b');
    cn('import math', '引入 数学');
    cn('import urllib.request', '引入 网络');
    cn('from random import randint', '从 随机 引入 随机整数');
    cn('x += 1', 'x 增加 1');
    cn('lst.append(1)', 'lst.追加(1)');
    cn('print(math.sqrt(9))', '打印(平方根(9))');
    cn('r = requests.get(url)', 'r = 请求获取(url)');
    cn('print(r.text)', '打印(r.获取文本)');
    cn('a = True and False', 'a = 真 且 假');
    cn('b = 1 if x else 2', 'b = 1 如果 x 否则 2');
    cn('x = [i * 2 for i in range(5) if i > 1]', 'x = [i 乘 2 对于 i 在 范围(5) 如果 i 大于 1]');
    cn('with open("a.txt") as f:\n    t = f.read()', '使用 打开("a.txt") 作为 f：\n    t = f.读取()');
    cn('try:\n    x = 1\nexcept ValueError as e:\n    print(e)\nfinally:\n    print(1)', '尝试：\n    x = 1\n捕获 值错误 作为 e：\n    打印(e)\n最后：\n    打印(1)');
    cn('class Dog:\n    def __init__(self, name):\n        self.name = name', '类 Dog：\n    定义 初始化(自己, name)：\n        自身.name = name');
    cn('lst[0] = 5', 'lst[0] = 5');
    cn('d = {"a": 1}', 'd = {"a": 1}');
    cn('t = (1, 2, 3)', 't = (1, 2, 3)');
    cn('# 说明\nprint(1)', '注释 说明\n打印(1)');
    cn('while x < 3:\n    x += 1', '当 x 小于 3：\n    x 增加 1');

    /* 往返一致性：Python → 中文 → Python（去空白比较） */
    var RT = [
      'print("hi")',
      'x = int(input("a"))',
      'if x >= 5:\n    y = 1',
      'for i in range(3):\n    print(i)',
      'def add(a, b):\n    return a + b',
      'import math\nprint(math.sqrt(9))',
      'from random import randint',
      'x += 1',
      'lst.append(1)',
      'a = True and False',
      'b = 1 if x else 2',
      'x = [i * 2 for i in range(5) if i > 1]',
      'with open("a.txt") as f:\n    t = f.read()',
      'try:\n    x = 1 / 0\nexcept ZeroDivisionError as e:\n    print(e)\nfinally:\n    print(1)',
      'class Dog:\n    def __init__(self, name):\n        self.name = name\n    def bark(self):\n        return self.name',
      'while x < 3:\n    x += 1',
      't = (1, 2, 3)',
      'd = {"a": 1, "b": 2}',
      'lst[0] = 5\nprint(lst[0])',
      'import time\ntime.sleep(1)',
    ];
    function norm(s) { return s.replace(/\s+/g, ''); }
    RT.forEach(function (py) {
      var cnR = pythonToChinese(py);
      if (!cnR.ok) { fail++; console.log('FAIL  往返-翻译成中文失败: ' + py + '\n      ' + cnR.err); return; }
      var fwd = run(cnR.code);
      if (!fwd.ok) { fail++; console.log('FAIL  往返-中文还原失败: ' + py + '\n      中文: ' + cnR.code + '\n      ' + fwd.err); return; }
      if (norm(fwd.code) === norm(py)) { pass++; console.log('PASS  往返-' + py.replace(/\n/g, ' / ').slice(0, 30)); }
      else { fail++; console.log('FAIL  往返不一致\n      原Python: ' + py + '\n      中文: ' + cnR.code + '\n      还原: ' + fwd.code); }
    });

    var errR = pythonToChinese('def f(**kw):\n    pass');
    t('反向-不支持语法报错', !errR.ok && errR.err.indexOf('第') >= 0);
    cn('x *= 2', 'x = x 乘 2');
    cn('x /= 3', 'x = x 除以 3');
    cn('答案 = random.randint(1, 10)', '答案 = 随机整数(1, 10)');
    cn('if 猜测 == 答案:\n    print(1)', '如果 猜测 等于 答案：\n    打印(1)');
    cn('import numpy as np', '引入 numpy 作为 np');
    cn('ans, tok = deepseek_answer(q)', 'ans，tok = deepseek_answer(q)');
    cn('sim.sort(key=lambda x: x[0], reverse=True)', 'sim.排序(key=匿名函数 x：x[0], reverse=真)');
    cn('t = text[:200]', 't = text[:200]');
    cn('s = ("你" "好")', 's = ("你好")');
    cn('x = 5 if a else 3', 'x = 5 如果 a 否则 3');
    cn('d = {\n    "a": 1,\n    "b": 2,\n}', 'd = {"a": 1, "b": 2}');
    cn('resp = requests.post(url, json=payload, headers=headers)', 'resp = 请求发送(url, json=payload, headers=headers)');
    cn('x = np.linalg.norm(a)', 'x = np.linalg.norm(a)');
    cn('r = f"Bearer {key}"', 'r = f"Bearer {key}"');
    cn('ok = a is not None', 'ok = a 不是 无');
    cn('s = """你好\n世界"""', 's = "你好\\n世界"');

    /* 行内注释保留（正向与反向） */
    cn('a = 1  # 说明', 'a = 1  # 说明');
    var cmtPy = 'a = 1\nb = 1\nwhile a <= 100:    # 当a=1,2,...,100时循环，共100次\n    a += 1          # a变成2,3,...,101\n    b = b + 1 / b   # b的更新公式\nprint(b)';
    var cmtR = pythonToChinese(cmtPy);
    t('注释-反向成功', cmtR.ok && cmtR.code.indexOf('注释 当a=1,2,...,100时循环，共100次') >= 0);
    if (cmtR.ok) {
      var cmtF = run(cmtR.code);
      t('注释-往返一致', cmtF.ok && cmtF.code.indexOf('# 当a=1,2,...,100时循环，共100次') >= 0);
    }
    check('注释-行内-正向', 'a = 1  # 说明', 'a = 1  # 说明');
    check('f-string-正向', 'x = f"你好 {名字}"', 'x = f"你好 {名字}"');
    check('import别名-正向', '引入 numpy 作为 np', 'import numpy as np');
    check('多目标赋值-正向', 'a，b = 函数()', 'a, b = 函数()');
    check('切片-正向', 'x = 文本[1:5]', 'x = 文本[1:5]');
    check('切片-正向-步长', 'x = 文本[::2]', 'x = 文本[::2]');
    check('kwargs-正向', '打印(格式化("你好{0}", 名字))', 'print(format("你好{0}", 名字))');
    check('匿名函数-正向', '加倍 = 匿名函数 x：x 乘 2', 'lambda x: x * 2');
    check('默认参数-正向', '定义 f(a，b = 5)：\n    返回 a 加 b', 'def f(a, b = 5):');
    check('多返回-正向', '返回 a，b', 'return a, b');
    check('except括号-正向', '尝试：\n    打印(1)\n捕获 值错误，类型错误 作为 e：\n    打印(2)', 'except (ValueError, TypeError) as e:');

    /* 大程序回归：sample-ai.py 反向翻译 + 还原 */
    var fs2 = require('fs');
    var bigPy = fs2.readFileSync(__dirname + '/sample-ai.py', 'utf8');
    var bigCn = pythonToChinese(bigPy);
    t('大程序-反向翻译成功', bigCn.ok && bigCn.code.split('\n').length > 100);
    t('大程序-关键内容', bigCn.ok && bigCn.code.indexOf('定义 deepseek_answer') >= 0 && bigCn.code.indexOf('f"Bearer') >= 0 && bigCn.code.indexOf('引入 numpy 作为 np') >= 0);
    if (bigCn.ok) {
      var bigBack = run(bigCn.code);
      t('大程序-还原成功', bigBack.ok);
      t('大程序-还原关键内容', bigBack.ok && bigBack.code.indexOf('except (FileNotFoundError, json.JSONDecodeError):') >= 0 && bigBack.code.indexOf('f"Bearer') >= 0 && bigBack.code.indexOf('np.linalg.norm') >= 0);
    }
  })();

  /* 窗口界面：模板调用流程 */
  check('窗口-完整流程', '引入 窗口\n窗口 = 创建窗口()\n设置标题(窗口, "Hi")\n标签1 = 标签(窗口, "你好")\n打包(标签1)\n主循环(窗口)', '窗口.title("Hi")');
  check('窗口-标签模板', '引入 窗口\n标签1 = 标签(窗口, "你好")', 'tk.Label(窗口, text="你好")');
  check('窗口-按钮与打包', '引入 窗口\n按钮1 = 按钮(窗口, "点我")\n打包(按钮1)', '按钮1.pack()');
})();

console.log('\n结果：' + pass + ' 通过，' + fail + ' 失败');
process.exit(fail ? 1 : 0);
