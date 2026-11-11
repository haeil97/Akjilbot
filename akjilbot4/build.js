'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const content = require('./build-content.js').compileContent();
const files = ['base','catalog','content','opponents','store','combat','cards-v3','treasures-v3','bosses-v3','keywords','classes','expansion','runes','combat-v3','ai-evaluation','ai-choices','ai-opponent-model','ai-planner','live-config','economy','journey','game','validate','battle-ui','ui','admin','link','app','runtime'];
const source = files.map(name => name === 'content' ? '\n// Embedded design references; no runtime file reads.\nA4.content = '+JSON.stringify(content,null,2)+';\n' :
  '\n// ---- src/' + name + '.js ----\n' + fs.readFileSync(path.join(__dirname,'src',name+'.js'),'utf8')).join('\n');
const header = '// 악질봇 4.0.0 — 카카오톡봇 단일 실행 파일\n' +
  '// 카톡봇에는 이 파일의 코드 전체만 등록하세요. 다른 JS 파일이나 Node.js/npm 설치가 필요 없습니다.\n' +
  '// 게임 설정·카드·보스·보물·유물·명령어·저장·복구 코드가 이 파일 안에 모두 포함되어 있습니다.\n' +
  '// 탐험 활성화: 중립 카드 108종, 상대 26종, 중립 보물 62종과 직업·시작 보물. 전투 후 선술집 활성화.\n' +
  '// 진행 데이터와 백업은 dataPath에 자동 생성됩니다. 코드 파일과 별도로 보존해야 하는 유저 데이터입니다.\n' +
  '// 2.8.5/3.1.0 데이터는 읽거나 가져오지 않습니다.\n' +
  '// 개발용 원본: akjilbot4/src, 재생성: node akjilbot4/build.js (개발 PC에서만 사용).\n';
let output = header + 'var A4 = (function () {\nvar A4 = {};\n' + source + '\nreturn A4;\n}());\n' +
  'if (typeof module !== "undefined" && module.exports) module.exports = A4;\n' +
  'if (typeof BotManager !== "undefined" && typeof java !== "undefined" && typeof Event !== "undefined") {\n' +
  '  A4.Runtime.start(typeof globalThis !== "undefined" ? globalThis : this);\n}\n' +
  '\n' + fs.readFileSync(path.join(__dirname,'src','room-name-patch.js'),'utf8');
function trimBundleComments(code) {
  let parser;
  try { parser = require('acorn'); } catch (error) {
    const bundled = process.binding('natives')['internal/deps/acorn/acorn/dist/acorn'];
    if (!bundled) throw new Error('주석 정리에 필요한 JavaScript 파서를 찾을 수 없습니다.');
    const parserModule = {exports:{}};
    vm.runInNewContext(bundled,{module:parserModule,exports:parserModule.exports});
    parser = parserModule.exports;
  }
  const comments = [];
  parser.parse(code,{ecmaVersion:2020,onComment:comments});
  const keep = text => /^(악질봇 4\.0\.0|카톡봇에는|진행 데이터와 백업|개발용 원본:|---- src\/|---- 방 이름 보정:|\[출처\])/.test(text.trim());
  for (const comment of comments.reverse()) {
    if (!keep(comment.value)) {
      const gap = ' ' + code.slice(comment.start,comment.end).replace(/[^\r\n]/g,'');
      code = code.slice(0,comment.start) + gap + code.slice(comment.end);
    }
  }
  return code.replace(/\n[ \t]*\n(?:[ \t]*\n)+/g,'\n\n');
}
output = trimBundleComments(output);
const sandbox = {};
vm.runInNewContext(output,sandbox,{timeout:10000});
const contentErrors = sandbox.A4.Opponents.validateDesign();
if (contentErrors.length) throw new Error('상대 설계 검증 실패:\n'+contentErrors.join('\n'));
const runtimeErrors = sandbox.A4.validateCatalog(sandbox.A4.catalog);
if (runtimeErrors.length) throw new Error('실행 콘텐츠 검증 실패:\n'+runtimeErrors.join('\n'));
fs.writeFileSync(path.join(__dirname,'..','악질봇4.0.0.js'),output,'utf8');
console.log('Built 악질봇4.0.0.js ('+Buffer.byteLength(output,'utf8')+' bytes)');
