import React from 'react';
import { useApp } from '../context.jsx';
import { countEnrollmentsByCourse, countWaitlistByCourse, isAgeEligible, calculateAge } from '../store.js';
import { KANBAN_GROUP_OPTIONS } from '../store.js';
import CourseCard from '../components/CourseCard.jsx';

const CATEGORIES = [null, '美术', '音乐', '体育', '舞蹈', '语言', '科技', '思维'];

const LEVEL_ORDER = ['启蒙', '入门', '基础', '进阶', '高级', '专业'];

function groupCourses(courses, groupBy, child, state) {
  if (groupBy === 'none') return { '全部': courses };
  const groups = {};
  for (const c of courses) {
    let key;
    let label;
    if (groupBy === 'category') {
      key = c.category || '其他';
      label = key;
    } else if (groupBy === 'level') {
      key = c.level || '未分级';
      label = key;
    } else if (groupBy === 'ageStatus') {
      if (!child) {
        key = '未选儿童';
        label = '请先选择儿童';
      } else {
        const age = calculateAge(child.birthDate);
        const eligible = isAgeEligible(age, c);
        if (eligible) {
          key = 'eligible';
          label = `✓ 适龄（${age}岁符合${c.minAge}-${c.maxAge}岁）`;
        } else if (age < c.minAge) {
          key = 'tooYoung';
          label = `🌱 年龄偏小（${age}岁 < ${c.minAge}岁）`;
        } else {
          key = 'tooOld';
          label = `🍂 年龄偏大（${age}岁 > ${c.maxAge}岁）`;
        }
      }
    } else if (groupBy === 'seatStatus') {
      const enrolled = countEnrollmentsByCourse(state.enrollments, c.id, 'active');
      const remaining = Math.max(0, c.totalSeats - enrolled);
      if (remaining === 0) {
        key = 'full';
        label = `🔴 已满员（${enrolled}/${c.totalSeats}）`;
      } else if (remaining <= 3) {
        key = 'tight';
        label = `🟡 名额紧张（剩${remaining}个/${c.totalSeats}）`;
      } else {
        key = 'ok';
        label = `🟢 名额充足（剩${remaining}个/${c.totalSeats}）`;
      }
    } else {
      key = '其他';
      label = key;
    }
    if (!groups[key]) groups[key] = { key, label, courses: [] };
    groups[key].courses.push(c);
  }
  return groups;
}

function getGroupOrder(groups, groupBy) {
  const keys = Object.keys(groups);
  if (groupBy === 'level') {
    return keys.sort((a, b) => {
      const ia = LEVEL_ORDER.indexOf(groups[a].key);
      const ib = LEVEL_ORDER.indexOf(groups[b].key);
      if (ia === -1 && ib === -1) return groups[a].key.localeCompare(groups[b].key);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  }
  if (groupBy === 'ageStatus') {
    const ageOrder = ['eligible', 'tooYoung', 'tooOld', '未选儿童'];
    return keys.sort((a, b) => ageOrder.indexOf(a) - ageOrder.indexOf(b));
  }
  if (groupBy === 'seatStatus') {
    const seatOrder = ['ok', 'tight', 'full'];
    return keys.sort((a, b) => seatOrder.indexOf(a) - seatOrder.indexOf(b));
  }
  return keys.sort((a, b) => groups[a].label.localeCompare(groups[b].label, 'zh-Hans-CN'));
}

export default function ParentView() {
  const { state, setFilters, setKanbanGroup, toggleKanbanGroupCollapse, helpers } = useApp();
  const { filters, kanbanGroup } = state;
  const child = helpers.getChild(state.selectedChildId);

  let courses = [...state.courses];
  if (filters.searchText) {
    const q = filters.searchText.toLowerCase();
    courses = courses.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.teacher.toLowerCase().includes(q) ||
      c.desc.toLowerCase().includes(q) ||
      (c.features || []).some(f => f.toLowerCase().includes(q))
    );
  }
  if (filters.category) {
    courses = courses.filter(c => c.category === filters.category);
  }
  if (filters.hasSeatsOnly) {
    courses = courses.filter(c => countEnrollmentsByCourse(state.enrollments, c.id, 'active') < c.totalSeats);
  }
  if (filters.ageRange && child) {
    const age = helpers.calculateAge(child.birthDate);
    if (filters.ageRange === 'eligible') {
      courses = courses.filter(c => age >= c.minAge && age <= c.maxAge);
    } else if (filters.ageRange === 'fav') {
      const favs = state.favorites?.[child.id] || [];
      courses = courses.filter(c => favs.includes(c.id));
    } else if (filters.ageRange === 'my') {
      const myEnr = helpers.getChildEnrollments(child.id).filter(e => e.status === 'active').map(e => e.courseId);
      const myWl = helpers.getChildWaitlist(child.id).filter(w => w.status === 'waiting').map(w => w.courseId);
      const mySet = new Set([...myEnr, ...myWl]);
      courses = courses.filter(c => mySet.has(c.id));
    }
  }

  function sortCourses(list) {
    switch (filters.sortBy) {
      case 'price_asc': return list.sort((a, b) => a.price - b.price);
      case 'price_desc': return list.sort((a, b) => b.price - a.price);
      case 'seats_hot': return list.sort((a, b) => {
        const ea = countEnrollmentsByCourse(state.enrollments, a.id, 'active') / a.totalSeats;
        const eb = countEnrollmentsByCourse(state.enrollments, b.id, 'active') / b.totalSeats;
        return eb - ea;
      });
      case 'waits': return list.sort((a, b) => countWaitlistByCourse(state.waitlist, b.id, 'waiting') - countWaitlistByCourse(state.waitlist, a.id, 'waiting'));
      default: return list;
    }
  }
  courses = sortCourses(courses);

  const isKanbanEnabled = kanbanGroup?.enabled && kanbanGroup?.groupBy && kanbanGroup.groupBy !== 'none';
  const groups = isKanbanEnabled ? groupCourses(courses, kanbanGroup.groupBy, child, state) : null;
  const groupKeys = groups ? getGroupOrder(groups, kanbanGroup.groupBy) : [];
  const collapsedGroups = kanbanGroup?.collapsedGroups || {};

  return (
    <div className="view-parent">
      <div className="filter-bar card">
        <div className="filter-row">
          <input
            type="text"
            className="search-input"
            placeholder="🔍 搜索课程名、老师、特色..."
            value={filters.searchText}
            onChange={e => setFilters({ searchText: e.target.value })}
          />
          <label className="check-wrap">
            <input type="checkbox" checked={filters.hasSeatsOnly} onChange={e => setFilters({ hasSeatsOnly: e.target.checked })}/>
            仅看有名额
          </label>
          <div className="kanban-toggle-wrap" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <label className="check-wrap" title="开启看板分组模式">
              <input
                type="checkbox"
                checked={kanbanGroup?.enabled || false}
                onChange={e => setKanbanGroup({ enabled: e.target.checked })}
              />
              📋 看板分组
            </label>
            {kanbanGroup?.enabled && (
              <select
                value={kanbanGroup?.groupBy || 'category'}
                onChange={e => setKanbanGroup({ groupBy: e.target.value })}
                style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #ddd' }}
              >
                {KANBAN_GROUP_OPTIONS.map(opt => (
                  <option key={opt.key} value={opt.key}>{opt.icon} {opt.label}</option>
                ))}
              </select>
            )}
          </div>
        </div>
        <div className="filter-row">
          <span className="filter-label">分类</span>
          <div className="chip-group">
            {CATEGORIES.map(cat => (
              <button
                key={cat || 'all'}
                className={`chip-btn ${filters.category === cat ? 'active' : ''}`}
                onClick={() => setFilters({ category: cat })}
              >{cat || '全部'}</button>
            ))}
          </div>
        </div>
        <div className="filter-row">
          <span className="filter-label">筛选</span>
          <div className="chip-group">
            <button className={`chip-btn ${filters.ageRange === 'eligible' ? 'active' : ''}`}
              onClick={() => setFilters({ ageRange: filters.ageRange === 'eligible' ? null : 'eligible' })}>
              只看适龄{child ? `(${helpers.calculateAge(child.birthDate)}岁)` : ''}
            </button>
            <button className={`chip-btn ${filters.ageRange === 'fav' ? 'active' : ''}`}
              onClick={() => setFilters({ ageRange: filters.ageRange === 'fav' ? null : 'fav' })}>
              ⭐ 我的收藏
            </button>
            <button className={`chip-btn ${filters.ageRange === 'my' ? 'active' : ''}`}
              onClick={() => setFilters({ ageRange: filters.ageRange === 'my' ? null : 'my' })}>
              📋 我的课程
            </button>
          </div>
          <span className="filter-label" style={{ marginLeft: 12 }}>排序</span>
          <select value={filters.sortBy} onChange={e => setFilters({ sortBy: e.target.value })}>
            <option value="recommended">推荐排序</option>
            <option value="price_asc">价格 低→高</option>
            <option value="price_desc">价格 高→低</option>
            <option value="seats_hot">热度（抢手优先）</option>
            <option value="waits">候补人数</option>
          </select>
        </div>
        <div className="filter-summary">
          共 <b>{courses.length}</b> 门课程
          {child && <> · 当前儿童：<b>{child.name}</b>（{helpers.calculateAge(child.birthDate)}岁）</>}
          {isKanbanEnabled && <> · 看板模式：<b>{KANBAN_GROUP_OPTIONS.find(o => o.key === kanbanGroup.groupBy)?.label || ''}</b> · <b>{groupKeys.length}</b> 个分栏</>}
        </div>
      </div>

      {!isKanbanEnabled ? (
        <div className="course-grid">
          {courses.length === 0 && <div className="empty-hint large">😕 没有符合条件的课程，试试调整筛选条件</div>}
          {courses.map(c => <CourseCard key={c.id} course={c}/>)}
        </div>
      ) : (
        <div className="kanban-board">
          {groupKeys.length === 0 && <div className="empty-hint large">😕 没有符合条件的课程，试试调整筛选条件</div>}
          {groupKeys.map(gk => {
            const g = groups[gk];
            const isCollapsed = collapsedGroups[gk] || false;
            const borderColor = {
              eligible: '#52c41a', tooYoung: '#1890ff', tooOld: '#8c8c8c', '未选儿童': '#bfbfbf',
              ok: '#52c41a', tight: '#faad14', full: '#ff4d4f',
              美术: '#f5222d', 音乐: '#722ed1', 体育: '#13c2c2', 舞蹈: '#eb2f96',
              语言: '#1890ff', 科技: '#2f54eb', 思维: '#fa8c16'
            }[gk] || '#d9d9d9';
            return (
              <div
                key={gk}
                className="kanban-column"
                style={{ borderTopColor: borderColor }}
              >
                <div
                  className="kanban-column-header"
                  onClick={() => toggleKanbanGroupCollapse(gk)}
                  title="点击展开/收起"
                  style={{ cursor: 'pointer' }}
                >
                  <div className="kanban-col-title">
                    <span className="kanban-collapse-arrow">{isCollapsed ? '▶' : '▼'}</span>
                    <span className="kanban-col-label">{g.label}</span>
                    <span className="kanban-col-count">{g.courses.length}门</span>
                  </div>
                </div>
                {!isCollapsed && (
                  <div className="kanban-column-body">
                    {g.courses.length === 0 ? (
                      <div className="empty-hint small">无课程</div>
                    ) : (
                      g.courses.map(c => <CourseCard key={c.id} course={c}/>)
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
