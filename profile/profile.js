'use strict';

// auth.js is loaded before this script (see profile.html)
const $ = (id) => document.getElementById(id);
const val = (id) => $(id)?.value.trim() ?? '';

const EXPORT_VERSION = '1.0.0';

// ── Auth gate ─────────────────────────────────────────────────────────────

async function checkAuth() {
  const user = await getStoredUser();   // from auth.js
  if (user) {
    showApp(user);
  } else {
    showSignin();
  }
}

function showSignin() {
  $('signin-overlay').classList.remove('hidden');
  $('app').classList.add('hidden');
}

function showApp(user) {
  $('signin-overlay').classList.add('hidden');
  $('app').classList.remove('hidden');
  populateAccount(user);
}

function populateAccount(user) {
  $('account-name').textContent  = user.name  || user.email;
  $('account-email').textContent = user.email || '';

  const avatar = $('account-avatar');
  avatar.innerHTML = '';
  if (user.photo) {
    const img = document.createElement('img');
    img.src = user.photo;
    img.alt = user.name;
    avatar.appendChild(img);
  } else {
    avatar.textContent = (user.name || user.email)
      .split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  }
}

// ── Sign-in handler ───────────────────────────────────────────────────────

$('signin-btn').addEventListener('click', async () => {
  const btn   = $('signin-btn');
  const errEl = $('signin-error');
  errEl.classList.add('hidden');

  btn.disabled = true;
  btn.innerHTML = `<div class="spinner"></div> Signing in…`;

  try {
    const user = await signIn();    // from auth.js

    // Seed profile from Google on first use
    const { profile } = await chrome.storage.local.get('profile');
    if (!profile) {
      await chrome.storage.local.set({
        profile: {
          personal: {
            firstName: user.firstName, lastName: user.lastName,
            fullName: user.name, email: user.email,
            phone: '', dob: '', gender: '', nationality: '',
            address: { street: '', city: '', state: '', zip: '', country: '' },
          },
          professional: [], academic: [],
          media: { linkedin: '', github: '', twitter: '', portfolio: '',
                   photo: user.photo ?? '', signature: '' },
        },
      });
    }

    showApp(user);
    await loadProfile();
    initScrollSpy();
  } catch (err) {
    btn.disabled = false;
    btn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66 2.84-.62-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg> Sign in with Google`;

    const msg = err.message.includes('OAuth2') || err.message.includes('client')
      ? 'OAuth not configured. See README § Google OAuth Setup.'
      : err.message.includes('cancel') || err.message.includes('denied')
      ? 'Sign-in was cancelled.'
      : `Sign-in failed: ${err.message}`;

    errEl.textContent = msg;
    errEl.classList.remove('hidden');
  }
});

// ── Sign-out ──────────────────────────────────────────────────────────────

$('signout-btn').addEventListener('click', async () => {
  await signOut();    // from auth.js
  showSignin();
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

async function init() {
  const user = await getStoredUser();   // from auth.js
  if (user) {
    showApp(user);
    await loadProfile();
    initScrollSpy();
  } else {
    showSignin();
  }
}

init();
