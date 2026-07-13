// ============================================================
//  TREASURY.JS — SDA Embakasi Central Ambassadors Club
//  Admin controlled via shared-auth.js (role-based login)
// ============================================================

const typeLabels = {
  sabbath: 'Sabbath Offering', tithe: 'Tithe', camp: 'Camp Meeting',
  recording: 'Recording', building: 'Building Fund', welfare: 'Welfare', other: 'Other'
};
const methodLabels = { mpesa: 'M-Pesa', cash: 'Cash', bank: 'Bank Transfer' };

let contributionsData   = [];
let categoriesData      = [];
let membersData         = [];
let isSupabaseConnected = false;
let activeCategoryId    = null;
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
    membersData = (data||[]).map(m => ({ id: m.id, name: `${m.first_name} ${m.last_name}`.trim() }));
  } catch(err) { console.warn('Could not load members:', err.message); }
}

async function loadCategories() {
  if (typeof supabaseClient === 'undefined') return;
  try {
    const { data, error } = await supabaseClient.from('contribution_categories')
      .select('*').order('created_at', { ascending: true });
    if (error) throw error;
    categoriesData = data || [];
  } catch(err) {
    categoriesData = [
      { id: 'sabbath', name: 'Sabbath Offering', description: 'Weekly Sabbath collections' },
      { id: 'tithe',   name: 'Tithe',            description: 'Member tithes' },
      { id: 'camp',    name: 'Camp Meeting',      description: 'Annual camp fund' },
      { id: 'recording',name:'Recording',         description: 'Studio & recording costs' },
      { id: 'building', name:'Building Fund',     description: 'Church building project' },
      { id: 'welfare',  name:'Welfare',           description: 'Member welfare support' },
    ];
  }
}

async function loadContributions() {
  if (typeof supabaseClient === 'undefined') return;
  try {
    const { data, error } = await supabaseClient.from('contributions')
      .select('*').order('contribution_date', { ascending: false });
    if (error) throw error;
    contributionsData = (data||[]).map(c => ({
      id: c.id, date: c.contribution_date, member: c.member_name,
      type: c.contribution_type, categoryId: c.category_id || c.contribution_type,
      amount: c.amount, method: c.payment_method, status: c.status,
      ref: c.reference || 'N/A', notes: c.notes || ''
    }));
    isSupabaseConnected = true;
  } catch(err) { console.warn('Contributions fetch failed:', err.message); }
}

// ============================================================
//  ADMIN UI — driven by window.isAdmin
// ============================================================
function applyAdminUI() {
  const adminEls = document.querySelectorAll('.admin-only');
  adminEls.forEach(el => el.style.display = window.isAdmin ? '' : 'none');

  const toggleBtn = document.getElementById('adminToggleBtn');
  if (toggleBtn) {
    toggleBtn.textContent = window.isAdmin ? '🔓 Admin Mode ON' : '🔑 Admin Login';
    toggleBtn.style.background = window.isAdmin ? 'var(--gold)' : '';
    toggleBtn.style.color      = window.isAdmin ? 'var(--navy)' : '';
  }

  // Show/hide delete buttons in table
  document.querySelectorAll('.delete-contrib-btn').forEach(btn => {
    btn.style.display = window.isAdmin ? 'inline-flex' : 'none';
  });
}

// ============================================================
//  DATE HELPER
// ============================================================
function formatDate(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month-1, day).toLocaleDateString('en-KE', { day:'numeric', month:'short', year:'numeric' });
}

// ============================================================
//  SUMMARY CARDS
// ============================================================
function updateSummaryCards() {
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const lastMonth = (() => {
    const d = new Date(now.getFullYear(), now.getMonth()-1, 1);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  })();
  const total        = contributionsData.reduce((s,c) => s+c.amount, 0);
  const thisMonthIn  = contributionsData.filter(c => c.date.startsWith(thisMonth) && c.status==='confirmed').reduce((s,c) => s+c.amount, 0);
  const lastMonthIn  = contributionsData.filter(c => c.date.startsWith(lastMonth) && c.status==='confirmed').reduce((s,c) => s+c.amount, 0);
  const unique       = new Set(contributionsData.filter(c=>c.status==='confirmed').map(c=>c.member)).size;
  const inTrend      = lastMonthIn > 0 ? Math.round(((thisMonthIn-lastMonthIn)/lastMonthIn)*100) : null;
  const ytdTotal     = contributionsData.filter(c=>c.date.startsWith(String(now.getFullYear()))).reduce((s,c)=>s+c.amount,0);

  set('currentBalance', `KES ${total.toLocaleString()}`);
  set('monthIncome',    `KES ${thisMonthIn.toLocaleString()}`);
  set('activeContributors', `${unique} / ${membersData.length||'—'}`);
  set('ytdTotal', `KES ${ytdTotal.toLocaleString()}`);

  const trendEl = document.getElementById('incomeTrend');
  if (trendEl && inTrend !== null) {
    trendEl.textContent = `${inTrend>=0?'+':''}${inTrend}% vs last month`;
    trendEl.className = `t-trend ${inTrend>=0?'t-up':'t-down'}`;
  }
  categoriesData.forEach(cat => {
    const catTotal = contributionsData.filter(c=>c.categoryId===cat.id||c.type===cat.id).reduce((s,c)=>s+c.amount,0);
    const el = document.getElementById(`qs-cat-${cat.id}`);
    if (el) el.textContent = `KES ${catTotal.toLocaleString()}`;
  });
}

function set(id, val) { const el=document.getElementById(id); if(el) el.textContent=val; }

// ============================================================
//  CATEGORY TABS
// ============================================================
function renderCategoryTabs() {
  const container = document.getElementById('categoryTabs');
  if (!container) return;
  const tabs = [{ id: null, name: 'All' }, ...categoriesData];
  container.innerHTML = tabs.map(cat => `
    <button class="cat-tab ${activeCategoryId===cat.id?'active':''}"
      data-catid="${cat.id??''}"
      onclick="switchCategory(${cat.id===null?'null':`'${cat.id}'`})">
      ${cat.name}
    </button>`).join('');
}

function switchCategory(catId) {
  activeCategoryId = catId==='' ? null : catId;
  currentPage = 1;
  renderCategoryTabs();
  renderContributions();
}

// ============================================================
//  CONTRIBUTIONS TABLE
// ============================================================
function getFilteredContributions() {
  const filterType  = document.getElementById('filterType')?.value  || 'all';
  const filterMonth = document.getElementById('filterMonth')?.value || 'all';
  let filtered = [...contributionsData];
  if (activeCategoryId !== null) filtered = filtered.filter(c => c.categoryId===activeCategoryId||c.type===activeCategoryId);
  if (filterType  !== 'all') filtered = filtered.filter(c => c.type===filterType||c.categoryId===filterType);
  if (filterMonth !== 'all') filtered = filtered.filter(c => c.date.startsWith(filterMonth));
  return filtered;
}

function renderContributions() {
  const tbody = document.getElementById('contribTableBody');
  const empty = document.getElementById('emptyState');
  if (!tbody) return;

  const filtered = getFilteredContributions();
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1;
  if (currentPage > totalPages) currentPage = totalPages;

  const paginated = filtered.slice((currentPage-1)*PAGE_SIZE, currentPage*PAGE_SIZE);

  updateSummaryCards();

  if (!paginated.length) {
    tbody.innerHTML = '';
    if (empty) empty.style.display = 'block';
    renderPagination(0, 0);
    return;
  }
  if (empty) empty.style.display = 'none';

  tbody.innerHTML = paginated.map(c => `
    <tr>
      <td>${formatDate(c.date)}</td>
      <td>${esc(c.member)}</td>
      <td>${esc(typeLabels[c.type]||c.type)}</td>
      <td><strong>KES ${c.amount.toLocaleString()}</strong></td>
      <td>${esc(methodLabels[c.method]||c.method)}</td>
      <td><span class="status-badge status-${c.status}">${c.status}</span></td>
      <td>${esc(c.ref)}</td>
      ${window.isAdmin ? `<td><button class="delete-contrib-btn icon-btn" onclick="deleteContribution('${c.id}')" title="Delete">🗑️</button></td>` : '<td></td>'}
    </tr>`).join('');

  renderPagination(filtered.length, totalPages);
}

function renderPagination(total, totalPages) {
  const el = document.getElementById('paginationInfo');
  const prev = document.getElementById('prevPage');
  const next = document.getElementById('nextPage');
  if (el) el.textContent = total ? `Page ${currentPage} of ${totalPages} · ${total} records` : '';
  if (prev) prev.disabled = currentPage <= 1;
  if (next) next.disabled = currentPage >= totalPages;
}

// ============================================================
//  QUICK STATS
// ============================================================
function renderQuickStats() {
  const container = document.getElementById('quickStatsGrid');
  if (!container) return;
  container.innerHTML = categoriesData.map(cat => {
    const total = contributionsData.filter(c=>c.categoryId===cat.id||c.type===cat.id).reduce((s,c)=>s+c.amount,0);
    return `<div class="qs-item"><span class="qs-label">${esc(cat.name)}</span><span class="qs-val" id="qs-cat-${cat.id}">KES ${total.toLocaleString()}</span></div>`;
  }).join('');
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
  ['contribType'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = '<option value="">Select type…</option>' +
      categoriesData.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
  });
}

function populateFilterType() {
  const sel = document.getElementById('filterType');
  if (!sel) return;
  sel.innerHTML = '<option value="all">All Types</option>' +
    categoriesData.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
}

function setDefaultDate() {
  const el = document.getElementById('contribDate');
  if (el) el.value = new Date().toISOString().split('T')[0];
}

// ============================================================
//  CHARTS
// ============================================================
function initCharts() {
  renderExpenseChart();
  renderTrendChart();
}

function renderExpenseChart() {
  const canvas = document.getElementById('expenseChart');
  if (!canvas || typeof Chart === 'undefined') return;
  const totals = categoriesData.map(cat =>
    contributionsData.filter(c=>c.categoryId===cat.id||c.type===cat.id).reduce((s,c)=>s+c.amount,0));
  if (canvas._chartInstance) canvas._chartInstance.destroy();
  canvas._chartInstance = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: categoriesData.map(c=>c.name),
      datasets: [{ data: totals, backgroundColor: ['#c9a227','#162040','#7b1230','#4d7259','#1e2e55','#243560'], borderWidth: 0 }]
    },
    options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { font: { family: 'DM Sans' } } } } }
  });
}

function renderTrendChart() {
  const canvas = document.getElementById('trendChart');
  if (!canvas || typeof Chart === 'undefined') return;
  const months = [];
  for (let i=5; i>=0; i--) {
    const d = new Date(); d.setMonth(d.getMonth()-i);
    months.push({ label: d.toLocaleDateString('en-GB',{month:'short',year:'2-digit'}), key: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` });
  }
  const totals = months.map(m => contributionsData.filter(c=>c.date.startsWith(m.key)).reduce((s,c)=>s+c.amount,0));
  if (canvas._chartInstance) canvas._chartInstance.destroy();
  canvas._chartInstance = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: months.map(m=>m.label),
      datasets: [{ label:'Monthly Income (KES)', data: totals, backgroundColor: 'rgba(201,162,39,0.75)', borderRadius: 6 }]
    },
    options: { responsive:true, plugins:{ legend:{ display:false } }, scales:{ y:{ beginAtZero:true } } }
  });
}

// ============================================================
//  DETAIL MODAL
// ============================================================
function openDetailModal(id) {
  const c = contributionsData.find(x=>x.id===id);
  if (!c) return;
  const body = document.getElementById('detailModalBody');
  if (body) body.innerHTML = `
    <div class="detail-grid">
      <div class="detail-row"><span>Member</span><strong>${esc(c.member)}</strong></div>
      <div class="detail-row"><span>Date</span><strong>${formatDate(c.date)}</strong></div>
      <div class="detail-row"><span>Type</span><strong>${esc(typeLabels[c.type]||c.type)}</strong></div>
      <div class="detail-row"><span>Amount</span><strong>KES ${c.amount.toLocaleString()}</strong></div>
      <div class="detail-row"><span>Method</span><strong>${esc(methodLabels[c.method]||c.method)}</strong></div>
      <div class="detail-row"><span>Status</span><strong>${c.status}</strong></div>
      <div class="detail-row"><span>Reference</span><strong>${esc(c.ref)}</strong></div>
      ${c.notes ? `<div class="detail-row"><span>Notes</span><strong>${esc(c.notes)}</strong></div>` : ''}
    </div>`;
  document.getElementById('detailModal')?.classList.add('active');
  document.body.style.overflow = 'hidden';
}
function closeDetailModal() { document.getElementById('detailModal')?.classList.remove('active'); document.body.style.overflow=''; }

// ============================================================
//  MODALS — ADD CONTRIBUTION / CATEGORY
// ============================================================
function openModal() {
  if (!window.isAdmin) { alert('Admin access required. Please sign in with an admin account.'); return; }
  document.getElementById('addContribModal')?.classList.add('active');
  document.body.style.overflow = 'hidden';
}
function closeModal() {
  document.getElementById('addContribModal')?.classList.remove('active');
  document.body.style.overflow='';
  document.getElementById('contribForm')?.reset();
  setDefaultDate();
}
function openCategoryModal() {
  if (!window.isAdmin) return;
  document.getElementById('addCategoryModal')?.classList.add('active');
  document.body.style.overflow='hidden';
}
function closeCategoryModal() {
  document.getElementById('addCategoryModal')?.classList.remove('active');
  document.body.style.overflow='';
  document.getElementById('categoryForm')?.reset();
}

// ============================================================
//  SAVE / DELETE
// ============================================================
async function saveContributionToSupabase(data) {
  if (!isSupabaseConnected) return null;
  try {
    const { data: result, error } = await supabaseClient.from('contributions').insert([{
      member_name: data.member, contribution_type: data.type, category_id: data.type,
      amount: data.amount, payment_method: data.method, contribution_date: data.date,
      reference: data.ref||'N/A', notes: data.notes||'', status:'confirmed'
    }]).select().single();
    if (error) throw error;
    return result;
  } catch(err) { console.error('Failed to save:', err); return null; }
}

async function deleteContribution(id) {
  if (!window.isAdmin) return;
  if (!confirm('Delete this record? Cannot be undone.')) return;
  if (isSupabaseConnected) {
    const { error } = await supabaseClient.from('contributions').delete().eq('id', id);
    if (error) { alert('Failed: '+error.message); return; }
  }
  contributionsData = contributionsData.filter(c=>c.id!==id);
  renderContributions(); renderExpenseChart(); renderTrendChart();
}

async function saveCategoryToSupabase(data) {
  if (!isSupabaseConnected) return null;
  try {
    const { data: result, error } = await supabaseClient.from('contribution_categories')
      .insert([{ name: data.name, description: data.description||'' }]).select().single();
    if (error) throw error;
    return result;
  } catch(err) { console.error('Failed:', err); return null; }
}

function esc(str) { return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// ============================================================
//  INIT — waits for adminReady event from shared-auth.js
// ============================================================
async function initTreasury() {
  await Promise.all([loadMembers(), loadCategories()]);
  await loadContributions();

  renderCategoryTabs();
  renderContributions();
  renderQuickStats();
  initCharts();
  populateMemberSelect();
  populateTypeSelect();
  populateFilterType();
  setDefaultDate();
  applyAdminUI();

  document.getElementById('filterType')?.addEventListener('change',  () => { currentPage=1; renderContributions(); });
  document.getElementById('filterMonth')?.addEventListener('change', () => { currentPage=1; renderContributions(); });
  document.getElementById('addContributionBtn')?.addEventListener('click', openModal);
  document.getElementById('addCategoryBtn')?.addEventListener('click', openCategoryModal);
  document.getElementById('adminToggleBtn')?.addEventListener('click', () => {
    if (window.isAdmin) window.location.href = 'auth.html';
    else window.location.href = 'auth.html';
  });
  document.getElementById('prevPage')?.addEventListener('click', () => { if(currentPage>1){currentPage--;renderContributions();} });
  document.getElementById('nextPage')?.addEventListener('click', () => { currentPage++;renderContributions(); });
  document.getElementById('modalClose')?.addEventListener('click', closeModal);
  document.getElementById('cancelContrib')?.addEventListener('click', closeModal);
  document.getElementById('detailModalClose')?.addEventListener('click', closeDetailModal);
  document.getElementById('categoryModalClose')?.addEventListener('click', closeCategoryModal);
  document.getElementById('cancelCategory')?.addEventListener('click', closeCategoryModal);
  ['addContribModal','detailModal','addCategoryModal'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', e => {
      if (e.target.id===id||e.target.classList.contains('modal-overlay')) {
        if (id==='addContribModal') closeModal();
        else if (id==='detailModal') closeDetailModal();
        else closeCategoryModal();
      }
    });
  });
  document.getElementById('contribForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const member=document.getElementById('contribMember').value, date=document.getElementById('contribDate').value,
          type=document.getElementById('contribType').value, amount=parseInt(document.getElementById('contribAmount').value),
          method=document.getElementById('contribMethod').value, ref=document.getElementById('contribRef').value||'N/A',
          notes=document.getElementById('contribNotes')?.value||'';
    if (!member||!date||!type||!amount){alert('Fill all required fields.');return;}
    const saved=await saveContributionToSupabase({member,date,type,amount,method,ref,notes});
    contributionsData.unshift({id:saved?.id??`local-${Date.now()}`,date,member,type,categoryId:type,amount,method,status:'confirmed',ref,notes});
    renderContributions();renderExpenseChart();renderTrendChart();renderQuickStats();closeModal();
  });
  document.getElementById('categoryForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const name=document.getElementById('catName').value.trim(), description=document.getElementById('catDescription').value.trim();
    if (!name){alert('Enter a category name.');return;}
    const saved=await saveCategoryToSupabase({name,description});
    categoriesData.push(saved??{id:`local-${Date.now()}`,name,description});
    renderCategoryTabs();populateTypeSelect();populateFilterType();renderQuickStats();renderExpenseChart();closeCategoryModal();
  });
  document.addEventListener('keydown', e => { if(e.key==='Escape'){closeModal();closeDetailModal();closeCategoryModal();} });
}

document.addEventListener('adminReady', initTreasury);