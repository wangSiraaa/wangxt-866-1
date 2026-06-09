const fs = require('fs');
const path = require('path');
const vm = require('vm');

const STORE_PATH = path.join(__dirname, '..', 'src', 'store.js');
const RULES_PATH = path.join(__dirname, '..', 'src', 'rulesEngine.js');

function transpileStore(code) {
  let c = code;
  c = c.replace(/export\s+const\s+(\w+)\s*=/g, 'const $1 = module.exports.$1 =');
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
  c = c.replace(/export\s+const\s+(\w+)\s*=/g, 'const $1 = module.exports.$1 =');
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
const { enforceRules } = rules;

const state = store.getInitialState();

console.log('===== 环境检查 =====');
const dance = state.courses.find(c => c.id === 'c_dance_01');
console.log('舞蹈课 totalSeats =', dance.totalSeats);
const activeDancers = state.enrollments.filter(e => e.courseId === 'c_dance_01' && e.status === 'active');
console.log('舞蹈课 activeCount =', activeDancers.length);
console.log('state.role =', state.role);
console.log('state 是否有 admin 角色检查? state.role=', state.role);

console.log('\n===== TEST 1: adjust_capacity 12->10, 手动传 role=admin =====');
try {
  const params = { opType: 'adjust_capacity', courseId: 'c_dance_01', newCapacity: 10, role: 'admin' };
  console.log('调用参数:', JSON.stringify(params));
  const result = enforceRules(state, params);
  console.log('✅ 返回对象 keys:', Object.keys(result));
  console.log(JSON.stringify(result, (k, v) => typeof v === 'function' ? '[Function]' : v, 2));
} catch (e) {
  console.log('❌ 抛错!');
  console.log('  ruleCode =', e.ruleCode);
  console.log('  message =', e.message);
  console.log('  all keys =', Object.keys(e));
  if (e.stack) console.log('  stack preview:', String(e.stack).split('\n').slice(0, 5).join('\n'));
}

console.log('\n===== TEST 2: adjust_capacity 12->20 (调高), 手动传 role=admin =====');
try {
  const params = { opType: 'adjust_capacity', courseId: 'c_dance_01', newCapacity: 20, role: 'admin' };
  const result = enforceRules(state, params);
  console.log('✅ 返回对象 keys:', Object.keys(result));
  console.log(JSON.stringify(result, (k, v) => typeof v === 'function' ? '[Function]' : v, 2));
} catch (e) {
  console.log('❌ 抛错!');
  console.log('  ruleCode =', e.ruleCode);
  console.log('  message =', e.message);
}
