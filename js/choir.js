// ============================================================
//  CHOIR PAGE — choir.js
//  Read-only display. Loads from Supabase → localStorage cache.
//  Management is done via the Members page only.
// ============================================================

const CHOIR_STORAGE_KEY = 'sda_choir_data';

const voicePartLabels = {
  soprano: 'Soprano',
  alto:    'Alto',
  tenor:   'Tenor',
  bass:    'Bass'
};
const VOICE_PARTS = ['soprano', 'alto', 'tenor', 'bass'];

let choirRoster = { soprano: [], alto: [], tenor: [], bass: [] };
let activeVoice = 'soprano';

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
    voicePart: VOICE_PARTS.includes(part) ? part : null,
    role:      m.role || 'Member'
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
      localStorage.setItem(CHOIR_STORAGE_KEY, JSON.stringify(
        VOICE_PARTS.flatMap(p => choirRoster[p])
      ));
      console.log(`✅ Loaded ${(data || []).length} choir members`);
      return;

    } catch (err) {
      console.warn('Supabase choir load failed:', err.message);
    }
  }

  // localStorage fallback
  try {
    const stored = localStorage.getItem(CHOIR_STORAGE_KEY);
    if (stored) { buildRosterFromArray(JSON.parse(stored)); return; }
  } catch { /* ignore */ }

  buildRosterFromArray([]);
}

function buildRosterFromArray(members) {
  choirRoster = { soprano: [], alto: [], tenor: [], bass: [] };
  members.forEach(m => {
    const part = m.voicePart || (m.voice_part || '').toLowerCase();
    if (VOICE_PARTS.includes(part)) choirRoster[part].push(m);
  });
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

  // Update tab counts
  VOICE_PARTS.forEach(p => {
    const el = document.querySelector(`.voice-tab[data-voice="${p}"] .tab-count`);
    if (el) {
      const n = choirRoster[p].length;
      el.textContent = `${n} member${n !== 1 ? 's' : ''}`;
    }
  });

  // Update hero member count
  const heroCount = document.querySelector('.c-number[data-count]');
  if (heroCount) heroCount.textContent = VOICE_PARTS.flatMap(p => choirRoster[p]).length;

  if (members.length === 0) {
    container.innerHTML = `
      <div class="choir-empty">
        <p>No ${partLabel} members listed yet.</p>
      </div>`;
    return;
  }

  container.innerHTML = members.map(m => `
    <div class="choir-member-card">
      <div class="cm-avatar">${getInitials(m.firstName, m.lastName)}</div>
      <h4>${escHtml(m.firstName)} ${escHtml(m.lastName)}</h4>
      <span class="cm-part">${partLabel} &middot; ${escHtml(m.role)}</span>
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

// ============================================================
//  REPERTOIRE DATA
// ============================================================
const repertoireData = [
  { title: "Nikikumbuka",             type: "hymn",    typeLabel: "Album-1",    description: "He died for our sins" },
  { title: "Waseparo",             type: "hymn",    typeLabel: "Album-1",    description: "Tired of the sinful life" },
  { title: "Mungu ni wa namna gani",    type: "praise",  typeLabel: "Album-1",  description: "God of Abraham, Isaac and Jacob" },
  { title: "Bwana Mungu",        type: "hymn",    typeLabel: "Album-1",    description: "Always remember 'I Am'" },
  { title: "Katika Pande Zote",                 type: "special", typeLabel: "Album-1", description: "Preach the Gospel all over the World" },
  { title: "Jitu Kubwa",                type: "hymn",    typeLabel: "Album-1",    description: "Goliath's Defeat" },
  { title: "Toiroka",            type: "praise",  typeLabel: "Album-1",  description: "We pray to you Lord" },
  { title: "Kati ya Wenye Dhambi", type: "hymn",    typeLabel: "Album-1",    description: "Forgive our sins Father" }
];

// ============================================================
//  INIT
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
  await loadChoir();
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
});