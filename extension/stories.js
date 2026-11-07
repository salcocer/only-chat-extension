// Draws a ring around the picture of each person in the inbox who has a story, and opens that
// person's stories when the ring is clicked. content.js lets that one story through.
//
// Runs in the page's own JavaScript world, not the extension's: the only place the inbox says who
// a chat is with is the React data on each row, which the extension's world can't see.
// Wrapped in a function so nothing here clashes with Instagram's own globals.
(() => {
    // Must match STORY_GRANT in content.js.
    const STORY_GRANT = 'onlychat:story';
    // Instagram's web app ID, which instagram.com sends with its own API calls.
    const IG_APP_ID = '936619743392459';
    const TRAY_REFRESH_MS = 5 * 60 * 1000;

    // User ID -> { username, seen } for everyone you follow who has a story right now.
    let stories = new Map();
    let trayLoadedAt = 0;

    async function loadTray() {
        trayLoadedAt = Date.now();
        const res = await fetch('/api/v1/feed/reels_tray/', {
            headers: { 'X-IG-App-ID': IG_APP_ID, 'X-Requested-With': 'XMLHttpRequest' },
            credentials: 'include',
        });
        if (!res.ok) return;
        const { tray = [] } = await res.json();
        stories = new Map(
            tray
                .filter(reel => reel.user)
                .map(reel => [
                    String(reel.user.pk),
                    { username: reel.user.username, seen: reel.seen >= reel.latest_reel_media },
                ])
        );
    }

    // The other person's user ID for a one-to-one chat in the inbox, or null (e.g. a group chat).
    function chatUserId(row) {
        const key = Object.keys(row).find(k => k.startsWith('__reactFiber$'));
        for (let fiber = row[key], depth = 0; fiber && depth < 10; fiber = fiber.return, depth++) {
            const id = fiber.memoizedProps?.blockUserIgIdForSelection;
            if (id) return String(id);
        }
        return null;
    }

    function isActive() {
        // content.js sets this attribute from the popup settings.
        return document.documentElement.dataset.onlychatStories === 'on' && location.pathname.startsWith('/direct/');
    }

    function markAvatars() {
        if (isActive() && Date.now() - trayLoadedAt > TRAY_REFRESH_MS) loadTray().catch(() => {});
        for (const row of document.querySelectorAll('[role="button"]')) {
            const avatar = row.querySelector('img');
            if (!avatar) continue;
            const story = isActive() ? stories.get(chatUserId(row)) : undefined;
            if (story) {
                avatar.dataset.onlychatStory = story.seen ? 'seen' : 'new';
                avatar.dataset.onlychatUsername = story.username;
            } else if (avatar.dataset.onlychatStory) {
                delete avatar.dataset.onlychatStory;
                delete avatar.dataset.onlychatUsername;
            }
        }
    }

    // Catch the click before Instagram opens the chat, so clicking the picture opens the story instead.
    window.addEventListener(
        'click',
        e => {
            if (!isActive()) return;
            const row = e.target instanceof Element ? e.target.closest('[role="button"]') : null;
            const avatar = row?.querySelector('img[data-onlychat-story]');
            if (!avatar) return;
            const box = avatar.getBoundingClientRect();
            const onAvatar = e.clientX >= box.left && e.clientX <= box.right && e.clientY >= box.top && e.clientY <= box.bottom;
            if (!onAvatar) return;
            e.preventDefault();
            e.stopPropagation();
            const { onlychatUsername: username } = avatar.dataset;
            sessionStorage.setItem(STORY_GRANT, JSON.stringify({ username, returnTo: location.pathname }));
            location.assign(`/stories/${encodeURIComponent(username)}/`);
        },
        true
    );

    setInterval(markAvatars, 1000);
})();
