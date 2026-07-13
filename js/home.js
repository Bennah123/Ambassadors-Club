// ============================================
// HOME.JS – Homepage logic
// SDA Embakasi Central – Ambassadors Club
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  fetchAndAnimateStats();
  populateUpcomingEvents();
  initScrollReveal();
  initHeroParallax();
});

// =====================================================
// LIVE STATS FROM SUPABASE
// =====================================================
async function fetchAndAnimateStats() {
  // Animate all non-live counters immediately (Annual Events, Years Strong)
  document.querySelectorAll('.stat-num:not(#statMembers):not(#statChoir)').forEach(el => {
    animateCount(el, parseInt(el.dataset.count, 10));
  });

  // Default fallback values from data-count
  const membersEl = document.getElementById('statMembers');
  const choirEl   = document.getElementById('statChoir');
  let membersCount = parseInt(membersEl?.dataset.count || '0', 10);
  let choirCount   = parseInt(choirEl?.dataset.count   || '0', 10);

  // Fetch live counts from Supabase
  if (typeof supabaseClient !== 'undefined') {
    try {
      const [{ count: mCount }, { count: cCount }] = await Promise.all([
        supabaseClient.from('members').select('*', { count: 'exact', head: true }),
        supabaseClient.from('choir_members').select('*', { count: 'exact', head: true }),
      ]);
      if (mCount !== null) membersCount = mCount;
      if (cCount !== null) choirCount   = cCount;
    } catch (err) {
      console.warn('Stats fetch failed, using fallback values:', err.message);
    }
  }

  if (membersEl) animateCount(membersEl, membersCount);
  if (choirEl)   animateCount(choirEl,   choirCount);
}

function animateCount(el, target) {
  const duration = 1600;
  const start    = performance.now();
  (function step(now) {
    const t = Math.min((now - start) / duration, 1);
    const e = 1 - Math.pow(1 - t, 3);
    el.textContent = Math.round(e * target);
    if (t < 1) requestAnimationFrame(step);
  })(performance.now());
}

// =====================================================
// UPCOMING EVENTS
// =====================================================
const EVENTS = [
  {
    day: '28', month: 'Jun 2026',
    tag: 'tag-camp', tagLabel: 'Camp',
    title: 'Youth Camp Meeting',
    desc: 'Annual weekend retreat — worship, workshops, and fellowship.'
  },
  {
    day: '05', month: 'Jul 2026',
    tag: 'tag-service', tagLabel: 'Service',
    title: 'Community Health Outreach',
    desc: 'Free health screening and wellness education in Embakasi.'
  },
  {
    day: '12', month: 'Jul 2026',
    tag: 'tag-social', tagLabel: 'Social',
    title: 'Ambassadors Fellowship Night',
    desc: 'An evening of music, games, and bonding for all club members.'
  }
];

function populateUpcomingEvents() {
  const container = document.getElementById('upcomingEvents');
  if (!container) return;

  if (!EVENTS.length) {
    container.innerHTML = '<p class="no-events">No upcoming events. Check back soon!</p>';
    return;
  }

  container.innerHTML = EVENTS.map(ev => `
    <div class="event-row reveal-child">
      <div class="event-date-block">
        <span class="event-day">${esc(ev.day)}</span>
        <span class="event-month">${esc(ev.month)}</span>
      </div>
      <div class="event-info">
        <span class="event-tag ${esc(ev.tag)}">${esc(ev.tagLabel)}</span>
        <h4>${esc(ev.title)}</h4>
        <p>${esc(ev.desc)}</p>
      </div>
      <div class="event-caret">→</div>
    </div>
  `).join('');

  // Trigger reveal on the newly injected rows
  initScrollReveal();
}

function esc(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// =====================================================
// SCROLL REVEAL
// =====================================================
function initScrollReveal() {
  const els = document.querySelectorAll('.reveal-section:not(.in-view), .reveal-child:not(.in-view)');
  if (!els.length) return;

  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.10, rootMargin: '0px 0px -40px 0px' });

  els.forEach(el => io.observe(el));
}

// =====================================================
// HERO PARALLAX (desktop only)
// =====================================================
function initHeroParallax() {
  const heroContent = document.querySelector('.hero-content');
  if (!heroContent) return;

  let enabled = globalThis.innerWidth >= 768;
  let ticking  = false;

  globalThis.addEventListener('resize', () => {
    enabled = globalThis.innerWidth >= 768;
    if (!enabled) {
      heroContent.style.transform = 'none';
      heroContent.style.opacity   = '1';
    }
  }, { passive: true });

  globalThis.addEventListener('scroll', () => {
    if (!enabled || ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y = globalThis.pageYOffset;
      if (y < globalThis.innerHeight) {
        heroContent.style.transform = `translateY(${y * 0.12}px)`;
        heroContent.style.opacity   = String(1 - (y / globalThis.innerHeight) * 0.55);
      }
      ticking = false;
    });
  }, { passive: true });
}