'use strict';

/**
 * Auth via the signed-in Chrome profile.
 * Uses chrome.identity.getProfileUserInfo — no OAuth app, no client_id, no consent screen.
 * Just needs the "identity" permission in manifest.json.
 */

const CHROME_USER_KEY = 'chromeUser';

async function getStoredUser() {
  const data = await chrome.storage.local.get(CHROME_USER_KEY);
  return data[CHROME_USER_KEY] ?? null;
}

async function connectChromeProfile() {
  const info = await new Promise((resolve, reject) => {
    chrome.identity.getProfileUserInfo({ accountStatus: 'ANY' }, (info) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(info);
      }
    });
  });

  if (!info.email) {
    throw new Error('not_signed_in');
  }

  const user = { email: info.email, id: info.id };
  await chrome.storage.local.set({ [CHROME_USER_KEY]: user });
  return user;
}

async function disconnectUser() {
  await chrome.storage.local.remove(CHROME_USER_KEY);
}
