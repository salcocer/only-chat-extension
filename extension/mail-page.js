// Connect to email, page side: reads new Direct Messages from Instagram's own data and types your
// email replies into a chat. mail.js (the extension side) asks for both through window.postMessage.
//
// Runs in the page's own JavaScript world, like stories.js: the messages are in Instagram's Relay
// store, which the extension's world can't see. Reading the store doesn't open any chat, so nothing
// is marked as seen.
// Wrapped in a function so nothing here clashes with Instagram's own globals.
(() => {
    // Must match SOURCE in mail.js.
    const SOURCE = 'onlychat-mail';
    const SEND_CONFIRM_MS = 20 * 1000;

    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
    const normalize = text => String(text ?? '').replace(/\s+/g, ' ').trim();

    async function waitFor(check, timeoutMs) {
        for (const end = Date.now() + timeoutMs; Date.now() < end; await sleep(250)) {
            const value = check();
            if (value) return value;
        }
        return null;
    }

    // Instagram's Relay environment, found by walking up React's tree to the provider that holds it.
    let environment = null;
    function relayEnvironment() {
        if (environment) return environment;
        for (const el of document.querySelectorAll('[role="button"], [role="textbox"], main')) {
            const key = Object.keys(el).find(k => k.startsWith('__reactFiber$'));
            for (let fiber = el[key]; fiber; fiber = fiber.return) {
                const props = fiber.memoizedProps;
                const env = props?.value?.environment ?? props?.environment ?? props?.partnershipQueryRef?.environment;
                if (typeof env?.getStore === 'function') return (environment = env);
            }
        }
        return null;
    }

    function readStore() {
        const source = relayEnvironment()?.getStore().getSource();
        if (!source) return null;
        const get = ref => (ref?.__ref ? source.get(ref.__ref) : null);
        const getAll = refs => (refs?.__refs ?? []).map(id => source.get(id)).filter(Boolean);
        const records = source.getRecordIDs().map(id => source.get(id)).filter(Boolean);
        const threads = new Map();
        for (const record of records) {
            if (record.__typename !== 'XFBIGDirectViewerThread') continue;
            const users = getAll(record.users);
            const viewer = get(record.viewer);
            threads.set(String(record.thread_fbid), {
                record,
                users,
                // Messages name their sender by Facebook ID, which users carry in either of two fields.
                viewerIds: fbids(viewer),
                name:
                    record.thread_title ||
                    users.map(u => u.full_name || u.username).filter(Boolean).join(', ') ||
                    'Instagram',
            });
        }
        const messages = records.filter(r => r.__typename === 'SlideMessage');
        return { get, threads, messages };
    }

    function fbids(user) {
        return [user?.interop_messaging_user_fbid, user?.fbid_v2].filter(Boolean).map(String);
    }

    // Links worth emailing for messages that aren't plain text: a shared post or reel, a photo.
    function contentLinks(get, message) {
        const links = new Set();
        const walk = (record, depth) => {
            if (!record || depth > 3) return;
            for (const [key, value] of Object.entries(record)) {
                if (/^(preview_image|favicon|header_icon|sender)$/.test(key)) continue;
                if (/^(target_url|url|image_url|video_url|playable_url)$/.test(key) && /^https:\/\//.test(value)) links.add(value);
                else if (value?.__ref) walk(get(value), depth + 1);
            }
        };
        walk(get(message.content), 0);
        return [...links];
    }

    function contentText(get, message) {
        if (message.text_body) return message.text_body;
        const content = get(message.content);
        const xma = get(content?.xma);
        return (
            content?.xma_text_body ||
            [xma?.header_title_text, xma?.title_text, xma?.caption_body_text].filter(Boolean).join(' · ') ||
            message.igd_snippet ||
            ''
        );
    }

    // Messages from other people newer than `since` (ms), oldest first. Message requests are skipped.
    function collect(since) {
        const store = readStore();
        if (!store) return [];
        const { get, threads, messages } = store;
        const out = [];
        for (const message of messages) {
            const timestampMs = Number(message.timestamp_ms);
            if (!(timestampMs > since) || message.tombstone_reason) continue;
            const thread = threads.get(String(message.thread_fbid));
            if (!thread) continue;
            const { record } = thread;
            if (/PENDING|SPAM|OTHER/.test(`${record.system_folder} ${record.messaging_folder_tag}`)) continue;
            const senderId = String(message.sender_fbid);
            if (thread.viewerIds.includes(senderId)) continue;
            const sender = thread.users.find(u => fbids(u).includes(senderId));
            out.push({
                id: String(message.message_id || message.id),
                threadKey: String(record.thread_key),
                threadName: thread.name,
                isGroup: !!record.is_group,
                senderName: sender?.full_name || sender?.username || '',
                senderUsername: sender?.username || '',
                text: contentText(get, message),
                links: message.text_body ? [] : contentLinks(get, message),
                timestampMs,
            });
        }
        return out.sort((a, b) => a.timestampMs - b.timestampMs);
    }

    // Whether the store has a message you sent in this chat, with this text, since `since`.
    function sentToStore(threadKey, text, since) {
        const store = readStore();
        if (!store) return false;
        const thread = [...store.threads.values()].find(t => String(t.record.thread_key) === threadKey);
        if (!thread) return false;
        return store.messages.some(
            m =>
                String(m.thread_fbid) === String(thread.record.thread_fbid) &&
                thread.viewerIds.includes(String(m.sender_fbid)) &&
                Number(m.timestamp_ms) >= since &&
                normalize(m.text_body) === normalize(text)
        );
    }

    // Types `text` into the open chat's message box and presses Enter, the same as you would.
    async function send(threadKey, text) {
        if (!location.pathname.startsWith(`/direct/t/${threadKey}/`)) return { ok: false, error: "Couldn't open the chat." };
        const box = await waitFor(() => document.querySelector('[role="textbox"][contenteditable="true"][data-lexical-editor]'), 15000);
        if (!box) return { ok: false, error: 'The message box never appeared (the chat may not exist anymore).' };
        box.focus();
        // A paste keeps line breaks as line breaks; typing a newline would send the message early.
        const data = new DataTransfer();
        data.setData('text/plain', text);
        box.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
        if (!(await waitFor(() => normalize(box.textContent), 2000))) document.execCommand('insertText', false, text);
        if (!(await waitFor(() => normalize(box.textContent), 2000))) return { ok: false, error: "Couldn't type into the message box." };

        const since = Date.now() - 60 * 1000;
        const enter = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true });
        // The constructor ignores keyCode, and older editors still check it.
        Object.defineProperties(enter, { keyCode: { get: () => 13 }, which: { get: () => 13 } });
        box.dispatchEvent(enter);
        if (await waitFor(() => sentToStore(threadKey, text, since), SEND_CONFIRM_MS)) return { ok: true };
        // Some messages (e.g. ones Instagram reformats) never match exactly; an emptied box still means it went out.
        if (!normalize(box.textContent)) return { ok: true };
        return { ok: false, error: "Instagram didn't send the message." };
    }

    window.addEventListener('message', async e => {
        if (e.source !== window || e.data?.source !== SOURCE || e.data.direction !== 'request') return;
        const { id, type } = e.data;
        let result;
        try {
            if (type === 'ping') result = {};
            else if (type === 'collect') result = { messages: collect(e.data.since) };
            else result = await send(e.data.threadKey, e.data.text);
        } catch (err) {
            result = type === 'collect' ? { messages: [] } : { ok: false, error: String(err?.message || err) };
        }
        window.postMessage({ source: SOURCE, direction: 'response', id, result }, location.origin);
    });
})();
