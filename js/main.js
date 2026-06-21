// ============================================
// MAIN.JS - Shared functionality, all pages
// SDA Embakasi Central – Ambassadors Club
// ============================================

document.addEventListener('DOMContentLoaded', () => {

  // ---- ACTIVE NAV LINK ----
  const rawPage = window.location.pathname.split('/').pop();
  const currentPage = rawPage === '' ? 'index.html' : rawPage;

  document.querySelectorAll('.nav-links a').forEach(link => {
    const linkHref = link.getAttribute('href');
    const normHref = linkHref === '' ? 'index.html' : linkHref;
    if (normHref === currentPage) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });

  // ---- MOBILE MENU TOGGLE ----
  const mobileToggle = document.getElementById('mobileToggle');
  const navLinks    = document.getElementById('navLinks');

  if (mobileToggle && navLinks) {
    mobileToggle.addEventListener('click', () => {
      const isOpen = navLinks.classList.toggle('mobile-open');
      mobileToggle.setAttribute('aria-expanded', isOpen);
      document.body.classList.toggle('menu-open', isOpen);

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
        document.body.classList.remove('menu-open');
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
        document.body.classList.remove('menu-open');
        const spans = mobileToggle.querySelectorAll('span');
        spans[0].style.transform = 'none';
        spans[1].style.opacity   = '1';
        spans[2].style.transform = 'none';
      }
    });
  }

  // ---- SMOOTH SCROLL FOR ANCHOR LINKS ----
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const href = this.getAttribute('href');
      if (!href || href === '#') return;
      e.preventDefault();
      const target = document.querySelector(href);
      if (target) {
        const navHeight = document.querySelector('.navbar')?.offsetHeight || 0;
        const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - navHeight;
        window.scrollTo({ top: targetPosition, behavior: 'smooth' });
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

  // ---- BACK TO TOP BUTTON ----
  initBackToTop();

  // ---- NEWSLETTER FORM ----
  initNewsletterForm();

});

// ---- BACK TO TOP ----
function initBackToTop() {
  const backToTop = document.getElementById('backToTop');
  if (!backToTop) return;

  window.addEventListener('scroll', () => {
    if (window.pageYOffset > 500) {
      backToTop.classList.add('visible');
    } else {
      backToTop.classList.remove('visible');
    }
  }, { passive: true });

  backToTop.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

// ---- NEWSLETTER FORM ----
function initNewsletterForm() {
  const form = document.getElementById('newsletterForm');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('newsletterEmail').value;
    if (email && email.includes('@')) {
      showToast('Thank you for subscribing! You will receive updates soon.', 'success');
      form.reset();
    } else {
      showToast('Please enter a valid email address.', 'error');
    }
  });
}

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