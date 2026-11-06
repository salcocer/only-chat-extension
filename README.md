# OnlyChat
 <!-- ChatOnly is a clean, distraction-free chat app built for real conversations with the people who matter most. Instead of feeds, likes, and endless scrolling, ChatOnly focuses on the essentials: one-to-one and group messaging, plus simple photo and video sharing so friends and families can stay close in a natural, meaningful way. With a modern, minimal interface across web, iOS, and Android. -->

 <!-- ChatOnly makes it easy to communicate with your favorite people, keep up with everyday moments, and have deeper conversations—without the noise of social media. -->

When you want to stay connected but don't want to get sucked into the social media rabbit hole.

 <!-- ChatOnly is the perfect solution. With its clean, distraction-free design, you can focus on what really matters: connecting with your friends and family in a meaningful way. Whether you're sharing photos, videos, or just chatting, ChatOnly keeps it simple and enjoyable. -->

 <!-- Say goodbye to endless scrolling and notifications, and hello to genuine conversations with the people who matter most. -->

<img width="1152" height="472" alt="Screenshot from 2026-02-26 13-45-51" src="https://github.com/user-attachments/assets/6c458a77-0e6e-48ce-85d9-3d0df58501c6" />

## How it works

OnlyChat is for personal Instagram accounts. The user logs in on the real instagram.com, and OnlyChat hides everything except Direct Messages: no feed, Reels, Explore or Stories.

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
| `/accounts/...`, `/challenge/...`: login, two-factor, logout | Stories, profiles |
| Single posts and reels (`/p/...`, `/reel/...`), so ones shared in a chat can be opened. Can be turned off. | Everything else |

The toolbar popup has two switches: **Chat-only mode** (turn OnlyChat off without uninstalling it) and **Allow shared posts and reels**. Settings sync through your Chrome account.

## Repository structure

| Path | Description |
| --- | --- |
| `extension/manifest.json` | Manifest V3. Only permission is `storage`; runs on `instagram.com`. |
| `extension/content.js` | Sends any page that isn't a chat back to the inbox and stops clicks on blocked links. |
| `extension/content.css` | Hides the Home, Explore, Reels and Threads links. |
| `extension/popup.html`, `popup.js` | Toolbar popup with the settings and an **Open Messages** button. |
| `design/` | Excalidraw wireframes and reference screenshots. |
