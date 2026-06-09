import React from 'react';
import { useApp } from '../context.jsx';
import { countEnrollmentsByCourse, countWaitlistByCourse } from '../store.js';
import CourseCard from './CourseCard.jsx';

const CATEGORIES = [null, '美术', '音乐', '体育', '舞蹈', '语言', '科技', '思维'];

export default function ParentView() {
  const { state, setFilters, helpers } = useApp();
  const { filters } = state;
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
        </div>
      </div>

      <div className="course-grid">
        {courses.length === 0 && <div className="empty-hint large">😕 没有符合条件的课程，试试调整筛选条件</div>}
        {courses.map(c => <CourseCard key={c.id} course={c}/>)}
      </div>
    </div>
  );
}
