"use strict";
/**
 * Global Supabase configuration.
 *
 * Creates a single reusable client instance
 * for the entire application.
 *
 * Every page should use
 * globalThis.supabaseClient
 * instead of creating a new client.
 */
const CONFIG = Object.freeze({
    url: "https://vqqhpuxazqlnbuujfsss.supabase.co",
    anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxcWhwdXhhenFsbmJ1dWpmc3NzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5NjkzMjksImV4cCI6MjA5NzU0NTMyOX0.9Sv9IwV79bdTPxiwpV4vu_Kvm7TEhq65PTIyAfB61RA"
});
CONFIG.url
CONFIG.anonKey
if (!globalThis.supabase) {
    throw new Error("Supabase library failed to load.");
}
if (!globalThis.supabaseClient) {
    globalThis.supabaseClient = globalThis.supabase.createClient(
        CONFIG.url,
        CONFIG.anonKey
    );
}