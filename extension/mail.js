// Connect to email, tab side. Runs in the pinned Instagram tab that background.js keeps open:
// on each tick it hands new messages from mail-page.js to the bridge, and sends the email replies
// the bridge returns by opening each chat and typing them in.
//
// A reply is sent across a page load (open the chat, type, go back to the inbox), so what's in
// progress is kept in sessionStorage, which belongs to this tab only.

// Must match SOURCE in mail-page.js.
const SOURCE = 'onlychat-mail';
const PENDING = 'onlychat:mail-pending'; // { id, threadKey, text }: the reply being sent right now
const RESULTS = 'onlychat:mail-results'; // { [id]: { ok, error } }: sent, but the bridge hasn't heard yet
const INBOX_PATH = '/direct/inbox/';

const readJson = (key, fallback) => {
    try {
        return JSON.parse(sessionStorage.getItem(key)) ?? fallback;
    } catch {
        return fallback;
    }
};
const writeJson = (key, value) => sessionStorage.setItem(key, JSON.stringify(value));

// Ask mail-page.js for something and wait for its answer.
function askPage(type, payload, timeoutMs) {
    const id = crypto.randomUUID();
    return new Promise(resolve => {
        const timer = setTimeout(() => {
            window.removeEventListener('message', onMessage);
            resolve(null);
        }, timeoutMs);
        function onMessage(e) {
            if (e.source !== window || e.data?.source !== SOURCE || e.data.direction !== 'response' || e.data.id !== id) return;
            clearTimeout(timer);
            window.removeEventListener('message', onMessage);
            resolve(e.data.result);
        }
        window.addEventListener('message', onMessage);
        window.postMessage({ source: SOURCE, direction: 'request', id, type, ...payload }, location.origin);
    });
}

async function reportResults() {
    const results = readJson(RESULTS, {});
    for (const [id, result] of Object.entries(results)) {
        const reply = await chrome.runtime.sendMessage({ type: 'mail:result', id, ...result }).catch(() => null);
        if (!reply?.ok) return false;
        delete results[id];
        writeJson(RESULTS, results);
    }
    return true;
}

// Called by background.js about every 30 seconds.
async function tick(since) {
    if (sessionStorage.getItem(PENDING)) return;
    const found = await askPage('collect', { since }, 5000);
    const reply = await chrome.runtime.sendMessage({ type: 'mail:sync', messages: found?.messages ?? [] }).catch(() => null);
    if (!reply?.ok || !(await reportResults())) return;
    // Anything already sent is skipped: its result just hasn't reached the bridge yet.
    const done = readJson(RESULTS, {});
    const next = reply.outbox.find(item => !(item.id in done));
    if (!next) return;
    writeJson(PENDING, next);
    location.assign(`/direct/t/${encodeURIComponent(next.threadKey)}/`);
}

// After the chat for a pending reply has loaded: send it, remember the result, go back to the inbox.
async function finishPending() {
    const pending = readJson(PENDING, null);
    if (!pending) return;
    // mail-page.js loads at about the same time as this script; wait until it answers.
    for (let i = 0; i < 20 && !(await askPage('ping', {}, 500)); i++);
    const result = (await askPage('send', { threadKey: pending.threadKey, text: pending.text }, 60 * 1000)) ?? {
        ok: false,
        error: 'Timed out while sending.',
    };
    writeJson(RESULTS, { ...readJson(RESULTS, {}), [pending.id]: result });
    sessionStorage.removeItem(PENDING);
    await reportResults();
    // Back to the inbox, so new messages in that chat aren't marked as seen.
    location.assign(INBOX_PATH);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== 'mail:tick') return;
    tick(message.since).finally(() => sendResponse(true));
    return true;
});

finishPending();
