# OnlyChat
 <!-- ChatOnly is a clean, distraction-free chat app built for real conversations with the people who matter most. Instead of feeds, likes, and endless scrolling, ChatOnly focuses on the essentials: one-to-one and group messaging, plus simple photo and video sharing so friends and families can stay close in a natural, meaningful way. With a modern, minimal interface across web, iOS, and Android. -->

 <!-- ChatOnly makes it easy to communicate with your favorite people, keep up with everyday moments, and have deeper conversations—without the noise of social media. -->

When you want to stay connected but don't want to get sucked into the social media rabbit hole.

 <!-- ChatOnly is the perfect solution. With its clean, distraction-free design, you can focus on what really matters: connecting with your friends and family in a meaningful way. Whether you're sharing photos, videos, or just chatting, ChatOnly keeps it simple and enjoyable. -->

 <!-- Say goodbye to endless scrolling and notifications, and hello to genuine conversations with the people who matter most. -->

<img width="1152" height="472" alt="Screenshot from 2026-02-26 13-45-51" src="https://github.com/user-attachments/assets/6c458a77-0e6e-48ce-85d9-3d0df58501c6" />

## Repository structure

This repo holds the OnlyChat app plus its design assets and in-progress redesign:

| Folder | Description |
| --- | --- |
| [`chat/`](chat/README.md) | The active Next.js app: Instagram Business Login, conversations dashboard, and a Socket.IO server for realtime webhook delivery. See its README for setup, environment variables, and architecture. |
| `chat_website_next/` | An in-progress UI redesign of the same app, scaffolded from a shadcn/ui + v0 dashboard template. Shares the same Instagram OAuth/API logic as `chat/` but with a different component library; not yet feature-complete. |
| `chat-chrome-extension/` | Placeholder for a planned browser extension companion; currently empty. |
| `design/` | Excalidraw wireframes and reference screenshots (`Dashboard.png`, `Home.png`) used while designing the UI. |

For how the Instagram integration works (OAuth login, access tokens, webhooks), see [`chat/README.md`](chat/README.md) and [`chat/README_WEBHOOKS.md`](chat/README_WEBHOOKS.md).
