/* 端到端验证：翻译示例并让 Python 实际执行（node e2e.js） */
'use strict';
var cp = require('child_process');
function load(p) { require('./' + p); }
['js/libraries.js', 'js/blocks.js', 'js/lexer.js', 'js/parser.js', 'js/generator.js', 'js/examples.js'].forEach(load);

var cases = [
  { name: '你好世界', code: '打印("你好，世界！")\n打印("翻译成功")', stdin: '' },
  { name: '猜数字', code: '答案 = 5\n猜测 = 整数(输入("请猜："))\n如果 猜测 == 答案：\n    打印("猜对了！")\n否则：\n    打印("错了")', stdin: '5\n' },
  { name: '圆面积', code: '半径 = 5\n面积 = 3.14 乘 半径 幂 2\n打印(面积)', stdin: '' },
  { name: '收集水果', code: '水果 = ["苹果", "香蕉"]\n水果.追加("橘子")\n遍历 每个 在 水果：\n    打印(每个)\n打印("共 " + 字符串(长度(水果)) + " 种")', stdin: '' },
  { name: '年龄判断', code: '年龄 = 25\n如果 年龄 大于等于 18 且 年龄 小于 60：\n    打印("成年")\n否则如果 年龄 小于 18：\n    打印("少年")\n否则：\n    打印("老年")', stdin: '' },
  { name: '随机抽奖', code: '引入 随机\n奖品 = ["铅笔", "橡皮"]\n幸运者 = 随机选择(奖品)\n打印("抽到：" + 幸运者)', stdin: '' },
  { name: '函数与字典', code: '定义 计算总数(d)：\n    返回 求和(d.值())\n成绩 = {"小明": 95, "小红": 88}\n打印(计算总数(成绩))', stdin: '' },
  { name: 'JSON', code: '引入 数据格式\n数据 = [1, 2, 3]\n文本 = 数据格式.转为文本(数据)\n打印(文本)', stdin: '' },
  { name: '异常处理', code: '尝试：\n    x = 1 除以 0\n捕获 除零错误 作为 错误：\n    打印("除数不能为零")\n最后：\n    打印("结束")', stdin: '' },
  { name: '列表推导式', code: '平方 = [n 乘 n 对于 n 在 范围(5)]\n打印(求和(平方))', stdin: '' },
  { name: '三目与字典', code: 'x = 5 如果 2 大于 1 否则 3\n打印(x)', stdin: '' },
  { name: '类与自身', code: '类 小狗：\n    定义 初始化(自己，名字)：\n        自身.名字 = 名字\n    定义 叫(自己)：\n        返回 自身.名字 + " 汪汪！"\n宠物 = 小狗("旺财")\n打印(宠物.叫())', stdin: '' },
  { name: '断言与删除', code: 'x = 10\n断言 x 大于 0\n删除 x\n打印("完成")', stdin: '' },
  { name: '字符串方法', code: '名字 = " 小 明 "\n整洁 = 名字.去除空白()\n打印(整洁.大写())', stdin: '' },
  { name: '匿名函数与切片', code: '加倍 = 匿名函数 x：x 乘 2\n打印(加倍(5))\n文本 = "你好世界"\n打印(文本[1:3])', stdin: '' },
  { name: '多目标与推导式', code: 'a，b = (3, 4)\n打印(a 加 b)\n平方 = [n 乘 n 对于 n 在 范围(3)]\n打印(平方)', stdin: '' },
  { name: '默认参数与多返回', code: '定义 计算(x，y = 10)：\n    返回 x 加 y，x 乘 y\n总和，乘积 = 计算(2)\n打印(总和)\n打印(乘积)', stdin: '' },
  { name: '异常元组', code: '尝试：\n    x = 整数("abc")\n捕获 值错误，类型错误 作为 错误：\n    打印("捕获到错误")\n打印("继续")', stdin: '' },
  { name: 'f字符串与注释', code: '名字 = "小明"\n打印(f"你好，{名字}！")  # 行内注释', stdin: '' },
  { name: '重复执行N次', code: '总和 = 0\n重复执行 5 次：\n    总和 增加 1\n打印(总和)', stdin: '' },
  { name: '重复执行直到', code: '数字 = 0\n重复执行直到 数字 大于等于 3：\n    数字 增加 1\n打印(数字)', stdin: '' },
];

var pass = 0, fail = 0;
cases.forEach(function (c) {
  var r;
  try {
    r = { ok: true, code: generate(new Parser(lex(c.code)).parseProgram()).code };
  } catch (e) { r = { ok: false, err: e.message }; }
  if (!r.ok) { fail++; console.log('FAIL  ' + c.name + '（翻译出错：' + r.err + '）'); return; }
  var res = cp.spawnSync('python', ['-c', r.code], { encoding: 'utf8', input: c.stdin, timeout: 10000 });
  if (res.status === 0) { pass++; console.log('PASS  ' + c.name + ' → ' + JSON.stringify(res.stdout.trim())); }
  else { fail++; console.log('FAIL  ' + c.name + '\n' + r.code + '\n' + (res.stderr || '').trim()); }
});
console.log('\n端到端结果：' + pass + ' 通过，' + fail + ' 失败');
process.exit(fail ? 1 : 0);
