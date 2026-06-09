<div align="center">

<!-- Banner -->
<img src="icons/icon128.png" width="80" alt="InstaForm logo" />

# InstaForm

**One profile vault. Every form, filled instantly.**

[![License: PolyForm NC](https://img.shields.io/badge/License-PolyForm%20NC%201.0-crimson?style=flat-square)](LICENSE)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-4f46e5?style=flat-square&logo=googlechrome&logoColor=white)](manifest.json)
[![Version](https://img.shields.io/badge/Version-2.0.0-818cf8?style=flat-square)](manifest.json)
[![Platform](https://img.shields.io/badge/Platform-Chrome-yellow?style=flat-square&logo=googlechrome&logoColor=white)]()
[![Vanilla JS](https://img.shields.io/badge/Built%20with-Vanilla%20JS-f7df1e?style=flat-square&logo=javascript&logoColor=black)]()
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-34d399?style=flat-square)]()

</div>

---

InstaForm is a Chrome extension that stores your personal profile in a local vault and intelligently fills web forms with the right data — profile data never leaves your device.

## Features

- **No sign-in required** — open and use immediately; all data stays 100% local on your device
- **Multiple named profiles** — create, switch, rename, and delete profiles; ideal for separate work/personal identities
- **Full-tab profile editor** — opens in a new tab with a sidebar layout; no cramped popup form
- **Five profile sections** — Identity, Address, Work, Education, and Online presence
- **Smart field detection** — matches fields by `autocomplete` attribute, `name`/`id`, label text, and placeholder
- **React / Vue / Angular aware** — dispatches native `input` + `change` events so framework forms register the fill
- **Image injection** — injects stored profile photo and signature into `<input type="file">` fields via the `DataTransfer` API
- **Multiple work / education entries** — add as many jobs and degrees as you need
- **Export & import** — back up any profile as a JSON file and restore it after reinstalls or updates
- **Keyboard shortcut** — `Ctrl+Shift+F` (configurable) fills the page without opening the popup

## Installation

> InstaForm is not yet on the Chrome Web Store. Load it manually in developer mode.

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer mode** (toggle in the top-right)
4. Click **Load unpacked** and select the `InstaForm/` folder
5. The lightning bolt icon appears in your toolbar — pin it for easy access

## Usage

### First-time setup

1. Click the **InstaForm** icon in the toolbar
2. Click **Manage Profiles** — the profile editor opens in a new tab
3. Fill in your details and click **Save**

### Filling a form

| Method | How |
|---|---|
| Popup button | Open the extension → click **Fill Page** |
| Keyboard | Press `Ctrl+Shift+F` (or `MacCtrl+Shift+F` on Mac) |

A toast notification confirms how many fields were matched and filled.

> **Changing the shortcut** — go to `chrome://extensions/shortcuts` and remap *"Fill form on current page"* to any key combination you prefer.

## Multiple profiles

Use the profile switcher in the topbar of the profile editor (or the popup) to manage profiles:

| Action | How |
|---|---|
| **Switch** | Click the active profile name → pick from the list |
| **Create** | Click `+ New Profile` in the switcher dropdown |
| **Rename** | Hover a profile → click the pencil icon → type and press Enter |
| **Delete** | Hover a profile → click the trash icon (blocked on the last remaining profile) |

## Export & import

Use Export/Import to back up a profile before updating or reinstalling the extension, or to move data between machines.

| Action | Where | What happens |
|---|---|---|
| **Export** | Profile page → sidebar → **Export** | Downloads `instaform_<name>.json` for the active profile |
| **Import** | Profile page → sidebar → **Import** | Opens file picker; adds as a new profile or updates existing if ID matches |

The exported file is a plain JSON document with a version header:

```json
{
  "version": "2.0.0",
  "exportedAt": "2026-06-09T12:00:00.000Z",
  "profile": { ... }
}
```

## How field matching works

Fields are matched in priority order:

| Priority | Signal | Example |
|---|---|---|
| 1 | `autocomplete` attribute | `autocomplete="given-name"` → First Name |
| 2 | `name` / `id` regex | `name="dob"` → Date of Birth |
| 3 | Visible label text | `<label>Date of Birth</label>` → DOB |
| 4 | `placeholder` text | `placeholder="Your company"` → Company |

The ruleset covers common naming conventions including camelCase, snake_case, kebab-case, and natural language variants across all four profile categories.

## Profile schema

Profiles are stored as an array under the key `profiles` in `chrome.storage.local`. Each profile follows this shape:

```jsonc
{
  "personal": {
    "firstName": "Jane",
    "lastName": "Doe",
    "fullName": "Jane Doe",
    "email": "jane@example.com",
    "phone": "+1 555 000 0000",
    "dob": "1990-06-15",
    "gender": "Female",
    "nationality": "American",
    "address": {
      "street": "123 Main St",
      "city": "San Francisco",
      "state": "CA",
      "zip": "94103",
      "country": "United States"
    }
  },
  "professional": [
    {
      "company": "Acme Corp",
      "title": "Software Engineer",
      "startDate": "2021-03",
      "endDate": "",
      "current": true
    }
  ],
  "academic": [
    {
      "institution": "MIT",
      "degree": "B.S. Computer Science",
      "field": "Computer Science",
      "startYear": "2018",
      "endYear": "2022",
      "gpa": "3.8"
    }
  ],
  "media": {
    "linkedin": "https://linkedin.com/in/janedoe",
    "github": "https://github.com/janedoe",
    "twitter": "@janedoe",
    "portfolio": "https://janedoe.dev",
    "photo": "data:image/jpeg;base64,...",
    "signature": "data:image/png;base64,..."
  }
}
```

## Architecture

```
InstaForm/
├── manifest.json        Chrome MV3 manifest
├── storage.js           Shared multi-profile helpers + v1→v2 migration
├── background.js        Service worker — handles Ctrl+Shift+F shortcut
├── content.js           Form-filler content script (injected on demand)
├── popup/
│   ├── popup.html       Minimal launcher — profile switcher + fill button
│   ├── popup.css        Popup styles
│   └── popup.js         Profile switcher, fill trigger, open-profile-tab
├── profile/
│   ├── profile.html     Full-tab profile editor with sidebar layout
│   ├── profile.css      Full-page dark styles
│   └── profile.js       Profile selector, form I/O, export/import, scroll spy
├── icons/
│   ├── icon.svg         Source SVG icon
│   └── icon{16,32,48,128}.png  Generated PNGs
└── tools/
    ├── gen_icons_simple.py  Zero-dependency PNG icon generator
    └── create_icons.py      Alternative generator (requires cairosvg)
```

**Key design decisions:**

- **No authentication** — profiles live entirely in `chrome.storage.local`; nothing ever leaves the device
- **Multi-profile storage** — `storage.js` holds all profiles in an array with an `activeProfileId` pointer; `loadAllProfiles()` transparently migrates the old single-profile format on first load
- **On-demand content script injection** — injected fresh per trigger; `window.__instaformActive` guards against double-execution
- **Native value setter** — React/Vue/Angular intercept `element.value = ...`; InstaForm uses `Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set` to bypass the override, then fires synthetic events
- **Versioned export format** — the JSON envelope carries a `version` field (`2.0.0`) so future migrations can be handled without data loss
- **No build step** — plain HTML/CSS/JS, no bundler or framework

## Known limitations

- **Shadow DOM** — fields inside a closed shadow root are not reachable via `document.querySelectorAll`. This affects some design-system components (e.g. Salesforce Lightning, SAP Fiori).
- **Cross-origin iframes** — government portals and some ATS job boards sandbox their forms in cross-origin iframes; content scripts cannot access these.
- **Custom dropdowns** — `<div>`-based select replacements are not detected; only native `<select>` elements are handled.

## Regenerating icons

If you modify `icons/icon.svg`, regenerate the PNGs with:

```bash
python tools/gen_icons_simple.py
```

Or, for higher fidelity SVG rendering, install `cairosvg` and use:

```bash
pip install cairosvg
python tools/create_icons.py
```

## License

Copyright © 2026 Abhijat Chaturvedi

Licensed under the **PolyForm Noncommercial License 1.0.0**.  
Free for personal use. Commercial use of any kind is prohibited.  
See [LICENSE](LICENSE) for the full terms.
