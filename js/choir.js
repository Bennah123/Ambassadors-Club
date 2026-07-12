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
    renderRepertoire();
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
  renderRepertoire();
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
//  REPERTOIRE — songs table (Supabase) + audio storage bucket
//  Table:  songs (id uuid, title text, type text, lyrics text,
//                 audio_url text, created_at timestamptz)
//  Bucket: song-audio (public)
// ============================================================

const SONGS_STORAGE_KEY = 'sda_songs_data';
const SONG_TYPE_LABELS = { hymn: 'Hymn', praise: 'Praise', special: 'Special', worship: 'Worship' };

let songsData    = [];
let expandedSong  = null; // id of currently expanded song

async function loadSongs() {
  if (hasSupabase()) {
    try {
      const { data, error } = await supabaseClient
        .from('songs')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;
      songsData = (data || []).map(s => ({
        id: s.id, title: s.title || '', type: s.type || 'hymn',
        lyrics: s.lyrics || '', audioUrl: s.audio_url || null,
      }));
      localStorage.setItem(SONGS_STORAGE_KEY, JSON.stringify(songsData));
      return;
    } catch (err) {
      console.warn('Supabase songs load failed:', err.message);
    }
  }
  try {
    const cached = localStorage.getItem(SONGS_STORAGE_KEY);
    if (cached) { songsData = JSON.parse(cached); return; }
  } catch { /* ignore */ }
  songsData = [];
}

function renderRepertoire() {
  const container = document.getElementById('repertoireList');
  if (!container) return;

  const addBtnHtml = isAdmin ? `
    <div class="repertoire-item repertoire-add-row" id="addSongRow">
      <span class="rep-num">＋</span>
      <div class="rep-title" style="color:var(--gold);">Add a Song</div>
      <span class="rep-type">Upload</span>
    </div>` : '';

  if (!songsData.length) {
    container.innerHTML = addBtnHtml + `
      <div class="repertoire-item"><div class="rep-title" style="color:var(--text-3);font-style:italic;">No songs added yet.</div></div>`;
    document.getElementById('addSongRow')?.addEventListener('click', openSongForm);
    return;
  }

  container.innerHTML = songsData.map((s, i) => {
    const isOpen = expandedSong === s.id;
    return `
    <div class="repertoire-item-wrap">
      <div class="repertoire-item" data-song-toggle="${escHtml(s.id)}">
        <span class="rep-num">${String(i + 1).padStart(2, '0')}</span>
        <div class="rep-title">${escHtml(s.title)}</div>
        <span class="rep-type">${escHtml(SONG_TYPE_LABELS[s.type] || s.type)}</span>
        ${isAdmin ? `
        <button class="rep-edit-btn" data-song-edit="${escHtml(s.id)}" title="Edit song">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="rep-delete-btn" data-song-delete="${escHtml(s.id)}" title="Delete song">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/></svg>
        </button>` : ''}
        <svg class="rep-chevron ${isOpen ? 'open' : ''}" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
      </div>
      <div class="repertoire-detail" style="display:${isOpen ? 'block' : 'none'};">
        ${s.audioUrl ? `<audio controls src="${escHtml(s.audioUrl)}" style="width:100%;margin-bottom:1rem;"></audio>` : `<p class="rep-no-audio">No audio uploaded yet.</p>`}
        ${s.lyrics ? `<div class="rep-lyrics">${escHtml(s.lyrics).replace(/\n/g,'<br>')}</div>` : `<p class="rep-no-audio">No lyrics added yet.</p>`}
      </div>
    </div>`;
  }).join('') + addBtnHtml;

  document.getElementById('addSongRow')?.addEventListener('click', openSongForm);

  // Delegate toggle/edit/delete without re-rendering audio elements unnecessarily
  container.querySelectorAll('[data-song-toggle]').forEach(el => {
    el.addEventListener('click', () => toggleSong(el.dataset.songToggle));
  });
  container.querySelectorAll('[data-song-edit]').forEach(el => {
    el.addEventListener('click', (e) => { e.stopPropagation(); openSongForm(el.dataset.songEdit); });
  });
  container.querySelectorAll('[data-song-delete]').forEach(el => {
    el.addEventListener('click', (e) => { e.stopPropagation(); deleteSong(el.dataset.songDelete); });
  });
}

function toggleSong(id) {
  // Only flip the open/closed row in the DOM — never destroy audio elements
  // that aren't the one being toggled, and never touch other rows' playback.
  const wasOpen = expandedSong === id;
  const prevId = expandedSong;
  expandedSong = wasOpen ? null : id;

  const container = document.getElementById('repertoireList');
  if (!container) return;

  // Close previous row (if different) without a full re-render
  if (prevId && prevId !== id) {
    const prevRow = container.querySelector(`[data-song-toggle="${prevId}"]`);
    const prevDetail = prevRow?.closest('.repertoire-item-wrap')?.querySelector('.repertoire-detail');
    const prevChevron = prevRow?.querySelector('.rep-chevron');
    if (prevDetail) prevDetail.style.display = 'none';
    prevChevron?.classList.remove('open');
  }

  const row = container.querySelector(`[data-song-toggle="${id}"]`);
  const detail = row?.closest('.repertoire-item-wrap')?.querySelector('.repertoire-detail');
  const chevron = row?.querySelector('.rep-chevron');
  if (detail) detail.style.display = wasOpen ? 'none' : 'block';
  chevron?.classList.toggle('open', !wasOpen);
}

// ---- Add/Edit song modal (built dynamically) ----
let editingSongId = null; // null = adding new, else id of song being edited

function openSongForm(songId = null) {
  editingSongId = songId;
  const existing = songId ? songsData.find(s => s.id === songId) : null;

  let modal = document.getElementById('songModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'songModal';
    modal.innerHTML = `
      <div class="modal-overlay" id="songModalOverlay"></div>
      <div class="modal-content">
        <button class="modal-close" id="songModalClose" aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
        <div class="modal-header"><h3 id="songModalTitle">Add a Song</h3><p id="songModalSubtitle">Upload lyrics and/or audio for the repertoire</p></div>
        <div class="modal-body">
          <div class="form-group">
            <label>Title</label>
            <input type="text" id="songTitle" placeholder="Song title">
          </div>
          <div class="form-group">
            <label>Type</label>
            <select id="songType">
              <option value="hymn">Hymn</option>
              <option value="praise">Praise</option>
              <option value="special">Special</option>
              <option value="worship">Worship</option>
            </select>
          </div>
          <div class="form-group">
            <label>Lyrics <span style="text-transform:none;font-weight:400;">(optional)</span></label>
            <textarea id="songLyrics" rows="6" placeholder="Paste lyrics here…" style="padding:0.75rem 1rem;border:1.5px solid var(--border);border-radius:8px;font-family:var(--font-body);font-size:0.9rem;color:var(--text-1);background:var(--cream);outline:none;resize:vertical;"></textarea>
          </div>
          <div class="form-group">
            <label>Audio file <span id="songAudioHint" style="text-transform:none;font-weight:400;">(optional, mp3/m4a/wav)</span></label>
            <input type="file" id="songAudio" accept="audio/*">
          </div>
          <p class="form-error" id="songError"></p>
          <div class="form-actions">
            <button class="btn btn-ghost-dark" id="songCancel">Cancel</button>
            <button class="btn btn-gold" id="songSave">Save Song</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(modal);

    document.getElementById('songModalOverlay').addEventListener('click', closeSongForm);
    document.getElementById('songModalClose').addEventListener('click', closeSongForm);
    document.getElementById('songCancel').addEventListener('click', closeSongForm);
    document.getElementById('songSave').addEventListener('click', saveSong);
  }

  // Reset / populate form fresh every time it opens
  const titleInput = document.getElementById('songTitle');
  const typeSelect = document.getElementById('songType');
  const lyricsInput = document.getElementById('songLyrics');
  const audioInput = document.getElementById('songAudio');
  const audioHint = document.getElementById('songAudioHint');
  const errEl = document.getElementById('songError');
  const saveBtn = document.getElementById('songSave');
  const modalTitle = document.getElementById('songModalTitle');
  const modalSubtitle = document.getElementById('songModalSubtitle');

  audioInput.value = '';
  errEl.textContent = '';
  saveBtn.disabled = false;

  if (existing) {
    modalTitle.textContent = 'Edit Song';
    modalSubtitle.textContent = 'Update details, or replace the audio file';
    titleInput.value = existing.title;
    typeSelect.value = existing.type;
    lyricsInput.value = existing.lyrics || '';
    audioHint.textContent = existing.audioUrl ? '(leave empty to keep current audio)' : '(optional, mp3/m4a/wav)';
    saveBtn.textContent = 'Save Changes';
  } else {
    modalTitle.textContent = 'Add a Song';
    modalSubtitle.textContent = 'Upload lyrics and/or audio for the repertoire';
    titleInput.value = '';
    typeSelect.value = 'hymn';
    lyricsInput.value = '';
    audioHint.textContent = '(optional, mp3/m4a/wav)';
    saveBtn.textContent = 'Save Song';
  }

  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function resetSongForm() {
  const titleInput = document.getElementById('songTitle');
  const typeSelect = document.getElementById('songType');
  const lyricsInput = document.getElementById('songLyrics');
  const audioInput = document.getElementById('songAudio');
  const errEl = document.getElementById('songError');
  if (titleInput)  titleInput.value = '';
  if (typeSelect)  typeSelect.value = 'hymn';
  if (lyricsInput) lyricsInput.value = '';
  if (audioInput)  audioInput.value = '';
  if (errEl)       errEl.textContent = '';
  editingSongId = null;
}

function closeSongForm() {
  document.getElementById('songModal')?.classList.remove('active');
  document.body.style.overflow = '';
  resetSongForm();
}

async function saveSong() {
  const title    = document.getElementById('songTitle').value.trim();
  const type     = document.getElementById('songType').value;
  const lyrics   = document.getElementById('songLyrics').value.trim();
  const fileInput = document.getElementById('songAudio');
  const file     = fileInput.files[0] || null;
  const errEl    = document.getElementById('songError');
  const saveBtn  = document.getElementById('songSave');
  const isEdit   = !!editingSongId;

  if (!title) { errEl.textContent = 'Please enter a song title.'; return; }
  if (file && file.size > 15 * 1024 * 1024) { errEl.textContent = 'Audio file must be under 15MB.'; return; }

  errEl.textContent = '';
  saveBtn.disabled = true;
  saveBtn.textContent = isEdit ? 'Saving…' : 'Saving…';

  try {
    let audioUrl = isEdit ? (songsData.find(s => s.id === editingSongId)?.audioUrl || null) : null;

    if (file && hasSupabase()) {
      const ext = file.name.split('.').pop();
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: upErr } = await supabaseClient.storage
        .from('song-audio')
        .upload(path, file);
      if (upErr) throw new Error('Audio upload failed: ' + upErr.message);
      const { data: urlData } = supabaseClient.storage.from('song-audio').getPublicUrl(path);
      audioUrl = urlData.publicUrl;
    }

    if (hasSupabase()) {
      if (isEdit) {
        const { error } = await supabaseClient.from('songs')
          .update({ title, type, lyrics: lyrics || null, audio_url: audioUrl })
          .eq('id', editingSongId);
        if (error) throw error;
      } else {
        const { error } = await supabaseClient.from('songs').insert([{
          title, type, lyrics: lyrics || null, audio_url: audioUrl
        }]);
        if (error) throw error;
      }
      await loadSongs();
    } else {
      if (isEdit) {
        const idx = songsData.findIndex(s => s.id === editingSongId);
        if (idx !== -1) songsData[idx] = { ...songsData[idx], title, type, lyrics, audioUrl };
      } else {
        songsData.push({ id: 'local-' + Date.now(), title, type, lyrics, audioUrl });
      }
      localStorage.setItem(SONGS_STORAGE_KEY, JSON.stringify(songsData));
    }

    closeSongForm();
    renderRepertoire();
    showToast(isEdit ? `"${title}" updated ✓` : `"${title}" added ✓`, 'success');

  } catch (err) {
    console.error('Save song failed:', err);
    errEl.textContent = err.message || 'Failed to save song.';
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = isEdit ? 'Save Changes' : 'Save Song';
  }
}

async function deleteSong(id) {
  if (!confirm('Delete this song? This cannot be undone.')) return;
  try {
    if (hasSupabase() && !String(id).startsWith('local-')) {
      const { error } = await supabaseClient.from('songs').delete().eq('id', id);
      if (error) throw error;
      await loadSongs();
    } else {
      songsData = songsData.filter(s => s.id !== id);
      localStorage.setItem(SONGS_STORAGE_KEY, JSON.stringify(songsData));
    }
    if (expandedSong === id) expandedSong = null;
    renderRepertoire();
    showToast('Song deleted', 'success');
  } catch (err) {
    console.error('Delete song failed:', err);
    showToast('Delete failed: ' + err.message, 'error');
  }
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
  await loadSongs();
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