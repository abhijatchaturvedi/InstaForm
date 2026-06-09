'use strict';

// auth.js is loaded before this script (see profile.html)
const $ = (id) => document.getElementById(id);
const val = (id) => $(id)?.value.trim() ?? '';

const EXPORT_VERSION = '1.0.0';

// ── Auth gate (automatic — reads signed-in Chrome profile) ───────────────

function showSigninLoading() {
  $('signin-overlay').classList.remove('hidden');
  $('signin-loading').classList.remove('hidden');
  $('signin-error-state').classList.add('hidden');
  $('app').classList.add('hidden');
}

function showSigninError() {
  $('signin-loading').classList.add('hidden');
  $('signin-error-state').classList.remove('hidden');
}

function showApp(user) {
  $('signin-overlay').classList.add('hidden');
  $('app').classList.remove('hidden');
  $('account-email').textContent = user.email;
}

async function attemptConnect() {
  let user = await getStoredUser();           // from auth.js

  if (!user) {
    try {
      user = await connectChromeProfile();    // from auth.js
    } catch {
      showSigninError();
      return;
    }
  }

  // Seed empty profile on first use
  const { profile } = await chrome.storage.local.get('profile');
  if (!profile) {
    await chrome.storage.local.set({
      profile: {
        personal: {
          firstName: '', lastName: '', fullName: '',
          email: user.email,
          phone: '', dob: '', gender: '', nationality: '',
          address: { street: '', city: '', state: '', zip: '', country: '' },
        },
        professional: [], academic: [],
        media: { linkedin: '', github: '', twitter: '', portfolio: '', photo: '', signature: '' },
      },
    });
  }

  showApp(user);
  await loadProfile();
  initScrollSpy();
}

$('signin-retry-btn').addEventListener('click', async () => {
  $('signin-error-state').classList.add('hidden');
  $('signin-loading').classList.remove('hidden');
  await attemptConnect();
});

// ── Save status ───────────────────────────────────────────────────────────

function showStatus(msg, ok = true) {
  const el = $('save-status');
  el.textContent = msg;
  el.style.color = ok ? 'var(--success)' : 'var(--warn)';
  el.classList.add('visible');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('visible'), 2800);
}

// ── Entry card builders ───────────────────────────────────────────────────

function esc(v) {
  return (v ?? '').toString()
    .replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
}

function buildProfCard(data = {}, index) {
  const card = document.createElement('div');
  card.className = 'entry-card';
  card.dataset.index = index;
  card.innerHTML = `
    <div class="entry-header">
      <span class="entry-label">Job ${index + 1}</span>
      <button class="btn btn-danger-ghost remove-entry-btn">Remove</button>
    </div>
    <div class="form-row">
      <div class="field"><label>Company</label>
        <input type="text" data-field="company" value="${esc(data.company)}" placeholder="Acme Corp" autocomplete="off" /></div>
      <div class="field"><label>Job Title</label>
        <input type="text" data-field="title" value="${esc(data.title)}" placeholder="Software Engineer" autocomplete="off" /></div>
    </div>
    <div class="form-row">
      <div class="field"><label>Start Date</label>
        <input type="month" data-field="startDate" value="${esc(data.startDate)}" /></div>
      <div class="field"><label>End Date</label>
        <input type="month" data-field="endDate" value="${esc(data.endDate)}" ${data.current ? 'disabled' : ''} /></div>
    </div>
    <div class="current-row">
      <input type="checkbox" id="cur-${index}" data-field="current" ${data.current ? 'checked' : ''} />
      <label for="cur-${index}">Currently working here</label>
    </div>`;

  card.querySelector('.remove-entry-btn').addEventListener('click', () => {
    card.remove();
    reindex('pro-entries', 'Job');
  });

  const chk = card.querySelector('[data-field=current]');
  const end = card.querySelector('[data-field=endDate]');
  chk.addEventListener('change', () => { end.disabled = chk.checked; if (chk.checked) end.value = ''; });

  return card;
}

function buildEduCard(data = {}, index) {
  const card = document.createElement('div');
  card.className = 'entry-card';
  card.dataset.index = index;
  card.innerHTML = `
    <div class="entry-header">
      <span class="entry-label">Degree ${index + 1}</span>
      <button class="btn btn-danger-ghost remove-entry-btn">Remove</button>
    </div>
    <div class="field"><label>Institution</label>
      <input type="text" data-field="institution" value="${esc(data.institution)}" placeholder="MIT" autocomplete="off" /></div>
    <div class="form-row">
      <div class="field"><label>Degree</label>
        <input type="text" data-field="degree" value="${esc(data.degree)}" placeholder="B.S. Computer Science" autocomplete="off" /></div>
      <div class="field"><label>Field of Study</label>
        <input type="text" data-field="field" value="${esc(data.field)}" placeholder="Computer Science" autocomplete="off" /></div>
    </div>
    <div class="form-row">
      <div class="field"><label>Start Year</label>
        <input type="number" data-field="startYear" value="${esc(data.startYear)}" placeholder="2018" min="1950" max="2040" /></div>
      <div class="field"><label>End Year</label>
        <input type="number" data-field="endYear" value="${esc(data.endYear)}" placeholder="2022" min="1950" max="2040" /></div>
    </div>
    <div class="field field-half"><label>GPA / Grade</label>
      <input type="text" data-field="gpa" value="${esc(data.gpa)}" placeholder="3.8 / 4.0" autocomplete="off" /></div>`;

  card.querySelector('.remove-entry-btn').addEventListener('click', () => {
    card.remove();
    reindex('edu-entries', 'Degree');
  });

  return card;
}

function reindex(containerId, label) {
  Array.from($(containerId).querySelectorAll('.entry-card')).forEach((card, i) => {
    card.dataset.index = i;
    card.querySelector('.entry-label').textContent = `${label} ${i + 1}`;
    const chk = card.querySelector('[data-field=current]');
    if (chk) {
      chk.id = `cur-${i}`;
      const lbl = card.querySelector('label[for^="cur-"]');
      if (lbl) lbl.setAttribute('for', `cur-${i}`);
    }
  });
}

function collectEntries(containerId, fields) {
  return Array.from($(containerId).querySelectorAll('.entry-card')).map(card => {
    const obj = {};
    fields.forEach(f => {
      const el = card.querySelector(`[data-field="${f}"]`);
      if (el) obj[f] = el.type === 'checkbox' ? el.checked : el.value.trim();
    });
    return obj;
  });
}

document.querySelectorAll('.add-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.dataset.type === 'pro') {
      const idx = $('pro-entries').querySelectorAll('.entry-card').length;
      $('pro-entries').appendChild(buildProfCard({}, idx));
    } else {
      const idx = $('edu-entries').querySelectorAll('.entry-card').length;
      $('edu-entries').appendChild(buildEduCard({}, idx));
    }
  });
});

// ── Image helpers ─────────────────────────────────────────────────────────

function setupImage({ fileId, previewId, placeholderId, clearId, dropId }) {
  const fileInput   = $(fileId);
  const preview     = $(previewId);
  const placeholder = $(placeholderId);
  const clearBtn    = $(clearId);
  const drop        = $(dropId);
  let base64 = '';

  const show = src => {
    base64 = src; preview.src = src;
    preview.classList.remove('hidden'); placeholder.classList.add('hidden');
    clearBtn.classList.remove('hidden');
  };
  const clear = () => {
    base64 = ''; preview.src = ''; fileInput.value = '';
    preview.classList.add('hidden'); placeholder.classList.remove('hidden');
    clearBtn.classList.add('hidden');
  };
  const handle = file => {
    if (!file?.type.startsWith('image/')) return;
    if (file.size > 2 * 1024 * 1024) { showStatus('Image must be under 2 MB', false); return; }
    const reader = new FileReader();
    reader.onload = e => show(e.target.result);
    reader.readAsDataURL(file);
  };

  fileInput.addEventListener('change', () => handle(fileInput.files[0]));
  clearBtn.addEventListener('click', clear);
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('drag-over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('drag-over'));
  drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('drag-over'); handle(e.dataTransfer.files[0]); });

  return { load: src => src ? show(src) : clear(), get: () => base64 };
}

const photoCtrl = setupImage({ fileId:'m-photo-file', previewId:'photo-preview', placeholderId:'photo-placeholder', clearId:'photo-clear', dropId:'photo-drop' });
const sigCtrl   = setupImage({ fileId:'m-sig-file',   previewId:'sig-preview',   placeholderId:'sig-placeholder',   clearId:'sig-clear',   dropId:'sig-drop'   });

// ── Load / save profile ───────────────────────────────────────────────────

async function loadProfile() {
  const { profile } = await chrome.storage.local.get('profile');
  if (!profile) {
    $('pro-entries').appendChild(buildProfCard({}, 0));
    $('edu-entries').appendChild(buildEduCard({}, 0));
    return;
  }

  const p = profile.personal ?? {}, addr = p.address ?? {};
  [
    ['p-firstName', p.firstName], ['p-lastName', p.lastName], ['p-fullName', p.fullName],
    ['p-email', p.email], ['p-phone', p.phone], ['p-dob', p.dob],
    ['p-gender', p.gender], ['p-nationality', p.nationality],
    ['p-street', addr.street], ['p-city', addr.city], ['p-state', addr.state],
    ['p-zip', addr.zip], ['p-country', addr.country],
    ['m-linkedin', profile.media?.linkedin], ['m-github', profile.media?.github],
    ['m-twitter', profile.media?.twitter],   ['m-portfolio', profile.media?.portfolio],
  ].forEach(([id, v]) => { if ($(id) && v != null) $(id).value = v; });

  const proC = $('pro-entries'); proC.innerHTML = '';
  (profile.professional?.length ? profile.professional : [{}]).forEach((e, i) => proC.appendChild(buildProfCard(e, i)));

  const eduC = $('edu-entries'); eduC.innerHTML = '';
  (profile.academic?.length ? profile.academic : [{}]).forEach((e, i) => eduC.appendChild(buildEduCard(e, i)));

  photoCtrl.load(profile.media?.photo);
  sigCtrl.load(profile.media?.signature);
}

async function saveProfile() {
  let fullName = val('p-fullName');
  if (!fullName) {
    const f = val('p-firstName'), l = val('p-lastName');
    if (f || l) fullName = [f, l].filter(Boolean).join(' ');
  }
  const profile = {
    personal: {
      firstName: val('p-firstName'), lastName: val('p-lastName'), fullName,
      email: val('p-email'), phone: val('p-phone'), dob: val('p-dob'),
      gender: val('p-gender'), nationality: val('p-nationality'),
      address: { street: val('p-street'), city: val('p-city'), state: val('p-state'), zip: val('p-zip'), country: val('p-country') },
    },
    professional: collectEntries('pro-entries', ['company','title','startDate','endDate','current']),
    academic:     collectEntries('edu-entries',  ['institution','degree','field','startYear','endYear','gpa']),
    media: {
      linkedin: val('m-linkedin'), github: val('m-github'),
      twitter: val('m-twitter'),  portfolio: val('m-portfolio'),
      photo: photoCtrl.get(), signature: sigCtrl.get(),
    },
  };
  await chrome.storage.local.set({ profile });
  showStatus('Saved');
  return profile;
}

$('save-btn').addEventListener('click', saveProfile);
document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveProfile(); } });

// ── Export ────────────────────────────────────────────────────────────────

$('export-btn').addEventListener('click', async () => {
  const { profile } = await chrome.storage.local.get('profile');
  if (!profile) { showStatus('Nothing to export yet', false); return; }

  const payload = {
    version:    EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    profile,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), {
    href:     url,
    download: `instaform-profile-${new Date().toISOString().slice(0,10)}.json`,
  });
  a.click();
  URL.revokeObjectURL(url);
  showStatus('Profile exported');
});

// ── Import ────────────────────────────────────────────────────────────────

$('import-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  e.target.value = '';   // reset so the same file can be re-imported

  let parsed;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    toast('Import failed: file is not valid JSON.', false);
    return;
  }

  // Accept both raw profile object and our versioned wrapper
  const profile = parsed.profile ?? parsed;
  if (!profile?.personal) {
    toast('Import failed: unrecognised profile format.', false);
    return;
  }

  await chrome.storage.local.set({ profile });
  await loadProfile();
  toast('Profile imported successfully.');
});

function toast(msg, ok = true) {
  const t = document.createElement('div');
  t.className = 'import-toast';
  t.textContent = msg;
  t.style.background = ok ? '#059669' : '#b45309';
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

// ── Scroll spy ────────────────────────────────────────────────────────────

function initScrollSpy() {
  const navItems = document.querySelectorAll('.nav-item[data-target]');
  const sections = Array.from(document.querySelectorAll('.section[id]'));

  const activate = id => navItems.forEach(n => n.classList.toggle('active', n.dataset.target === id));

  const observer = new IntersectionObserver(
    entries => {
      const visible = entries.filter(e => e.isIntersecting)
                             .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible.length) activate(visible[0].target.id);
    },
    { rootMargin: '-56px 0px -60% 0px' }
  );
  sections.forEach(s => observer.observe(s));

  navItems.forEach(n => {
    n.addEventListener('click', e => {
      e.preventDefault();
      document.getElementById(n.dataset.target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

// ── Init ──────────────────────────────────────────────────────────────────

showSigninLoading();
attemptConnect();
