import React from 'react';
import { AppProvider, useApp } from './context.jsx';
import RoleSwitcher from './components/RoleSwitcher.jsx';
import ChildProfile from './components/ChildProfile.jsx';
import NotificationPanel from './components/NotificationPanel.jsx';
import ParentView from './views/ParentView.jsx';
import AdvisorView from './views/AdvisorView.jsx';
import AdminView from './views/AdminView.jsx';

function Shell() {
  const { state } = useApp();
  return (
    <div className="app-shell">
      <RoleSwitcher />
      <div className="app-main">
        <aside className="app-side">
          <ChildProfile />
          <NotificationPanel />
        </aside>
        <section className="app-content">
          {state.role === 'parent' && <ParentView />}
          {state.role === 'advisor' && <AdvisorView />}
          {state.role === 'admin' && <AdminView />}
        </section>
      </div>
      <footer className="app-footer">
        <span>青少年活动中心 · 前端课程橱窗系统</span>
        <span className="muted">端口 8660 · 本地规则引擎 enforceRules() · 状态持久化 localStorage</span>
      </footer>
    </div>
  );
}

export default function App() {
  return React.createElement(AppProvider, null, React.createElement(Shell));
}
