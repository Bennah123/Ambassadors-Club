// ============================================================
//  TREASURY.JS — SDA Embakasi Central Ambassadors Club
//  Admin PIN: 0000 (change ADMIN_PIN constant below)
// ============================================================

const ADMIN_PIN = '0000';

// ---- LABELS ----
const typeLabels = {
  sabbath: 'Sabbath Offering',
  tithe: 'Tithe',
  camp: 'Camp Meeting',
  recording: 'Recording',
  building: 'Building Fund',
  welfare: 'Welfare',
  other: 'Other'
};

const methodLabels = {
  mpesa: 'M-Pesa',
  cash: 'Cash',
  bank: 'Bank Transfer'
};

// ---- STATE ----
let contributionsData = [];
let categoriesData = [];   // from contribution_categories table
let membersData = [];       // from members table
let isSupabaseConnected = false;
let isAdmin = false;
let activeCategoryId = null; // null = "All Contributions" view

// ---- PAGINATION ----
const PAGE_SIZE = 10;
let currentPage = 1;

// ============================================================
//  SUPABASE LOADERS
// ============================================================

async function loadMembers() {
  if (typeof supabaseClient === 'undefined') return;
  try {
    const { data, error } = await supabaseClient
      .from('members')
      .select('id, first_name, last_name')
      .order('first_name', { ascending: true });
    if (error) throw error;
    membersData = (data || []).map(m => ({
      id: m.id,
      name: `${m.first_name} ${m.last_name}`.trim()
    }));
  } catch (err) {
    console.warn('Could not load members:', err.message);
  }
}

async function loadCategories() {
  if (typeof supabaseClient === 'undefined') return;
  try {
    const { data, error } = await supabaseClient
      .from('contribution_categories')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) throw error;
    categoriesData = data || [];
  } catch (err) {
    console.warn('Could not load categories:', err.message);
    // Fallback built-in categories so UI isn't empty
    categoriesData = [
      { id: 'sabbath', name: 'Sabbath Offering', description: 'Weekly Sabbath collections' },
      { id: 'tithe', name: 'Tithe', description: 'Member tithes' },
      { id: 'camp', name: 'Camp Meeting', description: 'Annual camp fund' },
      { id: 'recording', name: 'Recording', description: 'Studio & recording costs' },
      { id: 'building', name: 'Building Fund', description: 'Church building project' },
      { id: 'welfare', name: 'Welfare', description: 'Member welfare support' },
    ];
  }
}

async function loadContributions() {
  if (typeof supabaseClient === 'undefined') {
    console.log('Supabase not configured — using empty state.');
    return;
  }
  try {
    const { data, error } = await supabaseClient
      .from('contributions')
      .select('*')
      .order('contribution_date', { ascending: false });
    if (error) throw error;
    contributionsData = (data || []).map(c => ({
      id: c.id,
      date: c.contribution_date,
      member: c.member_name,
      type: c.contribution_type,
      categoryId: c.category_id || c.contribution_type,
      amount: c.amount,
      method: c.payment_method,
      status: c.status,
      ref: c.reference || 'N/A',
      notes: c.notes || ''
    }));
    isSupabaseConnected = true;
    console.log(`✅ Loaded ${contributionsData.length} contributions`);
  } catch (err) {
    console.warn('Supabase contributions fetch failed:', err.message);
  }
}

// ============================================================
//  DATE HELPER (fixes UTC→EAT shift bug)
// ============================================================
function formatDate(dateStr) {
  // Parse as local date to avoid UTC midnight → previous day in EAT (UTC+3)
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ============================================================
//  SUMMARY CARDS  (all computed from live data)
// ============================================================
function updateSummaryCards() {
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const lastMonth = (() => {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  })();

  const total = contributionsData.reduce((s, c) => s + c.amount, 0);

  const thisMonthIn = contributionsData
    .filter(c => c.date.startsWith(thisMonth) && c.status === 'confirmed')
    .reduce((s, c) => s + c.amount, 0);

  const lastMonthIn = contributionsData
    .filter(c => c.date.startsWith(lastMonth) && c.status === 'confirmed')
    .reduce((s, c) => s + c.amount, 0);

  const uniqueContributors = new Set(
    contributionsData.filter(c => c.status === 'confirmed').map(c => c.member)
  ).size;
  const totalMembers = membersData.length || '—';

  const inTrend = lastMonthIn > 0
    ? Math.round(((thisMonthIn - lastMonthIn) / lastMonthIn) * 100)
    : null;

  set('currentBalance', `KES ${total.toLocaleString()}`);
  set('monthIncome', `KES ${thisMonthIn.toLocaleString()}`);
  set('activeContributors', `${uniqueContributors} / ${totalMembers}`);

  const trendEl = document.getElementById('incomeTrend');
  if (trendEl && inTrend !== null) {
    trendEl.textContent = `${inTrend >= 0 ? '+' : ''}${inTrend}% vs last month`;
    trendEl.className = `t-trend ${inTrend >= 0 ? 't-up' : 't-down'}`;
  }

  // YTD quick stats
  const ytdTotal = contributionsData
    .filter(c => c.date.startsWith(String(now.getFullYear())))
    .reduce((s, c) => s + c.amount, 0);
  set('ytdTotal', `KES ${ytdTotal.toLocaleString()}`);

  // Per-category totals in quick stats
  categoriesData.forEach(cat => {
    const catTotal = contributionsData
      .filter(c => (c.categoryId === cat.id || c.type === cat.id))
      .reduce((s, c) => s + c.amount, 0);
    const el = document.getElementById(`qs-cat-${cat.id}`);
    if (el) el.textContent = `KES ${catTotal.toLocaleString()}`;
  });
}

function set(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ============================================================
//  CATEGORY TABS
// ============================================================
function renderCategoryTabs() {
  const container = document.getElementById('categoryTabs');
  if (!container) return;

  const tabs = [{ id: null, name: 'All' }, ...categoriesData];

  container.innerHTML = tabs.map(cat => `
    <button class="cat-tab ${activeCategoryId === cat.id ? 'active' : ''}"
            data-catid="${cat.id ?? ''}"
            onclick="switchCategory(${cat.id === null ? 'null' : `'${cat.id}'`})">
      ${cat.name}
    </button>
  `).join('');
}

function switchCategory(catId) {
  activeCategoryId = catId === '' ? null : catId;
  currentPage = 1;
  renderCategoryTabs();
  renderContributions();
}

// ============================================================
//  CONTRIBUTIONS TABLE
// ============================================================
function getFilteredContributions() {
  const filterType = document.getElementById('filterType')?.value || 'all';
  const filterMonth = document.getElementById('filterMonth')?.value || 'all';

  let filtered = [...contributionsData];

  if (activeCategoryId !== null) {
    filtered = filtered.filter(c =>
      c.categoryId === activeCategoryId || c.type === activeCategoryId
    );
  }
  if (filterType !== 'all') {
    filtered = filtered.filter(c => c.type === filterType || c.categoryId === filterType);
  }
  if (filterMonth !== 'all') {
    filtered = filtered.filter(c => c.date.startsWith(filterMonth));
  }

  filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
  return filtered;
}

function renderContributions() {
  const filtered = getFilteredContributions();
  const tbody = document.getElementById('contributionsTableBody');
  if (!tbody) return;

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  if (currentPage > totalPages) currentPage = totalPages;

  const start = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(start, start + PAGE_SIZE);

  if (pageItems.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-state">
          No contributions found. ${isAdmin ? 'Add one using the button above.' : ''}
        </td>
      </tr>`;
  } else {
    tbody.innerHTML = pageItems.map(c => {
      const catName = getCategoryName(c.categoryId || c.type);
      return `
        <tr>
          <td>${formatDate(c.date)}</td>
          <td><strong>${c.member}</strong></td>
          <td><span class="type-badge">${catName}</span></td>
          <td class="text-right">KES ${c.amount.toLocaleString()}</td>
          <td>${methodLabels[c.method] || c.method}</td>
          <td><span class="status-badge status-${c.status}">${c.status}</span></td>
          <td>
            <button class="action-btn" title="View Details" onclick="openDetailModal(${JSON.stringify(c.id)})">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </button>
            ${isAdmin ? `
            <button class="action-btn action-danger" title="Delete" onclick="deleteContribution(${JSON.stringify(c.id)})">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                <path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
              </svg>
            </button>` : ''}
          </td>
        </tr>`;
    }).join('');
  }

  renderPagination(filtered.length);
  updateSummaryCards();
}

function getCategoryName(catId) {
  const cat = categoriesData.find(c => c.id === catId);
  if (cat) return cat.name;
  return typeLabels[catId] || catId || 'Other';
}

// ============================================================
//  PAGINATION
// ============================================================
function renderPagination(totalItems) {
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const start = Math.min((currentPage - 1) * PAGE_SIZE + 1, totalItems);
  const end = Math.min(currentPage * PAGE_SIZE, totalItems);

  set('pageInfo', `Showing ${totalItems === 0 ? 0 : start}–${end} of ${totalItems} records`);

  const container = document.getElementById('pageButtons');
  if (!container) return;

  let buttons = '';
  buttons += `<button class="page-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="goPage(${currentPage - 1})">&#8592;</button>`;

  for (let i = 1; i <= totalPages; i++) {
    if (totalPages <= 7 || i === 1 || i === totalPages || Math.abs(i - currentPage) <= 1) {
      buttons += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="goPage(${i})">${i}</button>`;
    } else if (Math.abs(i - currentPage) === 2) {
      buttons += `<span class="page-ellipsis">…</span>`;
    }
  }

  buttons += `<button class="page-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="goPage(${currentPage + 1})">&#8594;</button>`;
  container.innerHTML = buttons;
}

function goPage(n) {
  currentPage = n;
  renderContributions();
  document.getElementById('contributionsTable')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ============================================================
//  CHARTS
// ============================================================
function initCharts() {
  renderTrendChart();
  renderExpenseChart();
}

function renderTrendChart() {
  const ctx = document.getElementById('contributionChart');
  if (!ctx) return;

  // Build last-6-months labels + totals from real data
  const months = [];
  const totals = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-KE', { month: 'short' });
    const sum = contributionsData
      .filter(c => c.date.startsWith(key) && c.status === 'confirmed')
      .reduce((s, c) => s + c.amount, 0);
    months.push(label);
    totals.push(sum);
  }

  if (window._trendChart) window._trendChart.destroy();
  window._trendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: months,
      datasets: [{
        label: 'Contributions (KES)',
        data: totals,
        borderColor: '#1a365d',
        backgroundColor: 'rgba(26,54,93,0.08)',
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#c9a227',
        pointBorderColor: '#1a365d',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(0,0,0,0.05)' },
          ticks: { callback: v => 'KES ' + (v / 1000).toFixed(0) + 'K' }
        },
        x: { grid: { display: false } }
      }
    }
  });
}

function renderExpenseChart() {
  const ctx = document.getElementById('expenseChart');
  if (!ctx) return;

  const colors = ['#1a365d','#c9a227','#8b1538','#6b8f71','#94a3b8','#e07b39','#5b4fcf'];
  const labels = [];
  const values = [];

  categoriesData.forEach((cat, i) => {
    const total = contributionsData
      .filter(c => (c.categoryId === cat.id || c.type === cat.id) && c.status === 'confirmed')
      .reduce((s, c) => s + c.amount, 0);
    if (total > 0) {
      labels.push(cat.name);
      values.push(total);
    }
  });

  if (labels.length === 0) {
    labels.push('No data yet');
    values.push(1);
  }

  if (window._expChart) window._expChart.destroy();
  window._expChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors.slice(0, labels.length),
        borderWidth: 0,
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: { legend: { display: false } }
    }
  });

  const legendEl = document.getElementById('expenseLegend');
  if (legendEl) {
    legendEl.innerHTML = labels.map((label, i) => `
      <div class="legend-item">
        <span class="legend-dot" style="background:${colors[i]}"></span>
        <span>${label}</span>
      </div>
    `).join('');
  }
}

// ============================================================
//  QUICK STATS — dynamic category rows
// ============================================================
function renderQuickStats() {
  const grid = document.getElementById('quickStatsGrid');
  if (!grid) return;

  const now = new Date();
  const ytdTotal = contributionsData
    .filter(c => c.date.startsWith(String(now.getFullYear())))
    .reduce((s, c) => s + c.amount, 0);

  let html = `
    <div class="qs-item">
      <span class="qs-label">Total Collected (YTD)</span>
      <span class="qs-value" id="ytdTotal">KES ${ytdTotal.toLocaleString()}</span>
    </div>`;

  categoriesData.forEach(cat => {
    const total = contributionsData
      .filter(c => (c.categoryId === cat.id || c.type === cat.id))
      .reduce((s, c) => s + c.amount, 0);
    html += `
      <div class="qs-item">
        <span class="qs-label">${cat.name}</span>
        <span class="qs-value" id="qs-cat-${cat.id}">KES ${total.toLocaleString()}</span>
      </div>`;
  });

  grid.innerHTML = html;
}

// ============================================================
//  POPULATE SELECTS
// ============================================================
function populateMemberSelect() {
  const select = document.getElementById('contribMember');
  if (!select) return;
  while (select.options.length > 1) select.remove(1);

  if (membersData.length > 0) {
    membersData.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.name;
      opt.textContent = m.name;
      select.appendChild(opt);
    });
  }
}

function populateTypeSelect() {
  const select = document.getElementById('contribType');
  if (!select) return;
  while (select.options.length > 1) select.remove(1);
  categoriesData.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat.id;
    opt.textContent = cat.name;
    select.appendChild(opt);
  });
}

function populateFilterType() {
  const select = document.getElementById('filterType');
  if (!select) return;
  while (select.options.length > 1) select.remove(1);
  categoriesData.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat.id;
    opt.textContent = cat.name;
    select.appendChild(opt);
  });
}

function setDefaultDate() {
  const el = document.getElementById('contribDate');
  if (el) {
    const now = new Date();
    el.value = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  }
}

// ============================================================
//  ADMIN MODE
// ============================================================
function promptAdminLogin() {
  const modal = document.getElementById('adminPinModal');
  if (modal) {
    modal.classList.add('active');
    document.getElementById('adminPinInput')?.focus();
  }
}

function closeAdminPinModal() {
  const modal = document.getElementById('adminPinModal');
  if (modal) modal.classList.remove('active');
  const input = document.getElementById('adminPinInput');
  if (input) input.value = '';
  const err = document.getElementById('pinError');
  if (err) err.textContent = '';
}

function submitAdminPin() {
  const input = document.getElementById('adminPinInput');
  const err = document.getElementById('pinError');
  if (!input) return;

  if (input.value === ADMIN_PIN) {
    isAdmin = true;
    closeAdminPinModal();
    applyAdminUI();
  } else {
    if (err) err.textContent = 'Incorrect PIN. Try again.';
    input.value = '';
    input.focus();
  }
}

function logoutAdmin() {
  isAdmin = false;
  applyAdminUI();
}

function applyAdminUI() {
  // Admin button label
  const adminBtn = document.getElementById('adminToggleBtn');
  if (adminBtn) {
    adminBtn.textContent = isAdmin ? '🔓 Admin: ON' : '🔒 Admin';
    adminBtn.classList.toggle('admin-active', isAdmin);
  }

  // Show/hide admin-only elements
  document.querySelectorAll('.admin-only').forEach(el => {
    el.style.display = isAdmin ? '' : 'none';
  });

  // Re-render table to show/hide delete buttons
  renderContributions();
}

// ============================================================
//  MODALS — CONTRIBUTION DETAIL
// ============================================================
function openDetailModal(id) {
  const c = contributionsData.find(x => x.id === id);
  if (!c) return;

  set('detailMember', c.member);
  set('detailDate', formatDate(c.date));
  set('detailType', getCategoryName(c.categoryId || c.type));
  set('detailAmount', `KES ${c.amount.toLocaleString()}`);
  set('detailMethod', methodLabels[c.method] || c.method);
  set('detailRef', c.ref || 'N/A');
  set('detailStatus', c.status.toUpperCase());
  set('detailNotes', c.notes || '—');

  const statusEl = document.getElementById('detailStatusBadge');
  if (statusEl) {
    statusEl.className = `status-badge status-${c.status}`;
    statusEl.textContent = c.status;
  }

  document.getElementById('detailModal')?.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeDetailModal() {
  document.getElementById('detailModal')?.classList.remove('active');
  document.body.style.overflow = '';
}

// ============================================================
//  MODALS — ADD CONTRIBUTION
// ============================================================
function openModal() {
  if (!isAdmin) { promptAdminLogin(); return; }
  document.getElementById('addContribModal')?.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('addContribModal')?.classList.remove('active');
  document.body.style.overflow = '';
  document.getElementById('contribForm')?.reset();
  setDefaultDate();
}

// ============================================================
//  MODALS — ADD CATEGORY (admin only)
// ============================================================
function openCategoryModal() {
  document.getElementById('addCategoryModal')?.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeCategoryModal() {
  document.getElementById('addCategoryModal')?.classList.remove('active');
  document.body.style.overflow = '';
  document.getElementById('categoryForm')?.reset();
}

// ============================================================
//  SAVE CONTRIBUTION
// ============================================================
async function saveContributionToSupabase(data) {
  if (!isSupabaseConnected) return null;
  try {
    const { data: result, error } = await supabaseClient
      .from('contributions')
      .insert([{
        member_name: data.member,
        contribution_type: data.type,
        category_id: data.type,
        amount: data.amount,
        payment_method: data.method,
        contribution_date: data.date,
        reference: data.ref || 'N/A',
        notes: data.notes || '',
        status: 'confirmed'
      }])
      .select()
      .single();
    if (error) throw error;
    return result;
  } catch (err) {
    console.error('Failed to save contribution:', err);
    return null;
  }
}

// ============================================================
//  DELETE CONTRIBUTION
// ============================================================
async function deleteContribution(id) {
  if (!isAdmin) return;
  if (!confirm('Delete this contribution record? This cannot be undone.')) return;

  if (isSupabaseConnected) {
    const { error } = await supabaseClient.from('contributions').delete().eq('id', id);
    if (error) { alert('Failed to delete: ' + error.message); return; }
  }

  contributionsData = contributionsData.filter(c => c.id !== id);
  renderContributions();
  renderExpenseChart();
  renderTrendChart();
}

// ============================================================
//  SAVE CATEGORY
// ============================================================
async function saveCategoryToSupabase(data) {
  if (!isSupabaseConnected) return null;
  try {
    const { data: result, error } = await supabaseClient
      .from('contribution_categories')
      .insert([{ name: data.name, description: data.description || '' }])
      .select()
      .single();
    if (error) throw error;
    return result;
  } catch (err) {
    console.error('Failed to save category:', err);
    return null;
  }
}

// ============================================================
//  EVENT LISTENERS
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  // Load everything
  await Promise.all([loadMembers(), loadCategories()]);
  await loadContributions();

  // Render UI
  renderCategoryTabs();
  renderContributions();
  renderQuickStats();
  initCharts();
  populateMemberSelect();
  populateTypeSelect();
  populateFilterType();
  setDefaultDate();
  applyAdminUI();

  // Filters
  document.getElementById('filterType')?.addEventListener('change', () => { currentPage = 1; renderContributions(); });
  document.getElementById('filterMonth')?.addEventListener('change', () => { currentPage = 1; renderContributions(); });

  // Add contribution button
  document.getElementById('addContributionBtn')?.addEventListener('click', openModal);

  // Admin toggle button
  document.getElementById('adminToggleBtn')?.addEventListener('click', () => {
    if (isAdmin) logoutAdmin();
    else promptAdminLogin();
  });

  // Add category button
  document.getElementById('addCategoryBtn')?.addEventListener('click', openCategoryModal);

  // Modal closes
  document.getElementById('modalClose')?.addEventListener('click', closeModal);
  document.getElementById('cancelContrib')?.addEventListener('click', closeModal);
  document.getElementById('detailModalClose')?.addEventListener('click', closeDetailModal);
  document.getElementById('categoryModalClose')?.addEventListener('click', closeCategoryModal);
  document.getElementById('cancelCategory')?.addEventListener('click', closeCategoryModal);

  // Admin PIN modal
  document.getElementById('pinSubmitBtn')?.addEventListener('click', submitAdminPin);
  document.getElementById('pinCancelBtn')?.addEventListener('click', closeAdminPinModal);
  document.getElementById('adminPinInput')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') submitAdminPin();
  });

  // Close modals on overlay click
  ['addContribModal','detailModal','addCategoryModal','adminPinModal'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', e => {
      if (e.target.id === id || e.target.classList.contains('modal-overlay')) {
        if (id === 'addContribModal') closeModal();
        else if (id === 'detailModal') closeDetailModal();
        else if (id === 'addCategoryModal') closeCategoryModal();
        else if (id === 'adminPinModal') closeAdminPinModal();
      }
    });
  });

  // Contribution form submit
  document.getElementById('contribForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const member = document.getElementById('contribMember').value;
    const date = document.getElementById('contribDate').value;
    const type = document.getElementById('contribType').value;
    const amount = parseInt(document.getElementById('contribAmount').value);
    const method = document.getElementById('contribMethod').value;
    const ref = document.getElementById('contribRef').value || 'N/A';
    const notes = document.getElementById('contribNotes')?.value || '';

    if (!member || !date || !type || !amount) {
      alert('Please fill in all required fields.');
      return;
    }

    const payload = { member, date, type, amount, method, ref, notes };
    const saved = await saveContributionToSupabase(payload);

    const newRecord = {
      id: saved?.id ?? `local-${Date.now()}`,
      date, member, type,
      categoryId: type,
      amount, method,
      status: 'confirmed',
      ref, notes
    };

    contributionsData.unshift(newRecord);
    renderContributions();
    renderExpenseChart();
    renderTrendChart();
    renderQuickStats();
    closeModal();
  });

  // Category form submit
  document.getElementById('categoryForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const name = document.getElementById('catName').value.trim();
    const description = document.getElementById('catDescription').value.trim();

    if (!name) { alert('Please enter a category name.'); return; }

    const saved = await saveCategoryToSupabase({ name, description });
    const newCat = saved ?? { id: `local-${Date.now()}`, name, description };

    categoriesData.push(newCat);
    renderCategoryTabs();
    populateTypeSelect();
    populateFilterType();
    renderQuickStats();
    renderExpenseChart();
    closeCategoryModal();
  });

  // Escape key
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeModal();
      closeDetailModal();
      closeCategoryModal();
      closeAdminPinModal();
    }
  });
});