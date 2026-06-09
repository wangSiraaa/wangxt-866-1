// ============================================================
// 青少年活动中心 - 核心数据层 (src/store.js)
// 含：测试数据、领域对象、基础工具函数
// 所有数据持久化到 localStorage，刷新后可复查
// ============================================================

const STORAGE_KEY = 'yac_state_v1';

// ============================================================
// 基础工具函数
// ============================================================

export function calculateAge(birthDateStr) {
  if (!birthDateStr) return 0;
  const today = new Date();
  const birth = new Date(birthDateStr);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age >= 0 ? age : 0;
}

export function isAgeEligible(age, course) {
  if (!course) return false;
  const min = course.minAge ?? 0;
  const max = course.maxAge ?? 99;
  return age >= min && age <= max;
}

export function hasAvailableSeats(course) {
  if (!course) return false;
  return (course.totalSeats ?? 0) - (course.enrolled ?? 0) > 0;
}

export function getSeatsRemaining(course) {
  if (!course) return 0;
  return Math.max(0, (course.totalSeats ?? 0) - (course.enrolled ?? 0));
}

function timeOverlap(s1, e1, s2, e2) {
  return !(e1 <= s2 || e2 <= s1);
}

// ============================================================
// 儿童档案 (4+ 儿童，含年龄边界)
// ============================================================

const CHILDREN_DATA = [
  {
    id: 'ch_xm',
    name: '小明',
    gender: '男',
    birthDate: '2017-03-15',
    parentName: '王先生',
    phone: '13800000001',
    tags: ['活泼', '喜欢运动'],
    allergies: '花生',
    medical: ''
  },
  {
    id: 'ch_xh',
    name: '小红',
    gender: '女',
    birthDate: '2012-07-20',
    parentName: '李女士',
    phone: '13800000002',
    tags: ['文静', '绘画天赋'],
    allergies: '',
    medical: '轻度哮喘'
  },
  {
    id: 'ch_xg',
    name: '小刚',
    gender: '男',
    birthDate: '2019-11-08',
    parentName: '张先生',
    phone: '13800000003',
    tags: ['音乐爱好者'],
    allergies: '',
    medical: ''
  },
  {
    id: 'ch_xw',
    name: '小华',
    gender: '女',
    birthDate: '2018-05-02',
    parentName: '赵女士',
    phone: '13800000004',
    tags: ['舞蹈基础好'],
    allergies: '海鲜',
    medical: ''
  }
];

// ============================================================
// 课程数据 (8+ 门课程，含满员、年龄边界)
// 注意：enrolled 字段需要和 ENROLLMENTS + WAITLIST 中实际人数一致
// 为了简单，我们后续在初始化时同步
// ============================================================

const COURSE_DATA_RAW = [
  {
    id: 'c_art_01',
    name: '儿童创意美术启蒙班',
    category: '美术',
    minAge: 5,
    maxAge: 8,
    cover: '🎨',
    desc: '通过绘画、手工、拼贴等多种形式，激发孩子的艺术天赋和创造力。',
    teacher: '林老师',
    level: '启蒙',
    price: 1980,
    totalSeats: 6,
    enrolled: 6,
    features: ['小班教学', '材料包含', '作品展览']
  },
  {
    id: 'c_piano_01',
    name: '幼儿钢琴启蒙一对一',
    category: '音乐',
    minAge: 4,
    maxAge: 6,
    cover: '🎹',
    desc: '一对一钢琴教学，从手型、识谱开始，打造音乐基础。',
    teacher: '陈老师（中央音乐学院）',
    level: '入门',
    price: 3600,
    totalSeats: 4,
    enrolled: 4,
    features: ['一对一', '免费练琴', '考级指导']
  },
  {
    id: 'c_basketball_01',
    name: '青少年篮球训练营',
    category: '体育',
    minAge: 10,
    maxAge: 15,
    cover: '🏀',
    desc: '专业篮球教练执教，提升体能、协调性和团队合作精神。',
    teacher: '刘教练（前职业球员）',
    level: '进阶',
    price: 2580,
    totalSeats: 15,
    enrolled: 3,
    features: ['室内场馆', '体能测试', '联赛机会']
  },
  {
    id: 'c_dance_01',
    name: '少儿中国舞基础班',
    category: '舞蹈',
    minAge: 5,
    maxAge: 9,
    cover: '💃',
    desc: '科学的舞蹈训练体系，培养优美体态和艺术气质。',
    teacher: '周老师（北舞硕士）',
    level: '基础',
    price: 2280,
    totalSeats: 12,
    enrolled: 11,
    features: ['形体训练', '考级通道', '演出机会']
  },
  {
    id: 'c_english_01',
    name: '自然拼读英语启蒙',
    category: '语言',
    minAge: 4,
    maxAge: 7,
    cover: '📚',
    desc: 'Phonics 自然拼读法，培养孩子英语阅读和口语表达能力。',
    teacher: 'Emma（外教+中教双师）',
    level: '启蒙',
    price: 2880,
    totalSeats: 10,
    enrolled: 5,
    features: ['双师课堂', '分级读物', '沉浸式环境']
  },
  {
    id: 'c_robot_01',
    name: '乐高机器人编程班',
    category: '科技',
    minAge: 6,
    maxAge: 12,
    cover: '🤖',
    desc: '用乐高积木搭建机器人，学习编程思维和机械原理。',
    teacher: '孙老师（计算机博士）',
    level: '入门',
    price: 3280,
    totalSeats: 8,
    enrolled: 7,
    features: ['乐高教具', '竞赛指导', '作品展示']
  },
  {
    id: 'c_chess_01',
    name: '国际象棋入门班',
    category: '思维',
    minAge: 5,
    maxAge: 12,
    cover: '♟️',
    desc: '培养专注力、逻辑思维和全局观念的经典智力运动。',
    teacher: '吴大师（国家级裁判）',
    level: '入门',
    price: 1680,
    totalSeats: 12,
    enrolled: 2,
    features: ['棋谱教学', '对弈训练', '定级比赛']
  },
  {
    id: 'c_science_01',
    name: '小小科学家实验课',
    category: '科技',
    minAge: 6,
    maxAge: 10,
    cover: '🔬',
    desc: '化学、物理、生物趣味实验，点燃孩子对科学的热情。',
    teacher: '郑博士',
    level: '启蒙',
    price: 2480,
    totalSeats: 10,
    enrolled: 10,
    features: ['实验材料', '安全规范', '实验报告']
  }
];

export const COURSE_DATA = COURSE_DATA_RAW;

// ============================================================
// 班期数据 (3+ 班期，含时间冲突)
// ============================================================

const SESSIONS_DATA = [
  {
    id: 's_art_01_sat',
    courseId: 'c_art_01',
    name: '周六上午班',
    dayOfWeek: '周六',
    startTime: '09:00',
    endTime: '10:30',
    startDate: '2026-06-14',
    endDate: '2026-08-30',
    location: 'A栋302美术教室',
    totalWeeks: 12
  },
  {
    id: 's_piano_01_sun',
    courseId: 'c_piano_01',
    name: '周日上午班',
    dayOfWeek: '周日',
    startTime: '09:00',
    endTime: '10:00',
    startDate: '2026-06-15',
    endDate: '2026-08-31',
    location: 'B栋201钢琴房1',
    totalWeeks: 12
  },
  {
    id: 's_bball_01_sat',
    courseId: 'c_basketball_01',
    name: '周六下午班',
    dayOfWeek: '周六',
    startTime: '15:00',
    endTime: '17:00',
    startDate: '2026-06-14',
    endDate: '2026-08-30',
    location: 'C栋篮球馆',
    totalWeeks: 12
  },
  {
    id: 's_dance_01_sun',
    courseId: 'c_dance_01',
    name: '周日上午班',
    dayOfWeek: '周日',
    startTime: '09:30',
    endTime: '11:00',
    startDate: '2026-06-15',
    endDate: '2026-08-31',
    location: 'A栋205舞蹈厅',
    totalWeeks: 12
  },
  {
    id: 's_robot_01_sat',
    courseId: 'c_robot_01',
    name: '周六上午班',
    dayOfWeek: '周六',
    startTime: '09:00',
    endTime: '10:30',
    startDate: '2026-06-14',
    endDate: '2026-08-30',
    location: 'B栋402创客空间',
    totalWeeks: 12
  }
];

// ============================================================
// 试听预约 (覆盖：时间冲突场景)
// ============================================================

const TRIAL_APPOINTMENTS_INIT = [
  {
    id: 'trial_001',
    childId: 'ch_xm',
    courseId: 'c_art_01',
    sessionId: 's_art_01_sat',
    status: 'completed',
    createdAt: '2026-06-01T10:00:00Z',
    trialDate: '2026-06-07',
    note: '体验良好，已报正式班'
  },
  {
    id: 'trial_002',
    childId: 'ch_xw',
    courseId: 'c_dance_01',
    sessionId: 's_dance_01_sun',
    status: 'scheduled',
    createdAt: '2026-06-05T14:30:00Z',
    trialDate: '2026-06-15',
    note: ''
  }
];

// ============================================================
// 正式报名 (满员课程、年龄边界、重复占位检测)
// 美术班 6/6 满员；钢琴班 4/4 满员；舞蹈班 11/12 紧俏；
// 科学实验 10/10 满员；机器人 7/8 紧俏
// ============================================================

const ENROLLMENTS_INIT = [
  { id: 'enr_01', childId: 'ch_xm',   courseId: 'c_art_01',    sessionId: 's_art_01_sat',   status: 'active', createdAt: '2026-06-01T11:00:00Z', amount: 1980, discountId: null },
  { id: 'enr_02', childId: 'ch_std1', courseId: 'c_art_01',    sessionId: 's_art_01_sat',   status: 'active', createdAt: '2026-05-28T09:00:00Z', amount: 1980, discountId: null, _ghostName: '朵朵' },
  { id: 'enr_03', childId: 'ch_std2', courseId: 'c_art_01',    sessionId: 's_art_01_sat',   status: 'active', createdAt: '2026-05-27T09:00:00Z', amount: 1980, discountId: null, _ghostName: '壮壮' },
  { id: 'enr_04', childId: 'ch_std3', courseId: 'c_art_01',    sessionId: 's_art_01_sat',   status: 'active', createdAt: '2026-05-26T09:00:00Z', amount: 1980, discountId: null, _ghostName: '萌萌' },
  { id: 'enr_05', childId: 'ch_std4', courseId: 'c_art_01',    sessionId: 's_art_01_sat',   status: 'active', createdAt: '2026-05-25T09:00:00Z', amount: 1980, discountId: null, _ghostName: '天天' },
  { id: 'enr_06', childId: 'ch_std5', courseId: 'c_art_01',    sessionId: 's_art_01_sat',   status: 'active', createdAt: '2026-05-24T09:00:00Z', amount: 1980, discountId: null, _ghostName: '贝贝' },

  { id: 'enr_07', childId: 'ch_std6', courseId: 'c_piano_01',  sessionId: 's_piano_01_sun', status: 'active', createdAt: '2026-05-20T09:00:00Z', amount: 3600, discountId: null, _ghostName: '乐乐' },
  { id: 'enr_08', childId: 'ch_std7', courseId: 'c_piano_01',  sessionId: 's_piano_01_sun', status: 'active', createdAt: '2026-05-19T09:00:00Z', amount: 3600, discountId: null, _ghostName: '莹莹' },
  { id: 'enr_09', childId: 'ch_std8', courseId: 'c_piano_01',  sessionId: 's_piano_01_sun', status: 'active', createdAt: '2026-05-18T09:00:00Z', amount: 3600, discountId: null, _ghostName: '琪琪' },
  { id: 'enr_10', childId: 'ch_std9', courseId: 'c_piano_01',  sessionId: 's_piano_01_sun', status: 'active', createdAt: '2026-05-17T09:00:00Z', amount: 3600, discountId: null, _ghostName: '浩浩' },

  { id: 'enr_11', childId: 'ch_xh',   courseId: 'c_basketball_01', sessionId: 's_bball_01_sat', status: 'active', createdAt: '2026-06-02T10:00:00Z', amount: 2580, discountId: 'disc_old' },
  { id: 'enr_12', childId: 'ch_std10',courseId: 'c_basketball_01', sessionId: 's_bball_01_sat', status: 'active', createdAt: '2026-05-15T09:00:00Z', amount: 2580, discountId: null, _ghostName: '强强' },
  { id: 'enr_13', childId: 'ch_std11',courseId: 'c_basketball_01', sessionId: 's_bball_01_sat', status: 'active', createdAt: '2026-05-14T09:00:00Z', amount: 2580, discountId: null, _ghostName: '大毛' },

  { id: 'enr_14', childId: 'ch_xw',   courseId: 'c_dance_01',   sessionId: 's_dance_01_sun',  status: 'active', createdAt: '2026-06-03T10:00:00Z', amount: 2280, discountId: null },
  { id: 'enr_15', childId: 'ch_std12',courseId: 'c_dance_01',   sessionId: 's_dance_01_sun',  status: 'active', createdAt: '2026-05-10T09:00:00Z', amount: 2280, discountId: null, _ghostName: '芊芊' },
  { id: 'enr_16', childId: 'ch_std13',courseId: 'c_dance_01',   sessionId: 's_dance_01_sun',  status: 'active', createdAt: '2026-05-09T09:00:00Z', amount: 2280, discountId: null, _ghostName: '依依' },
  { id: 'enr_17', childId: 'ch_std14',courseId: 'c_dance_01',   sessionId: 's_dance_01_sun',  status: 'active', createdAt: '2026-05-08T09:00:00Z', amount: 2280, discountId: null, _ghostName: '诗诗' },
  { id: 'enr_18', childId: 'ch_std15',courseId: 'c_dance_01',   sessionId: 's_dance_01_sun',  status: 'active', createdAt: '2026-05-07T09:00:00Z', amount: 2280, discountId: null, _ghostName: '萱萱' },
  { id: 'enr_19', childId: 'ch_std16',courseId: 'c_dance_01',   sessionId: 's_dance_01_sun',  status: 'active', createdAt: '2026-05-06T09:00:00Z', amount: 2280, discountId: null, _ghostName: '月月' },
  { id: 'enr_20', childId: 'ch_std17',courseId: 'c_dance_01',   sessionId: 's_dance_01_sun',  status: 'active', createdAt: '2026-05-05T09:00:00Z', amount: 2280, discountId: null, _ghostName: '甜甜' },
  { id: 'enr_21', childId: 'ch_std18',courseId: 'c_dance_01',   sessionId: 's_dance_01_sun',  status: 'active', createdAt: '2026-05-04T09:00:00Z', amount: 2280, discountId: null, _ghostName: '晴晴' },
  { id: 'enr_22', childId: 'ch_std19',courseId: 'c_dance_01',   sessionId: 's_dance_01_sun',  status: 'active', createdAt: '2026-05-03T09:00:00Z', amount: 2280, discountId: null, _ghostName: '可可' },
  { id: 'enr_23', childId: 'ch_std20',courseId: 'c_dance_01',   sessionId: 's_dance_01_sun',  status: 'active', createdAt: '2026-05-02T09:00:00Z', amount: 2280, discountId: null, _ghostName: '朵朵2' },
  { id: 'enr_24', childId: 'ch_std21',courseId: 'c_dance_01',   sessionId: 's_dance_01_sun',  status: 'active', createdAt: '2026-05-01T09:00:00Z', amount: 2280, discountId: null, _ghostName: '妞妞' },

  { id: 'enr_25', childId: 'ch_xg',   courseId: 'c_robot_01',   sessionId: 's_robot_01_sat',  status: 'active', createdAt: '2026-06-04T10:00:00Z', amount: 3280, discountId: null },
  { id: 'enr_26', childId: 'ch_std22',courseId: 'c_robot_01',   sessionId: 's_robot_01_sat',  status: 'active', createdAt: '2026-04-28T09:00:00Z', amount: 3280, discountId: null, _ghostName: '丁丁' },
  { id: 'enr_27', childId: 'ch_std23',courseId: 'c_robot_01',   sessionId: 's_robot_01_sat',  status: 'active', createdAt: '2026-04-27T09:00:00Z', amount: 3280, discountId: null, _ghostName: '当当' },
  { id: 'enr_28', childId: 'ch_std24',courseId: 'c_robot_01',   sessionId: 's_robot_01_sat',  status: 'active', createdAt: '2026-04-26T09:00:00Z', amount: 3280, discountId: null, _ghostName: '铛铛' },
  { id: 'enr_29', childId: 'ch_std25',courseId: 'c_robot_01',   sessionId: 's_robot_01_sat',  status: 'active', createdAt: '2026-04-25T09:00:00Z', amount: 3280, discountId: null, _ghostName: '咚咚' },
  { id: 'enr_30', childId: 'ch_std26',courseId: 'c_robot_01',   sessionId: 's_robot_01_sat',  status: 'active', createdAt: '2026-04-24T09:00:00Z', amount: 3280, discountId: null, _ghostName: '隆隆' },
  { id: 'enr_31', childId: 'ch_std27',courseId: 'c_robot_01',   sessionId: 's_robot_01_sat',  status: 'active', createdAt: '2026-04-23T09:00:00Z', amount: 3280, discountId: null, _ghostName: '嘟嘟' },

  { id: 'enr_32', childId: 'ch_std28',courseId: 'c_science_01', sessionId: null,                 status: 'active', createdAt: '2026-04-20T09:00:00Z', amount: 2480, discountId: null, _ghostName: '小爱因斯坦' },
  { id: 'enr_33', childId: 'ch_std29',courseId: 'c_science_01', sessionId: null,                 status: 'active', createdAt: '2026-04-19T09:00:00Z', amount: 2480, discountId: null, _ghostName: '小牛顿' },
  { id: 'enr_34', childId: 'ch_std30',courseId: 'c_science_01', sessionId: null,                 status: 'active', createdAt: '2026-04-18T09:00:00Z', amount: 2480, discountId: null, _ghostName: '小爱迪生' },
  { id: 'enr_35', childId: 'ch_std31',courseId: 'c_science_01', sessionId: null,                 status: 'active', createdAt: '2026-04-17T09:00:00Z', amount: 2480, discountId: null, _ghostName: '小伽利略' },
  { id: 'enr_36', childId: 'ch_std32',courseId: 'c_science_01', sessionId: null,                 status: 'active', createdAt: '2026-04-16T09:00:00Z', amount: 2480, discountId: null, _ghostName: '小霍金' },
  { id: 'enr_37', childId: 'ch_std33',courseId: 'c_science_01', sessionId: null,                 status: 'active', createdAt: '2026-04-15T09:00:00Z', amount: 2480, discountId: null, _ghostName: '小居里' },
  { id: 'enr_38', childId: 'ch_std34',courseId: 'c_science_01', sessionId: null,                 status: 'active', createdAt: '2026-04-14T09:00:00Z', amount: 2480, discountId: null, _ghostName: '小特斯拉' },
  { id: 'enr_39', childId: 'ch_std35',courseId: 'c_science_01', sessionId: null,                 status: 'active', createdAt: '2026-04-13T09:00:00Z', amount: 2480, discountId: null, _ghostName: '小达尔文' },
  { id: 'enr_40', childId: 'ch_std36',courseId: 'c_science_01', sessionId: null,                 status: 'active', createdAt: '2026-04-12T09:00:00Z', amount: 2480, discountId: null, _ghostName: '小孟德尔' },
  { id: 'enr_41', childId: 'ch_std37',courseId: 'c_science_01', sessionId: null,                 status: 'active', createdAt: '2026-04-11T09:00:00Z', amount: 2480, discountId: null, _ghostName: '小诺贝尔' }
];

// ============================================================
// 候补队列 (覆盖：多人队列 + 年龄不符合的 + 顺位)
// ============================================================

const WAITLIST_INIT = [
  { id: 'wl_01', childId: 'ch_std38', courseId: 'c_art_01',   sessionId: 's_art_01_sat',   status: 'waiting', createdAt: '2026-06-05T08:00:00Z', position: 1, _ghostName: '候补-圆圆', _ghostAge: 6 },
  { id: 'wl_02', childId: 'ch_std39', courseId: 'c_art_01',   sessionId: 's_art_01_sat',   status: 'waiting', createdAt: '2026-06-05T09:30:00Z', position: 2, _ghostName: '候补-星星', _ghostAge: 7 },
  { id: 'wl_03', childId: 'ch_std40', courseId: 'c_art_01',   sessionId: 's_art_01_sat',   status: 'waiting', createdAt: '2026-06-05T11:00:00Z', position: 3, _ghostName: '候补-月月', _ghostAge: 5 },
  { id: 'wl_04', childId: 'ch_std41', courseId: 'c_art_01',   sessionId: 's_art_01_sat',   status: 'waiting', createdAt: '2026-06-06T08:00:00Z', position: 4, _ghostName: '候补-阳阳', _ghostAge: 8 },
  { id: 'wl_05', childId: 'ch_std42', courseId: 'c_art_01',   sessionId: 's_art_01_sat',   status: 'waiting', createdAt: '2026-06-06T10:00:00Z', position: 5, _ghostName: '候补-晨晨', _ghostAge: 6 },
  { id: 'wl_06', childId: 'ch_std43', courseId: 'c_piano_01', sessionId: 's_piano_01_sun', status: 'waiting', createdAt: '2026-06-02T10:00:00Z', position: 1, _ghostName: '候补-淼淼', _ghostAge: 5 },
  { id: 'wl_07', childId: 'ch_std44', courseId: 'c_piano_01', sessionId: 's_piano_01_sun', status: 'waiting', createdAt: '2026-06-03T10:00:00Z', position: 2, _ghostName: '候补-萌萌', _ghostAge: 4 },
  { id: 'wl_08', childId: 'ch_std45', courseId: 'c_science_01', sessionId: null,              status: 'waiting', createdAt: '2026-06-04T10:00:00Z', position: 1, _ghostName: '候补-小科学', _ghostAge: 8 },
  { id: 'wl_09', childId: 'ch_std46', courseId: 'c_science_01', sessionId: null,              status: 'waiting', createdAt: '2026-06-04T11:00:00Z', position: 2, _ghostName: '候补-小实验', _ghostAge: 7 },
  { id: 'wl_10', childId: 'ch_std47', courseId: 'c_dance_01', sessionId: 's_dance_01_sun',  status: 'waiting', createdAt: '2026-06-05T10:00:00Z', position: 1, _ghostName: '候补-小舞者', _ghostAge: 6 }
];

// ============================================================
// 优惠资格
// ============================================================

const DISCOUNTS_INIT = [
  {
    id: 'disc_old',
    name: '老学员续费9折',
    type: 'percent',
    value: 10,
    criteria: '历史报名学员',
    applicableChildIds: ['ch_xh', 'ch_xm']
  },
  {
    id: 'disc_multi',
    name: '多科目连报立减300',
    type: 'amount',
    value: 300,
    criteria: '同时报2门及以上',
    applicableChildIds: ['ch_xw', 'ch_xg']
  },
  {
    id: 'disc_sibling',
    name: '兄弟姐妹同报立减500',
    type: 'amount',
    value: 500,
    criteria: '兄弟姐妹2人以上同时报名',
    applicableChildIds: []
  }
];

// ============================================================
// 顾问备注 (初始：小明已经有备注)
// ============================================================

const CONSULTANT_NOTES_INIT = [
  {
    id: 'note_01',
    childId: 'ch_xm',
    consultantId: 'adv_li',
    consultantName: '李顾问',
    content: '家长非常关注体能类课程，小明之前练习过跆拳道，篮球课应该很适合。但要注意小明对花生过敏，需要提醒场馆。',
    createdAt: '2026-06-02T14:20:00Z',
    followUp: '本周内联系篮球教练试训安排'
  },
  {
    id: 'note_02',
    childId: 'ch_xh',
    consultantId: 'adv_li',
    consultantName: '李顾问',
    content: '小红有绘画基础，家长希望走专业路线，已推荐高级美术班，同时考虑让小红参加篮球增加体能。',
    createdAt: '2026-06-03T09:15:00Z',
    followUp: null
  }
];

// ============================================================
// 通知 (初始一些通知)
// ============================================================

const NOTIFICATIONS_INIT = [
  {
    id: 'notif_01',
    targetRole: 'parent',
    targetChildIds: ['ch_xm'],
    type: 'enrollment_success',
    title: '🎨 报名成功：儿童创意美术启蒙班',
    content: '小明已成功报名【儿童创意美术启蒙班-周六上午班】。开课时间：2026-06-14 09:00，地点：A栋302美术教室。',
    read: true,
    createdAt: '2026-06-01T11:05:00Z',
    actionLink: null
  },
  {
    id: 'notif_02',
    targetRole: 'parent',
    targetChildIds: ['ch_xw'],
    type: 'trial_scheduled',
    title: '💃 试听课已预约：少儿中国舞基础班',
    content: '小华的【少儿中国舞基础班】试听课已安排在 2026-06-15（周日）上午 09:30，请准时到达 A栋205舞蹈厅。',
    read: false,
    createdAt: '2026-06-05T14:35:00Z',
    actionLink: null
  },
  {
    id: 'notif_03',
    targetRole: 'admin',
    type: 'waitlist_alert',
    title: '⚠️ 候补预警：美术班候补人数已达5人',
    content: '儿童创意美术启蒙班目前候补队列共 5 人等待，建议考虑增加班期或扩容。',
    read: false,
    createdAt: '2026-06-07T08:00:00Z',
    actionLink: { view: 'admin', focus: 'c_art_01' }
  }
];

// ============================================================
// 收藏 (初始：小刚收藏了英语和科学)
// ============================================================

const FAVORITES_INIT = {
  'ch_xm': ['c_basketball_01', 'c_chess_01'],
  'ch_xh': ['c_art_01', 'c_dance_01'],
  'ch_xg': ['c_english_01', 'c_science_01'],
  'ch_xw': ['c_dance_01', 'c_piano_01']
};

// ============================================================
// 筛选条件 (刷新保留)
// ============================================================

const FILTERS_INIT = {
  category: null,
  ageRange: null,
  priceRange: null,
  hasSeatsOnly: false,
  searchText: '',
  sortBy: 'recommended'
};

// ============================================================
// 看板分组配置
// ============================================================

export const KANBAN_GROUP_OPTIONS = [
  { key: 'none', label: '不分栏（网格）', icon: '⊞' },
  { key: 'category', label: '按分类分栏', icon: '📂' },
  { key: 'ageStatus', label: '按适龄状态分栏', icon: '🎂' },
  { key: 'seatStatus', label: '按名额状态分栏', icon: '👥' },
  { key: 'level', label: '按难度等级分栏', icon: '📈' }
];

export const KANBAN_GROUP_INIT = {
  enabled: false,
  groupBy: 'category',
  collapsedGroups: {}
};

// ============================================================
// 本地审计日志
// ============================================================

const AUDIT_LOG_INIT = [
  {
    id: 'audit_01',
    timestamp: '2026-06-01T11:00:00Z',
    actor: 'parent_wang',
    actorRole: 'parent',
    action: 'ENROLL_CREATE',
    targetType: 'enrollment',
    targetId: 'enr_01',
    detail: { child: 'ch_xm', course: 'c_art_01', session: 's_art_01_sat', amount: 1980 },
    result: 'success',
    ruleCheck: ['R001:OK', 'R002:OK', 'R003:OK', 'R004:OK(seats=6→5)']
  },
  {
    id: 'audit_02',
    timestamp: '2026-06-02T10:00:00Z',
    actor: 'parent_li',
    actorRole: 'parent',
    action: 'ENROLL_CREATE',
    targetType: 'enrollment',
    targetId: 'enr_11',
    detail: { child: 'ch_xh', course: 'c_basketball_01', session: 's_bball_01_sat', amount: 2580, discountId: 'disc_old' },
    result: 'success',
    ruleCheck: ['R001:OK(age=13,range=10-15)', 'R002:OK', 'R003:OK', 'R004:OK(seats=15→14)']
  },
  {
    id: 'audit_03',
    timestamp: '2026-06-05T08:00:00Z',
    actor: 'system',
    actorRole: 'system',
    action: 'NOTIF_PUSH',
    targetType: 'notification',
    targetId: 'notif_03',
    detail: { course: 'c_art_01', waitlistCount: 5 },
    result: 'success',
    ruleCheck: ['SYSTEM']
  }
];

// ============================================================
// 异常待处理 (初始空)
// ============================================================

const ANOMALIES_INIT = [
  // { id, sessionId, courseId, type: 'capacity_overflow', detail: { originalCapacity, newCapacity, overflowCount, overflowIds }, status: 'pending', createdAt, resolvedAt, resolution }
];

// ============================================================
// 默认初始状态
// ============================================================

export function getInitialState() {
  return {
    role: 'parent',
    currentUserId: 'parent_wang',
    currentUserName: '王先生（家长）',

    children: CHILDREN_DATA,
    courses: COURSE_DATA_RAW.map(c => ({ ...c })),
    sessions: SESSIONS_DATA,
    trials: TRIAL_APPOINTMENTS_INIT,
    enrollments: ENROLLMENTS_INIT,
    waitlist: WAITLIST_INIT,
    discounts: DISCOUNTS_INIT,
    consultantNotes: CONSULTANT_NOTES_INIT,
    notifications: NOTIFICATIONS_INIT,
    favorites: { ...FAVORITES_INIT },
    filters: { ...FILTERS_INIT },
    kanbanGroup: { ...KANBAN_GROUP_INIT },
    auditLog: AUDIT_LOG_INIT,
    anomalies: ANOMALIES_INIT,

    selectedChildId: 'ch_xm',
    ghostChildren: generateGhostChildrenMap(ENROLLMENTS_INIT, WAITLIST_INIT)
  };
}

// 生成 ghost 儿童映射（用于烟雾测试中展示的虚拟儿童）
function generateGhostChildrenMap(enrollments, waitlist) {
  const map = {};
  enrollments.forEach(e => {
    if (e._ghostName) {
      map[e.childId] = {
        id: e.childId,
        name: e._ghostName,
        _ghost: true,
        birthDate: '2018-01-01'
      };
    }
  });
  waitlist.forEach(w => {
    if (w._ghostName) {
      map[w.childId] = {
        id: w.childId,
        name: w._ghostName,
        _ghost: true,
        birthDate: w._ghostAge ? `${2026 - w._ghostAge}-06-01` : '2018-01-01'
      };
    }
  });
  return map;
}

// ============================================================
// 持久化：加载 / 保存
// ============================================================

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // 合并默认字段（防止老版本缺字段）
      const base = getInitialState();
      return { ...base, ...parsed };
    }
  } catch (e) {
    console.warn('[store] loadState failed, using init state:', e);
  }
  return getInitialState();
}

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (e) {
    console.warn('[store] saveState failed:', e);
    return false;
  }
}

export function clearPersistedState() {
  localStorage.removeItem(STORAGE_KEY);
}

// ============================================================
// 工具：根据 courseId 计算实际已报名人数（通过 enrollments 统计）
// ============================================================
export function countEnrollmentsByCourse(enrollments, courseId, status = 'active') {
  return enrollments.filter(e => e.courseId === courseId && e.status === status).length;
}

export function countWaitlistByCourse(waitlist, courseId, status = 'waiting') {
  return waitlist.filter(w => w.courseId === courseId && w.status === status).length;
}

export function timeOverlapSession(sessionA, sessionB) {
  if (!sessionA || !sessionB) return false;
  if (sessionA.dayOfWeek !== sessionB.dayOfWeek) return false;
  return timeOverlap(sessionA.startTime, sessionA.endTime, sessionB.startTime, sessionB.endTime);
}

export { timeOverlap };
