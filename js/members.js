// ============================================================
//  AMBASSADORS MEMBERS — members.js
//  Data layer: Supabase (if configured) → localStorage → JSON
// ============================================================

// ---- ADMIN CONFIG (change this password!) ----
const ADMIN_PASSWORD = 'ambassadors2026';
const STORAGE_KEY    = 'sda_members_data';

// ---- DEPARTMENT LABELS ----
const deptLabels = {
  choir: 'Choir',
  ushering: 'Ushering',
  treasury: 'Treasury',
  welfare: 'Welfare',
  media: 'Media'
};

const ALL_DEPTS = Object.keys(deptLabels);

// ---- STATE ----
let membersData       = [];
let isAdmin           = false;
let editingMemberId   = null;   // null = add mode, number = edit mode

// ============================================================
//  DATA LOADING
// ============================================================

/** Priority: Supabase → localStorage → members.json */
async function loadMembers() {
  // 1. Try Supabase
  if (typeof supabaseClient !== 'undefined') {
    try {
      const { data, error } = await supabaseClient
        .from('members')
        .select('*')
        .order('id', { ascending: true });

      if (!error && data && data.length > 0) {
        membersData = data.map(normaliseSupabaseRow);
        console.log(`✅ Loaded ${membersData.length} members from Supabase`);
        return;
      }
    } catch (err) {
      console.warn('Supabase fetch failed:', err.message);
    }
  }

  // 2. Try localStorage
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      membersData = JSON.parse(stored);
      console.log(`✅ Loaded ${membersData.length} members from localStorage`);
      return;
    } catch {
      console.warn('localStorage parse failed, falling back to JSON file');
    }
  }

  // 3. Fall back to members.json
  try {
    const res  = await fetch('members.json');
    const json = await res.json();
    if (Array.isArray(json) && json.length > 0) {
      membersData = json;
      saveToLocalStorage();
      console.log(`✅ Loaded ${membersData.length} members from members.json`);
      return;
    }
  } catch (err) {
    console.warn('members.json fetch failed:', err.message);
  }

  // 4. Hardcoded fallback (same as before)
  membersData = getHardcodedFallback();
  saveToLocalStorage();
  console.log('ℹ️ Using hardcoded fallback data');
}

function normaliseSupabaseRow(m) {
  return {
    id: m.id,
    firstName: m.first_name,
    lastName: m.last_name,
    role: m.role,
    departments: m.departments || [],
    joined: m.joined_year,
    gift: m.gift,
    phone: m.phone,
    email: m.email,
    bio: m.bio
  };
}

function saveToLocalStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(membersData));
}

// ============================================================
//  RENDER MEMBERS GRID
// ============================================================

function renderMembers(filter = 'all', search = '') {
  const grid      = document.getElementById('membersGrid');
  const noResults = document.getElementById('noResults');
  if (!grid) return;

  let filtered = membersData;

  if (filter !== 'all') {
    filtered = filtered.filter(m => m.departments.includes(filter));
  }

  if (search.trim()) {
    const s = search.toLowerCase().trim();
    filtered = filtered.filter(m =>
      m.firstName.toLowerCase().includes(s) ||
      m.lastName.toLowerCase().includes(s) ||
      (m.gift  || '').toLowerCase().includes(s) ||
      (m.role  || '').toLowerCase().includes(s) ||
      (m.departments || []).some(d => d.toLowerCase().includes(s))
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
          <button class="admin-card-btn edit-btn"   onclick="openEditModal(${m.id})"   title="Edit member">✏️</button>
          <button class="admin-card-btn delete-btn" onclick="deleteMember(${m.id})"    title="Remove member">🗑️</button>
        </div>` : ''}
      <div class="card-banner">
        <div class="card-avatar">${getInitials(m.firstName, m.lastName)}</div>
      </div>
      <div class="card-body">
        <h3>${escHtml(m.firstName)} ${escHtml(m.lastName)}</h3>
        <span class="card-role">${escHtml(m.role)}</span>
        <p class="card-gift">Gift: ${escHtml(m.gift)}</p>
        <div class="dept-tags">
          ${(m.departments || []).map(d => `<span class="dept-tag">${deptLabels[d] || escHtml(d)}</span>`).join('')}
        </div>
      </div>
    </div>
  `).join('');
}

// ============================================================
//  MEMBER DETAIL MODAL
// ============================================================

function openMemberModal(id) {
  const m = membersData.find(x => x.id === id);
  if (!m) return;

  const modal     = document.getElementById('memberModal');
  const modalBody = document.getElementById('modalBody');

  modalBody.innerHTML = `
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
            ${(m.departments || []).map(d => `<span class="dept-tag">${deptLabels[d] || escHtml(d)}</span>`).join('')}
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
        <div style="margin-top:1.5rem;display:flex;gap:0.75rem;justify-content:center;">
          <button class="admin-action-btn edit"   onclick="closeMemberModal();openEditModal(${m.id})">✏️ Edit</button>
          <button class="admin-action-btn delete" onclick="closeMemberModal();deleteMember(${m.id})">🗑️ Remove</button>
        </div>` : ''}
    </div>
  `;

  modal.classList.add('active');
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
  if (pwd === null) return;           // cancelled

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
  const bar     = document.getElementById('adminBar');
  const loginBtn = document.getElementById('adminLoginBtn');
  if (bar)      bar.style.display      = isAdmin ? 'flex' : 'none';
  if (loginBtn) loginBtn.style.display = isAdmin ? 'none' : 'inline-flex';
}

// ============================================================
//  ADMIN — ADD / EDIT MODAL
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
  document.getElementById('fFirstName').value = m ? m.firstName : '';
  document.getElementById('fLastName').value  = m ? m.lastName  : '';
  document.getElementById('fRole').value      = m ? m.role      : '';
  document.getElementById('fGift').value      = m ? m.gift      : '';
  document.getElementById('fPhone').value     = m ? m.phone     : '';
  document.getElementById('fEmail').value     = m ? m.email     : '';
  document.getElementById('fJoined').value    = m ? m.joined    : new Date().getFullYear();
  document.getElementById('fBio').value       = m ? m.bio       : '';

  // Reset dept checkboxes
  ALL_DEPTS.forEach(d => {
    const cb = document.getElementById('fDept_' + d);
    if (cb) cb.checked = m ? (m.departments || []).includes(d) : false;
  });

  document.getElementById('memberFormError').textContent = '';
}

function saveMemberForm() {
  const firstName   = document.getElementById('fFirstName').value.trim();
  const lastName    = document.getElementById('fLastName').value.trim();
  const role        = document.getElementById('fRole').value.trim();
  const gift        = document.getElementById('fGift').value.trim();
  const phone       = document.getElementById('fPhone').value.trim();
  const email       = document.getElementById('fEmail').value.trim();
  const joined      = document.getElementById('fJoined').value.trim();
  const bio         = document.getElementById('fBio').value.trim();
  const departments = ALL_DEPTS.filter(d => document.getElementById('fDept_' + d)?.checked);

  const errEl = document.getElementById('memberFormError');

  // Validation
  if (!firstName || !lastName) {
    errEl.textContent = 'First and last name are required.'; return;
  }
  if (!role) {
    errEl.textContent = 'Role is required.'; return;
  }
  if (departments.length === 0) {
    errEl.textContent = 'Select at least one department.'; return;
  }
  errEl.textContent = '';

  if (editingMemberId !== null) {
    // UPDATE
    const idx = membersData.findIndex(x => x.id === editingMemberId);
    if (idx !== -1) {
      membersData[idx] = { ...membersData[idx], firstName, lastName, role, gift, phone, email, joined, bio, departments };
      showToast(`${firstName} ${lastName} updated ✓`, 'success');
    }
  } else {
    // ADD
    const newId = membersData.length > 0 ? Math.max(...membersData.map(x => x.id)) + 1 : 1;
    membersData.push({ id: newId, firstName, lastName, role, gift, phone, email, joined, bio, departments });
    showToast(`${firstName} ${lastName} added ✓`, 'success');
  }

  saveToLocalStorage();
  closeMemberFormModal();
  renderMembers(currentFilter(), currentSearch());
}

// ============================================================
//  ADMIN — DELETE
// ============================================================

function deleteMember(id) {
  const m = membersData.find(x => x.id === id);
  if (!m) return;
  if (!confirm(`Remove ${m.firstName} ${m.lastName} from the members list?`)) return;

  membersData = membersData.filter(x => x.id !== id);
  saveToLocalStorage();
  renderMembers(currentFilter(), currentSearch());
  showToast(`${m.firstName} ${m.lastName} removed`, 'error');
}

// ============================================================
//  HELPERS
// ============================================================

function getInitials(first, last) {
  return ((first || ' ')[0] + (last || ' ')[0]).toUpperCase();
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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
  toast.id = 'sdaToast';
  toast.className = `sda-toast sda-toast--${type}`;
  toast.textContent = msg;
  document.body.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('sda-toast--show'));
  setTimeout(() => {
    toast.classList.remove('sda-toast--show');
    setTimeout(() => toast.remove(), 400);
  }, 2800);
}

function debounce(fn, ms) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}

// ============================================================
//  INIT
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
  // Restore admin session
  if (sessionStorage.getItem('sda_admin') === '1') {
    isAdmin = true;
  }

  await loadMembers();

  updateAdminUI();
  renderMembers();

  // Filter buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderMembers(btn.dataset.filter, currentSearch());
    });
  });

  // Search
  const searchInput = document.getElementById('memberSearch');
  if (searchInput) {
    searchInput.addEventListener('input', debounce(e => {
      renderMembers(currentFilter(), e.target.value);
    }, 300));
  }

  // Member detail modal close
  document.getElementById('modalClose')?.addEventListener('click', closeMemberModal);
  document.getElementById('memberModal')?.addEventListener('click', e => {
    if (e.target === e.currentTarget || e.target.classList.contains('modal-overlay')) {
      closeMemberModal();
    }
  });

  // Member form modal close
  document.getElementById('memberFormClose')?.addEventListener('click', closeMemberFormModal);
  document.getElementById('memberFormModal')?.addEventListener('click', e => {
    if (e.target === e.currentTarget || e.target.classList.contains('modal-overlay')) {
      closeMemberFormModal();
    }
  });

  // Save button in form
  document.getElementById('memberFormSave')?.addEventListener('click', saveMemberForm);

  // Admin buttons
  document.getElementById('adminLoginBtn')?.addEventListener('click', promptAdminLogin);
  document.getElementById('adminLogoutBtn')?.addEventListener('click', adminLogout);
  document.getElementById('adminAddBtn')?.addEventListener('click', openAddModal);

  // Escape key closes whichever modal is open
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeMemberModal();
      closeMemberFormModal();
    }
  });
});

// ============================================================
//  HARDCODED FALLBACK DATA
// ============================================================
function getHardcodedFallback() {
  return [
    { id:1,firstName:"John",lastName:"Kamau",role:"Youth Leader",departments:["choir","treasury"],joined:"2022",gift:"Leadership",phone:"+254 712 345 678",email:"john.kamau@email.com",bio:"Passionate about youth ministry and financial stewardship. Leads the Ambassadors Club with vision and dedication." },
    { id:2,firstName:"Sarah",lastName:"Wanjiku",role:"Choir Director",departments:["choir","media"],joined:"2021",gift:"Music",phone:"+254 723 456 789",email:"sarah.w@email.com",bio:"Gifted vocalist and choir leader. Organizes rehearsals and special music programs for divine services." },
    { id:3,firstName:"Peter",lastName:"Ochieng",role:"Treasurer",departments:["treasury","welfare"],joined:"2023",gift:"Administration",phone:"+254 734 567 890",email:"peter.o@email.com",bio:"Detail-oriented and trustworthy. Manages club finances and welfare contributions with integrity." },
    { id:4,firstName:"Grace",lastName:"Muthoni",role:"Welfare Coordinator",departments:["welfare","ushering"],joined:"2022",gift:"Hospitality",phone:"+254 745 678 901",email:"grace.m@email.com",bio:"Heart for service and community care. Coordinates outreach programs and member support initiatives." },
    { id:5,firstName:"David",lastName:"Mutua",role:"Media Lead",departments:["media","choir"],joined:"2023",gift:"Creativity",phone:"+254 756 789 012",email:"david.m@email.com",bio:"Tech-savvy creative handling sound, visuals, and social media for the club and church programs." },
    { id:6,firstName:"Esther",lastName:"Achieng",role:"Ushering Lead",departments:["ushering","welfare"],joined:"2021",gift:"Service",phone:"+254 767 890 123",email:"esther.a@email.com",bio:"Welcoming and organized. Ensures smooth flow during services and special church events." },
    { id:7,firstName:"Michael",lastName:"Kipchirchir",role:"Sabbath School Teacher",departments:["choir"],joined:"2024",gift:"Teaching",phone:"+254 778 901 234",email:"michael.k@email.com",bio:"Youth Sabbath School teacher with a passion for Bible study and discipleship." },
    { id:8,firstName:"Faith",lastName:"Njeri",role:"Events Coordinator",departments:["media","ushering"],joined:"2023",gift:"Organization",phone:"+254 789 012 345",email:"faith.n@email.com",bio:"Plans and coordinates club events, camps, and fellowship activities throughout the year." }
  ];
}