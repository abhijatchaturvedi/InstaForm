'use strict';

// ── Helpers ───────────────────────────────────────────────────────────────

const $ = (id) => document.getElementById(id);
const val = (id) => $(id)?.value.trim() ?? '';

function setStatus(msg, ok = true) {
  const el = $('save-status');
  el.textContent = msg;
  el.style.color = ok ? 'var(--success)' : 'var(--warn)';
  el.style.opacity = '1';
  setTimeout(() => { el.style.opacity = '0'; }, 2500);
}

// ── Tab switching ─────────────────────────────────────────────────────────

document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    $(`tab-${btn.dataset.tab}`).classList.add('active');
  });
});

// ── Dynamic entry cards ───────────────────────────────────────────────────

function makeProfCard(data = {}, index) {
  const card = document.createElement('div');
  card.className = 'entry-card';
  card.dataset.index = index;

  const endDateDisabled = data.current ? 'disabled' : '';
  card.innerHTML = `
    <div class="entry-header">
      <span class="entry-label">Job ${index + 1}</span>
      <button class="remove-btn" title="Remove">×</button>
    </div>
    <div class="form-row">
      <div class="field"><label>Company</label>
        <input type="text" data-field="company" value="${esc(data.company)}" placeholder="Acme Corp" /></div>
      <div class="field"><label>Job Title</label>
        <input type="text" data-field="title" value="${esc(data.title)}" placeholder="Software Engineer" /></div>
    </div>
    <div class="form-row">
      <div class="field"><label>Start Date</label>
        <input type="month" data-field="startDate" value="${esc(data.startDate)}" /></div>
      <div class="field"><label>End Date</label>
        <input type="month" data-field="endDate" value="${esc(data.endDate)}" ${endDateDisabled} /></div>
    </div>
    <div class="current-row">
      <input type="checkbox" id="cur-${index}" data-field="current" ${data.current ? 'checked' : ''} />
      <label for="cur-${index}">Currently working here</label>
    </div>`;

  card.querySelector('.remove-btn').addEventListener('click', () => {
    card.remove();
    reindexCards('pro-entries', 'Job');
  });

  const curChk = card.querySelector('[data-field=current]');
  const endInput = card.querySelector('[data-field=endDate]');
  curChk.addEventListener('change', () => {
    endInput.disabled = curChk.checked;
    if (curChk.checked) endInput.value = '';
  });

  return card;
}

function makeEduCard(data = {}, index) {
  const card = document.createElement('div');
  card.className = 'entry-card';
  card.dataset.index = index;
  card.innerHTML = `
    <div class="entry-header">
      <span class="entry-label">Degree ${index + 1}</span>
      <button class="remove-btn" title="Remove">×</button>
    </div>
    <div class="field"><label>Institution</label>
      <input type="text" data-field="institution" value="${esc(data.institution)}" placeholder="MIT" /></div>
    <div class="form-row">
      <div class="field"><label>Degree</label>
        <input type="text" data-field="degree" value="${esc(data.degree)}" placeholder="B.S. Computer Science" /></div>
      <div class="field"><label>Field of Study</label>
        <input type="text" data-field="field" value="${esc(data.field)}" placeholder="Computer Science" /></div>
    </div>
    <div class="form-row">
      <div class="field"><label>Start Year</label>
        <input type="number" data-field="startYear" value="${esc(data.startYear)}" placeholder="2018" min="1950" max="2040" /></div>
      <div class="field"><label>End Year</label>
        <input type="number" data-field="endYear" value="${esc(data.endYear)}" placeholder="2022" min="1950" max="2040" /></div>
    </div>
    <div class="field"><label>GPA / Grade</label>
      <input type="text" data-field="gpa" value="${esc(data.gpa)}" placeholder="3.8 / 4.0" /></div>`;

  card.querySelector('.remove-btn').addEventListener('click', () => {
    card.remove();
    reindexCards('edu-entries', 'Degree');
  });

  return card;
}

function esc(v) {
  return (v ?? '').toString().replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function reindexCards(containerId, label) {
  $$(containerId, '.entry-card').forEach((card, i) => {
    card.dataset.index = i;
    card.querySelector('.entry-label').textContent = `${label} ${i + 1}`;
  });
}

function $$(parentId, sel) {
  return Array.from($(parentId).querySelectorAll(sel));
}

function collectEntries(containerId, fields) {
  return $$(`${containerId}`, '.entry-card').map(card => {
    const obj = {};
    fields.forEach(f => {
      const el = card.querySelector(`[data-field="${f}"]`);
      if (!el) return;
      obj[f] = el.type === 'checkbox' ? el.checked : el.value.trim();
    });
    return obj;
  });
}

// ── Add-entry buttons ─────────────────────────────────────────────────────

document.querySelectorAll('.add-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.dataset.type === 'pro') {
      const index = $$('pro-entries', '.entry-card').length;
      $('pro-entries').appendChild(makeProfCard({}, index));
    } else {
      const index = $$('edu-entries', '.entry-card').length;
      $('edu-entries').appendChild(makeEduCard({}, index));
    }
  });
});

// ── Image upload helpers ──────────────────────────────────────────────────

function setupImageUpload({ fileInputId, previewId, placeholderId, clearBtnId }) {
  const fileInput  = $(fileInputId);
  const preview    = $(previewId);
  const placeholder = $(placeholderId);
  const clearBtn   = $(clearBtnId);

  let storedBase64 = '';

  function showPreview(src) {
    preview.src = src;
    preview.classList.remove('hidden');
    placeholder.classList.add('hidden');
    clearBtn.style.display = 'inline-flex';
    storedBase64 = src;
  }

  function clearPreview() {
    preview.src = '';
    preview.classList.add('hidden');
    placeholder.classList.remove('hidden');
    clearBtn.style.display = 'none';
    fileInput.value = '';
    storedBase64 = '';
  }

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => showPreview(e.target.result);
    reader.readAsDataURL(file);
  });

  clearBtn.addEventListener('click', () => clearPreview());

  return {
    load: (src) => { if (src) showPreview(src); else clearPreview(); },
    get:  () => storedBase64,
  };
}

const photoCtrl = setupImageUpload({
  fileInputId: 'm-photo-file',
  previewId:   'photo-preview',
  placeholderId: 'photo-placeholder',
  clearBtnId:  'photo-clear',
});

const sigCtrl = setupImageUpload({
  fileInputId: 'm-sig-file',
  previewId:   'sig-preview',
  placeholderId: 'sig-placeholder',
  clearBtnId:  'sig-clear',
});

// ── Profile load ──────────────────────────────────────────────────────────

async function loadProfile() {
  const { profile } = await chrome.storage.local.get('profile');
  if (!profile) return;

  const p = profile.personal ?? {};
  const addr = p.address ?? {};

  [
    ['p-firstName', p.firstName],
    ['p-lastName',  p.lastName],
    ['p-fullName',  p.fullName],
    ['p-email',     p.email],
    ['p-phone',     p.phone],
    ['p-dob',       p.dob],
    ['p-gender',    p.gender],
    ['p-nationality', p.nationality],
    ['p-street',    addr.street],
    ['p-city',      addr.city],
    ['p-state',     addr.state],
    ['p-zip',       addr.zip],
    ['p-country',   addr.country],
  ].forEach(([id, val]) => { if ($(id) && val != null) $(id).value = val; });

  // Professional entries
  const proContainer = $('pro-entries');
  proContainer.innerHTML = '';
  (profile.professional ?? []).forEach((entry, i) => {
    proContainer.appendChild(makeProfCard(entry, i));
  });
  if ((profile.professional ?? []).length === 0) {
    proContainer.appendChild(makeProfCard({}, 0));
  }

  // Academic entries
  const eduContainer = $('edu-entries');
  eduContainer.innerHTML = '';
  (profile.academic ?? []).forEach((entry, i) => {
    eduContainer.appendChild(makeEduCard(entry, i));
  });
  if ((profile.academic ?? []).length === 0) {
    eduContainer.appendChild(makeEduCard({}, 0));
  }

  // Media
  const m = profile.media ?? {};
  [
    ['m-linkedin',  m.linkedin],
    ['m-github',    m.github],
    ['m-twitter',   m.twitter],
    ['m-portfolio', m.portfolio],
  ].forEach(([id, val]) => { if ($(id) && val != null) $(id).value = val; });

  photoCtrl.load(m.photo);
  sigCtrl.load(m.signature);
}

// ── Profile save ──────────────────────────────────────────────────────────

async function saveProfile() {
  const proEntries = collectEntries('pro-entries', ['company','title','startDate','endDate','current']);
  const eduEntries = collectEntries('edu-entries', ['institution','degree','field','startYear','endYear','gpa']);

  // Auto-compute fullName if empty
  let fullName = val('p-fullName');
  if (!fullName) {
    const first = val('p-firstName');
    const last  = val('p-lastName');
    if (first || last) fullName = [first, last].filter(Boolean).join(' ');
  }

  const profile = {
    personal: {
      firstName:   val('p-firstName'),
      lastName:    val('p-lastName'),
      fullName,
      email:       val('p-email'),
      phone:       val('p-phone'),
      dob:         val('p-dob'),
      gender:      val('p-gender'),
      nationality: val('p-nationality'),
      address: {
        street:  val('p-street'),
        city:    val('p-city'),
        state:   val('p-state'),
        zip:     val('p-zip'),
        country: val('p-country'),
      },
    },
    professional: proEntries,
    academic:     eduEntries,
    media: {
      linkedin:  val('m-linkedin'),
      github:    val('m-github'),
      twitter:   val('m-twitter'),
      portfolio: val('m-portfolio'),
      photo:     photoCtrl.get(),
      signature: sigCtrl.get(),
    },
  };

  await chrome.storage.local.set({ profile });
  setStatus('Saved ✓');
}

$('save-btn').addEventListener('click', saveProfile);

// ── Fill current page ─────────────────────────────────────────────────────

$('fill-btn').addEventListener('click', async () => {
  // Save first so the content script always uses the latest data
  await saveProfile();

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js'],
    });
  } catch (err) {
    console.error('InstaForm: inject failed', err);
    setStatus('Could not fill this page', false);
  }

  // Close the popup so the user sees the filled form
  window.close();
});

// ── Init ──────────────────────────────────────────────────────────────────
loadProfile();
