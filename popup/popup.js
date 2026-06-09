'use strict';

// auth.js is loaded before this script
const $ = (id) => document.getElementById(id);

function showScreen(name) {
  ['auth', 'main'].forEach(s =>
    $(`screen-${s}`).classList.toggle('hidden', s !== name)
  );
}

function showAuthError() {
  $('auth-loading').classList.add('hidden');
  $('auth-error').classList.remove('hidden');
}

// ── Populate chip ─────────────────────────────────────────────────────────

async function populateChip(user) {
  $('chip-email').textContent = user.email;

  // Try to show the profile name if one is saved
  const { profile } = await chrome.storage.local.get('profile');
  const name = profile?.personal?.fullName
    || [profile?.personal?.firstName, profile?.personal?.lastName].filter(Boolean).join(' ')
    || '';

  $('chip-name').textContent = name || user.email.split('@')[0];

  const avatar = $('chip-avatar');
  avatar.innerHTML = '';
  if (profile?.media?.photo) {
    const img = document.createElement('img');
    img.src = profile.media.photo;
    avatar.appendChild(img);
  } else {
    const initials = (name || user.email)
      .split(/[\s@.]+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase();
    avatar.textContent = initials;
  }
}

// ── Auth flow (automatic — no user action needed) ─────────────────────────

async function init() {
  // Fast path: already connected
  let user = await getStoredUser();           // from auth.js

  if (!user) {
    // First open or cleared — try to read Chrome profile
    try {
      user = await connectChromeProfile();    // from auth.js
    } catch {
      showScreen('auth');
      showAuthError();
      return;
    }
  }

  // Seed profile on first use
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
    // First-time: open profile page so user can fill in the rest
    chrome.tabs.create({ url: chrome.runtime.getURL('profile/profile.html') });
    window.close();
    return;
  }

  await populateChip(user);
  showScreen('main');
}

// ── Retry button (shown only if Chrome has no signed-in account) ──────────

$('retry-btn').addEventListener('click', async () => {
  $('auth-error').classList.add('hidden');
  $('auth-loading').classList.remove('hidden');

  try {
    await connectChromeProfile();
    init();
  } catch {
    showAuthError();
  }
});

// ── Fill this page ────────────────────────────────────────────────────────

$('fill-btn').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
  } catch (err) {
    console.error('InstaForm: inject failed', err.message);
  }
  window.close();
});

// ── Edit profile ──────────────────────────────────────────────────────────

$('edit-btn').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('profile/profile.html') });
  window.close();
});

// ── Init ──────────────────────────────────────────────────────────────────
init();
