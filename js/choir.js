// ============================================================
//  CHOIR PAGE — choir.js
//  Visitors: read-only display.
//  Admin: click any member card to edit their voice part.
// ============================================================

const CHOIR_STORAGE_KEY    = 'sda_choir_data';
const CHOIR_ADMIN_PASSWORD = 'ambassadors2026';

const voicePartLabels = {
  soprano: 'Soprano',
  alto:    'Alto',
  tenor:   'Tenor',
  bass:    'Bass'
};
const VOICE_PARTS = ['soprano', 'alto', 'tenor', 'bass'];

let choirRoster = { soprano: [], alto: [], tenor: [], bass: [] };
let activeVoice = 'soprano';
let isAdmin     = false;

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

function flatRoster() {
  return VOICE_PARTS.flatMap(p => choirRoster[p]);
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
  if (heroCount) heroCount.textContent = flatRoster().length;

  if (members.length === 0) {
    container.innerHTML = `
      <div class="choir-empty">
        <p>No ${partLabel} members listed yet.</p>
      </div>`;
    return;
  }

  container.innerHTML = members.map(m => `
    <div class="choir-member-card ${isAdmin ? 'admin-editable' : ''}"
         data-id="${m.id}"
         ${isAdmin ? `onclick="openVoicePopover(event, ${m.id})"` : ''}>
      ${isAdmin ? `<div class="edit-hint">✏️ click to edit</div>` : ''}
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
//  ADMIN — LOGIN
// ============================================================

function promptAdminLogin() {
  const pwd = prompt('Enter admin password:');
  if (pwd === null) return;
  if (pwd === CHOIR_ADMIN_PASSWORD) {
    isAdmin = true;
    sessionStorage.setItem('sda_admin', '1');
    document.getElementById('adminLoginBtn').style.display  = 'none';
    document.getElementById('adminStatus').style.display    = 'inline-flex';
    requestAnimationFrame(() => renderVoiceRoster(activeVoice));
    showToast('Admin mode enabled ✓', 'success');
  } else {
    showToast('Incorrect password', 'error');
  }
}

function adminLogout() {
  isAdmin = false;
  sessionStorage.removeItem('sda_admin');
  closePopover();
  closeVoiceAssignForm();
  document.getElementById('adminLoginBtn').style.display  = 'inline';
  document.getElementById('adminStatus').style.display    = 'none';
  requestAnimationFrame(() => renderVoiceRoster(activeVoice));
  showToast('Logged out');
}

// ============================================================
//  VOICE EDIT POPOVER
// ============================================================

function openVoicePopover(event, memberId) {
  event.stopPropagation();
  closePopover(); // close any existing one

  const m = flatRoster().find(x => x.id === memberId);
  if (!m) return;

  const card    = event.currentTarget;
  const popover = document.getElementById('voicePopover');

  // Populate
  document.getElementById('popoverName').textContent    = `${m.firstName} ${m.lastName}`;
  document.getElementById('popoverVoice').value         = m.voicePart || '';
  document.getElementById('popoverRole').value          = m.role || 'Member';
  document.getElementById('popoverError').textContent   = '';
  document.getElementById('popoverSave').disabled       = false;
  document.getElementById('popoverSave').textContent    = 'Save';
  popover.dataset.memberId = memberId;

  // Position near the card
  const rect = card.getBoundingClientRect();
  popover.style.top  = `${rect.bottom + window.scrollY + 8}px`;
  popover.style.left = `${Math.min(rect.left + window.scrollX, window.innerWidth - 240)}px`;
  popover.style.display = 'block';

  // Animate in
  requestAnimationFrame(() => popover.classList.add('popover-visible'));
}

function closePopover() {
  const popover = document.getElementById('voicePopover');
  if (popover) {
    popover.classList.remove('popover-visible');
    popover.style.display = 'none';
  }
}

async function saveVoiceEdit() {
  const popover  = document.getElementById('voicePopover');
  const memberId = parseInt(popover.dataset.memberId);
  const voice    = document.getElementById('popoverVoice').value;
  const role     = document.getElementById('popoverRole').value || 'Member';
  const errEl    = document.getElementById('popoverError');
  const saveBtn  = document.getElementById('popoverSave');

  if (!voice) { errEl.textContent = 'Please select a voice part.'; return; }
  errEl.textContent  = '';
  saveBtn.disabled   = true;
  saveBtn.textContent = 'Saving…';

  try {
    if (hasSupabase()) {
      const { error } = await supabaseClient
        .from('choir_members')
        .update({ voice_part: voice, role })
        .eq('id', memberId);
      if (error) throw error;
    }

    // Update local roster — move member to new part
    let member = null;
    VOICE_PARTS.forEach(p => {
      const idx = choirRoster[p].findIndex(x => x.id === memberId);
      if (idx !== -1) {
        member = { ...choirRoster[p][idx], voicePart: voice, role };
        choirRoster[p].splice(idx, 1);
      }
    });
    if (member) {
      if (!choirRoster[voice]) choirRoster[voice] = [];
      choirRoster[voice].push(member);
    }

    // Update localStorage cache
    localStorage.setItem(CHOIR_STORAGE_KEY, JSON.stringify(flatRoster()));

    closePopover();

    // Switch to the updated member's tab
    document.querySelectorAll('.voice-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.voice-tab[data-voice="${voice}"]`)?.classList.add('active');
    renderVoiceRoster(voice);

    showToast(`${member?.firstName} moved to ${voicePartLabels[voice]} ✓`, 'success');

  } catch (err) {
    console.error('Voice update failed:', err);
    errEl.textContent   = `Failed: ${err.message}`;
    saveBtn.disabled    = false;
    saveBtn.textContent = 'Save';
  }
}

// ============================================================
//  COUNTER ANIMATION
// ============================================================

function animateCounters() {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el  = entry.target;
      const end = flatRoster().length || parseInt(el.dataset.count) || 0;
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
//  TOAST
// ============================================================

function showToast(msg, type = 'info') {
  const old = document.getElementById('sdaToast');
  if (old) old.remove();
  const t = document.createElement('div');
  t.id = 'sdaToast';
  t.className = `sda-toast sda-toast--${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('sda-toast--show'));
  setTimeout(() => { t.classList.remove('sda-toast--show'); setTimeout(() => t.remove(), 400); }, 3000);
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
  if (sessionStorage.getItem('sda_admin') === '1') {
    isAdmin = true;
    document.getElementById('adminLoginBtn').style.display = 'none';
    document.getElementById('adminStatus').style.display   = 'inline-flex';
  }

  await loadChoir();
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

  // Admin login / logout
  document.getElementById('adminLoginBtn')?.addEventListener('click', promptAdminLogin);
  document.getElementById('adminLogoutBtn')?.addEventListener('click', adminLogout);

  // ✏️ Assign Voice button → open form
  document.getElementById('assignVoiceBtn')?.addEventListener('click', () => openVoiceAssignForm());

  // Popover save (card-click popover)
  document.getElementById('popoverSave')?.addEventListener('click', saveVoiceEdit);

  // Close popover when clicking outside
  document.addEventListener('click', e => {
    const popover = document.getElementById('voicePopover');
    if (popover && !popover.contains(e.target) && !e.target.closest('.choir-member-card'))
      closePopover();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closePopover(); closeVoiceAssignForm(); }
  });
});

// ============================================================
//  VOICE ASSIGNMENT FORM (Admin)
//  Fetches names from the MEMBERS table (choir dept filter).
//  Never requires re-entering names already in Members page.
// ============================================================

async function openVoiceAssignForm() {
  const modal = document.getElementById('voiceAssignModal');
  if (!modal) return;

  // Open modal immediately
  document.getElementById('vaError').textContent  = '';
  document.getElementById('vaVoice').value        = '';
  document.getElementById('vaRole').value         = 'Member';
  const saveBtn = document.getElementById('vaSave');
  saveBtn.disabled    = false;
  saveBtn.textContent = 'Save';

  const memberSelect = document.getElementById('vaMember');
  memberSelect.innerHTML = '<option value="">— Loading… —</option>';
  memberSelect.disabled  = true;

  modal.classList.add('active');
  document.body.style.overflow = 'hidden';

  // Fetch choir-dept members from the MEMBERS table
  try {
    const { data, error } = await supabaseClient
      .from('members')
      .select('id, first_name, last_name')
      .order('last_name', { ascending: true });

    if (error) throw error;

    // Filter client-side — works regardless of how Supabase stores the array
    const choirMembers = (data || []).filter(m =>
      Array.isArray(m.departments) && m.departments.includes('choir')
    );

    // Build a lookup of who already has a voice assigned in choir_members
    const voiceLookup = {};
    VOICE_PARTS.forEach(p => {
      choirRoster[p].forEach(cm => {
        voiceLookup[`${cm.firstName}|${cm.lastName}`] = voicePartLabels[p];
      });
    });

    memberSelect.disabled = false;

    if (choirMembers.length === 0) {
      memberSelect.innerHTML = '<option value="">No choir members found in Members page</option>';
      return;
    }

    memberSelect.innerHTML = '<option value="">— Select member —</option>' +
      choirMembers.map(m => {
        const key          = `${m.first_name}|${m.last_name}`;
        const currentVoice = voiceLookup[key] || 'Not assigned';
        // Store first_name|last_name as value — used to match in choir_members
        return `<option value="${escHtml(m.first_name)}|${escHtml(m.last_name)}"
          data-current-voice="${voiceLookup[key] ? Object.keys(voicePartLabels).find(k => voicePartLabels[k] === voiceLookup[key]) : ''}">
          ${escHtml(m.first_name)} ${escHtml(m.last_name)} — ${currentVoice}
        </option>`;
      }).join('');

  } catch (err) {
    memberSelect.disabled = false;
    memberSelect.innerHTML = '<option value="">Failed to load members</option>';
    document.getElementById('vaError').textContent = `Could not load members: ${err.message}`;
  }
}

function closeVoiceAssignForm() {
  document.getElementById('voiceAssignModal')?.classList.remove('active');
  document.body.style.overflow = '';
}

// Pre-fill voice when a member is selected
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('vaMember')?.addEventListener('change', function () {
    const opt = this.options[this.selectedIndex];
    if (!opt.value) return;
    // Pre-fill their current voice part if already assigned
    document.getElementById('vaVoice').value = opt.dataset.currentVoice || '';
    document.getElementById('vaRole').value  = 'Member';
  });
});

async function saveVoiceAssign() {
  const memberSelect = document.getElementById('vaMember');
  const selectedVal  = memberSelect.value; // "FirstName|LastName"
  const voice        = document.getElementById('vaVoice').value;
  const role         = document.getElementById('vaRole').value || 'Member';
  const errEl        = document.getElementById('vaError');
  const saveBtn      = document.getElementById('vaSave');

  if (!selectedVal) { errEl.textContent = 'Please select a member.'; return; }
  if (!voice)       { errEl.textContent = 'Please select a voice part.'; return; }

  const [firstName, lastName] = selectedVal.split('|');
  errEl.textContent   = '';
  saveBtn.disabled    = true;
  saveBtn.textContent = 'Saving…';

  try {
    if (hasSupabase()) {
      // Check if this person already exists in choir_members
      const { data: existing } = await supabaseClient
        .from('choir_members')
        .select('id')
        .eq('first_name', firstName)
        .eq('last_name',  lastName)
        .maybeSingle();

      if (existing) {
        // Update existing record
        const { error } = await supabaseClient
          .from('choir_members')
          .update({ voice_part: voice, role })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        // Insert new record (member was in choir dept but not yet in choir_members)
        const { error } = await supabaseClient
          .from('choir_members')
          .insert([{ first_name: firstName, last_name: lastName, voice_part: voice, role }]);
        if (error) throw error;
      }
    }

    // Update local choirRoster — remove from any current part, add to new part
    VOICE_PARTS.forEach(p => {
      choirRoster[p] = choirRoster[p].filter(
        x => !(x.firstName === firstName && x.lastName === lastName)
      );
    });
    if (!choirRoster[voice]) choirRoster[voice] = [];
    choirRoster[voice].push({ id: Date.now(), firstName, lastName, voicePart: voice, role });

    // Update localStorage cache
    localStorage.setItem(CHOIR_STORAGE_KEY, JSON.stringify(
      VOICE_PARTS.flatMap(p => choirRoster[p])
    ));

    saveBtn.disabled    = false;
    saveBtn.textContent = 'Save';
    closeVoiceAssignForm();

    // Switch to updated tab
    document.querySelectorAll('.voice-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.voice-tab[data-voice="${voice}"]`)?.classList.add('active');
    renderVoiceRoster(voice);

    showToast(`${firstName} ${lastName} → ${voicePartLabels[voice]} ✓`, 'success');

  } catch (err) {
    console.error('Voice assign failed:', err);
    errEl.textContent   = `Failed: ${err.message}`;
    saveBtn.disabled    = false;
    saveBtn.textContent = 'Save';
  }
}