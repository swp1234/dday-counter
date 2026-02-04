// ========================================
// D-Day 카운터 - 메인 로직
// ========================================

class DdayApp {
  constructor() {
    this.events = this.loadFromStorage('events', []);
    this.sortMode = 'closest'; // 'closest', 'farthest', 'recent'
    this.editingId = null;

    this.init();
  }

  init() {
    this.renderEvents();
    this.renderStats();
    this.setupEventListeners();
    this.setupTheme();
  }

  // LocalStorage 관리
  loadFromStorage(key, defaultValue) {
    try {
      const data = localStorage.getItem(`dday_${key}`);
      return data ? JSON.parse(data) : defaultValue;
    } catch (e) {
      console.error('Storage load error:', e);
      return defaultValue;
    }
  }

  saveToStorage(key, value) {
    try {
      localStorage.setItem(`dday_${key}`, JSON.stringify(value));
    } catch (e) {
      console.error('Storage save error:', e);
    }
  }

  // D-Day 계산
  calculateDday(targetDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const target = new Date(targetDate);
    target.setHours(0, 0, 0, 0);

    const diffTime = target - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays;
  }

  // D-Day 텍스트 포맷
  formatDday(days) {
    if (days === 0) return 'D-Day';
    if (days > 0) return `D-${days}`;
    return `D+${Math.abs(days)}`;
  }

  // 이벤트 추가/수정
  saveEvent(eventData) {
    if (this.editingId) {
      // 수정
      const index = this.events.findIndex(e => e.id === this.editingId);
      if (index > -1) {
        this.events[index] = {
          ...eventData,
          id: this.editingId
        };
      }
      this.editingId = null;
    } else {
      // 추가
      const newEvent = {
        ...eventData,
        id: Date.now(),
        createdAt: Date.now()
      };
      this.events.push(newEvent);
    }

    this.saveToStorage('events', this.events);
    this.renderEvents();
    this.renderStats();
    this.hideForm();
  }

  // 반복 이벤트 날짜 계산
  getRepeatDate(originalDate) {
    const today = new Date();
    const thisYear = today.getFullYear();
    const eventDate = new Date(originalDate);

    // 올해 날짜로 변경
    const thisYearDate = new Date(thisYear, eventDate.getMonth(), eventDate.getDate());

    // 올해 날짜가 이미 지났으면 내년 날짜 반환
    if (thisYearDate < today) {
      return new Date(thisYear + 1, eventDate.getMonth(), eventDate.getDate()).toISOString().split('T')[0];
    }

    return thisYearDate.toISOString().split('T')[0];
  }

  // 이벤트 삭제
  deleteEvent(id) {
    if (confirm('이 이벤트를 삭제하시겠습니까?')) {
      this.events = this.events.filter(e => e.id !== id);
      this.saveToStorage('events', this.events);
      this.renderEvents();
      this.renderStats();
    }
  }

  // 이벤트 정렬
  sortEvents(events) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    switch (this.sortMode) {
      case 'closest':
        // 가까운 순 (미래 이벤트 우선, D-Day 기준 오름차순)
        return events.sort((a, b) => {
          const daysA = this.calculateDday(a.date);
          const daysB = this.calculateDday(b.date);

          // 미래 이벤트끼리는 가까운 순
          if (daysA >= 0 && daysB >= 0) {
            return daysA - daysB;
          }
          // 과거 이벤트끼리는 최근 순
          if (daysA < 0 && daysB < 0) {
            return daysB - daysA;
          }
          // 미래 이벤트가 과거 이벤트보다 먼저
          return daysB - daysA;
        });

      case 'farthest':
        // 먼 순 (역순)
        return events.sort((a, b) => {
          const daysA = this.calculateDday(a.date);
          const daysB = this.calculateDday(b.date);
          return daysA - daysB;
        }).reverse();

      case 'recent':
        // 최근 추가 순
        return events.sort((a, b) => b.createdAt - a.createdAt);

      default:
        return events;
    }
  }

  // 이벤트 렌더링
  renderEvents() {
    const container = document.getElementById('eventsContainer');

    if (this.events.length === 0) {
      container.innerHTML = '<p class="empty-message">아직 등록된 이벤트가 없습니다.<br>새 이벤트를 추가해보세요!</p>';
      return;
    }

    const sortedEvents = this.sortEvents([...this.events]);

    container.innerHTML = sortedEvents.map(event => {
      // 반복 이벤트인 경우 날짜 재계산
      const targetDate = event.repeat ? this.getRepeatDate(event.date) : event.date;

      const days = this.calculateDday(targetDate);
      const ddayText = this.formatDday(days);
      const categoryEmoji = this.getCategoryEmoji(event.category);
      const categoryName = this.getCategoryName(event.category);

      let ddayClass = '';
      if (days === 0) ddayClass = 'today';
      else if (days < 0) ddayClass = 'passed';

      const repeatBadge = event.repeat ? ' 🔁' : '';

      return `
        <div class="event-card ${event.category}">
          <div class="event-dday">
            <div class="dday-label">남은 날짜</div>
            <div class="dday-value ${ddayClass}">${ddayText}</div>
          </div>
          <div class="event-info">
            <div class="event-name">${event.name}${repeatBadge}</div>
            <div class="event-details">
              <span class="event-category">
                ${categoryEmoji} ${categoryName}
              </span>
              <span class="event-date">
                📅 ${this.formatDate(targetDate)}
              </span>
            </div>
          </div>
          <div class="event-actions">
            <button class="action-btn delete" onclick="app.deleteEvent(${event.id})" title="삭제">
              🗑️
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  // 카테고리 이모지
  getCategoryEmoji(category) {
    const emojis = {
      birthday: '🎂',
      anniversary: '💝',
      exam: '📝',
      travel: '✈️',
      work: '💼',
      other: '📌'
    };
    return emojis[category] || '📌';
  }

  // 카테고리 이름
  getCategoryName(category) {
    const names = {
      birthday: '생일',
      anniversary: '기념일',
      exam: '시험',
      travel: '여행',
      work: '업무',
      other: '기타'
    };
    return names[category] || '기타';
  }

  // 날짜 포맷
  formatDate(dateStr) {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${year}.${month}.${day}`;
  }

  // 통계 렌더링
  renderStats() {
    const total = this.events.length;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcoming = this.events.filter(e => {
      const days = this.calculateDday(e.date);
      return days >= 0;
    }).length;

    const passed = total - upcoming;

    document.getElementById('totalEvents').textContent = total;
    document.getElementById('upcomingEvents').textContent = upcoming;
    document.getElementById('passedEvents').textContent = passed;
  }

  // 정렬 모드 변경
  changeSortMode(mode) {
    this.sortMode = mode;

    document.querySelectorAll('.sort-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.sort === mode);
    });

    this.renderEvents();
  }

  // 폼 표시
  showForm() {
    const formSection = document.getElementById('formSection');
    formSection.classList.remove('hidden');
    formSection.scrollIntoView({ behavior: 'smooth' });

    // 오늘 날짜를 기본값으로 설정
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('eventDate').value = today;
  }

  // 폼 숨기기
  hideForm() {
    const formSection = document.getElementById('formSection');
    formSection.classList.add('hidden');
    document.getElementById('eventForm').reset();
    this.editingId = null;
  }

  // 테마 설정
  setupTheme() {
    const savedTheme = localStorage.getItem('dday_theme') || 'dark';
    if (savedTheme === 'light') {
      document.body.classList.add('light-theme');
      document.getElementById('themeToggle').querySelector('.theme-icon').textContent = '☀️';
    }
  }

  // 테마 토글
  toggleTheme() {
    const body = document.body;
    const themeIcon = document.getElementById('themeToggle').querySelector('.theme-icon');

    body.classList.toggle('light-theme');
    const isLight = body.classList.contains('light-theme');

    themeIcon.textContent = isLight ? '☀️' : '🌙';
    localStorage.setItem('dday_theme', isLight ? 'light' : 'dark');
  }

  // 이벤트 리스너 설정
  setupEventListeners() {
    // 추가 버튼
    document.getElementById('addEventBtn').addEventListener('click', () => {
      this.showForm();
    });

    // 취소 버튼
    document.getElementById('cancelBtn').addEventListener('click', () => {
      this.hideForm();
    });

    // 폼 제출
    document.getElementById('eventForm').addEventListener('submit', (e) => {
      e.preventDefault();

      const eventData = {
        name: document.getElementById('eventName').value,
        date: document.getElementById('eventDate').value,
        category: document.getElementById('eventCategory').value,
        repeat: document.getElementById('eventRepeat').checked
      };

      this.saveEvent(eventData);
    });

    // 정렬 버튼들
    document.querySelectorAll('.sort-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.changeSortMode(btn.dataset.sort);
      });
    });

    // 테마 토글
    document.getElementById('themeToggle').addEventListener('click', () => {
      this.toggleTheme();
    });
  }
}

// 앱 초기화
const app = new DdayApp();

// PWA 설치 프롬프트
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
});
