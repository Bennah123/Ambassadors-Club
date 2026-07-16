// ============================================================
//  SHARED-AUTH.JS — SDA Ambassadors Club
//  Load this on EVERY page before any other page script.
//  Sets globalThis.isAdmin = true/false based on Supabase session.
//  Dispatches 'adminReady' event when resolved.
// ============================================================

globalThis.isAdmin = false;

(async () => {
  if (typeof supabaseClient === 'undefined') {
    document.dispatchEvent(new Event('adminReady'));
    return;
  }

  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
      const { data: profile } = await supabaseClient
        .from('profiles')
        .select('role, approved')
        .eq('id', session.user.id)
        .single();

      globalThis.isAdmin    = profile?.role === 'admin' && profile?.approved === true;
      globalThis.userProfile = profile;
      globalThis.authUser    = session.user;
    }
  } catch (e) {
    console.warn('Auth check failed:', e.message);
  }

  document.dispatchEvent(new Event('adminReady'));
})();