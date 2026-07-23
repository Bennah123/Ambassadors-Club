// ============================================================
//  GALLERY.JS — SDA Ambassadors Club
//  Public view + role-based admin upload/delete (shared-auth.js)
// ============================================================

const catLabels = { camp:'Camp Meetings', choir:'Choir', outreach:'Outreach', social:'Social', worship:'Worship' };
let galleryPhotos  = [];
let activeCat      = 'all';
let lightboxIndex  = 0;
let selectedFile   = null;

function escHtml(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function toast(msg, type='info') {
  const t = document.createElement('div');
  t.className = `toast-notification toast-${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('toast-visible'));
  setTimeout(() => { t.classList.remove('toast-visible'); setTimeout(()=>t.remove(),350); }, 3000);
}

// ============================================================
//  LOAD
// ============================================================
async function loadGallery() {
  if (typeof supabaseClient === 'undefined') { renderGallery(); return; }
  try {
    const { data, error } = await supabaseClient.from('gallery_photos')
      .select('*').order('created_at', { ascending: false });
    if (error) throw error;
    galleryPhotos = data || [];
  } catch (e) { console.warn('Gallery load failed:', e.message); galleryPhotos = []; }
  renderGallery();
}

function getFiltered() {
  return activeCat === 'all' ? galleryPhotos : galleryPhotos.filter(p => p.category === activeCat);
}

// ============================================================
//  RENDER
// ============================================================
function renderGallery() {
  const grid  = document.getElementById('galleryGrid');
  const noRes = document.getElementById('noResults');
  if (!grid) return;
  const filtered = getFiltered();

  if (!filtered.length) { grid.innerHTML = ''; if (noRes) noRes.style.display = 'block'; return; }
  if (noRes) noRes.style.display = 'none';

  grid.innerHTML = filtered.map((p, i) => `
    <div class="gallery-item" onclick="openLightbox(${i})">
      ${window.isAdmin ? `<button class="gallery-admin-delete" onclick="event.stopPropagation();deletePhoto('${p.id}')" title="Delete">🗑️</button>` : ''}
      <span class="gallery-item-cat">${escHtml(catLabels[p.category] || p.category)}</span>
      <img src="${escHtml(p.image_url)}" alt="${escHtml(p.caption||'')}" loading="lazy">
      ${p.caption ? `<div class="gallery-item-overlay"><div class="gallery-item-caption">${escHtml(p.caption)}</div></div>` : ''}
    </div>`).join('');
}

// ============================================================
//  LIGHTBOX
// ============================================================
function openLightbox(index) {
  lightboxIndex = index;
  renderLightbox();
  document.getElementById('lightbox').classList.add('active');
  document.body.style.overflow = 'hidden';
}
function closeLightbox() {
  document.getElementById('lightbox').classList.remove('active');
  document.body.style.overflow = '';
}
function renderLightbox() {
  const filtered = getFiltered();
  const p = filtered[lightboxIndex];
  if (!p) return;
  document.getElementById('lightboxImg').src = p.image_url;
  document.getElementById('lightboxCaption').textContent = p.caption || '';
  document.getElementById('lightboxCategory').textContent = catLabels[p.category] || p.category;
  document.getElementById('lightboxDate').textContent = p.created_at
    ? new Date(p.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' }) : '';
  const delBtn = document.getElementById('lightboxDelete');
  delBtn.style.display = window.isAdmin ? 'inline-block' : 'none';
  delBtn.onclick = () => deletePhoto(p.id, true);
}
function lightboxNav(dir) {
  const filtered = getFiltered();
  lightboxIndex = (lightboxIndex + dir + filtered.length) % filtered.length;
  renderLightbox();
}

// ============================================================
//  ADMIN — UPLOAD
// ============================================================
function updateAdminUI() {
  const bar = document.getElementById('galleryAdminBar');
  if (bar) bar.style.display = window.isAdmin ? 'flex' : 'none';
}

function openUploadModal() {
  selectedFile = null;
  document.getElementById('uploadCaption').value = '';
  document.getElementById('uploadCategory').value = 'camp';
  document.getElementById('uploadError').textContent = '';
  document.getElementById('uploadPreviewImg').style.display = 'none';
  document.getElementById('uploadPreviewWrap').style.display = 'block';
  document.getElementById('uploadFileInput').value = '';
  document.getElementById('uploadModal').classList.add('active');
  document.body.style.overflow = 'hidden';
}
function closeUploadModal() {
  document.getElementById('uploadModal').classList.remove('active');
  document.body.style.overflow = '';
}

function handleFileSelect(file) {
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { toast('File must be under 5MB', 'error'); return; }
  selectedFile = file;
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('uploadPreviewImg').src = e.target.result;
    document.getElementById('uploadPreviewImg').style.display = 'block';
    document.getElementById('uploadPreviewWrap').style.display = 'none';
  };
  reader.readAsDataURL(file);
}

async function submitUpload() {
  const errEl = document.getElementById('uploadError');
  const btn   = document.getElementById('uploadSubmit');
  if (!selectedFile) { errEl.textContent = 'Please select a photo.'; return; }

  const caption  = document.getElementById('uploadCaption').value.trim();
  const category = document.getElementById('uploadCategory').value;

  errEl.textContent = ''; btn.disabled = true; btn.textContent = 'Uploading…';

  try {
    const ext  = selectedFile.name.split('.').pop();
    const path = `gallery/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
    const { error: upErr } = await supabaseClient.storage.from('gallery').upload(path, selectedFile);
    if (upErr) throw upErr;
    const { data: urlData } = supabaseClient.storage.from('gallery').getPublicUrl(path);

    const { data, error } = await supabaseClient.from('gallery_photos').insert([{
      image_url: urlData.publicUrl, caption, category,
      uploaded_by: window.authUser?.id || null
    }]).select().single();
    if (error) throw error;

    galleryPhotos.unshift(data);
    closeUploadModal();
    renderGallery();
    toast('Photo uploaded ✓', 'success');
  } catch (err) {
    errEl.textContent = 'Upload failed: ' + err.message;
  } finally {
    btn.disabled = false; btn.textContent = 'Upload';
  }
}

async function deletePhoto(id, fromLightbox=false) {
  if (!confirm('Delete this photo? Cannot be undone.')) return;
  try {
    const photo = galleryPhotos.find(p => String(p.id) === String(id));
    await supabaseClient.from('gallery_photos').delete().eq('id', id);
    // best-effort storage cleanup
    if (photo?.image_url) {
      const path = photo.image_url.split('/gallery/').pop();
      if (path) await supabaseClient.storage.from('gallery').remove([`gallery/${path}`]);
    }
    galleryPhotos = galleryPhotos.filter(p => String(p.id) !== String(id));
    // Keep lightboxIndex in range now that the list is one shorter,
    // in case anything reopens the lightbox without a fresh index.
    const filteredLen = getFiltered().length;
    if (lightboxIndex >= filteredLen) lightboxIndex = Math.max(0, filteredLen - 1);
    renderGallery();
    if (fromLightbox) closeLightbox();
    toast('Photo deleted', 'info');
  } catch (err) { toast('Delete failed: ' + err.message, 'error'); }
}

// ============================================================
//  INIT
// ============================================================
async function initGallery() {
  await loadGallery();
  updateAdminUI();

  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeCat = chip.dataset.cat;
      renderGallery();
    });
  });

  document.getElementById('lightboxClose')?.addEventListener('click', closeLightbox);
  document.getElementById('lightboxOverlay')?.addEventListener('click', closeLightbox);
  document.getElementById('lightboxPrev')?.addEventListener('click', () => lightboxNav(-1));
  document.getElementById('lightboxNext')?.addEventListener('click', () => lightboxNav(1));

  document.getElementById('uploadPhotoBtn')?.addEventListener('click', openUploadModal);
  document.getElementById('uploadModalClose')?.addEventListener('click', closeUploadModal);
  document.getElementById('uploadOverlay')?.addEventListener('click', closeUploadModal);
  document.getElementById('uploadCancel')?.addEventListener('click', closeUploadModal);
  document.getElementById('uploadSubmit')?.addEventListener('click', submitUpload);
  document.getElementById('uploadDropZone')?.addEventListener('click', () => document.getElementById('uploadFileInput').click());
  document.getElementById('uploadFileInput')?.addEventListener('change', function() { handleFileSelect(this.files[0]); });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeLightbox(); closeUploadModal(); }
    if (document.getElementById('lightbox').classList.contains('active')) {
      if (e.key === 'ArrowLeft')  lightboxNav(-1);
      if (e.key === 'ArrowRight') lightboxNav(1);
    }
  });
}

document.addEventListener('adminReady', initGallery);