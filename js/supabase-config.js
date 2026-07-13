// ============================================
// SUPABASE CONFIGURATION - SDA Embakasi Central
// ============================================

const SUPABASE_URL = 'https://vqqhpuxazqlnbuujfsss.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxcWhwdXhhenFsbmJ1dWpmc3NzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5NjkzMjksImV4cCI6MjA5NzU0NTMyOX0.9Sv9IwV79bdTPxiwpV4vu_Kvm7TEhq65PTIyAfB61RA';

// BUG FIX: was `supabase.createClient(...)` — self-reference before assignment.
// Must use the global from the CDN script: `globalThis.supabase.createClient(...)`
const supabaseClient = globalThis.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

globalThis.supabaseClient = supabaseClient;