// ============================================================
//  MEMBERS.JS — SDA Ambassadors Club
// ============================================================

const STORAGE_KEY = 'sda_members_data';
const deptLabels  = { secretary:'Secretary', treasury:'Treasury', prayer:'Prayer', outreach:'Outreach',  uniform:'Uniform', choir:'Choir', education:'Education' };
let membersData   = [];
let activeFilter  = 'all';
let editingId     = null;

function escHtml(s) { return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
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

function sortMembers() {
  membersData.sort((a,b) =>
    a.firstName.localeCompare(b.firstName) || a.lastName.localeCompare(b.lastName));
}

async function loadMembers() {
  const grid=document.getElementById('membersGrid');
  if (grid) grid.innerHTML='<div class="members-loading"><div class="spinner"></div><p>Loading members…</p></div>';
  if (typeof supabaseClient !== 'undefined') {
    try {
      const table = globalThis.isAdmin ? 'members' : 'members_public';
      const {data,error}=await supabaseClient.from(table).select('*').order('first_name',{ascending:true});
      if (error) throw error;
      membersData=(data||[]).map(fromRow);
      sortMembers();
      // Only cache locally for admins — the 'members' table has
      // phone/email. Caching it for non-admins (or leaving an old
      // admin-session cache around) can leak PII to whoever next
      // opens this browser. Non-admins always clear any old cache.
      if (globalThis.isAdmin) {
        localStorage.setItem(STORAGE_KEY,JSON.stringify(membersData));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
      renderMembers(); return;
    } catch(err) { console.warn('Load failed:',err.message); }
  }
  // Cached fallback is only safe for admins — see above. Non-admins
  // get an empty state instead of risking a stale PII-bearing cache.
  if (globalThis.isAdmin) {
    try {
      const cached=localStorage.getItem(STORAGE_KEY);
      if (cached) { membersData=JSON.parse(cached); sortMembers(); renderMembers(); return; }
    } catch (error) { console.warn('Load failed:', error.message); }
  }
  membersData=[]; renderMembers();
}

function getFiltered() {
  const q=(document.getElementById('memberSearch')?.value||'').toLowerCase().trim();
  return membersData.filter(m=>{
    const mf = activeFilter==='all'
      || (m.departments||[]).includes(activeFilter)
      || (m.role||'').toLowerCase() === activeFilter;
    const ms = !q
      || m.firstName.toLowerCase().includes(q)
      || m.lastName.toLowerCase().includes(q)
      || `${m.firstName} ${m.lastName}`.toLowerCase().includes(q)
      || (m.role||'').toLowerCase().includes(q)
      || (m.gift||'').toLowerCase().includes(q)
      || (m.email||'').toLowerCase().includes(q)
      || (m.phone||'').toLowerCase().includes(q)
      || (m.bio||'').toLowerCase().includes(q)
      || (m.departments||[]).some(d=>(deptLabels[d]||d).toLowerCase().includes(q));
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
      <button class="admin-card-btn" data-edit="${escHtml(m.id)}" title="Edit">✏️</button>
      <button class="admin-card-btn" data-delete="${escHtml(m.id)}" title="Delete">🗑️</button>
    </div>`:'';
    return `
      <div class="member-card" data-open="${escHtml(m.id)}">
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

  grid.querySelectorAll('[data-open]').forEach(el=>el.addEventListener('click',()=>openMemberModal(el.dataset.open)));
  grid.querySelectorAll('[data-edit]').forEach(el=>el.addEventListener('click',()=>openMemberForm(el.dataset.edit)));
  grid.querySelectorAll('[data-delete]').forEach(el=>el.addEventListener('click',()=>deleteMember(el.dataset.delete)));
}

function openMemberModal(id) {
  const m=membersData.find(x=>String(x.id)===String(id)); if(!m) return;
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

// ============================================================
//  ADD / EDIT MEMBER FORM (built dynamically)
// ============================================================
function ensureMemberFormModal() {
  if (document.getElementById('memberFormModal')) return;
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.id = 'memberFormModal';
  modal.innerHTML = `
    <div class="modal-overlay" id="memberFormOverlay"></div>
    <div class="modal-content modal-lg">
      <button class="modal-close" id="memberFormClose"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
      <div class="modal-header"><h3 id="memberFormTitle">Add Member</h3><p>Fill in the member's details</p></div>
      <div class="modal-body">
        <div class="form-grid">
          <div class="form-group"><label>First Name *</label><input type="text" id="mfFirstName"></div>
          <div class="form-group"><label>Last Name *</label><input type="text" id="mfLastName"></div>
          <div class="form-group"><label>Role *</label><input type="text" id="mfRole" placeholder="e.g. Secretary, Treasurer, Member"></div>
          <div class="form-group"><label>Joined Year</label><input type="text" id="mfJoined" placeholder="e.g. 2023"></div>
          <div class="form-group"><label>Phone</label><input type="text" id="mfPhone"></div>
          <div class="form-group"><label>Email</label><input type="email" id="mfEmail"></div>
          <div class="form-group full"><label>Gift/Talent</label><input type="text" id="mfGift"></div>
          <div class="form-group full"><label>Bio</label><textarea id="mfBio" rows="3"></textarea></div>
          <div class="form-group full">
            <label>Departments</label>
            <div class="dept-check-group">
              ${Object.entries(deptLabels).map(([k,v])=>`<label class="dept-check-label"><input type="checkbox" value="${k}" class="mfDept">${v}</label>`).join('')}
            </div>
          </div>
        </div>
        <p class="form-error" id="mfError"></p>
        <div class="form-actions">
          <button class="btn btn-ghost-dark" id="mfCancel">Cancel</button>
          <button class="btn btn-gold" id="mfSave">Save Member</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(modal);
  document.getElementById('memberFormOverlay').addEventListener('click', closeMemberForm);
  document.getElementById('memberFormClose').addEventListener('click', closeMemberForm);
  document.getElementById('mfCancel').addEventListener('click', closeMemberForm);
  document.getElementById('mfSave').addEventListener('click', saveMember);
}

function openMemberForm(id = null) {
  if (!globalThis.isAdmin) return;
  ensureMemberFormModal();
  editingId = id;
  const existing = id ? membersData.find(m=>String(m.id)===String(id)) : null;

  document.getElementById('mfError').textContent = '';
  document.querySelectorAll('.mfDept').forEach(cb=>cb.checked=false);

  if (existing) {
    document.getElementById('memberFormTitle').textContent = 'Edit Member';
    document.getElementById('mfFirstName').value = existing.firstName;
    document.getElementById('mfLastName').value = existing.lastName;
    document.getElementById('mfRole').value = existing.role;
    document.getElementById('mfJoined').value = existing.joined;
    document.getElementById('mfPhone').value = existing.phone;
    document.getElementById('mfEmail').value = existing.email;
    document.getElementById('mfGift').value = existing.gift;
    document.getElementById('mfBio').value = existing.bio;
    (existing.departments||[]).forEach(d=>{
      const cb=document.querySelector(`.mfDept[value="${d}"]`); if(cb) cb.checked=true;
    });
  } else {
    document.getElementById('memberFormTitle').textContent = 'Add Member';
    ['mfFirstName','mfLastName','mfRole','mfJoined','mfPhone','mfEmail','mfGift','mfBio'].forEach(id=>document.getElementById(id).value='');
  }

  document.getElementById('memberFormModal').classList.add('active');
  document.body.style.overflow='hidden';
}

function closeMemberForm() {
  document.getElementById('memberFormModal')?.classList.remove('active');
  document.body.style.overflow='';
  editingId = null;
}

async function saveMember() {
  const firstName = document.getElementById('mfFirstName').value.trim();
  const lastName = document.getElementById('mfLastName').value.trim();
  const role = document.getElementById('mfRole').value.trim() || 'Member';
  const joined = document.getElementById('mfJoined').value.trim();
  const phone = document.getElementById('mfPhone').value.trim();
  const email = document.getElementById('mfEmail').value.trim();
  const gift = document.getElementById('mfGift').value.trim();
  const bio = document.getElementById('mfBio').value.trim();
  const departments = [...document.querySelectorAll('.mfDept:checked')].map(cb=>cb.value);
  const errEl = document.getElementById('mfError');
  const saveBtn = document.getElementById('mfSave');
  const isEdit = !!editingId;

  if (!firstName || !lastName) { errEl.textContent = 'First and last name are required.'; return; }

  errEl.textContent = '';
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving…';

  const payload = {
    first_name: firstName, last_name: lastName, role,
    joined_year: joined || null, phone: phone || null, email: email || null,
    gift: gift || null, bio: bio || null, departments
  };

  try {
    if (typeof supabaseClient !== 'undefined') {
      if (isEdit) {
        const { data: updated, error } = await supabaseClient.from('members')
          .update(payload).eq('id', editingId).select('id');
        if (error) throw error;
        if (!updated || !updated.length) throw new Error('No member updated — check permissions.');
      } else {
        const { error } = await supabaseClient.from('members').insert([payload]);
        if (error) throw error;
      }
      await loadMembers();
    } else {
      if (isEdit) {
        const idx = membersData.findIndex(m=>String(m.id)===String(editingId));
        if (idx!==-1) membersData[idx] = { ...membersData[idx], firstName, lastName, role, joined, phone, email, gift, bio, departments };
      } else {
        membersData.push({ id:'local-'+Date.now(), firstName, lastName, role, joined, phone, email, gift, bio, departments, avatarUrl:null });
      }
      sortMembers();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(membersData));
    }
    closeMemberForm();
    renderMembers();
  } catch (err) {
    errEl.textContent = err.message || 'Failed to save member.';
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save Member';
  }
}

async function deleteMember(id) {
  const m=membersData.find(x=>String(x.id)===String(id)); if(!m) return;
  if (!confirm(`Remove ${m.firstName} ${m.lastName}?`)) return;
  try {
    if (typeof supabaseClient !== 'undefined' && !String(id).startsWith('local-')) {
      const { error } = await supabaseClient.from('members').delete().eq('id',id);
      if (error) throw error;
      if ((m.departments||[]).includes('choir')) {
        await supabaseClient.from('choir_members').delete().eq('first_name',m.firstName).eq('last_name',m.lastName);
      }
    }
    membersData=membersData.filter(x=>String(x.id)!==String(id));
    localStorage.setItem(STORAGE_KEY,JSON.stringify(membersData));
    renderMembers();
  } catch(err) { alert('Delete failed: '+err.message); }
}

// ============================================================
//  INIT
// ============================================================
async function initMembers() {
  if (globalThis.__membersInited) return;
  globalThis.__membersInited = true;

  await loadMembers();

  document.getElementById('memberSearch')?.addEventListener('input', debounce(()=>renderMembers(),280));
  document.querySelectorAll('.filter-chip').forEach(chip=>{
    chip.addEventListener('click',()=>{
      document.querySelectorAll('.filter-chip').forEach(c=>c.classList.remove('active'));
      chip.classList.add('active'); activeFilter=(chip.dataset.filter||'all').toLowerCase(); renderMembers();
    });
  });
  document.getElementById('modalClose')?.addEventListener('click',closeMemberModal);
  document.getElementById('memberModalOverlay')?.addEventListener('click',closeMemberModal);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeMemberModal();closeMemberForm();}});

  if (globalThis.isAdmin) {
    let addBtn = document.getElementById('addMemberBtn');
    if (!addBtn) {
      addBtn = document.createElement('button');
      addBtn.id = 'addMemberBtn';
      addBtn.className = 'btn btn-gold';
      addBtn.textContent = '＋ Add Member';
      addBtn.style.marginLeft = 'auto';
      document.getElementById('filterTabs')?.after(addBtn);
    }
    addBtn.addEventListener('click', ()=>openMemberForm());
  }
}

document.addEventListener('adminReady', initMembers);
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => { if (!globalThis.__membersInited) initMembers(); }, 1200);
});