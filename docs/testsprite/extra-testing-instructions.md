# Extra Testing Instructions for TestSprite

## Base URL

Use the deployed app URL for staging or production. For local verification, use:

```text
http://localhost:3000
```

## High-Priority UI Tests

1. Mobile room sharing
   - Use a 390px wide mobile viewport.
   - Create a private room.
   - Assert the share panel appears near the top of the room screen without horizontal overflow.
   - If `navigator.share` exists, tapping Share should call native Web Share with the `/room/{roomId}` URL.
   - If `navigator.share` is unavailable, tapping Copy should attempt clipboard copy.
   - If clipboard copy is blocked, assert the visible manual fallback message appears and the URL remains visible/selectable.

2. Profile result refresh
   - Sign in as a test user.
   - Open `/profile`.
   - Complete a match in the mounted app.
   - Assert the profile screen refetches and shows updated coins and stats.

3. Server-authoritative results
   - Do not call `/api/profile/stats` or `/api/profile/win-coin`; those client-authored flows are intentionally removed.
   - Complete a match through Socket.io state sync.
   - Assert one result write per completed room.
   - Repeat the same final sync and assert stats and coin rewards do not increment again.

## Socket.io Events to Exercise

- `join_session`: reconnects a REST-created player session to a Socket.io room.
- `start_game`: host starts the match with the initial game state.
- `game_action`: player actions are validated by room membership, current turn, and allowed action type.
- `sync_state`: host syncs server-held room state; final state with `winnerId` triggers result recording.
- `profile_result_recorded`: server emits this to authenticated players after DB stats/reward writes complete.

## Expected Result Rules

- Authenticated non-spectator players get `gamesPlayed + 1` after match completion.
- Winner gets `gamesWon + 1` and the configured win coin reward.
- Losing authenticated players get `gamesLost + 1`.
- Bankrupt players get `bankruptcies + 1`.
- Spectators, bots, and guests do not get profile stat or coin writes.
- Repeated final syncs for the same room are idempotent.

## Known Local Environment Notes

- The server requires `DATABASE_URL` and `BETTER_AUTH_SECRET`.
- Some optional admin/app-setting tables may be absent in local DBs; those startup warnings are non-blocking for room/share/profile tests.
- Use the production build for visual QA when Vite dev HMR reports a React preamble warning.
