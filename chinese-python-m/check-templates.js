'use strict';
function L(p) { require('./' + p); }
L('js/libraries.js'); L('js/blocks.js'); L('js/lexer.js'); L('js/parser.js'); L('js/generator.js');
function run(code) {
  try { return { ok: true, code: generate(new Parser(lex(code)).parseProgram()).code }; }
  catch (e) { return { ok: false, err: e.message }; }
}
/* 必须跟在别的语句后面才合法的积木（否则/捕获等），单独插入报错是正常现象 */
var CONTEXT_ONLY = { '否则如果': 1, '否则': 1, '捕获': 1, '最后': 1 };
var bad = 0, total = 0;
ALL_BLOCKS.forEach(function (b) {
  if (b.cat === '运算符' && !b.snippet.match(/@@/)) return; /* 运算符词不是独立语句 */
  var code = b.snippet.replace(/@@([^@]*)@@/g, '$1');
  if (!code.trim()) return;
  total++;
  var r = run(code);
  if (!r.ok) {
    if (CONTEXT_ONLY[b.name]) return; /* 期望配合前文使用 */
    bad++;
    console.log('FAIL  [' + b.cat + '] ' + b.name + ' → ' + JSON.stringify(code) + '\n      ' + r.err);
  }
});
console.log('\n模板可直接翻译：' + (total - bad) + '/' + total + '，失败 ' + bad);
process.exit(bad ? 1 : 0);
