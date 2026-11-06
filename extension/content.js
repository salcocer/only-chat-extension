// Keeps instagram.com limited to Direct Messages.
// Any page that isn't a chat (or needed to log in) is sent back to the inbox.

const INBOX = '/direct/inbox/';
const DEFAULTS = { enabled: true, allowSharedPosts: true };

const DM_PATHS = [/^\/direct\//];
// Login, two-factor, checkpoint and logout pages.
const ACCOUNT_PATHS = [/^\/accounts\//, /^\/challenge\//, /^\/auth_platform\//, /^\/two_factor\//];
// A single post or reel, e.g. one someone shared in a chat.
const SHARED_POST_PATHS = [/^\/(p|reel|tv)\/[^/]+/, /^\/[^/]+\/(p|reel)\/[^/]+/];

let settings = { ...DEFAULTS };

function isAllowed(pathname) {
    if (!settings.enabled) return true;
    if (DM_PATHS.some(re => re.test(pathname))) return true;
    if (ACCOUNT_PATHS.some(re => re.test(pathname))) return true;
    return settings.allowSharedPosts && SHARED_POST_PATHS.some(re => re.test(pathname));
}

function enforce() {
    // content.css only applies while this attribute is set.
    document.documentElement.dataset.onlychat = settings.enabled ? 'on' : 'off';
    if (!isAllowed(location.pathname)) location.replace(INBOX);
}

// Stop clicks on links to blocked pages before Instagram's router handles them,
// so the page doesn't flash before being sent back to the inbox.
window.addEventListener(
    'click',
    e => {
        const link = e.target instanceof Element ? e.target.closest('a[href]') : null;
        if (!link) return;
        const url = new URL(link.href, location.href);
        if (url.hostname !== location.hostname || isAllowed(url.pathname)) return;
        e.preventDefault();
        e.stopPropagation();
    },
    true
);

// Instagram is a single-page app, so navigation doesn't reload the page.
// Polling the path catches every route change, including ones made from code.
let lastPath = null;
setInterval(() => {
    if (location.pathname === lastPath) return;
    lastPath = location.pathname;
    enforce();
}, 250);

chrome.storage.sync.get(DEFAULTS).then(stored => {
    settings = stored;
    enforce();
});

chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    for (const [key, { newValue }] of Object.entries(changes)) {
        settings[key] = newValue ?? DEFAULTS[key];
    }
    enforce();
});
