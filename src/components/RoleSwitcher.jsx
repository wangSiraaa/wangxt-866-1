import React from 'react';
import { useApp } from '../context.jsx';

export default function RoleSwitcher() {
  const { state, switchRole, helpers } = useApp();
  const unread = helpers.getUnreadNotifCount();
  const roles = [
    { key: 'parent',  label: '👨‍👩‍👧 家长', desc: '报名 / 候补 / 收藏' },
    { key: 'advisor', label: '💼 课程顾问', desc: '儿童档案 / 备注 / 辅助' },
    { key: 'admin',   label: '⚙️ 教务管理员', desc: '容量 / 异常 / 审计' }
  ];
  return (
    <header className="app-header">
      <div className="brand">
        <div className="brand-logo">🎪</div>
        <div>
          <h1 className="brand-title">青少年活动中心 · 课程橱窗</h1>
          <p className="brand-sub">完整招生排课前端 · R001~R007 规则引擎可复查</p>
        </div>
      </div>
      <div className="header-actions">
        <div className="role-switcher" role="tablist">
          {roles.map(r => (
            <button
              key={r.key}
              role="tab"
              aria-selected={state.role === r.key}
              className={`role-tab ${state.role === r.key ? 'active' : ''}`}
              onClick={() => switchRole(r.key)}
              title={r.desc}
            >
              <span className="role-tab-label">{r.label}</span>
            </button>
          ))}
        </div>
        <div className="user-info">
          <span className="user-avatar">👤</span>
          <span className="user-name">{state.currentUserName}</span>
          {unread > 0 && <span className="notif-badge">{unread}</span>}
        </div>
      </div>
    </header>
  );
}
