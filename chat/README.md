## Overview

OnlyChat is a Next.js app that lets an Instagram professional account owner log in via
**Instagram Business Login**, view their DM conversations, and reply from a simple web dashboard.
Incoming messages arrive as Meta webhooks and are pushed to the browser in realtime over
Socket.IO.

## Tech stack

- **Next.js 16** (App Router) + React 19, served through a custom **`server/index.js`**
  (plain `http` server) so a **Socket.IO** server can share the same port.
- **Zustand** for client state (`store/`): current user, conversations, webhook events.
- **`jose`** for JWT session helpers (`store/session.ts`) — currently unused in favor of
  an HttpOnly cookie set directly by the API route (see Architecture below).
- **Tailwind CSS v4** for styling.
- Instagram **Graph API** (`graph.instagram.com`) accessed via `lib/api.ts`.

## Getting started

1. Install dependencies (this workspace uses pnpm):
   ```bash
   pnpm install
   ```
2. Create a `.env.local` file in `chat/` with the variables from
   [Environment variables](#environment-variables) below.
3. Run the dev server (this starts Next.js *and* the Socket.IO server together, see `server/index.js`):
   ```bash
   pnpm dev
   ```
4. Open `http://localhost:3000` and click **Log in with Instagram**. In development, API routes
   read `NEXT_PUBLIC_ACCESS_TOKEN` directly instead of requiring the cookie set by the OAuth
   exchange (see `app/api/instagram/conversations/route.ts`), so you can test against a real
   Instagram account without completing the full redirect flow.

### Available scripts

| Script | Description |
| --- | --- |
| `pnpm dev` | Builds nothing extra — runs `server/index.js`, which boots Next.js and attaches Socket.IO to the same HTTP server. |
| `pnpm build` | `next build` for production. |
| `pnpm start` | Runs the same custom server against the production build. |
| `pnpm lint` | Runs ESLint. |
| `pnpm socket-server` | Runs the **standalone** Socket.IO relay in `server/socket-server.js` (port 4000) — a leftover/alternative to the socket server embedded in `server/index.js`; not used by `pnpm dev`. |

### Environment variables

All variables are read server-side (in API routes) even though most are prefixed
`NEXT_PUBLIC_*`; none are referenced from client components except non-secret ones.

| Variable | Used in | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_INSTAGRAM_APP_ID` | `LogIn.tsx`, `api/auth/exchange` | Instagram app's Client ID, used both to build the OAuth authorize URL and to exchange the code. |
| `NEXT_PUBLIC_INSTAGRAM_APP_SECRET` | `api/auth/exchange`, `api/instagram/webhook` | App secret — exchanges tokens server-side and verifies webhook `X-Hub-Signature(-256)`. |
| `NEXT_PUBLIC_INSTAGRAM_REDIRECT_URI` | `LogIn.tsx`, `api/auth/exchange` | OAuth redirect URI registered in the Meta App Dashboard. |
| `NEXT_PUBLIC_INSTAGRAM_SCOPE` | `LogIn.tsx` | Comma-separated Instagram permission scopes requested at login (e.g. `instagram_business_basic,instagram_business_manage_messages`). |
| `NEXT_PUBLIC_INSTAGRAM_WEBHOOK_VERIFY_TOKEN` | `api/instagram/webhook` | Token Meta's webhook subscribe (`hub.verify_token`) request must match. |
| `NEXT_PUBLIC_ACCESS_TOKEN` | `api/instagram/*` routes | **Dev-only override.** When `NODE_ENV=development`, API routes use this token instead of the `access_token` cookie, so you don't need to complete the OAuth redirect locally. |
| `NEXT_PUBLIC_SOCKET_URL` | `server/index.js`, `api/instagram/webhook`, `useSocket.ts` | Origin used for Socket.IO CORS and as the `/broadcast` target the webhook route posts incoming events to. |
| `NEXT_PUBLIC_SESSION_SECRET` | `store/session.ts` | HMAC secret for the (currently unused) JWT session helpers. |
| `PORT` | `server/index.js` | Port for the combined Next.js + Socket.IO server (defaults to `3000`). |

### Project structure

```
app/
  page.tsx                       Landing page + login (redirects to /dashboard if already authed)
  dashboard/                     Authenticated shell (Profile, conversation list, message thread)
  api/auth/exchange/             OAuth code -> short-lived -> long-lived token exchange, sets cookies
  api/instagram/conversations/   List conversations / fetch messages for one conversation
  api/instagram/media/           Fetch the logged-in user's media
  api/instagram/me/              Fetch profile info for the current user (and by id)
  api/instagram/webhook/         Meta webhook verification (GET) + event receiver (POST)
  api/instagram/webhook/events/  Reads persisted events from webhook_events.json
components/                      UI components (LogIn, Conversations, ConversationDetail, MessageComposer, ...)
hooks/                           useSocket (shared Socket.IO client), useChatScroll, useKeysConversation
lib/api.ts                       Thin wrappers around the Instagram Graph API
store/                           Zustand stores + session/user persistence helpers
server/index.js                  Custom server: Next.js request handler + Socket.IO, used by `pnpm dev`/`start`
server/socket-server.js          Standalone alternative Socket.IO relay (port 4000, run separately)
```

### Architecture

**Login flow** — `components/LogIn.tsx` builds the `https://www.instagram.com/oauth/authorize`
URL and redirects the browser there. Instagram redirects back to `/` with a `?code=...` query
param; `LogIn.tsx` posts that code to `POST /api/auth/exchange`, which exchanges it server-side
for a short-lived token, then a long-lived token, and sets `access_token`/`expires_at` as
HttpOnly cookies before redirecting to `/dashboard`. `app/dashboard/layout.tsx` and `app/page.tsx`
both gate access by checking those cookies (server-side, in production only).

**Data fetching** — `app/api/instagram/*` route handlers read the `access_token` cookie (or
`NEXT_PUBLIC_ACCESS_TOKEN` in dev) and call the Graph API via `lib/api.ts`, so the raw token
never reaches client-side JS.

**Realtime messages** — Meta calls `POST /api/instagram/webhook` for new events. After verifying
the `X-Hub-Signature-256` HMAC, that route forwards the raw payload to the Socket.IO server's
`/broadcast` endpoint (`server/index.js`), which re-emits it to all connected browser clients as
an `ig_event`. The dashboard subscribes via `hooks/useSocket.ts` and updates the relevant
conversation in the Zustand store (`store/useConversationDetails.ts`).

## Todos

- Check the errors and show error message

# Business Login for Instagram

Business Login is a custom login flow that allows your app to ask for permissions to access your app **user's Instagram professional account** data and to get **access token** to use in your **app's API requests**.

- _instagram_business_basic_
- _instagram_business_content_publish_
- _instagram_business_manage_messages_
- _instagram_business_manage_comments_

## How it works

Your app user launches the _login flow_ on your appp or website by clicking _your embed URL link or button_.

This _embed URL_, that you set up in the **App Dashboard** with the permissions you are requesting from your app users, opens an **authorization window**.

Your app user uses this window to _grant your app permissions_.

When the user submits the _login flow_, Meta redirects your app user to your redirect URI and sends an **authorization code**.

Your app can then exchange this **authorization code** for a short-lived ig user **access token**. An _ig-user-id_ for your _app-user_. And a _list of permissions_ the app user granted _your app_.

- Your app can exchanged this **short-lived acccess token** for a **long-lived access token** tha is valid for a 60 days.

Authorization Window > Auth Code > Short-lived Access Token > Long-lived Access Token.

## Before you start

Add the Instagram Product to your app and configure your **Business Login Settings** in the Meta App Dashboard.

## Embed the business login URL

You should have completed this step during Instagram app setup in the App Dashboard, but if not,

1. Copy the **Embed URL** from the **Set up Business Login** in the App Dashboard.
2. Paste the URL in an anchor tag or button on your app or website to launch the login flow.

### API setup with Instagram Login

App users log in with their Instagram credentials.

To customize the Ig use case so that your app uses Business Login for Ig to log users in to your app, select **API setup with Ig login** in the left side menu.

The app name, Instagram app ID, and Instagram App Secret are shown and can be used for test API calls.

1. Click **Add al requirements permissions.** The _instagram_business_basic_ and _instagram_business_manage_messages_ premissions are required for this functionality and added by default.

2. In the **Generate Access Tokens** section click **Add account**.

3. Click **Continue** and log in to your ig account in the popup window.

4. Click **save** and **got it** to return to the App Dashboard.

5. In the **Configure webhooks** section, add your **Callback URL** and **Verify Token** to configure webhooks or use services that help you set up an endpoint.

6. Click **Verify and save**. The verification must be successful to subscribe to webhooks fields.

7. In the **Configure Webhooks** section, subscribe to available Instagram webhooks.

8. Click **set up** in the **Set up Instagram business login**.

9. Add your **Redirect URL** and click **save**.

10. Click **Business Login Settings** and add your _Deauthorization callback url_ and _data deletion request URL_ and click _save_. You can also add additional redirects URIs.

11. If you are ready to submit your app for review, click **Go to app review** in the **Complete App Review** section. This is only required if you are creating solutions for clients.

### API integration helper

The API Integration Helper allows you to send a test message using the Instagram API. Only available for apps that use Business Login for Instagram.

### OAuth token storage and management

Short answer: treat the query string `code` as an authorization code only (never store it client-side).

Exchange it on the server for a short-lived access token, and then exchange that for a long-lived access token.

Persist the long token + expiry + profile in your server DB, and set an HttpOnly session cookie (session id) so the browser can be redirected to the dashboard without exposing tokens.

1. Receive `code` server-side (on your redirect path).

2. Server exchanges code => short-lived token. Response contains `access_token` and `expires_in`.

3. Immediately exchange short-lived => long-lived. Response contains `access_token` (long) and `expires_in`.

4. Fetch profile (/me?fields=id,name) with the long token to get user id, name.

5. Persist server-side (in your lib/db.ts or real DB).
    - store record: {id, name, access_token, expires_at}
    - do NOT persist the auth `code`

6. Create a session cookie for the browser:
    - Option A: set an HttpOnly cookie with a session `id` or `user_id`. Then your APIs read that cookie and load the token from DB.

7. Redirect user to `/dashboard`. The dashboard calls your server API. Which reads the cookie, looks up the user record in DB, and returns profile data - frontend never holds raw tokens.

Endpoints

    https://www.instagram.com/oauth/authorize – To get an authorization code from your app user
    https://api.instagram.com/oauth/access_token – To exchange an authorization code for a short-lived access token
    https://graph.instagram.com/access_token – To exchange a valid short-lived access token for a long-lived access token
    https://graph.instagram.com/refresh_access_token – To refresh a valid long-lived access token for another 60 days

curl -X POST https://api.instagram.com/oauth/access_token \
 -F 'client_id=990602627938098' \
 -F 'client_secret=a1b2C3D4' \
 -F 'grant_type=authorization_code' \
 -F 'redirect_uri=https://my.m.redirect.net/' \
 -F 'code=AQBx-hBsH3...'

Never store the short-lived token in client-side storage. Exchange the code server-side immediately, persist the long-lived token + expiry in your server DB, and give the browser a server-controlled session (httpOnly cookie or session id).

- Short token is sensitive and temporary - exchanging it immediately prevents leakage.
- Long token (or session id) belongs on the server so front-end JS never sees tokens.
- Cookies used by server APIs let your frontend call safe endpoints without exposing raw tokens.

### When to refresh

- Long-lived tokens typically last ~60 days. Refresh when `expires_at - now < threshold`
- Refresh strategies:
- If refresh fails or user revoked access, require re-auth (redirect to OAuth start).

```
const auth_short_token = `https://api.instagram.com/oauth/access_token?client_id=${CLIENT_ID}&client_secret=${process.env.NEXT_PUBLIC_INSTAGRAM_APP_SECRET}&grant_type=authorization_code&redirect_uri=${encodeURIComponent(
 REDIRECT_URI,
 )}&code=${code}`;

```

```
// ConversatinDetail.tsx

// const [userMessageTo, setUserMessageTo] = useState(null);

// This is to get the profile_picture of the user we are messaging with
// but at this moment ourt "Meta Account" has not permissions to get the
// info of another user.
//
// useEffect(() => {
//     if (!conversationDetails) return;
//     console.log('Conversation details:', conversationDetails);
//     fetch(`api/instagram/me/${conversationDetails?.messages.data[0]?.to.data[0]?.id}`)
//         .then(res => res.json())
//         .then(data => {
//             setUserMessageTo(data);
//         })
//         .catch(err => {
//             console.error('Error fetching conversation details:', err);
//         });
// }, [conversationDetails]);

```
