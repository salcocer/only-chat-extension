// Connect to email. While it's on, a pinned Instagram tab stays open in the background, and every
// 30 seconds that tab (mail.js) is asked to pass new messages to the bridge and send your replies.
// The bridge (wa-gmail-bridge) does the emailing; this only talks to it, on this computer.

// Must match DEFAULTS in popup.js.
const DEFAULTS = { emailBridge: false, bridgeUrl: 'http://127.0.0.1:3789' };
const INBOX_URL = 'https://www.instagram.com/direct/inbox/';
const ALARM = 'onlychat-mail';
// Messages a little older than the newest one emailed are offered again, in case Instagram delivered
// them late; the bridge drops the ones it has already emailed.
const OVERLAP_MS = 10 * 60 * 1000;

async function settings() {
    const synced = await chrome.storage.sync.get(DEFAULTS);
    // The secret stays on this computer, not in your Chrome account.
    const { bridgeSecret = '' } = await chrome.storage.local.get('bridgeSecret');
    return { ...synced, bridgeSecret };
}

const setStatus = status => chrome.storage.local.set({ mailStatus: { ...status, at: Date.now() } });

async function callBridge(path, body) {
    const { bridgeUrl, bridgeSecret } = await settings();
    let res;
    try {
        res = await fetch(new URL(path, bridgeUrl), {
            method: 'POST',
            headers: { 'content-type': 'application/json', authorization: `Bearer ${bridgeSecret}` },
            body: JSON.stringify(body),
        });
    } catch {
        throw new Error(`The bridge isn't running at ${bridgeUrl}.`);
    }
    if (res.status === 401) throw new Error("The bridge didn't accept the secret.");
    if (!res.ok) throw new Error(`The bridge answered ${res.status}.`);
    return res.json();
}

// The pinned tab this feature uses, opened if it's gone.
async function mailTab() {
    const { mailTabId } = await chrome.storage.session.get('mailTabId');
    if (mailTabId) {
        const tab = await chrome.tabs.get(mailTabId).catch(() => null);
        if (tab?.url?.startsWith('https://www.instagram.com/')) return tab;
    }
    const tab = await chrome.tabs.create({ url: INBOX_URL, pinned: true, active: false });
    // Keep Chrome's Memory Saver from unloading it.
    await chrome.tabs.update(tab.id, { autoDiscardable: false });
    await chrome.storage.session.set({ mailTabId: tab.id });
    return tab;
}

async function tick() {
    const { emailBridge, bridgeSecret } = await settings();
    if (!emailBridge) return;
    if (!bridgeSecret) {
        await setStatus({ ok: false, error: 'Add the bridge secret.' });
        return;
    }
    const tab = await mailTab();
    if (tab.status !== 'complete') return;
    const { mailEnabledAt = Date.now(), mailWatermark = 0 } = await chrome.storage.local.get(['mailEnabledAt', 'mailWatermark']);
    const since = Math.max(mailEnabledAt, mailWatermark - OVERLAP_MS);
    // Fails while the tab is loading; the next tick tries again.
    await chrome.tabs.sendMessage(tab.id, { type: 'mail:tick', since }).catch(() => {});
}

async function sync(messages) {
    const { outbox } = await callBridge('/ig/sync', { messages });
    const newest = Math.max(0, ...messages.map(m => m.timestampMs));
    const { mailWatermark = 0 } = await chrome.storage.local.get('mailWatermark');
    if (newest > mailWatermark) await chrome.storage.local.set({ mailWatermark: newest });
    await setStatus({ ok: true, forwarded: messages.length, queued: outbox.length });
    return { ok: true, outbox };
}

async function report({ id, ok, error }) {
    await callBridge('/ig/result', { id, ok, error });
    return { ok: true };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!sender.tab || !message?.type?.startsWith('mail:')) return;
    const work = message.type === 'mail:sync' ? sync(message.messages) : report(message);
    work.then(sendResponse, async err => {
        await setStatus({ ok: false, error: err.message });
        sendResponse({ ok: false });
    });
    return true;
});

async function apply() {
    const { emailBridge } = await settings();
    if (!emailBridge) {
        await chrome.alarms.clear(ALARM);
        const { mailTabId } = await chrome.storage.session.get('mailTabId');
        if (mailTabId) await chrome.tabs.remove(mailTabId).catch(() => {});
        await chrome.storage.session.remove('mailTabId');
        return;
    }
    if (!(await chrome.alarms.get(ALARM))) await chrome.alarms.create(ALARM, { periodInMinutes: 0.5 });
    await tick();
}

chrome.alarms.onAlarm.addListener(alarm => {
    if (alarm.name === ALARM) tick();
});

chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area === 'sync' && changes.emailBridge) {
        // Only messages that arrive from now on are emailed, never your whole inbox.
        if (changes.emailBridge.newValue) await chrome.storage.local.set({ mailEnabledAt: Date.now(), mailWatermark: 0 });
        apply();
    }
    if (area === 'local' && changes.bridgeSecret) apply();
});

chrome.runtime.onStartup.addListener(apply);
chrome.runtime.onInstalled.addListener(apply);
