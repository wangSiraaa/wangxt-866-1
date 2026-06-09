import React, { useState } from 'react';
import { useApp } from '../context.jsx';
import { calculateAge, countEnrollmentsByCourse, countWaitlistByCourse } from '../store.js';

export default function AdminView() {
  const { state, helpers, adjustCapacity, resolveAnomaly, cancelEnrollment, resetState } = useApp();
  const [tab, setTab] = useState('capacity');
  // capacity
  const [capTarget, setCapTarget] = useState({ courseId: 'c_dance_01', newCapacity: 10 });
  const [capResult, setCapResult] = useState(null);
  // anomalies
  const [selAnomId, setSelAnomId] = useState(null);
  const [selRemoves, setSelRemoves] = useState(new Set());
  // cancel
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelResult, setCancelResult] = useState(null);

  const pendingAnoms = state.anomalies.filter(a => a.status === 'pending');
  const resolvedAnoms = state.anomalies.filter(a => a.status === 'resolved');

  function runAdjust() {
    const r = adjustCapacity(capTarget.courseId, Number(capTarget.newCapacity));
    setCapResult(r);
  }

  function runCancel() {
    if (!cancelTarget) return;
    const r = cancelEnrollment(cancelTarget);
    setCancelResult(r);
  }

  function toggleRemove(enrId) {
    const next = new Set(selRemoves);
    if (next.has(enrId)) next.delete(enrId); else next.add(enrId);
    setSelRemoves(next);
  }

  function doResolve(anom) {
    const need = anom.detail.overflowCount;
    if (selRemoves.size !== need) {
      return alert(`需要选择 ${need} 个溢出的报名来取消（已选 ${selRemoves.size}）`);
    }
    resolveAnomaly(anom.id, Array.from(selRemoves), 'manual_cancel_by_admin');
    setSelRemoves(new Set());
    setSelAnomId(null);
  }

  return (
    <div className="view-admin">
      <div className="tabs-md">
        {[
          ['capacity', '📦 容量调整 (R007)'],
          ['anomalies', `⚠️ 异常待处理 ${pendingAnoms.length > 0 ? `(${pendingAnoms.length})` : ''}`],
          ['cancel', '🗑️ 取消报名 → R005 候补转正'],
          ['audit', '📜 本地审计日志'],
          ['system', '🔧 系统 / 持久化']
        ].map(([k, l]) => (
          <button key={k} className={`tab-md ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === 'capacity' && (
        <div className="grid-2col">
          <div className="card">
            <div className="card-head"><h3>📦 班期容量调整控制台</h3></div>
            <div className="rule-warn block">
              <b>R007：</b>容量调低时，如果<b>已报名人数 > 新容量</b>，不会直接删除任何报名，而是进入「异常待处理」列表，由教务人工选择溢出的报名取消。
            </div>
            <label>目标课程
              <select value={capTarget.courseId} onChange={e => {
                const c = state.courses.find(x => x.id === e.target.value);
                setCapTarget({ courseId: e.target.value, newCapacity: c?.totalSeats || 10 });
                setCapResult(null);
              }}>
                {state.courses.map(c => {
                  const enr = countEnrollmentsByCourse(state.enrollments, c.id, 'active');
                  return (
                    <option key={c.id} value={c.id}>
                      {c.cover} {c.name} · 容量{c.totalSeats} · 已报{enr} · 候{countWaitlistByCourse(state.waitlist, c.id, 'waiting')}
                    </option>
                  );
                })}
              </select>
            </label>
            {(() => {
              const c = helpers.getCourse(capTarget.courseId);
              const enr = countEnrollmentsByCourse(state.enrollments, capTarget.courseId, 'active');
              const willOverflow = Number(capTarget.newCapacity) < enr;
              return (
                <>
                  <div className="info-block">
                    当前：<b>{c?.name}</b><br/>
                    容量：<b>{c?.totalSeats}</b> · 已报名 <b>{enr}</b> · 剩余 <b className={enr >= c?.totalSeats ? 'bad' : 'good'}>{Math.max(0, (c?.totalSeats||0) - enr)}</b><br/>
                    候补：<b>{countWaitlistByCourse(state.waitlist, capTarget.courseId, 'waiting')}</b> 人
                  </div>
                  <label style={{marginTop: 10}}>
                    新容量 <input type="number" min="1" value={capTarget.newCapacity}
                      onChange={e => { setCapTarget({ ...capTarget, newCapacity: e.target.value }); setCapResult(null); }}/>
                  </label>
                  <div className={`overflow-predict ${willOverflow ? 'bad' : 'ok'}`}>
                    {willOverflow
                      ? <>⚠️ 预测：新容量 {capTarget.newCapacity} < 已报名 {enr}，溢出 {enr - Number(capTarget.newCapacity)} 人 → 将进入<b>异常待处理</b></>
                      : <>✓ 预测：新容量 {capTarget.newCapacity} ≥ 已报名 {enr}，将直接生效</>}
                  </div>
                  <div className="card-actions">
                    <button className="btn btn-primary" onClick={runAdjust}>⚙️ 执行容量调整</button>
                    <button className="btn btn-ghost" onClick={() => setCapResult(null)}>清结果</button>
                  </div>
                </>
              );
            })()}
            {capResult && (
              <div className={`rule-result ${capResult.ok ? 'ok' : 'bad'} big`} style={{marginTop: 12}}>
                <div className="result-title">
                  {capResult.ok
                    ? (capResult.mode === 'anomaly' ? '⚠️ 已生成异常待处理记录' : '✅ 容量调整成功')
                    : '❌ 调整被拒绝'}
                </div>
                {capResult.ok && capResult.mode === 'anomaly' && (
                  <>
                    <div className="result-msg">溢出 {capResult.anomaly.overflowCount} 人，请前往「异常待处理」处理</div>
                    <ul className="result-detail">
                      <li>原容量：{capResult.anomaly.originalCapacity}</li>
                      <li>拟调整：{capResult.anomaly.newCapacity}</li>
                      <li>已报名：{capResult.anomaly.activeCount}</li>
                      <li>溢出报名单号：{capResult.anomaly.overflowIds.join(', ')}</li>
                    </ul>
                  </>
                )}
                <div className="rule-trace" style={{marginTop: 10}}>
                  <b>规则轨迹：</b>
                  <pre>{JSON.stringify(capResult.ruleTrace, null, 2)}</pre>
                </div>
              </div>
            )}
          </div>
          <div className="card">
            <div className="card-head"><h3>📊 所有课程容量一览</h3></div>
            <table className="tbl">
              <thead>
                <tr>
                  <th>课程</th><th>适龄</th><th>容量</th><th>已报</th><th>候补</th><th>状态</th>
                </tr>
              </thead>
              <tbody>
                {state.courses.map(c => {
                  const enr = countEnrollmentsByCourse(state.enrollments, c.id, 'active');
                  const wl = countWaitlistByCourse(state.waitlist, c.id, 'waiting');
                  const rem = c.totalSeats - enr;
                  return (
                    <tr key={c.id}>
                      <td>{c.cover} {c.name}</td>
                      <td>{c.minAge}-{c.maxAge}岁</td>
                      <td>{c.totalSeats}</td>
                      <td>{enr}</td>
                      <td>{wl > 0 ? `⏳ ${wl}` : '-'}</td>
                      <td>
                        {rem <= 0 ? <span className="tag bad">已满</span>
                          : rem <= 3 ? <span className="tag warn">紧张({rem})</span>
                          : <span className="tag ok">充裕({rem})</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'anomalies' && (
        <div className="grid-2col">
          <div className="card">
            <div className="card-head"><h3>⚠️ 待处理异常 ({pendingAnoms.length})</h3></div>
            {pendingAnoms.length === 0 && <div className="empty-hint">暂无异常 🎉</div>}
            {pendingAnoms.map(a => {
              const c = helpers.getCourse(a.courseId);
              const activeEnrs = state.enrollments.filter(e => e.courseId === a.courseId && e.status === 'active');
              const isSel = selAnomId === a.id;
              return (
                <div key={a.id} className={`anomaly-card ${isSel ? 'selected' : ''}`}>
                  <div className="anom-head" onClick={() => { setSelAnomId(a.id); setSelRemoves(new Set()); }}>
                    <div>
                      <b>🔴 [R007] 容量溢出异常</b> · {c?.cover} {c?.name}
                    </div>
                    <span className="tag bad">待处理</span>
                  </div>
                  <div className="anom-meta">
                    <span>原容量：<b>{a.detail.originalCapacity}</b></span>
                    <span>拟调整：<b className="warn">{a.proposedCapacity}</b></span>
                    <span>已报名：<b>{a.detail.activeCount}</b></span>
                    <span className="bad-text">溢出：<b>{a.detail.overflowCount}</b> 人</span>
                    <span className="muted small">{new Date(a.createdAt).toLocaleString('zh-CN')}</span>
                  </div>
                  {isSel && (
                    <div className="anom-body">
                      <div className="rule-warn block small">
                        请从下方选择 <b>{a.detail.overflowCount}</b> 个溢出的报名取消（差额：{a.detail.activeCount} - {a.proposedCapacity} = {a.detail.overflowCount}）
                      </div>
                      <div className="overflow-enroll-list">
                        {activeEnrs.map((e, idx) => {
                          const child = helpers.getChild(e.childId);
                          const age = child ? calculateAge(child.birthDate) : null;
                          const inOverflow = idx >= a.proposedCapacity; // 假设按报名先后，后面的是溢出的
                          return (
                            <label key={e.id} className={`enr-choice ${inOverflow ? 'overflow' : ''} ${selRemoves.has(e.id) ? 'selected' : ''}`}>
                              <input
                                type="checkbox"
                                checked={selRemoves.has(e.id)}
                                onChange={() => toggleRemove(e.id)}
                              />
                              <div>
                                <div>
                                  <b>{child?.name || '(虚拟)'}</b>
                                  {age != null && <span className="chip chip-age">{age}岁</span>}
                                  {inOverflow && <span className="tag bad">在溢出区</span>}
                                </div>
                                <div className="muted small">
                                  报名号 {e.id} · {new Date(e.createdAt).toLocaleString('zh-CN')}
                                  {e.fromWaitlist && ' · 候补转正'}
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                      <div className="card-actions">
                        <button className="btn btn-danger" onClick={() => doResolve(a)} disabled={selRemoves.size !== a.detail.overflowCount}>
                          取消 {selRemoves.size}/{a.detail.overflowCount} 个报名并应用容量 {a.proposedCapacity}
                        </button>
                        <button className="btn btn-ghost" onClick={() => { setSelAnomId(null); setSelRemoves(new Set()); }}>取消选择</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            <div className="card-head" style={{marginTop: 20}}><h3>✅ 已解决 ({resolvedAnoms.length})</h3></div>
            {resolvedAnoms.length === 0 && <div className="empty-hint small">暂无</div>}
            {resolvedAnoms.map(a => {
              const c = helpers.getCourse(a.courseId);
              return (
                <div key={a.id} className="anomaly-card resolved">
                  <div className="anom-head">
                    <div><b>✅ 容量调整已生效</b> · {c?.cover} {c?.name}</div>
                    <span className="tag ok">已解决</span>
                  </div>
                  <div className="anom-meta">
                    <span>最终容量：<b>{a.proposedCapacity}</b></span>
                    <span>处理方式：<b>{a.resolution}</b></span>
                    <span className="muted small">{new Date(a.resolvedAt).toLocaleString('zh-CN')}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="card">
            <div className="card-head"><h3>📚 候补队列详情</h3></div>
            {state.courses.filter(c => countWaitlistByCourse(state.waitlist, c.id, 'waiting') > 0).map(c => {
              const wl = helpers.getCourseWaitlist(c.id).filter(w => w.status === 'waiting');
              return (
                <div key={c.id} className="waitlist-block">
                  <div className="waitlist-head">
                    <b>{c.cover} {c.name}</b>
                    <span className="muted small">适龄 {c.minAge}-{c.maxAge}岁 · {wl.length} 人候补</span>
                  </div>
                  <ol className="waitlist-ol">
                    {wl.map(w => {
                      const child = helpers.getChild(w.childId);
                      const age = child ? calculateAge(child.birthDate) : null;
                      const ageOk = age != null && age >= c.minAge && age <= c.maxAge;
                      return (
                        <li key={w.id} className={ageOk ? '' : 'age-no-match'}>
                          <span className="wl-pos">#{w.position}</span>
                          <b>{child?.name || '(虚拟)'}</b>
                          <span className="chip chip-age">{age}岁</span>
                          {ageOk
                            ? <span className="tag ok">适龄可升</span>
                            : <span className="tag bad">年龄不符→跳过</span>}
                          <span className="muted small">{new Date(w.createdAt).toLocaleString('zh-CN')}</span>
                        </li>
                      );
                    })}
                  </ol>
                  <div className="muted small rule-warn">
                    R005：取消正式名额后，按 顺位→年龄匹配→预约时间 自动提升第一位年龄符合的儿童
                  </div>
                </div>
              );
            })}
            {state.courses.filter(c => countWaitlistByCourse(state.waitlist, c.id, 'waiting') > 0).length === 0 &&
              <div className="empty-hint">暂无候补队列</div>}
          </div>
        </div>
      )}

      {tab === 'cancel' && (
        <div className="grid-2col">
          <div className="card">
            <div className="card-head"><h3>🗑️ 选择要取消的正式报名 → 触发 R005 候补转正</h3></div>
            <div className="rule-ok block">
              <b>R005：</b>取消后，规则引擎会扫描候补队列，按「顺位→年龄匹配→预约时间」自动提升第一名合格者并生成通知。
            </div>
            <div className="enrollments-list">
              {state.enrollments.filter(e => e.status === 'active').slice(0, 30).map(e => {
                const c = helpers.getCourse(e.courseId);
                const child = helpers.getChild(e.childId);
                const age = child ? calculateAge(child.birthDate) : null;
                const wl = countWaitlistByCourse(state.waitlist, e.courseId, 'waiting');
                return (
                  <label key={e.id} className={`enr-choice ${cancelTarget === e.id ? 'selected' : ''}`}>
                    <input type="radio" name="cancel_target" checked={cancelTarget === e.id}
                      onChange={() => { setCancelTarget(e.id); setCancelResult(null); }}/>
                    <div>
                      <div>
                        <b>{c?.cover} {c?.name}</b>
                        {e.fromWaitlist && <span className="chip-promoted">候补转正</span>}
                      </div>
                      <div className="muted small">
                        儿童：{child?.name || '(虚拟)'}{age != null && ` (${age}岁)`} · 报名号 {e.id}
                      </div>
                      <div className="muted small">
                        候补：该课程现有 <b className={wl > 0 ? 'warn' : ''}>{wl}</b> 人候补
                        {wl === 0 && '（取消后无人可升）'}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
            <div className="card-actions">
              <button className="btn btn-danger" onClick={runCancel} disabled={!cancelTarget}>
                🗑️ 取消选中的报名（将触发 R005）
              </button>
              <button className="btn btn-ghost" onClick={() => { setCancelTarget(null); setCancelResult(null); }}>清除</button>
            </div>
          </div>
          <div className="card">
            <div className="card-head"><h3>🧪 R005 执行结果</h3></div>
            {!cancelResult && <div className="muted">选择左侧一个报名并取消，观察 R005 候补提升</div>}
            {cancelResult && (
              <div className={`rule-result ${cancelResult.ok ? 'ok' : 'bad'} big`}>
                <div className="result-title">{cancelResult.ok ? '✅ 报名已取消' : '❌ 失败'}</div>
                {cancelResult.ok && (
                  <div className="result-msg">
                    请查看下方「通知」列表，应新增 1 条「候补转正」通知（给被提升的家长）+ 1 条「R005 自动提升」教务通知，
                    以及报名取消通知（给原报名家长）。
                  </div>
                )}
                <div className="rule-trace">
                  <b>规则轨迹：</b>
                  <pre>{JSON.stringify(cancelResult.ruleTrace, null, 2)}</pre>
                </div>
              </div>
            )}
            <div className="section-title" style={{marginTop: 16}}>🔔 最近 8 条通知（观察 R005 自动提升通知）</div>
            <div className="mini-notifs">
              {state.notifications.slice(0, 8).map(n => (
                <div key={n.id} className={`mini-notif ${n.read ? 'read' : ''}`}>
                  <div className="mini-notif-title">{n.title}</div>
                  <div className="mini-notif-time">{new Date(n.createdAt).toLocaleString('zh-CN')}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'audit' && (
        <div className="card">
          <div className="card-head">
            <h3>📜 本地审计日志 ({state.auditLog.length})</h3>
            <span className="muted small">所有操作可追溯，刷新后保留</span>
          </div>
          <table className="tbl audit-tbl">
            <thead>
              <tr>
                <th>时间</th><th>操作人(角色)</th><th>动作</th><th>对象</th><th>结果</th><th>规则验证</th>
              </tr>
            </thead>
            <tbody>
              {state.auditLog.map(a => (
                <tr key={a.id}>
                  <td className="small muted">{new Date(a.timestamp).toLocaleString('zh-CN')}</td>
                  <td><b>{a.actor}</b><div className="small muted">{a.actorRole}</div></td>
                  <td><code className="mono">{a.action}</code></td>
                  <td>
                    {a.targetType} <code className="mono">{a.targetId}</code>
                    <details style={{marginTop: 4}}>
                      <summary className="muted small">详情</summary>
                      <pre style={{fontSize: 11}}>{JSON.stringify(a.detail, null, 2)}</pre>
                    </details>
                  </td>
                  <td>
                    <span className={`tag ${a.result==='success' ? 'ok' : a.result==='pending_resolution' ? 'warn' : 'bad'}`}>
                      {a.result}
                    </span>
                  </td>
                  <td className="small rule-trace-col">
                    {(a.ruleCheck || []).map((r, i) => (
                      <span key={i} className={`rule-chip ${r.includes('OK') ? 'ok' : r.includes('BLOCKED') ? 'bad' : ''}`}>{r}</span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'system' && (
        <div className="grid-2col">
          <div className="card">
            <div className="card-head"><h3>🔧 持久化状态验证</h3></div>
            <ul className="persist-list">
              <li>⭐ 收藏课程数：<b>{Object.values(state.favorites || {}).reduce((s, a) => s + a.length, 0)}</b></li>
              <li>⏳ 候补队列：<b>{state.waitlist.filter(w => w.status === 'waiting').length}</b> 人</li>
              <li>🔔 通知总数：<b>{state.notifications.length}</b> 条，未读 <b>{state.notifications.filter(n => !n.read).length}</b></li>
              <li>⚠️ 异常待处理：<b>{pendingAnoms.length}</b> 条</li>
              <li>📝 顾问备注：<b>{state.consultantNotes.length}</b> 条</li>
              <li>📜 审计日志：<b>{state.auditLog.length}</b> 条</li>
              <li>📋 报名：<b>{state.enrollments.length}</b> 条，生效 <b>{state.enrollments.filter(e=>e.status==='active').length}</b></li>
              <li>👶 儿童档案：<b>{state.children.filter(c=>!c._ghost).length}</b> 人（真实），含虚拟 <b>{Object.keys(state.ghostChildren||{}).length}</b></li>
              <li>🔍 筛选条件：<code>{JSON.stringify(state.filters)}</code></li>
            </ul>
            <div className="rule-warn block" style={{marginTop: 12}}>
              以上所有数据持久化于 <code>localStorage.yac_state_v1</code>，刷新页面后可复查。
            </div>
            <div className="card-actions">
              <button className="btn btn-danger" onClick={() => {
                if (confirm('确认重置所有数据为初始测试集？')) resetState();
              }}>♻️ 重置为初始测试数据</button>
            </div>
          </div>
          <div className="card">
            <div className="card-head"><h3>🧪 Smoke 场景自查</h3></div>
            <ul className="smoke-check">
              <li>✅ <b>年龄边界不符失败</b> → 家长视图，选小刚(6岁)报名篮球(10-15)，将触发 R001</li>
              <li>✅ <b>满员进入候补</b> → 选任何人报名美术(已满6/6)，将走 R004，显示顺位</li>
              <li>✅ <b>候补自动转正</b> → 教务视图「取消报名」Tab，取消一个美术班正式名额，将触发 R005 + 通知</li>
              <li>✅ <b>容量调低异常</b> → 教务视图「容量调整」，把舞蹈班(11/12)调到 9，将走 R007 生成异常待处理</li>
              <li>✅ <b>顾问绕过规则失败</b> → 顾问视图「R006绕过测试」Tab，勾选绕过开关尝试执行</li>
              <li>✅ <b>刷新保留</b> → 执行完以上操作后刷新页面，收藏/候补/通知/异常均保留</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
