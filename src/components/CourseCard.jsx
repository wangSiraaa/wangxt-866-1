import React, { useState } from 'react';
import { useApp } from '../context.jsx';
import { calculateAge, isAgeEligible, countEnrollmentsByCourse, countWaitlistByCourse } from '../store.js';
import { parseRuleError } from '../rulesEngine.js';

export default function CourseCard({ course }) {
  const { state, helpers, toggleFavorite, enrollOrWaitlist, bookTrial } = useApp();
  const [showActions, setShowActions] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const child = helpers.getChild(state.selectedChildId);
  const sessions = helpers.getCourseSessions(course.id);

  const age = child ? calculateAge(child.birthDate) : null;
  const ageOk = (child && course) ? isAgeEligible(age, course) : null;
  let ageReasonText = null;
  if (child && course && ageOk === false) {
    if (age < course.minAge) {
      ageReasonText = `年龄偏小（${age}岁 < 最低${course.minAge}岁，还差${course.minAge - age}年）`;
    } else if (age > course.maxAge) {
      ageReasonText = `年龄偏大（${age}岁 > 最高${course.maxAge}岁，超出${age - course.maxAge}年）`;
    }
  }
  const enrolled = countEnrollmentsByCourse(state.enrollments, course.id, 'active');
  const remaining = Math.max(0, course.totalSeats - enrolled);
  const waitCount = countWaitlistByCourse(state.waitlist, course.id, 'waiting');
  const isFav = child ? helpers.isFavorite(child.id, course.id) : false;
  const alreadyEnrolled = child ? state.enrollments.some(e => e.childId === child.id && e.courseId === course.id && e.status === 'active') : false;
  const alreadyWaitlist = child ? state.waitlist.some(w => w.childId === child.id && w.courseId === course.id && w.status === 'waiting') : false;
  const waitPosition = alreadyWaitlist
    ? state.waitlist.find(w => w.childId === child.id && w.courseId === course.id && w.status === 'waiting')?.position
    : null;

  const seatPct = Math.min(100, (enrolled / Math.max(1, course.totalSeats)) * 100);
  const seatStatus = remaining === 0 ? 'full' : remaining <= 3 ? 'tight' : 'ok';

  function doEnroll(sessionId) {
    if (!child) return alert('请先选择儿童');
    const r = enrollOrWaitlist({ childId: child.id, courseId: course.id, sessionId });
    setLastResult(r);
    setTimeout(() => setLastResult(null), 4500);
  }

  function doTrial(sessionId) {
    if (!child) return alert('请先选择儿童');
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const trialDate = sessions.find(s=>s.id===sessionId)?.startDate || nextWeek.toISOString().slice(0,10);
    const r = bookTrial({ childId: child.id, courseId: course.id, sessionId, trialDate });
    setLastResult(r);
    setTimeout(() => setLastResult(null), 4500);
  }

  return (
    <div className={`course-card status-${seatStatus} ${ageOk === false ? 'age-blocked' : ''}`} data-course-id={course.id}>
      <div className="course-cover">
        <div className="course-cover-emoji">{course.cover}</div>
        <button
          className={`fav-btn ${isFav ? 'faved' : ''}`}
          onClick={(e) => { e.stopPropagation(); if(child) toggleFavorite(child.id, course.id); }}
          title={isFav ? '取消收藏' : '收藏课程'}
        >{isFav ? '⭐' : '☆'}</button>
        <div className="course-cat-badge">{course.category}</div>
        {ageOk === false && <div className="age-badge-bad" title={ageReasonText || '年龄不符合该课程的适龄范围'}>🚫{ageReasonText || '年龄不符'}</div>}
        {ageOk === true && <div className="age-badge-ok">✓适龄（{age}岁）</div>}
      </div>

      <div className="course-body">
        <div className="course-title-row">
          <h3 className="course-title">{course.name}</h3>
          <span className="course-price">¥{course.price?.toLocaleString()}</span>
        </div>
        <div className="course-teacher">👩‍🏫 {course.teacher}</div>
        <div className="course-level-row">
          <span className="chip chip-level">{course.level}</span>
          <span className="chip chip-age">适龄 {course.minAge}-{course.maxAge}岁</span>
        </div>
        <p className="course-desc">{course.desc}</p>

        <div className="features-row">
          {course.features?.map(f => <span key={f} className="feat-chip">✓ {f}</span>)}
        </div>

        <div className="seat-block">
          <div className="seat-info">
            <span>👥 名额 <b className={seatStatus === 'ok' ? 'good' : seatStatus === 'tight' ? 'warn' : 'bad'}>
              {remaining === 0 ? '已满' : `剩${remaining}`}
            </b> / {course.totalSeats}</span>
            {waitCount > 0 && <span className="wait-chip">⏳候补 {waitCount}人</span>}
          </div>
          <div className="seat-bar">
            <div className={`seat-bar-fill ${seatStatus}`} style={{ width: `${seatPct}%` }}/>
          </div>
        </div>

        {alreadyEnrolled && <div className="status-tag enrolled">✅ 已报名</div>}
        {alreadyWaitlist && <div className="status-tag waitlist">⏳ 候补中 · 顺位 #{waitPosition}</div>}

        <div className="course-actions">
          <button
            className="btn btn-primary btn-block"
            onClick={() => setShowActions(!showActions)}
            disabled={!child}
          >
            {!child ? '请先选择儿童' : alreadyEnrolled ? '查看详情' : alreadyWaitlist ? '查看候补' : remaining === 0 ? '查看候补选项' : '立即报名 / 试听'}
          </button>
        </div>

        {showActions && child && (
          <div className="course-actions-expand">
            <div className="section-title small">选择班期</div>
            {sessions.length === 0 ? (
              <div className="muted small">该课程暂无具体班期（滚动开班）</div>
            ) : (
              <div className="session-tiny-list">
                {sessions.map(s => (
                  <div key={s.id} className="session-tiny">
                    <div className="session-tiny-info">
                      <b>{s.name}</b><br/>
                      <small className="muted">{s.dayOfWeek} {s.startTime}-{s.endTime} · {s.location} · {s.totalWeeks}周</small>
                    </div>
                    <div className="session-tiny-btns">
                      <button
                        className="btn btn-secondary btn-xs"
                        onClick={() => doTrial(s.id)}
                        title={ageOk === false ? (ageReasonText || '该儿童年龄不符合此课程的适龄范围，无法预约试听') : '先试听再决定'}
                        disabled={ageOk === false}
                        style={ageOk === false ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
                      >试听</button>
                      <button
                        className="btn btn-primary btn-xs"
                        onClick={() => doEnroll(s.id)}
                        disabled={alreadyEnrolled || ageOk === false}
                        title={ageOk === false ? (ageReasonText || '该儿童年龄不符合此课程的适龄范围，无法报名') : (alreadyEnrolled ? '已报名' : remaining === 0 ? '将加入候补队列' : '立即报名')}
                      >
                        {remaining === 0 ? '候补' : '报名'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {(sessions.length === 0) && (
              <div className="row-tight">
                <button
                  className="btn btn-secondary"
                  onClick={() => doTrial(null)}
                  title={ageOk === false ? (ageReasonText || '该儿童年龄不符合此课程的适龄范围，无法预约试听') : '预约试听'}
                  disabled={ageOk === false}
                  style={ageOk === false ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
                >预约试听</button>
                <button
                  className="btn btn-primary"
                  onClick={() => doEnroll(null)}
                  disabled={alreadyEnrolled || ageOk === false}
                  title={ageOk === false ? (ageReasonText || '该儿童年龄不符合此课程的适龄范围，无法报名') : (alreadyEnrolled ? '已报名' : remaining === 0 ? '将加入候补队列' : '直接报名')}
                >
                  {remaining === 0 ? '加入候补' : '直接报名'}
                </button>
              </div>
            )}
          </div>
        )}

        {lastResult && (
          <div className={`rule-result ${lastResult.ok ? 'ok' : 'bad'}`}>
            {lastResult.ok ? (
              <div>
                <div className="result-title">
                  {lastResult.mode === 'enroll' && '✅ 报名成功'}
                  {lastResult.mode === 'waitlist' && `⏳ 已加入候补，顺位 #${lastResult.position}`}
                  {lastResult.mode === 'trial' && '📅 试听已预约'}
                </div>
                <small className="muted">规则验证：{lastResult.ruleTrace?.join(' → ') || 'OK'}</small>
              </div>
            ) : (
              <div>
                <div className="result-title">❌ {lastResult.error?.ruleCode || 'ERR'}：操作被拒绝</div>
                <div className="result-msg">{lastResult.error?.shortMessage}</div>
                {lastResult.error?.detail?.length > 0 && (
                  <ul className="result-detail">
                    {lastResult.error.detail.map((d, i) => <li key={i}>{d}</li>)}
                  </ul>
                )}
                <small className="muted">💡 建议：{lastResult.error?.suggestion}</small>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
