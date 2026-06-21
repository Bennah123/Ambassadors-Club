// ============================================================
//  AMBASSADORS MEMBERS — members.js
//  Data layer: Supabase → localStorage cache
// ============================================================

const ADMIN_PASSWORD = 'ambassadors2026'; // ← change this!
const STORAGE_KEY    = 'sda_members_data';

const deptLabels = {
  choir: 'Choir', ushering: 'Ushering',
  treasury: 'Treasury', welfare: 'Welfare', media: 'Media'
};
const ALL_DEPTS = Object.keys(deptLabels);

let membersData     = [];
let isAdmin         = false;
let editingMemberId = null;

// ============================================================
//  SUPABASE HELPERS
// ============================================================

function hasSupabase() {
  return typeof supabaseClient !== 'undefined';
}

function toSupabaseRow(m) {
  return {
    first_name:  m.firstName,
    last_name:   m.lastName,
    role:        m.role,
    departments: m.departments,
    joined_year: m.joined,
    gift:        m.gift,
    phone:       m.phone,
    email:       m.email,
    bio:         m.bio
  };
}

function fromSupabaseRow(m) {
  return {
    id:          m.id,
    firstName:   m.first_name  || '',
    lastName:    m.last_name   || '',
    role:        m.role        || '',
    departments: m.departments || [],
    joined:      m.joined_year || '',
    gift:        m.gift        || '',
    phone:       m.phone       || '',
    email:       m.email       || '',
    bio:         m.bio         || ''
  };
}

// ============================================================
//  DATA LOADING
// ============================================================

async function loadMembers() {
  if (hasSupabase()) {
    try {
      const { data, error } = await supabaseClient
        .from('members')
        .select('*')
        .order('id', { ascending: true });

      if (error) throw error;

      membersData = (data || []).map(fromSupabaseRow);
      saveLocalCache();
      console.log(`✅ Loaded ${membersData.length} members from Supabase`);
      return;

    } catch (err) {
      console.warn('Supabase load failed:', err.message);
      showToast('Could not reach database — showing cached data', 'error');
    }
  }

  // localStorage fallback (offline cache only)
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      membersData = JSON.parse(stored);
      console.log('ℹ️ Loaded from localStorage cache');
      return;
    }
  } catch { /* ignore */ }

  // Nothing available
  membersData = [];
  console.log('ℹ️ No member data available');
}

function saveLocalCache() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(membersData));
}

// ============================================================
//  SUPABASE — MEMBERS CRUD
// ============================================================

async function supabaseInsert(memberObj) {
  const { data, error } = await supabaseClient
    .from('members')
    .insert([toSupabaseRow(memberObj)])
    .select()
    .single();
  if (error) throw error;
  return fromSupabaseRow(data);
}

async function supabaseUpdate(id, memberObj) {
  const { error } = await supabaseClient
    .from('members')
    .update(toSupabaseRow(memberObj))
    .eq('id', id);
  if (error) throw error;
}

async function supabaseDeleteMember(id) {
  const { error } = await supabaseClient
    .from('members')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ============================================================
//  CHOIR SYNC — auto-manages choir_members table
// ============================================================

/**
 * Called after every member save.
 * If member is in choir dept  → upsert into choir_members (voice_part stays null until set in choir page)
 * If member removed from choir → delete from choir_members
 * Uses member's full name as the link key (first_name + last_name match)
 */
async function syncMemberToChoir(member, previousDepts = []) {
  if (!hasSupabase()) return;

  const isInChoir  = (member.departments || []).includes('choir');
  const wasInChoir = (previousDepts      || []).includes('choir');

  if (isInChoir) {
    // Check if they already exist in choir_members
    const { data: existing } = await supabaseClient
      .from('choir_members')
      .select('id, voice_part')
      .eq('first_name', member.firstName)
      .eq('last_name',  member.lastName)
      .maybeSingle();

    if (!existing) {
      // Add to choir with no voice part assigned yet
      await supabaseClient
        .from('choir_members')
        .insert([{
          first_name: member.firstName,
          last_name:  member.lastName,
          voice_part: null,   // admin assigns this on the choir page
          role:       'Member'
        }]);
      console.log(`✅ ${member.firstName} ${member.lastName} added to choir_members`);
    }
    // If they already exist, leave them alone (don't overwrite voice_part/role set by choir admin)

  } else if (wasInChoir && !isInChoir) {
    // Choir dept was removed — remove from choir_members
    await supabaseClient
      .from('choir_members')
      .delete()
      .eq('first_name', member.firstName)
      .eq('last_name',  member.lastName);
    console.log(`🗑️ ${member.firstName} ${member.lastName} removed from choir_members`);
  }
}

// ============================================================
//  RENDER
// ============================================================

function renderMembers(filter = 'all', search = '') {
  const grid      = document.getElementById('membersGrid');
  const noResults = document.getElementById('noResults');
  if (!grid) return;

  let filtered = membersData;

  if (filter !== 'all') {
    filtered = filtered.filter(m => (m.departments || []).includes(filter));
  }

  if (search.trim()) {
    const s = search.toLowerCase();
    filtered = filtered.filter(m =>
      m.firstName.toLowerCase().includes(s) ||
      m.lastName.toLowerCase().includes(s)  ||
      (m.gift  || '').toLowerCase().includes(s) ||
      (m.role  || '').toLowerCase().includes(s) ||
      (m.departments || []).some(d => d.includes(s))
    );
  }

  if (filtered.length === 0) {
    grid.style.display = 'none';
    noResults.style.display = 'block';
    return;
  }

  grid.style.display = 'grid';
  noResults.style.display = 'none';

  grid.innerHTML = filtered.map(m => `
    <div class="member-card" data-id="${m.id}" onclick="openMemberModal(${m.id})">
      ${isAdmin ? `
        <div class="admin-card-actions" onclick="event.stopPropagation()">
          <button class="admin-card-btn" onclick="openEditModal(${m.id})"  title="Edit">✏️</button>
          <button class="admin-card-btn" onclick="deleteMember(${m.id})"   title="Delete">🗑️</button>
        </div>` : ''}
      <div class="card-banner">
        <div class="card-avatar">${getInitials(m.firstName, m.lastName)}</div>
      </div>
      <div class="card-body">
        <h3>${escHtml(m.firstName)} ${escHtml(m.lastName)}</h3>
        <span class="card-role">${escHtml(m.role)}</span>
        <p class="card-gift">Gift: ${escHtml(m.gift)}</p>
        <div class="dept-tags">
          ${(m.departments || []).map(d =>
            `<span class="dept-tag">${deptLabels[d] || escHtml(d)}</span>`).join('')}
        </div>
      </div>
    </div>`).join('');
}

// ============================================================
//  MEMBER DETAIL MODAL
// ============================================================

function openMemberModal(id) {
  const m = membersData.find(x => x.id === id);
  if (!m) return;

  document.getElementById('modalBody').innerHTML = `
    <div class="modal-banner">
      <div class="modal-avatar">${getInitials(m.firstName, m.lastName)}</div>
    </div>
    <div class="modal-info">
      <h2>${escHtml(m.firstName)} ${escHtml(m.lastName)}</h2>
      <p class="modal-role">${escHtml(m.role)}</p>
      <p class="modal-bio">${escHtml(m.bio)}</p>
      <div class="modal-details">
        <div class="detail-row">
          <span class="detail-label">Departments</span>
          <span class="detail-value dept-list">
            ${(m.departments || []).map(d =>
              `<span class="dept-tag">${deptLabels[d] || escHtml(d)}</span>`).join('')}
          </span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Spiritual Gift</span>
          <span class="detail-value">${escHtml(m.gift)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Member Since</span>
          <span class="detail-value">${escHtml(String(m.joined))}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Phone</span>
          <span class="detail-value">${escHtml(m.phone)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Email</span>
          <span class="detail-value">${escHtml(m.email)}</span>
        </div>
      </div>
      ${isAdmin ? `
        <div style="margin-top:1.5rem;display:flex;gap:.75rem;justify-content:center;">
          <button class="admin-action-btn edit"
            onclick="closeMemberModal();openEditModal(${m.id})">✏️ Edit</button>
          <button class="admin-action-btn delete"
            onclick="closeMemberModal();deleteMember(${m.id})">🗑️ Remove</button>
        </div>` : ''}
    </div>`;

  document.getElementById('memberModal').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeMemberModal() {
  document.getElementById('memberModal').classList.remove('active');
  document.body.style.overflow = '';
}

// ============================================================
//  ADMIN — LOGIN / LOGOUT
// ============================================================

function promptAdminLogin() {
  const pwd = prompt('Enter admin password:');
  if (pwd === null) return;
  if (pwd === ADMIN_PASSWORD) {
    isAdmin = true;
    sessionStorage.setItem('sda_admin', '1');
    updateAdminUI();
    renderMembers(currentFilter(), currentSearch());
    showToast('Admin mode enabled ✓', 'success');
  } else {
    showToast('Incorrect password', 'error');
  }
}

function adminLogout() {
  isAdmin = false;
  sessionStorage.removeItem('sda_admin');
  updateAdminUI();
  renderMembers(currentFilter(), currentSearch());
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
  populateMemberForm(null);
  document.getElementById('memberFormTitle').textContent = 'Add New Member';
  document.getElementById('memberFormModal').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function openEditModal(id) {
  const m = membersData.find(x => x.id === id);
  if (!m) return;
  editingMemberId = id;
  populateMemberForm(m);
  document.getElementById('memberFormTitle').textContent = 'Edit Member';
  document.getElementById('memberFormModal').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeMemberFormModal() {
  document.getElementById('memberFormModal').classList.remove('active');
  document.body.style.overflow = '';
  editingMemberId = null;
}

function populateMemberForm(m) {
  document.getElementById('fFirstName').value = m?.firstName || '';
  document.getElementById('fLastName').value  = m?.lastName  || '';
  document.getElementById('fRole').value      = m?.role      || '';
  document.getElementById('fGift').value      = m?.gift      || '';
  document.getElementById('fPhone').value     = m?.phone     || '';
  document.getElementById('fEmail').value     = m?.email     || '';
  document.getElementById('fJoined').value    = m?.joined    || new Date().getFullYear();
  document.getElementById('fBio').value       = m?.bio       || '';
  ALL_DEPTS.forEach(d => {
    const cb = document.getElementById('fDept_' + d);
    if (cb) cb.checked = m ? (m.departments || []).includes(d) : false;
  });
  document.getElementById('memberFormError').textContent = '';
  const saveBtn = document.getElementById('memberFormSave');
  if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save Member'; }
}

async function saveMemberForm() {
  const firstName   = document.getElementById('fFirstName').value.trim();
  const lastName    = document.getElementById('fLastName').value.trim();
  const role        = document.getElementById('fRole').value.trim();
  const gift        = document.getElementById('fGift').value.trim();
  const phone       = document.getElementById('fPhone').value.trim();
  const email       = document.getElementById('fEmail').value.trim();
  const joined      = document.getElementById('fJoined').value.trim();
  const bio         = document.getElementById('fBio').value.trim();
  const departments = ALL_DEPTS.filter(d => document.getElementById('fDept_' + d)?.checked);

  const errEl   = document.getElementById('memberFormError');
  const saveBtn = document.getElementById('memberFormSave');

  if (!firstName || !lastName) { errEl.textContent = 'First and last name are required.'; return; }
  if (!role)                    { errEl.textContent = 'Role is required.'; return; }
  if (departments.length === 0) { errEl.textContent = 'Select at least one department.'; return; }
  errEl.textContent = '';

  saveBtn.disabled    = true;
  saveBtn.textContent = 'Saving…';

  const memberObj = { firstName, lastName, role, gift, phone, email, joined, bio, departments };

  try {
    if (editingMemberId !== null) {
      // ── UPDATE ──
      const previousMember = membersData.find(x => x.id === editingMemberId);
      const previousDepts  = previousMember?.departments || [];

      await supabaseUpdate(editingMemberId, memberObj);

      const idx = membersData.findIndex(x => x.id === editingMemberId);
      if (idx !== -1) membersData[idx] = { ...membersData[idx], ...memberObj };

      // Sync choir membership based on dept change
      await syncMemberToChoir(memberObj, previousDepts);

      showToast(`${firstName} ${lastName} updated ✓`, 'success');

    } else {
      // ── INSERT ──
      const saved = await supabaseInsert(memberObj);
      membersData.push(saved);

      // If choir dept selected, add to choir_members
      await syncMemberToChoir(saved, []);

      showToast(`${firstName} ${lastName} added ✓`, 'success');
    }

    saveLocalCache();
    closeMemberFormModal();
    renderMembers(currentFilter(), currentSearch());

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

async function deleteMember(id) {
  const m = membersData.find(x => x.id === id);
  if (!m) return;
  if (!confirm(`Remove ${m.firstName} ${m.lastName} from the members list?\n\nThis cannot be undone.`)) return;

  try {
    await supabaseDeleteMember(id);

    // Also remove from choir if they were a choir member
    if ((m.departments || []).includes('choir') && hasSupabase()) {
      await supabaseClient
        .from('choir_members')
        .delete()
        .eq('first_name', m.firstName)
        .eq('last_name',  m.lastName);
    }

    membersData = membersData.filter(x => x.id !== id);
    saveLocalCache();
    renderMembers(currentFilter(), currentSearch());
    showToast(`${m.firstName} ${m.lastName} removed`, 'error');

  } catch (err) {
    console.error('Delete failed:', err);
    showToast(`Delete failed: ${err.message}`, 'error');
  }
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

function currentFilter() {
  return document.querySelector('.filter-btn.active')?.dataset.filter || 'all';
}

function currentSearch() {
  return document.getElementById('memberSearch')?.value || '';
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

function debounce(fn, ms) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}

// ============================================================
//  INIT
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
  if (sessionStorage.getItem('sda_admin') === '1') isAdmin = true;

  await loadMembers();
  updateAdminUI();
  renderMembers();

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderMembers(btn.dataset.filter, currentSearch());
    });
  });

  document.getElementById('memberSearch')?.addEventListener('input',
    debounce(e => renderMembers(currentFilter(), e.target.value), 300));

  document.getElementById('modalClose')?.addEventListener('click', closeMemberModal);
  document.getElementById('memberModal')?.addEventListener('click', e => {
    if (e.target === e.currentTarget || e.target.classList.contains('modal-overlay'))
      closeMemberModal();
  });

  document.getElementById('memberFormClose')?.addEventListener('click', closeMemberFormModal);
  document.getElementById('memberFormModal')?.addEventListener('click', e => {
    if (e.target === e.currentTarget || e.target.classList.contains('modal-overlay'))
      closeMemberFormModal();
  });
  document.getElementById('memberFormSave')?.addEventListener('click', saveMemberForm);

  document.getElementById('adminLoginBtn')?.addEventListener('click', promptAdminLogin);
  document.getElementById('adminLogoutBtn')?.addEventListener('click', adminLogout);
  document.getElementById('adminAddBtn')?.addEventListener('click', openAddModal);

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeMemberModal(); closeMemberFormModal(); }
  });
});