// ============================================================
//  NEWSLETTER-WIDGET.JS — SDA Ambassadors Club
//  Drop this script on every page that has the newsletter form.
//  Saves subscriber email to Supabase newsletter_subscribers table.
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.newsletter-form').forEach(form => {
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const input = form.querySelector('input[type="email"]');
      const btn   = form.querySelector('button[type="submit"]');
      const note  = form.querySelector('.newsletter-note');
      const email = input?.value.trim();

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        if (note) { note.textContent = 'Please enter a valid email.'; note.style.color='#dc2626'; }
        return;
      }

      if (btn) { btn.disabled=true; btn.textContent='Subscribing…'; }

      try {
        if (typeof supabaseClient !== 'undefined') {
          const { error } = await supabaseClient
            .from('newsletter_subscribers')
            .upsert([{ email, subscribed: true }], { onConflict: 'email' });
          if (error) throw error;
        }
        input.value = '';
        if (note)  { note.textContent='✓ Subscribed! You\'ll hear from us soon.'; note.style.color='var(--sage)'; }
        if (btn)   { btn.disabled=false; btn.textContent='Subscribe'; }
        setTimeout(() => { if(note){note.textContent='No spam. Unsubscribe anytime.'; note.style.color='';} }, 4000);
      } catch(err) {
        if (note)  { note.textContent='Already subscribed or error: '+err.message; note.style.color='#dc2626'; }
        if (btn)   { btn.disabled=false; btn.textContent='Subscribe'; }
      }
    });
  });
});