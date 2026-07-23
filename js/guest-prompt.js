// ============================================================
//  GUEST-PROMPT.JS — SDA Ambassadors Club
//  Shows a soft, dismissible "join us" card to guests who have
//  been browsing a while. Never shown to signed-in users.
//  Include on public pages, after shared-auth.js.
// ============================================================

(function () {
  const DELAY_MS = 45000;           // show after 45s of browsing
  const SNOOZE_DAYS = 7;            // if dismissed, wait this long before showing again
  const SNOOZE_KEY = 'sda_guest_prompt_snoozed_until';

  function isSnoozed() {
    try {
      const until = localStorage.getItem(SNOOZE_KEY);
      return until && Date.now() < Number(until);
    } catch (_e) { return false; }
  }

  function snooze() {
    try { localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_DAYS * 86400000)); } catch (_e) {Error}
  }

  function showPrompt() {
    if (document.getElementById('guestPromptCard')) return;

    const card = document.createElement('div');
    card.id = 'guestPromptCard';
    card.innerHTML = `
      <button id="guestPromptClose" aria-label="Dismiss">&times;</button>
      <p class="gp-title">Enjoying what you see?</p>
      <p class="gp-body">Join the Ambassadors Club family — sign up to connect with members, join the choir, and stay in the loop.</p>
      <div class="gp-actions">
        <a href="auth.html" class="btn btn-gold">Sign Up</a>
        <button id="guestPromptLater">Maybe later</button>
      </div>`;
    document.body.appendChild(card);
    requestAnimationFrame(() => card.classList.add('gp-visible'));

    document.getElementById('guestPromptClose').addEventListener('click', () => { snooze(); dismiss(); });
    document.getElementById('guestPromptLater').addEventListener('click', () => { snooze(); dismiss(); });

    function dismiss() {
      card.classList.remove('gp-visible');
      setTimeout(() => card.remove(), 300);
    }
  }

  function init() {
    // Only for true guests — never for signed-in members or admins.
    if (globalThis.authUser) return;
    if (isSnoozed()) return;
    setTimeout(() => {
      if (!globalThis.authUser) showPrompt();
    }, DELAY_MS);
  }

  // Wait for shared-auth.js to resolve session state first.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => document.addEventListener('adminReady', init, { once: true }));
  } else {
    document.addEventListener('adminReady', init, { once: true });
  }
  // Fallback in case adminReady never fires (e.g. shared-auth.js missing).
  setTimeout(init, 3000);
})();