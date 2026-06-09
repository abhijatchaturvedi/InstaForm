'use strict';

// storage.js is loaded before this script
const $ = (id) => document.getElementById(id);

// ── State ────────────────────────────────────────────────────────────────────
let _profiles = [];
let _activeId = '';

// ── Helpers ──────────────────────────────────────────────────────────────────
function esc(v)     { return (v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;'); }
function escAttr(v) { return (v ?? '').replace(/"/g,'&quot;'); }

function showToast(msg, ok = true) {
  const existing = document.querySelector('.import-toast');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.className = 'import-toast';
  el.style.background = ok ? 'var(--success)' : 'var(--danger)';
  el.style.color = '#fff';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; }, 2500);
  setTimeout(() => el.remove(), 2900);
}

// ── Profile selector dropdown ─────────────────────────────────────────────────

function renderPsDropdown() {
  const list = $('ps-list');
  list.innerHTML = '';

  _profiles.forEach(p => {
    const item = document.createElement('div');
    item.className = 'ps-item' + (p.id === _activeId ? ' active' : '');
    item.dataset.id = p.id;

    item.innerHTML = `
      <div class="ps-item-dot"></div>
      <span class="ps-item-name" title="${escAttr(p.name)}">${esc(p.name)}</span>
      <input class="ps-rename-input" type="text" value="${escAttr(p.name)}" maxlength="40" />
      <div class="ps-item-actions">
        <button class="ps-icon-btn rename-btn" title="Rename" data-id="${escAttr(p.id)}">
          <svg viewBox="0 0 14 14" fill="none" width="12" height="12">
            <path d="M9.5 2.5l2 2M2 12l.5-2.5L10.5 1.5a1.4 1.4 0 0 1 2 2l-8 8L2 12Z" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <button class="ps-icon-btn danger delete-btn" title="Delete" data-id="${escAttr(p.id)}">
          <svg viewBox="0 0 14 14" fill="none" width="12" height="12">
            <path d="M2 3.5h10M5.5 3.5V2.5a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1M5.5 6v4M8.5 6v4M3 3.5l.7 8a1 1 0 0 0 1 .9h4.6a1 1 0 0 0 1-.9l.7-8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>`;

    // Switch profile on click (not on action buttons)
    item.addEventListener('click', (e) => {
      if (e.target.closest('.ps-item-actions') || item.classList.contains('renaming')) return;
      if (p.id === _activeId) { closePsDropdown(); return; }
      switchToProfile(p.id);
    });

    // Rename: start
    item.querySelector('.rename-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      const input = item.querySelector('.ps-rename-input');
      item.classList.add('renaming');
      input.focus();
      input.select();
    });

    // Rename: commit on Enter or blur
    const renameInput = item.querySelector('.ps-rename-input');
    const commitRename = async () => {
      const name = renameInput.value.trim() || p.name;
      item.classList.remove('renaming');
      if (name === p.name) return;
      p.name = name;
      await saveAllProfiles(_profiles, _activeId);
      if (p.id === _activeId) $('ps-active-name').textContent = name;
      renderPsDropdown();
    };
    renameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); commitRename(); }
      if (e.key === 'Escape') { item.classList.remove('renaming'); renameInput.value = p.name; }
    });
    renameInput.addEventListener('blur', commitRename);
    renameInput.addEventListener('click', e => e.stopPropagation());

    // Delete
    item.querySelector('.delete-btn').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (_profiles.length <= 1) { showToast('Cannot delete the last profile.', false); return; }
      const wasActive = p.id === _activeId;
      _profiles = _profiles.filter(x => x.id !== p.id);
      if (wasActive) _activeId = _profiles[0].id;
      await saveAllProfiles(_profiles, _activeId);
      renderPsDropdown();
      $('ps-active-name').textContent = _profiles.find(x => x.id === _activeId)?.name ?? '';
      if (wasActive) loadProfileIntoForm(getActiveProfileData());
    });

    list.appendChild(item);
  });
}

function openPsDropdown() {
  $('ps-dropdown').classList.remove('hidden');
  $('ps-wrap').classList.add('open');
}

function closePsDropdown() {
  $('ps-dropdown').classList.add('hidden');
  $('ps-wrap').classList.remove('open');
  $('ps-new-form').classList.add('hidden');
  $('ps-new-btn').classList.remove('hidden');
  $('ps-new-input').value = '';
}

$('ps-trigger').addEventListener('click', (e) => {
  e.stopPropagation();
  $('ps-dropdown').classList.contains('hidden') ? openPsDropdown() : closePsDropdown();
});

document.addEventListener('click', (e) => {
  if (!$('ps-wrap').contains(e.target)) closePsDropdown();
});

$('ps-dropdown').addEventListener('click', e => e.stopPropagation());

// New profile inline form
$('ps-new-btn').addEventListener('click', () => {
  $('ps-new-btn').classList.add('hidden');
  $('ps-new-form').classList.remove('hidden');
  $('ps-new-input').focus();
});

$('ps-new-cancel').addEventListener('click', () => {
  $('ps-new-form').classList.add('hidden');
  $('ps-new-btn').classList.remove('hidden');
  $('ps-new-input').value = '';
});

async function createNewProfile() {
  const name = $('ps-new-input').value.trim() || 'New Profile';
  const p = newProfile(name);       // from storage.js
  _profiles.push(p);
  await saveAllProfiles(_profiles, _activeId);
  closePsDropdown();
  renderPsDropdown();
  switchToProfile(p.id);
}

$('ps-new-create').addEventListener('click', createNewProfile);
$('ps-new-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); createNewProfile(); }
  if (e.key === 'Escape') { $('ps-new-cancel').click(); }
});

// ── Switch active profile ──────────────────────────────────────────────────

function getActiveProfileData() {
  return _profiles.find(p => p.id === _activeId) ?? _profiles[0];
}

async function switchToProfile(id) {
  // Save current form data into the currently active profile first
  const cur = getActiveProfileData();
  if (cur) readFormIntoProfile(cur);

  _activeId = id;
  await saveAllProfiles(_profiles, _activeId);
  $('ps-active-name').textContent = _profiles.find(p => p.id === id)?.name ?? '';
  renderPsDropdown();
  closePsDropdown();
  loadProfileIntoForm(getActiveProfileData());
}

// ── Form ↔ Profile data mapping ──────────────────────────────────────────────

const PERSONAL_FIELDS = [
  'firstName','lastName','fullName','email','phone','dob','gender','nationality',
];
const ADDRESS_FIELDS = ['street','city','state','zip','country'];
const MEDIA_FIELDS   = ['linkedin','github','twitter','portfolio'];

function loadProfileIntoForm(profile) {
  if (!profile) return;
  const p  = profile.personal  ?? {};
  const a  = p.address          ?? {};
  const m  = profile.media      ?? {};
  const pr = profile.professional ?? [];
  const ac = profile.academic    ?? [];

  PERSONAL_FIELDS.forEach(k => {
    const el = $(`p-${k}`);
    if (el) el.value = p[k] ?? '';
  });
  ADDRESS_FIELDS.forEach(k => {
    const el = $(`p-${k}`);
    if (el) el.value = a[k] ?? '';
  });
  MEDIA_FIELDS.forEach(k => {
    const el = $(`m-${k}`);
    if (el) el.value = m[k] ?? '';
  });
  loadImagePreview('photo', m.photo);
  loadImagePreview('sig',   m.signature);
  renderEntries('pro', pr);
  renderEntries('edu', ac);
}

function readFormIntoProfile(profile) {
  const p = profile.personal  ??= {};
  const a = p.address         ??= {};
  const m = profile.media     ??= {};

  PERSONAL_FIELDS.forEach(k => {
    const el = $(`p-${k}`);
    if (el) p[k] = el.value;
  });
  ADDRESS_FIELDS.forEach(k => {
    const el = $(`p-${k}`);
    if (el) a[k] = el.value;
  });
  MEDIA_FIELDS.forEach(k => {
    const el = $(`m-${k}`);
    if (el) m[k] = el.value;
  });
  profile.professional = readEntries('pro');
  profile.academic     = readEntries('edu');
}

// ── Dynamic entry cards ────────────────────────────────────────────────────

function renderEntries(type, entries) {
  const container = $(`${type}-entries`);
  container.innerHTML = '';
  (entries ?? []).forEach((entry, i) => addEntryCard(type, i, entry));
}

function addEntryCard(type, index, data = {}) {
  const container = $(`${type}-entries`);
  const card = document.createElement('div');
  card.className = 'entry-card';
  card.dataset.index = index;

  const label = type === 'pro' ? `Job ${index + 1}` : `Degree ${index + 1}`;

  if (type === 'pro') {
    card.innerHTML = `
      <div class="entry-header">
        <span class="entry-label">${label}</span>
        <button class="btn btn-danger-ghost btn-sm remove-entry-btn">Remove</button>
      </div>
      <div class="form-row">
        <div class="field"><label>Company</label>
          <input type="text" data-key="company" placeholder="Acme Corp" value="${escAttr(data.company ?? '')}" /></div>
        <div class="field"><label>Job Title</label>
          <input type="text" data-key="title" placeholder="Software Engineer" value="${escAttr(data.title ?? '')}" /></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Start Date</label>
          <input type="month" data-key="startDate" value="${escAttr(data.startDate ?? '')}" /></div>
        <div class="field"><label>End Date</label>
          <input type="month" data-key="endDate" value="${escAttr(data.endDate ?? '')}" /></div>
      </div>
      <div class="current-row">
        <input type="checkbox" data-key="current" id="pro-cur-${index}" ${data.current ? 'checked' : ''} />
        <label for="pro-cur-${index}">Currently working here</label>
      </div>
      <div class="field" style="margin-top:12px"><label>Description</label>
        <textarea data-key="description" rows="3" placeholder="Brief summary…">${esc(data.description ?? '')}</textarea></div>`;
  } else {
    card.innerHTML = `
      <div class="entry-header">
        <span class="entry-label">${label}</span>
        <button class="btn btn-danger-ghost btn-sm remove-entry-btn">Remove</button>
      </div>
      <div class="form-row">
        <div class="field"><label>Institution</label>
          <input type="text" data-key="institution" placeholder="MIT" value="${escAttr(data.institution ?? '')}" /></div>
        <div class="field"><label>Degree</label>
          <input type="text" data-key="degree" placeholder="B.Sc. Computer Science" value="${escAttr(data.degree ?? '')}" /></div>
      </div>
      <div class="form-row form-row-3">
        <div class="field"><label>Field of Study</label>
          <input type="text" data-key="field" placeholder="Computer Science" value="${escAttr(data.field ?? '')}" /></div>
        <div class="field"><label>Graduation Year</label>
          <input type="number" data-key="endYear" min="1950" max="2099" placeholder="2024" value="${escAttr(data.endYear ?? '')}" /></div>
        <div class="field"><label>GPA / %</label>
          <input type="text" data-key="gpa" placeholder="3.9" value="${escAttr(data.gpa ?? '')}" /></div>
      </div>`;
  }

  card.querySelector('.remove-entry-btn').addEventListener('click', () => {
    card.remove();
    renumberEntries(type);
  });

  container.appendChild(card);
}

function renumberEntries(type) {
  const cards = $(`${type}-entries`).querySelectorAll('.entry-card');
  cards.forEach((c, i) => {
    c.dataset.index = i;
    const lbl = c.querySelector('.entry-label');
    if (lbl) lbl.textContent = type === 'pro' ? `Job ${i + 1}` : `Degree ${i + 1}`;
  });
}

function readEntries(type) {
  const cards = $(`${type}-entries`).querySelectorAll('.entry-card');
  return Array.from(cards).map(card => {
    const entry = {};
    card.querySelectorAll('[data-key]').forEach(el => {
      const k = el.dataset.key;
      entry[k] = el.type === 'checkbox' ? el.checked : el.value;
    });
    return entry;
  });
}

document.querySelectorAll('.add-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const type  = btn.dataset.type;
    const count = $(`${type}-entries`).querySelectorAll('.entry-card').length;
    addEntryCard(type, count);
  });
});

// ── Image upload helpers ──────────────────────────────────────────────────────

function loadImagePreview(key, base64) {
  const preview     = $(`${key}-preview`);
  const placeholder = $(`${key}-placeholder`);
  const clearBtn    = $(`${key}-clear`);
  if (!preview) return;
  if (base64) {
    preview.src = base64;
    preview.classList.remove('hidden');
    placeholder.classList.add('hidden');
    clearBtn.classList.remove('hidden');
  } else {
    preview.src = '';
    preview.classList.add('hidden');
    placeholder.classList.remove('hidden');
    clearBtn.classList.add('hidden');
  }
}

function handleImageFile(key, file) {
  if (!file || !file.type.startsWith('image/')) return;
  if (file.size > 2 * 1024 * 1024) { showToast('Image must be under 2 MB.', false); return; }
  const reader = new FileReader();
  reader.onload = (e) => {
    const b64 = e.target.result;
    loadImagePreview(key, b64);
    const p = getActiveProfileData();
    if (p) {
      p.media ??= {};
      if (key === 'photo') p.media.photo = b64;
      else p.media.signature = b64;
    }
  };
  reader.readAsDataURL(file);
}

['photo', 'sig'].forEach(key => {
  const fileInput = $(`m-${key}-file`);
  const drop      = $(`${key}-drop`);
  const clearBtn  = $(`${key}-clear`);

  fileInput.addEventListener('change', () => handleImageFile(key, fileInput.files[0]));

  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('drag-over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('drag-over'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('drag-over');
    handleImageFile(key, e.dataTransfer.files[0]);
  });

  clearBtn.addEventListener('click', (e) => {
    e.preventDefault();
    loadImagePreview(key, null);
    fileInput.value = '';
    const p = getActiveProfileData();
    if (p) {
      p.media ??= {};
      if (key === 'photo') delete p.media.photo;
      else delete p.media.signature;
    }
  });
});

// ── Save ──────────────────────────────────────────────────────────────────────

$('save-btn').addEventListener('click', async () => {
  const profile = getActiveProfileData();
  if (!profile) return;
  readFormIntoProfile(profile);
  if (!profile.personal.fullName && profile.personal.firstName) {
    profile.personal.fullName = [profile.personal.firstName, profile.personal.lastName]
      .filter(Boolean).join(' ');
  }
  await saveAllProfiles(_profiles, _activeId);
  const status = $('save-status');
  status.textContent = 'Saved';
  status.classList.add('visible');
  setTimeout(() => status.classList.remove('visible'), 2000);
});

// ── Export / Import ───────────────────────────────────────────────────────────

$('export-btn').addEventListener('click', () => {
  const profile = getActiveProfileData();
  if (!profile) return;
  const payload = {
    version: '2.0.0',
    exportedAt: new Date().toISOString(),
    profile,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `instaform_${(profile.name ?? 'profile').replace(/[^a-z0-9]/gi,'_').toLowerCase()}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

$('import-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);

    let imported = null;

    if (data.version === '2.0.0' && data.profile) {
      imported = data.profile;
    } else if (data.version === '1.0.0' && data.profile) {
      imported = { id: generateId(), name: 'Imported Profile', ...data.profile };
    } else if (data.personal || data.professional) {
      imported = { id: generateId(), name: 'Imported Profile', ...data };
    }

    if (!imported) throw new Error('Unrecognised format');
    if (!imported.id) imported.id = generateId();

    const existing = _profiles.find(p => p.id === imported.id);
    if (existing) {
      Object.assign(existing, imported);
      await saveAllProfiles(_profiles, _activeId);
      loadProfileIntoForm(getActiveProfileData());
      showToast('Profile updated from import.');
    } else {
      _profiles.push(imported);
      _activeId = imported.id;
      await saveAllProfiles(_profiles, _activeId);
      renderPsDropdown();
      $('ps-active-name').textContent = imported.name;
      loadProfileIntoForm(imported);
      showToast(`Imported "${imported.name}".`);
    }
  } catch (err) {
    showToast('Import failed: ' + err.message, false);
  }
  e.target.value = '';
});

// ── Sidebar scroll-spy ────────────────────────────────────────────────────────

const sections = document.querySelectorAll('.section');
const navItems = document.querySelectorAll('.nav-item');

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      navItems.forEach(n => n.classList.toggle('active', n.dataset.target === entry.target.id));
    });
  },
  { threshold: 0.25 }
);

sections.forEach(s => observer.observe(s));

navItems.forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById(item.dataset.target)?.scrollIntoView({ behavior: 'smooth' });
  });
});

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
  const result = await loadAllProfiles();   // from storage.js
  _profiles    = result.profiles;
  _activeId    = result.activeProfileId;

  $('ps-active-name').textContent = _profiles.find(p => p.id === _activeId)?.name ?? 'My Profile';
  renderPsDropdown();
  loadProfileIntoForm(getActiveProfileData());

  // If opened with ?new=1, surface the new-profile form immediately
  const params = new URLSearchParams(window.location.search);
  if (params.get('new') === '1') {
    openPsDropdown();
    $('ps-new-btn').classList.add('hidden');
    $('ps-new-form').classList.remove('hidden');
    $('ps-new-input').focus();
  }
}

init();
