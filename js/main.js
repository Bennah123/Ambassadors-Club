document.addEventListener('DOMContentLoaded', () => {

  // ---- ACTIVE NAV LINK ----
  const rawPage = globalThis.location.pathname.split('/').pop();
  const currentPage = rawPage === '' ? 'index.html' : rawPage;
  document.querySelectorAll('.nav-links a').forEach(link => {
    const href = link.getAttribute('href') || '';
    const norm = href === '' ? 'index.html' : href;
    link.classList.toggle('active', norm === currentPage);
  });

  // ---- MOBILE MENU ----
  const mobileToggle = document.getElementById('mobileToggle');
  const navLinks     = document.getElementById('navLinks');

  if (mobileToggle && navLinks) {
    mobileToggle.addEventListener('click', () => {
      const isOpen = navLinks.classList.toggle('mobile-open');
      mobileToggle.setAttribute('aria-expanded', isOpen);
      document.body.classList.toggle('menu-open', isOpen);
      const [s1, s2, s3] = mobileToggle.querySelectorAll('span');
      if (isOpen) {
        s1.style.transform = 'rotate(45deg) translate(5px, 5px)';
        s2.style.opacity   = '0';
        s3.style.transform = 'rotate(-45deg) translate(5px, -5px)';
      } else {
        s1.style.transform = s3.style.transform = 'none';
        s2.style.opacity = '1';
      }
    });

    const closeMenu = () => {
      navLinks.classList.remove('mobile-open');
      mobileToggle.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('menu-open');
      mobileToggle.querySelectorAll('span').forEach((s, i) => {
        s.style.transform = 'none';
        if (i === 1) s.style.opacity = '1';
      });
    };

    navLinks.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));
    document.addEventListener('click', e => {
      if (navLinks.classList.contains('mobile-open') &&
          !navLinks.contains(e.target) &&
          !mobileToggle.contains(e.target)) closeMenu();
    });
  }

  // ---- NAVBAR SCROLL ----
  const navbar = document.getElementById('navbar');
  if (navbar) {
    globalThis.addEventListener('scroll', () => {
      navbar.classList.toggle('scrolled', globalThis.scrollY > 60);
    }, { passive: true });
  }

  // ---- SMOOTH SCROLL ----
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const href = a.getAttribute('href');
      if (!href || href === '#') return;
      e.preventDefault();
      const target = document.querySelector(href);
      if (target) {
        const offset = (document.querySelector('.navbar')?.offsetHeight || 0) + 16;
        globalThis.scrollTo({ top: target.getBoundingClientRect().top + globalThis.pageYOffset - offset, behavior: 'smooth' });
      }
    });
  });

  // ---- CURRENT YEAR ----
  document.querySelectorAll('.current-year').forEach(el => el.textContent = new Date().getFullYear());

  // ---- BACK TO TOP ----
  const btn = document.getElementById('backToTop');
  if (btn) {
    globalThis.addEventListener('scroll', () => btn.classList.toggle('visible', globalThis.scrollY > 500), { passive: true });
    btn.addEventListener('click', () => globalThis.scrollTo({ top: 0, behavior: 'smooth' }));
  }

  // ---- NEWSLETTER ----
  const form = document.getElementById('newsletterForm');
  if (form) {
    form.addEventListener('submit', e => {
      e.preventDefault();
      const email = document.getElementById('newsletterEmail')?.value || '';
      if (email.includes('@')) {
        showToast('Thank you for subscribing!', 'success');
        form.reset();
      } else {
        showToast('Please enter a valid email address.', 'error');
      }
    });
  }

  // ---- MODALS ----
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('active'); });
  });

});

// ---- UTILITIES ----
function _formatKES(amount) {
  return 'KES ' + Number(amount).toLocaleString('en-KE');
}

function _debounce(fn, ms = 300) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}

function showToast(message, type = 'info', duration = 3500) {
  document.querySelector('.toast-notification')?.remove();
  const toast = document.createElement('div');
  toast.className = `toast-notification toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('toast-visible'));
  setTimeout(() => {
    toast.classList.remove('toast-visible');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }, duration);
}