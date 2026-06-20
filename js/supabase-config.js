// ============================================
// SUPABASE CONFIGURATION - SDA Embakasi Central
// ============================================

// REPLACE THESE WITH YOUR ACTUAL SUPABASE CREDENTIALS
const SUPABASE_URL = 'https://vqqhpuxazqlnbuujfsss.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxcWhwdXhhenFsbmJ1dWpmc3NzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5NjkzMjksImV4cCI6MjA5NzU0NTMyOX0.9Sv9IwV79bdTPxiwpV4vu_Kvm7TEhq65PTIyAfB61RA';

// Initialize Supabase client
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Export for use in other files
window.supabaseClient = supabase;