// Marks the Notes row at the top of the inbox so content.css can hide it.
//
// Runs in the page's own JavaScript world, like stories.js: the row has no stable class or label,
// so the only reliable way to find it is the name of the React component that draws it.
// Wrapped in a function so nothing here clashes with Instagram's own globals.
(() => {
    let notesTray = null;

    function isNotesTray(el) {
        const key = Object.keys(el).find(k => k.startsWith('__reactFiber$'));
        for (let fiber = el[key], depth = 0; fiber && depth < 4; fiber = fiber.return, depth++) {
            const type = fiber.type;
            if (typeof type !== 'string' && String(type?.displayName ?? type?.name ?? '').includes('IGDInboxTray')) return true;
        }
        return false;
    }

    function markNotesTray() {
        if (notesTray?.isConnected || !location.pathname.startsWith('/direct/')) return;
        notesTray = [...document.querySelectorAll('div')].find(isNotesTray) ?? null;
        if (notesTray) notesTray.dataset.onlychatNotes = '';
    }

    // Watch for the row being added, so it's hidden before it shows rather than up to a second later.
    let scheduled = false;
    new MutationObserver(() => {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(() => {
            scheduled = false;
            markNotesTray();
        });
    }).observe(document.documentElement, { childList: true, subtree: true });
    markNotesTray();
})();
