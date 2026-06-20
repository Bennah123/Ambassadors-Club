// ============================================
// ACTIVITIES PAGE JAVASCRIPT - SDA Embakasi Central
// Ambassadors Club Website
// ============================================

// ---- EVENTS DATA ----
const eventsData = [
  { date: '2026-06-28', title: 'Youth Camp Meeting', type: 'camp', typeLabel: 'Camp', time: '8:00 AM', location: 'Camp Site', description: 'Annual weekend retreat. Worship, workshops, team building, and spiritual growth.' },
  { date: '2026-07-05', title: 'Community Health Outreach', type: 'service', typeLabel: 'Service', time: '9:00 AM', location: 'Embakasi Community Center', description: 'Free health screening and wellness education for the local community.' },
  { date: '2026-07-12', title: 'Ambassadors Fellowship Night', type: 'social', typeLabel: 'Social', time: '6:00 PM', location: 'Church Fellowship Hall', description: 'An evening of music, games, food, and bonding for all club members.' },
  { date: '2026-07-19', title: 'Sabbath School Rally', type: 'study', typeLabel: 'Bible Study', time: '10:00 AM', location: 'Church Sanctuary', description: 'Combined Sabbath School program with quiz competitions and presentations.' },
  { date: '2026-07-26', title: 'Youth Evangelistic Series', type: 'study', typeLabel: 'Bible Study', time: '6:30 PM', location: 'Church Sanctuary', description: 'Week-long evangelistic meetings targeting youth in the Embakasi area.' },
  { date: '2026-08-02', title: 'Sports Day & Picnic', type: 'social', typeLabel: 'Social', time: '9:00 AM', location: 'Embakasi Grounds', description: 'Football, volleyball, athletics, and picnic for all Ambassadors members.' }
];

const eventTypeColors = {
  camp: '#1e40af',
  service: '#166534',
  social: '#92400e',
  study: '#7c3aed'
};

// ---- CALENDAR STATE ----
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();

// ---- RENDER CALENDAR ----
function renderCalendar() {
  const grid = document.getElementById('calendarGrid');
  if (!grid) return;

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Update title
  const titleEl = document.getElementById('calendarTitle');
  if (titleEl) {
    titleEl.textContent = `${monthNames[currentMonth]} ${currentYear}`;
  }

  // Build header
  let html = dayNames.map(day => `<div class="cal-day-header">${day}</div>`).join('');

  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

  const today = new Date();
  const isCurrentMonth = today.getMonth() === currentMonth && today.getFullYear() === currentYear;
  const todayDate = today.getDate();

  // Previous month days
  for (let i = firstDay - 1; i >= 0; i--) {
    html += `<div class="cal-day other-month">${daysInPrevMonth - i}</div>`;
  }

  // Current month days
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayEvents = eventsData.filter(e => e.date === dateStr);

    let classes = 'cal-day';
    if (isCurrentMonth && day === todayDate) classes += ' today';

    let dotsHtml = '';
    if (dayEvents.length > 0) {
      classes += ' has-event';
      dayEvents.forEach(e => classes += ` event-${e.type}`);

      if (dayEvents.length <= 3) {
        dotsHtml = `<div class="event-dots">${dayEvents.map(e => `<span class="event-dot" style="background:${eventTypeColors[e.type]}"></span>`).join('')}</div>`;
      } else {
        dotsHtml = `<div class="event-dots"><span class="event-dot" style="background:${eventTypeColors[dayEvents[0].type]}"></span><span style="font-size:0.6rem;color:var(--text-muted)">+${dayEvents.length - 1}</span></div>`;
      }
    }

    html += `<div class="${classes}" data-date="${dateStr}">${day}${dotsHtml}</div>`;
  }

  // Next month days
  const totalCells = firstDay + daysInMonth;
  const remainingCells = 42 - totalCells;
  for (let day = 1; day <= remainingCells; day++) {
    html += `<div class="cal-day other-month">${day}</div>`;
  }

  grid.innerHTML = html;
}

// ---- RENDER EVENTS TIMELINE ----
function renderEventsTimeline() {
  const container = document.getElementById('eventsTimeline');
  if (!container) return;

  const now = new Date();
  const upcoming = eventsData.filter(e => new Date(e.date) >= now).sort((a, b) => new Date(a.date) - new Date(b.date));

  container.innerHTML = upcoming.map(event => {
    const date = new Date(event.date);
    const day = date.getDate();
    const month = date.toLocaleDateString('en-US', { month: 'short' });

    return `
      <div class="event-timeline-item">
        <div class="et-date">
          <span class="day">${day}</span>
          <span class="month">${month}</span>
        </div>
        <div class="et-details">
          <h4>${event.title}</h4>
          <div class="et-meta">
            <span>&#128337; ${event.time}</span>
            <span>&#128205; ${event.location}</span>
          </div>
          <p>${event.description}</p>
          <span class="et-tag ${event.type}">${event.typeLabel}</span>
        </div>
      </div>
    `;
  }).join('');
}

// ---- EVENT LISTENERS ----
document.addEventListener('DOMContentLoaded', () => {
  // Render calendar
  renderCalendar();

  // Render events timeline
  renderEventsTimeline();

  // Previous month
  const prevBtn = document.getElementById('prevMonth');
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      currentMonth--;
      if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
      }
      renderCalendar();
    });
  }

  // Next month
  const nextBtn = document.getElementById('nextMonth');
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      currentMonth++;
      if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
      }
      renderCalendar();
    });
  }
});