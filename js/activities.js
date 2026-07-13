// ============================================
// ACTIVITIES.JS – Activities page logic
// SDA Embakasi Central – Ambassadors Club
// Admin detected via shared-auth.js (globalThis.isAdmin)
// ============================================

// =====================================================
// FALLBACK EVENT DATA (used only if Supabase has no rows)
// =====================================================
const fallbackEventsData = [
  {
    id: 'fallback-1',
    date: '2026-06-28',
    title: 'Youth Camp Meeting',
    type: 'camp',
    typeLabel: 'Camp',
    time: '8:00 AM',
    location: 'Camp Site',
    description: 'Annual weekend retreat. Worship, workshops, team building, and spiritual growth.'
  },
  {
    id: 'fallback-2',
    date: '2026-07-05',
    title: 'Community Health Outreach',
    type: 'service',
    typeLabel: 'Service',
    time: '9:00 AM',
    location: 'Embakasi Community Center',
    description: 'Free health screening and wellness education for the local community.'
  },
  {
    id: 'fallback-3',
    date: '2026-07-12',
    title: 'Ambassadors Fellowship Night',
    type: 'social',
    typeLabel: 'Social',
    time: '6:00 PM',
    location: 'Church Fellowship Hall',
    description: 'An evening of music, games, food, and bonding for all club members.'
  },
  {
    id: 'fallback-4',
    date: '2026-07-19',
    title: 'Sabbath School Rally',
    type: 'study',
    typeLabel: 'Bible Study',
    time: '10:00 AM',
    location: 'Church Sanctuary',
    description: 'Combined Sabbath School program with quiz competitions and presentations.'
  },
  {
    id: 'fallback-5',
    date: '2026-07-26',
    title: 'Youth Evangelistic Series',
    type: 'study',
    typeLabel: 'Bible Study',
    time: '6:30 PM',
    location: 'Church Sanctuary',
    description: 'Week-long evangelistic meetings targeting youth in the Embakasi area.'
  },
  {
    id: 'fallback-6',
    date: '2026-08-02',
    title: 'Sports Day & Picnic',
    type: 'social',
    typeLabel: 'Social',
    time: '9:00 AM',
    location: 'Embakasi Grounds',
    description: 'Football, volleyball, athletics, and picnic for all Ambassadors members.'
  }
];

const typeLabelMap = { camp: 'Camp', service: 'Service', social: 'Social', study: 'Bible Study' };

// Dot colours matching the design tokens
const eventTypeColors = {
  camp:    '#1e40af',
  service: '#14532d',
  social:  '#78350f',
  study:   '#6d28d9'
};

let eventsData = [...fallbackEventsData];
let _isSupabaseConnected = false;
let editingEventId = null;

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
        id:        e.id,
        date:      e.event_date,
        title:     e.title,
        type:      e.event_type || 'other',
        typeLabel: e.event_type
          ? (typeLabelMap[e.event_type] || (e.event_type.charAt(0).toUpperCase() + e.event_type.slice(1)))
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
// ADMIN UI
// =====================================================
function applyAdminUI() {
  document.querySelectorAll('.admin-only').forEach(el => {
    el.style.display = globalThis.isAdmin ? '' : 'none';
  });
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

  const titleEl = document.getElementById('calendarTitle');
  if (titleEl) titleEl.textContent = `${MONTHS[currentMonth]} ${currentYear}`;

  let html = DAYS.map(d => `<div class="cal-day-header">${d}</div>`).join('');

  const firstDay      = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth   = new Date(currentYear, currentMonth + 1, 0).getDate();
  const daysInPrevMo  = new Date(currentYear, currentMonth, 0).getDate();
  const today         = new Date();
  const isCurMonth    = today.getMonth() === currentMonth && today.getFullYear() === currentYear;

  for (let i = firstDay - 1; i >= 0; i--) {
    html += `<div class="cal-day other-month">${daysInPrevMo - i}</div>`;
  }

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

    html += `<div class="${cls}" data-date="${dateStr}" title="${esc(dayEvents.map(e=>e.title).join(', '))}">${day}${dotsHtml}</div>`;
  }

  const totalCells    = firstDay + daysInMonth;
  const remainingCells = 42 - totalCells;
  for (let day = 1; day <= remainingCells; day++) {
    html += `<div class="cal-day other-month">${day}</div>`;
  }

  grid.innerHTML = html;

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
      <div class="event-timeline-item reveal-child" data-event-date="${event.date}" data-event-id="${esc(event.id)}">
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
          ${globalThis.isAdmin ? `
          <div class="et-admin-actions">
            <button class="et-action-btn" data-edit-event="${esc(event.id)}">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              Edit
            </button>
            <button class="et-action-btn danger" data-delete-event="${esc(event.id)}">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/></svg>
              Delete
            </button>
          </div>` : ''}
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('[data-edit-event]').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); openEventForm(btn.dataset.editEvent); });
  });
  container.querySelectorAll('[data-delete-event]').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); deleteEvent(btn.dataset.deleteEvent); });
  });

  initScrollReveal();
}

// =====================================================
// ADD / EDIT EVENT MODAL
// =====================================================
function openEventForm(eventId = null) {
  if (!globalThis.isAdmin) return;
  editingEventId = eventId;
  const existing = eventId ? eventsData.find(e => String(e.id) === String(eventId)) : null;

  const modalTitle = document.getElementById('eventModalTitle');
  const saveBtn    = document.getElementById('eventSaveBtn');
  const errEl      = document.getElementById('eventError');

  errEl.textContent = '';
  saveBtn.disabled = false;

  if (existing) {
    modalTitle.textContent = 'Edit Event';
    saveBtn.textContent = 'Save Changes';
    document.getElementById('evTitle').value = existing.title;
    document.getElementById('evDate').value = existing.date;
    document.getElementById('evType').value = existing.type;
    document.getElementById('evTime').value = existing.time === 'TBD' ? '' : existing.time;
    document.getElementById('evLocation').value = existing.location === 'TBD' ? '' : existing.location;
    document.getElementById('evDescription').value = existing.description || '';
  } else {
    modalTitle.textContent = 'Add Event';
    saveBtn.textContent = 'Save Event';
    document.getElementById('eventForm').reset();
  }

  document.getElementById('eventModal')?.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeEventForm() {
  document.getElementById('eventModal')?.classList.remove('active');
  document.body.style.overflow = '';
  document.getElementById('eventForm')?.reset();
  document.getElementById('eventError').textContent = '';
  editingEventId = null;
}

async function saveEvent(e) {
  e.preventDefault();
  const title = document.getElementById('evTitle').value.trim();
  const date = document.getElementById('evDate').value;
  const type = document.getElementById('evType').value;
  const time = document.getElementById('evTime').value.trim() || 'TBD';
  const location = document.getElementById('evLocation').value.trim() || 'TBD';
  const description = document.getElementById('evDescription').value.trim();
  const errEl = document.getElementById('eventError');
  const saveBtn = document.getElementById('eventSaveBtn');
  const isEdit = !!editingEventId;

  if (!title || !date || !type) { errEl.textContent = 'Please fill in all required fields.'; return; }

  errEl.textContent = '';
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving…';

  try {
    const typeLabel = typeLabelMap[type] || type;

    if (typeof supabaseClient !== 'undefined') {
      if (isEdit && !String(editingEventId).startsWith('fallback-') && !String(editingEventId).startsWith('local-')) {
        const { data: updated, error } = await supabaseClient.from('events')
          .update({ title, event_date: date, event_type: type, time, location, description })
          .eq('id', editingEventId)
          .select('id');
        if (error) throw error;
        if (!updated || !updated.length) throw new Error('No event was updated — check permissions.');
      } else {
        const { error } = await supabaseClient.from('events')
          .insert([{ title, event_date: date, event_type: type, time, location, description }]);
        if (error) throw error;
      }
      await loadEventsFromSupabase();
    } else {
      if (isEdit) {
        const idx = eventsData.findIndex(ev => String(ev.id) === String(editingEventId));
        if (idx !== -1) eventsData[idx] = { ...eventsData[idx], title, date, type, typeLabel, time, location, description };
      } else {
        eventsData.push({ id: 'local-' + Date.now(), title, date, type, typeLabel, time, location, description });
      }
    }

    closeEventForm();
    renderCalendar();
    renderEventsTimeline();
  } catch (err) {
    console.error('Save event failed:', err);
    errEl.textContent = err.message || 'Failed to save event.';
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = isEdit ? 'Save Changes' : 'Save Event';
  }
}

async function deleteEvent(id) {
  if (!globalThis.isAdmin) return;
  if (!confirm('Delete this event? This cannot be undone.')) return;
  try {
    if (typeof supabaseClient !== 'undefined' && !String(id).startsWith('fallback-') && !String(id).startsWith('local-')) {
      const { error } = await supabaseClient.from('events').delete().eq('id', id);
      if (error) throw error;
      await loadEventsFromSupabase();
    } else {
      eventsData = eventsData.filter(e => String(e.id) !== String(id));
    }
    renderCalendar();
    renderEventsTimeline();
  } catch (err) {
    console.error('Delete event failed:', err);
    alert('Failed to delete: ' + err.message);
  }
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
    el.classList.add('revealed');
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
  return String(str ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// =====================================================
// INIT
// =====================================================
async function initActivities() {
  if (globalThis.__activitiesInited) return;
  globalThis.__activitiesInited = true;

  await loadEventsFromSupabase();

  renderCalendar();
  renderEventsTimeline();
  initScrollReveal();
  applyAdminUI();

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

  document.getElementById('addEventBtn')?.addEventListener('click', () => openEventForm());
  document.getElementById('eventModalClose')?.addEventListener('click', closeEventForm);
  document.getElementById('cancelEvent')?.addEventListener('click', closeEventForm);
  document.getElementById('eventForm')?.addEventListener('submit', saveEvent);
  document.getElementById('eventModal')?.addEventListener('click', e => {
    if (e.target.classList.contains('modal-overlay')) closeEventForm();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeEventForm(); });
}

document.addEventListener('DOMContentLoaded', initActivities);
document.addEventListener('adminReady', initActivities);