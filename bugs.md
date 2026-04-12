# Bugs Found — Code Review 2026-03-24

## CRITICAL

### BUG-01: Winner not checked after VOTE_KICK / DECLARE_BANKRUPT / KICK_PLAYER / CHECK_VOTEKICKS
- **File:** `services/gameReducer.ts`
- **Description:** These four action handlers call `declareBankruptcy` and eliminate a player but never check if only one active player remains. The game never ends if the last player is eliminated via votekick or self-bankrupt — `winnerId` stays null forever.
- **Fix:** Extract a `checkWinner` helper and call it at the end of each of these action handlers.
- **Status:** FIXED

### BUG-02: Controls action buttons visible to wrong player in multiplayer
- **File:** `components/Controls.tsx`
- **Description:** Jail buttons (Bail, Roll Doubles, Wait Turn), the Buy button, the Auction/Skip/Finish button, and the Upgrade button all gate on `!currentPlayer.isBot` but not on `isHumanTurn`. In a multiplayer game with two human players, when it's Player B's turn, Player A sees all those buttons and can press them.
- **Fix:** Add `&& isHumanTurn` guard to every player-action button.
- **Status:** FIXED

### BUG-03: Lobby "Start Game" button disabled logic is wrong
- **File:** `App.tsx`
- **Description:** `disabled={!isHost && lobbyPlayers.length < 2}` — a non-host with 2+ players in the lobby sees the Start Game button enabled and can click it (triggering a host-only action).
- **Fix:** Change to `disabled={!isHost}`.
- **Status:** FIXED

---

## IMPORTANT

### BUG-04: Share box shown with null roomId during single-player game
- **File:** `App.tsx`
- **Description:** In the game screen, `renderShareBox(true)` is always rendered. When playing offline (`!isOnline`), `roomId` is null, so the share box displays "…?room=null".
- **Fix:** Conditionally render the share box only when `isOnline`.
- **Status:** FIXED

### BUG-05: Dead code — `const now = Date.now()` in CHECK_VOTEKICKS
- **File:** `services/gameReducer.ts` line 1267
- **Description:** The variable `now` is declared but never read. The actual expiry comparison uses `state.turnCount >= vote.expiresAt`. This causes a TS/lint warning and is confusing.
- **Fix:** Remove the dead variable.
- **Status:** FIXED

### BUG-06: Audio service ignores real MP3 files from cashly_assets/sounds
- **File:** `services/audioService.ts`, `server.ts`
- **Description:** The project contains real audio assets (`dice.mp3`, `game-start.mp3`, `trade-accept.mp3`, `trade-decline.mp3`, `chat-in.mp3`, etc.) in `cashly_assets/sounds/` but the audio service generates all sounds via Web Audio API synthesis. The files are never served or played.
- **Fix:** Add a `/sounds` static route in `server.ts`; update `audioService.ts` to play the actual MP3 files for the sounds that have matching assets, falling back to synth for the rest.
- **Status:** FIXED

### BUG-07: External texture URL creates hard dependency on third-party server
- **File:** `App.tsx` line 1150
- **Description:** The game screen background uses `bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]`. If that external server is down or the URL is blocked, the background pattern is missing. It also triggers an unnecessary network request.
- **Fix:** Remove the external URL and use a pure-CSS subtle dot/grid pattern via Tailwind or inline SVG data-URI.
- **Status:** FIXED

---

## LOW PRIORITY

### BUG-08: Mixed `absolute` and `fixed` Tailwind classes on sound toggle
- **File:** `App.tsx` line 1153
- **Description:** `className="absolute top-4 right-4 z-50 flex items-center gap-2 fixed"` — both `absolute` and `fixed` are applied. `fixed` wins (last write wins in Tailwind), so `absolute` is dead. Confusing and produces a larger class string.
- **Fix:** Remove the redundant `absolute` class.
- **Status:** FIXED

### BUG-09: Unused `hasJoinedRoom` state variable
- **File:** `App.tsx`
- **Description:** `const [hasJoinedRoom, setHasJoinedRoom] = useState(false)` — `setHasJoinedRoom` is never called anywhere in the component. The state is dead weight.
- **Fix:** Remove the state declaration.
- **Status:** FIXED

### BUG-10: JetBrains Mono font not loaded in index.html
- **File:** `index.html`, `index.css`
- **Description:** `index.css` declares `--font-mono: "JetBrains Mono"` but the font is not fetched via a `<link>` tag. The browser falls back to `ui-monospace` / `SFMono-Regular`. Money amounts and dice values look different than intended.
- **Fix:** Add JetBrains Mono to the Google Fonts `<link>` in `index.html`.
- **Status:** FIXED
