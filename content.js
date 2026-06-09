/* InstaForm content script — injected on demand, guards against re-injection */
(function () {
  if (window.__instaformActive) {
    window.__instaformRun?.();
    return;
  }
  window.__instaformActive = true;

  // ─── Field-matching rules ────────────────────────────────────────────────
  // Priority: (1) autocomplete attr  (2) regex against normalized token variants
  //
  // Regexes match AFTER tokenVariants() has stripped qualifiers like "Home Phone" → "phone",
  // "First Name:" → "first name", "YourFirstName" → "first name", etc.

  const RULES = [
    // Personal
    { key: 'personal.firstName',
      ac: ['given-name'],
      rx: [/^(first[\s_-]?name|fname|given[\s_-]?name|forename|first)$/i] },
    { key: 'personal.lastName',
      ac: ['family-name'],
      rx: [/^(last[\s_-]?name|lname|surname|family[\s_-]?name)$/i] },
    { key: 'personal.fullName',
      ac: ['name'],
      rx: [/^(full[\s_-]?name|your[\s_-]?name|name)$/i] },
    { key: 'personal.email',
      ac: ['email'],
      rx: [/^(e[\s_-]?mail([\s_-]?address)?)$/i] },
    { key: 'personal.phone',
      ac: ['tel', 'tel-national', 'tel-local'],
      rx: [/^(phone([\s_-]?number)?|mobile([\s_-]?number)?|telephone|tel|cell([\s_-]?phone)?)$/i] },
    { key: 'personal.dob',
      ac: ['bday'],
      rx: [/^(dob|date[\s_-]?of[\s_-]?birth|birth[\s_-]?date|birthday|born)$/i] },
    { key: 'personal.gender',
      ac: ['sex'],
      rx: [/^(gender|sex)$/i] },
    { key: 'personal.nationality',
      ac: [],
      rx: [/^(nationality|citizenship)$/i] },
    { key: 'personal.fatherName',
      ac: [],
      rx: [/^(father[\s_-]?(name|s[\s_-]?name)|dad[\s_-]?name|paternal[\s_-]?name)$/i] },
    { key: 'personal.motherName',
      ac: [],
      rx: [/^(mother[\s_-]?(name|s[\s_-]?name)|mom[\s_-]?name|maternal[\s_-]?name)$/i] },
    // Address
    { key: 'personal.address.street',
      ac: ['street-address', 'address-line1'],
      rx: [/^(address([\s_-]?line[\s_-]?(1|one))?|street([\s_-]?address)?|addr(ess)?)$/i] },
    { key: 'personal.address.city',
      ac: ['address-level2'],
      rx: [/^(city|town|locality)$/i] },
    { key: 'personal.address.state',
      ac: ['address-level1'],
      rx: [/^(state([\s_-]?province)?|province|region|county)$/i] },
    { key: 'personal.address.zip',
      ac: ['postal-code'],
      rx: [/^(zip([\s_-]?code)?|postal[\s_-]?code|pin[\s_-]?code|pincode|postcode)$/i] },
    { key: 'personal.address.country',
      ac: ['country', 'country-name'],
      rx: [/^(country([\s_-]?name)?)$/i] },
    // Professional (first entry)
    { key: 'professional.0.company',
      ac: ['organization'],
      rx: [/^(company|employer|org(anization|anisation)?|workplace|firm)$/i] },
    { key: 'professional.0.title',
      ac: ['organization-title'],
      rx: [/^(job[\s_-]?title|title|designation|position|role|occupation)$/i] },
    { key: 'professional.0.startDate',
      ac: [],
      rx: [/^(start[\s_-]?date|from[\s_-]?date|employment[\s_-]?start)$/i] },
    { key: 'professional.0.endDate',
      ac: [],
      rx: [/^(end[\s_-]?date|to[\s_-]?date|employment[\s_-]?end)$/i] },
    // Academic (first entry)
    { key: 'academic.0.institution',
      ac: [],
      rx: [/^(university|college|institution|school|institute)$/i] },
    { key: 'academic.0.degree',
      ac: [],
      rx: [/^(degree|qualification|education[\s_-]?level|highest[\s_-]?education)$/i] },
    { key: 'academic.0.field',
      ac: [],
      rx: [/^(field[\s_-]?of[\s_-]?study|major|course|discipline|subject)$/i] },
    { key: 'academic.0.gpa',
      ac: [],
      rx: [/^(gpa|cgpa|grade|percentage)$/i] },
    { key: 'academic.0.endYear',
      ac: [],
      rx: [/^(graduation[\s_-]?year|pass(ing)?[\s_-]?year|year[\s_-]?of[\s_-]?passing)$/i] },
    // Media / social
    { key: 'media.linkedin',
      ac: [],
      rx: [/^(linkedin([\s_-]?(url|profile|link))?)$/i] },
    { key: 'media.github',
      ac: [],
      rx: [/^(github([\s_-]?(url|profile|link))?)$/i] },
    { key: 'media.twitter',
      ac: [],
      rx: [/^(twitter([\s_-]?(handle|url))?|x[\s_-]?handle)$/i] },
    { key: 'media.portfolio',
      ac: ['url'],
      rx: [/^(portfolio|web[\s_-]?site|website([\s_-]?(url|address))?|personal[\s_-]?url|blog[\s_-]?url)$/i] },
  ];

  // ─── Token normalization ──────────────────────────────────────────────────
  // Produces multiple variants from a raw signal so regexes can match across
  // naming conventions: "YourFirstName", "first_name", "First Name:", etc.

  // Common qualifier prefixes that don't change the field's meaning
  const RE_PREFIX = /^(your|the|enter|please|provide|my|home|work|office|cell|mobile|billing|shipping|personal|business|primary|secondary|alternate|alternative|user|txt|inp|fld|str|field)\s+/i;
  // Trailing punctuation, requirement markers, and common widget-type suffixes
  const RE_SUFFIX = /[\s:*?![\]()]+$|[\s_-]*\(?(required|optional|mandatory)\)?$|[\s_-]+(txt|text|input|inp|field|fld|box|ctrl|control|val|value|wrap|container|group)$/i;

  function tokenVariants(raw) {
    const out = new Set();
    const t   = raw.trim();
    if (!t) return [];

    // Raw lowercased
    out.add(t.toLowerCase());

    // Split camelCase and normalize all separators to spaces
    const split = t
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
      .replace(/[\s_\-.]+/g, ' ')
      .toLowerCase()
      .trim();
    out.add(split);

    // Strip trailing punctuation / markers
    const clean = split.replace(RE_SUFFIX, '').trim();
    out.add(clean);

    // Strip leading qualifier
    const stripped = clean.replace(RE_PREFIX, '').trim();
    out.add(stripped);

    return [...out].filter(Boolean);
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  function dig(obj, path) {
    return path.split('.').reduce((o, k) => {
      if (o == null) return undefined;
      const n = Number(k);
      return Number.isFinite(n) ? o[n] : o[k];
    }, obj);
  }

  function labelText(el) {
    // 1. <label for="id">
    if (el.id) {
      try {
        const lbl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
        if (lbl) return lbl.textContent.trim();
      } catch (_) {}
    }
    // 2. Wrapped in <label>
    const nearest = el.closest('label');
    if (nearest) return nearest.textContent.trim();
    // 3. aria-labelledby (may be space-separated list of ids)
    const ariaId = el.getAttribute('aria-labelledby');
    if (ariaId) {
      const t = ariaId.split(/\s+/)
        .map(id => document.getElementById(id)?.textContent ?? '')
        .join(' ').trim();
      if (t) return t;
    }
    // 4. aria-label
    const ariaLbl = el.getAttribute('aria-label');
    if (ariaLbl) return ariaLbl.trim();
    // 5. Adjacent <td>/<th> — handles table-based forms (e.g. RoboForm test page)
    const cell = el.closest('td, th');
    if (cell) {
      const prev = cell.previousElementSibling;
      if (prev && /^t[dh]$/i.test(prev.tagName)) return prev.textContent.trim();
      // Fall back to first cell in the same row
      const firstCell = cell.closest('tr')?.querySelector('td, th');
      if (firstCell && firstCell !== cell) return firstCell.textContent.trim();
    }
    // 6. Preceding sibling element that looks like a label
    const prevEl = el.previousElementSibling;
    if (prevEl && /^(label|span|div|p|strong|b|legend|dt)$/i.test(prevEl.tagName)) {
      return prevEl.textContent.trim();
    }
    return '';
  }

  function matchRule(el) {
    // Autocomplete: split on spaces to handle e.g. "shipping given-name"
    const acTokens = (el.getAttribute('autocomplete') ?? '')
      .toLowerCase().trim().split(/\s+/).filter(Boolean);

    const name = (el.name        ?? '').trim();
    const id   = (el.id          ?? '').trim();
    const ph   = (el.placeholder ?? '').trim();
    const lbl  = labelText(el);

    const variants = [name, id, ph, lbl]
      .filter(Boolean)
      .flatMap(tokenVariants);

    for (const rule of RULES) {
      if (acTokens.length && rule.ac.some(a => acTokens.includes(a))) return rule.key;
      for (const tok of variants) {
        for (const rx of rule.rx) {
          if (rx.test(tok)) return rule.key;
        }
      }
    }
    return null;
  }

  function fillElement(el, value) {
    if (value == null || value === '') return false;
    const str = String(value);

    if (el.tagName === 'SELECT') {
      const lower = str.toLowerCase();
      const opt = Array.from(el.options).find(
        o => o.value.toLowerCase() === lower || o.text.toLowerCase() === lower
      );
      if (!opt) return false;
      el.value = opt.value;
    } else if (el.type === 'checkbox') {
      el.checked = /^(true|yes|1)$/i.test(str);
    } else {
      // Use native setter so React / Vue / Angular detect the mutation
      const proto  = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement : HTMLInputElement;
      const setter = Object.getOwnPropertyDescriptor(proto.prototype, 'value')?.set;
      setter ? setter.call(el, str) : (el.value = str);
    }

    el.dispatchEvent(new Event('input',  { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  async function injectImage(el, base64) {
    if (!base64) return;
    try {
      const res  = await fetch(base64);
      const blob = await res.blob();
      const file = new File([blob], 'image.jpg', { type: blob.type || 'image/jpeg' });
      const dt   = new DataTransfer();
      dt.items.add(file);
      el.files = dt.files;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (err) {
      console.warn('InstaForm: image injection failed', err);
    }
  }

  function showToast(msg, type = 'info') {
    const existing = document.getElementById('__if_toast');
    if (existing) existing.remove();

    const el = document.createElement('div');
    el.id = '__if_toast';
    const bg = { info: '#4F46E5', success: '#059669', warn: '#B45309' }[type] ?? '#4F46E5';
    Object.assign(el.style, {
      all: 'initial',
      display: 'block',
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      background: bg,
      color: '#fff',
      padding: '12px 18px',
      borderRadius: '8px',
      fontSize: '13px',
      fontFamily: 'system-ui,-apple-system,BlinkMacSystemFont,sans-serif',
      zIndex: '2147483647',
      boxShadow: '0 4px 18px rgba(0,0,0,.3)',
      lineHeight: '1.5',
      maxWidth: '300px',
      opacity: '1',
      transition: 'opacity .4s ease',
    });
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 420);
    }, 3000);
  }

  // ─── Main fill routine ────────────────────────────────────────────────────

  const isMainFrame = (window === window.top);

  window.__instaformRun = async function () {
    // Support both multi-profile format (v2) and legacy single-profile format (v1)
    const data = await chrome.storage.local.get(['profiles', 'activeProfileId', 'profile']);
    let profile = null;
    if (data.profiles?.length) {
      profile = data.profiles.find(p => p.id === data.activeProfileId) ?? data.profiles[0];
    } else if (data.profile) {
      profile = data.profile;
    }
    if (!profile) {
      showToast('No profile saved yet — click the InstaForm icon to set one up.', 'warn');
      return;
    }

    const selector = [
      'input:not([type=hidden]):not([type=submit]):not([type=button])',
      ':not([type=reset]):not([type=image]):not([type=file])',
      ',textarea,select',
    ].join('');

    const fileSelector = 'input[type=file]';

    let filled  = 0;
    let matched = 0;

    const allEls = [...document.querySelectorAll(selector)];

    for (const el of allEls) {
      const key   = matchRule(el);
      const value = key ? dig(profile, key) : null;
      if (key) matched++;
      if (value && fillElement(el, value)) filled++;
    }

    // Handle photo / signature file inputs
    for (const el of document.querySelectorAll(fileSelector)) {
      const key = matchRule(el);
      if (!key) continue;
      matched++;
      const value = dig(profile, key);
      if (value) {
        await injectImage(el, value);
        filled++;
      }
    }

    // Debug info in console — open DevTools → Console to see field details
    console.group('InstaForm debug');
    console.log(`Fields found by selector: ${allEls.length}`);
    allEls.forEach(el => {
      const key = matchRule(el);
      const lbl = labelText(el);
      console.log(
        `[${key ?? 'NO MATCH'}]`,
        el.tagName.toLowerCase(),
        `name="${el.name}" id="${el.id}"`,
        `ac="${el.getAttribute('autocomplete') ?? ''}"`,
        `label="${lbl}"`,
        `variants:`, [el.name, el.id, el.placeholder ?? '', lbl].filter(Boolean).flatMap(tokenVariants)
      );
    });
    console.groupEnd();

    if (filled > 0) {
      showToast(`InstaForm filled ${filled} field${filled !== 1 ? 's' : ''} ✓`, 'success');
    } else if (matched > 0) {
      showToast('Fields matched but profile data is empty — open InstaForm to fill in your details.', 'warn');
    } else if (isMainFrame) {
      // Only the main frame reports "nothing found" — sub-frames stay silent to avoid spam
      showToast(`No matches (${allEls.length} field${allEls.length !== 1 ? 's' : ''} found on this frame). Check DevTools console.`, 'warn');
    }
  };

  window.__instaformRun();
})();
