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
    this.renderCuratedResources();
    this.setupEventListeners();
    this.setupTheme();
  }

  tr(key, fallback) {
    if (window.i18n && typeof window.i18n.t === 'function') {
      const val = window.i18n.t(key);
      if (val && val !== key) return val;
    }
    return fallback;
  }

  onLanguageChange() {
    this.renderEvents();
    this.renderMiniCalendar();
    this.renderCuratedResources();
  }

  escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[ch]));
  }

  showToast(message) {
    let toast = document.getElementById('dday-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'dday-toast';
      toast.className = 'dday-toast';
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('visible');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => toast.classList.remove('visible'), 2200);
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

    const lang = window.i18n?.getCurrentLanguage?.() || navigator.language || 'en';
    const monthName = new Intl.DateTimeFormat(lang, { year: 'numeric', month: 'long' }).format(new Date(year, month));
    const dayNames = Array.from({length: 7}, (_, i) => new Intl.DateTimeFormat(lang, { weekday: 'short' }).format(new Date(2024, 0, i)));

    let html = `<div class="cal-header">${monthName}</div>`;
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
      if (typeof gtag === 'function') {
        const lang = window.i18n?.getCurrentLanguage?.() || 'en';
        gtag('event', 'test_complete', {
          app_name: 'dday-counter',
          result_type: eventData.category || 'other',
          lang
        });
      }
    }

    this.saveToStorage('events', this.events);
    this.renderEvents();
    this.renderStats();
    this.renderMiniCalendar();
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
    if (confirm(window.i18n?.t('messages.confirm') || 'Delete this event?')) {
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

    container.innerHTML = '';

    sortedEvents.forEach(event => {
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

      // 카드 생성
      const card = document.createElement('div');
      card.className = `event-card ${event.category}`;

      // D-Day 정보
      const ddayDiv = document.createElement('div');
      ddayDiv.className = 'event-dday';

      const ddayLabel = document.createElement('div');
      ddayLabel.className = 'dday-label';
      ddayLabel.textContent = '남은 날짜';
      ddayDiv.appendChild(ddayLabel);

      const ddayValue = document.createElement('div');
      ddayValue.className = `dday-value ${ddayClass}`;
      ddayValue.textContent = ddayText;
      ddayDiv.appendChild(ddayValue);
      card.appendChild(ddayDiv);

      // 이벤트 정보
      const infoDiv = document.createElement('div');
      infoDiv.className = 'event-info';

      const nameDiv = document.createElement('div');
      nameDiv.className = 'event-name';
      nameDiv.textContent = event.name + repeatBadge;
      infoDiv.appendChild(nameDiv);

      const detailsDiv = document.createElement('div');
      detailsDiv.className = 'event-details';

      const categorySpan = document.createElement('span');
      categorySpan.className = 'event-category';
      categorySpan.textContent = `${categoryEmoji} ${categoryName}`;
      detailsDiv.appendChild(categorySpan);

      const dateSpan = document.createElement('span');
      dateSpan.className = 'event-date';
      dateSpan.textContent = `📅 ${this.formatDate(targetDate)}`;
      detailsDiv.appendChild(dateSpan);

      infoDiv.appendChild(detailsDiv);
      card.appendChild(infoDiv);

      // 액션 버튼
      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'event-actions';

      const editBtn = document.createElement('button');
      editBtn.className = 'action-btn edit';
      editBtn.title = '수정';
      editBtn.textContent = '✏️';
      editBtn.dataset.id = event.id;
      editBtn.addEventListener('click', () => this.editEvent(event.id));
      actionsDiv.appendChild(editBtn);

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'action-btn delete';
      deleteBtn.title = '삭제';
      deleteBtn.textContent = '🗑️';
      deleteBtn.dataset.id = event.id;
      deleteBtn.addEventListener('click', () => this.deleteEvent(event.id));
      actionsDiv.appendChild(deleteBtn);

      card.appendChild(actionsDiv);
      container.appendChild(card);
    });
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

    if (typeof gtag === 'function') {
      gtag('event', 'test_start', {
        app_name: 'dday-counter',
        lang: window.i18n?.getCurrentLanguage?.() || 'en'
      });
    }
  }

  // 폼 숨기기
  hideForm() {
    const formSection = document.getElementById('formSection');
    formSection.classList.add('hidden');
    document.getElementById('eventForm').reset();
    document.querySelector('.form-title').textContent = this.tr('form.title', 'Add Event');
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

    document.querySelector('.form-title').textContent = this.tr('form.editTitle', 'Edit Event');

    const formSection = document.getElementById('formSection');
    formSection.classList.remove('hidden');
    formSection.scrollIntoView({ behavior: 'smooth' });
  }

  // 전면 광고 제거 및 다이렉트 완료 (구글 정책 준수)
  showInterstitialAd() {
    return Promise.resolve();
  }

  // 일정 인사이트 모달
  async showPremiumContent() {
    if (this.events.length === 0) {
      this.showToast(this.tr('messages.addEventFirst', 'Please add an event first.'));
      return;
    }

    const premiumBody = document.getElementById('premiumBody');
    const premiumModal = document.getElementById('premiumModal');
    if (!premiumBody || !premiumModal) return;

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

    const localeTips = window.i18n?.t?.('premium.tipsList');
    const tips = Array.isArray(localeTips) && localeTips.length > 0 ? localeTips : [
      'Dividing days by weeks makes planning easier.',
      'Create a checklist one week before important events.',
      'Daily small preparations reduce last-minute stress.',
      'Reflect on past events to prepare better next time.',
      'Setting yearly reminders ensures you never miss important dates.'
    ];

    const weeksTpl = this.tr('premium.weeksRemaining', 'About <strong>{weeks} weeks</strong> remaining ({days} days)');
    const weeksHtml = nearest && nearest.days > 0
      ? weeksTpl.replace('{weeks}', Math.ceil(nearest.days / 7)).replace('{days}', nearest.days)
      : '';

    const safeNearestName = nearest ? this.escapeHtml(nearest.name) : '';
    const catLabel = mostCategory
      ? this.tr(`events.categoryNames.${mostCategory[0]}`, this.getCategoryName(mostCategory[0]))
      : '';

    premiumBody.innerHTML = `
      ${nearest ? `
        <div class="premium-highlight">
          <h3>${this.escapeHtml(this.tr('premium.nearestEvent', 'Nearest Event'))}</h3>
          <div class="premium-dday-card">
            <span class="premium-dday-value">${this.escapeHtml(this.formatDday(nearest.days))}</span>
            <span class="premium-dday-name">${safeNearestName}</span>
            <span class="premium-dday-date">${this.escapeHtml(this.formatDate(nearest.repeat ? this.getRepeatDate(nearest.date) : nearest.date))}</span>
          </div>
          ${nearest.days > 0 ? `<p class="premium-weeks">${weeksHtml}</p>` : `<p class="premium-today">${this.escapeHtml(this.tr('premium.today', 'Today is the day!'))}</p>`}
        </div>
      ` : ''}

      <div class="premium-analysis-item">
        <h3>${this.escapeHtml(this.tr('premium.stats', 'Event Statistics'))}</h3>
        <p>${this.escapeHtml(this.tr('premium.total', 'Total'))}: ${this.events.length} / ${this.escapeHtml(this.tr('premium.upcoming', 'Upcoming'))}: ${upcomingEvents.length} / ${this.escapeHtml(this.tr('premium.passed', 'Passed'))}: ${passedEvents.length}</p>
        ${mostCategory ? `<p>${this.escapeHtml(this.tr('premium.mostCategory', 'Most Common Category'))}: ${this.getCategoryEmoji(mostCategory[0])} ${this.escapeHtml(catLabel)} (${mostCategory[1]})</p>` : ''}
      </div>

      <div class="premium-analysis-item">
        <h3>${this.escapeHtml(this.tr('premium.tips', 'Planning Tip'))}</h3>
        <p>${this.escapeHtml(tips[Math.floor(Math.random() * tips.length)])}</p>
      </div>

      ${upcomingEvents.length > 1 ? `
        <div class="premium-analysis-item">
          <h3>${this.escapeHtml(this.tr('premium.timeline', 'Upcoming Events Timeline'))}</h3>
          <div class="premium-timeline">
            ${upcomingEvents.slice(0, 5).map(e => `
              <div class="timeline-item">
                <span class="timeline-dday">${this.escapeHtml(this.formatDday(e.days))}</span>
                <span class="timeline-name">${this.getCategoryEmoji(e.category)} ${this.escapeHtml(e.name)}</span>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
    `;

    premiumModal.classList.remove('hidden');
  }

  // 테마 설정
  setupTheme() {
    const savedTheme = localStorage.getItem('dday_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
      const themeIcon = themeToggle.querySelector('.theme-icon');
      if (themeIcon) {
        themeIcon.textContent = savedTheme === 'light' ? '🌙' : '☀️';
      }
    }
  }

  // 테마 토글
  toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('dday_theme', next);
    
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
      const themeIcon = themeToggle.querySelector('.theme-icon');
      if (themeIcon) {
        themeIcon.textContent = next === 'light' ? '🌙' : '☀️';
      }
    }
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

    // 인사이트 모달 닫기
    document.getElementById('closePremiumBtn')?.addEventListener('click', () => {
      document.getElementById('premiumModal')?.classList.add('hidden');
    });

    document.getElementById('premiumModal')?.addEventListener('click', (e) => {
      if (e.target && e.target.id === 'premiumModal') {
        e.target.classList.add('hidden');
      }
    });

    document.getElementById('saveCardBtn')?.addEventListener('click', () => {
      this.generateStoryCard();
    });

    document.getElementById('shareTwitterBtn')?.addEventListener('click', () => {
      this.shareOnX();
    });

    document.getElementById('shareUrlBtn')?.addEventListener('click', () => {
      this.copyShareUrl();
    });
  }

  getShareUrl() {
    const lang = window.i18n?.getCurrentLanguage?.() || 'en';
    return `${window.location.origin}/dday-counter/?lang=${encodeURIComponent(lang)}&utm_source=share`;
  }

  shareOnX() {
    const url = this.getShareUrl();
    const text = this.tr('share.tweetText', 'Tracking important milestones and countdowns with DopaBrain D-Day Counter.');
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank', 'noopener,noreferrer');
    if (typeof gtag === 'function') {
      gtag('event', 'share', {
        method: 'twitter',
        app_name: 'dday-counter',
        lang: window.i18n?.getCurrentLanguage?.() || 'en'
      });
    }
  }

  async copyShareUrl() {
    const url = this.getShareUrl();
    const copied = this.tr('share.copied', 'Link copied!');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(url);
      } catch (e) {}
    } else {
      const ta = document.createElement('textarea');
      ta.value = url;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (e) {}
      ta.remove();
    }
    this.showToast(copied);
    if (typeof gtag === 'function') {
      gtag('event', 'share', {
        method: 'clipboard',
        app_name: 'dday-counter',
        lang: window.i18n?.getCurrentLanguage?.() || 'en'
      });
    }
  }

  generateStoryCard() {
    const canvas = document.getElementById('shareCanvas');
    const saveBtn = document.getElementById('saveCardBtn');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const lang = window.i18n?.getCurrentLanguage?.() || 'en';
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = this.tr('share.savingCard', 'Creating card...');
    }

    const w = 1080;
    const h = 1920;
    canvas.width = w;
    canvas.height = h;

    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(0.5, '#172554');
    grad.addColorStop(1, '#0c4a6e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = 'rgba(56, 189, 248, 0.14)';
    ctx.beginPath();
    ctx.arc(540, 620, 320, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(540, 620, 250, 0, Math.PI * 2);
    ctx.stroke();

    const upcoming = this.events
      .map((e) => ({
        ...e,
        days: this.calculateDday(e.repeat ? this.getRepeatDate(e.date) : e.date)
      }))
      .filter((e) => e.days >= 0)
      .sort((a, b) => a.days - b.days);

    const nearest = upcoming[0];
    const centerBadgeText = nearest ? this.formatDday(nearest.days) : 'D-Day';

    ctx.textAlign = 'center';
    ctx.fillStyle = '#7dd3fc';
    ctx.font = 'bold 34px system-ui, -apple-system, sans-serif';
    ctx.fillText(this.tr('share.cardBadge', 'DOPABRAIN D-DAY TRACKER'), 540, 170);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 64px system-ui, -apple-system, sans-serif';
    ctx.fillText(this.tr('share.cardTitle', 'D-Day Milestone Card'), 540, 270);

    ctx.fillStyle = '#bae6fd';
    ctx.font = '34px system-ui, -apple-system, sans-serif';
    ctx.fillText(this.tr('share.cardSubtitle', 'Counting down to what matters most'), 540, 330);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 116px system-ui, -apple-system, sans-serif';
    ctx.fillText(centerBadgeText, 540, 650);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(110, 1020, 860, 420, 32);
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#7dd3fc';
    ctx.font = 'bold 28px system-ui, -apple-system, sans-serif';
    ctx.fillText(this.tr('share.cardNearestLabel', 'NEXT MILESTONE'), 175, 1110);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 42px system-ui, -apple-system, sans-serif';
    const nearestTitle = nearest ? `${this.getCategoryEmoji(nearest.category)} ${nearest.name}`.slice(0, 26) : this.tr('share.cardDefaultNearest', 'Plan your upcoming dates');
    ctx.fillText(nearestTitle, 175, 1175);

    ctx.fillStyle = '#7dd3fc';
    ctx.font = 'bold 28px system-ui, -apple-system, sans-serif';
    ctx.fillText(this.tr('share.cardSummaryLabel', 'TRACKING OVERVIEW'), 175, 1295);

    ctx.fillStyle = '#e0f2fe';
    ctx.font = 'bold 42px system-ui, -apple-system, sans-serif';
    ctx.fillText(`${this.tr('stats.totalEvents', 'Total Events')}: ${this.events.length} | ${this.tr('stats.upcomingEvents', 'Upcoming')}: ${upcoming.length}`, 175, 1360);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 34px system-ui, -apple-system, sans-serif';
    ctx.fillText(this.tr('share.cardCta', 'Track free at dopabrain.com/dday-counter'), 540, 1730);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '26px system-ui, -apple-system, sans-serif';
    ctx.fillText(`dopabrain.com/dday-counter/?lang=${lang}`, 540, 1795);

    try {
      const dataUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.download = 'dopabrain-dday-milestone.png';
      a.href = dataUrl;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {}

    this.showToast(this.tr('share.savedCard', 'Countdown card saved!'));
    if (typeof gtag === 'function') {
      gtag('event', 'save_image', {
        app_name: 'dday-counter',
        result_type: nearest ? (nearest.category || 'milestone') : 'planner_card',
        lang
      });
    }

    if (saveBtn) {
      setTimeout(() => {
        saveBtn.disabled = false;
        saveBtn.textContent = this.tr('share.saveCard', 'Save Countdown Card');
      }, 600);
    }
  }

  renderCuratedResources() {
    const container = document.getElementById('curated-resources-card');
    if (!container) return;
    const curated = window.i18n?.t?.('curated');
    if (!curated || typeof curated !== 'object' || !Array.isArray(curated.books)) return;

    const lang = window.i18n?.getCurrentLanguage?.() || 'en';
    container.textContent = '';

    const header = document.createElement('div');
    header.className = 'curated-resources-header';
    const titleEl = document.createElement('h3');
    titleEl.className = 'curated-resources-title';
    titleEl.textContent = curated.title || '';
    const subEl = document.createElement('p');
    subEl.className = 'curated-resources-subtitle';
    subEl.textContent = curated.subtitle || '';
    header.appendChild(titleEl);
    header.appendChild(subEl);

    const list = document.createElement('div');
    list.className = 'curated-resources-list';

    curated.books.forEach((book) => {
      const link = document.createElement('a');
      link.className = 'curated-book-link';
      link.href = book.url;
      link.target = '_blank';
      link.rel = 'sponsored noopener noreferrer';

      const meta = document.createElement('div');
      meta.className = 'curated-book-meta';

      const bTitle = document.createElement('span');
      bTitle.className = 'curated-book-title';
      bTitle.textContent = book.title || '';

      const bAuthor = document.createElement('span');
      bAuthor.className = 'curated-book-author';
      bAuthor.textContent = book.author || '';

      const bNote = document.createElement('span');
      bNote.className = 'curated-book-note';
      bNote.textContent = book.note || '';

      meta.appendChild(bTitle);
      meta.appendChild(bAuthor);
      meta.appendChild(bNote);

      const badge = document.createElement('span');
      badge.className = 'curated-book-badge';
      badge.textContent = curated.badge || 'Book';

      link.appendChild(meta);
      link.appendChild(badge);

      link.addEventListener('click', () => {
        if (typeof gtag === 'function') {
          gtag('event', 'curated_resource_click', {
            app_name: 'dday-counter',
            resource_type: 'book',
            item_id: book.id || 'book',
            lang
          });
        }
      });

      list.appendChild(link);
    });

    const noteEl = document.createElement('p');
    noteEl.className = 'curated-affiliate-note';
    noteEl.textContent = curated.affiliateNote || '';

    container.appendChild(header);
    container.appendChild(list);
    container.appendChild(noteEl);
  }
}

// 앱 초기화
const app = new DdayApp();
window.ddayApp = app;
preserveLanguageLinks();

function preserveLanguageLinks() {
  try {
    const lang = (window.i18n && typeof window.i18n.getCurrentLanguage === 'function' ? window.i18n.getCurrentLanguage() : null) || new URLSearchParams(window.location.search).get('lang') || 'en';
    document.querySelectorAll('.related-card, a[href^="/pomodoro-timer/"], a[href^="/detox-timer/"], a[href^="/future-self/"], a[href^="/life-in-numbers/"]').forEach(function(a) {
      const href = a.getAttribute('href');
      if (!href || href.startsWith('/portal/')) return;
      const url = new URL(href, window.location.origin);
      if (lang) {
        url.searchParams.set('lang', lang);
      }
      url.searchParams.set('source', 'dday_counter_result');
      a.setAttribute('href', url.pathname + url.search + url.hash);

      if (!a.__ctaBound) {
        a.__ctaBound = true;
        a.addEventListener('click', function() {
          const liveLang = (window.i18n && typeof window.i18n.getCurrentLanguage === 'function' ? window.i18n.getCurrentLanguage() : null) || new URLSearchParams(window.location.search).get('lang') || 'en';
          if (typeof gtag === 'function') {
            gtag('event', 'content_cta_click', {
              cta_surface: 'related_tools',
              destination: a.getAttribute('href'),
              source: 'dday_counter_result',
              lang: liveLang
            });
          }
        });
      }
    });
  } catch (e) {}
}

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
