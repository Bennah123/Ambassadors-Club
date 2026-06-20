// ============================================
// HOME.JS - Homepage logic
// SDA Embakasi Central – Ambassadors Club
// ============================================

document.addEventListener('DOMContentLoaded', () => {

  animateCounters();
  populateUpcomingEvents();
  initScrollAnimations();
  initHeroParallax();
  initNavbarScroll();
  // NOTE: Mobile menu toggle removed from here — it is handled in main.js.
  // Having it in both files caused the menu to open and immediately close.

});

// ============================================================
// COUNTER ANIMATION
// ============================================================
function animateCounters() {
  const counters = document.querySelectorAll('.h-number');
  if (!counters.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateCount(entry.target, parseInt(entry.target.dataset.count, 10));
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  counters.forEach(counter => observer.observe(counter));
}

function animateCount(element, target) {
  // BUG FIX: original used a fixed 50-step setInterval regardless of target
  // value — for target=3 each step was 0.06, so it would show "0" for almost
  // all steps. Now we use requestAnimationFrame with easing for smooth results
  // at any target value.
  const duration = 1500; // ms
  const start = performance.now();

  function step(now) {
    const elapsed  = now - start;
    const progress = Math.min(elapsed / duration, 1);
    // Ease-out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    element.textContent = Math.round(eased * target);
    if (progress < 1) requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
}

// ============================================================
// UPCOMING EVENTS
// ============================================================
const upcomingEventsData = [
  {
    day: '28',
    month: 'Jun 2026',
    tag: 'epc-camp',
    tagLabel: 'Camp',
    title: 'Youth Camp Meeting',
    description: 'Annual weekend retreat at Camp Site. Worship, workshops, and fellowship.'
  },
  {
    day: '05',
    month: 'Jul 2026',
    tag: 'epc-service',
    tagLabel: 'Service',
    title: 'Community Health Outreach',
    description: 'Free health screening and wellness education in Embakasi community.'
  },
  {
    day: '12',
    month: 'Jul 2026',
    tag: 'epc-social',
    tagLabel: 'Social',
    title: 'Ambassadors Fellowship Night',
    description: 'An evening of music, games, and bonding for all club members.'
  }
];

function populateUpcomingEvents() {
  const container = document.getElementById('upcomingEvents');
  if (!container) return;

  // BUG FIX: innerHTML was set all at once — if the data array were ever empty
  // the container would just be blank with no feedback. Added empty-state.
  if (!upcomingEventsData.length) {
    container.innerHTML = '<p class="no-events">No upcoming events. Check back soon!</p>';
    return;
  }

  container.innerHTML = upcomingEventsData.map(event => `
    <div class="event-preview-card">
      <div class="epc-date">
        <span class="day">${escapeHTML(event.day)}</span>
        <span class="month-year">${escapeHTML(event.month)}</span>
      </div>
      <div class="epc-body">
        <span class="epc-tag ${escapeHTML(event.tag)}">${escapeHTML(event.tagLabel)}</span>
        <h4>${escapeHTML(event.title)}</h4>
        <p>${escapeHTML(event.description)}</p>
      </div>
    </div>
  `).join('');
}

/** Prevent XSS when injecting dynamic strings into innerHTML */
function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ============================================================
// SCROLL-TRIGGERED ANIMATIONS
// ============================================================
function initScrollAnimations() {
  const animatedElements = document.querySelectorAll(
    '.mission-text, .mission-card, .feature-card, .event-preview-card, .testimonial-content'
  );
  if (!animatedElements.length) return;

  // Set initial hidden state via style (JS-driven, so no FOUC)
  animatedElements.forEach((el, index) => {
    el.style.opacity    = '0';
    el.style.transform  = 'translateY(30px)';
    // Stagger delay capped at 0.4s so later items don't feel sluggish
    const delay = Math.min(index * 0.08, 0.4);
    el.style.transition = `opacity 0.6s ease ${delay}s, transform 0.6s ease ${delay}s`;
  });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity   = '1';
        entry.target.style.transform = 'translateY(0)';
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  animatedElements.forEach(el => observer.observe(el));
}

// ============================================================
// HERO PARALLAX
// ============================================================
function initHeroParallax() {
  const hero = document.querySelector('.hero');
  if (!hero) return;

  // BUG FIX: original ran parallax even on mobile, causing janky layout on
  // small screens where the hero already fills the viewport. Disabled below
  // 768 px via a media-query check that re-evaluates on resize.
  let enabled = window.innerWidth >= 768;

  window.addEventListener('resize', () => {
    enabled = window.innerWidth >= 768;
    if (!enabled) {
      const heroContent = hero.querySelector('.hero-content');
      if (heroContent) {
        heroContent.style.transform = 'none';
        heroContent.style.opacity   = '1';
      }
    }
  }, { passive: true });

  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!enabled || ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const scrolled    = window.pageYOffset;
      const heroContent = hero.querySelector('.hero-content');
      if (heroContent && scrolled < window.innerHeight) {
        heroContent.style.transform = `translateY(${scrolled * 0.15}px)`;
        heroContent.style.opacity   = String(1 - (scrolled / window.innerHeight) * 0.6);
      }
      ticking = false;
    });
  }, { passive: true });
}

// ============================================================
// NAVBAR SCROLL EFFECT
// ============================================================
// BUG FIX: original code in home.js duplicated the scroll listener already
// in main.js, creating two competing handlers modifying `.navbar` styles.
// Consolidated here into one handler that handles both shadow (main.js concern)
// and background opacity (home-specific concern).
function initNavbarScroll() {
  const navbar = document.getElementById('navbar');
  if (!navbar) return;

  window.addEventListener('scroll', () => {
    const scrolled = window.pageYOffset;
    if (scrolled > 100) {
      navbar.style.background      = 'rgba(26, 54, 93, 0.98)';
      navbar.style.backdropFilter  = 'blur(14px)';
      navbar.style.boxShadow       = '0 4px 24px rgba(0,0,0,0.25)';
    } else {
      navbar.style.background      = 'rgba(26, 54, 93, 0.95)';
      navbar.style.backdropFilter  = 'blur(10px)';
      navbar.style.boxShadow       = 'none';
    }
  }, { passive: true });
}