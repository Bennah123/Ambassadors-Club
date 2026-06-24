// ============================================
// CALENDAR.JS — Reusable interactive calendar
// SDA Embakasi Central – Ambassadors Club
// ============================================
// Drop this on any page that has:
//   #calendarGrid, #calendarTitle, #prevMonth, #nextMonth
// Pass in eventsData array before it loads, or it will
// use an empty array and still render correctly.
// ============================================

(function () {
  'use strict';

  // ---- CONFIG ----
  const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const DAY_NAMES   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  const TYPE_COLORS = {
    camp:    '#3b82f6',
    service: '#22c55e',
    social:  '#f59e0b',
    study:   '#8b5cf6',
    worship: '#f97316',
    prayer:  '#a855f7',
    choir:   '#ef4444',
    youth:   '#10b981',
    other:   '#94a3b8',
  };

  // ---- STATE ----
  const now = new Date();
  let currentMonth = now.getMonth();
  let currentYear  = now.getFullYear();
  let selectedDate = null;

  // ---- EVENTS SOURCE ----
  // Reads window.eventsData if set by the page, else empty
  function getEvents() {
    return Array.isArray(window.eventsData) ? window.eventsData : [];
  }

  // ---- RENDER ----
  function render() {
    const grid  = document.getElementById('calendarGrid');
    const title = document.getElementById('calendarTitle');
    if (!grid) return;

    if (title) title.textContent = `${MONTH_NAMES[currentMonth]} ${currentYear}`;

    const firstDay      = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth   = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysInPrev    = new Date(currentYear, currentMonth, 0).getDate();
    const isCurrentMo   = now.getMonth() === currentMonth && now.getFullYear() === currentYear;
    const todayDate     = now.getDate();
    const events        = getEvents();

    let html = DAY_NAMES.map(d => `<div class="cal-day-header">${d}</div>`).join('');

    // Prev month overflow
    for (let i = firstDay - 1; i >= 0; i--) {
      html += `<div class="cal-day cal-other">${daysInPrev - i}</div>`;
    }

    // Current month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr   = `${currentYear}-${String(currentMonth + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      const dayEvents = events.filter(e => e.date === dateStr);
      const isToday   = isCurrentMo && day === todayDate;
      const isSelected = dateStr === selectedDate;

      let cls = 'cal-day';
      if (isToday)    cls += ' cal-today';
      if (isSelected) cls += ' cal-selected';
      if (dayEvents.length) cls += ' cal-has-event';

      const dots = dayEvents.slice(0, 3).map(e =>
        `<span class="cal-dot" style="background:${TYPE_COLORS[e.type] || TYPE_COLORS.other}"></span>`
      ).join('');

      html += `
        <div class="${cls}" data-date="${dateStr}" tabindex="0" role="button" aria-label="${dateStr}">
          <span class="cal-num">${day}</span>
          ${dots ? `<div class="cal-dots">${dots}</div>` : ''}
        </div>`;
    }

    // Next month overflow
    const totalCells = firstDay + daysInMonth;
    const remaining  = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (let d = 1; d <= remaining; d++) {
      html += `<div class="cal-day cal-other">${d}</div>`;
    }

    grid.innerHTML = html;

    // Click events on days
    grid.querySelectorAll('.cal-day:not(.cal-other)').forEach(cell => {
      cell.addEventListener('click', () => {
        selectedDate = cell.dataset.date;
        render();
        showDayEvents(selectedDate);
      });
      cell.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') cell.click();
      });
    });
  }

  // ---- SHOW EVENTS FOR A DAY ----
  function showDayEvents(dateStr) {
    const panel = document.getElementById('calDayPanel');
    if (!panel) return;

    const events    = getEvents();
    const dayEvents = events.filter(e => e.date === dateStr);
    const date      = new Date(dateStr + 'T00:00:00');
    const label     = date.toLocaleDateString('en-KE', { weekday:'long', day:'numeric', month:'long', year:'numeric' });

    if (!dayEvents.length) {
      panel.innerHTML = `
        <div class="cal-panel-header"><h4>${label}</h4></div>
        <p class="cal-panel-empty">No events scheduled for this day.</p>`;
    } else {
      const items = dayEvents.map(ev => `
        <div class="cal-panel-event">
          <div class="cal-panel-dot" style="background:${TYPE_COLORS[ev.type] || TYPE_COLORS.other}"></div>
          <div class="cal-panel-info">
            <span class="etag etag-${ev.type}">${ev.typeLabel}</span>
            <h5>${ev.title}</h5>
            <div class="cal-panel-meta">
              <span>🕐 ${ev.time || 'TBD'}</span>
              <span>📍 ${ev.location || 'TBD'}</span>
            </div>
            ${ev.description ? `<p>${ev.description}</p>` : ''}
          </div>
        </div>`).join('');

      panel.innerHTML = `
        <div class="cal-panel-header"><h4>${label}</h4><span class="cal-panel-count">${dayEvents.length} event${dayEvents.length > 1 ? 's' : ''}</span></div>
        ${items}`;
    }

    panel.classList.add('cal-panel-visible');
  }

  // ---- NAVIGATION ----
  function prevMonth() {
    currentMonth--;
    if (currentMonth < 0) { currentMonth = 11; currentYear--; }
    render();
    clearPanel();
  }

  function nextMonth() {
    currentMonth++;
    if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    render();
    clearPanel();
  }

  function clearPanel() {
    selectedDate = null;
    const panel = document.getElementById('calDayPanel');
    if (panel) panel.classList.remove('cal-panel-visible');
  }

  // ---- INIT ----
  function init() {
    const prev = document.getElementById('prevMonth');
    const next = document.getElementById('nextMonth');
    if (prev) prev.addEventListener('click', prevMonth);
    if (next) next.addEventListener('click', nextMonth);
    render();
  }

  // Wait for DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose refresh method so pages can call Calendar.refresh() after async data loads
  window.Calendar = { refresh: render };

})();