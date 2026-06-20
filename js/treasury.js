// ============================================
// TREASURY PAGE JAVASCRIPT - SDA Embakasi Central
// Ambassadors Club Website
// ============================================

// ---- CONTRIBUTIONS DATA ----
const contributionsData = [
  { id: 1, date: '2026-06-14', member: 'John Kamau', type: 'sabbath', amount: 500, method: 'mpesa', status: 'confirmed', ref: 'MPESA12345' },
  { id: 2, date: '2026-06-14', member: 'Sarah Wanjiku', type: 'tithe', amount: 2000, method: 'mpesa', status: 'confirmed', ref: 'MPESA12346' },
  { id: 3, date: '2026-06-07', member: 'Peter Ochieng', type: 'camp', amount: 1500, method: 'cash', status: 'confirmed', ref: 'CASH001' },
  { id: 4, date: '2026-06-07', member: 'Grace Muthoni', type: 'welfare', amount: 300, method: 'mpesa', status: 'confirmed', ref: 'MPESA12347' },
  { id: 5, date: '2026-05-31', member: 'David Mutua', type: 'sabbath', amount: 400, method: 'cash', status: 'confirmed', ref: 'CASH002' },
  { id: 6, date: '2026-05-31', member: 'Esther Achieng', type: 'tithe', amount: 1500, method: 'bank', status: 'pending', ref: 'BANK001' },
  { id: 7, date: '2026-05-24', member: 'Michael Kipchirchir', type: 'building', amount: 1000, method: 'mpesa', status: 'confirmed', ref: 'MPESA12348' },
  { id: 8, date: '2026-05-24', member: 'Faith Njeri', type: 'sabbath', amount: 600, method: 'mpesa', status: 'confirmed', ref: 'MPESA12349' },
  { id: 9, date: '2026-05-17', member: 'John Kamau', type: 'camp', amount: 2000, method: 'mpesa', status: 'confirmed', ref: 'MPESA12350' },
  { id: 10, date: '2026-05-17', member: 'Sarah Wanjiku', type: 'welfare', amount: 500, method: 'cash', status: 'confirmed', ref: 'CASH003' }
];

const typeLabels = {
  sabbath: 'Sabbath Offering',
  tithe: 'Tithe',
  camp: 'Camp Fund',
  building: 'Building Fund',
  welfare: 'Welfare',
  other: 'Other'
};

const methodLabels = {
  mpesa: 'M-Pesa',
  cash: 'Cash',
  bank: 'Bank Transfer'
};

const memberList = [
  'John Kamau', 'Sarah Wanjiku', 'Peter Ochieng', 'Grace Muthoni',
  'David Mutua', 'Esther Achieng', 'Michael Kipchirchir', 'Faith Njeri'
];

// ---- RENDER CONTRIBUTIONS TABLE ----
function renderContributions(filterType = 'all', filterMonth = 'all') {
  const tbody = document.getElementById('contributionsTableBody');
  if (!tbody) return;

  let filtered = [...contributionsData];

  // Apply type filter
  if (filterType !== 'all') {
    filtered = filtered.filter(c => c.type === filterType);
  }

  // Apply month filter
  if (filterMonth !== 'all') {
    filtered = filtered.filter(c => c.date.startsWith(filterMonth));
  }

  // Sort by date descending
  filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

  tbody.innerHTML = filtered.map(c => `
    <tr>
      <td>${formatDate(c.date)}</td>
      <td><strong>${c.member}</strong></td>
      <td>
        <span class="type-badge type-${c.type}">${typeLabels[c.type]}</span>
      </td>
      <td class="text-right">KES ${c.amount.toLocaleString()}</td>
      <td>${methodLabels[c.method]}</td>
      <td>
        <span class="status-badge status-${c.status}">${c.status}</span>
      </td>
      <td>
        <button class="action-btn" title="View Details" onclick="viewContribution(${c.id})">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
          </svg>
        </button>
      </td>
    </tr>
  `).join('');
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ---- VIEW CONTRIBUTION DETAIL ----
function viewContribution(id) {
  const c = contributionsData.find(x => x.id === id);
  if (!c) return;

  alert(`Contribution Details:

Member: ${c.member}
Date: ${formatDate(c.date)}
Type: ${typeLabels[c.type]}
Amount: KES ${c.amount.toLocaleString()}
Method: ${methodLabels[c.method]}
Reference: ${c.ref}
Status: ${c.status.toUpperCase()}`);
}

// ---- INITIALIZE CHARTS ----
function initCharts() {
  // Line chart - contributions trend
  const ctx1 = document.getElementById('contributionChart');
  if (ctx1) {
    new Chart(ctx1, {
      type: 'line',
      data: {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        datasets: [{
          label: 'Contributions (KES)',
          data: [32000, 28000, 35000, 31000, 42000, 38500],
          borderColor: '#1a365d',
          backgroundColor: 'rgba(26, 54, 93, 0.08)',
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
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(0,0,0,0.05)' },
            ticks: {
              callback: function(value) {
                return 'KES ' + (value / 1000) + 'K';
              }
            }
          },
          x: {
            grid: { display: false }
          }
        }
      }
    });
  }

  // Doughnut chart - expense breakdown
  const ctx2 = document.getElementById('expenseChart');
  if (ctx2) {
    const expenseData = {
      labels: ['Camp', 'Welfare', 'Events', 'Materials', 'Other'],
      datasets: [{
        data: [35, 20, 25, 12, 8],
        backgroundColor: ['#1a365d', '#c9a227', '#8b1538', '#6b8f71', '#94a3b8'],
        borderWidth: 0,
        hoverOffset: 8
      }]
    };

    new Chart(ctx2, {
      type: 'doughnut',
      data: expenseData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: { display: false }
        }
      }
    });

    // Custom legend
    const legendContainer = document.getElementById('expenseLegend');
    if (legendContainer) {
      const colors = ['#1a365d', '#c9a227', '#8b1538', '#6b8f71', '#94a3b8'];
      legendContainer.innerHTML = expenseData.labels.map((label, i) => `
        <div class="legend-item">
          <span class="legend-dot" style="background: ${colors[i]}"></span>
          <span>${label} (${expenseData.datasets[0].data[i]}%)</span>
        </div>
      `).join('');
    }
  }
}

// ---- POPULATE MEMBER SELECT ----
function populateMemberSelect() {
  const select = document.getElementById('contribMember');
  if (!select) return;

  memberList.forEach(member => {
    const option = document.createElement('option');
    option.value = member;
    option.textContent = member;
    select.appendChild(option);
  });
}

// ---- SET DEFAULT DATE ----
function setDefaultDate() {
  const dateInput = document.getElementById('contribDate');
  if (dateInput) {
    dateInput.valueAsDate = new Date();
  }
}

// ---- MODAL FUNCTIONS ----
function openModal() {
  const modal = document.getElementById('addContribModal');
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  const modal = document.getElementById('addContribModal');
  modal.classList.remove('active');
  document.body.style.overflow = '';
  document.getElementById('contribForm').reset();
  setDefaultDate();
}

// ---- EVENT LISTENERS ----
document.addEventListener('DOMContentLoaded', () => {
  // Render initial table
  renderContributions();

  // Initialize charts
  initCharts();

  // Populate member select
  populateMemberSelect();

  // Set default date
  setDefaultDate();

  // Filter type change
  const filterType = document.getElementById('filterType');
  if (filterType) {
    filterType.addEventListener('change', (e) => {
      const monthFilter = document.getElementById('filterMonth')?.value || 'all';
      renderContributions(e.target.value, monthFilter);
    });
  }

  // Filter month change
  const filterMonth = document.getElementById('filterMonth');
  if (filterMonth) {
    filterMonth.addEventListener('change', (e) => {
      const typeFilter = document.getElementById('filterType')?.value || 'all';
      renderContributions(typeFilter, e.target.value);
    });
  }

  // Add contribution button
  const addBtn = document.getElementById('addContributionBtn');
  if (addBtn) {
    addBtn.addEventListener('click', openModal);
  }

  // Modal close
  const modalClose = document.getElementById('modalClose');
  if (modalClose) {
    modalClose.addEventListener('click', closeModal);
  }

  // Cancel button
  const cancelBtn = document.getElementById('cancelContrib');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', closeModal);
  }

  // Close on overlay click
  const modal = document.getElementById('addContribModal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal || e.target.classList.contains('modal-overlay')) {
        closeModal();
      }
    });
  }

  // Form submit
  const form = document.getElementById('contribForm');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();

      const member = document.getElementById('contribMember').value;
      const date = document.getElementById('contribDate').value;
      const type = document.getElementById('contribType').value;
      const amount = parseInt(document.getElementById('contribAmount').value);
      const method = document.getElementById('contribMethod').value;
      const ref = document.getElementById('contribRef').value || 'N/A';

      if (!member || !date || !type || !amount) {
        alert('Please fill in all required fields.');
        return;
      }

      // Add new record
      const newRecord = {
        id: contributionsData.length + 1,
        date: date,
        member: member,
        type: type,
        amount: amount,
        method: method,
        status: 'confirmed',
        ref: ref
      };

      contributionsData.unshift(newRecord);

      // Re-render
      const typeFilter = document.getElementById('filterType')?.value || 'all';
      const monthFilter = document.getElementById('filterMonth')?.value || 'all';
      renderContributions(typeFilter, monthFilter);

      // Close modal
      closeModal();

      // Show success
      alert('Contribution recorded successfully!');
    });
  }

  // Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
    }
  });
});