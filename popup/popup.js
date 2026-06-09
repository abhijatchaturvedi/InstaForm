'use strict';

// storage.js is loaded before this script
const $ = (id) => document.getElementById(id);

let _profiles = [];
let _activeId = '';

// ── Build profile list in dropdown ────────────────────────────────────────

function renderDropdown() {
  const list = $('pd-list');
  list.innerHTML = '';

  _profiles.forEach(profile => {
    const item = document.createElement('div');
    item.className = 'pd-item' + (profile.id === _activeId ? ' active' : '');
    item.innerHTML = `
      <div class="pd-dot"></div>
      <span class="pd-item-name" title="${escAttr(profile.name)}">${esc(profile.name)}</span>`;

    item.addEventListener('click', () => switchProfile(profile.id));
    list.appendChild(item);
  });
}

function esc(v)     { return (v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;'); }
function escAttr(v) { return (v ?? '').replace(/"/g,'&quot;'); }

// ── Profile switching ─────────────────────────────────────────────────────

async function switchProfile(id) {
  _activeId = id;
  await saveAllProfiles(_profiles, _activeId);   // from storage.js
  $('active-name').textContent = _profiles.find(p => p.id === id)?.name ?? '';
  renderDropdown();
  closeDropdown();
}

// ── Dropdown toggle ───────────────────────────────────────────────────────

function openDropdown() {
  $('switcher-dropdown').classList.remove('hidden');
  $('switcher-btn').classList.add('open');
}

function closeDropdown() {
  $('switcher-dropdown').classList.add('hidden');
  $('switcher-btn').classList.remove('open');
}

$('switcher-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  $('switcher-dropdown').classList.contains('hidden') ? openDropdown() : closeDropdown();
});

document.addEventListener('click', () => closeDropdown());
$('switcher-dropdown').addEventListener('click', e => e.stopPropagation());

// ── New profile ───────────────────────────────────────────────────────────

$('pd-new-btn').addEventListener('click', async () => {
  closeDropdown();
  // Open the profile page where the user can create and name a new profile
  chrome.tabs.create({ url: chrome.runtime.getURL('profile/profile.html?new=1') });
  window.close();
});

// ── Fill this page ────────────────────────────────────────────────────────

$('fill-btn').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, files: ['content.js'] });
  } catch (err) {
    console.error('InstaForm: inject failed', err.message);
  }
  window.close();
});

// ── Manage profiles ───────────────────────────────────────────────────────

$('edit-btn').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('profile/profile.html') });
  window.close();
});

// ── Init ──────────────────────────────────────────────────────────────────

async function init() {
  const { profiles, activeProfileId } = await loadAllProfiles();  // from storage.js
  _profiles = profiles;
  _activeId = activeProfileId;

  const active = _profiles.find(p => p.id === _activeId) ?? _profiles[0];
  $('active-name').textContent = active?.name ?? 'My Profile';

  renderDropdown();
}

init();
