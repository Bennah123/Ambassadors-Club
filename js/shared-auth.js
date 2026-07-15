"use strict";

/**
 * Shared authentication module.
 *
 * This file:
 * - Checks whether a user is logged in.
 * - Retrieves the user's profile.
 * - Determines whether the user is an approved admin.
 * - Makes authentication data globally available.
 * - Dispatches the "adminReady" event when complete.
 */

const ROLES = Object.freeze({
    ADMIN: "admin"
});

globalThis.isAdmin = false;
globalThis.userProfile = null;
globalThis.authUser = null;
globalThis.authLoading = true;

/**
 * Returns true if the supplied profile belongs
 * to an approved administrator.
 *
 * @param {Object|null} profile
 * @returns {boolean}
 */
function isApprovedAdmin(profile) {
    return (
        profile?.role === ROLES.ADMIN &&
        profile?.approved === true
    );
}

(async () => {

    // Ensure the Supabase client is available.
    if (typeof supabaseClient === "undefined") {
        console.warn("Supabase client is not available.");

        globalThis.authLoading = false;
        document.dispatchEvent(new Event("adminReady"));
        return;
    }

    try {

        const {
            data: { session }
        } = await supabaseClient.auth.getSession();

        if (session) {

            const { data: profile } = await supabaseClient
                .from("profiles")
                .select("role, approved")
                .eq("id", session.user.id)
                .single();

            if (!profile) {
                console.warn("Authenticated user profile not found.");
            } else {
                globalThis.isAdmin = isApprovedAdmin(profile);
                globalThis.userProfile = profile;
                globalThis.authUser = session.user;
            }
        }

    } catch (error) {

        console.warn("Authentication check failed:", error.message);

    } finally {

        globalThis.authLoading = false;

        // Notify the rest of the application that
        // authentication has finished loading.
        document.dispatchEvent(new Event("adminReady"));
    }

})();