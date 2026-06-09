import {
  COURSE_DATA, calculateAge, isAgeEligible, timeOverlap,
  countEnrollmentsByCourse, countWaitlistByCourse
} from './store.js';

export const RULES = {
  R001: { code: 'R001', name: '年龄不符不能预约试听', severity: 'hard' },
  R002: { code: 'R002', name: '同一儿童同一时间段不能试听或报名两门课', severity: 'hard' },
  R003: { code: 'R003', name: '同一课程同一儿童不能重复占位', severity: 'hard' },
  R004: { code: 'R004', name: '名额为零时只能进入候补并展示顺位', severity: 'soft' },
  R005: { code: 'R005', name: '取消正式名额后按候补顺位、年龄匹配、预约时间自动提升第一名', severity: 'soft' },
  R006: { code: 'R006', name: '顾问可写备注但不能绕过年龄/容量规则', severity: 'hard' },
  R007: { code: 'R007', name: '教务调整班期容量，调低时溢出人员进入异常待处理', severity: 'soft' }
};

function findChild(state, id) {
  return state.children.find(c => c.id === id);
}
function findCourse(state, id) {
  return state.courses.find(c => c.id === id);
}
function findSession(state, id) {
  return state.sessions.find(s => s.id === id);
}

function makeRuleError(ruleDef, ctx, message) {
  const err = new Error(message);
  err.ruleCode = ruleDef.code;
  err.ruleName = ruleDef.name;
  err.severity = ruleDef.severity;
  if (ctx.childId) err.childId = ctx.childId;
  if (ctx.courseId) err.courseId = ctx.courseId;
  if (ctx.sessionId) err.sessionId = ctx.sessionId;
  const child = ctx.childId ? findChild(ctx._state || {}, ctx.childId) : null;
  const course = ctx.courseId ? findCourse(ctx._state || {}, ctx.courseId) : null;
  if (child) err.childName = child.name;
  if (course) err.courseName = course.name;
  for (const k of Object.keys(ctx)) {
    if (k.startsWith('_')) continue;
    if (err[k] === undefined) err[k] = ctx[k];
  }
  if (ctx.conflictTime) err.conflictTime = ctx.conflictTime;
  return err;
}

// ============================================================
// R001 - 年龄不符不能预约试听
// ============================================================
function checkR001(state, ctx) {
  if (!ctx.childId || !ctx.courseId) return;
  ctx._state = state;
  const child = findChild(state, ctx.childId);
  const course = findCourse(state, ctx.courseId);
  if (!child || !course) return;
  const age = calculateAge(child.birthDate || child.birthday);
  ctx._childAge = age;
  const ok = isAgeEligible(age, course);
  if (!ok) {
    ctx.childName = child.name;
    ctx.courseName = course.name;
    ctx.age = age;
    ctx.minAge = course.minAge;
    ctx.maxAge = course.maxAge;
    throw makeRuleError(RULES.R001, ctx,
      `[R001] 年龄不符：儿童【${child.name}】(${age}岁) 不符合课程【${course.name}】的适龄范围(${course.minAge}-${course.maxAge}岁)`);
  }
}

// ============================================================
// R002 - 同一儿童同一时间段不能试听或报名两门课
// ============================================================
function checkR002(state, ctx) {
  if (!ctx.childId || !ctx.sessionId) return;
  ctx._state = state;
  const child = findChild(state, ctx.childId);
  const newSession = findSession(state, ctx.sessionId);
  if (!child || !newSession) return;

  const enrolledSessionIds = state.enrollments
    .filter(e => e.childId === child.id && e.status === 'active')
    .map(e => e.sessionId);
  const trialSessionIds = state.trials
    .filter(t => t.childId === child.id && t.status === 'scheduled')
    .map(t => t.sessionId);
  const allSessionIds = [...enrolledSessionIds, ...trialSessionIds];

  for (const sid of allSessionIds) {
    if (sid === newSession.id) continue;
    const existingSession = findSession(state, sid);
    if (!existingSession) continue;
    const overlap = timeOverlapSession(newSession, existingSession);
    if (overlap) {
      ctx.childName = child.name;
      ctx.courseName = findCourse(state, newSession.courseId)?.name;
      ctx.conflictSession = existingSession.id;
      ctx.conflictCourse = findCourse(state, existingSession.courseId)?.name;
      ctx.conflictTime = `${newSession.dayOfWeek} ${newSession.startTime}-${newSession.endTime} 与 ${existingSession.dayOfWeek} ${existingSession.startTime}-${existingSession.endTime} 重叠`;
      throw makeRuleError(RULES.R002, ctx,
        `[R002] 时间冲突：儿童【${child.name}】在该时段(${newSession.dayOfWeek} ${newSession.startTime}-${newSession.endTime})已报名或预约试听【${findCourse(state, existingSession.courseId)?.name}】`);
    }
  }
}

// ============================================================
// R003 - 同一课程同一儿童不能重复占位
// ============================================================
function checkR003(state, ctx) {
  if (!ctx.childId || !ctx.courseId) return;
  ctx._state = state;
  const child = findChild(state, ctx.childId);
  const course = findCourse(state, ctx.courseId);
  if (!child || !course) return;
  ctx.childName = child.name;
  ctx.courseName = course.name;
  const activeEnroll = state.enrollments.find(
    e => e.childId === child.id && e.courseId === course.id && e.status === 'active'
  );
  if (activeEnroll) {
    throw makeRuleError(RULES.R003, {
      childId: child.id,
      childName: child.name,
      courseId: course.id,
      courseName: course.name
    }, `[R003] 重复占位：儿童【${child.name}】已报名【${course.name}】(${activeEnroll.enrollDate})`);
  }
  const activeWl = state.waitlist.find(
    w => w.childId === child.id && w.courseId === course.id && w.status === 'waiting'
  );
  if (activeWl) {
    throw makeRuleError(RULES.R003, {
      childId: child.id,
      childName: child.name,
      courseId: course.id,
      courseName: course.name
    }, `[R003] 重复占位：儿童【${child.name}】已在【${course.name}】候补中（顺位 #${activeWl.position}）`);
  }
  const activeTrial = state.trials.find(
    t => t.childId === child.id && t.courseId === course.id && (t.status === 'scheduled' || t.status === 'completed')
  );
  if (activeTrial && ctx.opType === 'book_trial') {
    throw makeRuleError(RULES.R003, {
      childId: child.id,
      childName: child.name,
      courseId: course.id,
      courseName: course.name,
      conflictTime: activeTrial.trialDate
    }, `[R003] 重复占位：儿童【${child.name}】已预约【${course.name}】试听（${activeTrial.trialDate}）`);
  }
}

// ============================================================
// R004 - 名额为零时只能进入候补并展示顺位
// ============================================================
function checkR004(state, ctx) {
  const course = findCourse(state, ctx.courseId);
  if (!course) return;
  const activeCount = countEnrollmentsByCourse(state.enrollments, course.id, 'active');
  ctx._actualEnrolled = activeCount;
  ctx._seatsRemaining = Math.max(0, course.totalSeats - activeCount);
  ctx._waitlistCount = countWaitlistByCourse(state.waitlist, course.id, 'waiting');
  if (ctx.opType === 'enroll' && ctx._seatsRemaining <= 0) {
    ctx._mustWaitlist = true;
    ctx._waitlistPosition = ctx._waitlistCount + 1;
  }
}

// ============================================================
// R006 - 顾问不能绕过规则
// ============================================================
function checkR006(state, ctx) {
  if (ctx.role !== 'advisor') return;
  if (ctx.bypassAge === true) {
    throw makeRuleError(RULES.R006, ctx, `[R006] 顾问权限受限：不能绕过年龄规则(R001)替儿童【${findChild(state, ctx.childId)?.name}】报名【${findCourse(state, ctx.courseId)?.name}】`);
  }
  if (ctx.bypassCapacity === true) {
    throw makeRuleError(RULES.R006, ctx, `[R006] 顾问权限受限：不能绕过容量规则(R004)替儿童【${findChild(state, ctx.childId)?.name}】报名已满课程【${findCourse(state, ctx.courseId)?.name}】`);
  }
}

// ============================================================
// R005 - 辅助：选择候补提升候选人
//   按规则：候补顺位 → 年龄匹配 → 预约时间 排序
// ============================================================
export function selectWaitlistPromotionTarget(state, courseId) {
  const course = findCourse(state, courseId);
  if (!course) return null;
  const waiters = state.waitlist.filter(
    w => w.courseId === courseId && w.status === 'waiting'
  );
  if (waiters.length === 0) return null;
  const enriched = waiters.map(w => {
    const child = findChild(state, w.childId);
    const age = child ? calculateAge(child.birthDate || child.birthday) : -1;
    const ageOk = child && isAgeEligible(age, course);
    return { waitlistEntry: w, child, age, ageOk, ts: w.createdAt };
  });
  enriched.sort((a, b) => {
    if (a.ageOk !== b.ageOk) return a.ageOk ? -1 : 1;
    if (a.waitlistEntry.position !== b.waitlistEntry.position)
      return a.waitlistEntry.position - b.waitlistEntry.position;
    return a.ts - b.ts;
  });
  const best = enriched[0];
  return { waitlistEntry: best.waitlistEntry, child: best.child, age: best.age };
}

// ============================================================
// 主要入口：enforceRules(state, { opType, childId, courseId, sessionId, ... })
// opType: 'book_trial' | 'enroll' | 'waitlist' | 'cancel_enroll' | 'adjust_capacity' | 'write_note'
// ============================================================
export function enforceRules(state, params) {
  const ctx = {
    opType: params.opType,
    childId: params.childId || null,
    courseId: params.courseId || null,
    sessionId: params.sessionId || null,
    actorRole: state.role,
    actorId: state.currentUserId,
    ...params
  };
  const ruleTrace = [];
  ctx._state = state;

  const pushTrace = (rule, ok, info = '') => {
    ruleTrace.push(`${rule}:${ok ? 'OK' : 'BLOCKED'}${info ? '(' + info + ')' : ''}`);
  };

  try {
    switch (ctx.opType) {
      case 'book_trial': {
        checkR006(state, ctx); pushTrace('R006', true);
        checkR001(state, ctx);  pushTrace('R001', true, `age=${ctx._childAge}`);
        if (ctx.sessionId) {
          checkR002(state, ctx);  pushTrace('R002', true);
        }
        checkR003(state, ctx);  pushTrace('R003', true);
        return { allowed: true, mode: 'trial', ruleTrace, ctx };
      }
      case 'enroll': {
        checkR006(state, ctx); pushTrace('R006', true);
        checkR001(state, ctx);  pushTrace('R001', true, `age=${ctx._childAge}`);
        if (ctx.sessionId) {
          checkR002(state, ctx);  pushTrace('R002', true);
        }
        checkR003(state, ctx);  pushTrace('R003', true);
        checkR004(state, ctx);
        if (ctx._mustWaitlist) {
          pushTrace('R004', true, `no seats → waitlist #${ctx._waitlistPosition}`);
          return { allowed: true, mode: 'waitlist', position: ctx._waitlistPosition, ruleTrace, ctx };
        } else {
          pushTrace('R004', true, `seats remaining=${ctx._seatsRemaining}`);
          return { allowed: true, mode: 'enroll', ruleTrace, ctx };
        }
      }
      case 'cancel_enroll': {
        pushTrace('R005', true, 'will auto-promote waitlist');
        return { allowed: true, mode: 'cancel_enroll', ruleTrace, ctx };
      }
      case 'adjust_capacity': {
        if (ctx.role !== 'admin') {
          throw makeRuleError(RULES.R007, ctx, `[R007] 权限不足：只有教务管理员能调整班期容量`);
        }
        const course = findCourse(state, ctx.courseId);
        if (!course) throw new Error('找不到课程');
        const activeCount = countEnrollmentsByCourse(state.enrollments, course.id, 'active');
        if (ctx.newCapacity < activeCount) {
          const overflowIds = state.enrollments
            .filter(e => e.courseId === course.id && e.status === 'active')
            .slice(ctx.newCapacity)
            .map(e => e.id);
          ctx._overflow = {
            originalCapacity: course.totalSeats,
            newCapacity: ctx.newCapacity,
            activeCount,
            overflowCount: activeCount - ctx.newCapacity,
            overflowIds
          };
          pushTrace('R007', true, `overflow=${activeCount - ctx.newCapacity} → anomaly`);
          return { allowed: true, mode: 'adjust_capacity_anomaly', anomaly: ctx._overflow, ruleTrace, ctx };
        } else {
          pushTrace('R007', true, `capacity ok (${course.totalSeats} → ${ctx.newCapacity}, active=${activeCount})`);
          return { allowed: true, mode: 'adjust_capacity_ok', ruleTrace, ctx };
        }
      }
      case 'write_note': {
        if (ctx.role === 'advisor') {
          pushTrace('R006', true, 'advisor can write note (not bypass)');
        }
        return { allowed: true, mode: 'write_note', ruleTrace, ctx };
      }
      default:
        throw new Error(`未知操作类型: ${ctx.opType}`);
    }
  } catch (err) {
    if (err.ruleCode) {
      ruleTrace.push(`${err.ruleCode}:BLOCKED`);
      err.ruleTrace = ruleTrace;
    }
    throw err;
  }
}

// ============================================================
// parseRuleError - 将规则错误结构化（用于UI展示和审计）
// ============================================================
export function parseRuleError(err) {
  if (!err || !err.ruleCode) return null;
  var RC = err.ruleCode;
  var CN = err.childName || '未知儿童';
  var CoN = err.courseName || '未知课程';
  var SID = err.sessionId || '';
  var CCN = err.conflictCourse || err.conflictCourseName || '';
  var CT = err.conflictTime || '';
  var shortMessage = err.message || (RC + ' 规则校验失败');
  var detail = [];
  var suggestion = '请调整儿童、班期或课程后重试';

  if (RC === 'R002') {
    shortMessage = '时间冲突：' + CN + ' 在该时段已报名【' + (CCN || '另一门课程') + '】';
    detail.push('👶 儿童：' + CN + (err.childId ? ' (ID：' + err.childId + ')' : ''));
    detail.push('📋 原课程（已占位）：' + (CCN || '未知'));
    detail.push('🆕 新课程（尝试报名）：' + CoN);
    if (SID) detail.push('📅 班期：' + SID);
    if (CT) detail.push('⏰ 冲突时间：' + CT);
    detail.push('📜 规则编号：R002（同一儿童同一时间段只能试听或报名一门课）');
    suggestion = '建议：为 ' + CN + ' 选择其他时段的 ' + CoN + ' 班期，或改报其他不冲突的课程';
  } else if (RC === 'R001') {
    var AS = err.age !== undefined ? (err.age + '岁') : '';
    var RS = (err.minAge !== undefined && err.maxAge !== undefined) ? (err.minAge + '-' + err.maxAge + '岁') : '';
    shortMessage = '年龄不符：' + CN + (AS ? '（' + AS + '）' : '') + ' 不符合 ' + CoN + ' 的适龄范围';
    detail.push('👶 儿童：' + CN);
    if (AS) detail.push('🎂 当前年龄：' + AS);
    if (RS) detail.push('📊 课程适龄：' + RS);
    detail.push('🆕 目标课程：' + CoN);
    detail.push('📜 规则编号：R001（年龄不符不能预约试听或报名）');
  } else if (RC === 'R003') {
    shortMessage = '重复占位：' + CN + ' 已报名或预约过 ' + CoN;
    detail.push('👶 儿童：' + CN);
    detail.push('🆕 目标课程：' + CoN);
    detail.push('📜 规则编号：R003（同一课程同一儿童不能重复占位）');
  } else if (RC === 'R006') {
    shortMessage = '权限不足：顾问不能绕过业务规则';
    detail.push('👶 儿童：' + CN);
    detail.push('🆕 目标课程：' + CoN);
    detail.push('📜 规则编号：R006（顾问可写备注但不能绕过年龄/容量规则）');
  }

  return {
    ruleCode: RC,
    ruleName: err.ruleName || (RULES[RC] ? RULES[RC].name : '') || '',
    severity: err.severity || 'hard',
    message: err.message || '',
    shortMessage: shortMessage,
    detail: detail,
    suggestion: suggestion,
    child: { id: err.childId, name: CN },
    course: { id: err.courseId, name: CoN },
    sessionId: SID,
    age: err.age,
    ageRange: err.minAge !== undefined ? (err.minAge + '-' + err.maxAge) : null,
    conflictTime: CT,
    conflictCourseName: CCN,
    conflictSession: err.conflictSession,
    raw: Object.fromEntries(
      Object.entries(err).filter(function(x) {
        return ['ruleCode','ruleName','severity','message','stack'].indexOf(x[0]) < 0;
      })
    ),
    ruleTrace: err.ruleTrace || []
  };
}
