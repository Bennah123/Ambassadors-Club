// ============================================
// ABOUT.JS — About page logic
// SDA Embakasi Central – Ambassadors Club
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  initScrollReveal();
});

function initScrollReveal() {
  const els = document.querySelectorAll('.reveal-section, .reveal-child');
  if (!els.length) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('in-view'); io.unobserve(e.target); }
    });
  }, { threshold: 0.10, rootMargin: '0px 0px -40px 0px' });
  els.forEach(el => io.observe(el));
}