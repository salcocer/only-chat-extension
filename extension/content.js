// Keeps instagram.com limited to Direct Messages.
// Any page that isn't a chat (or needed to log in) is sent back to the inbox.

const INBOX = '/direct/inbox/';
const DEFAULTS = { enabled: true, allowSharedPosts: true, allowStories: true, allowOwnProfile: true };

const DM_PATHS = [/^\/direct\//];
// Login, two-factor, checkpoint and logout pages.
const ACCOUNT_PATHS = [/^\/accounts\//, /^\/challenge\//, /^\/auth_platform\//, /^\/two_factor\//];
// A single post or reel, e.g. one someone shared in a chat.
const SHARED_POST_PATHS = [/^\/(p|reel|tv)\/[^/]+/, /^\/[^/]+\/(p|reel)\/[^/]+/];
// One person's stories, e.g. /stories/username/ or /stories/username/1234567890/.
const STORY_PATH = /^\/stories\/([^/]+)/;
// Set by stories.js when a ring in the inbox is clicked: { username, returnTo }.
// Only that person's stories are let through, and leaving them goes back to returnTo.
const STORY_GRANT = 'onlychat:story';
// Your own username, saved by profile.js from the Profile link in Instagram's sidebar.
const OWN_USERNAME = 'onlychat:me';

let settings = { ...DEFAULTS };

function storyGrant() {
    try {
        return JSON.parse(sessionStorage.getItem(STORY_GRANT));
    } catch {
        return null;
    }
}

function isGrantedStory(pathname) {
    const username = STORY_PATH.exec(pathname)?.[1];
    return settings.allowStories && username !== undefined && username === storyGrant()?.username;
}

// Your profile and its tabs, e.g. /username/ or /username/saved/. Nobody else's.
function isOwnProfile(pathname) {
    const me = localStorage.getItem(OWN_USERNAME);
    return settings.allowOwnProfile && !!me && pathname.split('/')[1].toLowerCase() === me;
}

function isAllowed(pathname) {
    if (!settings.enabled) return true;
    if (DM_PATHS.some(re => re.test(pathname))) return true;
    if (ACCOUNT_PATHS.some(re => re.test(pathname))) return true;
    if (isGrantedStory(pathname)) return true;
    if (isOwnProfile(pathname)) return true;
    return settings.allowSharedPosts && SHARED_POST_PATHS.some(re => re.test(pathname));
}

// Back to the chat a story was opened from, or the inbox.
function sendBack() {
    const returnTo = storyGrant()?.returnTo;
    location.replace(DM_PATHS.some(re => re.test(returnTo)) ? returnTo : INBOX);
}

function enforce() {
    // content.css and stories.js only apply while these attributes are set.
    document.documentElement.dataset.onlychat = settings.enabled ? 'on' : 'off';
    document.documentElement.dataset.onlychatStories = settings.enabled && settings.allowStories ? 'on' : 'off';
    // Back in the chats, so the story that was opened is over.
    if (DM_PATHS.some(re => re.test(location.pathname))) sessionStorage.removeItem(STORY_GRANT);
    // Also catches the story viewer moving on to someone else's stories, or closing.
    if (!isAllowed(location.pathname)) sendBack();
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
        // Inside a story, a link to anywhere else (e.g. the close button) goes back to the chat.
        if (isGrantedStory(location.pathname)) sendBack();
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
