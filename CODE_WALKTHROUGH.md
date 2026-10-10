# Sidelight — Code Walkthrough & Technical Interview Guide

This guide is designed to help any engineer understand the codebase and explain its architecture, synchronization algorithm, and trade-offs in a technical evaluation.

---

## 1. Five Most Important Files to Study

1. **[`server/src/rooms/roomService.js`](file:///Users/prakharsaxena/Downloads/YouTube-Watch-Party-Platform/server/src/rooms/roomService.js)**
   - **Why**: It contains the entire business logic of the application: room creation, participant joining, authoritative playback mutation, role assignments, participant removal, host succession, and disconnect grace timers.
   - **Key Detail**: It has zero dependencies on Socket.IO or Express, making it pure, deterministic, and easily testable.
2. **[`client/src/features/player/usePlaybackSync.js`](file:///Users/prakharsaxena/Downloads/YouTube-Watch-Party-Platform/client/src/features/player/usePlaybackSync.js)**
   - **Why**: The core client synchronization engine. It translates server snapshots into YouTube API commands, computes drift against extrapolated time, manages the echo-suppression window, and handles browser autoplay gesture policies.
3. **[`client/src/utils/sync.js`](file:///Users/prakharsaxena/Downloads/YouTube-Watch-Party-Platform/client/src/utils/sync.js)**
   - **Why**: The mathematical heart of the sync logic (`decideDriftAction` and `expectedPosition`). Pure functions isolated from React and DOM, with 100% test coverage for all drift scenarios.
4. **[`server/src/auth/permissions.js`](file:///Users/prakharsaxena/Downloads/YouTube-Watch-Party-Platform/server/src/auth/permissions.js)**
   - **Why**: The backend authorization matrix. Shows how actions are gated against roles (`HOST`, `MODERATOR`, `PARTICIPANT`) and how client-originated role forgery is structurally impossible.
5. **[`client/src/hooks/useRoom.jsx`](file:///Users/prakharsaxena/Downloads/YouTube-Watch-Party-Platform/client/src/hooks/useRoom.jsx)**
   - **Why**: The React Context provider that manages room state, session storage persistence, request-response event promises over Socket.IO, and reactive participant/role indicators.

---

## 2. Explain the Architecture in Two Minutes

> "Sidelight is a real-time watch party platform architected around **server-authoritative state**.
>
> The backend is built with Node.js, Express, and Socket.IO. We keep business logic strictly separate from the transport layer: `roomService.js` handles room state, playback math, and role-based permissions without knowing anything about WebSockets, while `socketServer.js` handles connections, token-bucket rate limiting, and event dispatch.
>
> When a client creates or joins a room, the server maps the socket ID to a verified participant seat and issues a cryptographic reconnect token stored in `sessionStorage`. If a participant sends a playback or role action, the server verifies permissions against its own memory — never trusting roles or identities sent in the payload.
>
> Once validated, the server bumps an authoritative revision number and broadcasts the new state snapshot to all room members.
>
> On the frontend, React 19 and Vite drive the UI, using plain CSS design tokens for an intimate, cinematic look. A custom YouTube player controller wraps the official IFrame Player API. A synchronization hook tracks server timestamps, extrapolates video elapsed time, and applies calibrated drift corrections so clients stay in lockstep without jittering YouTube's video buffer."

---

## 3. Explain the Playback Synchronization Flow

When an interviewer asks: *"How do you keep videos synchronized across multiple browsers?"*

1. **Authoritative Timestamp Anchoring**:
   *"We never allow clients to be the clock. When a host presses play, the server records the anchor position and the exact server timestamp (`updatedAt`)."*
2. **Snapshot Extrapolation for Joiners**:
   *"When any client queries room state or joins late, the server computes: `currentPosition = anchorPosition + (now - updatedAt)`. The client receives this extrapolated position directly, completely bypassing device clock skew."*
3. **Calibrated Drift Policy**:
   *"In the client (`usePlaybackSync`), we run a drift check every 2 seconds. We define three tiers:
   - Drift under 750ms is ignored because human perception tolerates sub-second offsets and micro-seeking degrades audio/video buffering.
   - Drift between 750ms and 2.5s requires two consecutive out-of-sync checks before seeking, filtering out temporary buffer pauses.
   - Drift over 2.5s triggers an immediate seek.
   - Crucially, we enforce a 4-second seek cooldown so the player never gets trapped in a seeking feedback loop."*
4. **Echo Suppression**:
   *"When our code commands the YouTube player to play or seek, YouTube fires internal state change events. We use an `isApplyingRemote` time window so remote-driven events are never mistaken for user actions and echoed back to the server."*

---

## 4. How Backend Authorization Works

When an interviewer asks: *"What prevents a participant from hacking the client and pausing the video or making themselves host?"*

1. **Session Binding**:
   *"When a socket connects and joins, the server creates a private mapping `sessions.set(socket.id, { roomId, participantId })`. The client can never supply an arbitrary `userId` or `role` in the payload."*
2. **Role Resolution**:
   *"Whenever any command arrives, `requireMember` resolves the participant from server memory and checks `assertCan(participant.role, action)`. The roles are hardcoded to permissions in `permissions.js`."*
3. **Immutability of Privileges**:
   *"Only the Host can assign roles or remove members. If a Participant emits `assign_role` or `playback_command`, the server immediately throws a `FORBIDDEN` AppError and returns a structured error to that socket only, without touching room state."*

---

## 5. Five Important Technical Decisions & Trade-offs

| Decision | Trade-off / Rationale | Alternative Considered & Why Rejected |
| :--- | :--- | :--- |
| **1. Server-authoritative extrapolation vs. WebRTC / P2P** | Centralized server ensures a single undisputed timeline and reliable NAT traversal without STUN/TURN overhead. Trade-off: server memory and WebSocket connections scale with user volume. | **WebRTC DataChannels**: Too complex for watch parties; mesh topology fails with >4 peers without an SFU. |
| **2. In-memory `RoomStore` with decoupled interface** | Extremely fast, zero database dependency for evaluation, simple cleanup. Encapsulated in a repository pattern so MongoDB/Redis can replace it without changing domain logic. | **Direct MongoDB queries on every tick**: Unnecessary I/O latency for ephemeral watch parties; in-memory is standard for real-time room state. |
| **3. Reconnect tokens in `sessionStorage`** | Survives page refreshes and momentary network drops without requiring a full user account / OAuth registration flow. Scoped per-tab so two tabs can be two distinct participants. | **Local storage**: Would leak identity across multiple tabs, preventing testing or multi-person viewing on one machine. |
| **4. Thresholded drift with cooldown vs. constant seek** | YouTube's player re-buffers whenever `seekTo()` is called. Continuous seeking causes video stuttering. Thresholding gives smooth playback with imperceptible drift. | **Frame-perfect sync lockstep**: YouTube IFrame API does not support fine-grained frame synchronization; attempting it causes constant pauses. |
| **5. Plain CSS design tokens over Tailwind** | Full control over custom cinematic visual aesthetic, typography pairings, zero build-step overhead, and smaller bundle size (CSS is only 21KB). | **Tailwind / CSS frameworks**: Generic appearance; often leads to bloated utility class clutter. |

---

## 6. Known Limitations

1. **Server Restart Drops Ephemeral Rooms**: Because room state is kept in server memory, restarting the Node process ends active rooms. (Mitigation: Redis adapter for Socket.IO and room state backing).
2. **YouTube Video Embed Restrictions**: Certain music videos (e.g., VEVO) or region-restricted videos disallow external embedding. The UI gracefully catches error code `101`/`150` and prompts the host to choose another video.
3. **Browser Autoplay Restrictions**: Browsers require a user click before unmuted audio can play. Sidelight catches this and presents a "Click to join playback" gesture overlay.

---

## 7. Likely Interviewer Questions & Model Answers

### Q: "How does your system handle a host whose Wi-Fi drops for 10 seconds?"
> *"When a socket disconnects, the server does not immediately destroy the room or demote the host. It sets `connected: false` and starts a 45-second grace timer. The UI shows the host as 'reconnecting…'. If the host reconnects within 45 seconds, their client sends their secret reconnect token from `sessionStorage`, their socket is reattached to the Host seat, and the grace timer is cancelled. If the 45 seconds expire, host succession kicks in: ownership transfers to the longest-standing active moderator, or the longest-standing participant."*

### Q: "Could a client forge a role in the `create_room` or `join_room` payload?"
> *"No. The handlers completely ignore any `role` property in the incoming payload. In `createRoom()`, the server hardcodes the creator's role to `Roles.HOST`. In `joinRoom()`, new participants are hardcoded to `Roles.PARTICIPANT`. The only way a role changes is via `assignRole()`, which enforces that the requesting socket is verified as the current Host."*

### Q: "Why did you build custom rate limiting instead of using an npm package?"
> *"We implemented a token-bucket algorithm (`rateLimiter.js`) in 18 lines of standard JavaScript. It tracks tokens per socket with a maximum burst capacity of 40 and a refill rate of 8 tokens per second. This gives responsive transport interaction (such as scrubbing a slider) while protecting the server against malicious socket flooding without pulling in third-party dependency baggage."*
