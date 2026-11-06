// Must match DEFAULTS in content.js.
const DEFAULTS = { enabled: true, allowSharedPosts: true };

const inputs = document.querySelectorAll('input[name]');

chrome.storage.sync.get(DEFAULTS).then(settings => {
    for (const input of inputs) input.checked = settings[input.name];
});

for (const input of inputs) {
    input.addEventListener('change', () => {
        chrome.storage.sync.set({ [input.name]: input.checked });
    });
}

document.getElementById('open').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://www.instagram.com/direct/inbox/' });
});
