import React, { useState } from 'react';
import { useApp } from '../context.jsx';

export default function NotificationPanel() {
  const { state, helpers, markNotifRead } = useApp();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('all');
  const notifs = state.notifications || [];
  const unread = helpers.getUnreadNotifCount();

  const filtered = notifs.filter(n => {
    if (filter === 'unread') return !n.read;
    if (filter === 'admin') return n.targetRole === 'admin';
    if (filter === 'parent') return n.targetRole !== 'admin';
    return true;
  });

  const typeIcon = {
    enrollment_success: '✅', enrollment_cancelled: '🗑️',
    waitlist_joined: '⏳', waitlist_promoted: '🎉',
    trial_scheduled: '📅', anomaly_created: '⚠️',
    anomaly_resolved: '✅', capacity_adjusted: '📦',
    waitlist_alert: '🔔', waitlist_promoted_admin: '🤖',
    enrollment_cancelled_by_adjustment: '🔧', note_added: '📝'
  };

  return (
    <div className="card notif-panel">
      <div className="card-head">
        <h3>🔔 通知中心 {unread > 0 && <span className="badge-red">{unread}</span>}</h3>
        <div className="tabs-sm">
          {['all','unread','parent','admin'].map(t => (
            <button
              key={t}
              className={`tab-sm ${filter === t ? 'active' : ''}`}
              onClick={() => setFilter(t)}
            >
              {t === 'all' ? '全部' : t === 'unread' ? '未读' : t === 'parent' ? '家长' : '教务'}
            </button>
          ))}
        </div>
      </div>
      <div className="notif-list">
        {filtered.length === 0 && <div className="empty-hint">暂无通知</div>}
        {filtered.map(n => (
          <div
            key={n.id}
            className={`notif-item ${n.read ? 'read' : 'unread'}`}
            onClick={() => markNotifRead(n.id)}
          >
            <div className="notif-icon">{typeIcon[n.type] || '📬'}</div>
            <div className="notif-body">
              <div className="notif-title">{n.title}</div>
              <div className="notif-content">{n.content}</div>
              <div className="notif-meta">
                <span className="muted">{new Date(n.createdAt).toLocaleString('zh-CN')}</span>
                <span className={`role-chip ${n.targetRole}`}>
                  {n.targetRole === 'admin' ? '教务可见' : '家长可见'}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
