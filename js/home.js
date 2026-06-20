// ============================================
// HOMEPAGE JAVASCRIPT - SDA Embakasi Central
// Ambassadors Club Website
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  // Animate hero stats counter
  animateCounters();

  // Populate upcoming events
  populateUpcomingEvents();

  // Add scroll-triggered animations
  initScrollAnimations();

  // Parallax effect for hero
  initHeroParallax();
});

// ---- COUNTER ANIMATION ----
function animateCounters() {
  const counters = document.querySelectorAll('.h-number');

  const observerOptions = {
    threshold: 0.5,
    rootMargin: '0px'
  };

  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const target = entry.target;
        const countTo = parseInt(target.dataset.count);
        animateCount(target, countTo);
        counterObserver.unobserve(target);
      }
    });
  }, observerOptions);

  counters.forEach(counter => counterObserver.observe(counter));
}

function animateCount(element, target) {
  let current = 0;
  const increment = target / 50;
  const duration = 1500;
  const stepTime = duration / 50;

  const timer = setInterval(() => {
    current += increment;
    if (current >= target) {
      element.textContent = target;
      clearInterval(timer);
    } else {
      element.textContent = Math.floor(current);
    }
  }, stepTime);
}

// ---- UPCOMING EVENTS ----
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

  container.innerHTML = upcomingEventsData.map(event => `
    <div class="event-preview-card">
      <div class="epc-date">
        <span class="day">${event.day}</span>
        <span class="month-year">${event.month}</span>
      </div>
      <div class="epc-body">
        <span class="epc-tag ${event.tag}">${event.tagLabel}</span>
        <h4>${event.title}</h4>
        <p>${event.description}</p>
      </div>
    </div>
  `).join('');
}

// ---- SCROLL ANIMATIONS ----
function initScrollAnimations() {
  const animatedElements = document.querySelectorAll(
    '.mission-text, .mission-card, .feature-card, .event-preview-card, .testimonial-content'
  );

  const observerOptions = {
    threshold: 0.15,
    rootMargin: '0px 0px -50px 0px'
  };

  const scrollObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
        scrollObserver.unobserve(entry.target);
      }
    });
  }, observerOptions);

  animatedElements.forEach((el, index) => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(30px)';
    el.style.transition = `opacity 0.6s ease ${index * 0.1}s, transform 0.6s ease ${index * 0.1}s`;
    scrollObserver.observe(el);
  });
}

// ---- HERO PARALLAX ----
function initHeroParallax() {
  const hero = document.querySelector('.hero');
  if (!hero) return;

  let ticking = false;

  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        const scrolled = window.pageYOffset;
        const rate = scrolled * 0.3;

        const heroContent = hero.querySelector('.hero-content');
        if (heroContent && scrolled < window.innerHeight) {
          heroContent.style.transform = `translateY(${rate * 0.5}px)`;
          heroContent.style.opacity = 1 - (scrolled / window.innerHeight) * 0.5;
        }

        ticking = false;
      });
      ticking = true;
    }
  });
}

// ---- NAVBAR SCROLL EFFECT ----
let lastScroll = 0;
const navbar = document.getElementById('navbar');

window.addEventListener('scroll', () => {
  const currentScroll = window.pageYOffset;

  if (currentScroll > 100) {
    navbar.style.background = 'rgba(26, 54, 93, 0.98)';
    navbar.style.backdropFilter = 'blur(12px)';
  } else {
    navbar.style.background = 'rgba(26, 54, 93, 0.95)';
    navbar.style.backdropFilter = 'blur(10px)';
  }

  lastScroll = currentScroll;
});

// ---- MOBILE MENU TOGGLE ----
const mobileToggle = document.getElementById('mobileToggle');
const navLinks = document.getElementById('navLinks');

if (mobileToggle && navLinks) {
  mobileToggle.addEventListener('click', () => {
    navLinks.classList.toggle('mobile-open');

    // Animate hamburger to X
    const spans = mobileToggle.querySelectorAll('span');
    if (navLinks.classList.contains('mobile-open')) {
      spans[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
      spans[1].style.opacity = '0';
      spans[2].style.transform = 'rotate(-45deg) translate(5px, -5px)';
    } else {
      spans[0].style.transform = 'none';
      spans[1].style.opacity = '1';
      spans[2].style.transform = 'none';
    }
  });

  // Close menu when clicking a link
  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('mobile-open');
      const spans = mobileToggle.querySelectorAll('span');
      spans[0].style.transform = 'none';
      spans[1].style.opacity = '1';
      spans[2].style.transform = 'none';
    });
  });
}

// ---- SMOOTH SCROLL FOR ANCHOR LINKS ----
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      target.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  });
});