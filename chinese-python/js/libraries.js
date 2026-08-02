(function (global) {
  'use strict';

  /* 默认支持的 Python 库的中文映射表。
     在「积木面板」的“库·”分类里会自动出现：
     - snippet：点击积木时插入的模板。@@占位@@ 会被自动选中并可直接输入替换（按 Tab 跳到下一个）。
       占位里带示例内容（网址、数据、文件名等），让用户一看就知道怎么用。
     - target：翻译成 模块.英文名(...)
     - template：整段模板，支持 @module@（库前缀）、@args@（全部参数）、@argN@（第 N 个参数） */

  var LIBRARIES = [
    {
      name: '数学', module: 'math', desc: '数学计算', blocks: [
        { name: '平方根', target: 'sqrt', snippet: '平方根(@@9@@)', desc: '求平方根', example: '数学.平方根(9) 得 3.0' },
        { name: '次方', target: 'pow', snippet: '次方(@@2@@, @@10@@)', desc: '计算幂', example: '数学.次方(2, 10) 得 1024' },
        { name: '正弦', target: 'sin', snippet: '正弦(@@0@@)', desc: '正弦' },
        { name: '余弦', target: 'cos', snippet: '余弦(@@0@@)', desc: '余弦' },
        { name: '正切', target: 'tan', snippet: '正切(@@0@@)', desc: '正切' },
        { name: '对数', target: 'log', snippet: '对数(@@2.718@@)', desc: '自然对数' },
        { name: '向上取整', target: 'ceil', snippet: '向上取整(@@3.14@@)', desc: '向上取整' },
        { name: '向下取整', target: 'floor', snippet: '向下取整(@@3.14@@)', desc: '向下取整' },
        { name: '圆周率', target: 'pi', kind: 'constant', snippet: '圆周率', desc: '圆周率 π' },
        { name: '自然常数', target: 'e', kind: 'constant', snippet: '自然常数', desc: '自然常数 e' },
      ]
    },
    {
      name: '随机', module: 'random', desc: '随机数', blocks: [
        { name: '随机整数', target: 'randint', snippet: '随机整数(@@1@@, @@100@@)', desc: '取一个范围内的随机整数', example: '随机整数(1, 100)' },
        { name: '随机小数', target: 'random', snippet: '随机小数()', desc: '0 到 1 之间的随机小数' },
        { name: '随机浮点数', target: 'uniform', snippet: '随机浮点数(@@1@@, @@10@@)', desc: '范围内的随机小数' },
        { name: '随机选择', target: 'choice', snippet: '随机选择(@@["苹果", "香蕉"]@@)', desc: '从列表里随机选一个' },
        { name: '打乱', target: 'shuffle', snippet: '打乱(@@列表名@@)', desc: '把列表顺序打乱' },
      ]
    },
    {
      name: '时间', module: 'time', desc: '时间与等待', blocks: [
        { name: '睡眠', target: 'sleep', snippet: '睡眠(@@1@@)', desc: '暂停若干秒', example: '睡眠(1) 暂停 1 秒' },
        { name: '当前时间', target: 'time', snippet: '当前时间()', desc: '当前时间戳（秒）' },
      ]
    },
    {
      name: '日期时间', module: 'datetime', desc: '日期时间', blocks: [
        { name: '现在', target: 'now', snippet: '现在()', desc: '当前日期时间', example: '现在()' },
        { name: '日期', target: 'date', snippet: '日期()', desc: '当前日期' },
      ]
    },
    {
      name: '系统', module: 'os', desc: '文件与系统', blocks: [
        { name: '列出文件', target: 'listdir', snippet: '列出文件(@@"."@@)', desc: '列出目录里的文件和文件夹' },
        { name: '创建目录', target: 'makedirs', snippet: '创建目录(@@"新建文件夹"@@)', desc: '创建文件夹（可多级）' },
        { name: '获取当前目录', target: 'getcwd', snippet: '获取当前目录()', desc: '当前工作目录' },
        { name: '获取环境变量', target: 'getenv', snippet: '获取环境变量(@@"变量名"@@)', desc: '读取环境变量的值，没有则返回无' },
        { name: '检查存在', target: 'exists', snippet: '检查存在(@@"文件.txt"@@)', desc: '文件或目录是否存在' },
        { name: '删除文件', target: 'remove', snippet: '删除文件(@@"要删除的文件.txt"@@)', desc: '删除文件' },
        { name: '重命名', target: 'rename', snippet: '重命名(@@"旧名字.txt"@@, @@"新名字.txt"@@)', desc: '重命名文件' },
        { name: '路径连接', target: 'join', snippet: '路径连接(@@"文件夹"@@, @@"文件.txt"@@)', desc: '拼接文件路径' },
      ]
    },
    {
      name: '数据格式', module: 'json', desc: 'JSON 数据', blocks: [
        { name: '转为文本', target: 'dumps', snippet: '转为文本(@@[1, 2, 3]@@)', desc: '把列表/字典转成 JSON 文本' },
        { name: '读取文本', target: 'loads', snippet: '读取文本(@@"[1, 2, 3]"@@)', desc: '把 JSON 文本解析为列表/字典' },
      ]
    },
    {
      name: '海龟绘图', module: 'turtle', desc: '画图', blocks: [
        { name: '前进', target: 'forward', snippet: '前进(@@100@@)', desc: '向前移动指定距离', example: '前进(100)' },
        { name: '后退', target: 'backward', snippet: '后退(@@100@@)', desc: '向后移动' },
        { name: '左转', target: 'left', snippet: '左转(@@90@@)', desc: '向左转角度', example: '左转(90)' },
        { name: '右转', target: 'right', snippet: '右转(@@90@@)', desc: '向右转角度' },
        { name: '画圆', target: 'circle', snippet: '画圆(@@50@@)', desc: '画圆', example: '画圆(50)' },
        { name: '抬笔', target: 'penup', snippet: '抬笔()', desc: '抬起画笔（移动不留线）' },
        { name: '落笔', target: 'pendown', snippet: '落笔()', desc: '放下画笔' },
        { name: '设置颜色', target: 'color', snippet: '设置颜色(@@"red"@@)', desc: '设置画笔颜色', example: '设置颜色("red")' },
        { name: '设置速度', target: 'speed', snippet: '设置速度(@@5@@)', desc: '设置速度 1-10' },
        { name: '设置画笔大小', target: 'pensize', snippet: '设置画笔大小(@@3@@)', desc: '设置画笔粗细' },
        { name: '开始填充', target: 'begin_fill', snippet: '开始填充()', desc: '开始填充颜色' },
        { name: '结束填充', target: 'end_fill', snippet: '结束填充()', desc: '结束填充颜色' },
        { name: '隐藏海龟', target: 'hideturtle', snippet: '隐藏海龟()', desc: '隐藏小海龟' },
        { name: '完成', target: 'done', snippet: '完成()', desc: '画完保持窗口不关闭' },
      ]
    },
    {
      name: '窗口', module: 'tkinter', alias: 'tk', desc: '图形界面（模板已带好窗口参数）', blocks: [
        { name: '创建窗口', target: 'Tk', snippet: '创建窗口()', desc: '创建一个窗口', example: '窗口 = 创建窗口()' },
        { name: '设置标题', template: '@arg1@.title(@arg2@)', snippet: '设置标题(@@窗口名@@, @@"我的程序"@@)', desc: '设置窗口标题', example: '设置标题(窗口, "我的程序")' },
        { name: '设置大小', template: '@arg1@.geometry(@arg2@)', snippet: '设置大小(@@窗口名@@, @@"400x300"@@)', desc: '设置窗口大小', example: '设置大小(窗口, "400x300")' },
        { name: '标签', template: '@module@.Label(@arg1@, text=@arg2@)', snippet: '标签(@@窗口名@@, @@"你好"@@)', desc: '在窗口里显示文字', example: '标签(窗口, "你好")' },
        { name: '按钮', template: '@module@.Button(@arg1@, text=@arg2@)', snippet: '按钮(@@窗口名@@, @@"点我"@@)', desc: '可点击的按钮', example: '按钮(窗口, "点我")' },
        { name: '输入框', template: '@module@.Entry(@args@)', snippet: '输入框(@@窗口名@@)', desc: '输入文字框' },
        { name: '打包', template: '@arg1@.pack()', snippet: '打包(@@控件名@@)', desc: '把控件放进窗口', example: '打包(按钮1)' },
        { name: '主循环', template: '@arg1@.mainloop()', snippet: '主循环(@@窗口名@@)', desc: '显示窗口并等待操作', example: '主循环(窗口)' },
      ]
    },
    {
      name: '网络', module: 'urllib.request', desc: '访问网址', blocks: [
        { name: '打开网址', target: 'urlopen', snippet: '打开网址(@@"https://example.com"@@)', desc: '打开一个网址，返回网页响应', example: '网页 = 打开网址("https://example.com")' },
        { name: '获取网页内容', template: '@module@.urlopen(@args@).read().decode("utf-8")', snippet: '获取网页内容(@@"https://example.com"@@)', desc: '直接读取网页的文本内容', example: '内容 = 获取网页内容("https://example.com")' },
        { name: '创建请求', template: '@module@.Request(@args@)', snippet: '创建请求(@@"https://example.com"@@)', desc: '创建自定义请求（可再指定方法、数据、头部）', example: '请求 = 创建请求("https://example.com")' },
        { name: '发送请求', template: '@module@.urlopen(@args@)', snippet: '发送请求(@@请求名@@)', desc: '发送已创建好的请求', example: '发送请求(请求)' },
        { name: '提交表单', template: '@module@.urlopen(@arg1@, data=urllib.parse.urlencode(@arg2@).encode("utf-8"))', snippet: '提交表单(@@"https://example.com"@@, @@{"关键词": "你好"}@@)', desc: '向网址提交表单（POST）', example: '提交表单("https://example.com", {"关键词": "你好"})' },
        { name: '下载文件', template: '@module@.urlretrieve(@args@)', snippet: '下载文件(@@"https://example.com/file.zip"@@, @@"file.zip"@@)', desc: '把网址内容下载保存为文件', example: '下载文件("https://example.com/file.zip", "file.zip")' },
      ]
    },
    {
      name: '网址编码', module: 'urllib.parse', desc: '网址处理', blocks: [
        { name: '编码网址', target: 'quote', snippet: '编码网址(@@"你好"@@)', desc: '把网址里的文字转成安全编码', example: '编码网址("你好")' },
        { name: '解码网址', target: 'unquote', snippet: '解码网址(@@"%E4%BD%A0%E5%A5%BD"@@)', desc: '把编码后的网址还原' },
        { name: '参数编码', target: 'urlencode', snippet: '参数编码(@@{"关键词": "你好"}@@)', desc: '把字典转成网址参数', example: '参数编码({"关键词": "中文"})' },
      ]
    },
    {
      name: '网址解析', module: 'urllib.parse', desc: '拆解与拼接网址', blocks: [
        { name: '解析网址', target: 'urlsplit', snippet: '解析网址(@@"https://example.com/a?b=1"@@)', desc: '把网址拆成 方案/主机/路径/查询 等部分', example: '部分 = 解析网址("https://example.com/a?b=1")' },
        { name: '合并网址', target: 'urljoin', snippet: '合并网址(@@"https://example.com/a/"@@, @@"b.html"@@)', desc: '合并基础网址和相对网址', example: '合并网址("https://example.com/a/", "b.html")' },
        { name: '组装网址', target: 'urlunsplit', snippet: '组装网址(@@("https", "example.com", "/a", "", "")@@)', desc: '把拆开的网址重新拼起来' },
      ]
    },
    {
      name: '网络请求', module: 'requests', desc: '发送网络请求（需先安装 requests）', blocks: [
        { name: '请求获取', target: 'get', snippet: '请求获取(@@"https://example.com"@@)', desc: '用 GET 方式请求网址', example: '响应 = 请求获取("https://example.com")' },
        { name: '请求发送', target: 'post', snippet: '请求发送(@@"https://example.com"@@, @@{"关键词": "你好"}@@)', desc: '用 POST 方式发送数据', example: '请求发送(网址, 数据)' },
        { name: '请求放置', target: 'put', snippet: '请求放置(@@"https://example.com"@@)', desc: '用 PUT 方式更新资源' },
        { name: '请求删除', target: 'delete', snippet: '请求删除(@@"https://example.com"@@)', desc: '用 DELETE 方式删除资源' },
        { name: '请求补丁', target: 'patch', snippet: '请求补丁(@@"https://example.com"@@)', desc: '用 PATCH 方式部分更新' },
        { name: '创建会话', template: '@module@.Session(@args@)', snippet: '创建会话()', desc: '创建会话，可复用登录状态与头部', example: '会话 = 创建会话()' },
        { name: '请求获取带头部', template: '@module@.get(@arg1@, headers=@arg2@)', snippet: '请求获取带头部(@@"https://example.com"@@, @@{"User-Agent": "Mozilla/5.0"}@@)', desc: '带自定义头部的 GET 请求', example: '请求获取带头部(网址, {"User-Agent": "Mozilla/5.0"})' },
        { name: '请求发送带头部', template: '@module@.post(@arg1@, data=@arg2@, headers=@arg3@)', snippet: '请求发送带头部(@@"https://example.com"@@, @@{"关键词": "你好"}@@, @@{"User-Agent": "Mozilla/5.0"}@@)', desc: '带自定义头部的 POST 请求', example: '请求发送带头部(网址, 数据, {"User-Agent": "Mozilla/5.0"})' },
        { name: '请求获取带超时', template: '@module@.get(@arg1@, timeout=@arg2@)', snippet: '请求获取带超时(@@"https://example.com"@@, @@5@@)', desc: '带超时时间的 GET 请求', example: '请求获取带超时(网址, 5)' },
        { name: '提交表单数据', template: '@module@.post(@arg1@, data=@arg2@)', snippet: '提交表单数据(@@"https://example.com"@@, @@{"名字": "小明"}@@)', desc: '用表单方式提交字典数据', example: '提交表单数据(网址, {"名字": "小明"})' },
        { name: '发送JSON数据', template: '@module@.post(@arg1@, json=@arg2@)', snippet: '发送JSON数据(@@"https://example.com"@@, @@{"年龄": 18}@@)', desc: '以 JSON 格式提交数据', example: '发送JSON数据(网址, {"年龄": 18})' },
      ]
    },
  ];

  /* 对象方法的中文名 → 英文名（如 列表.追加 → list.append） */
  var METHODS = {
    追加: 'append', 移除: 'remove', 弹出: 'pop', 插入: 'insert', 清除: 'clear', 复制: 'copy',
    反转: 'reverse', 排序: 'sort', 分隔: 'split', 连接: 'join', 替换: 'replace',
    大写: 'upper', 小写: 'lower', 去除空白: 'strip', 开始于: 'startswith', 结束于: 'endswith',
    获取: 'get', 键: 'keys', 值: 'values', 条目: 'items', 索引: 'index', 数量: 'count',
    添加: 'add', 更新: 'update',
    读取: 'read', 解码: 'decode', 编码: 'encode',
    查找: 'find', 数字判断: 'isdigit', 字母判断: 'isalpha', 数字或字母: 'isalnum',
    空白判断: 'isspace', 首字母大写: 'capitalize', 标题化: 'title',
    居中对齐: 'center', 左对齐: 'ljust', 右对齐: 'rjust',
    删除左空白: 'lstrip', 删除右空白: 'rstrip', 交换大小写: 'swapcase',
    扩展: 'extend', 弹出项: 'popitem', 设置默认: 'setdefault',
    检查错误: 'raise_for_status', 发送请求: 'post', 放置: 'put',
    销毁: 'destroy', 显示: 'show', 隐藏: 'hide', 获取内容: 'get', 设置内容: 'set',
  };

  /* 对象属性的中文名 → 英文名（如 响应.获取文本 → 响应.text，不带括号） */
  var PROPERTIES = {
    获取文本: 'text', 状态码: 'status_code', 状态: 'status', 内容: 'content', JSON内容: 'json',
    头部: 'headers', 原因: 'reason', 网址: 'url',
    方案: 'scheme', 主机: 'hostname', 端口: 'port', 路径: 'path',
    查询: 'query', 片段: 'fragment', 用户名: 'username', 密码: 'password',
  };
  /* 注意：'编码' 是方法（encode），见 METHODS，不要加进 PROPERTIES */

  /* 内置函数的中文名 → 英文名 */
  var BUILTINS = {
    打印: 'print', 输入: 'input', 长度: 'len', 范围: 'range', 整数: 'int', 小数: 'float',
    字符串: 'str', 列表: 'list', 字典: 'dict', 集合: 'set', 类型: 'type', 最大值: 'max',
    最小值: 'min', 求和: 'sum', 排序: 'sorted', 绝对值: 'abs', 四舍五入: 'round',
    枚举: 'enumerate', 反转: 'reversed', 打开: 'open',
    元组: 'tuple', 字节串: 'bytes', 布尔: 'bool',
    二进制: 'bin', 八进制: 'oct', 十六进制: 'hex', 字符: 'chr', 编码序号: 'ord',
    格式化: 'format', 全部全真: 'all', 任一: 'any', 压缩: 'zip', 映射: 'map', 筛选: 'filter',
    帮助: 'help', 详情: 'dir',
  };

  /* 错误类型的中文名 → 英文名（用于 抛出 / 捕获） */
  var ERRORS = {
    异常: 'Exception', 值错误: 'ValueError', 类型错误: 'TypeError', 索引错误: 'IndexError',
    键错误: 'KeyError', 文件未找到: 'FileNotFoundError', 除零错误: 'ZeroDivisionError',
    超时错误: 'TimeoutError', 连接错误: 'ConnectionError', 网络错误: 'urllib.error.URLError',
    运行时错误: 'RuntimeError', 系统错误: 'OSError', 算术错误: 'ArithmeticError',
  };

  global.LIBRARIES = LIBRARIES;
  global.METHODS = METHODS;
  global.PROPERTIES = PROPERTIES;
  global.BUILTINS = BUILTINS;
  global.ERRORS = ERRORS;
})(typeof window !== 'undefined' ? window : globalThis);
