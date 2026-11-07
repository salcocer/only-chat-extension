// Finds your own username from the Profile link in Instagram's sidebar, so content.js can let your
// profile through and nobody else's.
//
// Runs in the page's own JavaScript world, like stories.js: other profile links look the same,
// and only the React data behind this one says it's yours.
// Wrapped in a function so nothing here clashes with Instagram's own globals.
(() => {
    // Must match OWN_USERNAME in content.js.
    const OWN_USERNAME = 'onlychat:me';

    function isOwnProfileLink(link) {
        const key = Object.keys(link).find(k => k.startsWith('__reactFiber$'));
        for (let fiber = link[key], depth = 0; fiber && depth < 14; fiber = fiber.return, depth++) {
            if (fiber.memoizedProps?.actionName === 'userMenuProfileClick') return true;
        }
        return false;
    }

    function saveOwnUsername() {
        const link = [...document.querySelectorAll('a[href]')].find(
            a => /^\/[^/]+\/$/.test(a.getAttribute('href')) && isOwnProfileLink(a)
        );
        if (!link) return false;
        // Saved for the whole site, so a profile page loaded directly can be let through right away.
        localStorage.setItem(OWN_USERNAME, link.getAttribute('href').slice(1, -1).toLowerCase());
        return true;
    }

    // The sidebar renders after the page loads; stop watching once it's found.
    let scheduled = false;
    const observer = new MutationObserver(() => {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(() => {
            scheduled = false;
            if (saveOwnUsername()) observer.disconnect();
        });
    });
    if (!saveOwnUsername()) observer.observe(document.documentElement, { childList: true, subtree: true });
})();
