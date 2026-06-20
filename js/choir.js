// ============================================
// CHOIR PAGE JAVASCRIPT - SDA Embakasi Central
// Ambassadors Club Website
// ============================================

// ---- CHOIR ROSTER DATA ----
const choirRoster = {
  soprano: [
    { firstName: "Sarah", lastName: "Wanjiku", role: "Section Leader" },
    { firstName: "Grace", lastName: "Muthoni", role: "Member" },
    { firstName: "Faith", lastName: "Njeri", role: "Member" },
    { firstName: "Mary", lastName: "Atieno", role: "Member" },
    { firstName: "Joyce", lastName: "Wambui", role: "Member" },
    { firstName: "Linda", lastName: "Akinyi", role: "Member" }
  ],
  alto: [
    { firstName: "Esther", lastName: "Achieng", role: "Section Leader" },
    { firstName: "Ruth", lastName: "Mwangi", role: "Member" },
    { firstName: "Diana", lastName: "Kemunto", role: "Member" },
    { firstName: "Cynthia", lastName: "Omondi", role: "Member" },
    { firstName: "Ann", lastName: "Wairimu", role: "Member" },
    { firstName: "Beatrice", lastName: "Nduku", role: "Member" }
  ],
  tenor: [
    { firstName: "Michael", lastName: "Kipchirchir", role: "Section Leader" },
    { firstName: "David", lastName: "Mutua", role: "Member" },
    { firstName: "James", lastName: "Otieno", role: "Member" },
    { firstName: "Paul", lastName: "Karanja", role: "Member" },
    { firstName: "Peter", lastName: "Ochieng", role: "Member" },
    { firstName: "John", lastName: "Kamau", role: "Member" }
  ],
  bass: [
    { firstName: "Daniel", lastName: "Mwangi", role: "Section Leader" },
    { firstName: "Joseph", lastName: "Kibet", role: "Member" },
    { firstName: "Samuel", lastName: "Ndungu", role: "Member" },
    { firstName: "Stephen", lastName: "Oduor", role: "Member" },
    { firstName: "Mark", lastName: "Wekesa", role: "Member" },
    { firstName: "Simon", lastName: "Kiprono", role: "Member" }
  ]
};

const voicePartLabels = {
  soprano: "Soprano",
  alto: "Alto",
  tenor: "Tenor",
  bass: "Bass"
};

// ---- REPERTOIRE DATA ----
const repertoireData = [
  { title: "Tukutendereza", type: "hymn", typeLabel: "Hymn", description: "Traditional Swahili worship song" },
  { title: "Amazing Grace", type: "hymn", typeLabel: "Hymn", description: "Classic gospel hymn arrangement" },
  { title: "Hakuna Mungu Kama Wewe", type: "praise", typeLabel: "Praise", description: "Contemporary Swahili praise" },
  { title: "How Great Thou Art", type: "hymn", typeLabel: "Hymn", description: "Grand worship anthem" },
  { title: "Kuna Siku", type: "special", typeLabel: "Special", description: "Special music for divine service" },
  { title: "It Is Well", type: "hymn", typeLabel: "Hymn", description: "Peaceful hymn arrangement" },
  { title: "Mungu Yu Mwema", type: "praise", typeLabel: "Praise", description: "Upbeat praise and worship" },
  { title: "Great Is Thy Faithfulness", type: "hymn", typeLabel: "Hymn", description: "Thanksgiving hymn" }
];

// ---- RENDER VOICE ROSTER ----
function renderVoiceRoster(voice) {
  const container = document.getElementById('voiceRoster');
  if (!container) return;

  const members = choirRoster[voice] || [];
  const partLabel = voicePartLabels[voice] || voice;

  container.innerHTML = members.map(m => `
    <div class="choir-member-card">
      <div class="cm-avatar">${getInitials(m.firstName, m.lastName)}</div>
      <h4>${m.firstName} ${m.lastName}</h4>
      <span class="cm-part">${partLabel} &middot; ${m.role}</span>
    </div>
  `).join('');
}

function getInitials(first, last) {
  return (first[0] + last[0]).toUpperCase();
}

// ---- RENDER REPERTOIRE ----
function renderRepertoire() {
  const container = document.getElementById('repertoireList');
  if (!container) return;

  container.innerHTML = repertoireData.map((song, index) => `
    <div class="rep-item">
      <span class="rep-number">${index + 1}</span>
      <div class="rep-info">
        <h4>${song.title}</h4>
        <p>${song.description}</p>
      </div>
      <span class="rep-tag ${song.type}">${song.typeLabel}</span>
    </div>
  `).join('');
}

// ---- ANIMATE COUNTERS ----
function animateCounters() {
  const counters = document.querySelectorAll('.c-number[data-count]');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const target = entry.target;
        const countTo = parseInt(target.dataset.count);
        animateCount(target, countTo);
        observer.unobserve(target);
      }
    });
  }, { threshold: 0.5 });

  counters.forEach(counter => observer.observe(counter));
}

function animateCount(element, target) {
  let current = 0;
  const increment = target / 40;
  const duration = 1200;
  const stepTime = duration / 40;

  const timer = setInterval(() => {
    current += increment;
    if (current >= target) {
      element.textContent = target;
      clearInterval(timer);
    } else {
      element.textContent = Math.floor(current);
    }
  }, stepTime);
}

// ---- EVENT LISTENERS ----
document.addEventListener('DOMContentLoaded', () => {
  // Render initial roster (soprano)
  renderVoiceRoster('soprano');

  // Render repertoire
  renderRepertoire();

  // Animate counters
  animateCounters();

  // Voice tab switching
  const voiceTabs = document.querySelectorAll('.voice-tab');
  voiceTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      voiceTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderVoiceRoster(tab.dataset.voice);
    });
  });
});