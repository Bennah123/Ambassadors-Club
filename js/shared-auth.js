// ============================================================
//  SHARED-AUTH.JS — SDA Ambassadors Club
//  Load this on EVERY page before any other page script.
//  Sets window.isAdmin = true/false based on Supabase session.
//  Dispatches 'adminReady' event when resolved.
// ============================================================

window.isAdmin = false;

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

      window.isAdmin    = profile?.role === 'admin' && profile?.approved === true;
      window.userProfile = profile;
      window.authUser    = session.user;
    }
  } catch (e) {
    console.warn('Auth check failed:', e.message);
  }

  document.dispatchEvent(new Event('adminReady'));
})();