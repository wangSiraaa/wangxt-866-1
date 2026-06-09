import React, { useState } from 'react';
import { useApp } from '../context.jsx';
import { calculateAge, countEnrollmentsByCourse, countWaitlistByCourse } from '../store.js';
import CourseCard from '../components/CourseCard.jsx';

export default function AdvisorView() {
  const { state, helpers, addConsultantNote, bookTrial, enrollOrWaitlist } = useApp();
  const [tab, setTab] = useState('overview'); // overview, notes, assist, bypass_test
  const [note, setNote] = useState({ content: '', followUp: '' });
  const [bypassTest, setBypassTest] = useState({
    childId: state.selectedChildId,
    courseId: 'c_piano_01',
    bypassAge: false,
    bypassCapacity: false,
    sessionId: null,
    lastResult: null
  });

  const child = helpers.getChild(state.selectedChildId || bypassTest.childId);
  const age = child ? calculateAge(child.birthDate) : null;
  const notes = child ? helpers.getChildNotes(child.id) : [];
  const childEnr = child ? helpers.getChildEnrollments(child.id) : [];
  const childWl = child ? helpers.getChildWaitlist(child.id) : [];
  const childTrials = child ? helpers.getChildTrials(child.id) : [];

  function submitNote() {
    if (!child) return alert('请选择儿童');
    if (!note.content.trim()) return alert('备注内容不能为空');
    const r = addConsultantNote(child.id, note.content.trim(), note.followUp.trim() || null);
    if (r.ok) {
      setNote({ content: '', followUp: '' });
    }
  }

  function runBypassTest() {
    const cid = bypassTest.childId || state.selectedChildId;
    const r = enrollOrWaitlist({
      childId: cid,
      courseId: bypassTest.courseId,
      sessionId: bypassTest.sessionId,
      bypassAge: bypassTest.bypassAge,
      bypassCapacity: bypassTest.bypassCapacity
    });
    setBypassTest({ ...bypassTest, lastResult: r });
  }

  return (
    <div className="view-advisor">
      <div className="tabs-md">
        {[
          ['overview', '👀 总览档案'],
          ['notes', '📝 顾问备注'],
          ['assist', '🤝 辅助报名'],
          ['bypass_test', '🔐 R006 绕过测试']
        ].map(([k, label]) => (
          <button key={k} className={`tab-md ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview' && child && (
        <div className="grid-2col">
          <div className="card">
            <div className="card-head"><h3>🧒 儿童档案</h3></div>
            <div className="profile-row">
              <div className="avatar-xl">{child.gender === '女' ? '👧' : '👦'}</div>
              <div>
                <h2>{child.name} <span className="chip chip-age">{age}岁</span></h2>
                <div className="muted">🎂 {child.birthDate} · {child.gender}</div>
                <div className="muted">👨‍👩‍👧 家长：{child.parentName} · 📱 {child.phone}</div>
                {child.tags?.length > 0 && (
                  <div className="tag-row">{child.tags.map(t => <span key={t} className="tag">#{t}</span>)}</div>
                )}
                {(child.allergies || child.medical) && (
                  <div className="health-row">
                    {child.allergies && <span className="health-bad">⚠️过敏：{child.allergies}</span>}
                    {child.medical && <span className="health-warn">🩺{child.medical}</span>}
                  </div>
                )}
              </div>
            </div>
            <div className="stat-row">
              <div className="stat-card"><div className="stat-num">{childEnr.filter(e=>e.status==='active').length}</div><div className="stat-lbl">正式报名</div></div>
              <div className="stat-card"><div className="stat-num">{childWl.filter(w=>w.status==='waiting').length}</div><div className="stat-lbl">候补队列</div></div>
              <div className="stat-card"><div className="stat-num">{notes.length}</div><div className="stat-lbl">顾问备注</div></div>
              <div className="stat-card"><div className="stat-num">{childTrials.length}</div><div className="stat-lbl">试听记录</div></div>
            </div>
          </div>
          <div className="card">
            <div className="card-head"><h3>📋 课程状态</h3></div>
            <div className="section-title">✅ 已报名课程</div>
            {childEnr.filter(e=>e.status==='active').length === 0 && <div className="muted">暂无</div>}
            {childEnr.filter(e=>e.status==='active').map(e => {
              const c = helpers.getCourse(e.courseId);
              const s = helpers.getSession(e.sessionId);
              return (
                <div key={e.id} className="row-item">
                  <div>
                    <b>{c?.cover} {c?.name}</b>
                    <div className="muted small">{s?.name || '滚动开班'} · ¥{e.amount} {e.fromWaitlist && <span className="chip-promoted">候补充位</span>}</div>
                  </div>
                  <span className="tag ok">已生效</span>
                </div>
              );
            })}
            <div className="section-title">⏳ 候补队列</div>
            {childWl.filter(w=>w.status==='waiting').length === 0 && <div className="muted">暂无</div>}
            {childWl.filter(w=>w.status==='waiting').map(w => {
              const c = helpers.getCourse(w.courseId);
              return (
                <div key={w.id} className="row-item">
                  <div><b>{c?.cover} {c?.name}</b><div className="muted small">加入时间：{new Date(w.createdAt).toLocaleString('zh-CN')}</div></div>
                  <span className="tag warn">顺位 #{w.position}</span>
                </div>
              );
            })}
            <div className="section-title">📅 试听记录</div>
            {childTrials.length === 0 && <div className="muted">暂无</div>}
            {childTrials.map(t => {
              const c = helpers.getCourse(t.courseId);
              return (
                <div key={t.id} className="row-item">
                  <div><b>{c?.cover} {c?.name}</b><div className="muted small">{t.trialDate} · {t.status}</div></div>
                  <span className={`tag ${t.status==='completed' ? 'ok' : t.status==='scheduled' ? 'info' : 'bad'}`}>{t.status}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'notes' && (
        <div className="grid-2col">
          <div className="card">
            <div className="card-head"><h3>📝 新增顾问备注</h3></div>
            {child ? (
              <>
                <div className="muted" style={{marginBottom: 12}}>
                  对 <b>{child.name}</b>（{age}岁）撰写服务备注。
                  <br/><b className="rule-warn">R006：写备注是允许的，但无法绕过年龄/容量规则。</b>
                </div>
                <label>备注内容
                  <textarea
                    rows="5"
                    value={note.content}
                    onChange={e => setNote({ ...note, content: e.target.value })}
                    placeholder="家长诉求、课程建议、特殊需求、沟通要点..."
                  />
                </label>
                <label style={{marginTop: 12}}>跟进事项（可选）
                  <input
                    value={note.followUp}
                    onChange={e => setNote({ ...note, followUp: e.target.value })}
                    placeholder="例如：本周联系篮球教练安排试训"
                  />
                </label>
                <div className="card-actions">
                  <button className="btn btn-primary" onClick={submitNote}>💾 保存备注</button>
                </div>
              </>
            ) : <div className="muted">请先在左侧选择儿童</div>}
          </div>
          <div className="card">
            <div className="card-head"><h3>📚 历史备注 {child && `(${notes.length})`}</h3></div>
            {!child && <div className="muted">请先选择儿童</div>}
            {child && notes.length === 0 && <div className="muted">暂无备注</div>}
            {notes.map(n => (
              <div key={n.id} className="note-card">
                <div className="note-head">
                  <b>{n.consultantName}</b>
                  <span className="muted small">{new Date(n.createdAt).toLocaleString('zh-CN')}</span>
                </div>
                <div className="note-body">{n.content}</div>
                {n.followUp && (
                  <div className="note-followup">🔔 跟进：{n.followUp}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'assist' && (
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-head">
              <h3>🤝 辅助报名工作台</h3>
              <span className="muted">
                为【{child?.name || '未选'}】操作。所有操作均受规则引擎约束，无法绕过。
              </span>
            </div>
          </div>
          <div className="course-grid">
            {state.courses.map(c => <CourseCard key={c.id} course={c}/>)}
          </div>
        </div>
      )}

      {tab === 'bypass_test' && (
        <div className="grid-2col">
          <div className="card">
            <div className="card-head"><h3>🔐 R006 顾问绕过规则测试</h3></div>
            <div className="rule-warn block">
              <b>测试场景：</b>验证顾问即使勾选 bypassAge/bypassCapacity 也无法通过 R006。
              <br/>选择一个年龄不符或已满的课程，勾选绕过开关，点击「尝试执行」观察拒绝结果。
            </div>
            <label>儿童
              <select value={bypassTest.childId} onChange={e => setBypassTest({ ...bypassTest, childId: e.target.value })}>
                {state.children.filter(c=>!c._ghost).map(c => (
                  <option key={c.id} value={c.id}>{c.name}（{calculateAge(c.birthDate)}岁）</option>
                ))}
              </select>
            </label>
            <label style={{marginTop: 10}}>目标课程
              <select value={bypassTest.courseId} onChange={e => setBypassTest({ ...bypassTest, courseId: e.target.value })}>
                {state.courses.map(c => {
                  const enr = countEnrollmentsByCourse(state.enrollments, c.id, 'active');
                  const full = enr >= c.totalSeats;
                  const selectedChild = state.children.find(ch => ch.id === bypassTest.childId);
                  const childAge = selectedChild ? calculateAge(selectedChild.birthDate) : null;
                  const ageBad = childAge != null && (childAge < c.minAge || childAge > c.maxAge);
                  return (
                    <option key={c.id} value={c.id}>
                      {c.name} 适龄{c.minAge}-{c.maxAge}岁 余{Math.max(0, c.totalSeats - enr)}席
                      {full ? ' [已满]' : ''}{ageBad ? ' [年龄不符]' : ''}
                    </option>
                  );
                })}
              </select>
            </label>
            <label style={{marginTop: 10}}>班期
              <select value={bypassTest.sessionId || ''} onChange={e => setBypassTest({ ...bypassTest, sessionId: e.target.value || null })}>
                <option value="">不指定</option>
                {helpers.getCourseSessions(bypassTest.courseId).map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.dayOfWeek} {s.startTime}-{s.endTime})</option>
                ))}
              </select>
            </label>
            <div className="check-list" style={{marginTop: 12}}>
              <label className="check-wrap">
                <input type="checkbox" checked={bypassTest.bypassAge} onChange={e=>setBypassTest({...bypassTest, bypassAge: e.target.checked})}/>
                <b>尝试绕过 R001 年龄限制</b>（应被 R006 拒绝）
              </label>
              <label className="check-wrap">
                <input type="checkbox" checked={bypassTest.bypassCapacity} onChange={e=>setBypassTest({...bypassTest, bypassCapacity: e.target.checked})}/>
                <b>尝试绕过 R004 容量限制</b>（应被 R006 拒绝）
              </label>
            </div>
            <div className="card-actions">
              <button className="btn btn-danger" onClick={runBypassTest}>⚠️ 尝试执行（预计触发 R006 拒绝）</button>
              <button className="btn btn-ghost" onClick={() => setBypassTest({...bypassTest, lastResult: null})}>清除结果</button>
            </div>
          </div>
          <div className="card">
            <div className="card-head"><h3>🧪 规则执行结果</h3></div>
            {!bypassTest.lastResult && <div className="muted">点击左侧「尝试执行」观察规则引擎响应</div>}
            {bypassTest.lastResult && (
              <div className={`rule-result ${bypassTest.lastResult.ok ? 'ok' : 'bad'} big`}>
                <div className="result-title">
                  {bypassTest.lastResult.ok
                    ? `✅ ${bypassTest.lastResult.mode === 'waitlist' ? `候补顺位 #${bypassTest.lastResult.position}` : '成功'}`
                    : `❌ 被规则引擎拒绝`}
                </div>
                {!bypassTest.lastResult.ok && (
                  <>
                    <div className="result-msg">{bypassTest.lastResult.error?.shortMessage}</div>
                    {bypassTest.lastResult.error?.detail?.length > 0 && (
                      <ul className="result-detail">
                        {bypassTest.lastResult.error.detail.map((d, i) => <li key={i}>{d}</li>)}
                      </ul>
                    )}
                    <small className="muted">💡 建议：{bypassTest.lastResult.error?.suggestion}</small>
                  </>
                )}
                <div className="rule-trace" style={{marginTop: 10}}>
                  <b>规则执行轨迹：</b>
                  <pre>{JSON.stringify(bypassTest.lastResult.ruleTrace, null, 2)}</pre>
                </div>
              </div>
            )}
            <div className="section-title" style={{marginTop: 20}}>📚 规则清单</div>
            <ul className="rule-list">
              <li><b>R001</b> - 年龄不符不能预约试听/报名</li>
              <li><b>R002</b> - 同一儿童同一时间段只能试听或报名一门</li>
              <li><b>R003</b> - 同一课程同一儿童不能重复占位</li>
              <li><b>R004</b> - 名额为零时只能进入候补并展示顺位</li>
              <li><b>R005</b> - 取消正式名额按候补顺位+年龄+时间自动提升</li>
              <li><b className="warn">R006</b> - 顾问可写备注但<b>不能绕过</b>年龄/容量规则</li>
              <li><b>R007</b> - 容量调低溢出进入异常待处理</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
