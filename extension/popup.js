// content.js and background.js each keep the part of these they use.
const DEFAULTS = {
    enabled: true,
    allowSharedPosts: true,
    allowStories: true,
    allowOwnProfile: true,
    emailBridge: false,
    bridgeUrl: 'http://127.0.0.1:3789',
};
// The extension may only reach a bridge on this computer (see host_permissions in manifest.json).
const LOCAL_URL = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/;

const switches = document.querySelectorAll('input[type="checkbox"][name]');
const mailSettings = document.getElementById('mail-settings');
const bridgeUrl = document.getElementById('bridge-url');
const bridgeSecret = document.getElementById('bridge-secret');
const mailStatus = document.getElementById('mail-status');

chrome.storage.sync.get(DEFAULTS).then(settings => {
    for (const input of switches) input.checked = settings[input.name];
    mailSettings.hidden = !settings.emailBridge;
    bridgeUrl.value = settings.bridgeUrl;
});
chrome.storage.local.get('bridgeSecret').then(({ bridgeSecret: secret = '' }) => {
    bridgeSecret.value = secret;
});

for (const input of switches) {
    input.addEventListener('change', () => {
        chrome.storage.sync.set({ [input.name]: input.checked });
        if (input.name === 'emailBridge') mailSettings.hidden = !input.checked;
    });
}

bridgeUrl.addEventListener('change', () => {
    const url = bridgeUrl.value.trim().replace(/\/$/, '') || DEFAULTS.bridgeUrl;
    if (!LOCAL_URL.test(url)) {
        showStatus({ ok: false, error: 'The bridge has to be on this computer (http://127.0.0.1:<port>).' });
        return;
    }
    bridgeUrl.value = url;
    chrome.storage.sync.set({ bridgeUrl: url });
});

bridgeSecret.addEventListener('change', () => {
    chrome.storage.local.set({ bridgeSecret: bridgeSecret.value.trim() });
});

function ago(ms) {
    const s = Math.round((Date.now() - ms) / 1000);
    return s < 60 ? `${s}s ago` : `${Math.round(s / 60)} min ago`;
}

function showStatus(status) {
    if (!status) {
        mailStatus.textContent = 'Not connected yet. It checks every 30 seconds.';
        delete mailStatus.dataset.ok;
        return;
    }
    mailStatus.dataset.ok = String(status.ok);
    mailStatus.textContent = status.ok
        ? `Connected, checked ${ago(status.at)}.${status.queued ? ` ${status.queued} replies waiting to send.` : ''}`
        : status.error;
}

chrome.storage.local.get('mailStatus').then(({ mailStatus: status }) => showStatus(status));
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.mailStatus) showStatus(changes.mailStatus.newValue);
});

document.getElementById('open').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://www.instagram.com/direct/inbox/' });
});
