// ============================================================
//  CHOIR PAGE — choir.js
//  Data layer: Supabase (primary) → localStorage → hardcoded
// ============================================================

const CHOIR_ADMIN_PASSWORD = 'ambassadors2026'; // ← same as members, change if needed
const CHOIR_STORAGE_KEY    = 'sda_choir_data';

const voicePartLabels = {
  soprano: 'Soprano',
  alto:    'Alto',
  tenor:   'Tenor',
  bass:    'Bass'
};
const ALL_PARTS = Object.keys(voicePartLabels);

// ---- STATE ----
let choirRoster     = { soprano: [], alto: [], tenor: [], bass: [] };
let isAdmin         = false;
let editingMemberId = null;
let activeVoice     = 'soprano';

// ============================================================
//  SUPABASE HELPERS
// ============================================================

function hasSupabase() {
  return typeof supabaseClient !== 'undefined';
}

function fromSupabaseRow(m) {
  return {
    id:        m.id,
    firstName: m.first_name  || '',
    lastName:  m.last_name   || '',
    voicePart: (m.voice_part || '').toLowerCase(),
    role:      m.role        || 'Member'
  };
}

function toSupabaseRow(m) {
  return {
    first_name: m.firstName,
    last_name:  m.lastName,
    voice_part: m.voicePart,
    role:       m.role
  };
}

// ============================================================
//  DATA LOADING
// ============================================================

async function loadChoir() {
  if (hasSupabase()) {
    try {
      const { data, error } = await supabaseClient
        .from('choir_members')
        .select('*')
        .order('voice_part', { ascending: true })
        .order('role',       { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        buildRosterFromArray(data.map(fromSupabaseRow));
        saveLocalCache();
        console.log(`✅ Loaded ${data.length} choir members from Supabase`);
        return;
      }
    } catch (err) {
      console.warn('Supabase choir load failed:', err.message);
      showToast('Could not reach database — showing cached data', 'error');
    }
  }

  // localStorage fallback
  try {
    const stored = localStorage.getItem(CHOIR_STORAGE_KEY);
    if (stored) {
      const flat = JSON.parse(stored);
      buildRosterFromArray(flat);
      console.log('ℹ️ Loaded choir from localStorage');
      return;
    }
  } catch { /* ignore */ }

  // Hardcoded fallback
  buildRosterFromArray(getHardcodedFallback());
  console.log('ℹ️ Using hardcoded choir fallback');
}

/** Takes a flat array of members and populates choirRoster by voice part */
function buildRosterFromArray(members) {
  choirRoster = { soprano: [], alto: [], tenor: [], bass: [] };
  members.forEach(m => {
    const part = (m.voicePart || '').toLowerCase();
    if (choirRoster[part]) choirRoster[part].push(m);
  });
}

/** Returns a single flat array of all choir members */
function flatRoster() {
  return ALL_PARTS.flatMap(p => choirRoster[p]);
}

function saveLocalCache() {
  localStorage.setItem(CHOIR_STORAGE_KEY, JSON.stringify(flatRoster()));
}

// ============================================================
//  SUPABASE WRITE OPERATIONS
// ============================================================

async function supabaseInsert(memberObj) {
  if (!hasSupabase()) return null;
  const { data, error } = await supabaseClient
    .from('choir_members')
    .insert([toSupabaseRow(memberObj)])
    .select()
    .single();
  if (error) throw error;
  return fromSupabaseRow(data);
}

async function supabaseUpdate(id, memberObj) {
  if (!hasSupabase()) return;
  const { error } = await supabaseClient
    .from('choir_members')
    .update(toSupabaseRow(memberObj))
    .eq('id', id);
  if (error) throw error;
}

async function supabaseDelete(id) {
  if (!hasSupabase()) return;
  const { error } = await supabaseClient
    .from('choir_members')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ============================================================
//  RENDER
// ============================================================

function renderVoiceRoster(voice) {
  activeVoice = voice;
  const container = document.getElementById('voiceRoster');
  if (!container) return;

  const members   = choirRoster[voice] || [];
  const partLabel = voicePartLabels[voice] || voice;

  // Update tab counts
  ALL_PARTS.forEach(p => {
    const tab = document.querySelector(`.voice-tab[data-voice="${p}"] .tab-count`);
    if (tab) tab.textContent = `${choirRoster[p].length} member${choirRoster[p].length !== 1 ? 's' : ''}`;
  });

  // Update hero member count
  const countEl = document.querySelector('.c-number[data-count]');
  if (countEl) countEl.textContent = flatRoster().length;

  if (members.length === 0) {
    container.innerHTML = `
      <div class="choir-empty">
        <p>No ${partLabel} members yet.${isAdmin ? ' Use "+ Add Member" to add one.' : ''}</p>
      </div>`;
    return;
  }

  container.innerHTML = members.map(m => `
    <div class="choir-member-card">
      ${isAdmin ? `
        <div class="admin-card-actions" onclick="event.stopPropagation()">
          <button class="admin-card-btn" onclick="openEditModal(${m.id})" title="Edit">✏️</button>
          <button class="admin-card-btn" onclick="deleteChoirMember(${m.id})" title="Delete">🗑️</button>
        </div>` : ''}
      <div class="cm-avatar">${getInitials(m.firstName, m.lastName)}</div>
      <h4>${escHtml(m.firstName)} ${escHtml(m.lastName)}</h4>
      <span class="cm-part">${partLabel} &middot; ${escHtml(m.role)}</span>
    </div>
  `).join('');
}

function renderRepertoire() {
  const container = document.getElementById('repertoireList');
  if (!container) return;
  container.innerHTML = repertoireData.map((song, i) => `
    <div class="rep-item">
      <span class="rep-number">${i + 1}</span>
      <div class="rep-info">
        <h4>${escHtml(song.title)}</h4>
        <p>${escHtml(song.description)}</p>
      </div>
      <span class="rep-tag ${song.type}">${song.typeLabel}</span>
    </div>
  `).join('');
}

// ============================================================
//  ADMIN — LOGIN / LOGOUT
// ============================================================

function promptAdminLogin() {
  const pwd = prompt('Enter admin password:');
  if (pwd === null) return;
  if (pwd === CHOIR_ADMIN_PASSWORD) {
    isAdmin = true;
    sessionStorage.setItem('sda_admin', '1');
    updateAdminUI();
    renderVoiceRoster(activeVoice);
    showToast('Admin mode enabled ✓', 'success');
  } else {
    showToast('Incorrect password', 'error');
  }
}

function adminLogout() {
  isAdmin = false;
  sessionStorage.removeItem('sda_admin');
  updateAdminUI();
  renderVoiceRoster(activeVoice);
  showToast('Logged out of admin mode');
}

function updateAdminUI() {
  const bar      = document.getElementById('adminBar');
  const loginBtn = document.getElementById('adminLoginBtn');

  if (bar) {
    bar.style.cssText = isAdmin
      ? 'display:flex !important; align-items:center; gap:1rem; background:#1a365d; color:white; padding:0.6rem 2rem; font-size:0.85rem; position:relative; z-index:9999;'
      : 'display:none !important;';
  }
  if (loginBtn) loginBtn.style.display = isAdmin ? 'none' : 'inline-block';
}

// ============================================================
//  ADMIN — ADD / EDIT FORM
// ============================================================

function openAddModal() {
  editingMemberId = null;
  populateForm(null);
  document.getElementById('choirFormTitle').textContent = 'Add Choir Member';
  document.getElementById('choirFormModal').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function openEditModal(id) {
  const m = flatRoster().find(x => x.id === id);
  if (!m) return;
  editingMemberId = id;
  populateForm(m);
  document.getElementById('choirFormTitle').textContent = 'Edit Choir Member';
  document.getElementById('choirFormModal').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeChoirFormModal() {
  document.getElementById('choirFormModal').classList.remove('active');
  document.body.style.overflow = '';
  editingMemberId = null;
}

function populateForm(m) {
  document.getElementById('cfFirstName').value = m?.firstName || '';
  document.getElementById('cfLastName').value  = m?.lastName  || '';
  document.getElementById('cfVoicePart').value = m?.voicePart || activeVoice;
  document.getElementById('cfRole').value      = m?.role      || 'Member';
  document.getElementById('choirFormError').textContent = '';

  const saveBtn = document.getElementById('choirFormSave');
  if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save Member'; }
}

async function saveChoirForm() {
  const firstName = document.getElementById('cfFirstName').value.trim();
  const lastName  = document.getElementById('cfLastName').value.trim();
  const voicePart = document.getElementById('cfVoicePart').value;
  const role      = document.getElementById('cfRole').value.trim() || 'Member';

  const errEl   = document.getElementById('choirFormError');
  const saveBtn = document.getElementById('choirFormSave');

  if (!firstName || !lastName) { errEl.textContent = 'First and last name are required.'; return; }
  if (!voicePart)              { errEl.textContent = 'Please select a voice part.'; return; }
  errEl.textContent = '';

  saveBtn.disabled    = true;
  saveBtn.textContent = 'Saving…';

  const memberObj = { firstName, lastName, voicePart, role };

  try {
    if (editingMemberId !== null) {
      // UPDATE
      await supabaseUpdate(editingMemberId, memberObj);

      // Update in local roster
      ALL_PARTS.forEach(p => {
        const idx = choirRoster[p].findIndex(x => x.id === editingMemberId);
        if (idx !== -1) choirRoster[p].splice(idx, 1); // remove from old part
      });
      if (!choirRoster[voicePart]) choirRoster[voicePart] = [];
      choirRoster[voicePart].push({ id: editingMemberId, ...memberObj });

      showToast(`${firstName} ${lastName} updated ✓`, 'success');

    } else {
      // INSERT
      if (hasSupabase()) {
        const saved = await supabaseInsert(memberObj);
        if (!choirRoster[voicePart]) choirRoster[voicePart] = [];
        choirRoster[voicePart].push(saved);
      } else {
        const all   = flatRoster();
        const newId = all.length > 0 ? Math.max(...all.map(x => x.id)) + 1 : 1;
        if (!choirRoster[voicePart]) choirRoster[voicePart] = [];
        choirRoster[voicePart].push({ id: newId, ...memberObj });
      }
      showToast(`${firstName} ${lastName} added ✓`, 'success');
    }

    saveLocalCache();
    closeChoirFormModal();

    // Switch to the tab of the saved member
    document.querySelectorAll('.voice-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.voice-tab[data-voice="${voicePart}"]`)?.classList.add('active');
    renderVoiceRoster(voicePart);

  } catch (err) {
    console.error('Save failed:', err);
    errEl.textContent   = `Save failed: ${err.message}`;
    saveBtn.disabled    = false;
    saveBtn.textContent = 'Save Member';
  }
}

// ============================================================
//  ADMIN — DELETE
// ============================================================

async function deleteChoirMember(id) {
  const m = flatRoster().find(x => x.id === id);
  if (!m) return;
  if (!confirm(`Remove ${m.firstName} ${m.lastName} from the choir?\n\nThis cannot be undone.`)) return;

  try {
    await supabaseDelete(id);
    ALL_PARTS.forEach(p => {
      choirRoster[p] = choirRoster[p].filter(x => x.id !== id);
    });
    saveLocalCache();
    renderVoiceRoster(activeVoice);
    showToast(`${m.firstName} ${m.lastName} removed`, 'error');
  } catch (err) {
    console.error('Delete failed:', err);
    showToast(`Delete failed: ${err.message}`, 'error');
  }
}

// ============================================================
//  COUNTER ANIMATION
// ============================================================

function animateCounters() {
  const counters  = document.querySelectorAll('.c-number[data-count]');
  const observer  = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el  = entry.target;
        const end = flatRoster().length || parseInt(el.dataset.count) || 0;
        animateCount(el, end);
        observer.unobserve(el);
      }
    });
  }, { threshold: 0.5 });
  counters.forEach(c => observer.observe(c));
}

function animateCount(el, target) {
  let current = 0;
  const step  = Math.max(1, Math.ceil(target / 40));
  const timer = setInterval(() => {
    current += step;
    if (current >= target) { el.textContent = target; clearInterval(timer); }
    else                     el.textContent = current;
  }, 30);
}

// ============================================================
//  HELPERS
// ============================================================

function getInitials(first, last) {
  return ((first || ' ')[0] + (last || ' ')[0]).toUpperCase();
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function showToast(msg, type = 'info') {
  const existing = document.getElementById('sdaToast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.id        = 'sdaToast';
  toast.className = `sda-toast sda-toast--${type}`;
  toast.textContent = msg;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('sda-toast--show'));
  setTimeout(() => {
    toast.classList.remove('sda-toast--show');
    setTimeout(() => toast.remove(), 400);
  }, 3000);
}

// ============================================================
//  REPERTOIRE DATA (static — edit here)
// ============================================================
const repertoireData = [
  { title: "Tukutendereza",          type: "hymn",    typeLabel: "Hymn",    description: "Traditional Swahili worship song" },
  { title: "Amazing Grace",          type: "hymn",    typeLabel: "Hymn",    description: "Classic gospel hymn arrangement" },
  { title: "Hakuna Mungu Kama Wewe", type: "praise",  typeLabel: "Praise",  description: "Contemporary Swahili praise" },
  { title: "How Great Thou Art",     type: "hymn",    typeLabel: "Hymn",    description: "Grand worship anthem" },
  { title: "Kuna Siku",              type: "special", typeLabel: "Special", description: "Special music for divine service" },
  { title: "It Is Well",             type: "hymn",    typeLabel: "Hymn",    description: "Peaceful hymn arrangement" },
  { title: "Mungu Yu Mwema",         type: "praise",  typeLabel: "Praise",  description: "Upbeat praise and worship" },
  { title: "Great Is Thy Faithfulness", type: "hymn", typeLabel: "Hymn",   description: "Thanksgiving hymn" }
];

// ============================================================
//  INIT
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
  if (sessionStorage.getItem('sda_admin') === '1') isAdmin = true;

  await loadChoir();
  updateAdminUI();
  renderVoiceRoster('soprano');
  renderRepertoire();
  animateCounters();

  // Voice tabs
  document.querySelectorAll('.voice-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.voice-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderVoiceRoster(tab.dataset.voice);
    });
  });

  // Form modal
  document.getElementById('choirFormClose')?.addEventListener('click', closeChoirFormModal);
  document.getElementById('choirFormModal')?.addEventListener('click', e => {
    if (e.target === e.currentTarget || e.target.classList.contains('modal-overlay'))
      closeChoirFormModal();
  });
  document.getElementById('choirFormSave')?.addEventListener('click', saveChoirForm);

  // Admin controls
  document.getElementById('adminLoginBtn')?.addEventListener('click', promptAdminLogin);
  document.getElementById('adminLogoutBtn')?.addEventListener('click', adminLogout);
  document.getElementById('adminAddBtn')?.addEventListener('click', openAddModal);

  // Escape key
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeChoirFormModal();
  });
});

// ============================================================
//  HARDCODED FALLBACK
// ============================================================
function getHardcodedFallback() {
  return [
    { id:1,  firstName:"Sarah",   lastName:"Wanjiku",    voicePart:"soprano", role:"Section Leader" },
    { id:2,  firstName:"Grace",   lastName:"Muthoni",    voicePart:"soprano", role:"Member" },
    { id:3,  firstName:"Faith",   lastName:"Njeri",      voicePart:"soprano", role:"Member" },
    { id:4,  firstName:"Mary",    lastName:"Atieno",     voicePart:"soprano", role:"Member" },
    { id:5,  firstName:"Joyce",   lastName:"Wambui",     voicePart:"soprano", role:"Member" },
    { id:6,  firstName:"Linda",   lastName:"Akinyi",     voicePart:"soprano", role:"Member" },
    { id:7,  firstName:"Esther",  lastName:"Achieng",    voicePart:"alto",    role:"Section Leader" },
    { id:8,  firstName:"Ruth",    lastName:"Mwangi",     voicePart:"alto",    role:"Member" },
    { id:9,  firstName:"Diana",   lastName:"Kemunto",    voicePart:"alto",    role:"Member" },
    { id:10, firstName:"Cynthia", lastName:"Omondi",     voicePart:"alto",    role:"Member" },
    { id:11, firstName:"Ann",     lastName:"Wairimu",    voicePart:"alto",    role:"Member" },
    { id:12, firstName:"Beatrice",lastName:"Nduku",      voicePart:"alto",    role:"Member" },
    { id:13, firstName:"Michael", lastName:"Kipchirchir",voicePart:"tenor",   role:"Section Leader" },
    { id:14, firstName:"David",   lastName:"Mutua",      voicePart:"tenor",   role:"Member" },
    { id:15, firstName:"James",   lastName:"Otieno",     voicePart:"tenor",   role:"Member" },
    { id:16, firstName:"Paul",    lastName:"Karanja",    voicePart:"tenor",   role:"Member" },
    { id:17, firstName:"Peter",   lastName:"Ochieng",    voicePart:"tenor",   role:"Member" },
    { id:18, firstName:"John",    lastName:"Kamau",      voicePart:"tenor",   role:"Member" },
    { id:19, firstName:"Daniel",  lastName:"Mwangi",     voicePart:"bass",    role:"Section Leader" },
    { id:20, firstName:"Joseph",  lastName:"Kibet",      voicePart:"bass",    role:"Member" },
    { id:21, firstName:"Samuel",  lastName:"Ndungu",     voicePart:"bass",    role:"Member" },
    { id:22, firstName:"Stephen", lastName:"Oduor",      voicePart:"bass",    role:"Member" },
    { id:23, firstName:"Mark",    lastName:"Wekesa",     voicePart:"bass",    role:"Member" },
    { id:24, firstName:"Simon",   lastName:"Kiprono",    voicePart:"bass",    role:"Member" }
  ];
}