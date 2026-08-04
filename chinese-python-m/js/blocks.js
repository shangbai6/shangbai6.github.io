(function (global) {
  'use strict';

  /* 中文“积木”数据。模板里的 @@占位@@ 会被自动选中，直接输入即可替换，
     按 Tab 跳到下一个占位。占位里带示例内容，让用户一看就知道怎么写。
     分类：变量 / 逻辑 / 数据 / 列表 / 文本 / 运算符 / 进阶 / 错误 + 库积木。 */

  var LOGIC_BLOCKS = [
    { cat: '逻辑', name: '打印', snippet: '打印(@@"你好，世界"@@)', desc: '在屏幕上输出内容' },
    { cat: '逻辑', name: '输入', snippet: '输入(@@"请输入："@@)', desc: '等待用户从键盘输入，返回文本' },
    { cat: '逻辑', name: '如果', snippet: '如果 @@x 大于 5@@：\n    注释 @@要做的事@@', desc: '条件成立时执行下面的代码' },
    { cat: '逻辑', name: '否则如果', snippet: '否则如果 @@x 小于 3@@：\n    注释 @@要做的事@@', desc: '上面条件不成立时，再判断另一个条件' },
    { cat: '逻辑', name: '否则', snippet: '否则：\n    注释 @@要做的事@@', desc: '所有条件都不成立时执行' },
    { cat: '逻辑', name: '当', snippet: '当 @@x 小于 5@@：\n    注释 @@要做的事@@', desc: '只要条件成立就一直循环' },
    { cat: '逻辑', name: '重复执行', snippet: '重复执行 @@5@@ 次：\n    注释 @@要做的事@@', desc: '重复执行指定次数' },
    { cat: '逻辑', name: '重复执行直到', snippet: '重复执行直到 @@x 大于 10@@：\n    注释 @@要做的事@@', desc: '一直重复，直到条件成立才停止' },
    { cat: '逻辑', name: '遍历', snippet: '遍历 @@元素@@ 在 @@列表名@@：\n    注释 @@要做的事@@', desc: '把东西一个个取出来循环' },
    { cat: '逻辑', name: '定义', snippet: '定义 @@函数名@@(@@参数1@@, @@参数2@@)：\n    注释 @@要做的事@@', desc: '把一段代码打包成可以反复调用的函数' },
    { cat: '逻辑', name: '返回', snippet: '返回 @@值@@', desc: '函数结束，把结果交回去' },
    { cat: '逻辑', name: '断', snippet: '断', desc: '立刻跳出循环' },
    { cat: '逻辑', name: '继续', snippet: '继续', desc: '跳过本次循环，进入下一次' },
    { cat: '逻辑', name: '注释', snippet: '注释 @@说明文字@@', desc: '写给人看的说明，不参与运行' },
    { cat: '逻辑', name: '引入', snippet: '引入 @@库名@@', desc: '引入一个库（不写也会自动引入）' },
  ];

  /* 变量操作 */
  var VAR_BLOCKS = [
    { cat: '变量', name: '令', snippet: '令 @@变量名@@ = @@值@@', desc: '给变量赋值（也可以直接写 变量名 = 值）' },
    { cat: '变量', name: '增加', snippet: '@@变量名@@ 增加 @@1@@', desc: '变量自增：x 增加 1 翻译为 x += 1' },
    { cat: '变量', name: '减少', snippet: '@@变量名@@ 减少 @@1@@', desc: '变量自减：x 减少 1 翻译为 x -= 1' },
    { cat: '变量', name: '删除', snippet: '删除 @@变量名@@', desc: '删除变量（del）' },
    { cat: '变量', name: '全局', snippet: '全局 @@变量名@@', desc: '在函数里修改全局变量' },
    { cat: '变量', name: '非局部', snippet: '非局部 @@变量名@@', desc: '修改外层函数的变量' },
  ];

  var DATA_BLOCKS = [
    { cat: '数据', name: '创建列表', snippet: '@@列表名@@ = [@@元素1@@, @@元素2@@]', desc: '创建列表并赋值给变量', example: '水果 = ["苹果", "香蕉"]' },
    { cat: '数据', name: '创建字典', snippet: '@@字典名@@ = {@@键@@: @@值@@}', desc: '创建字典并赋值给变量', example: '成绩 = {"小明": 95}' },
    { cat: '数据', name: '列表', snippet: '[@@元素1@@, @@元素2@@]', desc: '一组数据，用逗号分隔' },
    { cat: '数据', name: '字典', snippet: '{@@键@@: @@值@@}', desc: '按键取值的集合' },
    { cat: '数据', name: '元组', snippet: '(@@元素1@@, @@元素2@@)', desc: '元组：圆括号加逗号，如 (1, 2, 3)' },
    { cat: '数据', name: '整数', snippet: '整数(@@"123"@@)', desc: '转成整数' },
    { cat: '数据', name: '小数', snippet: '小数(@@"3.14"@@)', desc: '转成小数' },
    { cat: '数据', name: '字符串', snippet: '字符串(@@123@@)', desc: '转成文本' },
    { cat: '数据', name: '布尔', snippet: '布尔(@@0@@)', desc: '转成真/假' },
    { cat: '数据', name: '字节串', snippet: '字节串(@@"abc"@@, @@"utf-8"@@)', desc: '转成字节串' },
    { cat: '数据', name: '长度', snippet: '长度(@@列表或文本@@)', desc: '求长度，如列表、文本的项数' },
    { cat: '数据', name: '范围', snippet: '范围(@@5@@)', desc: '生成 0 到 数量-1 的数字序列' },
    { cat: '数据', name: '求和', snippet: '求和(@@[1, 2, 3]@@)', desc: '把列表里的数字加起来' },
    { cat: '数据', name: '最大值', snippet: '最大值(@@3@@, @@5@@)', desc: '取较大的一个' },
    { cat: '数据', name: '最小值', snippet: '最小值(@@3@@, @@5@@)', desc: '取较小的一个' },
    { cat: '数据', name: '排序', snippet: '排序(@@[3, 1, 2]@@)', desc: '把列表从小到大排序（得到新列表）' },
    { cat: '数据', name: '类型', snippet: '类型(@@东西@@)', desc: '查看数据类型' },
    { cat: '数据', name: '四舍五入', snippet: '四舍五入(@@3.6@@)', desc: '四舍五入' },
    { cat: '数据', name: '二进制', snippet: '二进制(@@10@@)', desc: '转成二进制文本，如 0b101' },
    { cat: '数据', name: '八进制', snippet: '八进制(@@10@@)', desc: '转成八进制文本' },
    { cat: '数据', name: '十六进制', snippet: '十六进制(@@255@@)', desc: '转成十六进制文本' },
    { cat: '数据', name: '字符', snippet: '字符(@@65@@)', desc: '序号转字符，如 字符(65) 得 A' },
    { cat: '数据', name: '编码序号', snippet: '编码序号(@@"A"@@)', desc: '字符转序号，如 编码序号("A") 得 65' },
    { cat: '数据', name: '格式化', snippet: '格式化(@@"你好，{0}！"@@, @@名字@@)', desc: '按模板生成文本，{0} 是第一个参数' },
    { cat: '数据', name: '全部全真', snippet: '全部全真(@@[真, 真]@@)', desc: '所有元素都成立才是真' },
    { cat: '数据', name: '任一', snippet: '任一(@@[真, 假]@@)', desc: '有一个成立就是真' },
    { cat: '数据', name: '压缩', snippet: '压缩(@@列表1@@, @@列表2@@)', desc: '把两个列表按位置配对' },
    { cat: '数据', name: '映射', snippet: '映射(@@函数名@@, @@列表名@@)', desc: '把函数作用到每个元素上' },
    { cat: '数据', name: '筛选', snippet: '筛选(@@函数名@@, @@列表名@@)', desc: '挑出符合条件的元素' },
    { cat: '数据', name: '帮助', snippet: '帮助(@@对象名@@)', desc: '查看帮助信息' },
    { cat: '数据', name: '详情', snippet: '详情(@@对象名@@)', desc: '列出对象的所有成员' },
    { cat: '数据', name: '真', snippet: '真', desc: '表示成立' },
    { cat: '数据', name: '假', snippet: '假', desc: '表示不成立' },
    { cat: '数据', name: '无', snippet: '无', desc: '表示什么都没有' },
  ];

  var LIST_BLOCKS = [
    { cat: '列表', name: '取元素', snippet: '@@列表名@@[@@位置@@]', desc: '取出指定位置的元素，从 0 数起，负数从末尾数', example: '水果[0] 得第一个' },
    { cat: '列表', name: '项数', snippet: '长度(@@列表名@@)', desc: '统计列表有多少个元素', example: '长度(水果) 得 3' },
    { cat: '列表', name: '追加', snippet: '@@列表名@@.追加(@@新元素@@)', desc: '在列表末尾加一个元素', example: '水果.追加("葡萄")' },
    { cat: '列表', name: '移除', snippet: '@@列表名@@.移除(@@要移除的元素@@)', desc: '删除列表里的某个元素' },
    { cat: '列表', name: '弹出', snippet: '@@列表名@@.弹出()', desc: '取出并删除最后一个元素' },
    { cat: '列表', name: '插入', snippet: '@@列表名@@.插入(@@位置@@, @@新元素@@)', desc: '在指定位置插入元素' },
    { cat: '列表', name: '清除', snippet: '@@列表名@@.清除()', desc: '清空列表所有元素' },
    { cat: '列表', name: '反转', snippet: '@@列表名@@.反转()', desc: '把列表顺序倒过来' },
    { cat: '列表', name: '排序', snippet: '@@列表名@@.排序()', desc: '把列表从小到大排序（原地修改）' },
    { cat: '列表', name: '扩展', snippet: '@@列表名@@.扩展(@@另一个列表@@)', desc: '把另一个列表的所有元素加进来' },
    { cat: '列表', name: '查找索引', snippet: '@@列表名@@.索引(@@元素@@)', desc: '找元素在第几个位置（从 0 数）' },
    { cat: '列表', name: '元素数量', snippet: '@@列表名@@.数量(@@元素@@)', desc: '统计元素出现几次' },
    { cat: '列表', name: '复制', snippet: '@@列表名@@.复制()', desc: '复制一份列表' },
  ];

  var TEXT_BLOCKS = [
    { cat: '文本', name: '取字符', snippet: '@@文本@@[@@位置@@]', desc: '取出指定位置的字符，从 0 数起，负数从末尾数', example: '"你好"[0] 得 "你"' },
    { cat: '文本', name: '字数', snippet: '长度(@@文本@@)', desc: '统计文本有多少个字符', example: '长度("你好") 得 2' },
    { cat: '文本', name: '分隔', snippet: '@@文本@@.分隔(@@"，"@@)', desc: '按分隔符拆成列表' },
    { cat: '文本', name: '连接', snippet: '@@分隔符@@.连接(@@列表@@)', desc: '把列表用分隔符拼成一段文本' },
    { cat: '文本', name: '替换', snippet: '@@文本@@.替换(@@"旧内容"@@, @@"新内容"@@)', desc: '把旧内容换成新内容' },
    { cat: '文本', name: '大写', snippet: '@@文本@@.大写()', desc: '全部转成大写字母' },
    { cat: '文本', name: '小写', snippet: '@@文本@@.小写()', desc: '全部转成小写字母' },
    { cat: '文本', name: '去除空白', snippet: '@@文本@@.去除空白()', desc: '去掉两头的空格和换行' },
    { cat: '文本', name: '首字母大写', snippet: '@@文本@@.首字母大写()', desc: '把第一个字母变大写' },
    { cat: '文本', name: '标题化', snippet: '@@文本@@.标题化()', desc: '每个单词首字母大写' },
    { cat: '文本', name: '查找', snippet: '@@文本@@.查找(@@"关键词"@@)', desc: '找关键词的位置，找不到返回 -1' },
    { cat: '文本', name: '字符数量', snippet: '@@文本@@.数量(@@"字"@@)', desc: '统计某个字出现几次' },
    { cat: '文本', name: '开始于', snippet: '@@文本@@.开始于(@@"前缀"@@)', desc: '判断是否以某内容开头' },
    { cat: '文本', name: '结束于', snippet: '@@文本@@.结束于(@@"后缀"@@)', desc: '判断是否以某内容结尾' },
    { cat: '文本', name: '数字判断', snippet: '@@文本@@.数字判断()', desc: '是否全是数字' },
    { cat: '文本', name: '字母判断', snippet: '@@文本@@.字母判断()', desc: '是否全是字母' },
    { cat: '文本', name: '居中', snippet: '@@文本@@.居中对齐(@@10@@)', desc: '在指定宽度里居中' },
    { cat: '文本', name: '删除左空白', snippet: '@@文本@@.删除左空白()', desc: '去掉开头的空白' },
    { cat: '文本', name: '删除右空白', snippet: '@@文本@@.删除右空白()', desc: '去掉结尾的空白' },
    { cat: '文本', name: '编码', snippet: '@@文本@@.编码(@@"utf-8"@@)', desc: '转成字节串' },
    { cat: '文本', name: '解码', snippet: '@@字节串@@.解码(@@"utf-8"@@)', desc: '把字节串还原成文本' },
  ];

  var OP_BLOCKS = [
    { cat: '运算符', name: '加', snippet: '@@a@@ 加 @@b@@', desc: '加法：a 加 b' },
    { cat: '运算符', name: '减', snippet: '@@a@@ 减 @@b@@', desc: '减法' },
    { cat: '运算符', name: '乘', snippet: '@@a@@ 乘 @@b@@', desc: '乘法' },
    { cat: '运算符', name: '除以', snippet: '@@a@@ 除以 @@b@@', desc: '除法' },
    { cat: '运算符', name: '取余', snippet: '@@a@@ 取余 @@b@@', desc: '求余数' },
    { cat: '运算符', name: '取整', snippet: '@@a@@ 取整 @@b@@', desc: '整除，去掉小数部分' },
    { cat: '运算符', name: '幂', snippet: '@@a@@ 幂 @@b@@', desc: '几次方，如 2 幂 10' },
    { cat: '运算符', name: '等于', snippet: '@@a@@ 等于 @@b@@', desc: '判断两边是否相等' },
    { cat: '运算符', name: '不等于', snippet: '@@a@@ 不等于 @@b@@', desc: '判断两边是否不相等' },
    { cat: '运算符', name: '大于', snippet: '@@a@@ 大于 @@b@@', desc: '判断左边是否更大' },
    { cat: '运算符', name: '小于', snippet: '@@a@@ 小于 @@b@@', desc: '判断左边是否更小' },
    { cat: '运算符', name: '大于等于', snippet: '@@a@@ 大于等于 @@b@@', desc: '判断左边是否更大或相等' },
    { cat: '运算符', name: '小于等于', snippet: '@@a@@ 小于等于 @@b@@', desc: '判断左边是否更小或相等' },
    { cat: '运算符', name: '且', snippet: '@@a@@ 且 @@b@@', desc: '两个条件都成立才算成立' },
    { cat: '运算符', name: '或', snippet: '@@a@@ 或 @@b@@', desc: '两个条件有一个成立就算成立' },
    { cat: '运算符', name: '非', snippet: '非 @@条件@@', desc: '把条件反过来' },
    { cat: '运算符', name: '属于', snippet: '@@元素@@ 属于 @@列表@@', desc: '判断是否在列表/文本里' },
    { cat: '运算符', name: '不属于', snippet: '@@元素@@ 不属于 @@列表@@', desc: '判断是否不在列表/文本里' },
    { cat: '运算符', name: '是', snippet: '@@a@@ 是 @@b@@', desc: '判断是否同一个对象' },
    { cat: '运算符', name: '不是', snippet: '@@a@@ 不是 @@b@@', desc: '判断是否不是同一个对象' },
    { cat: '运算符', name: '位与', snippet: '@@a@@ 位与 @@b@@', desc: '按位与' },
    { cat: '运算符', name: '位或', snippet: '@@a@@ 位或 @@b@@', desc: '按位或' },
    { cat: '运算符', name: '异或', snippet: '@@a@@ 异或 @@b@@', desc: '按位异或' },
    { cat: '运算符', name: '左移', snippet: '@@a@@ 左移 @@b@@', desc: '二进制左移，相当于乘 2' },
    { cat: '运算符', name: '右移', snippet: '@@a@@ 右移 @@b@@', desc: '二进制右移，相当于除 2' },
    { cat: '运算符', name: '取反', snippet: '取反 @@数字@@', desc: '按位取反' },
  ];

  var ADV_BLOCKS = [
    { cat: '进阶', name: '类', snippet: '类 @@类名@@：\n    注释 @@要做的事@@', desc: '定义一个类（对象模板），点击后会自动带出格式' },
    { cat: '进阶', name: '初始化', snippet: '定义 初始化(自己)：\n        注释 @@要做的事@@', desc: '类里的初始化方法，翻译为 __init__' },
    { cat: '进阶', name: '字符串表示', snippet: '定义 字符串表示(自己)：\n        返回 @@文本@@', desc: '定义打印对象时的样子，翻译为 __str__' },
    { cat: '进阶', name: '自身', snippet: '自身.@@属性名@@', desc: '类方法里代表自己（翻译为 self）' },
    { cat: '进阶', name: '尝试', snippet: '尝试：\n    注释 @@要做的事@@', desc: '尝试运行代码，出错会跳到「捕获」' },
    { cat: '进阶', name: '捕获', snippet: '捕获 @@值错误@@ 作为 @@错误变量@@：\n    注释 @@要做的事@@', desc: '捕获指定错误并处理，如：捕获 值错误' },
    { cat: '进阶', name: '最后', snippet: '最后：\n    注释 @@要做的事@@', desc: '无论是否出错都会执行（finally）' },
    { cat: '进阶', name: '使用', snippet: '使用 @@打开("文件.txt")@@ 作为 @@文件@@：\n    注释 @@要做的事@@', desc: '用完后自动关闭资源（with...as）' },
    { cat: '进阶', name: '抛出', snippet: '抛出 @@值错误@@("@@出错了@@")', desc: '主动制造一个错误' },
    { cat: '进阶', name: '断言', snippet: '断言 @@条件@@', desc: '条件不成立就报错' },
    { cat: '进阶', name: '传递', snippet: '传递', desc: '空语句，占位用（pass）' },
    { cat: '进阶', name: '生成', snippet: '生成 @@值@@', desc: '在函数里一次生成一个值（yield）' },
    { cat: '进阶', name: '异步定义', snippet: '异步 定义 @@函数名@@(@@参数@@)：\n    注释 @@要做的事@@', desc: '定义异步函数（async def）' },
    { cat: '进阶', name: '等待', snippet: '等待 @@异步操作@@', desc: '等待异步操作完成（await）' },
    { cat: '进阶', name: '条件选择', snippet: '@@成立时的值@@ 如果 @@条件@@ 否则 @@不成立时的值@@', desc: '二选一的三目表达式' },
    { cat: '进阶', name: '列表推导式', snippet: '[@@表达式@@ 对于 @@变量@@ 在 @@列表@@ 如果 @@条件@@]', desc: '一行生成新列表，条件部分可以删掉' },
  ];

  /* 错误类型积木（由 ERRORS 映射自动生成，插入后占位被选中，可直接改成别的错误类型） */
  var ERR_BLOCKS = Object.keys(ERRORS).map(function (n) {
    return { cat: '错误', name: n, snippet: '@@' + n + '@@', desc: '错误类型，可用于「抛出」和「捕获」' };
  });

  /* 由库映射表自动生成库积木（每个积木都带完整模板） */
  var LIB_BLOCKS = [];
  LIBRARIES.forEach(function (lib) {
    lib.blocks.forEach(function (b) {
      LIB_BLOCKS.push({
        cat: '库·' + lib.name,
        name: b.name,
        snippet: b.snippet || b.name,
        desc: b.desc,
        example: b.example,
        lib: lib
      });
    });
  });

  var ALL_BLOCKS = VAR_BLOCKS.concat(LOGIC_BLOCKS, DATA_BLOCKS, LIST_BLOCKS, TEXT_BLOCKS, OP_BLOCKS, ADV_BLOCKS, ERR_BLOCKS, LIB_BLOCKS);

  /* 名字 → 积木（用于输入提示） */
  var NAME_INDEX = {};
  ALL_BLOCKS.forEach(function (b) { if (!NAME_INDEX[b.name]) NAME_INDEX[b.name] = b; });

  var KEYWORDS = [
    '如果', '否则', '当', '遍历', '定义', '返回', '令', '让', '设', '断', '继续',
    '注释', '引入', '从', '在', '真', '假', '无',
    '重复执行', '重复执行直到', '次',
    '且', '或', '非', '属于', '不属于',
    '等于', '不等于', '大于', '小于', '大于等于', '小于等于',
    '加', '减', '乘', '除以', '取余', '取整', '幂',
    '增加', '减少',
    '是', '不是',
    '位与', '位或', '异或', '左移', '右移', '取反',
    '类', '尝试', '捕获', '最后', '使用', '抛出', '断言', '删除', '传递', '生成',
    '全局', '非局部', '异步', '等待', '对于', '作为', '自身',
  ];

  var LIB_NAMES = LIBRARIES.map(function (l) { return l.name; });
  var FN_NAMES = Object.keys(NAME_INDEX);

  global.LOGIC_BLOCKS = LOGIC_BLOCKS;
  global.VAR_BLOCKS = VAR_BLOCKS;
  global.DATA_BLOCKS = DATA_BLOCKS;
  global.OP_BLOCKS = OP_BLOCKS;
  global.LIST_BLOCKS = LIST_BLOCKS;
  global.TEXT_BLOCKS = TEXT_BLOCKS;
  global.ADV_BLOCKS = ADV_BLOCKS;
  global.ERR_BLOCKS = ERR_BLOCKS;
  global.ALL_BLOCKS = ALL_BLOCKS;
  global.NAME_INDEX = NAME_INDEX;
  global.KEYWORDS = KEYWORDS;
  global.LIB_NAMES = LIB_NAMES;
  global.FN_NAMES = FN_NAMES;
})(typeof window !== 'undefined' ? window : globalThis);
