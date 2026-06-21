// ============================================================
//  CHOIR PAGE — choir.js
//  Data: Supabase → localStorage cache
//  Add form: dropdown from members table (choir dept only)
// ============================================================

const CHOIR_ADMIN_PASSWORD = 'ambassadors2026';
const CHOIR_STORAGE_KEY    = 'sda_choir_data';

const voicePartLabels = {
  soprano:    'Soprano',
  alto:       'Alto',
  tenor:      'Tenor',
  bass:       'Bass',
  unassigned: 'Unassigned'
};
const VOICE_PARTS = ['soprano', 'alto', 'tenor', 'bass'];

// ---- STATE ----
let choirRoster     = { soprano: [], alto: [], tenor: [], bass: [], unassigned: [] };
let eligibleMembers = []; // members with choir dept, for dropdown
let isAdmin         = false;
let editingMemberId = null;
let activeVoice     = 'soprano';

// ============================================================
//  SUPABASE
// ============================================================

function hasSupabase() {
  return typeof supabaseClient !== 'undefined';
}

function fromSupabaseRow(m) {
  const part = (m.voice_part || '').toLowerCase();
  return {
    id:        m.id,
    firstName: m.first_name || '',
    lastName:  m.last_name  || '',
    voicePart: VOICE_PARTS.includes(part) ? part : 'unassigned',
    role:      m.role || 'Member'
  };
}

function toSupabaseRow(m) {
  return {
    first_name: m.firstName,
    last_name:  m.lastName,
    voice_part: m.voicePart === 'unassigned' ? null : m.voicePart,
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
        .order('last_name', { ascending: true });

      if (error) throw error;

      buildRosterFromArray((data || []).map(fromSupabaseRow));
      saveLocalCache();
      console.log(`✅ Loaded ${(data || []).length} choir members from Supabase`);
      return;

    } catch (err) {
      console.warn('Supabase choir load failed:', err.message);
      showToast('Could not reach database — showing cached data', 'error');
    }
  }

  try {
    const stored = localStorage.getItem(CHOIR_STORAGE_KEY);
    if (stored) { buildRosterFromArray(JSON.parse(stored)); return; }
  } catch { /* ignore */ }

  buildRosterFromArray([]);
}

/**
 * Load members who have 'choir' in their departments.
 * Used to populate the "Add Member" dropdown.
 */
async function loadEligibleMembers() {
  if (!hasSupabase()) return;
  try {
    const { data, error } = await supabaseClient
      .from('members')
      .select('id, first_name, last_name')
      .contains('departments', ['choir'])
      .order('last_name', { ascending: true });

    if (error) throw error;
    eligibleMembers = (data || []).map(m => ({
      id:        m.id,
      firstName: m.first_name || '',
      lastName:  m.last_name  || ''
    }));
    console.log(`✅ ${eligibleMembers.length} eligible choir members loaded`);
  } catch (err) {
    console.warn('Could not load eligible members:', err.message);
  }
}

function buildRosterFromArray(members) {
  choirRoster = { soprano: [], alto: [], tenor: [], bass: [], unassigned: [] };
  members.forEach(m => {
    const part = m.voicePart || 'unassigned';
    (choirRoster[part] = choirRoster[part] || []).push(m);
  });
}

function flatRoster() {
  return [...VOICE_PARTS, 'unassigned'].flatMap(p => choirRoster[p]);
}

function saveLocalCache() {
  localStorage.setItem(CHOIR_STORAGE_KEY, JSON.stringify(flatRoster()));
}

// ============================================================
//  SUPABASE WRITE
// ============================================================

async function supabaseInsert(memberObj) {
  const { data, error } = await supabaseClient
    .from('choir_members')
    .insert([toSupabaseRow(memberObj)])
    .select()
    .single();
  if (error) throw error;
  return fromSupabaseRow(data);
}

async function supabaseUpdate(id, memberObj) {
  const { error } = await supabaseClient
    .from('choir_members')
    .update(toSupabaseRow(memberObj))
    .eq('id', id);
  if (error) throw error;
}

async function supabaseDeleteRow(id) {
  const { error } = await supabaseClient
    .from('choir_members')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ============================================================
//  RENDER ROSTER
// ============================================================

function renderVoiceRoster(voice) {
  activeVoice = voice;
  const container = document.getElementById('voiceRoster');
  if (!container) return;

  const members   = choirRoster[voice] || [];
  const partLabel = voicePartLabels[voice] || voice;

  // Update all tab counts
  [...VOICE_PARTS, 'unassigned'].forEach(p => {
    const el = document.querySelector(`.voice-tab[data-voice="${p}"] .tab-count`);
    if (el) {
      const n = (choirRoster[p] || []).length;
      el.textContent = `${n} member${n !== 1 ? 's' : ''}`;
    }
  });

  // Show/hide unassigned tab
  const unassignedTab = document.querySelector('.voice-tab[data-voice="unassigned"]');
  if (unassignedTab) {
    unassignedTab.style.display = (choirRoster.unassigned || []).length > 0 ? 'flex' : 'none';
  }

  // Update hero count (assigned only)
  const heroCount = document.querySelector('.c-number[data-count]');
  if (heroCount) heroCount.textContent = VOICE_PARTS.flatMap(p => choirRoster[p]).length;

  if (members.length === 0) {
    container.innerHTML = `
      <div class="choir-empty">
        <p>${voice === 'unassigned'
          ? 'No unassigned members. New choir members from the Members page appear here.'
          : `No ${partLabel} members yet.${isAdmin ? ' Click "+ Add Member" to add one.' : ''}`}
        </p>
      </div>`;
    return;
  }

  container.innerHTML = members.map(m => `
    <div class="choir-member-card" style="position:relative;">
      ${isAdmin ? `
        <div class="admin-card-actions" onclick="event.stopPropagation()">
          <button class="admin-card-btn" onclick="openEditModal(${m.id})" title="Edit">✏️</button>
          <button class="admin-card-btn" onclick="deleteChoirMember(${m.id})" title="Remove">🗑️</button>
        </div>` : ''}
      <div class="cm-avatar">${getInitials(m.firstName, m.lastName)}</div>
      <h4>${escHtml(m.firstName)} ${escHtml(m.lastName)}</h4>
      <span class="cm-part">
        ${voice === 'unassigned'
          ? '<em style="color:var(--text-muted);font-style:italic;font-size:0.8rem;">Voice not assigned</em>'
          : `${partLabel} &middot; ${escHtml(m.role)}`}
      </span>
      ${voice === 'unassigned' && isAdmin
        ? `<button class="assign-voice-btn" onclick="openEditModal(${m.id})">Assign Voice ▾</button>`
        : ''}
    </div>
  `).join('');
}

function renderRepertoire() {
  const container = document.getElementById('repertoireList');
  if (!container) return;
  container.innerHTML = repertoireData.map((s, i) => `
    <div class="rep-item">
      <span class="rep-number">${i + 1}</span>
      <div class="rep-info"><h4>${escHtml(s.title)}</h4><p>${escHtml(s.description)}</p></div>
      <span class="rep-tag ${s.type}">${s.typeLabel}</span>
    </div>`).join('');
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
      ? 'display:flex !important;align-items:center;gap:1rem;background:#1a365d;color:white;padding:0.6rem 2rem;font-size:0.85rem;position:relative;z-index:9999;'
      : 'display:none !important;';
  }
  if (loginBtn) loginBtn.style.display = isAdmin ? 'none' : 'inline-block';
}

// ============================================================
//  ADMIN — FORM (ADD / EDIT)
// ============================================================

function openAddModal() {
  editingMemberId = null;
  resetForm();

  // Show member dropdown, hide name fields
  toggleFormMode('add');

  // Populate dropdown with eligible members not already in choir
  const alreadyIn = new Set(flatRoster().map(m => `${m.firstName}|${m.lastName}`));
  const available = eligibleMembers.filter(m => !alreadyIn.has(`${m.firstName}|${m.lastName}`));

  const select = document.getElementById('cfMemberSelect');
  if (select) {
    select.innerHTML = `<option value="">— Select a member —</option>` +
      available.map(m =>
        `<option value="${m.firstName}|${m.lastName}">${escHtml(m.firstName)} ${escHtml(m.lastName)}</option>`
      ).join('');

    if (available.length === 0) {
      select.innerHTML = `<option value="">No eligible members available</option>`;
    }
  }

  document.getElementById('choirFormTitle').textContent = 'Add Choir Member';
  document.getElementById('choirFormModal').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function openEditModal(id) {
  const m = flatRoster().find(x => x.id === id);
  if (!m) return;
  editingMemberId = id;
  resetForm();

  // Edit mode: show name as read-only text, no dropdown
  toggleFormMode('edit');

  document.getElementById('cfEditName').textContent  = `${m.firstName} ${m.lastName}`;
  document.getElementById('cfVoicePart').value        = m.voicePart === 'unassigned' ? '' : (m.voicePart || '');
  document.getElementById('cfRole').value             = m.role || 'Member';

  document.getElementById('choirFormTitle').textContent = 'Edit Choir Member';
  document.getElementById('choirFormModal').classList.add('active');
  document.body.style.overflow = 'hidden';
}

/** Show dropdown (add mode) or name label (edit mode) */
function toggleFormMode(mode) {
  const addFields  = document.getElementById('cfAddFields');
  const editFields = document.getElementById('cfEditFields');
  if (addFields)  addFields.style.display  = mode === 'add'  ? 'block' : 'none';
  if (editFields) editFields.style.display = mode === 'edit' ? 'block' : 'none';
}

function resetForm() {
  const errEl   = document.getElementById('choirFormError');
  const saveBtn = document.getElementById('choirFormSave');
  if (errEl)   errEl.textContent = '';
  if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save Member'; }
}

function closeChoirFormModal() {
  document.getElementById('choirFormModal').classList.remove('active');
  document.body.style.overflow = '';
  editingMemberId = null;
}

async function saveChoirForm() {
  const errEl   = document.getElementById('choirFormError');
  const saveBtn = document.getElementById('choirFormSave');
  const voicePart = document.getElementById('cfVoicePart').value || 'unassigned';
  const role      = document.getElementById('cfRole').value      || 'Member';

  let firstName, lastName;

  if (editingMemberId !== null) {
    // Edit mode — get name from existing record
    const existing = flatRoster().find(x => x.id === editingMemberId);
    firstName = existing.firstName;
    lastName  = existing.lastName;
  } else {
    // Add mode — get name from dropdown
    const selected = document.getElementById('cfMemberSelect').value;
    if (!selected) { errEl.textContent = 'Please select a member.'; return; }
    [firstName, lastName] = selected.split('|');
  }

  errEl.textContent   = '';
  saveBtn.disabled    = true;
  saveBtn.textContent = 'Saving…';

  const memberObj = { firstName, lastName, voicePart, role };

  try {
    if (editingMemberId !== null) {
      // ── UPDATE ──
      await supabaseUpdate(editingMemberId, memberObj);

      // Move from old part to new part in local state
      [...VOICE_PARTS, 'unassigned'].forEach(p => {
        const idx = (choirRoster[p] || []).findIndex(x => x.id === editingMemberId);
        if (idx !== -1) choirRoster[p].splice(idx, 1);
      });
      if (!choirRoster[voicePart]) choirRoster[voicePart] = [];
      choirRoster[voicePart].push({ id: editingMemberId, ...memberObj });

      showToast(`${firstName} ${lastName} updated ✓`, 'success');

    } else {
      // ── INSERT ──
      const saved = hasSupabase()
        ? await supabaseInsert(memberObj)
        : (() => {
            const all   = flatRoster();
            const newId = all.length > 0 ? Math.max(...all.map(x => x.id)) + 1 : 1;
            return { id: newId, ...memberObj };
          })();

      if (!choirRoster[voicePart]) choirRoster[voicePart] = [];
      choirRoster[voicePart].push(saved);
      showToast(`${firstName} ${lastName} added ✓`, 'success');
    }

    saveLocalCache();

    // Reset button BEFORE closing so it's ready next time
    saveBtn.disabled    = false;
    saveBtn.textContent = 'Save Member';

    closeChoirFormModal();

    // Switch to the saved member's tab
    document.querySelectorAll('.voice-tab').forEach(t => t.classList.remove('active'));
    const targetTab = document.querySelector(`.voice-tab[data-voice="${voicePart}"]`);
    if (targetTab) targetTab.classList.add('active');
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
  if (!confirm(`Remove ${m.firstName} ${m.lastName} from the choir?\n\nThey will remain on the Members page.`)) return;

  try {
    await supabaseDeleteRow(id);
    [...VOICE_PARTS, 'unassigned'].forEach(p => {
      choirRoster[p] = (choirRoster[p] || []).filter(x => x.id !== id);
    });
    saveLocalCache();
    renderVoiceRoster(activeVoice);
    showToast(`${m.firstName} ${m.lastName} removed from choir`, 'error');
  } catch (err) {
    console.error('Delete failed:', err);
    showToast(`Delete failed: ${err.message}`, 'error');
  }
}

// ============================================================
//  COUNTER ANIMATION
// ============================================================

function animateCounters() {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el  = entry.target;
      const end = VOICE_PARTS.flatMap(p => choirRoster[p]).length || parseInt(el.dataset.count) || 0;
      let current = 0;
      const step  = Math.max(1, Math.ceil(end / 40));
      const timer = setInterval(() => {
        current += step;
        if (current >= end) { el.textContent = end; clearInterval(timer); }
        else el.textContent = current;
      }, 30);
      observer.unobserve(el);
    });
  }, { threshold: 0.5 });
  document.querySelectorAll('.c-number[data-count]').forEach(c => observer.observe(c));
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
  const old = document.getElementById('sdaToast');
  if (old) old.remove();
  const t = document.createElement('div');
  t.id = 'sdaToast';
  t.className = `sda-toast sda-toast--${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('sda-toast--show'));
  setTimeout(() => { t.classList.remove('sda-toast--show'); setTimeout(() => t.remove(), 400); }, 3000);
}

// ============================================================
//  REPERTOIRE DATA
// ============================================================
const repertoireData = [
  { title: "Tukutendereza",             type: "hymn",    typeLabel: "Hymn",    description: "Traditional Swahili worship song" },
  { title: "Amazing Grace",             type: "hymn",    typeLabel: "Hymn",    description: "Classic gospel hymn arrangement" },
  { title: "Hakuna Mungu Kama Wewe",    type: "praise",  typeLabel: "Praise",  description: "Contemporary Swahili praise" },
  { title: "How Great Thou Art",        type: "hymn",    typeLabel: "Hymn",    description: "Grand worship anthem" },
  { title: "Kuna Siku",                 type: "special", typeLabel: "Special", description: "Special music for divine service" },
  { title: "It Is Well",                type: "hymn",    typeLabel: "Hymn",    description: "Peaceful hymn arrangement" },
  { title: "Mungu Yu Mwema",            type: "praise",  typeLabel: "Praise",  description: "Upbeat praise and worship" },
  { title: "Great Is Thy Faithfulness", type: "hymn",    typeLabel: "Hymn",    description: "Thanksgiving hymn" }
];

// ============================================================
//  INIT
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
  if (sessionStorage.getItem('sda_admin') === '1') isAdmin = true;

  // Load both in parallel for speed
  await Promise.all([loadChoir(), loadEligibleMembers()]);

  updateAdminUI();
  renderVoiceRoster('soprano');
  renderRepertoire();
  animateCounters();

  document.querySelectorAll('.voice-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.voice-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderVoiceRoster(tab.dataset.voice);
    });
  });

  document.getElementById('choirFormClose')?.addEventListener('click', closeChoirFormModal);
  document.getElementById('choirFormModal')?.addEventListener('click', e => {
    if (e.target === e.currentTarget || e.target.classList.contains('modal-overlay'))
      closeChoirFormModal();
  });
  document.getElementById('choirFormSave')?.addEventListener('click', saveChoirForm);

  document.getElementById('adminLoginBtn')?.addEventListener('click', promptAdminLogin);
  document.getElementById('adminLogoutBtn')?.addEventListener('click', adminLogout);
  document.getElementById('adminAddBtn')?.addEventListener('click', openAddModal);

  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeChoirFormModal(); });
});