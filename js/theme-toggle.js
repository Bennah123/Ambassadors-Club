// ============================================================
//  THEME-TOGGLE.JS — SDA Ambassadors Club
//  Handles: system-preference detection, localStorage persistence,
//  toggle button wiring. The early-apply snippet (in <head>, inline)
//  handles avoiding a flash of the wrong theme before this loads.
// ============================================================

const THEME_KEY = 'sda_theme_preference'; // 'light' | 'dark' | not set = follow system

function getStoredTheme() {
  try { return localStorage.getItem(THEME_KEY); } catch { return null; }
}

function getSystemTheme() {
  return globalThis.matchMedia && globalThis.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark' : 'light';
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

function setTheme(theme) {
  applyTheme(theme);
  try { localStorage.setItem(THEME_KEY, theme); } catch { /* ignore */ }
}

function currentTheme() {
  return document.documentElement.getAttribute('data-theme') || 'light';
}

function toggleTheme() {
  setTheme(currentTheme() === 'dark' ? 'light' : 'dark');
}

// Keep in sync if the user changes their OS theme while the site is open,
// but only when they haven't explicitly chosen a theme on this site.
function watchSystemChanges() {
  if (!globalThis.matchMedia) return;
  const mq = globalThis.matchMedia('(prefers-color-scheme: dark)');
  const handler = (e) => {
    if (getStoredTheme()) return; // user has an explicit preference — don't override it
    applyTheme(e.matches ? 'dark' : 'light');
  };
  if (mq.addEventListener) mq.addEventListener('change', handler);
  else if (mq.addListener) mq.addListener(handler); // Safari fallback
}

function injectToggleButton() {
  if (document.querySelector('.theme-toggle')) return; // already present (e.g. hardcoded in HTML)

  const btn = document.createElement('button');
  btn.className = 'theme-toggle';
  btn.setAttribute('aria-label', 'Toggle dark mode');
  btn.innerHTML = `
    <svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
    <svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
  `;
  btn.addEventListener('click', toggleTheme);

  const navLinks = document.getElementById('navLinks');
  const mobileToggle = document.getElementById('mobileToggle');
  const navbar = document.getElementById('navbar');

  if (mobileToggle && mobileToggle.parentNode === navbar) {
    navbar.insertBefore(btn, mobileToggle);
  } else if (navLinks) {
    navLinks.after(btn);
  } else if (navbar) {
    navbar.appendChild(btn);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const stored = getStoredTheme();
  applyTheme(stored || getSystemTheme());
  watchSystemChanges();
  injectToggleButton();
});