import React, { useState } from 'react';
import { useApp } from '../context.jsx';
import { calculateAge } from '../store.js';

export default function ChildProfile({ onChildChange }) {
  const { state, selectChild, helpers } = useApp();
  const [view, setView] = useState('list');
  const [form, setForm] = useState({ name: '', gender: '男', birthDate: '2019-01-01', parentName: '', phone: '', tags: '', allergies: '', medical: '' });

  const selected = helpers.getChild(state.selectedChildId);
  const realChildren = state.children.filter(c => !c._ghost);

  if (view === 'add') {
    return (
      <div className="card child-add-card">
        <div className="card-head">
          <h3>➕ 新增儿童档案</h3>
          <button className="btn btn-ghost" onClick={() => setView('list')}>返回</button>
        </div>
        <div className="grid-2">
          <label>姓名<input value={form.name} onChange={e=>setForm({...form, name:e.target.value})}/></label>
          <label>性别
            <select value={form.gender} onChange={e=>setForm({...form, gender:e.target.value})}>
              <option>男</option><option>女</option>
            </select>
          </label>
          <label>出生日期<input type="date" value={form.birthDate} onChange={e=>setForm({...form, birthDate:e.target.value})}/>
            <small className="muted">当前年龄：{calculateAge(form.birthDate)}岁</small>
          </label>
          <label>家长姓名<input value={form.parentName} onChange={e=>setForm({...form, parentName:e.target.value})}/></label>
          <label>联系电话<input value={form.phone} onChange={e=>setForm({...form, phone:e.target.value})}/></label>
          <label>标签(逗号分隔)<input value={form.tags} onChange={e=>setForm({...form, tags:e.target.value})}/></label>
          <label>过敏史<input value={form.allergies} onChange={e=>setForm({...form, allergies:e.target.value})}/></label>
          <label>医疗备注<input value={form.medical} onChange={e=>setForm({...form, medical:e.target.value})}/></label>
        </div>
        <div className="card-actions">
          <button className="btn btn-primary" onClick={() => {
            if (!form.name || !form.birthDate) return alert('姓名和生日必填');
            const id = 'ch_new_' + Date.now().toString(36);
            const newChild = {
              id, name: form.name, gender: form.gender, birthDate: form.birthDate,
              parentName: form.parentName, phone: form.phone,
              tags: form.tags.split(',').map(s=>s.trim()).filter(Boolean),
              allergies: form.allergies, medical: form.medical
            };
            state.children.push(newChild);
            selectChild(id);
            setView('list');
            onChildChange?.(id);
          }}>保存档案</button>
        </div>
      </div>
    );
  }

  return (
    <div className="card child-card">
      <div className="card-head">
        <h3>👶 儿童档案</h3>
        <button className="btn btn-secondary btn-sm" onClick={() => setView('add')}>＋新增</button>
      </div>
      <div className="child-list">
        {realChildren.map(c => {
          const age = calculateAge(c.birthDate);
          const active = c.id === state.selectedChildId;
          const enrollCount = helpers.getChildEnrollments(c.id).filter(e=>e.status==='active').length;
          const wlCount = helpers.getChildWaitlist(c.id).filter(w=>w.status==='waiting').length;
          const favCount = (state.favorites?.[c.id] || []).length;
          return (
            <div
              key={c.id}
              className={`child-item ${active ? 'active' : ''}`}
              onClick={() => { selectChild(c.id); onChildChange?.(c.id); }}
            >
              <div className="child-avatar-circle">{c.gender === '女' ? '👧' : '👦'}</div>
              <div className="child-info">
                <div className="child-name">
                  {c.name}
                  <span className="chip chip-age">{age}岁</span>
                  <span className={`chip chip-gender ${c.gender === '女' ? 'pink' : 'blue'}`}>{c.gender}</span>
                </div>
                <div className="child-meta">
                  <small>🎂 {c.birthDate} &nbsp; 📱 {c.phone || '-'}</small>
                </div>
                <div className="child-stats">
                  <span className="mini-stat">📝{enrollCount}报名</span>
                  <span className="mini-stat">⏳{wlCount}候补</span>
                  <span className="mini-stat">⭐{favCount}收藏</span>
                </div>
                {c.tags?.length > 0 && (
                  <div className="tag-row">
                    {c.tags.map(t => <span key={t} className="tag">#{t}</span>)}
                  </div>
                )}
                {(c.allergies || c.medical) && (
                  <div className="health-row">
                    {c.allergies && <span className="health-bad">⚠️过敏：{c.allergies}</span>}
                    {c.medical && <span className="health-warn">🩺{c.medical}</span>}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {selected && (
        <div className="child-selected-footer">
          <span>✅ 当前操作对象：<b>{selected.name}</b>（{calculateAge(selected.birthDate)}岁）</span>
        </div>
      )}
    </div>
  );
}
