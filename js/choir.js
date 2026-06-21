// ============================================================
//  CHOIR PAGE — choir.js
//  Data layer: Supabase → localStorage cache
//  Members with no voice_part assigned show in "Unassigned" tab
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
const VOICE_PARTS = ['soprano', 'alto', 'tenor', 'bass']; // excludes unassigned

// ---- STATE ----
let choirRoster     = { soprano: [], alto: [], tenor: [], bass: [], unassigned: [] };
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
  const part = (m.voice_part || '').toLowerCase();
  return {
    id:        m.id,
    firstName: m.first_name  || '',
    lastName:  m.last_name   || '',
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

  // localStorage fallback (offline cache only)
  try {
    const stored = localStorage.getItem(CHOIR_STORAGE_KEY);
    if (stored) {
      buildRosterFromArray(JSON.parse(stored));
      console.log('ℹ️ Loaded choir from localStorage cache');
      return;
    }
  } catch { /* ignore */ }

  // Nothing available
  buildRosterFromArray([]);
  console.log('ℹ️ No choir data available');
}

function buildRosterFromArray(members) {
  choirRoster = { soprano: [], alto: [], tenor: [], bass: [], unassigned: [] };
  members.forEach(m => {
    const part = m.voicePart || 'unassigned';
    if (choirRoster[part] !== undefined) choirRoster[part].push(m);
    else choirRoster.unassigned.push(m);
  });
}

function flatRoster() {
  return [...VOICE_PARTS, 'unassigned'].flatMap(p => choirRoster[p]);
}

function saveLocalCache() {
  localStorage.setItem(CHOIR_STORAGE_KEY, JSON.stringify(flatRoster()));
}

// ============================================================
//  SUPABASE WRITE OPERATIONS
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

async function supabaseDelete(id) {
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

  // Update tab counts (all tabs including unassigned)
  [...VOICE_PARTS, 'unassigned'].forEach(p => {
    const countEl = document.querySelector(`.voice-tab[data-voice="${p}"] .tab-count`);
    if (countEl) {
      const n = choirRoster[p].length;
      countEl.textContent = `${n} member${n !== 1 ? 's' : ''}`;
    }
  });

  // Update unassigned tab visibility — only show if there are unassigned members
  const unassignedTab = document.querySelector('.voice-tab[data-voice="unassigned"]');
  if (unassignedTab) {
    unassignedTab.style.display = choirRoster.unassigned.length > 0 ? 'flex' : 'none';
  }

  // Update hero member count (assigned only)
  const countEl = document.querySelector('.c-number[data-count]');
  if (countEl) countEl.textContent = VOICE_PARTS.flatMap(p => choirRoster[p]).length;

  // Empty state
  if (members.length === 0) {
    container.innerHTML = `
      <div class="choir-empty">
        <p>No ${partLabel} members yet.
        ${voice === 'unassigned'
          ? 'New choir members added from the Members page will appear here until you assign their voice part.'
          : isAdmin ? `Use "+ Add Member" to add one, or assign voice parts from the <a href="members.html">Members page</a>.` : ''}
        </p>
      </div>`;
    return;
  }

  container.innerHTML = members.map(m => `
    <div class="choir-member-card" style="position:relative;">
      ${isAdmin ? `
        <div class="admin-card-actions" onclick="event.stopPropagation()">
          <button class="admin-card-btn" onclick="openEditModal(${m.id})" title="Edit">✏️</button>
          <button class="admin-card-btn" onclick="deleteChoirMember(${m.id})" title="Delete">🗑️</button>
        </div>` : ''}
      <div class="cm-avatar">${getInitials(m.firstName, m.lastName)}</div>
      <h4>${escHtml(m.firstName)} ${escHtml(m.lastName)}</h4>
      <span class="cm-part">
        ${voice === 'unassigned'
          ? '<em style="color:var(--text-muted)">Voice not assigned</em>'
          : `${partLabel} &middot; ${escHtml(m.role)}`}
      </span>
      ${voice === 'unassigned' && isAdmin
        ? `<button class="assign-voice-btn" onclick="openEditModal(${m.id})">Assign Voice Part</button>`
        : ''}
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
  document.getElementById('cfVoicePart').value = m?.voicePart === 'unassigned' ? '' : (m?.voicePart || '');
  document.getElementById('cfRole').value      = m?.role || 'Member';
  document.getElementById('choirFormError').textContent = '';
  const saveBtn = document.getElementById('choirFormSave');
  if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save Member'; }
}

async function saveChoirForm() {
  const firstName = document.getElementById('cfFirstName').value.trim();
  const lastName  = document.getElementById('cfLastName').value.trim();
  const voicePart = document.getElementById('cfVoicePart').value || 'unassigned';
  const role      = document.getElementById('cfRole').value || 'Member';

  const errEl   = document.getElementById('choirFormError');
  const saveBtn = document.getElementById('choirFormSave');

  if (!firstName || !lastName) { errEl.textContent = 'First and last name are required.'; return; }
  errEl.textContent = '';

  saveBtn.disabled    = true;
  saveBtn.textContent = 'Saving…';

  const memberObj = { firstName, lastName, voicePart, role };

  try {
    if (editingMemberId !== null) {
      // UPDATE
      await supabaseUpdate(editingMemberId, memberObj);

      // Remove from old part, add to new part
      [...VOICE_PARTS, 'unassigned'].forEach(p => {
        const idx = choirRoster[p].findIndex(x => x.id === editingMemberId);
        if (idx !== -1) choirRoster[p].splice(idx, 1);
      });
      choirRoster[voicePart].push({ id: editingMemberId, ...memberObj });

      showToast(`${firstName} ${lastName} updated ✓`, 'success');

    } else {
      // INSERT
      if (hasSupabase()) {
        const saved = await supabaseInsert(memberObj);
        choirRoster[voicePart].push(saved);
      } else {
        const all   = flatRoster();
        const newId = all.length > 0 ? Math.max(...all.map(x => x.id)) + 1 : 1;
        choirRoster[voicePart].push({ id: newId, ...memberObj });
      }
      showToast(`${firstName} ${lastName} added ✓`, 'success');
    }

    saveLocalCache();
    closeChoirFormModal();

    // Switch to the saved member's tab
    const targetTab = document.querySelector(`.voice-tab[data-voice="${voicePart}"]`);
    if (targetTab) {
      document.querySelectorAll('.voice-tab').forEach(t => t.classList.remove('active'));
      targetTab.classList.add('active');
    }
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
  if (!confirm(`Remove ${m.firstName} ${m.lastName} from the choir?\n\nThis will not remove them from the Members page.`)) return;

  try {
    await supabaseDelete(id);
    [...VOICE_PARTS, 'unassigned'].forEach(p => {
      choirRoster[p] = choirRoster[p].filter(x => x.id !== id);
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
      if (entry.isIntersecting) {
        const el  = entry.target;
        const end = VOICE_PARTS.flatMap(p => choirRoster[p]).length || parseInt(el.dataset.count) || 0;
        animateCount(el, end);
        observer.unobserve(el);
      }
    });
  }, { threshold: 0.5 });
  document.querySelectorAll('.c-number[data-count]').forEach(c => observer.observe(c));
}

function animateCount(el, target) {
  let current = 0;
  const step  = Math.max(1, Math.ceil(target / 40));
  const timer = setInterval(() => {
    current += step;
    if (current >= target) { el.textContent = target; clearInterval(timer); }
    else el.textContent = current;
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

  // Admin
  document.getElementById('adminLoginBtn')?.addEventListener('click', promptAdminLogin);
  document.getElementById('adminLogoutBtn')?.addEventListener('click', adminLogout);
  document.getElementById('adminAddBtn')?.addEventListener('click', openAddModal);

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeChoirFormModal();
  });
});