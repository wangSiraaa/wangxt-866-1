// ============================================================
// 青少年活动中心 - 全局状态 Context (src/context.jsx)
// 所有业务操作函数内部统一调用 enforceRules()
// 实现：R005 自动提升候补、R007 容量异常、审计日志、通知生成、持久化
// ============================================================
import React, { createContext, useContext, useEffect, useReducer, useCallback, useMemo } from 'react';
import {
  loadState, saveState, clearPersistedState, getInitialState,
  countEnrollmentsByCourse, countWaitlistByCourse, calculateAge
} from './store.js';
import {
  enforceRules, RULES, selectWaitlistPromotionTarget, parseRuleError
} from './rulesEngine.js';

const AppContext = createContext(null);

let __AUDIT_COUNTER = 100;
const genId = (prefix) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const genAuditId = () => `audit_${++__AUDIT_COUNTER}`;

function pushAudit(state, { action, targetType, targetId, detail, result, ruleCheck }) {
  const entry = {
    id: genAuditId(),
    timestamp: new Date().toISOString(),
    actor: state.currentUserId || 'unknown',
    actorRole: state.role || 'unknown',
    action, targetType, targetId, detail, result, ruleCheck
  };
  state.auditLog = [entry, ...(state.auditLog || [])].slice(0, 500);
  return entry;
}

function pushNotification(state, notif) {
  const full = {
    id: genId('notif'),
    read: false,
    createdAt: new Date().toISOString(),
    actionLink: null,
    ...notif
  };
  state.notifications = [full, ...(state.notifications || [])];
  return full;
}

function updateCourseEnrolledCounts(state) {
  state.courses = state.courses.map(c => {
    const active = countEnrollmentsByCourse(state.enrollments, c.id, 'active');
    return { ...c, enrolled: active };
  });
}

function recomputeWaitlistPositions(state, courseId) {
  const items = state.waitlist
    .filter(w => w.courseId === courseId && w.status === 'waiting')
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  items.forEach((w, i) => { w.position = i + 1; });
}

// ============================================================
// Reducer
// ============================================================
function appReducer(state, action) {
  switch (action.type) {
    case 'SET_ROLE': {
      const next = { ...state, role: action.payload.role, currentUserId: action.payload.userId, currentUserName: action.payload.userName };
      pushAudit(next, { action: 'ROLE_SWITCH', targetType: 'role', targetId: action.payload.role, detail: action.payload, result: 'success', ruleCheck: ['SYSTEM'] });
      return next;
    }
    case 'SELECT_CHILD':
      return { ...state, selectedChildId: action.payload };
    case 'SET_FILTERS':
      return { ...state, filters: { ...state.filters, ...action.payload } };
    case 'SET_KANBAN_GROUP':
      return {
        ...state,
        kanbanGroup: { ...state.kanbanGroup, ...action.payload }
      };
    case 'TOGGLE_KANBAN_GROUP_COLLAPSE': {
      const groupKey = action.payload;
      const collapsed = { ...(state.kanbanGroup?.collapsedGroups || {}) };
      collapsed[groupKey] = !collapsed[groupKey];
      return {
        ...state,
        kanbanGroup: { ...state.kanbanGroup, collapsedGroups: collapsed }
      };
    }
    case 'TOGGLE_FAVORITE': {
      const { childId, courseId } = action.payload;
      const favs = { ...(state.favorites || {}) };
      const arr = new Set(favs[childId] || []);
      if (arr.has(courseId)) arr.delete(courseId); else arr.add(courseId);
      favs[childId] = Array.from(arr);
      const next = { ...state, favorites: favs };
      pushAudit(next, {
        action: 'FAVORITE_TOGGLE',
        targetType: 'favorite',
        targetId: `${childId}:${courseId}`,
        detail: { childId, courseId, nowFavorite: arr.has(courseId) },
        result: 'success',
        ruleCheck: ['SYSTEM']
      });
      return next;
    }
    case 'MARK_NOTIF_READ': {
      return {
        ...state,
        notifications: state.notifications.map(n =>
          n.id === action.payload ? { ...n, read: true } : n
        )
      };
    }
    case 'BOOK_TRIAL_SUCCESS': {
      const trial = {
        id: genId('trial'),
        childId: action.payload.childId,
        courseId: action.payload.courseId,
        sessionId: action.payload.sessionId,
        status: 'scheduled',
        createdAt: new Date().toISOString(),
        trialDate: action.payload.trialDate,
        note: ''
      };
      const next = {
        ...state,
        trials: [...state.trials, trial]
      };
      pushAudit(next, {
        action: 'TRIAL_BOOK', targetType: 'trial', targetId: trial.id,
        detail: action.payload, result: 'success',
        ruleCheck: action.payload.ruleTrace
      });
      pushNotification(next, {
        targetRole: 'parent',
        targetChildIds: [action.payload.childId],
        type: 'trial_scheduled',
        title: '📅 试听预约成功',
        content: `已为【${action.payload.childName}】预约【${action.payload.courseName}】${action.payload.sessionName ? '（' + action.payload.sessionName + '）' : ''}的试听课，时间：${action.payload.trialDate}`
      });
      return next;
    }
    case 'ENROLL_SUCCESS': {
      const enr = {
        id: genId('enr'),
        childId: action.payload.childId,
        courseId: action.payload.courseId,
        sessionId: action.payload.sessionId || null,
        status: 'active',
        createdAt: new Date().toISOString(),
        amount: action.payload.price,
        discountId: action.payload.discountId || null
      };
      const next = {
        ...state,
        enrollments: [...state.enrollments, enr]
      };
      updateCourseEnrolledCounts(next);
      pushAudit(next, {
        action: 'ENROLL_CREATE', targetType: 'enrollment', targetId: enr.id,
        detail: action.payload, result: 'success',
        ruleCheck: action.payload.ruleTrace
      });
      pushNotification(next, {
        targetRole: 'parent',
        targetChildIds: [action.payload.childId],
        type: 'enrollment_success',
        title: `✅ 报名成功：${action.payload.courseName}`,
        content: `【${action.payload.childName}】已成功报名【${action.payload.courseName}】${action.payload.sessionName ? '（' + action.payload.sessionName + '）' : ''}，请按时上课。`
      });
      return next;
    }
    case 'WAITLIST_SUCCESS': {
      const wl = {
        id: genId('wl'),
        childId: action.payload.childId,
        courseId: action.payload.courseId,
        sessionId: action.payload.sessionId || null,
        status: 'waiting',
        createdAt: new Date().toISOString(),
        position: action.payload.position
      };
      const next = {
        ...state,
        waitlist: [...state.waitlist, wl]
      };
      recomputeWaitlistPositions(next, action.payload.courseId);
      pushAudit(next, {
        action: 'WAITLIST_ADD', targetType: 'waitlist', targetId: wl.id,
        detail: { ...action.payload, position: wl.position }, result: 'success',
        ruleCheck: action.payload.ruleTrace
      });
      pushNotification(next, {
        targetRole: 'parent',
        targetChildIds: [action.payload.childId],
        type: 'waitlist_joined',
        title: `⏳ 已加入候补队列：${action.payload.courseName}`,
        content: `【${action.payload.childName}】已加入【${action.payload.courseName}】候补队列，当前顺位 #${wl.position}，如有名额释放将按顺位自动提升。`
      });
      return next;
    }
    case 'CANCEL_ENROLL_SUCCESS': {
      // 取消报名：更新状态，触发 R005 自动提升候补
      const next = {
        ...state,
        enrollments: state.enrollments.map(e =>
          e.id === action.payload.enrollmentId ? { ...e, status: 'cancelled', cancelledAt: new Date().toISOString() } : e
        )
      };
      updateCourseEnrolledCounts(next);
      pushAudit(next, {
        action: 'ENROLL_CANCEL', targetType: 'enrollment', targetId: action.payload.enrollmentId,
        detail: action.payload, result: 'success',
        ruleCheck: action.payload.ruleTrace
      });
      pushNotification(next, {
        targetRole: 'parent',
        targetChildIds: [action.payload.childId],
        type: 'enrollment_cancelled',
        title: `🗑️ 已取消报名：${action.payload.courseName}`,
        content: `【${action.payload.childName}】的【${action.payload.courseName}】报名已取消，如已缴费请联系教务办理退费。`
      });

      // ============== R005 自动提升候补第一名 ==============
      const promoted = selectWaitlistPromotionTarget(next, action.payload.courseId);
      if (promoted) {
        const { waitlistEntry, child, age } = promoted;
        const course = next.courses.find(c => c.id === action.payload.courseId);
        // 更新候补状态
        next.waitlist = next.waitlist.map(w =>
          w.id === waitlistEntry.id ? { ...w, status: 'promoted', promotedAt: new Date().toISOString() } : w
        );
        recomputeWaitlistPositions(next, action.payload.courseId);
        // 生成新的报名
        const enr = {
          id: genId('enr'),
          childId: waitlistEntry.childId,
          courseId: waitlistEntry.courseId,
          sessionId: waitlistEntry.sessionId || null,
          status: 'active',
          createdAt: new Date().toISOString(),
          amount: course?.price || 0,
          discountId: null,
          fromWaitlist: true,
          promotedFromId: waitlistEntry.id
        };
        next.enrollments = [...next.enrollments, enr];
        updateCourseEnrolledCounts(next);

        pushAudit(next, {
          action: 'WAITLIST_PROMOTE_R005',
          targetType: 'waitlist',
          targetId: waitlistEntry.id,
          detail: {
            childId: child.id, childName: child.name, age,
            courseId: action.payload.courseId,
            courseName: course?.name,
            reason: 'cancellation released seat',
            newEnrollmentId: enr.id
          },
          result: 'success',
          ruleCheck: ['R005:OK(auto promote by position+age+time)']
        });
        pushNotification(next, {
          targetRole: 'parent',
          targetChildIds: [child.id],
          type: 'waitlist_promoted',
          title: `🎉 候补转正：${course?.name}`,
          content: `恭喜【${child.name}】已从候补队列自动提升为【${course?.name}】正式学员！顺位 #${waitlistEntry.position}（年龄 ${age} 岁符合要求）。请于 48 小时内完成缴费，逾期名额作废。`,
          actionLink: { view: 'parent', focus: action.payload.courseId }
        });
        pushNotification(next, {
          targetRole: 'admin',
          type: 'waitlist_promoted_admin',
          title: `🤖 R005 自动提升：${child.name} → ${course?.name}`,
          content: `取消名额触发自动候补提升：【${child.name}】(顺位#${waitlistEntry.position}, 年龄${age}岁) 转为正式学员，新报名单号 ${enr.id}。`,
          actionLink: { view: 'admin', focus: action.payload.courseId }
        });
      }
      return next;
    }
    case 'ADJUST_CAPACITY_OK': {
      const next = {
        ...state,
        courses: state.courses.map(c =>
          c.id === action.payload.courseId ? { ...c, totalSeats: action.payload.newCapacity } : c
        )
      };
      updateCourseEnrolledCounts(next);
      pushAudit(next, {
        action: 'CAPACITY_ADJUST', targetType: 'course', targetId: action.payload.courseId,
        detail: action.payload, result: 'success',
        ruleCheck: action.payload.ruleTrace
      });
      pushNotification(next, {
        targetRole: 'admin',
        type: 'capacity_adjusted',
        title: `📦 容量已调整：${action.payload.courseName}`,
        content: `课程【${action.payload.courseName}】容量：${action.payload.originalCapacity} → ${action.payload.newCapacity}（当前已报名 ${action.payload.activeCount} 人，合规）。`
      });
      return next;
    }
    case 'ADJUST_CAPACITY_ANOMALY': {
      // R007: 生成异常待处理记录
      const anomaly = {
        id: genId('anom'),
        courseId: action.payload.courseId,
        type: 'capacity_overflow',
        detail: action.payload.anomaly,
        proposedCapacity: action.payload.newCapacity,
        status: 'pending',
        createdAt: new Date().toISOString(),
        resolution: null,
        resolvedAt: null
      };
      const next = {
        ...state,
        anomalies: [anomaly, ...(state.anomalies || [])]
      };
      pushAudit(next, {
        action: 'CAPACITY_ADJUST_ANOMALY_R007',
        targetType: 'anomaly',
        targetId: anomaly.id,
        detail: action.payload,
        result: 'pending_resolution',
        ruleCheck: action.payload.ruleTrace
      });
      pushNotification(next, {
        targetRole: 'admin',
        type: 'anomaly_created',
        title: `⚠️ [R007] 容量调整异常待处理`,
        content: `课程【${action.payload.courseName}】拟调整容量 ${action.payload.originalCapacity} → ${action.payload.newCapacity}，但当前已报名 ${action.payload.anomaly.activeCount} 人，溢出 ${action.payload.anomaly.overflowCount} 人。请在「异常待处理」中选择溢出人员并处置。`,
        actionLink: { view: 'admin', focus: anomaly.id }
      });
      return next;
    }
    case 'RESOLVE_ANOMALY': {
      // 处理异常：通过取消溢出的报名来解决
      const anomaly = state.anomalies.find(a => a.id === action.payload.anomalyId);
      if (!anomaly) return state;
      const next = { ...state };
      // 1. 取消选择溢出的 enrollment
      next.enrollments = state.enrollments.map(e => {
        if (action.payload.removedEnrollmentIds.includes(e.id)) {
          return { ...e, status: 'cancelled_by_adjustment', cancelledAt: new Date().toISOString(), cancelledReason: 'capacity_adjustment' };
        }
        return e;
      });
      // 2. 调整容量
      next.courses = state.courses.map(c =>
        c.id === anomaly.courseId ? { ...c, totalSeats: anomaly.proposedCapacity } : c
      );
      updateCourseEnrolledCounts(next);
      // 3. 标记异常已处理
      next.anomalies = state.anomalies.map(a =>
        a.id === anomaly.id
          ? { ...a, status: 'resolved', resolvedAt: new Date().toISOString(), resolution: action.payload.resolution || 'manual_cancel_overflow' }
          : a
      );
      // 4. 通知被取消的家长
      const removedEnrollments = state.enrollments.filter(e => action.payload.removedEnrollmentIds.includes(e.id));
      removedEnrollments.forEach(enr => {
        const child = state.children.find(c => c.id === enr.childId) || state.ghostChildren?.[enr.childId];
        const course = state.courses.find(c => c.id === enr.courseId);
        pushNotification(next, {
          targetRole: 'parent',
          targetChildIds: [enr.childId],
          type: 'enrollment_cancelled_by_adjustment',
          title: `🔧 报名调整通知：${course?.name}`,
          content: `因容量调整，【${child?.name || '儿童'}】在【${course?.name}】的报名已被取消。相关费用将全额退还，如有疑问请联系教务。`
        });
      });
      pushAudit(next, {
        action: 'ANOMALY_RESOLVED',
        targetType: 'anomaly',
        targetId: anomaly.id,
        detail: {
          anomalyId: anomaly.id,
          removedCount: removedEnrollments.length,
          removedEnrollmentIds: action.payload.removedEnrollmentIds,
          newCapacity: anomaly.proposedCapacity
        },
        result: 'success',
        ruleCheck: ['R007:RESOLVED']
      });
      pushNotification(next, {
        targetRole: 'admin',
        type: 'anomaly_resolved',
        title: `✅ 异常已处理：容量 ${anomaly?.detail?.originalCapacity} → ${anomaly.proposedCapacity}`,
        content: `已取消 ${removedEnrollments.length} 个溢出名额，容量调整已生效。`
      });
      return next;
    }
    case 'ADD_CONSULTANT_NOTE': {
      const note = {
        id: genId('note'),
        childId: action.payload.childId,
        consultantId: state.currentUserId,
        consultantName: state.currentUserName,
        content: action.payload.content,
        createdAt: new Date().toISOString(),
        followUp: action.payload.followUp || null
      };
      const next = {
        ...state,
        consultantNotes: [note, ...state.consultantNotes]
      };
      pushAudit(next, {
        action: 'NOTE_ADD', targetType: 'consultantNote', targetId: note.id,
        detail: { childId: note.childId }, result: 'success',
        ruleCheck: action.payload.ruleTrace
      });
      return next;
    }
    case 'RESET_STATE': {
      clearPersistedState();
      return getInitialState();
    }
    default:
      return state;
  }
}

// ============================================================
// Provider
// ============================================================
export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, undefined, () => loadState());

  useEffect(() => {
    saveState(state);
  }, [state]);

  // ========= 操作函数：所有操作统一调用 enforceRules =========

  const switchRole = useCallback((role) => {
    const map = {
      parent:  { userId: 'parent_wang', userName: '王先生（家长）' },
      advisor: { userId: 'adv_li',      userName: '李顾问' },
      admin:   { userId: 'admin_chen',  userName: '陈教务' }
    };
    const info = map[role] || map.parent;
    dispatch({ type: 'SET_ROLE', payload: { role, ...info } });
  }, []);

  const selectChild = useCallback((childId) => {
    dispatch({ type: 'SELECT_CHILD', payload: childId });
  }, []);

  const setFilters = useCallback((filters) => {
    dispatch({ type: 'SET_FILTERS', payload: filters });
  }, []);

  const setKanbanGroup = useCallback((config) => {
    dispatch({ type: 'SET_KANBAN_GROUP', payload: config });
  }, []);

  const toggleKanbanGroupCollapse = useCallback((groupKey) => {
    dispatch({ type: 'TOGGLE_KANBAN_GROUP_COLLAPSE', payload: groupKey });
  }, []);

  const toggleFavorite = useCallback((childId, courseId) => {
    dispatch({ type: 'TOGGLE_FAVORITE', payload: { childId, courseId } });
  }, []);

  const markNotifRead = useCallback((notifId) => {
    dispatch({ type: 'MARK_NOTIF_READ', payload: notifId });
  }, []);

  // 核心：预约试听（统一规则）
  const bookTrial = useCallback(({ childId, courseId, sessionId, trialDate, bypassAge, bypassCapacity }) => {
    try {
      const result = enforceRules(state, { opType: 'book_trial', childId, courseId, sessionId, bypassAge, bypassCapacity });
      const child = state.children.find(c => c.id === childId) || state.ghostChildren?.[childId];
      const course = state.courses.find(c => c.id === courseId);
      const session = state.sessions.find(s => s.id === sessionId);
      dispatch({
        type: 'BOOK_TRIAL_SUCCESS',
        payload: {
          childId, childName: child?.name,
          courseId, courseName: course?.name,
          sessionId, sessionName: session?.name,
          trialDate: trialDate || session?.startDate || '下周',
          ruleTrace: result.ruleTrace
        }
      });
      return { ok: true, mode: result.mode, ruleTrace: result.ruleTrace };
    } catch (err) {
      return { ok: false, error: parseRuleError(err), rawError: err, ruleTrace: err.ruleTrace };
    }
  }, [state]);

  // 核心：正式报名（有余位→enroll，无余位→waitlist 自动走候补）
  const enrollOrWaitlist = useCallback(({ childId, courseId, sessionId, bypassAge, bypassCapacity, discountId }) => {
    try {
      const result = enforceRules(state, { opType: 'enroll', childId, courseId, sessionId, bypassAge, bypassCapacity });
      const child = state.children.find(c => c.id === childId) || state.ghostChildren?.[childId];
      const course = state.courses.find(c => c.id === courseId);
      const session = state.sessions.find(s => s.id === sessionId);
      if (result.mode === 'waitlist') {
        dispatch({
          type: 'WAITLIST_SUCCESS',
          payload: {
            childId, childName: child?.name,
            courseId, courseName: course?.name,
            sessionId, sessionName: session?.name,
            position: result.position,
            ruleTrace: result.ruleTrace
          }
        });
        return { ok: true, mode: 'waitlist', position: result.position, ruleTrace: result.ruleTrace };
      } else {
        dispatch({
          type: 'ENROLL_SUCCESS',
          payload: {
            childId, childName: child?.name,
            courseId, courseName: course?.name,
            sessionId, sessionName: session?.name,
            price: course?.price,
            discountId,
            ruleTrace: result.ruleTrace
          }
        });
        return { ok: true, mode: 'enroll', ruleTrace: result.ruleTrace };
      }
    } catch (err) {
      return { ok: false, error: parseRuleError(err), rawError: err, ruleTrace: err.ruleTrace };
    }
  }, [state]);

  // 核心：取消正式报名（触发 R005 候补提升）
  const cancelEnrollment = useCallback((enrollmentId) => {
    try {
      const enr = state.enrollments.find(e => e.id === enrollmentId);
      if (!enr) return { ok: false, error: { shortMessage: '报名记录不存在' } };
      const result = enforceRules(state, {
        opType: 'cancel_enroll',
        childId: enr.childId, courseId: enr.courseId, sessionId: enr.sessionId
      });
      const child = state.children.find(c => c.id === enr.childId) || state.ghostChildren?.[enr.childId];
      const course = state.courses.find(c => c.id === enr.courseId);
      dispatch({
        type: 'CANCEL_ENROLL_SUCCESS',
        payload: {
          enrollmentId,
          childId: enr.childId,
          childName: child?.name,
          courseId: enr.courseId,
          courseName: course?.name,
          ruleTrace: result.ruleTrace
        }
      });
      return { ok: true, ruleTrace: result.ruleTrace };
    } catch (err) {
      return { ok: false, error: parseRuleError(err), rawError: err, ruleTrace: err.ruleTrace };
    }
  }, [state]);

  // 核心：教务调整班期容量
  const adjustCapacity = useCallback((courseId, newCapacity) => {
    try {
      const result = enforceRules(state, { opType: 'adjust_capacity', courseId, newCapacity });
      const course = state.courses.find(c => c.id === courseId);
      const activeCount = countEnrollmentsByCourse(state.enrollments, courseId, 'active');
      if (result.mode === 'adjust_capacity_anomaly') {
        dispatch({
          type: 'ADJUST_CAPACITY_ANOMALY',
          payload: {
            courseId, courseName: course?.name,
            newCapacity, originalCapacity: course?.totalSeats,
            activeCount,
            anomaly: result.anomaly,
            ruleTrace: result.ruleTrace
          }
        });
        return { ok: true, mode: 'anomaly', anomaly: result.anomaly, ruleTrace: result.ruleTrace };
      } else {
        dispatch({
          type: 'ADJUST_CAPACITY_OK',
          payload: {
            courseId, courseName: course?.name,
            newCapacity, originalCapacity: course?.totalSeats,
            activeCount,
            ruleTrace: result.ruleTrace
          }
        });
        return { ok: true, mode: 'ok', ruleTrace: result.ruleTrace };
      }
    } catch (err) {
      return { ok: false, error: parseRuleError(err), rawError: err, ruleTrace: err.ruleTrace };
    }
  }, [state]);

  // 核心：处理异常
  const resolveAnomaly = useCallback((anomalyId, removedEnrollmentIds, resolution) => {
    dispatch({
      type: 'RESOLVE_ANOMALY',
      payload: { anomalyId, removedEnrollmentIds, resolution }
    });
    return { ok: true };
  }, []);

  // 核心：顾问写备注
  const addConsultantNote = useCallback((childId, content, followUp) => {
    try {
      const result = enforceRules(state, { opType: 'write_note', childId });
      dispatch({
        type: 'ADD_CONSULTANT_NOTE',
        payload: { childId, content, followUp, ruleTrace: result.ruleTrace }
      });
      return { ok: true, ruleTrace: result.ruleTrace };
    } catch (err) {
      return { ok: false, error: parseRuleError(err), rawError: err, ruleTrace: err.ruleTrace };
    }
  }, [state]);

  const resetState = useCallback(() => {
    dispatch({ type: 'RESET_STATE' });
  }, []);

  const value = useMemo(() => ({
    state,
    // 操作函数
    switchRole, selectChild, setFilters, toggleFavorite, markNotifRead,
    setKanbanGroup, toggleKanbanGroupCollapse,
    bookTrial, enrollOrWaitlist, cancelEnrollment,
    adjustCapacity, resolveAnomaly, addConsultantNote, resetState,
    // 计算辅助
    helpers: {
      calculateAge,
      countEnrollmentsByCourse: (cid) => countEnrollmentsByCourse(state.enrollments, cid, 'active'),
      countWaitlistByCourse: (cid) => countWaitlistByCourse(state.waitlist, cid, 'waiting'),
      getChild: (id) => state.children.find(c => c.id === id) || state.ghostChildren?.[id] || null,
      getCourse: (id) => state.courses.find(c => c.id === id) || null,
      getSession: (id) => state.sessions.find(s => s.id === id) || null,
      getChildEnrollments: (childId) => state.enrollments.filter(e => e.childId === childId),
      getChildWaitlist: (childId) => state.waitlist.filter(w => w.childId === childId),
      getCourseSessions: (courseId) => state.sessions.filter(s => s.courseId === courseId),
      getChildNotes: (childId) => state.consultantNotes.filter(n => n.childId === childId),
      isFavorite: (childId, courseId) => (state.favorites?.[childId] || []).includes(courseId),
      getUnreadNotifCount: () => state.notifications.filter(n => !n.read).length,
      getChildTrials: (childId) => state.trials.filter(t => t.childId === childId),
      getCourseWaitlist: (courseId) => state.waitlist
        .filter(w => w.courseId === courseId)
        .sort((a, b) => (a.position || 0) - (b.position || 0))
    }
  }), [state, switchRole, selectChild, setFilters, toggleFavorite, markNotifRead,
       setKanbanGroup, toggleKanbanGroupCollapse,
       bookTrial, enrollOrWaitlist, cancelEnrollment,
       adjustCapacity, resolveAnomaly, addConsultantNote, resetState]);

  return React.createElement(AppContext.Provider, { value }, children);
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp 必须在 AppProvider 内部使用');
  return ctx;
}
