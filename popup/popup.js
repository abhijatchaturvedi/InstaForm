'use strict';

// auth.js is loaded before this script (see popup.html)
const $ = (id) => document.getElementById(id);

// ── Screen switching ──────────────────────────────────────────────────────

function showScreen(name) {
  ['signin', 'main'].forEach(s => {
    $(`screen-${s}`).classList.toggle('hidden', s !== name);
  });
}

// ── Populate chip from stored user ────────────────────────────────────────

function populateChip(user) {
  $('chip-name').textContent  = user.name  || user.email;
  $('chip-email').textContent = user.email || '';

  const avatar = $('chip-avatar');
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

// ── Google sign-in ────────────────────────────────────────────────────────

$('google-signin-btn').addEventListener('click', async () => {
  const btn = $('google-signin-btn');
  const errEl = $('signin-error');
  errEl.classList.add('hidden');

  // Loading state
  btn.disabled = true;
  btn.innerHTML = `<div class="spinner"></div> Signing in…`;

  try {
    const user = await signIn();          // from auth.js

    // If no profile exists yet, seed it from Google data
    const { profile } = await chrome.storage.local.get('profile');
    if (!profile) {
      await chrome.storage.local.set({
        profile: {
          personal: {
            firstName: user.firstName,
            lastName:  user.lastName,
            fullName:  user.name,
            email:     user.email,
            phone: '', dob: '', gender: '', nationality: '',
            address: { street: '', city: '', state: '', zip: '', country: '' },
          },
          professional: [],
          academic:     [],
          media: {
            linkedin: '', github: '', twitter: '', portfolio: '',
            photo: user.photo ?? '',
            signature: '',
          },
        },
      });
      // First-time user → open profile page so they can complete it
      chrome.tabs.create({ url: chrome.runtime.getURL('profile/profile.html') });
      window.close();
      return;
    }

    populateChip(user);
    showScreen('main');
  } catch (err) {
    btn.disabled = false;
    btn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" xmlns="http://www.w3.org/2000/svg"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66 2.84-.62-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg> Sign in with Google`;

    const msg = err.message.includes('OAuth2') || err.message.includes('client')
      ? 'OAuth not configured. See README § Google OAuth Setup.'
      : err.message.includes('cancel') || err.message.includes('denied')
      ? 'Sign-in was cancelled.'
      : `Sign-in failed: ${err.message}`;

    errEl.textContent = msg;
    errEl.classList.remove('hidden');
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

// ── Sign out ──────────────────────────────────────────────────────────────

$('signout-btn').addEventListener('click', async () => {
  await signOut();    // from auth.js
  showScreen('signin');
  $('signin-error').classList.add('hidden');
});

// ── Init ──────────────────────────────────────────────────────────────────

async function init() {
  const user = await getStoredUser();   // from auth.js
  if (user) {
    populateChip(user);
    showScreen('main');
  } else {
    showScreen('signin');
  }
}

init();
