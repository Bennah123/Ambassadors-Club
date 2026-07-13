// ============================================
// ACTIVITIES.JS – Activities page logic
// SDA Embakasi Central – Ambassadors Club
// ============================================

// =====================================================
// FALLBACK EVENT DATA
// =====================================================
const fallbackEventsData = [
  {
    date: '2026-06-28',
    title: 'Youth Camp Meeting',
    type: 'camp',
    typeLabel: 'Camp',
    time: '8:00 AM',
    location: 'Camp Site',
    description: 'Annual weekend retreat. Worship, workshops, team building, and spiritual growth.'
  },
  {
    date: '2026-07-05',
    title: 'Community Health Outreach',
    type: 'service',
    typeLabel: 'Service',
    time: '9:00 AM',
    location: 'Embakasi Community Center',
    description: 'Free health screening and wellness education for the local community.'
  },
  {
    date: '2026-07-12',
    title: 'Ambassadors Fellowship Night',
    type: 'social',
    typeLabel: 'Social',
    time: '6:00 PM',
    location: 'Church Fellowship Hall',
    description: 'An evening of music, games, food, and bonding for all club members.'
  },
  {
    date: '2026-07-19',
    title: 'Sabbath School Rally',
    type: 'study',
    typeLabel: 'Bible Study',
    time: '10:00 AM',
    location: 'Church Sanctuary',
    description: 'Combined Sabbath School program with quiz competitions and presentations.'
  },
  {
    date: '2026-07-26',
    title: 'Youth Evangelistic Series',
    type: 'study',
    typeLabel: 'Bible Study',
    time: '6:30 PM',
    location: 'Church Sanctuary',
    description: 'Week-long evangelistic meetings targeting youth in the Embakasi area.'
  },
  {
    date: '2026-08-02',
    title: 'Sports Day & Picnic',
    type: 'social',
    typeLabel: 'Social',
    time: '9:00 AM',
    location: 'Embakasi Grounds',
    description: 'Football, volleyball, athletics, and picnic for all Ambassadors members.'
  }
];

// Dot colours matching the new design tokens
const eventTypeColors = {
  camp:    '#1e40af',
  service: '#14532d',
  social:  '#78350f',
  study:   '#6d28d9'
};

let eventsData = [...fallbackEventsData];
let _isSupabaseConnected = false;

// Calendar state
let currentMonth = new Date().getMonth();
let currentYear  = new Date().getFullYear();

// =====================================================
// SUPABASE LOADER
// =====================================================
async function loadEventsFromSupabase() {
  if (typeof supabaseClient === 'undefined') {
    console.log('Supabase not configured — using fallback data.');
    return false;
  }

  try {
    const { data, error } = await supabaseClient
      .from('events')
      .select('*')
      .order('event_date', { ascending: true });

    if (error) throw error;

    if (data && data.length > 0) {
      eventsData = data.map(e => ({
        date:      e.event_date,
        title:     e.title,
        type:      e.event_type || 'other',
        typeLabel: e.event_type
          ? e.event_type.charAt(0).toUpperCase() + e.event_type.slice(1)
          : 'Other',
        time:        e.time        || 'TBD',
        location:    e.location    || 'TBD',
        description: e.description || ''
      }));
      _isSupabaseConnected = true;
      console.log(`✅ Loaded ${data.length} events from Supabase`);
      return true;
    }
  } catch (err) {
    console.warn('Supabase fetch failed:', err.message);
  }
  return false;
}

// =====================================================
// CALENDAR RENDERER
// =====================================================
function renderCalendar() {
  const grid = document.getElementById('calendarGrid');
  if (!grid) return;

  const MONTHS = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December'
  ];
  const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  // Update title
  const titleEl = document.getElementById('calendarTitle');
  if (titleEl) titleEl.textContent = `${MONTHS[currentMonth]} ${currentYear}`;

  // Day-of-week headers
  let html = DAYS.map(d => `<div class="cal-day-header">${d}</div>`).join('');

  const firstDay      = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth   = new Date(currentYear, currentMonth + 1, 0).getDate();
  const daysInPrevMo  = new Date(currentYear, currentMonth, 0).getDate();
  const today         = new Date();
  const isCurMonth    = today.getMonth() === currentMonth && today.getFullYear() === currentYear;

  // Previous-month overflow
  for (let i = firstDay - 1; i >= 0; i--) {
    html += `<div class="cal-day other-month">${daysInPrevMo - i}</div>`;
  }

  // Current month days
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr   = `${currentYear}-${pad(currentMonth + 1)}-${pad(day)}`;
    const dayEvents = eventsData.filter(e => e.date === dateStr);

    let cls = 'cal-day';
    if (isCurMonth && day === today.getDate()) cls += ' today';

    let dotsHtml = '';
    if (dayEvents.length > 0) {
      cls += ' has-event';
      const shown = dayEvents.slice(0, 3);
      dotsHtml = `<div class="event-dots">
        ${shown.map(e => `<span class="event-dot" style="background:${eventTypeColors[e.type] || '#888'}"></span>`).join('')}
        ${dayEvents.length > 3 ? `<span style="font-size:0.55rem;color:var(--text-3);line-height:1">+${dayEvents.length - 3}</span>` : ''}
      </div>`;
    }

    html += `<div class="${cls}" data-date="${dateStr}" title="${dayEvents.map(e=>e.title).join(', ')}">${day}${dotsHtml}</div>`;
  }

  // Next-month overflow (fill to 6 rows = 42 cells)
  const totalCells    = firstDay + daysInMonth;
  const remainingCells = 42 - totalCells;
  for (let day = 1; day <= remainingCells; day++) {
    html += `<div class="cal-day other-month">${day}</div>`;
  }

  grid.innerHTML = html;

  // Click on a day with events → scroll to that event in the timeline
  grid.querySelectorAll('.cal-day.has-event').forEach(cell => {
    cell.addEventListener('click', () => {
      const dateStr = cell.dataset.date;
      const target  = document.querySelector(`[data-event-date="${dateStr}"]`);
      if (target) {
        const offset = (document.getElementById('navbar')?.offsetHeight || 80) + 16;
        globalThis.scrollTo({ top: target.getBoundingClientRect().top + globalThis.pageYOffset - offset, behavior: 'smooth' });
        target.classList.add('highlight-flash');
        setTimeout(() => target.classList.remove('highlight-flash'), 1200);
      }
    });
  });
}

// =====================================================
// EVENTS TIMELINE RENDERER
// =====================================================
function renderEventsTimeline() {
  const container = document.getElementById('eventsTimeline');
  if (!container) return;

  const now      = new Date();
  const upcoming = eventsData
    .filter(e => new Date(e.date) >= now)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  if (!upcoming.length) {
    container.innerHTML = '<p class="no-events-msg">No upcoming events. Check back soon!</p>';
    return;
  }

  container.innerHTML = upcoming.map(event => {
    const d     = new Date(event.date);
    const day   = d.getDate();
    const month = d.toLocaleDateString('en-US', { month: 'short' });

    return `
      <div class="event-timeline-item reveal-child" data-event-date="${event.date}">
        <div class="et-date">
          <span class="day">${day}</span>
          <span class="month">${month}</span>
        </div>
        <div class="et-details">
          <h4>${esc(event.title)}</h4>
          <div class="et-meta">
            <span>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
              ${esc(event.time)}
            </span>
            <span>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              ${esc(event.location)}
            </span>
          </div>
          <p>${esc(event.description)}</p>
          <span class="et-tag ${esc(event.type)}">${esc(event.typeLabel)}</span>
        </div>
      </div>
    `;
  }).join('');

  // Trigger scroll reveal on newly injected items
  initScrollReveal();
}

// =====================================================
// SCROLL REVEAL (local, for dynamically injected items)
// =====================================================
function initScrollReveal() {
  const els = document.querySelectorAll('.reveal-child:not(.revealed), .reveal-section:not(.revealed)');
  if (!els.length) return;

  els.forEach(el => {
    el.style.opacity   = '0';
    el.style.transform = 'translateY(24px)';
    el.style.transition = 'opacity 0.55s ease, transform 0.55s ease';
    el.classList.add('revealed'); // prevent double-init
  });

  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.style.opacity   = '1';
      entry.target.style.transform = 'none';
      io.unobserve(entry.target);
    });
  }, { threshold: 0.10, rootMargin: '0px 0px -32px 0px' });

  els.forEach(el => io.observe(el));
}

// =====================================================
// HIGHLIGHT FLASH (when jumping from calendar to event)
// =====================================================
const styleTag = document.createElement('style');
styleTag.textContent = `
  @keyframes highlight-flash {
    0%   { background: rgba(201,162,39,0.18); }
    100% { background: transparent; }
  }
  .highlight-flash { animation: highlight-flash 1.2s ease-out forwards; }
`;
document.head.appendChild(styleTag);

// =====================================================
// UTILS
// =====================================================
function pad(n)   { return String(n).padStart(2, '0'); }
function esc(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// =====================================================
// INIT
// =====================================================
document.addEventListener('DOMContentLoaded', async () => {
  await loadEventsFromSupabase();

  renderCalendar();
  renderEventsTimeline();
  initScrollReveal();

  // Month navigation
  document.getElementById('prevMonth')?.addEventListener('click', () => {
    currentMonth--;
    if (currentMonth < 0) { currentMonth = 11; currentYear--; }
    renderCalendar();
  });

  document.getElementById('nextMonth')?.addEventListener('click', () => {
    currentMonth++;
    if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    renderCalendar();
  });
});