// ============================================
// SCHEDULE.JS – Schedule page logic
// SDA Embakasi Central – Ambassadors Club
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  initScrollReveal();
  initChipScrollSpy();
  initChipSmoothScroll();
});

// =====================================================
// SCROLL REVEAL
// Animates .reveal-child elements as they enter view
// =====================================================
function initScrollReveal() {
  const els = document.querySelectorAll('.reveal-child, .reveal-section');
  if (!els.length) return;

  els.forEach(el => {
    el.style.opacity   = '0';
    el.style.transform = 'translateY(24px)';
    el.style.transition = 'opacity 0.55s ease, transform 0.55s ease';
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
// CHIP SMOOTH SCROLL
// Clicking a chip scrolls smoothly to the target block,
// offset by the sticky navbar height.
// =====================================================
function initChipSmoothScroll() {
  const chips = document.querySelectorAll('.chip[href^="#"]');
  const navbarH = () => document.getElementById('navbar')?.offsetHeight || 80;

  chips.forEach(chip => {
    chip.addEventListener('click', e => {
      e.preventDefault();
      const target = document.querySelector(chip.getAttribute('href'));
      if (!target) return;
      const top = target.getBoundingClientRect().top + window.pageYOffset - navbarH() - 16;
      window.scrollTo({ top, behavior: 'smooth' });
    });
  });
}

// =====================================================
// CHIP SCROLL SPY
// Highlights the chip whose section is in view
// =====================================================
function initChipScrollSpy() {
  const sections = [
    { id: 'sabbath',   chip: document.querySelector('.chip[href="#sabbath"]') },
    { id: 'wednesday', chip: document.querySelector('.chip[href="#wednesday"]') },
    { id: 'friday',    chip: document.querySelector('.chip[href="#friday"]') },
  ].filter(s => s.chip && document.getElementById(s.id));

  if (!sections.length) return;

  const activate = (chip) => {
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('chip-active'));
    chip.classList.add('chip-active');
  };

  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const match = sections.find(s => s.id === entry.target.id);
        if (match) activate(match.chip);
      }
    });
  }, {
    rootMargin: '-30% 0px -60% 0px',
    threshold: 0
  });

  sections.forEach(s => io.observe(document.getElementById(s.id)));
}