// ============================================================
//  CHOIR.JS — SDA Ambassadors Club
//  Admin via shared-auth.js (window.isAdmin)
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
  } catch {}
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
  if (grid) grid.classList.toggle('is-admin', window.isAdmin);
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
      <div class="vp-member-row" data-id="${m.id}">
        ${avatarHtml}
        <div style="flex:1;min-width:0;">
          <div class="vp-name">${escHtml(m.firstName)} ${escHtml(m.lastName)}</div>
          <div class="vp-role">${escHtml(m.role||'Member')}</div>
        </div>
        ${isLeader?'<div class="section-leader-dot" title="Section Leader"></div>':''}
        ${window.isAdmin?`<button class="vp-edit-btn" onclick="openEditFromRow(event,${m.id})" title="Edit">
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
  if (loginBtn)    loginBtn.style.display    = window.isAdmin ? 'none'  : 'inline';
  if (adminStatus) adminStatus.style.display = window.isAdmin ? 'flex'  : 'none';
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
  const m = flatRoster().find(x=>x.id===choirMemberId);
  openVoiceAssignForm(m?.memberId||null);
}

async function saveVoiceAssign() {
  const memberSelect=document.getElementById('vaMember');
  const selectedOpt=memberSelect.options[memberSelect.selectedIndex];
  const memberId=parseInt(memberSelect.value);
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
      const { data: existing } = await supabaseClient.from('choir_members').select('id')
        .or(`member_id.eq.${memberId},and(first_name.eq.${firstName},last_name.eq.${lastName})`).maybeSingle();
      if (existing) {
        const { error } = await supabaseClient.from('choir_members')
          .update({ voice_part:voice, role, member_id:memberId, avatar_url:avatarUrl }).eq('id',existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabaseClient.from('choir_members')
          .insert([{ first_name:firstName, last_name:lastName, voice_part:voice, role, member_id:memberId, avatar_url:avatarUrl }]);
        if (error) throw error;
      }
    }
    VOICE_PARTS.forEach(p => { choirRoster[p]=choirRoster[p].filter(x=>!(x.memberId===memberId||(x.firstName===firstName&&x.lastName===lastName))); });
    if (!choirRoster[voice]) choirRoster[voice]=[];
    choirRoster[voice].push({ id:Date.now(), firstName, lastName, voicePart:voice, role, avatarUrl, memberId });
    localStorage.setItem(CHOIR_STORAGE_KEY, JSON.stringify(VOICE_PARTS.flatMap(p=>choirRoster[p])));
    saveBtn.disabled=false; saveBtn.textContent='Save';
    closeVoiceAssignForm(); renderAllPanels();
    showToast(`${firstName} ${lastName} → ${voicePartLabels[voice]} ✓`, 'success');
  } catch(err) {
    errEl.textContent=`Failed: ${err.message}`;
    saveBtn.disabled=false; saveBtn.textContent='Save';
  }
}

// ---- REPERTOIRE ----
const repertoireData = [
  { title:"Nikikumbuka",            typeLabel:"Album-1" },
  { title:"Mungu ni wa namna gani", typeLabel:"Album-1" },
  { title:"Katika Pande Zote",      typeLabel:"Album-1" },
  { title:"Waseol",                 typeLabel:"Album-1" },
  { title:"Toiroka",                typeLabel:"Album-1" },
  { title:"Kati ya wenye Dhambi",   typeLabel:"Album-1" },
  { title:"Lakini Sasa",            typeLabel:"Album-1" },
];

function renderRepertoire() {
  const container = document.getElementById('repertoireList');
  if (!container) return;
  container.innerHTML = repertoireData.map((s,i) => `
    <div class="repertoire-item">
      <span class="rep-num">${String(i+1).padStart(2,'0')}</span>
      <div class="rep-title">${escHtml(s.title)}</div>
      <span class="rep-type">${escHtml(s.typeLabel)}</span>
    </div>`).join('');
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
  renderAllPanels();
  renderRepertoire();
  updateAdminUI();

  const heroEl = document.getElementById('heroTotalCount');
  if (heroEl) animateCounter(heroEl, flatRoster().length);

  // Admin login → redirect to auth page
  document.getElementById('adminLoginBtn')?.addEventListener('click', () => window.location.href='auth.html');
  document.getElementById('adminLogoutBtn')?.addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    window.location.href = 'auth.html';
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