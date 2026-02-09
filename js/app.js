// ========================================
// D-Day 카운터 - 메인 로직
// ========================================

class DdayApp {
  constructor() {
    this.hideLoader();
    this.events = this.loadFromStorage('events', []);
    this.sortMode = 'closest'; // 'closest', 'farthest', 'recent'
    this.editingId = null;

    this.init();
  }

  hideLoader() {
    window.addEventListener('load', () => {
      const loader = document.getElementById('app-loader');
      if (loader) {
        loader.classList.add('hidden');
        setTimeout(() => loader.remove(), 300);
      }
    });
  }

  init() {
    this.renderEvents();
    this.renderStats();
    this.renderMiniCalendar();
    this.setupEventListeners();
    this.setupTheme();
  }

  // Mini Calendar View
  renderMiniCalendar() {
    const container = document.getElementById('miniCalendar');
    if (!container) return;

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const today = now.getDate();

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Event dates this month
    const eventDates = {};
    this.events.forEach(ev => {
      const d = new Date(ev.repeat ? this.getRepeatDate(ev.date) : ev.date);
      if (d.getFullYear() === year && d.getMonth() === month) {
        eventDates[d.getDate()] = ev.category;
      }
    });

    const monthNames = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
    const dayNames = ['일','월','화','수','목','금','토'];

    let html = `<div class="cal-header">${year}년 ${monthNames[month]}</div>`;
    html += '<div class="cal-grid">';
    dayNames.forEach(d => { html += `<div class="cal-day-name">${d}</div>`; });

    for (let i = 0; i < firstDay; i++) {
      html += '<div class="cal-cell empty"></div>';
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const isToday = d === today ? ' cal-today' : '';
      const hasEvent = eventDates[d] ? ` cal-event cal-${eventDates[d]}` : '';
      html += `<div class="cal-cell${isToday}${hasEvent}">${d}</div>`;
    }

    html += '</div>';
    container.innerHTML = html;
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
            <button class="action-btn edit" onclick="app.editEvent(${event.id})" title="수정">
              ✏️
            </button>
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
    return `${year}.${String(month).padStart(2, '0')}.${String(day).padStart(2, '0')}`;
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
    document.querySelector('.form-title').textContent = '이벤트 추가';
    this.editingId = null;
  }

  // 이벤트 편집
  editEvent(id) {
    const event = this.events.find(e => e.id === id);
    if (!event) return;

    this.editingId = id;

    document.getElementById('eventName').value = event.name;
    document.getElementById('eventDate').value = event.date;
    document.getElementById('eventCategory').value = event.category;
    document.getElementById('eventRepeat').checked = event.repeat || false;

    document.querySelector('.form-title').textContent = '이벤트 수정';

    const formSection = document.getElementById('formSection');
    formSection.classList.remove('hidden');
    formSection.scrollIntoView({ behavior: 'smooth' });
  }

  // 전면 광고 표시
  showInterstitialAd() {
    return new Promise((resolve) => {
      const overlay = document.getElementById('interstitialAd');
      const closeBtn = document.getElementById('closeAdBtn');
      const countdown = document.getElementById('adCountdown');

      overlay.classList.remove('hidden');
      closeBtn.disabled = true;
      let seconds = 5;
      countdown.textContent = seconds;

      const timer = setInterval(() => {
        seconds--;
        countdown.textContent = seconds;
        if (seconds <= 0) {
          clearInterval(timer);
          closeBtn.disabled = false;
          closeBtn.textContent = '닫기';
        }
      }, 1000);

      closeBtn.addEventListener('click', () => {
        overlay.classList.add('hidden');
        closeBtn.disabled = true;
        countdown.textContent = '5';
        resolve();
      }, { once: true });
    });
  }

  // 프리미엄 콘텐츠
  async showPremiumContent() {
    if (this.events.length === 0) {
      alert('먼저 이벤트를 추가해주세요.');
      return;
    }

    await this.showInterstitialAd();

    const premiumBody = document.getElementById('premiumBody');

    // 이벤트 분석
    const upcomingEvents = this.events
      .map(e => ({
        ...e,
        days: this.calculateDday(e.repeat ? this.getRepeatDate(e.date) : e.date)
      }))
      .filter(e => e.days >= 0)
      .sort((a, b) => a.days - b.days);

    const passedEvents = this.events
      .map(e => ({
        ...e,
        days: this.calculateDday(e.date)
      }))
      .filter(e => e.days < 0);

    const nearest = upcomingEvents[0];
    const categoryCount = {};
    this.events.forEach(e => {
      categoryCount[e.category] = (categoryCount[e.category] || 0) + 1;
    });

    const mostCategory = Object.entries(categoryCount).sort((a, b) => b[1] - a[1])[0];

    const tips = [
      '목표까지 남은 날을 주 단위로 나누면 계획을 세우기 더 쉬워집니다.',
      '중요한 이벤트 1주 전에 미리 체크리스트를 만들어보세요.',
      'D-Day까지 매일 작은 준비를 하면 마지막에 여유를 가질 수 있습니다.',
      '지난 이벤트를 돌아보면서 다음에는 더 나은 준비를 할 수 있습니다.',
      '반복 이벤트를 설정하면 매년 중요한 날을 놓치지 않을 수 있습니다.'
    ];

    premiumBody.innerHTML = `
      ${nearest ? `
        <div class="premium-highlight">
          <h3>가장 가까운 이벤트</h3>
          <div class="premium-dday-card">
            <span class="premium-dday-value">${this.formatDday(nearest.days)}</span>
            <span class="premium-dday-name">${nearest.name}</span>
            <span class="premium-dday-date">${this.formatDate(nearest.repeat ? this.getRepeatDate(nearest.date) : nearest.date)}</span>
          </div>
          ${nearest.days > 0 ? `
            <p class="premium-weeks">약 <strong>${Math.ceil(nearest.days / 7)}주</strong> 남았습니다 (${nearest.days}일)</p>
          ` : '<p class="premium-today">오늘이 바로 그 날입니다!</p>'}
        </div>
      ` : ''}

      <div class="premium-analysis-item">
        <h3>이벤트 통계</h3>
        <p>전체: ${this.events.length}개 / 다가오는: ${upcomingEvents.length}개 / 지난: ${passedEvents.length}개</p>
        ${mostCategory ? `<p>가장 많은 카테고리: ${this.getCategoryEmoji(mostCategory[0])} ${this.getCategoryName(mostCategory[0])} (${mostCategory[1]}개)</p>` : ''}
      </div>

      <div class="premium-analysis-item">
        <h3>AI 시간 관리 팁</h3>
        <p>${tips[Math.floor(Math.random() * tips.length)]}</p>
      </div>

      ${upcomingEvents.length > 1 ? `
        <div class="premium-analysis-item">
          <h3>다가오는 이벤트 타임라인</h3>
          <div class="premium-timeline">
            ${upcomingEvents.slice(0, 5).map(e => `
              <div class="timeline-item">
                <span class="timeline-dday">${this.formatDday(e.days)}</span>
                <span class="timeline-name">${this.getCategoryEmoji(e.category)} ${e.name}</span>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
    `;

    document.getElementById('premiumModal').classList.remove('hidden');
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

    // 프리미엄 버튼
    document.getElementById('premiumBtn').addEventListener('click', () => {
      this.showPremiumContent();
    });

    // 프리미엄 모달 닫기
    document.getElementById('closePremiumBtn').addEventListener('click', () => {
      document.getElementById('premiumModal').classList.add('hidden');
    });
  }
}

// 앱 초기화
const app = new DdayApp();

// Service Worker 등록
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .then((reg) => console.log('SW registered:', reg.scope))
      .catch((err) => console.log('SW registration failed:', err));
  });
}

// PWA 설치 프롬프트
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
});
