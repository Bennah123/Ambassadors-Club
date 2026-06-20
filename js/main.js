// ============================================
// MAIN.JS - Shared functionality, all pages
// SDA Embakasi Central – Ambassadors Club
// ============================================

document.addEventListener('DOMContentLoaded', () => {

  // ---- ACTIVE NAV LINK ----
  // BUG FIX: pathname.split('/').pop() returns '' on directory URLs (e.g. "/")
  // so the fallback must cover both '' and explicit 'index.html'
  const rawPage = window.location.pathname.split('/').pop();
  const currentPage = rawPage === '' ? 'index.html' : rawPage;

  document.querySelectorAll('.nav-links a').forEach(link => {
    const linkHref = link.getAttribute('href');
    // Normalise: treat both '' and 'index.html' as home
    const normHref = linkHref === '' ? 'index.html' : linkHref;
    if (normHref === currentPage) {
      link.classList.add('active');
    } else {
      // Remove stale active class that may be hard-coded in HTML
      link.classList.remove('active');
    }
  });

  // ---- MOBILE MENU TOGGLE ----
  // BUG FIX: main.js and home.js both attached click listeners to the same
  // mobileToggle element, causing the hamburger animation to fire twice and
  // the menu to immediately close. Mobile toggle is now ONLY handled in main.js;
  // the duplicate block has been removed from home.js.
  const mobileToggle = document.getElementById('mobileToggle');
  const navLinks    = document.getElementById('navLinks');

  if (mobileToggle && navLinks) {
    mobileToggle.addEventListener('click', () => {
      const isOpen = navLinks.classList.toggle('mobile-open');
      mobileToggle.setAttribute('aria-expanded', isOpen);

      const spans = mobileToggle.querySelectorAll('span');
      if (isOpen) {
        spans[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
        spans[1].style.opacity   = '0';
        spans[2].style.transform = 'rotate(-45deg) translate(5px, -5px)';
      } else {
        spans[0].style.transform = 'none';
        spans[1].style.opacity   = '1';
        spans[2].style.transform = 'none';
      }
    });

    // Close menu when a nav link is clicked
    navLinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('mobile-open');
        mobileToggle.setAttribute('aria-expanded', 'false');
        const spans = mobileToggle.querySelectorAll('span');
        spans[0].style.transform = 'none';
        spans[1].style.opacity   = '1';
        spans[2].style.transform = 'none';
      });
    });

    // Close menu when clicking outside the nav
    document.addEventListener('click', (e) => {
      if (
        navLinks.classList.contains('mobile-open') &&
        !navLinks.contains(e.target) &&
        !mobileToggle.contains(e.target)
      ) {
        navLinks.classList.remove('mobile-open');
        mobileToggle.setAttribute('aria-expanded', 'false');
        const spans = mobileToggle.querySelectorAll('span');
        spans[0].style.transform = 'none';
        spans[1].style.opacity   = '1';
        spans[2].style.transform = 'none';
      }
    });
  }

  // ---- SMOOTH SCROLL FOR ANCHOR LINKS ----
  // BUG FIX: querySelector throws if href is exactly '#' (empty fragment).
  // Added a guard so we only scroll when there is an actual target selector.
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const href = this.getAttribute('href');
      if (!href || href === '#') return; // nothing to scroll to
      e.preventDefault();
      const target = document.querySelector(href);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // ---- NAVBAR SHADOW ON SCROLL ----
  const navbar = document.querySelector('.navbar');
  if (navbar) {
    window.addEventListener('scroll', () => {
      navbar.style.boxShadow = window.scrollY > 50
        ? '0 4px 20px rgba(0,0,0,0.2)'
        : 'none';
    }, { passive: true });
  }

  // ---- MODAL CLOSE ON OUTSIDE CLICK ----
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('active');
    });
  });

  // ---- CURRENT YEAR IN FOOTER ----
  const yearSpan = document.querySelector('.current-year');
  if (yearSpan) yearSpan.textContent = new Date().getFullYear();

});

// ---- UTILITIES ----

/** Format a number as Kenyan Shillings */
function formatKES(amount) {
  return 'KES ' + Number(amount).toLocaleString('en-KE');
}

/** Debounce: delays fn until ms milliseconds after the last call */
function debounce(fn, ms = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/** Show a toast notification (auto-dismisses after `duration` ms) */
function showToast(message, type = 'info', duration = 3500) {
  const existing = document.querySelector('.toast-notification');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast-notification toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  // Trigger entrance animation
  requestAnimationFrame(() => toast.classList.add('toast-visible'));

  setTimeout(() => {
    toast.classList.remove('toast-visible');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }, duration);
}