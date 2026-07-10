// ============================================================
//  CHOIR.JS — SDA Ambassadors Club
//  - All 4 voice panels always visible
//  - Admin: PIN-protected assign form pulling from members table
//  - Shows member photos if available (avatar_url column)
// ============================================================

const CHOIR_STORAGE_KEY    = 'sda_choir_data';
const CHOIR_ADMIN_PIN      = '0000'; // change this to your real PIN

const VOICE_PARTS = ['soprano', 'alto', 'tenor', 'bass'];
const voicePartLabels = { soprano: 'Soprano', alto: 'Alto', tenor: 'Tenor', bass: 'Bass' };

let choirRoster = { soprano: [], alto: [], tenor: [], bass: [] };
let isAdmin     = false;

// ============================================================
//  HELPERS
// ============================================================

function hasSupabase() {
  return typeof supabaseClient !== 'undefined';
}

function getInitials(first, last) {
  return ((first || '')[0] || '') + ((last || '')[0] || '');
}

function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function showToast(msg, type = 'info') {
  const t = document.createElement('div');
  t.textContent = msg;
  Object.assign(t.style, {
    position:'fixed', bottom:'1.5rem', right:'1.5rem', zIndex:'9999',
    background: type === 'success' ? '#166534' : type === 'error' ? '#991b1b' : '#1e293b',
    color:'white', padding:'0.75rem 1.25rem', borderRadius:'10px',
    fontSize:'0.88rem', boxShadow:'0 8px 24px rgba(0,0,0,0.25)', fontFamily:'sans-serif'
  });
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

// ============================================================
//  DATA — LOAD FROM SUPABASE
// ============================================================

async function loadChoir() {
  if (hasSupabase()) {
    try {
      const { data, error } = await supabaseClient
        .from('choir_members')
        .select('*')
        .order('last_name', { ascending: true });

      if (error) throw error;

      buildRosterFromArray((data || []).map(row => ({
        id:         row.id,
        firstName:  row.first_name || '',
        lastName:   row.last_name  || '',
        voicePart:  (row.voice_part || '').toLowerCase(),
        role:       row.role || 'Member',
        avatarUrl:  row.avatar_url || null,    // optional photo column
        memberId:   row.member_id  || null,    // FK to members table (optional)
      })));

      localStorage.setItem(CHOIR_STORAGE_KEY,
        JSON.stringify(VOICE_PARTS.flatMap(p => choirRoster[p])));
      return;

    } catch (err) {
      console.warn('Supabase choir load failed:', err.message);
    }
  }

  // Fallback: localStorage cache
  try {
    const stored = localStorage.getItem(CHOIR_STORAGE_KEY);
    if (stored) { buildRosterFromArray(JSON.parse(stored)); return; }
  } catch { /* ignore */ }

  buildRosterFromArray([]);
}

function buildRosterFromArray(members) {
  choirRoster = { soprano: [], alto: [], tenor: [], bass: [] };
  members.forEach(m => {
    const part = (m.voicePart || m.voice_part || '').toLowerCase();
    if (VOICE_PARTS.includes(part)) choirRoster[part].push(m);
  });
}

function flatRoster() {
  return VOICE_PARTS.flatMap(p => choirRoster[p]);
}

// ============================================================
//  RENDER — ALL 4 PANELS AT ONCE
// ============================================================

function renderAllPanels() {
  VOICE_PARTS.forEach(part => renderPanel(part));

  // Update hero count
  const total = flatRoster().length;
  const heroEl = document.getElementById('heroTotalCount');
  if (heroEl) heroEl.textContent = total;

  // Toggle admin-mode class on grid for CSS hooks
  const grid = document.getElementById('voicePanelsGrid');
  if (grid) grid.classList.toggle('is-admin', isAdmin);
}

function renderPanel(voice) {
  const body     = document.getElementById(`panel${voice.charAt(0).toUpperCase() + voice.slice(1)}`);
  const countEl  = document.getElementById(`count${voice.charAt(0).toUpperCase() + voice.slice(1)}`);
  if (!body) return;

  const members = choirRoster[voice] || [];
  if (countEl) countEl.textContent = members.length;

  if (members.length === 0) {
    body.innerHTML = `
      <div class="vp-empty">
        <div class="vp-empty-icon">🎙️</div>
        <span>No ${voicePartLabels[voice]} members yet</span>
      </div>`;
    return;
  }

  body.innerHTML = members.map(m => {
    const initials  = getInitials(m.firstName, m.lastName).toUpperCase() || '?';
    const isLeader  = (m.role && m.role.toLowerCase().includes('leader')) || m.role === 'Choir Director';
    const avatarHtml = m.avatarUrl
      ? `<div class="vp-avatar"><img src="${escHtml(m.avatarUrl)}" alt="${escHtml(m.firstName)}" loading="lazy" onerror="this.parentElement.innerHTML='${escHtml(initials)}'"></div>`
      : `<div class="vp-avatar">${escHtml(initials)}</div>`;

    return `
      <div class="vp-member-row" data-id="${escHtml(m.id)}">
        ${avatarHtml}
        <div style="flex:1;min-width:0;">
          <div class="vp-name">${escHtml(m.firstName)} ${escHtml(m.lastName)}</div>
          <div class="vp-role">${escHtml(m.role || 'Member')}</div>
        </div>
        ${isLeader ? '<div class="section-leader-dot" title="Section Leader"></div>' : ''}
        ${isAdmin ? `
          <button class="vp-edit-btn" onclick="openEditFromRow(event,'${escHtml(m.id)}')" title="Edit voice / role">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>` : ''}
      </div>`;
  }).join('');
}

// ============================================================
//  ADMIN — PIN LOGIN (reuses pinModal from HTML)
// ============================================================

function promptAdminLogin() {
  const pinModal = document.getElementById('pinModal');
  if (!pinModal) return;
  document.getElementById('adminPinInput').value = '';
  document.getElementById('pinError').textContent = '';
  pinModal.classList.add('active');
  document.body.style.overflow = 'hidden';
  setTimeout(() => document.getElementById('adminPinInput')?.focus(), 50);
}

function closePinModal() {
  document.getElementById('pinModal')?.classList.remove('active');
  document.body.style.overflow = '';
}

function attemptPinLogin() {
  const entered = (document.getElementById('adminPinInput')?.value || '').trim();
  if (entered === CHOIR_ADMIN_PIN) {
    isAdmin = true;
    sessionStorage.setItem('sda_choir_admin', '1');
    closePinModal();
    document.getElementById('adminLoginBtn').style.display = 'none';
    document.getElementById('adminStatus').style.display   = 'flex';
    renderAllPanels();
    showToast('Admin mode enabled ✓', 'success');
  } else {
    document.getElementById('pinError').textContent = 'Incorrect PIN. Try again.';
    document.getElementById('adminPinInput').value  = '';
    document.getElementById('adminPinInput').focus();
  }
}

function adminLogout() {
  isAdmin = false;
  sessionStorage.removeItem('sda_choir_admin');
  document.getElementById('adminLoginBtn').style.display = 'inline';
  document.getElementById('adminStatus').style.display   = 'none';
  renderAllPanels();
  showToast('Logged out');
}

// ============================================================
//  VOICE ASSIGN FORM — pulls from members table
// ============================================================

async function openVoiceAssignForm(prefillMemberId) {
  const modal = document.getElementById('voiceAssignModal');
  if (!modal) return;

  document.getElementById('vaError').textContent  = '';
  document.getElementById('vaVoice').value        = '';
  document.getElementById('vaRole').value         = 'Member';

  const saveBtn = document.getElementById('vaSave');
  saveBtn.disabled    = false;
  saveBtn.textContent = 'Save';

  const memberSelect = document.getElementById('vaMember');
  memberSelect.innerHTML = '<option value="">— Loading members… —</option>';
  memberSelect.disabled  = true;

  modal.classList.add('active');
  document.body.style.overflow = 'hidden';

  // Pull ALL members from the members table (not just choir dept)
  // so you can assign any member a voice part
  try {
    const { data, error } = await supabaseClient
      .from('members')
      .select('id, first_name, last_name, departments, avatar_url')
      .order('last_name', { ascending: true });

    if (error) throw error;

    // Build current-voice lookup by name
    const voiceLookupByName = {};
    const voiceLookupById   = {};
    VOICE_PARTS.forEach(p => {
      choirRoster[p].forEach(cm => {
        voiceLookupByName[`${cm.firstName}|${cm.lastName}`] = p;
        if (cm.memberId) voiceLookupById[cm.memberId] = p;
      });
    });

    memberSelect.disabled = false;
    const members = data || [];

    if (members.length === 0) {
      memberSelect.innerHTML = '<option value="">No members found — add members first</option>';
      return;
    }

    memberSelect.innerHTML = '<option value="">— Select member —</option>' +
      members.map(m => {
        const key           = `${m.first_name}|${m.last_name}`;
        const currentVoice  = voiceLookupById[m.id] || voiceLookupByName[key] || '';
        const voiceLabel    = currentVoice ? ` (${voicePartLabels[currentVoice]})` : '';
        return `<option
          value="${m.id}"
          data-first="${escHtml(m.first_name)}"
          data-last="${escHtml(m.last_name)}"
          data-avatar="${escHtml(m.avatar_url || '')}"
          data-current-voice="${escHtml(currentVoice)}">
          ${escHtml(m.first_name)} ${escHtml(m.last_name)}${voiceLabel}
        </option>`;
      }).join('');

    // Pre-select if called from a row edit
    if (prefillMemberId) {
      memberSelect.value = prefillMemberId;
      memberSelect.dispatchEvent(new Event('change'));
    }

  } catch (err) {
    memberSelect.disabled = false;
    memberSelect.innerHTML = '<option value="">Failed to load members</option>';
    document.getElementById('vaError').textContent = `Could not load: ${err.message}`;
  }
}

function closeVoiceAssignForm() {
  document.getElementById('voiceAssignModal')?.classList.remove('active');
  document.body.style.overflow = '';
}

// Open edit form pre-filled from a member row click
function openEditFromRow(event, choirMemberId) {
  event.stopPropagation();
  // find memberId from choirRoster
  const m = flatRoster().find(x => String(x.id) === String(choirMemberId));
  openVoiceAssignForm(m?.memberId || null);
}

async function saveVoiceAssign() {
  const memberSelect = document.getElementById('vaMember');
  const selectedOpt  = memberSelect.options[memberSelect.selectedIndex];
  const memberId     = memberSelect.value;
  const voice        = document.getElementById('vaVoice').value;
  const role         = document.getElementById('vaRole').value || 'Member';
  const errEl        = document.getElementById('vaError');
  const saveBtn      = document.getElementById('vaSave');

  if (!memberSelect.value) { errEl.textContent = 'Please select a member.'; return; }
  if (!voice)              { errEl.textContent = 'Please select a voice part.'; return; }

  const firstName  = selectedOpt.dataset.first  || '';
  const lastName   = selectedOpt.dataset.last   || '';
  const avatarUrl  = selectedOpt.dataset.avatar || null;

  errEl.textContent   = '';
  saveBtn.disabled    = true;
  saveBtn.textContent = 'Saving…';

  try {
    if (hasSupabase()) {
      // Check if this member already has a choir_members row (by member_id FK, else by name)
      let existing = null;
      if (memberId) {
        const { data } = await supabaseClient
          .from('choir_members')
          .select('id')
          .eq('member_id', memberId)
          .maybeSingle();
        existing = data;
      }
      if (!existing) {
        const { data } = await supabaseClient
          .from('choir_members')
          .select('id')
          .eq('first_name', firstName)
          .eq('last_name', lastName)
          .maybeSingle();
        existing = data;
      }

      if (existing) {
        const { error } = await supabaseClient
          .from('choir_members')
          .update({ voice_part: voice, role, member_id: memberId, avatar_url: avatarUrl })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabaseClient
          .from('choir_members')
          .insert([{ first_name: firstName, last_name: lastName,
                     voice_part: voice, role, member_id: memberId,
                     avatar_url: avatarUrl }]);
        if (error) throw error;
      }
    }

    // Reload roster from Supabase so IDs stay consistent with the server
    if (hasSupabase()) {
      await loadChoir();
    } else {
      VOICE_PARTS.forEach(p => {
        choirRoster[p] = choirRoster[p].filter(
          x => !(x.memberId === memberId || (x.firstName === firstName && x.lastName === lastName))
        );
      });
      if (!choirRoster[voice]) choirRoster[voice] = [];
      choirRoster[voice].push({
        id: Date.now(), firstName, lastName,
        voicePart: voice, role, avatarUrl, memberId
      });
      localStorage.setItem(CHOIR_STORAGE_KEY,
        JSON.stringify(VOICE_PARTS.flatMap(p => choirRoster[p])));
    }

    saveBtn.disabled    = false;
    saveBtn.textContent = 'Save';
    closeVoiceAssignForm();
    renderAllPanels();
    showToast(`${firstName} ${lastName} → ${voicePartLabels[voice]} ✓`, 'success');

  } catch (err) {
    console.error('Voice assign failed:', err);
    errEl.textContent   = `Failed: ${err.message}`;
    saveBtn.disabled    = false;
    saveBtn.textContent = 'Save';
  }
}

// ============================================================
//  REPERTOIRE
// ============================================================

const repertoireData = [
  { title: "Nikikumbuka",                   type: "hymn",    typeLabel: "Album-1",    description: "He died for our sins" },
  { title: "Mungu ni wa namna gani",        type: "hymn",    typeLabel: "Album-1",    description: "How Great Thou Art" },
  { title: "Katika Pande Zote",             type: "hymn",    typeLabel: "Album-1",    description: "Preach the Gospel to all like he did" },
  { title: "Waseol",                        type: "praise",  typeLabel: "Album-1",    description: "We're tired of the sinful life" },
  { title: "Toiroka",                       type: "special", typeLabel: "Album-1",    description: "God is Great" },
  { title: "Kati ya wenye Dhambi",          type: "worship", typeLabel: "Album-1",    description: "Forgive us our sins" },
  { title: "Lakini Sasa",                   type: "hymn",    typeLabel: "Album-1",    description: "I will Protect You Always" },
];

function renderRepertoire() {
  const container = document.getElementById('repertoireList');
  if (!container) return;
  container.innerHTML = repertoireData.map((s, i) => `
    <div class="repertoire-item">
      <span class="rep-num">${String(i + 1).padStart(2, '0')}</span>
      <div class="rep-title">${escHtml(s.title)}</div>
      <span class="rep-type">${escHtml(s.typeLabel)}</span>
    </div>`).join('');
}

// ============================================================
//  COUNTER ANIMATION
// ============================================================

function animateCounter(el, target, duration = 1200) {
  const start = performance.now();
  const update = now => {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(eased * target);
    if (progress < 1) requestAnimationFrame(update);
  };
  requestAnimationFrame(update);
}

// ============================================================
//  INIT
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {

  // Restore admin session
  if (sessionStorage.getItem('sda_choir_admin') === '1') {
    isAdmin = true;
    document.getElementById('adminLoginBtn').style.display = 'none';
    document.getElementById('adminStatus').style.display   = 'flex';
  }

  await loadChoir();
  renderAllPanels();
  renderRepertoire();

  // Animate hero counter
  const heroEl = document.getElementById('heroTotalCount');
  if (heroEl) animateCounter(heroEl, flatRoster().length);

  // Admin login button → PIN modal
  document.getElementById('adminLoginBtn')?.addEventListener('click', promptAdminLogin);
  document.getElementById('adminLogoutBtn')?.addEventListener('click', adminLogout);

  // PIN modal
  document.getElementById('pinSubmitBtn')?.addEventListener('click', attemptPinLogin);
  document.getElementById('adminPinInput')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') attemptPinLogin();
  });
  document.getElementById('pinModalClose')?.addEventListener('click', closePinModal);
  document.getElementById('pinModalOverlay')?.addEventListener('click', closePinModal);

  // ✏ Assign Voice button
  document.getElementById('assignVoiceBtn')?.addEventListener('click', () => openVoiceAssignForm());

  // Voice assign modal events
  document.getElementById('vaSave')?.addEventListener('click', saveVoiceAssign);
  document.getElementById('vaCancel')?.addEventListener('click', closeVoiceAssignForm);
  document.getElementById('vaClose')?.addEventListener('click', closeVoiceAssignForm);
  document.getElementById('vaOverlay')?.addEventListener('click', closeVoiceAssignForm);

  // Pre-fill voice dropdown when member is selected
  document.getElementById('vaMember')?.addEventListener('change', function () {
    const opt = this.options[this.selectedIndex];
    if (!opt.value) return;
    const currentVoice = opt.dataset.currentVoice || '';
    document.getElementById('vaVoice').value = currentVoice;
  });

  // Keyboard close
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeVoiceAssignForm(); closePinModal(); }
  });
});