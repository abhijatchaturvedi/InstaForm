'use strict';

/**
 * Multi-profile storage helpers.
 * Included via <script> in popup.html and profile.html before page scripts.
 *
 * Storage layout (chrome.storage.local):
 *   profiles       — array of profile objects
 *   activeProfileId — id string of the selected profile
 *
 * Each profile object:
 *   { id, name, personal, professional, academic, media }
 */

function generateId() {
  return `p_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

function emptyProfileData() {
  return {
    personal: {
      firstName:'', lastName:'', fullName:'', email:'', phone:'',
      dob:'', gender:'', nationality:'',
      address:{ street:'', city:'', state:'', zip:'', country:'' },
    },
    professional: [],
    academic:     [],
    media:{ linkedin:'', github:'', twitter:'', portfolio:'', photo:'', signature:'' },
  };
}

function newProfile(name = 'My Profile') {
  return { id: generateId(), name, ...emptyProfileData() };
}

/** Load all profiles, migrating from the old single-profile format if needed. */
async function loadAllProfiles() {
  const data = await chrome.storage.local.get(['profiles', 'activeProfileId', 'profile']);

  // ── Migrate from v1 single-profile format ────────────────────────────
  if (!data.profiles && data.profile) {
    const migrated = { id: generateId(), name: 'My Profile', ...data.profile };
    const profiles = [migrated];
    await chrome.storage.local.set({ profiles, activeProfileId: migrated.id });
    await chrome.storage.local.remove('profile');
    return { profiles, activeProfileId: migrated.id };
  }

  // ── Fresh install ─────────────────────────────────────────────────────
  if (!data.profiles?.length) {
    const fresh = newProfile('My Profile');
    const profiles = [fresh];
    await chrome.storage.local.set({ profiles, activeProfileId: fresh.id });
    return { profiles, activeProfileId: fresh.id };
  }

  const activeProfileId = data.activeProfileId ?? data.profiles[0].id;
  return { profiles: data.profiles, activeProfileId };
}

async function saveAllProfiles(profiles, activeProfileId) {
  await chrome.storage.local.set({ profiles, activeProfileId });
}

async function getActiveProfile() {
  const { profiles, activeProfileId } = await loadAllProfiles();
  return profiles.find(p => p.id === activeProfileId) ?? profiles[0];
}
