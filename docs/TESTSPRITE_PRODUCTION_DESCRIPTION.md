# Cashly Production Description for TestSprite

## Product Summary

Cashly is a real-time multiplayer Monopoly-style web game built with React, Express, Socket.io, Better Auth, Drizzle, and Postgres. Players can create or join rooms, configure match rules, play the full turn-based board loop, chat during a match, earn profile rewards when a match ends, and spend coins in the store.

## Primary Users

- Guest player: can create and join rooms, play matches, and use room sharing without account persistence.
- Authenticated player: can play matches and receive server-recorded profile stats, win/loss results, and coin rewards.
- Spectator: can join an in-progress room without affecting match stats or rewards.
- Admin: can manage store, ads, boards, users, and application settings through the protected admin area.

## Critical Production Flows

1. Room creation and sharing
   - A player creates a public or private room.
   - The room URL is displayed at the top of the room screen.
   - On mobile browsers with Web Share API support, tapping the share action opens the native share sheet.
   - If native share is unavailable or fails, the app falls back to clipboard copy.
   - If clipboard copy is blocked, the UI leaves the link visible and tells the user to copy it manually.

2. Joining and reconnecting
   - Shared links use `/room/:roomId`.
   - Existing sessions restore from `cashly_session`.
   - New visitors opening active match links join as spectators when the game is already in progress.
   - Socket reconnects rejoin the saved room and receive the latest server-held game state.

3. Match completion and profile updates
   - Clients no longer post profile stat deltas or win coins directly.
   - The multiplayer server records results once when a host syncs a state with `winnerId`.
   - Authenticated non-spectator players receive one recorded game result.
   - The winner receives the configured win coin reward.
   - Server updates `user_stats`, `user.coins`, and `game_history`.
   - Open profile views refetch after the server confirms result recording.

4. Profile page
   - `/profile` requires an authenticated user.
   - The page displays coins, games played, wins, losses, win rate, total earnings, total turns, bankruptcies, and friends.
   - Values should reflect server updates after a completed match without relying on local-only state.

5. Store and inventory
   - Authenticated users can view coin balance, browse store items, buy affordable items, and see updated balances.
   - Purchase and coin updates must be server-authoritative.

## Data Authority Rules

- Room state is synchronized through Socket.io and stored server-side for reconnects.
- Profile rewards and stats are written only by server-side match result finalization.
- Deprecated client-posted endpoints `/api/profile/stats` and `/api/profile/win-coin` must not be used by the frontend.
- Spectators and bots must not receive profile rewards or stats.
- A completed match should be recorded once per room, even if final state syncs repeat.

## Suggested TestSprite Tests

### Mobile Share Flow

- Viewport: iPhone-sized mobile viewport.
- Create a room.
- Verify the top share area is readable without horizontal overflow.
- Mock `navigator.share` and confirm tapping Share calls it with the room URL.
- Disable `navigator.share`, mock clipboard success, and confirm the fallback success message appears.
- Mock clipboard failure and confirm the manual-copy state appears while the URL remains selectable.

### Server-Authoritative Result Flow

- Start an authenticated multiplayer room.
- Complete a match by syncing a final state with a winner.
- Assert the server writes one `game_history` row.
- Assert authenticated players receive exactly one `gamesPlayed` increment.
- Assert winner receives `gamesWon + 1` and the win coin reward.
- Assert losing authenticated players receive `gamesLost + 1`.
- Replay the same final sync and confirm stats and coins do not increment again.

### Profile Refresh Flow

- Open `/profile` for the authenticated player.
- Complete a match in the mounted app.
- Assert the profile view refetches and displays updated coins and stats.

### Regression Checks

- Search the client bundle/source for `/api/profile/stats` and `/api/profile/win-coin`; expected result is no frontend callers.
- Verify spectators can join in-progress rooms but do not receive stats or rewards.
- Verify guest players can complete matches without DB profile writes.

## Acceptance Criteria

- Mobile room sharing has native share, clipboard fallback, and manual fallback states.
- No profile stats or win rewards are accepted from client-authored stat payloads.
- Match results are persisted exactly once from the multiplayer server.
- Profile pages display updated values after match completion.
- TypeScript build passes.
