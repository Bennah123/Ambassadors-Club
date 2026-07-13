// ============================================================
//  MEMBERS.JS — SDA Ambassadors Club
//  Read-only for public. Admin features via shared-auth.js
// ============================================================

const STORAGE_KEY = 'sda_members_data';
const deptLabels  = { choir:'Choir', ushering:'Ushering', treasury:'Treasury', welfare:'Welfare', media:'Media' };
let membersData   = [];
let activeFilter  = 'all';

function escHtml(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function getInitials(f,l) { return (((f||'')[0]||'')+((l||'')[0]||'')).toUpperCase()||'?'; }
function debounce(fn,ms) { let t; return (...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms);}; }

function fromRow(m) {
  return {
    id:m.id, firstName:m.first_name||'', lastName:m.last_name||'',
    role:m.role||'Member', departments:m.departments||[],
    joined:m.joined_year||'', gift:m.gift||'', phone:m.phone||'',
    email:m.email||'', bio:m.bio||'', avatarUrl:m.avatar_url||null
  };
}

async function loadMembers() {
  const grid=document.getElementById('membersGrid');
  if (grid) grid.innerHTML='<div class="members-loading"><div class="spinner"></div><p>Loading members…</p></div>';
  if (typeof supabaseClient !== 'undefined') {
    try {
      const {data,error}=await supabaseClient.from('members').select('*').order('first_name',{ascending:true});
      if (error) throw error;
      membersData=(data||[]).map(fromRow);
      localStorage.setItem(STORAGE_KEY,JSON.stringify(membersData));
      renderMembers(); return;
    } catch(err) { console.warn('Load failed:',err.message); }
  }
  try {
    const cached=localStorage.getItem(STORAGE_KEY);
    if (cached) { membersData=JSON.parse(cached); renderMembers(); return; }
  } catch (error) { console.warn('Load failed:', error.message); }
  membersData=[]; renderMembers();
}

function getFiltered() {
  const q=(document.getElementById('memberSearch')?.value||'').toLowerCase().trim();
  return membersData.filter(m=>{
    const mf=activeFilter==='all'||(m.departments||[]).includes(activeFilter);
    const ms=!q||m.firstName.toLowerCase().includes(q)||m.lastName.toLowerCase().includes(q)
      ||(m.role||'').toLowerCase().includes(q)||(m.gift||'').toLowerCase().includes(q)
      ||(m.departments||[]).some(d=>d.includes(q));
    return mf&&ms;
  });
}

function renderMembers() {
  const grid=document.getElementById('membersGrid');
  const noRes=document.getElementById('noResults');
  if (!grid) return;
  const filtered=getFiltered();
  if (!filtered.length) { grid.innerHTML=''; if(noRes) noRes.style.display='block'; return; }
  if (noRes) noRes.style.display='none';
  grid.innerHTML=filtered.map(m=>{
    const initials=getInitials(m.firstName,m.lastName);
    const avatarHtml=m.avatarUrl
      ?`<div class="member-avatar"><img src="${escHtml(m.avatarUrl)}" alt="${escHtml(m.firstName)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="member-avatar-initials" style="display:none;">${initials}</div></div>`
      :`<div class="member-avatar"><div class="member-avatar-initials">${initials}</div></div>`;
    const deptTags=(m.departments||[]).map(d=>`<span class="dept-tag">${escHtml(deptLabels[d]||d)}</span>`).join('');
    const adminBtns=globalThis.isAdmin?`<div class="admin-card-actions" onclick="event.stopPropagation()">
      <button class="admin-card-btn" onclick="_openEditMember(${m.id})" title="Edit">✏️</button>
      <button class="admin-card-btn" onclick="_deleteMember(${m.id})" title="Delete">🗑️</button>
    </div>`:'';
    return `
      <div class="member-card" onclick="_openMemberModal(${m.id})">
        ${adminBtns}
        <div class="member-card-inner">
          ${avatarHtml}
          <div class="member-name">${escHtml(m.firstName)} ${escHtml(m.lastName)}</div>
          <div class="member-role">${escHtml(m.role)}</div>
          ${deptTags?`<div class="member-depts">${deptTags}</div>`:''}
          ${m.joined?`<div class="member-joined">${escHtml(String(m.joined))}</div>`:''}
        </div>
      </div>`;
  }).join('');
}

function _openMemberModal(id) {
  const m=membersData.find(x=>x.id===id); if(!m) return;
  const initials=getInitials(m.firstName,m.lastName);
  const avatarHtml=m.avatarUrl
    ?`<div class="modal-member-avatar"><img src="${escHtml(m.avatarUrl)}" alt="${escHtml(m.firstName)}"></div>`
    :`<div class="modal-member-avatar-initials">${initials}</div>`;
  const deptTags=(m.departments||[]).map(d=>`<span class="dept-tag">${escHtml(deptLabels[d]||d)}</span>`).join('');
  document.getElementById('modalBody').innerHTML=`
    <div style="display:flex;align-items:center;gap:1.25rem;margin-bottom:1.5rem;">
      ${avatarHtml}
      <div>
        <h3 style="font-family:var(--font-display);font-size:1.4rem;color:var(--navy);margin-bottom:0.15rem;">${escHtml(m.firstName)} ${escHtml(m.lastName)}</h3>
        <div class="modal-role">${escHtml(m.role)}</div>
      </div>
    </div>
    ${m.bio?`<p style="font-size:.9rem;color:var(--text-2);line-height:1.7;margin-bottom:1.25rem;">${escHtml(m.bio)}</p>`:''}
    <div style="display:flex;flex-direction:column;gap:.75rem;">
      ${deptTags?`<div style="display:flex;gap:.35rem;flex-wrap:wrap;">${deptTags}</div>`:''}
      ${m.gift   ?`<div style="font-size:.85rem;color:var(--text-2);">🎁 <strong>Gift:</strong> ${escHtml(m.gift)}</div>`:''}
      ${m.joined ?`<div style="font-size:.85rem;color:var(--text-2);">📅 <strong>Joined:</strong> ${escHtml(String(m.joined))}</div>`:''}
      ${m.phone  ?`<div style="font-size:.85rem;color:var(--text-2);">📞 <strong>Phone:</strong> ${escHtml(m.phone)}</div>`:''}
      ${m.email  ?`<div style="font-size:.85rem;color:var(--text-2);">✉️ <strong>Email:</strong> ${escHtml(m.email)}</div>`:''}
    </div>`;
  document.getElementById('memberModal').classList.add('active');
  document.body.style.overflow='hidden';
}

function closeMemberModal() { document.getElementById('memberModal')?.classList.remove('active'); document.body.style.overflow=''; }

// Admin edit/delete (only visible when globalThis.isAdmin)
function _openEditMember(id) { console.log('Edit member:', id); /* hook into your existing form if needed */ }
async function _deleteMember(id) {
  const m=membersData.find(x=>x.id===id); if(!m) return;
  if (!confirm(`Remove ${m.firstName} ${m.lastName}?`)) return;
  try {
    await supabaseClient.from('members').delete().eq('id',id);
    if ((m.departments||[]).includes('choir'))
      await supabaseClient.from('choir_members').delete().eq('first_name',m.firstName).eq('last_name',m.lastName);
    membersData=membersData.filter(x=>x.id!==id);
    localStorage.setItem(STORAGE_KEY,JSON.stringify(membersData));
    renderMembers();
  } catch(err) { alert('Delete failed: '+err.message); }
}

async function initMembers() {
  await loadMembers();
  document.getElementById('memberSearch')?.addEventListener('input', debounce(()=>renderMembers(),280));
  document.querySelectorAll('.filter-chip').forEach(chip=>{
    chip.addEventListener('click',()=>{
      document.querySelectorAll('.filter-chip').forEach(c=>c.classList.remove('active'));
      chip.classList.add('active'); activeFilter=chip.dataset.filter||'all'; renderMembers();
    });
  });
  document.getElementById('modalClose')?.addEventListener('click',closeMemberModal);
  document.getElementById('memberModalOverlay')?.addEventListener('click',closeMemberModal);
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMemberModal();});
}

document.addEventListener('adminReady', initMembers);