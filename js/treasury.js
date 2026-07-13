// ============================================================
//  TREASURY.JS — SDA Embakasi Central Ambassadors Club
//  Admin detected automatically via shared-auth.js (window.isAdmin,
//  based on the signed-in user's profiles.role === 'admin')
// ============================================================

const methodLabels = { mpesa: 'M-Pesa', cash: 'Cash', bank: 'Bank Transfer' };

let contributionsData   = [];
let categoriesData      = [];
let membersData         = [];
let isSupabaseConnected = false;
let activeCategoryId    = null;
let editingContribId    = null;
const PAGE_SIZE         = 10;
let currentPage         = 1;

// ============================================================
//  SUPABASE LOADERS
// ============================================================
async function loadMembers() {
  if (typeof supabaseClient === 'undefined') return;
  try {
    const { data, error } = await supabaseClient.from('members')
      .select('id, first_name, last_name').order('first_name', { ascending: true });
    if (error) throw error;
    membersData = (data || []).map(m => ({ id: m.id, name: `${m.first_name} ${m.last_name}`.trim() }));
  } catch (err) { console.warn('Could not load members:', err.message); }
}

async function loadCategories() {
  if (typeof supabaseClient !== 'undefined') {
    try {
      const { data, error } = await supabaseClient.from('contribution_categories')
        .select('*').order('created_at', { ascending: true });
      if (error) throw error;
      if (data && data.length) { categoriesData = data; return; }
    } catch (err) { console.warn('Categories load failed:', err.message); }
  }
  categoriesData = [
    { id: 'sabbath',   name: 'Sabbath Offering', description: 'Weekly Sabbath collections' },
    { id: 'tithe',     name: 'Tithe',             description: 'Member tithes' },
    { id: 'camp',      name: 'Camp Meeting',      description: 'Annual camp fund' },
    { id: 'recording', name: 'Recording',         description: 'Studio & recording costs' },
    { id: 'building',  name: 'Building Fund',     description: 'Church building project' },
    { id: 'welfare',   name: 'Welfare',           description: 'Member welfare support' },
  ];
}

async function loadContributions() {
  if (typeof supabaseClient === 'undefined') return;
  try {
    const { data, error } = await supabaseClient.from('contributions')
      .select('*').order('contribution_date', { ascending: false });
    if (error) throw error;
    contributionsData = (data || []).map(c => ({
      id: c.id, date: c.contribution_date, member: c.member_name,
      type: c.contribution_type, categoryId: c.category_id || c.contribution_type,
      amount: c.amount, method: c.payment_method, status: c.status || 'confirmed',
      ref: c.reference || 'N/A', notes: c.notes || ''
    }));
    isSupabaseConnected = true;
  } catch (err) { console.warn('Contributions fetch failed:', err.message); }
}

// ============================================================
//  ADMIN UI — driven by window.isAdmin (set by shared-auth.js
//  after checking the logged-in user's profiles.role)
// ============================================================
function applyAdminUI() {
  document.querySelectorAll('.admin-only').forEach(el => {
    el.style.display = window.isAdmin ? '' : 'none';
  });

  const toggleBtn = document.getElementById('adminToggleBtn');
  if (toggleBtn) {
    if (window.isAdmin) {
      toggleBtn.textContent = '🔓 Admin Mode';
      toggleBtn.classList.add('admin-active');
      toggleBtn.title = 'Signed in as admin';
    } else {
      toggleBtn.style.display = 'none'; // non-admins don't need to see this at all
    }
  }
}

// ============================================================
//  DATE HELPER
// ============================================================
function formatDate(dateStr) {
  if (!dateStr) return '—';
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ============================================================
//  SUMMARY CARDS
// ============================================================
function updateSummaryCards() {
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonth = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;

  const confirmed = contributionsData.filter(c => c.status === 'confirmed');
  const total       = confirmed.reduce((s, c) => s + c.amount, 0);
  const thisMonthIn = confirmed.filter(c => c.date.startsWith(thisMonth)).reduce((s, c) => s + c.amount, 0);
  const lastMonthIn = confirmed.filter(c => c.date.startsWith(lastMonth)).reduce((s, c) => s + c.amount, 0);
  const unique      = new Set(confirmed.map(c => c.member)).size;
  const inTrend     = lastMonthIn > 0 ? Math.round(((thisMonthIn - lastMonthIn) / lastMonthIn) * 100) : null;

  set('currentBalance', `KES ${total.toLocaleString()}`);
  set('monthIncome', `KES ${thisMonthIn.toLocaleString()}`);
  set('activeContributors', `${unique} / ${membersData.length || '—'}`);

  const trendEl = document.getElementById('incomeTrend');
  if (trendEl) {
    trendEl.textContent = inTrend === null ? 'Confirmed contributions' : `${inTrend >= 0 ? '+' : ''}${inTrend}% vs last month`;
    trendEl.className = `t-trend ${inTrend === null ? '' : (inTrend >= 0 ? 't-up' : 't-down')}`;
  }
}

function set(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }

// ============================================================
//  CATEGORY TABS
// ============================================================
function renderCategoryTabs() {
  const container = document.getElementById('categoryTabs');
  if (!container) return;
  container.innerHTML = `<button class="cat-tab ${activeCategoryId === null ? 'active' : ''}" data-catid="">All Categories</button>` +
    categoriesData.map(cat => `
      <button class="cat-tab ${activeCategoryId === cat.id ? 'active' : ''}" data-catid="${esc(cat.id)}">${esc(cat.name)}</button>`).join('');

  container.querySelectorAll('.cat-tab').forEach(btn => {
    btn.addEventListener('click', () => switchCategory(btn.dataset.catid || null));
  });
}

function switchCategory(catId) {
  activeCategoryId = catId || null;
  currentPage = 1;
  renderCategoryTabs();
  renderContributions();
}

// ============================================================
//  CONTRIBUTIONS TABLE
// ============================================================
function getFilteredContributions() {
  const filterMonth  = document.getElementById('filterMonth')?.value  || '';
  const filterStatus = document.getElementById('filterStatus')?.value || '';
  let filtered = [...contributionsData];
  if (activeCategoryId !== null) filtered = filtered.filter(c => c.categoryId === activeCategoryId || c.type === activeCategoryId);
  if (filterMonth)  filtered = filtered.filter(c => c.date.startsWith(filterMonth));
  if (filterStatus) filtered = filtered.filter(c => c.status === filterStatus);
  return filtered;
}

function renderContributions() {
  const tbody = document.getElementById('contribTableBody');
  if (!tbody) return;

  const filtered = getFilteredContributions();
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1;
  if (currentPage > totalPages) currentPage = totalPages;

  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  updateSummaryCards();

  if (!paginated.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state">No contributions found.</td></tr>`;
    renderPagination(0, 1);
    return;
  }

  tbody.innerHTML = paginated.map(c => {
    const catName = categoriesData.find(cat => cat.id === c.categoryId || cat.id === c.type)?.name || c.type;
    return `
    <tr data-id="${esc(c.id)}">
      <td>${esc(c.member)}</td>
      <td>${formatDate(c.date)}</td>
      <td><span class="type-badge">${esc(catName)}</span></td>
      <td>${esc(methodLabels[c.method] || c.method)}</td>
      <td><span class="status-badge status-${esc(c.status)}">${esc(c.status)}</span></td>
      <td class="text-right"><strong>KES ${c.amount.toLocaleString()}</strong></td>
      <td>
        <button class="action-btn" data-view="${esc(c.id)}" title="View details">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
        ${window.isAdmin ? `
        <button class="action-btn" data-edit="${esc(c.id)}" title="Edit">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="action-btn action-danger" data-delete="${esc(c.id)}" title="Delete">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/></svg>
        </button>` : ''}
      </td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('[data-view]').forEach(btn => btn.addEventListener('click', () => openDetailModal(btn.dataset.view)));
  tbody.querySelectorAll('[data-edit]').forEach(btn => btn.addEventListener('click', () => openModal(btn.dataset.edit)));
  tbody.querySelectorAll('[data-delete]').forEach(btn => btn.addEventListener('click', () => deleteContribution(btn.dataset.delete)));

  renderPagination(filtered.length, totalPages);
}

function renderPagination(total, totalPages) {
  const info = document.getElementById('pageInfo');
  const buttonsWrap = document.getElementById('pageButtons');
  if (info) info.textContent = total ? `Page ${currentPage} of ${totalPages} · ${total} records` : 'No records';
  if (!buttonsWrap) return;

  let html = `<button class="page-btn" id="prevPage" ${currentPage <= 1 ? 'disabled' : ''}>‹</button>`;
  for (let i = 1; i <= totalPages; i++) {
    html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
  }
  html += `<button class="page-btn" id="nextPage" ${currentPage >= totalPages ? 'disabled' : ''}>›</button>`;
  buttonsWrap.innerHTML = html;

  buttonsWrap.querySelector('#prevPage')?.addEventListener('click', () => { if (currentPage > 1) { currentPage--; renderContributions(); } });
  buttonsWrap.querySelector('#nextPage')?.addEventListener('click', () => { currentPage++; renderContributions(); });
  buttonsWrap.querySelectorAll('[data-page]').forEach(btn => {
    btn.addEventListener('click', () => { currentPage = parseInt(btn.dataset.page); renderContributions(); });
  });
}

// ============================================================
//  QUICK STATS
// ============================================================
function renderQuickStats() {
  set('qsTotalRecords', contributionsData.length.toLocaleString());
  const collected = contributionsData.filter(c => c.status === 'confirmed').reduce((s, c) => s + c.amount, 0);
  set('qsTotalCollected', `KES ${collected.toLocaleString()}`);
  const pending = contributionsData.filter(c => c.status === 'pending').reduce((s, c) => s + c.amount, 0);
  set('qsPending', `KES ${pending.toLocaleString()}`);
  set('qsCategories', categoriesData.length.toLocaleString());
}

// ============================================================
//  POPULATE SELECTS
// ============================================================
function populateMemberSelect() {
  const sel = document.getElementById('contribMember');
  if (!sel) return;
  sel.innerHTML = '<option value="">Select member…</option>' +
    membersData.map(m => `<option value="${esc(m.name)}">${esc(m.name)}</option>`).join('');
}

function populateTypeSelect() {
  const sel = document.getElementById('contribType');
  if (!sel) return;
  sel.innerHTML = '<option value="">Select category…</option>' +
    categoriesData.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
}

function populateFilterMonth() {
  const sel = document.getElementById('filterMonth');
  if (!sel) return;
  const months = [...new Set(contributionsData.map(c => c.date?.slice(0, 7)).filter(Boolean))].sort().reverse();
  sel.innerHTML = '<option value="">All Months</option>' +
    months.map(m => {
      const d = new Date(`${m}-01`);
      const label = d.toLocaleDateString('en-KE', { month: 'long', year: 'numeric' });
      return `<option value="${m}">${label}</option>`;
    }).join('');
}

function setDefaultDate() {
  const el = document.getElementById('contribDate');
  if (el && !el.value) el.value = new Date().toISOString().split('T')[0];
}

// ============================================================
//  CHARTS
// ============================================================
function initCharts() {
  renderExpenseChart();
  renderTrendChart();
}

function renderExpenseChart() {
  const canvas = document.getElementById('categoryChart');
  if (!canvas || typeof Chart === 'undefined') return;
  const totals = categoriesData.map(cat =>
    contributionsData.filter(c => c.categoryId === cat.id || c.type === cat.id).reduce((s, c) => s + c.amount, 0));
  const colors = ['#c9a227', '#162040', '#7b1230', '#4d7259', '#1e2e55', '#243560', '#8a6d0b', '#991b1b'];

  if (canvas._chartInstance) canvas._chartInstance.destroy();
  canvas._chartInstance = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: categoriesData.map(c => c.name),
      datasets: [{ data: totals, backgroundColor: colors, borderWidth: 0 }]
    },
    options: { responsive: true, plugins: { legend: { display: false } } }
  });

  const legend = document.getElementById('categoryLegend');
  if (legend) {
    legend.innerHTML = categoriesData.map((c, i) => `
      <div class="legend-item"><span class="legend-dot" style="background:${colors[i % colors.length]}"></span>${esc(c.name)}</div>`).join('');
  }
}

function renderTrendChart() {
  const canvas = document.getElementById('contributionChart');
  if (!canvas || typeof Chart === 'undefined') return;
  const periodSelect = document.getElementById('chartPeriod');
  const periodMonths = parseInt(periodSelect?.value || '6');

  const months = [];
  for (let i = periodMonths - 1; i >= 0; i--) {
    const d = new Date(); d.setMonth(d.getMonth() - i);
    months.push({ label: d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }), key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` });
  }
  const totals = months.map(m => contributionsData.filter(c => c.date.startsWith(m.key) && c.status === 'confirmed').reduce((s, c) => s + c.amount, 0));

  if (canvas._chartInstance) canvas._chartInstance.destroy();
  canvas._chartInstance = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: months.map(m => m.label),
      datasets: [{ label: 'Monthly Income (KES)', data: totals, backgroundColor: 'rgba(201,162,39,0.75)', borderRadius: 6 }]
    },
    options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
  });
}

// ============================================================
//  DETAIL MODAL
// ============================================================
function openDetailModal(id) {
  const c = contributionsData.find(x => String(x.id) === String(id));
  if (!c) return;
  const catName = categoriesData.find(cat => cat.id === c.categoryId || cat.id === c.type)?.name || c.type;

  set('detailMember', c.member);
  set('detailDate', formatDate(c.date));
  set('detailType', catName);
  set('detailAmount', `KES ${c.amount.toLocaleString()}`);
  set('detailMethod', methodLabels[c.method] || c.method);
  set('detailRef', c.ref);
  set('detailNotes', c.notes || '—');

  const badge = document.getElementById('detailStatusBadge');
  if (badge) { badge.textContent = c.status; badge.className = `status-badge status-${c.status}`; }

  document.getElementById('detailModal')?.classList.add('active');
  document.body.style.overflow = 'hidden';
}
function closeDetailModal() { document.getElementById('detailModal')?.classList.remove('active'); document.body.style.overflow = ''; }

// ============================================================
//  MODALS — ADD/EDIT CONTRIBUTION / CATEGORY
// ============================================================
function openModal(contribId = null) {
  if (!window.isAdmin) { alert('Admin access required. Please unlock admin mode first.'); return; }
  editingContribId = contribId;
  const modalTitle = document.querySelector('#addContribModal .modal-header h3');
  const submitBtn  = document.querySelector('#contribForm button[type="submit"]');

  if (contribId) {
    const c = contributionsData.find(x => String(x.id) === String(contribId));
    if (!c) return;
    if (modalTitle) modalTitle.textContent = 'Edit Contribution Record';
    if (submitBtn)  submitBtn.textContent = 'Save Changes';
    document.getElementById('contribMember').value = c.member;
    document.getElementById('contribDate').value = c.date;
    document.getElementById('contribType').value = c.categoryId || c.type;
    document.getElementById('contribAmount').value = c.amount;
    document.getElementById('contribMethod').value = c.method;
    document.getElementById('contribRef').value = c.ref === 'N/A' ? '' : c.ref;
    document.getElementById('contribNotes').value = c.notes || '';
  } else {
    if (modalTitle) modalTitle.textContent = 'Add Contribution Record';
    if (submitBtn)  submitBtn.textContent = 'Save Record';
    document.getElementById('contribForm')?.reset();
    setDefaultDate();
  }

  document.getElementById('addContribModal')?.classList.add('active');
  document.body.style.overflow = 'hidden';
}
function closeModal() {
  document.getElementById('addContribModal')?.classList.remove('active');
  document.body.style.overflow = '';
  document.getElementById('contribForm')?.reset();
  editingContribId = null;
  setDefaultDate();
}
function openCategoryModal() {
  if (!window.isAdmin) return;
  document.getElementById('addCategoryModal')?.classList.add('active');
  document.body.style.overflow = 'hidden';
}
function closeCategoryModal() {
  document.getElementById('addCategoryModal')?.classList.remove('active');
  document.body.style.overflow = '';
  document.getElementById('categoryForm')?.reset();
}

// ============================================================
//  SAVE / DELETE
// ============================================================
async function saveContributionToSupabase(data, editId) {
  if (!isSupabaseConnected) return null;
  const payload = {
    member_name: data.member, contribution_type: data.type, category_id: data.type,
    amount: data.amount, payment_method: data.method, contribution_date: data.date,
    reference: data.ref || 'N/A', notes: data.notes || ''
  };
  if (editId) {
    const { data: result, error } = await supabaseClient.from('contributions')
      .update(payload).eq('id', editId).select().single();
    if (error) throw error;
    return result;
  } else {
    const { data: result, error } = await supabaseClient.from('contributions')
      .insert([{ ...payload, status: 'confirmed' }]).select().single();
    if (error) throw error;
    return result;
  }
}

async function deleteContribution(id) {
  if (!window.isAdmin) return;
  if (!confirm('Delete this record? Cannot be undone.')) return;
  try {
    if (isSupabaseConnected && !String(id).startsWith('local-')) {
      const { error } = await supabaseClient.from('contributions').delete().eq('id', id);
      if (error) throw error;
    }
    contributionsData = contributionsData.filter(c => String(c.id) !== String(id));
    renderContributions(); renderExpenseChart(); renderTrendChart(); renderQuickStats();
  } catch (err) {
    alert('Failed to delete: ' + err.message);
  }
}

async function saveCategoryToSupabase(data) {
  if (!isSupabaseConnected) return null;
  try {
    const { data: result, error } = await supabaseClient.from('contribution_categories')
      .insert([{ name: data.name, description: data.description || '' }]).select().single();
    if (error) throw error;
    return result;
  } catch (err) { console.error('Failed to save category:', err); return null; }
}

function esc(str) { return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

// ============================================================
//  INIT
// ============================================================
async function initTreasury() {
  if (window.__treasuryInited) return;
  window.__treasuryInited = true;

  await Promise.all([loadMembers(), loadCategories()]);
  await loadContributions();

  renderCategoryTabs();
  renderContributions();
  renderQuickStats();
  initCharts();
  populateMemberSelect();
  populateTypeSelect();
  populateFilterMonth();
  setDefaultDate();
  applyAdminUI();

  document.getElementById('filterMonth')?.addEventListener('change', () => { currentPage = 1; renderContributions(); });
  document.getElementById('filterStatus')?.addEventListener('change', () => { currentPage = 1; renderContributions(); });
  document.getElementById('chartPeriod')?.addEventListener('change', renderTrendChart);

  document.getElementById('addContributionBtn')?.addEventListener('click', () => openModal());
  document.getElementById('addCategoryBtn')?.addEventListener('click', openCategoryModal);

  document.getElementById('addContribClose')?.addEventListener('click', closeModal);
  document.getElementById('cancelContrib')?.addEventListener('click', closeModal);
  document.getElementById('detailModalClose')?.addEventListener('click', closeDetailModal);
  document.getElementById('categoryModalClose')?.addEventListener('click', closeCategoryModal);
  document.getElementById('cancelCategory')?.addEventListener('click', closeCategoryModal);

  ['addContribModal', 'detailModal', 'addCategoryModal'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', e => {
      if (e.target.classList.contains('modal-overlay')) {
        if (id === 'addContribModal') closeModal();
        else if (id === 'detailModal') closeDetailModal();
        else closeCategoryModal();
      }
    });
  });

  document.getElementById('contribForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const member = document.getElementById('contribMember').value;
    const date = document.getElementById('contribDate').value;
    const type = document.getElementById('contribType').value;
    const amount = parseInt(document.getElementById('contribAmount').value, 10);
    const method = document.getElementById('contribMethod').value;
    const ref = document.getElementById('contribRef').value || 'N/A';
    const notes = document.getElementById('contribNotes')?.value || '';

    if (!member || !date || !type || !amount) { alert('Fill all required fields.'); return; }

    const isEdit = !!editingContribId;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving…';

    try {
      const saved = await saveContributionToSupabase({ member, date, type, amount, method, ref, notes }, editingContribId);

      if (isEdit) {
        const idx = contributionsData.findIndex(c => String(c.id) === String(editingContribId));
        if (idx !== -1) {
          contributionsData[idx] = { ...contributionsData[idx], date, member, type, categoryId: type, amount, method, ref, notes };
        }
      } else {
        contributionsData.unshift({
          id: saved?.id ?? `local-${Date.now()}`, date, member, type, categoryId: type,
          amount, method, status: 'confirmed', ref, notes
        });
      }

      renderContributions(); renderExpenseChart(); renderTrendChart(); renderQuickStats();
      closeModal();
    } catch (err) {
      alert('Failed to save: ' + err.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = isEdit ? 'Save Changes' : 'Save Record';
    }
  });

  document.getElementById('categoryForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const name = document.getElementById('catName').value.trim();
    const description = document.getElementById('catDescription').value.trim();
    if (!name) { alert('Enter a category name.'); return; }
    const saved = await saveCategoryToSupabase({ name, description });
    categoriesData.push(saved ?? { id: `local-${Date.now()}`, name, description });
    renderCategoryTabs(); populateTypeSelect(); populateFilterMonth(); renderQuickStats(); renderExpenseChart();
    closeCategoryModal();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeModal(); closeDetailModal(); closeCategoryModal(); }
  });
}

document.addEventListener('adminReady', initTreasury);
// Fallback: if shared-auth.js never fires adminReady (e.g. script missing/blocked), still init.
window.addEventListener('load', () => {
  setTimeout(() => {
    if (!window.__treasuryInited) initTreasury();
  }, 1200);
});