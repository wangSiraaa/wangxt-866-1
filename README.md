# 青少年活动中心 · 课程橱窗系统

完整的前端招生排课系统，支持家长、课程顾问、教务管理员三种角色。

## 功能概览

### 角色
- **家长**: 浏览课程、管理儿童档案、预约试听、正式报名、候补排队、收藏课程、接收通知
- **课程顾问**: 儿童档案管理、顾问备注记录、辅助报名操作（受规则约束）
- **教务管理员**: 班期容量调整、异常待处理、本地审计日志

### 领域对象
- 儿童档案（Children）
- 课程（Courses）
- 班期（Sessions）
- 试听预约（TrialAppointments）
- 正式报名（Enrollments）
- 候补队列（Waitlist）
- 优惠资格（Discounts）
- 顾问备注（ConsultantNotes）
- 通知（Notifications）
- 本地审计（AuditLog）

### 核心业务规则（统一规则引擎 enforceRules）

| 规则编号 | 规则描述 |
|---------|---------|
| R001 | 年龄不符不能预约试听/报名 |
| R002 | 同一儿童同一时间段不能试听或报名两门课 |
| R003 | 同一课程同一儿童不能重复占位 |
| R004 | 名额为零时只能进入候补并展示顺位 |
| R005 | 取消正式名额后按候补顺位自动提升第一名并生成通知 |
| R006 | 顾问可写备注但不能绕过年龄/容量规则 |
| R007 | 教务容量调低时溢出人员进入异常待处理 |

## 启动方式

### 本地开发
```bash
npm install
npm run dev
# 访问 http://localhost:8660
```

### Docker 启动
```bash
# 方式一：docker-compose
docker-compose up -d

# 方式二：docker build & run
docker build -t youth-center .
docker run -p 8660:8660 youth-center

# 访问 http://localhost:8660
```

### 固定端口
所有方式均使用固定端口 **8660**

## Smoke 测试

```bash
# 数据层 + 规则引擎测试（Node 环境，无浏览器依赖）
npm run smoke

# UI 集成测试
npm run smoke:ui
```

### Smoke 覆盖场景
- ✅ 年龄边界不符失败（R001）
- ✅ 满员进入候补并显示顺位（R004）
- ✅ 取消正式名额后候补自动转正并生成通知（R005）
- ✅ 容量调低进入异常待处理（R007）
- ✅ 顾问试图绕过规则失败（R006）
- ✅ 刷新后收藏、候补、通知和异常状态仍可复查（localStorage 持久化）

## 目录结构
```
src/
├── store.js            # 核心数据层 + 测试数据
├── rulesEngine.js      # 统一规则引擎 enforceRules
├── context.jsx         # React Context 全局状态
├── components/         # 可复用组件
├── views/              # 各角色视图
├── App.jsx             # 主入口
├── main.jsx            # React 挂载
└── index.css           # 全局样式
```
