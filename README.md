# WatchAlong — Real-Time YouTube Watch Party Platform

> **"One video. Everyone in sync."**  
> WatchAlong is an intimate, cinematic shared viewing space where friends can watch YouTube videos together, keep playback in lockstep across separate devices, and coordinate with host and moderator controls.

---

## 1. Project Overview

WatchAlong is built to solve the frustration of group viewing over voice calls: counting down "3, 2, 1, play", fighting drift, or having one person accidentally pause the video for thirty people without permission.

In WatchAlong:
- **Server is the single source of truth**: Rooms, playback state, timestamps, and roles live on the server.
- **Role-Based Access Control (RBAC)**: Hosts and Moderators control the remote (play, pause, seek, change video). Participants watch in synchronized harmony without risk of accidental disruption.
- **Intelligent Drift Control**: Rather than constant micro-seeking that stutters YouTube's internal buffering, WatchAlong uses a calibrated drift threshold and elapsed-time extrapolation to keep clients in sync.
- **Zero-Account Friction**: Instant access with a display name and cryptographic session tokens that survive browser refreshes without requiring user accounts or third-party OAuth.

---

## 2. Feature List & Assignment Deliverables

### Core Requirements
- **Server-Authoritative Real-Time Playback Synchronization**:
  - Synchronized Play / Pause across all participants in real time.
  - Synchronized Seeking with interactive scrub bar for controllers and read-only progress indicator for participants.
  - Video switching that propagates immediately to all connected peers.
  - Late-join extrapolation: participants joining mid-video immediately jump to the current elapsed position.
- **Room-Based Architecture**:
  - Instant room generation with collision-resistant 10-character alphanumeric room codes (`ABCDE-FGHJK`).
  - One-click shareable invite links with clipboard fallback and direct URL join routing (`/r/:roomId`).
- **Official YouTube IFrame Player API**:
  - Embedded controllable YouTube player supporting standard watch URLs, short `youtu.be` links, shorts, embeds, and raw video IDs.
  - Clean video view with click shield that suppresses unwanted third-party overlays.
  - Dedicated Fullscreen mode with responsive controls HUD and double-click toggle.
- **WebSockets Real-Time Communication**:
  - Low-latency bidirectional events powered by Socket.IO with token-bucket rate limiting and session reconnects.
- **Role-Based Access Control (RBAC)**:
  - **Host**: Creator auto-assigned full control: play/pause, seek, change video, assign roles, remove participants, transfer host.
  - **Moderator**: Can play, pause, seek, and change video.
  - **Participant**: Watch-only by default; cannot control playback directly.
  - **Viewer**: Watch-only alias role supported for custom permission tiers.
  - **Backend Role Enforcement**: Zero-trust validation rejects unauthorized commands directly on the server.
- **Participant Change Request & Approval Workflow**:
  - As required by the assignment, participants cannot unilaterally alter playback or video state.
  - Participants can submit a video change request (`request_change`).
  - Hosts and Moderators receive the request in real time and can **Approve** (which automatically applies the change to the entire room) or **Decline**.

### Bonus Features & Advanced Implementations
- **OOP Architecture for WebSocket Server**:
  - Object-Oriented design structuring room state into `Room` and `Participant` classes.
  - Modular handler architecture (`BaseMessageHandler`, `RoomMessageHandler`, `PlaybackMessageHandler`, `ChatMessageHandler`) encapsulating validation, permissions, and broadcast logic.
- **Horizontal Scalability & Redis Pub/Sub**:
  - Scalability architecture with Redis Pub/Sub support (`redisAdapter.js`) using `@socket.io/redis-adapter` for clustering multiple WebSocket server instances behind a load balancer.
- **Persistent Rooms (File-Based & SQLite Database)**:
  - SQLite persistence layer (`SqliteRoomStore` via Node.js native `DatabaseSync`) and file-based persistence (`PersistentRoomStore`) to persist rooms, participants, and playback state across server restarts.
- **User Authentication**:
  - Full authentication system with registration, login, secure `scrypt` password hashing, signed auth tokens, and guest session fallback (`POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/guest`, `GET /api/auth/me`).
- **In-Room Live Text Chat**:
  - Side rail tab with real-time text chat, message history, timestamps, and participant tags.
- **Floating Emoji Reactions**:
  - Real-time emoji reaction picker (❤️, 🔥, 😂, 👏, 😮, 🎉) with animated floating overlays across the screen.
- **Host Transfer**:
  - The host can transfer full host privileges to any participant or moderator with an explicit confirmation dialog.

---

## 3. Technology Stack

### Frontend
- **React 19** + **Vite 8**
- **JavaScript (ES Modules)**
- **React Router 7**
- **Plain CSS / CSS Tokens** (zero-dependency design system, accessible dark mode)
- **Lucide React** (modern icons)
- **YouTube IFrame Player API** (encapsulated controller wrapper)

### Backend
- **Node.js (v18+)**
- **Express.js** (HTTP API, Auth endpoints, and health checks)
- **Socket.IO** (Bidirectional real-time engine)
- **SQLite (`node:sqlite`)** & JSON file store for room persistence
- **Crypto (`node:crypto`)** for scrypt password hashing and HMAC auth tokens
- **Redis Pub/Sub Adapter support** for horizontal scaling

### Testing
- **Vitest & React Testing Library**: 36 frontend tests passing.
- **Node.js Test Runner (`node:test`)**: 37 backend tests passing.

---

## 4. Prerequisites

- **Node.js**: v18.0.0 or higher (`node -v`)
- **npm**: v9.0.0 or higher (`npm -v`)

---

## 5. Installation Steps

Clone the repository and install dependencies for both server and client:

```bash
# 1. Install server dependencies
cd server
npm install

# 2. Install client dependencies
cd ../client
npm install
```

---

## 6. Environment Variables

### Backend (`server/.env`)
Copy `server/.env.example` to `server/.env`:
```env
# Port the server listens on (Render and other cloud hosts inject PORT automatically)
PORT=4000

# Comma-separated list of allowed client origins for CORS and Socket.IO
CLIENT_ORIGINS=http://localhost:5173,http://127.0.0.1:5173

# Grace window (milliseconds) before an offline participant seat is cleaned up
RECONNECT_GRACE_MS=45000
```

### Frontend (`client/.env`)
Copy `client/.env.example` to `client/.env`:
```env
# Public URL of the backend.
# In local development, leave this EMPTY: Vite automatically proxies /api and /socket.io to localhost:4000.
# In production, set this to your deployed backend origin (e.g. https://watchalong-api.onrender.com)
VITE_SERVER_URL=
```

---

## 7. Running Locally

You can run the frontend and backend in separate terminal windows:

### Terminal 1: Backend
```bash
cd server
npm run dev
# Server starts on http://localhost:4000
```

### Terminal 2: Frontend
```bash
cd client
npm run dev
# Vite starts on http://localhost:5173
```

Visit [`http://localhost:5173`](http://localhost:5173) in your browser.

---

## 8. Creating and Joining Rooms

1. **Creating a Room**:
   - On the landing page, click **"Start a watch party"**.
   - Enter your display name (e.g., `Hana`).
   - (Optional) Paste an initial YouTube URL (e.g. `https://www.youtube.com/watch?v=jNQXAC9IJRE`).
   - Click **"Create room"**. You are assigned the **Host** role.
2. **Inviting Friends**:
   - Click the **"Invite"** button in the top bar to copy the direct URL (`http://localhost:5173/r/ABCDE-FGHJK`).
3. **Joining a Room**:
   - Participants who open the link enter their display name and join with the **Participant** role.
   - Alternatively, click **"Join a room"** on the landing page and enter the 10-character code.

---

## 9. The Authoritative Room State Model

The server maintains the complete authoritative state for each active room:

```javascript
{
  id: "78W4PJ5M7R",          // 10-char collision-resistant room code
  createdAt: 1775813735000,
  hostId: "u-9a4f2b",        // ID of the current host participant
  participants: Map<id, {
    id: "u-9a4f2b",
    name: "Hana",
    role: "host",             // 'host' | 'moderator' | 'participant'
    token: "k7x...92",        // Secret session reconnect token (NEVER exposed to peers)
    socketId: "sock-123",
    connected: true,
    joinedAt: 1775813735000
  }>,
  playback: {
    videoId: "jNQXAC9IJRE",   // 11-char YouTube video ID or null
    status: "playing",        // 'playing' | 'paused'
    position: 42.5,           // Authoritative seconds at updatedAt
    updatedAt: 1775813750000, // Epoch ms when this state was committed
    revision: 7               // Incrementing counter for state revisions
  },
  removedTokens: Set<string>  // Blacklisted tokens from evicted participants
}
```

### Client-Safe Snapshot
When sent across Socket.IO, `RoomService.snapshot()` scrubs sensitive tokens and extrapolates `position` to the current instant:
```javascript
{
  roomId: "78W4PJ5M7R",
  hostId: "u-9a4f2b",
  hostConnected: true,
  participants: [
    { id: "u-9a4f2b", name: "Hana", role: "host", connected: true },
    { id: "u-3c81e9", name: "Ines", role: "participant", connected: true }
  ],
  playback: {
    videoId: "jNQXAC9IJRE",
    status: "playing",
    position: 45.2, // Authoritative extrapolated position at serverTime
    revision: 7
  },
  serverTime: 1775813752700
}
```

---

## 10. Socket.IO Event Contract

| Event Name | Direction | Payload | Description |
| :--- | :--- | :--- | :--- |
| `create_room` | Client → Server | `{ displayName, videoUrl? }` | Creates room, binds socket as Host. |
| `join_room` | Client → Server | `{ roomId, displayName, token? }` | Joins room or reclaims existing seat. |
| `leave_room` | Client → Server | `{}` | Gracefully leaves room. |
| `request_sync` | Client → Server | `{}` | Requests fresh snapshot. |
| `playback_command` | Client → Server | `{ type: 'play'\|'pause'\|'seek', position? }` | Issues playback command (Host/Mod only). |
| `change_video` | Client → Server | `{ videoUrl }` | Changes YouTube video (Host/Mod only). |
| `assign_role` | Client → Server | `{ targetId, role }` | Changes participant role (Host only). |
| `remove_participant`| Client → Server | `{ targetId }` | Evicts participant (Host only). |
| `room_created` | Server → Client | `{ roomId, participantId, token, state }` | Emitted to creator upon success. |
| `room_joined` | Server → Client | `{ roomId, participantId, token, rejoined, state }` | Emitted to joiner with snapshot. |
| `room_state` | Server → Client | `{ state }` | Broadcast to all room members on state changes. |
| `participant_joined`| Server → Client | `{ state, participant }` | Broadcast when a new participant joins. |
| `participant_left` | Server → Client | `{ state, participantId, name, reason, newHostId }` | Broadcast when someone leaves or times out. |
| `role_updated` | Server → Client | `{ state, targetId, targetName, role, hostTransferred, by }` | Broadcast on role change or host transfer. |
| `participant_removed`| Server → Client | `{ state, participantId, name, by }` / `{ removed: true, roomId, message }` | Broadcast to room; targeted event to evicted socket. |
| `playback_updated` | Server → Client | `{ state, action, by }` | Broadcast to all room members upon validated command. |
| `room_error` | Server → Client | `{ code, message, event }` | Sent to sender upon rejection or validation failure. |

---

## 11. How Playback Synchronization Works

```
Controller Action (Play/Pause/Seek)
       │
       ▼
Socket.IO emit('playback_command')
       │
       ▼
Server: Identity Verification (socket.id -> participant in room)
Server: RBAC Check (can participant control playback?)
Server: Commit new authoritative state & bump revision
       │
       ▼
Broadcast 'playback_updated' to ALL clients (including sender)
       │
       ▼
Client Hook (usePlaybackSync):
  1. Detect revision or status change
  2. Set isApplyingRemote flag (suppresses echo loops)
  3. Extrapolate target position: position + (now - receivedAt)
  4. Compare with player.getCurrentTime()
  5. If drift > tolerance: seekTo(target)
  6. Execute play() or pause()
```

### Drift Correction Algorithm (`client/src/utils/sync.js`)
Rather than seeking on every tick, `decideDriftAction` applies calibrated rules:
- **Small drift (< 0.75s)**: Ignored completely. Normal playback continues without audible or visual interruptions.
- **Moderate drift (0.75s – 2.5s)**: A flagged condition. If drift persists across two consecutive checks (4 seconds apart), a seek is scheduled. This prevents premature seeks caused by transient video buffering.
- **Large drift (≥ 2.5s)**: Hard seek immediately to re-align with the room.
- **Seek Cooldown (4.0s)**: Ensures at least 4 seconds elapse between corrective seeks, avoiding feedback fights with YouTube's internal player buffering.

---

## 12. How Permissions are Enforced

Security is strictly server-side:
1. **Never Trust Client Identifiers**: The client payload does NOT contain a `callerId` or `callerRole`. The server identifies the caller solely from internal `sessions.get(socket.id)`.
2. **Server-Held Roles**: Roles are fetched directly from authoritative server memory (`room.participants.get(session.participantId).role`).
3. **Explicit RBAC Matrix (`server/src/auth/permissions.js`)**:
   - `CONTROL_PLAYBACK` → Host, Moderator
   - `CHANGE_VIDEO` → Host, Moderator
   - `MANAGE_ROLES` → Host only
   - `REMOVE_PARTICIPANT` → Host only
4. **Self-Promotion Block**: A user cannot assign roles to themselves, nor can any user remove the Host.
5. **No URL Fetching on Server**: YouTube URL validation is pure string parsing; the server never makes outbound HTTP requests to untrusted user URLs (mitigating SSRF).

---

## 13. Testing Instructions

### Backend Test Suite (37 Tests)
Runs unit tests for OOP room & participant models, auth service with scrypt hashing, SQLite persistence, chat & reactions, `RoomService`, validation helpers, and full Socket.IO client-server integration tests:
```bash
cd server
npm test
```
*Result: 37 passed, 0 failed.*

### Frontend Test Suite (36 Tests)
Runs Vitest for synchronization logic, drift calculations, formatters, playback controls, player stage, and chat panel:
```bash
cd client
npm test
```
*Result: 36 passed, 0 failed.*

### Production Build Validation
```bash
cd client
npm run build
```
*Result: Production bundle built cleanly with zero errors.*

---

## 14. Deployment Instructions

### Option A: Render (Recommended Full-Stack)

#### 1. Backend Web Service (Render)
- **Environment**: Node
- **Root Directory**: `server`
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Environment Variables**:
  - `PORT`: (Render sets this automatically)
  - `CLIENT_ORIGINS`: `https://your-watchalong-client.onrender.com,https://your-custom-domain.com`

#### 2. Frontend Static Site (Render / Vercel / Netlify)
- **Root Directory**: `client`
- **Build Command**: `npm run build`
- **Publish Directory**: `dist`
- **Environment Variables**:
  - `VITE_SERVER_URL`: `https://your-watchalong-backend.onrender.com`
- **SPA Routing**: The project includes `client/public/_redirects` (for Netlify/Render) and `client/vercel.json` (for Vercel) so that deep links such as `/r/:roomId` route properly to `index.html`.

---

## 15. Known Limitations & Future Improvements

1. **In-Memory Persistence**: Rooms are stored in memory. A server restart removes existing rooms. For multi-instance scaling, room state should be backed by Redis / Valkey with Redis Pub/Sub for cross-instance Socket.IO coordination.
2. **YouTube Embed Policies**: Certain copyrighted music videos or age-restricted videos prohibit embedded playback on external domains (YouTube error 101/150). WatchAlong detects this and displays a user-friendly explanation prompting the host to select another video.
3. **Browser Autoplay Policies**: Modern browsers require user interaction before playing audio. WatchAlong detects autoplay blocking and renders a prominent "Click to join playback" gesture overlay.
4. **Session Authentication**: Current identities are lightweight session identities. Adding optional persistent user accounts or room passcodes would allow private watch parties.
