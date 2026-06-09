'use strict';

/**
 * Shared Google OAuth helpers.
 * Included via <script src="../auth.js"> in both popup and profile pages.
 *
 * SETUP REQUIRED — before this works you must:
 *   1. Create a project in Google Cloud Console
 *   2. Enable the "Google People API"
 *   3. Create an OAuth 2.0 Client ID (type: Chrome App)
 *   4. Paste the Client ID into manifest.json → "oauth2" → "client_id"
 * See README § Google OAuth Setup for step-by-step instructions.
 */

const GOOGLE_USER_KEY = 'googleUser';
const USERINFO_URL    = 'https://www.googleapis.com/oauth2/v1/userinfo';

// ── Public API ────────────────────────────────────────────────────────────

async function getStoredUser() {
  const data = await chrome.storage.local.get(GOOGLE_USER_KEY);
  return data[GOOGLE_USER_KEY] ?? null;
}

async function signIn() {
  const token = await _getToken(true);

  const res = await fetch(`${USERINFO_URL}?access_token=${encodeURIComponent(token)}`);
  if (!res.ok) throw new Error(`Google userinfo request failed (${res.status})`);
  const info = await res.json();

  // Fetch profile photo and store as base64 so it works offline
  const photo = info.picture
    ? await _urlToBase64(info.picture.replace(/=s\d+$/, '=s128'))
    : null;

  const user = {
    id:        info.id,
    email:     info.email,
    name:      info.name       ?? '',
    firstName: info.given_name  ?? '',
    lastName:  info.family_name ?? '',
    photo,
  };

  await chrome.storage.local.set({ [GOOGLE_USER_KEY]: user });
  return user;
}

async function signOut() {
  // Non-interactive token fetch to revoke — best-effort only
  try {
    const token = await _getToken(false);
    chrome.identity.removeCachedAuthToken({ token });
    fetch(`https://accounts.google.com/o/oauth2/revoke?token=${token}`).catch(() => {});
  } catch { /* already expired or not present */ }

  await chrome.storage.local.remove(GOOGLE_USER_KEY);
}

// ── Private helpers ───────────────────────────────────────────────────────

function _getToken(interactive) {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, (token) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(token);
      }
    });
  });
}

async function _urlToBase64(url) {
  try {
    const res  = await fetch(url);
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}
