// ============================================================
//  SECRETARY.JS — SDA Ambassadors Club
//  Admin via shared-auth.js (window.isAdmin)
// ============================================================

const ADMIN_PIN = '0000'; // kept for fallback but primary auth is role-based
let allMinutes   = [];
let activeFilter = 'all';

const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

function toast(msg, type='info') {
  const t = document.createElement('div');
  t.className = `toast-notification toast-${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('toast-visible'));
  setTimeout(() => { t.classList.remove('toast-visible'); setTimeout(()=>t.remove(),350); }, 3000);
}

async function loadMinutes() {
  if (typeof supabaseClient === 'undefined') { renderMinutes(); return; }
  try {
    const { data, error } = await supabaseClient.from('meeting_minutes')
      .select('*').order('date', { ascending: false });
    if (error) throw error;
    allMinutes = data || [];
  } catch(e) { console.warn('Minutes load failed:', e.message); allMinutes = []; }
  renderMinutes();
  updateStats();
}

async function loadOfficers() {
  const list = document.getElementById('officerList');
  if (!list) return;
  if (typeof supabaseClient === 'undefined') { list.innerHTML='<p style="font-size:.82rem;color:var(--text-3);">Connect Supabase to load officers.</p>'; return; }
  try {
    const { data } = await supabaseClient.from('members').select('first_name,last_name,role,avatar_url')
      .in('role',['President','Vice President','Secretary','Treasurer','Chaplain']).order('role');
    if (!data||!data.length) { list.innerHTML='<p style="font-size:.82rem;color:var(--text-3);">No officers found.</p>'; return; }
    list.innerHTML = data.map(m => {
      const initials=((m.first_name||'')[0]||'')+((m.last_name||'')[0]||'');
      const avatar=m.avatar_url?`<img src="${esc(m.avatar_url)}" alt="${esc(m.first_name)}">`:initials.toUpperCase();
      return `<div class="officer-row"><div class="officer-avatar">${avatar}</div><div><div class="officer-name">${esc(m.first_name)} ${esc(m.last_name)}</div><div class="officer-role">${esc(m.role)}</div></div></div>`;
    }).join('');
  } catch(e) { list.innerHTML='<p style="font-size:.82rem;color:var(--text-3);">Could not load officers.</p>'; }
}

function getFiltered() {
  const q = (document.getElementById('minutesSearch')?.value||'').toLowerCase();
  return allMinutes.filter(m => {
    const matchFilter = activeFilter==='all' || m.type===activeFilter;
    const matchSearch = !q || m.title?.toLowerCase().includes(q) || m.type?.toLowerCase().includes(q)
      || m.recorded_by?.toLowerCase().includes(q) || (m.date||'').includes(q);
    return matchFilter && matchSearch;
  });
}

function renderMinutes() {
  const container = document.getElementById('minutesList');
  const noRes     = document.getElementById('noResults');
  const filtered  = getFiltered();

  // Update admin bar visibility
  const adminBar = document.getElementById('adminBar');
  if (adminBar) adminBar.style.display = window.isAdmin ? 'flex' : 'none';

  if (!filtered.length) {
    container.innerHTML='';
    if (noRes) noRes.style.display='block';
    return;
  }
  if (noRes) noRes.style.display='none';
  container.innerHTML = filtered.map(m => buildCard(m)).join('');

  container.querySelectorAll('.minute-card-header').forEach(hdr => {
    hdr.addEventListener('click', () => hdr.closest('.minute-card').classList.toggle('expanded'));
  });

  if (window.isAdmin) {
    container.querySelectorAll('.action-checkbox').forEach(cb => {
      cb.addEventListener('click', e => {
        e.stopPropagation();
        const row=cb.closest('.action-item');
        row.classList.toggle('done');
        toggleActionDone(parseInt(cb.dataset.minuteId), parseInt(cb.dataset.idx), row.classList.contains('done'));
      });
    });
  }
}

function buildCard(m) {
  const d=m.date?new Date(m.date):null;
  const day=d?d.getDate():'--';
  const mon=d?d.toLocaleDateString('en-GB',{month:'short',year:'numeric'}):'';
  const typeClass={general:'type-general',special:'type-special',agm:'type-agm',emergency:'type-emergency'}[m.type]||'type-general';
  const attendees=(m.attendees||[]).map(a=>`<span class="attendee-chip">${esc(a)}</span>`).join('');
  const actions=(m.action_items||[]).map((a,i)=>`
    <div class="action-item ${a.done?'done':''}">
      <div class="action-checkbox" data-minute-id="${m.id}" data-idx="${i}" ${!window.isAdmin?'style="pointer-events:none;"':''}>
        ${a.done?'<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>':''}
      </div>
      <span>${esc(a.text)}</span>
      ${a.assignee?`<span class="action-assignee">${esc(a.assignee)}</span>`:''}
    </div>`).join('');
  const adminBtns=window.isAdmin?`<div class="admin-card-actions">
    <button class="admin-card-btn" onclick="openEdit(event,${m.id})">✏️</button>
    <button class="admin-card-btn" onclick="deleteMinute(event,${m.id})">🗑️</button>
  </div>`:'';
  return `
    <div class="minute-card" data-id="${m.id}">
      ${adminBtns}
      <div class="minute-card-header">
        <div class="minute-date-block"><span class="minute-date-day">${day}</span><span class="minute-date-mon">${mon}</span></div>
        <div class="minute-meta">
          <div class="minute-title">${esc(m.title)}</div>
          <div class="minute-sub">${m.venue?esc(m.venue)+' · ':''}Chaired by ${esc(m.chaired_by||'—')}</div>
        </div>
        <div class="minute-badges"><span class="minute-type-badge ${typeClass}">${(m.type||'general').toUpperCase()}</span></div>
        <svg class="minute-chevron" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
      </div>
      <div class="minute-body">
        ${m.agenda?`<div class="minute-section"><div class="minute-section-title">Agenda</div><p>${esc(m.agenda).replace(/\n/g,'<br>')}</p></div>`:''}
        ${m.minutes?`<div class="minute-section"><div class="minute-section-title">Minutes</div><p>${esc(m.minutes).replace(/\n/g,'<br>')}</p></div>`:''}
        ${actions?`<div class="minute-section"><div class="minute-section-title">Action Items</div><div class="action-items">${actions}</div></div>`:''}
        ${m.aob?`<div class="minute-section"><div class="minute-section-title">AOB</div><p>${esc(m.aob).replace(/\n/g,'<br>')}</p></div>`:''}
        ${attendees?`<div class="minute-section"><div class="minute-section-title">Attendance (${(m.attendees||[]).length})</div><div class="minute-attendance">${attendees}</div></div>`:''}
        <div class="minute-footer-row">
          <span class="minute-recorded-by">Recorded by: ${esc(m.recorded_by||'—')}</span>
          ${m.next_meeting_date?`<span class="minute-recorded-by">Next: ${new Date(m.next_meeting_date).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})}</span>`:''}
        </div>
      </div>
    </div>`;
}

function updateStats() {
  const year=new Date().getFullYear();
  document.getElementById('statTotal').textContent   = allMinutes.length;
  document.getElementById('statYear').textContent    = allMinutes.filter(m=>(m.date||'').startsWith(year)).length;
  const actions=allMinutes.flatMap(m=>m.action_items||[]);
  document.getElementById('statPending').textContent = actions.filter(a=>!a.done).length;
  document.getElementById('statDone').textContent    = actions.filter(a=>a.done).length;
}

let editingId=null;

function openAdd() {
  editingId=null;
  document.getElementById('minutesModalTitle').textContent='New Meeting Minutes';
  ['fTitle','fVenue','fChair','fAttendees','fAgenda','fMinutes','fAob','fRecordedBy'].forEach(id=>{ document.getElementById(id).value=''; });
  document.getElementById('fDate').value=new Date().toISOString().split('T')[0];
  document.getElementById('fNextDate').value='';
  document.getElementById('fType').value='general';
  document.getElementById('actionItemsForm').innerHTML='';
  document.getElementById('minutesFormError').textContent='';
  openModal('minutesModal');
}

function openEdit(e,id) {
  e.stopPropagation();
  const m=allMinutes.find(x=>x.id===id); if(!m) return;
  editingId=id;
  document.getElementById('minutesModalTitle').textContent='Edit Minutes';
  document.getElementById('fTitle').value      = m.title||'';
  document.getElementById('fDate').value       = m.date||'';
  document.getElementById('fType').value       = m.type||'general';
  document.getElementById('fVenue').value      = m.venue||'';
  document.getElementById('fChair').value      = m.chaired_by||'';
  document.getElementById('fAttendees').value  = (m.attendees||[]).join(', ');
  document.getElementById('fAgenda').value     = m.agenda||'';
  document.getElementById('fMinutes').value    = m.minutes||'';
  document.getElementById('fAob').value        = m.aob||'';
  document.getElementById('fRecordedBy').value = m.recorded_by||'';
  document.getElementById('fNextDate').value   = m.next_meeting_date||'';
  const form=document.getElementById('actionItemsForm'); form.innerHTML='';
  (m.action_items||[]).forEach(a=>addActionRow(a.text,a.assignee));
  document.getElementById('minutesFormError').textContent='';
  openModal('minutesModal');
}

async function saveMinutes() {
  const title=document.getElementById('fTitle').value.trim();
  const date=document.getElementById('fDate').value;
  if (!title||!date){document.getElementById('minutesFormError').textContent='Title and date required.';return;}
  const attendees=document.getElementById('fAttendees').value.split(',').map(s=>s.trim()).filter(Boolean);
  const action_items=[];
  document.querySelectorAll('.action-item-row').forEach(row=>{
    const text=row.querySelector('.ai-text')?.value.trim();
    const assignee=row.querySelector('.ai-assign')?.value.trim();
    if(text) action_items.push({text,assignee:assignee||'',done:false});
  });
  const payload={
    title, date, type:document.getElementById('fType').value,
    venue:document.getElementById('fVenue').value.trim(),
    chaired_by:document.getElementById('fChair').value.trim(),
    attendees, agenda:document.getElementById('fAgenda').value.trim(),
    minutes:document.getElementById('fMinutes').value.trim(),
    aob:document.getElementById('fAob').value.trim(),
    recorded_by:document.getElementById('fRecordedBy').value.trim(),
    next_meeting_date:document.getElementById('fNextDate').value||null,
    action_items
  };
  const btn=document.getElementById('minutesFormSave');
  btn.disabled=true; btn.textContent='Saving…';
  try {
    if (editingId) {
      const {error}=await supabaseClient.from('meeting_minutes').update(payload).eq('id',editingId);
      if(error) throw error;
      const idx=allMinutes.findIndex(m=>m.id===editingId);
      if(idx>-1) allMinutes[idx]={...allMinutes[idx],...payload};
      toast('Minutes updated ✓','success');
    } else {
      const {data,error}=await supabaseClient.from('meeting_minutes').insert([payload]).select().single();
      if(error) throw error;
      allMinutes.unshift(data);
      toast('Minutes saved ✓','success');
    }
    closeModal('minutesModal'); renderMinutes(); updateStats();
  } catch(err) {
    document.getElementById('minutesFormError').textContent=err.message;
  } finally { btn.disabled=false; btn.textContent='Save Minutes'; }
}

async function deleteMinute(e,id) {
  e.stopPropagation();
  if(!confirm('Delete these minutes?')) return;
  try {
    const {error}=await supabaseClient.from('meeting_minutes').delete().eq('id',id);
    if(error) throw error;
    allMinutes=allMinutes.filter(m=>m.id!==id);
    renderMinutes(); updateStats(); toast('Deleted','info');
  } catch(err) { toast(err.message,'error'); }
}

async function toggleActionDone(minuteId,idx,done) {
  const m=allMinutes.find(x=>x.id===minuteId); if(!m) return;
  m.action_items[idx].done=done;
  try { await supabaseClient.from('meeting_minutes').update({action_items:m.action_items}).eq('id',minuteId); updateStats(); } catch(e){}
}

function addActionRow(text='',assignee='') {
  const form=document.getElementById('actionItemsForm');
  const row=document.createElement('div'); row.className='action-item-row';
  row.innerHTML=`
    <input class="ai-text" type="text" placeholder="Action item…" value="${esc(text)}"
      style="padding:.6rem .875rem;border:1.5px solid var(--border);border-radius:8px;font-family:var(--font-body);font-size:.88rem;background:var(--cream);outline:none;flex:1;">
    <input class="ai-assign" type="text" placeholder="Assignee" value="${esc(assignee)}"
      style="padding:.6rem .875rem;border:1.5px solid var(--border);border-radius:8px;font-family:var(--font-body);font-size:.88rem;background:var(--cream);outline:none;width:130px;">
    <button class="remove-action-btn" type="button" onclick="this.closest('.action-item-row').remove()">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
    </button>`;
  form.appendChild(row);
}

function exportCSV() {
  const rows=[['Title','Date','Type','Venue','Chaired By','Attendees','Recorded By','Next Meeting']];
  allMinutes.forEach(m=>rows.push([m.title,m.date,m.type,m.venue||'',m.chaired_by||'',(m.attendees||[]).join('; '),m.recorded_by||'',m.next_meeting_date||'']));
  const csv=rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const a=document.createElement('a');
  a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);
  a.download=`minutes_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
}

function openModal(id){document.getElementById(id).classList.add('active');document.body.style.overflow='hidden';}
function closeModal(id){document.getElementById(id).classList.remove('active');document.body.style.overflow='';}

async function initSecretary() {
  document.querySelectorAll('.current-year').forEach(el=>el.textContent=new Date().getFullYear());

  await loadMinutes();
  await loadOfficers();

  // Admin bar — show/hide based on role
  const adminBar=document.getElementById('adminBar');
  if (adminBar) adminBar.style.display=window.isAdmin?'flex':'none';

  // Replace admin login button with sign-in redirect
  const loginBtn=document.getElementById('adminLoginBtn');
  if (loginBtn) {
    if (window.isAdmin) { loginBtn.style.display='none'; }
    else { loginBtn.addEventListener('click',()=>window.location.href='auth.html'); }
  }

  document.getElementById('adminAddBtn')?.addEventListener('click', openAdd);
  document.getElementById('adminLogoutBtn')?.addEventListener('click', async()=>{
    await supabaseClient.auth.signOut(); window.location.href='auth.html';
  });
  document.getElementById('minutesSearch')?.addEventListener('input', ()=>renderMinutes());
  document.getElementById('filterChips')?.addEventListener('click', e=>{
    const chip=e.target.closest('.filter-chip'); if(!chip) return;
    document.querySelectorAll('.filter-chip').forEach(c=>c.classList.remove('active'));
    chip.classList.add('active'); activeFilter=chip.dataset.filter; renderMinutes();
  });
  document.getElementById('minutesModalClose')?.addEventListener('click',()=>closeModal('minutesModal'));
  document.getElementById('minutesFormCancel')?.addEventListener('click',()=>closeModal('minutesModal'));
  document.getElementById('minutesFormSave')?.addEventListener('click',saveMinutes);
  document.getElementById('addActionBtn')?.addEventListener('click',()=>addActionRow());
  document.getElementById('exportBtn')?.addEventListener('click',exportCSV);
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal('minutesModal');});
}

document.addEventListener('adminReady', initSecretary);