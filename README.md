# OnlyChat
 <!-- ChatOnly is a clean, distraction-free chat app built for real conversations with the people who matter most. Instead of feeds, likes, and endless scrolling, ChatOnly focuses on the essentials: one-to-one and group messaging, plus simple photo and video sharing so friends and families can stay close in a natural, meaningful way. With a modern, minimal interface across web, iOS, and Android. -->

 <!-- ChatOnly makes it easy to communicate with your favorite people, keep up with everyday moments, and have deeper conversations—without the noise of social media. -->

When you want to stay connected but don't want to get sucked into the social media rabbit hole.

 <!-- ChatOnly is the perfect solution. With its clean, distraction-free design, you can focus on what really matters: connecting with your friends and family in a meaningful way. Whether you're sharing photos, videos, or just chatting, ChatOnly keeps it simple and enjoyable. -->

 <!-- Say goodbye to endless scrolling and notifications, and hello to genuine conversations with the people who matter most. -->

<img width="1152" height="472" alt="Screenshot from 2026-02-26 13-45-51" src="https://github.com/user-attachments/assets/6c458a77-0e6e-48ce-85d9-3d0df58501c6" />

## How it works

OnlyChat is for personal Instagram accounts. The user logs in on the real instagram.com, and OnlyChat hides everything except Direct Messages: no feed, Reels, Explore or Notes. Stories can only be opened from the inbox, for the people you chat with.

OnlyChat never sees the user's password or access token. Meta has no API for personal accounts' DMs (the Basic Display API never covered messages and was shut down in December 2024), so OnlyChat works on top of the user's own logged-in session instead.

## Install (development)

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and select the `extension/` folder.
3. Go to instagram.com and log in. You land in your inbox, and any other page sends you back to it.

After changing a file, click the reload icon on the OnlyChat card in `chrome://extensions` and refresh Instagram.

## What gets blocked

| Allowed | Blocked (sent back to the inbox) |
| --- | --- |
| `/direct/...`: inbox, chats, message requests | Home feed, Explore, Reels |
| `/accounts/...`, `/challenge/...`: login, two-factor, logout | Other people's profiles |
| Single posts and reels (`/p/...`, `/reel/...`), so ones shared in a chat can be opened. Can be turned off. | Stories, unless opened from the inbox |
| One person's stories (`/stories/<username>/...`), opened by clicking the ring around their picture in the inbox. Can be turned off. | |
| Your own profile (`/<your username>/...`), from the Profile link in the sidebar. Can be turned off. | Everything else |

The toolbar popup has four switches: **Chat-only mode** (turn OnlyChat off without uninstalling it), **Allow shared posts and reels**, **Stories from your chats** and **Your profile**. Settings sync through your Chrome account.

### Look

While Chat-only mode is on, Instagram is restyled in the style of [shadcn/ui](https://ui.shadcn.com/): its neutral palette, near-black buttons and outgoing message bubbles instead of Instagram blue, the Geist font, and inputs with a thin border instead of grey pills. It follows Instagram's own light or dark mode.

Instagram colors almost everything through `--ig-*` CSS variables holding `r, g, b` triples, so `theme.css` only overrides those variables, plus the font and the input shapes. No markup or behavior changes.

### Stories from your chats

In the inbox, a one-to-one chat whose person has a story gets a ring around their picture: pink if there's something new, grey if you've seen it all. Clicking the picture opens only that person's stories. When they end, or you close them, you go back to the chat you came from. If the viewer moves on to someone else's stories, that's blocked too. Typing a `/stories/...` address yourself is still sent back to the inbox.

The inbox doesn't say who has a story, so `stories.js` asks Instagram's own story tray (`/api/v1/feed/reels_tray/`, the same call the home page makes) with your session, and matches it to each chat by user ID. It runs in the page's JavaScript world because the user ID for a chat is only in Instagram's React data on the row. Instagram's web app has no story rings in the inbox, so the ring is drawn by OnlyChat.

## Repository structure

| Path | Description |
| --- | --- |
| `extension/manifest.json` | Manifest V3. Only permission is `storage`; runs on `instagram.com`. |
| `extension/content.js` | Sends any page that isn't a chat back to the inbox and stops clicks on blocked links. |
| `extension/content.css` | Hides the Home, Explore, Reels and Threads links and the Notes row, and draws the story rings. |
| `extension/theme.css` | Restyles Instagram in the style of shadcn/ui: neutral greys, near-black buttons and bubbles, thin borders. |
| `extension/fonts/` | The Geist font, embedded in `geist.css`, and its license. |
| `extension/stories.js` | Finds which chats have a story and opens it when the ring is clicked. |
| `extension/profile.js` | Reads your username from the sidebar's Profile link, so only your own profile is let through. |
| `extension/notes.js` | Finds the Notes row at the top of the inbox so `content.css` can hide it. |
| `extension/popup.html`, `popup.js` | Toolbar popup with the settings and an **Open Messages** button. |
| `design/` | Excalidraw wireframes and reference screenshots. |
