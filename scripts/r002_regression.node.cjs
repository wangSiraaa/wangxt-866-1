const fs=require("fs");
const path=require("path");
const vm=require("vm");

// 仿照smoke.node.cjs的加载方式
function loadSrc(fileName) {
  const p = path.resolve(__dirname, "..", "src", fileName);
  let code = fs.readFileSync(p, "utf8");
  code = code.replace(/^import\s+.*?;$/gm, "").replace(/^export\s+/gm, "var ");
  return code;
}

const sandbox = {
  require: require,
  module: module,
  console: console,
  process: process,
  Buffer: Buffer,
  __dirname: __dirname,
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  localStorage: {
    _d: {},
    getItem: function(k){return k in this._d?this._d[k]:null;},
    setItem: function(k,v){this._d[k]=String(v);},
    removeItem: function(k){delete this._d[k];},
    clear: function(){this._d={};}
  }
};
sandbox.global = sandbox;
sandbox.window = sandbox;
vm.createContext(sandbox);

// 加载 store.js 和 rulesEngine.js
vm.runInContext(loadSrc("store.js"), sandbox);
vm.runInContext(loadSrc("rulesEngine.js"), sandbox);

const getInitialState = sandbox.getInitialState;
const enforceRules = sandbox.enforceRules;
const parseRuleError = sandbox.parseRuleError;
const RULES = sandbox.RULES;

let passCount = 0;
let failCount = 0;
let failList = [];

function assert(cond, msg) {
  if (cond) {
    console.log("  [PASS] " + msg);
    passCount++;
  } else {
    console.log("  [FAIL] " + msg);
    failCount++;
    failList.push(msg);
    process.exitCode = 1;
  }
}

function section(name) {
  console.log("");
  console.log("══ " + name + " ══");
}

function log(level, msg) {
  const tag = level === "pass" ? "  ✓ " : "  ! ";
  console.log(tag + msg);
}


// ========== R002 核心回归场景 ==========

section("R002 同儿童同时间段冲突 - 核心回归验证")

const st = getInitialState();

// 1. 验证前提数据存在
assert(st.children.some(function(c){return c.id==="ch_xm" && c.name==="小明";}), "TC-R002-01 儿童小明存在(id=ch_xm)");
assert(st.courses.some(function(c){return c.id==="c_art_01" && c.name.indexOf("美术")>=0;}), "TC-R002-02 课程儿童创意美术启蒙班存在(id=c_art_01)");
assert(st.courses.some(function(c){return c.id==="c_robot_01" && c.name.indexOf("机器人")>=0;}), "TC-R002-03 课程乐高机器人编程班存在(id=c_robot_01)");
assert(st.sessions.some(function(s){return s.id==="s_art_01_sat" && s.dayOfWeek==="周六" && s.startTime==="09:00";}), "TC-R002-04 美术班周六班期存在(s_art_01_sat, 周六09:00-10:30)");
assert(st.sessions.some(function(s){return s.id==="s_robot_01_sat" && s.dayOfWeek==="周六" && s.startTime==="09:00";}), "TC-R002-05 机器人班周六班期存在(s_robot_01_sat, 周六09:00-10:30)");

// 2. 前提：小明已报名美术周六班
const xmArtEnroll = st.enrollments.find(function(e){return e.childId==="ch_xm" && e.courseId==="c_art_01" && e.sessionId==="s_art_01_sat";});
assert(!!xmArtEnroll, "TC-R002-06 小明(ch_xm)已报名儿童创意美术启蒙班周六09:00-10:30班期(s_art_01_sat)");

// 3. 两班期同星期同时段（完美R002冲突）
const sArt = st.sessions.find(function(s){return s.id==="s_art_01_sat";});
const sRobot = st.sessions.find(function(s){return s.id==="s_robot_01_sat";});
assert(sArt.dayOfWeek === sRobot.dayOfWeek, "TC-R002-07 两班期同星期: " + sArt.dayOfWeek + " vs " + sRobot.dayOfWeek);
assert(sArt.startTime === sRobot.startTime && sArt.endTime === sRobot.endTime, "TC-R002-08 两班期同时段: " + sArt.startTime + "-" + sArt.endTime + " 完全重叠");

// 4. 机器人班有名额（小明适龄，所以唯一可能触发的规则就是R002）
const robotSeats = (sRobot.capacity || 0) - st.enrollments.filter(function(e){return e.courseId==="c_robot_01" && e.sessionId==="s_robot_01_sat";}).length;
assert(robotSeats > 0, "TC-R002-09 乐高机器人编程班周六班期尚有剩余名额: " + robotSeats);

// 5. 小明适龄乐高班(9岁在6-12内) - 再次确认R001不会触发
const xm = st.children.find(function(c){return c.id==="ch_xm";});
const robotCourse = st.courses.find(function(c){return c.id==="c_robot_01";});
const xmAge = Math.floor((new Date() - new Date(xm.birthDate || xm.birthday)) / (365.25*24*3600*1000));
assert(xmAge >= (robotCourse.minAge || 0) && xmAge <= (robotCourse.maxAge || 99), "TC-R002-10 小明年龄适龄乐高班: " + xmAge + "岁(范围" + robotCourse.minAge + "-" + robotCourse.maxAge + ")");

// 6. 小明报名乐高机器人周六班 -> R002 时间冲突
let r002Err = null;
try {
  enforceRules(st, {opType:"enroll", childId:"ch_xm", courseId:"c_robot_01", sessionId:"s_robot_01_sat", role:"parent"});
} catch(x) { r002Err = x; }
assert(r002Err && r002Err.ruleCode==="R002", "TC-R002-11 小明报名乐高机器人周六班被R002拒绝");

// 7. parseRuleError 结构化校验
const pe = parseRuleError ? parseRuleError(r002Err) : null;
assert(pe, "TC-R002-12 parseRuleError返回对象");

if (pe) {
  const d = pe.detail || [];
  const dj = d.join(" | ");
  assert(pe.ruleCode==="R002", "TC-R002-13 ruleCode=R002");
  assert(typeof pe.shortMessage==="string" && pe.shortMessage.length>0, "TC-R002-14 shortMessage存在");
  assert(pe.child && pe.child.id==="ch_xm" && pe.child.name==="小明", "TC-R002-15 儿童=小明");
  assert(d.some(function(x){return x.indexOf("儿童")>=0 && x.indexOf("小明")>=0;}), "TC-R002-16 detail含儿童小明: "+dj);
  assert(d.some(function(x){return x.indexOf("原课程")>=0 || x.indexOf("已占位")>=0;}), "TC-R002-17 detail含原课程/已占位: "+dj);
  assert(d.some(function(x){return x.indexOf("美术")>=0;}), "TC-R002-18 detail含美术(原课程): "+dj);
  assert(d.some(function(x){return x.indexOf("新课程")>=0 || x.indexOf("尝试报名")>=0;}), "TC-R002-19 detail含新课程/尝试报名: "+dj);
  assert(d.some(function(x){return x.indexOf("机器人")>=0 || x.indexOf("乐高")>=0;}), "TC-R002-20 detail含机器人/乐高(新课程): "+dj);
  assert(d.some(function(x){return x.indexOf("班期")>=0;}), "TC-R002-21 detail含班期: "+dj);
  assert(d.some(function(x){return x.indexOf("冲突时间")>=0 || (x.indexOf("周六")>=0 && x.indexOf("09:00")>=0);}), "TC-R002-22 detail含冲突时间周六09:00: "+dj);
  assert(d.some(function(x){return x.indexOf("R002")>=0;}), "TC-R002-23 detail含R002规则编号: "+dj);
  assert((pe.conflictCourseName||"").indexOf("美术")>=0, "TC-R002-24 conflictCourseName含美术: "+pe.conflictCourseName);
  assert((pe.conflictTime||"").indexOf("周六")>=0 && (pe.conflictTime||"").indexOf("09:00")>=0, "TC-R002-25 conflictTime含周六09:00: "+pe.conflictTime);
  assert(typeof pe.suggestion==="string" && pe.suggestion.length>0, "TC-R002-26 suggestion存在");
  log("pass", " ");
  log("pass", "R002完整错误展示:");
  log("pass", "  [摘要] " + pe.shortMessage);
  d.forEach(function(ln){log("pass", "  [明细] " + ln);});
  log("pass", "  [建议] " + pe.suggestion);
}

// 8. 试听同时间段也被R002拒绝
let trialErr = null;
try {
  enforceRules(st, {opType:"book_trial", childId:"ch_xm", courseId:"c_robot_01", sessionId:"s_robot_01_sat", role:"parent"});
} catch(x) { trialErr = x; }
assert(trialErr && trialErr.ruleCode==="R002", "TC-R002-27 小明试听乐高机器人周六班也被R002拒绝");

// 9. 其他儿童（如小华ch_xw）在同时间段无报名时可正常通过R002
let xwErr = null;
try {
  enforceRules(st, {opType:"enroll", childId:"ch_xw", courseId:"c_robot_01", sessionId:"s_robot_01_sat", role:"parent"});
} catch(x) { xwErr = x; }
const xwBlockedByR002 = xwErr && xwErr.ruleCode==="R002";
assert(!xwBlockedByR002, "TC-R002-28 小华(未报周六课)报名机器人周六班不会因R002被拒绝(可能因其他规则,但非R002)");


// 汇总
console.log("");
console.log("══════════════════════════════════════════════════");
console.log("  R002 回归测试总计: " + passCount + " 通过, " + failCount + " 失败");
console.log("══════════════════════════════════════════════════");
if (failCount === 0) {
  console.log("  🎉 R002 冲突校验及错误展示全部通过!");
  process.exit(0);
} else {
  console.log("  ❌ 存在失败用例:");
  failList.forEach(function(m){console.log("    - " + m);});
  process.exit(1);
}

