// ============================================
// MEMBERS PAGE JAVASCRIPT - SDA Embakasi Central
// Ambassadors Club Website
// ============================================

// ---- DEMO MEMBERS DATA ----
// Replace this with your actual Ambassadors Club member data
const membersData = [
  {
    id: 1,
    firstName: "John",
    lastName: "Kamau",
    role: "Youth Leader",
    departments: ["choir", "treasury"],
    joined: "2022",
    gift: "Leadership",
    phone: "+254 712 345 678",
    email: "john.kamau@email.com",
    bio: "Passionate about youth ministry and financial stewardship. Leads the Ambassadors Club with vision and dedication."
  },
  {
    id: 2,
    firstName: "Sarah",
    lastName: "Wanjiku",
    role: "Choir Director",
    departments: ["choir", "media"],
    joined: "2021",
    gift: "Music",
    phone: "+254 723 456 789",
    email: "sarah.w@email.com",
    bio: "Gifted vocalist and choir leader. Organizes rehearsals and special music programs for divine services."
  },
  {
    id: 3,
    firstName: "Peter",
    lastName: "Ochieng",
    role: "Treasurer",
    departments: ["treasury", "welfare"],
    joined: "2023",
    gift: "Administration",
    phone: "+254 734 567 890",
    email: "peter.o@email.com",
    bio: "Detail-oriented and trustworthy. Manages club finances and welfare contributions with integrity."
  },
  {
    id: 4,
    firstName: "Grace",
    lastName: "Muthoni",
    role: "Welfare Coordinator",
    departments: ["welfare", "ushering"],
    joined: "2022",
    gift: "Hospitality",
    phone: "+254 745 678 901",
    email: "grace.m@email.com",
    bio: "Heart for service and community care. Coordinates outreach programs and member support initiatives."
  },
  {
    id: 5,
    firstName: "David",
    lastName: "Mutua",
    role: "Media Lead",
    departments: ["media", "choir"],
    joined: "2023",
    gift: "Creativity",
    phone: "+254 756 789 012",
    email: "david.m@email.com",
    bio: "Tech-savvy creative handling sound, visuals, and social media for the club and church programs."
  },
  {
    id: 6,
    firstName: "Esther",
    lastName: "Achieng",
    role: "Ushering Lead",
    departments: ["ushering", "welfare"],
    joined: "2021",
    gift: "Service",
    phone: "+254 767 890 123",
    email: "esther.a@email.com",
    bio: "Welcoming and organized. Ensures smooth flow during services and special church events."
  },
  {
    id: 7,
    firstName: "Michael",
    lastName: "Kipchirchir",
    role: "Sabbath School Teacher",
    departments: ["choir"],
    joined: "2024",
    gift: "Teaching",
    phone: "+254 778 901 234",
    email: "michael.k@email.com",
    bio: "Youth Sabbath School teacher with a passion for Bible study and discipleship."
  },
  {
    id: 8,
    firstName: "Faith",
    lastName: "Njeri",
    role: "Events Coordinator",
    departments: ["media", "ushering"],
    joined: "2023",
    gift: "Organization",
    phone: "+254 789 012 345",
    email: "faith.n@email.com",
    bio: "Plans and coordinates club events, camps, and fellowship activities throughout the year."
  }
];

// ---- DEPARTMENT LABELS ----
const deptLabels = {
  choir: "Choir",
  ushering: "Ushering",
  treasury: "Treasury",
  welfare: "Welfare",
  media: "Media"
};

// ---- RENDER MEMBERS ----
function renderMembers(filter = 'all', search = '') {
  const grid = document.getElementById('membersGrid');
  const noResults = document.getElementById('noResults');

  if (!grid) return;

  let filtered = membersData;

  // Apply department filter
  if (filter !== 'all') {
    filtered = filtered.filter(m => m.departments.includes(filter));
  }

  // Apply search filter
  if (search.trim()) {
    const s = search.toLowerCase().trim();
    filtered = filtered.filter(m => 
      m.firstName.toLowerCase().includes(s) ||
      m.lastName.toLowerCase().includes(s) ||
      m.gift.toLowerCase().includes(s) ||
      m.role.toLowerCase().includes(s) ||
      m.departments.some(d => d.toLowerCase().includes(s))
    );
  }

  // Show/hide no results message
  if (filtered.length === 0) {
    grid.style.display = 'none';
    noResults.style.display = 'block';
    return;
  } else {
    grid.style.display = 'grid';
    noResults.style.display = 'none';
  }

  // Render cards
  grid.innerHTML = filtered.map(m => `
    <div class="member-card" data-id="${m.id}" onclick="openMemberModal(${m.id})">
      <div class="card-banner">
        <div class="card-avatar">${getInitials(m.firstName, m.lastName)}</div>
      </div>
      <div class="card-body">
        <h3>${m.firstName} ${m.lastName}</h3>
        <span class="card-role">${m.role}</span>
        <p class="card-gift">Gift: ${m.gift}</p>
        <div class="dept-tags">
          ${m.departments.map(d => `<span class="dept-tag">${deptLabels[d] || d}</span>`).join('')}
        </div>
      </div>
    </div>
  `).join('');
}

// ---- GET INITIALS ----
function getInitials(first, last) {
  return (first[0] + last[0]).toUpperCase();
}

// ---- OPEN MEMBER MODAL ----
function openMemberModal(id) {
  const m = membersData.find(x => x.id === id);
  if (!m) return;

  const modal = document.getElementById('memberModal');
  const modalBody = document.getElementById('modalBody');

  modalBody.innerHTML = `
    <div class="modal-banner">
      <div class="modal-avatar">${getInitials(m.firstName, m.lastName)}</div>
    </div>
    <div class="modal-info">
      <h2>${m.firstName} ${m.lastName}</h2>
      <p class="modal-role">${m.role}</p>
      <p class="modal-bio">${m.bio}</p>
      <div class="modal-details">
        <div class="detail-row">
          <span class="detail-label">Departments</span>
          <span class="detail-value dept-list">
            ${m.departments.map(d => `<span class="dept-tag">${deptLabels[d] || d}</span>`).join('')}
          </span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Spiritual Gift</span>
          <span class="detail-value">${m.gift}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Member Since</span>
          <span class="detail-value">${m.joined}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Phone</span>
          <span class="detail-value">${m.phone}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Email</span>
          <span class="detail-value">${m.email}</span>
        </div>
      </div>
    </div>
  `;

  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

// ---- CLOSE MODAL ----
function closeMemberModal() {
  const modal = document.getElementById('memberModal');
  modal.classList.remove('active');
  document.body.style.overflow = '';
}

// ---- EVENT LISTENERS ----
document.addEventListener('DOMContentLoaded', () => {
  // Initial render
  renderMembers();

  // Filter buttons
  const filterButtons = document.querySelectorAll('.filter-btn');
  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      // Update active state
      filterButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Render with filter
      const filter = btn.dataset.filter;
      const search = document.getElementById('memberSearch')?.value || '';
      renderMembers(filter, search);
    });
  });

  // Search input
  const searchInput = document.getElementById('memberSearch');
  if (searchInput) {
    searchInput.addEventListener('input', debounce((e) => {
      const filter = document.querySelector('.filter-btn.active')?.dataset.filter || 'all';
      renderMembers(filter, e.target.value);
    }, 300));
  }

  // Modal close button
  const modalClose = document.getElementById('modalClose');
  if (modalClose) {
    modalClose.addEventListener('click', closeMemberModal);
  }

  // Close modal on overlay click
  const modal = document.getElementById('memberModal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal || e.target.classList.contains('modal-overlay')) {
        closeMemberModal();
      }
    });
  }

  // Close modal on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeMemberModal();
    }
  });
});

// ---- DEBOUNCE UTILITY ----
function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}