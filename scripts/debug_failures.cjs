const fs = require('fs');
const path = require('path');
const vm = require('vm');

const STORE_PATH = path.join(__dirname, '..', 'src', 'store.js');
const RULES_PATH = path.join(__dirname, '..', 'src', 'rulesEngine.js');

function transpileStore(code) {
  let c = code;
  c = c.replace(/export\s+const\s+(\w+)\s*=/g, 'var $1 = module.exports.$1 =');
  const fnNames = [];
  const fnRegex = /export\s+function\s+(\w+)\s*\(/g;
  let m; while ((m = fnRegex.exec(code)) !== null) fnNames.push(m[1]);
  c = c.replace(/export\s+function\s+(\w+)\s*\(/g, (match, name) => 'function ' + name + '(');
  const fnExports = fnNames.map(n => 'module.exports.' + n + ' = ' + n + ';').join('\n');
  c = c.replace(/export\s*\{\s*([^}]+)\s*\}\s*;?/g, (match, names) =>
    names.split(',').map(n => { const c = n.trim(); return 'module.exports.' + c + ' = ' + c + ';'; }).join('\n')
  );
  return c + '\n' + fnExports + '\n';
}

function transpileRules(code) {
  let c = code;
  c = c.replace(
    /import\s*\{\s*([^}]+)\s*\}\s*from\s*['"]\.\/store\.js['"]\s*;?/g,
    (match, names) => names.split(',').map(n => n.trim()).filter(Boolean)
      .map(n => 'var ' + n + ' = STORE.' + n + ';').join('\n')
  );
  c = c.replace(/import\s*\{\s*[^}]+\s*\}\s*from\s*['"][^'"]+['"]\s*;?/g, '');
  c = c.replace(/export\s+const\s+(\w+)\s*=/g, 'var $1 = module.exports.$1 =');
  const fnNames2 = []; const fnRegex2 = /export\s+function\s+(\w+)\s*\(/g;
  let m2; while ((m2 = fnRegex2.exec(code)) !== null) fnNames2.push(m2[1]);
  c = c.replace(/export\s+function\s+(\w+)\s*\(/g, (match, name) => 'function ' + name + '(');
  const fnExports2 = fnNames2.map(n => 'module.exports.' + n + ' = ' + n + ';').join('\n');
  c = c.replace(/export\s*\{\s*([^}]+)\s*\}\s*;?/g, (match, names) =>
    names.split(',').map(n => { const c = n.trim(); return 'module.exports.' + c + ' = ' + c + ';'; }).join('\n')
  );
  return c + '\n' + fnExports2 + '\n';
}

function createSandbox() {
  const s = {
    console: { log: () => {}, warn: () => {}, error: (m) => process.stderr.write(String(m)+'\n') },
    localStorage: (() => {
      const store = {};
      return {
        getItem: (k) => k in store ? store[k] : null,
        setItem: (k, v) => store[k] = String(v),
        removeItem: (k) => delete store[k],
        clear: () => { for (const k of Object.keys(store)) delete store[k]; }
      };
    })(),
    module: { exports: {} },
    exports: {}, Date, Math, JSON, Object, Array, String, Number, Error, process
  };
  s.global = s;
  vm.createContext(s);
  return s;
}

const sb = createSandbox();
vm.runInContext(transpileStore(fs.readFileSync(STORE_PATH, 'utf8')), sb, { filename: 's.js' });
const store = sb.module.exports;
sb.module.exports = {};
sb.STORE = store;
vm.runInContext(transpileRules(fs.readFileSync(RULES_PATH, 'utf8')), sb, { filename: 'r.js' });
const rules = sb.module.exports;
const { enforceRules, parseRuleError } = rules;

const state = store.getInitialState();

// ================ 测试失败的场景 ================

console.log('=== FAIL 1: TC-S1f parseRuleError ===');
try {
  enforceRules(state, { opType: 'book_trial', childId: 'ch_xm', courseId: 'c_piano_01', sessionId: 's_piano', role: 'parent' });
} catch (e) {
  console.log('  错误抛出成功: ruleCode=' + e.ruleCode);
  console.log('  错误 keys:', Object.keys(e).slice(0,10));
  const parsed = parseRuleError(e);
  console.log('  parseRuleError 返回:', parsed ? JSON.stringify({ ...parsed, raw: undefined }) : 'null');
}

console.log('\n=== FAIL 2: TC-S1g 小刚(6岁)报钢琴(4-6岁) ===');
try {
  const res = enforceRules(state, { opType: 'book_trial', childId: 'ch_xg', courseId: 'c_piano_01', sessionId: 's_piano', role: 'parent' });
  console.log('  通过:', JSON.stringify({ allowed: res.allowed, mode: res.mode, ruleTrace: res.ruleTrace.slice(0,3) }));
} catch(e) {
  console.log('  被拒绝:', e.ruleCode, e.message);
}

console.log('\n=== FAIL 3-5: TC-S2 小华报满员美术课 ===');
try {
  const res = enforceRules(state, { opType: 'enroll', childId: 'ch_xh', courseId: 'c_art_01', sessionId: 's_art_sat', role: 'parent' });
  console.log('  返回 keys:', Object.keys(res));
  console.log('  allowed:', res.allowed);
  console.log('  mode:', res.mode);
  console.log('  position:', res.position);
  console.log('  ruleTrace:', res.ruleTrace);
} catch(e) {
  console.log('  被拒绝:', e.ruleCode, e.message);
}

console.log('\n=== FAIL 6: TC-S3e selectWaitlistPromotionTarget ===');
const promoted = rules.selectWaitlistPromotionTarget(state, 'c_art_01');
console.log('  返回结构:', promoted ? Object.keys(promoted) : 'null');
if (promoted) {
  console.log('  waitlistEntry keys:', Object.keys(promoted.waitlistEntry || {}));
  console.log('  child keys:', promoted.child ? Object.keys(promoted.child) : 'null');
  console.log('  age:', promoted.age);
  // 检查 childId 是否存在于 state.children
  const ch = promoted.waitlistEntry?.childId ? storeChildren(state).find(c => c.id === promoted.waitlistEntry.childId) : null;
  console.log('  在state.children中找到:', ch ? ch.name + ' ' + calculateAgeWrap(state, ch.birthday) + '岁' : 'undefined');
}

console.log('\n=== FAIL 7-8: TC-S5 顾问绕过年龄 ===');
try {
  const res = enforceRules(state, { opType: 'book_trial', childId: 'ch_xm', courseId: 'c_piano_01', sessionId: 's_piano', role: 'advisor', bypassAge: true });
  console.log('  竟然通过了?!');
} catch(e) {
  console.log('  抛错:', e.ruleCode, e.message);
  console.log('  stack:', String(e.stack).split('\n').slice(0,3).join('\n'));
}

// 辅助函数
function storeChildren(s) { return s.children; }
function calculateAgeWrap(s, b) { return store.calculateAge(b); }
