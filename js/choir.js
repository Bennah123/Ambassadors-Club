// ============================================================
//  CHOIR.JS — SDA Ambassadors Club
//  Admin via shared-auth.js (globalThis.isAdmin)
// ============================================================

const CHOIR_STORAGE_KEY = 'sda_choir_data';
const VOICE_PARTS       = ['soprano','alto','tenor','bass'];
const voicePartLabels   = { soprano:'Soprano', alto:'Alto', tenor:'Tenor', bass:'Bass' };

let choirRoster = { soprano:[], alto:[], tenor:[], bass:[] };

function hasSupabase() { return typeof supabaseClient !== 'undefined'; }
function getInitials(f,l) { return ((f||'')[0]||'')+((l||'')[0]||''); }
function escHtml(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function showToast(msg, type='info') {
  const t = document.createElement('div');
  t.className = `toast-notification toast-${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('toast-visible'));
  setTimeout(() => { t.classList.remove('toast-visible'); setTimeout(()=>t.remove(),350); }, 3200);
}

async function loadChoir() {
  if (hasSupabase()) {
    try {
      const { data, error } = await supabaseClient.from('choir_members').select('*').order('last_name',{ascending:true});
      if (error) throw error;
      buildRosterFromArray((data||[]).map(r => ({
        id:r.id, firstName:r.first_name||'', lastName:r.last_name||'',
        voicePart:(r.voice_part||'').toLowerCase(), role:r.role||'Member',
        avatarUrl:r.avatar_url||null, memberId:r.member_id||null
      })));
      localStorage.setItem(CHOIR_STORAGE_KEY, JSON.stringify(VOICE_PARTS.flatMap(p=>choirRoster[p])));
      return;
    } catch(err) { console.warn('Choir load failed:', err.message); }
  }
  try {
    const stored = localStorage.getItem(CHOIR_STORAGE_KEY);
    if (stored) { buildRosterFromArray(JSON.parse(stored)); return; }
  } catch (error) {
    console.error('Failed to parse cached choir data:', error);
  }
  buildRosterFromArray([]);
}

function buildRosterFromArray(members) {
  choirRoster = { soprano:[], alto:[], tenor:[], bass:[] };
  members.forEach(m => {
    const part = (m.voicePart||m.voice_part||'').toLowerCase();
    if (VOICE_PARTS.includes(part)) choirRoster[part].push(m);
  });
}

function flatRoster() { return VOICE_PARTS.flatMap(p=>choirRoster[p]); }

function renderAllPanels() {
  VOICE_PARTS.forEach(renderPanel);
  const total = flatRoster().length;
  const heroEl = document.getElementById('heroTotalCount');
  if (heroEl) heroEl.textContent = total;
  const grid = document.getElementById('voicePanelsGrid');
  if (grid) grid.classList.toggle('is-admin', globalThis.isAdmin);
}

function renderPanel(voice) {
  const cap   = voice.charAt(0).toUpperCase()+voice.slice(1);
  const body  = document.getElementById(`panel${cap}`);
  const countEl = document.getElementById(`count${cap}`);
  if (!body) return;
  const members = choirRoster[voice]||[];
  if (countEl) countEl.textContent = members.length;
  if (!members.length) {
    body.innerHTML = `<div class="vp-empty"><div class="vp-empty-icon">🎙️</div><span>No ${voicePartLabels[voice]} members yet</span></div>`;
    return;
  }
  body.innerHTML = members.map(m => {
    const initials   = getInitials(m.firstName,m.lastName).toUpperCase()||'?';
    const isLeader   = m.role&&(m.role.toLowerCase().includes('leader')||m.role==='Choir Director');
    const avatarHtml = m.avatarUrl
      ? `<div class="vp-avatar"><img src="${escHtml(m.avatarUrl)}" alt="${escHtml(m.firstName)}" loading="lazy" onerror="this.parentElement.innerHTML='${escHtml(initials)}'"></div>`
      : `<div class="vp-avatar">${escHtml(initials)}</div>`;
    return `
      <div class="vp-member-row" data-id="${escHtml(m.id)}">
        ${avatarHtml}
        <div style="flex:1;min-width:0;">
          <div class="vp-name">${escHtml(m.firstName)} ${escHtml(m.lastName)}</div>
          <div class="vp-role">${escHtml(m.role||'Member')}</div>
        </div>
        ${isLeader?'<div class="section-leader-dot" title="Section Leader"></div>':''}
        ${globalThis.isAdmin?`<button class="vp-edit-btn" onclick="openEditFromRow(event,'${escHtml(m.id)}')" title="Edit">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg></button>`:''}
      </div>`;
  }).join('');
}

// ---- ADMIN UI ----
function updateAdminUI() {
  const loginBtn   = document.getElementById('adminLoginBtn');
  const adminStatus = document.getElementById('adminStatus');
  if (loginBtn)    loginBtn.style.display    = globalThis.isAdmin ? 'none'  : 'inline';
  if (adminStatus) adminStatus.style.display = globalThis.isAdmin ? 'flex'  : 'none';
}

// ---- VOICE ASSIGN FORM ----
async function openVoiceAssignForm(prefillMemberId) {
  const modal = document.getElementById('voiceAssignModal');
  if (!modal) return;
  document.getElementById('vaError').textContent = '';
  document.getElementById('vaVoice').value = '';
  document.getElementById('vaRole').value  = 'Member';
  const saveBtn = document.getElementById('vaSave');
  saveBtn.disabled=false; saveBtn.textContent='Save';
  const memberSelect = document.getElementById('vaMember');
  memberSelect.innerHTML='<option value="">— Loading members… —</option>';
  memberSelect.disabled=true;
  modal.classList.add('active'); document.body.style.overflow='hidden';
  try {
    const { data, error } = await supabaseClient.from('members')
      .select('id,first_name,last_name,departments,avatar_url').order('last_name',{ascending:true});
    if (error) throw error;
    const voiceLookupById={}, voiceLookupByName={};
    VOICE_PARTS.forEach(p => choirRoster[p].forEach(cm => {
      voiceLookupByName[`${cm.firstName}|${cm.lastName}`]=p;
      if (cm.memberId) voiceLookupById[cm.memberId]=p;
    }));
    memberSelect.disabled=false;
    const members=data||[];
    if (!members.length) { memberSelect.innerHTML='<option value="">No members found</option>'; return; }
    memberSelect.innerHTML='<option value="">— Select member —</option>'+
      members.map(m => {
        const key=`${m.first_name}|${m.last_name}`;
        const cv=voiceLookupById[m.id]||voiceLookupByName[key]||'';
        return `<option value="${m.id}" data-first="${escHtml(m.first_name)}" data-last="${escHtml(m.last_name)}"
          data-avatar="${escHtml(m.avatar_url||'')}" data-current-voice="${escHtml(cv)}">
          ${escHtml(m.first_name)} ${escHtml(m.last_name)}${cv?` (${voicePartLabels[cv]})`:''}</option>`;
      }).join('');
    if (prefillMemberId) { memberSelect.value=prefillMemberId; memberSelect.dispatchEvent(new Event('change')); }
  } catch(err) {
    memberSelect.disabled=false;
    memberSelect.innerHTML='<option value="">Failed to load</option>';
    document.getElementById('vaError').textContent=`Could not load: ${err.message}`;
  }
}

function closeVoiceAssignForm() { document.getElementById('voiceAssignModal')?.classList.remove('active'); document.body.style.overflow=''; }

function openEditFromRow(event, choirMemberId) {
  event.stopPropagation();
  const m = flatRoster().find(x=>String(x.id)===String(choirMemberId));
  openVoiceAssignForm(m?.memberId||null);
}

async function saveVoiceAssign() {
  const memberSelect=document.getElementById('vaMember');
  const selectedOpt=memberSelect.options[memberSelect.selectedIndex];
  const memberId=memberSelect.value;
  const voice=document.getElementById('vaVoice').value;
  const role=document.getElementById('vaRole').value||'Member';
  const errEl=document.getElementById('vaError');
  const saveBtn=document.getElementById('vaSave');
  if (!memberSelect.value){errEl.textContent='Select a member.';return;}
  if (!voice){errEl.textContent='Select a voice part.';return;}
  const firstName=selectedOpt.dataset.first||'', lastName=selectedOpt.dataset.last||'', avatarUrl=selectedOpt.dataset.avatar||null;
  errEl.textContent=''; saveBtn.disabled=true; saveBtn.textContent='Saving…';
  try {
    if (hasSupabase()) {
      let existing = null;
      if (memberId) {
        const { data } = await supabaseClient.from('choir_members').select('id')
          .eq('member_id', memberId).maybeSingle();
        existing = data;
      }
      if (!existing) {
        const { data } = await supabaseClient.from('choir_members').select('id')
          .eq('first_name', firstName).eq('last_name', lastName).maybeSingle();
        existing = data;
      }
      if (existing) {
        const { error } = await supabaseClient.from('choir_members')
          .update({ voice_part:voice, role, member_id:memberId, avatar_url:avatarUrl }).eq('id',existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabaseClient.from('choir_members')
          .insert([{ first_name:firstName, last_name:lastName, voice_part:voice, role, member_id:memberId, avatar_url:avatarUrl }]);
        if (error) throw error;
      }
      await loadChoir();
    } else {
      VOICE_PARTS.forEach(p => { choirRoster[p]=choirRoster[p].filter(x=>!(x.memberId===memberId||(x.firstName===firstName&&x.lastName===lastName))); });
      if (!choirRoster[voice]) choirRoster[voice]=[];
      choirRoster[voice].push({ id:Date.now(), firstName, lastName, voicePart:voice, role, avatarUrl, memberId });
      localStorage.setItem(CHOIR_STORAGE_KEY, JSON.stringify(VOICE_PARTS.flatMap(p=>choirRoster[p])));
    }
    saveBtn.disabled=false; saveBtn.textContent='Save';
    closeVoiceAssignForm(); renderAllPanels();
    showToast(`${firstName} ${lastName} → ${voicePartLabels[voice]} ✓`, 'success');
  } catch(err) {
    errEl.textContent=`Failed: ${err.message}`;
    saveBtn.disabled=false; saveBtn.textContent='Save';
  }
}

// ---- REPERTOIRE (songs table + song-audio storage bucket) ----
const SONGS_STORAGE_KEY = 'sda_songs_data';
const SONG_TYPE_LABELS = { hymn:'Hymn', praise:'Praise', special:'Special', worship:'Worship', album1:'Album 1', album2:'Album 2' };

let songsData = [];
let expandedSong = null;
let editingSongId = null;

async function loadSongs() {
  if (hasSupabase()) {
    try {
      const { data, error } = await supabaseClient.from('songs').select('*').order('created_at',{ascending:true});
      if (error) throw error;
      songsData = (data||[]).map(s => ({
        id:s.id, title:s.title||'', type:s.type||'hymn',
        lyrics:s.lyrics||'', audioUrl:s.audio_url||null,
      }));
      localStorage.setItem(SONGS_STORAGE_KEY, JSON.stringify(songsData));
      return;
    } catch(err) { console.warn('Songs load failed:', err.message); }
  }
  try {
    const cached = localStorage.getItem(SONGS_STORAGE_KEY);
    if (cached) { songsData = JSON.parse(cached); return; }
  } catch (error) {
    console.error('Failed to parse cached songs data:', error);
  }
  songsData = [];
}

function renderRepertoire() {
  const container = document.getElementById('repertoireList');
  if (!container) return;

  const addBtnHtml = globalThis.isAdmin ? `
    <div class="repertoire-item repertoire-add-row" id="addSongRow">
      <span class="rep-num">＋</span>
      <div class="rep-title" style="color:var(--gold);">Add a Song</div>
      <span class="rep-type">Upload</span>
    </div>` : '';

  if (!songsData.length) {
    container.innerHTML = addBtnHtml + `
      <div class="repertoire-item"><div class="rep-title" style="color:var(--text-3);font-style:italic;">No songs added yet.</div></div>`;
    document.getElementById('addSongRow')?.addEventListener('click', () => openSongForm());
    return;
  }

  container.innerHTML = songsData.map((s,i) => {
    const isOpen = expandedSong === s.id;
    return `
    <div class="repertoire-item-wrap">
      <div class="repertoire-item" data-song-toggle="${escHtml(s.id)}">
        <span class="rep-num">${String(i+1).padStart(2,'0')}</span>
        <div class="rep-title">${escHtml(s.title)}</div>
        <span class="rep-type">${escHtml(SONG_TYPE_LABELS[s.type]||s.type)}</span>
        ${globalThis.isAdmin ? `
        <button class="rep-edit-btn" data-song-edit="${escHtml(s.id)}" title="Edit song">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="rep-delete-btn" data-song-delete="${escHtml(s.id)}" title="Delete song">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/></svg>
        </button>` : ''}
        <svg class="rep-chevron ${isOpen?'open':''}" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
      </div>
      <div class="repertoire-detail" style="display:${isOpen?'block':'none'};">
        ${s.audioUrl ? `<audio controls src="${escHtml(s.audioUrl)}" style="width:100%;margin-bottom:1rem;"></audio>` : `<p class="rep-no-audio">No audio uploaded yet.</p>`}
        ${s.lyrics ? `<div class="rep-lyrics">${escHtml(s.lyrics).replace(/\n/g,'<br>')}</div>` : `<p class="rep-no-audio">No lyrics added yet.</p>`}
      </div>
    </div>`;
  }).join('') + addBtnHtml;

  document.getElementById('addSongRow')?.addEventListener('click', () => openSongForm());
  container.querySelectorAll('[data-song-toggle]').forEach(el => el.addEventListener('click', () => toggleSong(el.dataset.songToggle)));
  container.querySelectorAll('[data-song-edit]').forEach(el => el.addEventListener('click', e => { e.stopPropagation(); openSongForm(el.dataset.songEdit); }));
  container.querySelectorAll('[data-song-delete]').forEach(el => el.addEventListener('click', e => { e.stopPropagation(); deleteSong(el.dataset.songDelete); }));
}

function toggleSong(id) {
  const wasOpen = expandedSong === id;
  const prevId = expandedSong;
  expandedSong = wasOpen ? null : id;
  const container = document.getElementById('repertoireList');
  if (!container) return;

  if (prevId && prevId !== id) {
    const prevRow = container.querySelector(`[data-song-toggle="${prevId}"]`);
    const prevDetail = prevRow?.closest('.repertoire-item-wrap')?.querySelector('.repertoire-detail');
    prevRow?.querySelector('.rep-chevron')?.classList.remove('open');
    if (prevDetail) prevDetail.style.display = 'none';
  }
  const row = container.querySelector(`[data-song-toggle="${id}"]`);
  const detail = row?.closest('.repertoire-item-wrap')?.querySelector('.repertoire-detail');
  row?.querySelector('.rep-chevron')?.classList.toggle('open', !wasOpen);
  if (detail) detail.style.display = wasOpen ? 'none' : 'block';
}

function openSongForm(songId = null) {
  editingSongId = songId;
  const existing = songId ? songsData.find(s=>s.id===songId) : null;

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
          <div class="form-group"><label>Title</label><input type="text" id="songTitle" placeholder="Song title"></div>
          <div class="form-group"><label>Type</label>
            <select id="songType">
              <option value="hymn">Hymn</option><option value="praise">Praise</option>
              <option value="special">Special</option><option value="worship">Worship</option>
              <option value="album1">Album 1</option><option value="album2">Album 2</option>
            </select>
          </div>
          <div class="form-group"><label>Lyrics <span style="text-transform:none;font-weight:400;">(optional)</span></label>
            <textarea id="songLyrics" rows="6" placeholder="Paste lyrics here…" style="padding:0.75rem 1rem;border:1.5px solid var(--border);border-radius:8px;font-family:var(--font-body);font-size:0.9rem;color:var(--text-1);background:var(--cream);outline:none;resize:vertical;"></textarea>
          </div>
          <div class="form-group"><label>Audio file <span id="songAudioHint" style="text-transform:none;font-weight:400;">(optional, mp3/m4a/wav)</span></label>
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

  const titleInput = document.getElementById('songTitle');
  const typeSelect = document.getElementById('songType');
  const lyricsInput = document.getElementById('songLyrics');
  const audioInput = document.getElementById('songAudio');
  const audioHint = document.getElementById('songAudioHint');
  const errEl = document.getElementById('songError');
  const saveBtn = document.getElementById('songSave');

  audioInput.value = '';
  errEl.textContent = '';
  saveBtn.disabled = false;

  if (existing) {
    document.getElementById('songModalTitle').textContent = 'Edit Song';
    document.getElementById('songModalSubtitle').textContent = 'Update details, or replace the audio file';
    titleInput.value = existing.title;
    typeSelect.value = existing.type;
    lyricsInput.value = existing.lyrics || '';
    audioHint.textContent = existing.audioUrl ? '(leave empty to keep current audio)' : '(optional, mp3/m4a/wav)';
    saveBtn.textContent = 'Save Changes';
  } else {
    document.getElementById('songModalTitle').textContent = 'Add a Song';
    document.getElementById('songModalSubtitle').textContent = 'Upload lyrics and/or audio for the repertoire';
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
  const _ids = ['songTitle','songType','songLyrics','songAudio','songError'];
  const t=document.getElementById('songTitle'), ty=document.getElementById('songType'),
        l=document.getElementById('songLyrics'), a=document.getElementById('songAudio'),
        e=document.getElementById('songError');
  if (t) t.value=''; if (ty) ty.value='hymn'; if (l) l.value=''; if (a) a.value=''; if (e) e.textContent='';
  editingSongId = null;
}

function closeSongForm() {
  document.getElementById('songModal')?.classList.remove('active');
  document.body.style.overflow = '';
  resetSongForm();
}

async function saveSong() {
  const title = document.getElementById('songTitle').value.trim();
  const type = document.getElementById('songType').value;
  const lyrics = document.getElementById('songLyrics').value.trim();
  const fileInput = document.getElementById('songAudio');
  const file = fileInput.files[0] || null;
  const errEl = document.getElementById('songError');
  const saveBtn = document.getElementById('songSave');
  const isEdit = !!editingSongId;

  if (!title) { errEl.textContent = 'Please enter a song title.'; return; }
  if (file && file.size > 15*1024*1024) { errEl.textContent = 'Audio file must be under 15MB.'; return; }

  errEl.textContent = '';
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving…';

  try {
    let audioUrl = isEdit ? (songsData.find(s=>s.id===editingSongId)?.audioUrl || null) : null;

    if (file && hasSupabase()) {
      const ext = file.name.split('.').pop();
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: upErr } = await supabaseClient.storage.from('song-audio').upload(path, file);
      if (upErr) throw new Error('Audio upload failed: ' + upErr.message);
      const { data: urlData } = supabaseClient.storage.from('song-audio').getPublicUrl(path);
      audioUrl = urlData.publicUrl;
    }

    if (hasSupabase()) {
      if (isEdit) {
        const { error } = await supabaseClient.from('songs')
          .update({ title, type, lyrics: lyrics||null, audio_url: audioUrl }).eq('id', editingSongId);
        if (error) throw error;
      } else {
        const { error } = await supabaseClient.from('songs')
          .insert([{ title, type, lyrics: lyrics||null, audio_url: audioUrl }]);
        if (error) throw error;
      }
      await loadSongs();
    } else {
      if (isEdit) {
        const idx = songsData.findIndex(s=>s.id===editingSongId);
        if (idx!==-1) songsData[idx] = { ...songsData[idx], title, type, lyrics, audioUrl };
      } else {
        songsData.push({ id:'local-'+Date.now(), title, type, lyrics, audioUrl });
      }
      localStorage.setItem(SONGS_STORAGE_KEY, JSON.stringify(songsData));
    }

    closeSongForm();
    renderRepertoire();
    showToast(isEdit ? `"${title}" updated ✓` : `"${title}" added ✓`, 'success');
  } catch(err) {
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
      songsData = songsData.filter(s=>s.id!==id);
      localStorage.setItem(SONGS_STORAGE_KEY, JSON.stringify(songsData));
    }
    if (expandedSong === id) expandedSong = null;
    renderRepertoire();
    showToast('Song deleted', 'success');
  } catch(err) {
    console.error('Delete song failed:', err);
    showToast('Delete failed: ' + err.message, 'error');
  }
}

function animateCounter(el, target, duration=1200) {
  const start=performance.now();
  const update=now=>{
    const p=Math.min((now-start)/duration,1);
    el.textContent=Math.round((1-Math.pow(1-p,3))*target);
    if(p<1) requestAnimationFrame(update);
  };
  requestAnimationFrame(update);
}

// ---- INIT ----
async function initChoir() {
  await loadChoir();
  await loadSongs();
  renderAllPanels();
  renderRepertoire();
  updateAdminUI();

  const heroEl = document.getElementById('heroTotalCount');
  if (heroEl) animateCounter(heroEl, flatRoster().length);

  // Admin login → redirect to auth page
  document.getElementById('adminLoginBtn')?.addEventListener('click', () => globalThis.location.href='auth.html');
  document.getElementById('adminLogoutBtn')?.addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    globalThis.location.href = 'auth.html';
  });

  document.getElementById('assignVoiceBtn')?.addEventListener('click', () => openVoiceAssignForm());
  document.getElementById('vaSave')?.addEventListener('click', saveVoiceAssign);
  document.getElementById('vaCancel')?.addEventListener('click', closeVoiceAssignForm);
  document.getElementById('vaClose')?.addEventListener('click', closeVoiceAssignForm);
  document.getElementById('vaOverlay')?.addEventListener('click', closeVoiceAssignForm);
  document.getElementById('vaMember')?.addEventListener('change', function() {
    const opt=this.options[this.selectedIndex];
    if (!opt.value) return;
    document.getElementById('vaVoice').value=opt.dataset.currentVoice||'';
  });
  document.addEventListener('keydown', e => { if(e.key==='Escape') closeVoiceAssignForm(); });
}

document.addEventListener('adminReady', initChoir);