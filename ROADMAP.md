# 15 Tiles Game Roadmap and Backlog

This document summarizes the game development completed so far and keeps a lightweight backlog for future improvements.

## Current Product

15 Tiles Game is a mobile-first sliding puzzle built with Vite, React, and TypeScript. It supports multiple board sizes, physical-feeling drag interactions, elapsed-time scoring, move counting, Supabase-backed leaderboards, and a polished physical-tray visual style.

The current player experience is:

1. Choose a difficulty.
2. Solve a scrambled sliding puzzle.
3. Track elapsed time and moves.
4. Submit a score if the completion time qualifies for the current difficulty leaderboard.
5. View the top 10 leaderboard for the selected difficulty.

## Completed Roadmap

### Foundation

- Created a small Vite React app using TypeScript.
- Added puzzle state as a flat board array, with `null` representing the empty cell.
- Implemented solved board generation.
- Implemented scramble generation from a solved board by applying random valid moves, guaranteeing solvable puzzles.
- Avoided already solved starting boards.
- Added unit tests with Vitest.

### Core 15 Puzzle Gameplay

- Implemented a classic 4x4 puzzle with tiles 1-15 and one empty cell.
- Added click and tap movement for movable tiles.
- Added win detection.
- Added elapsed time as the score.
- Started the timer only after the first move.
- Stopped the timer when the puzzle is solved.
- Added a completion state after solving.
- Added Restart/New Game style game reset behavior during early development.

### Physical Drag Interaction

- Added pointer-based drag and swipe support for touch and mouse.
- Added smooth tile animation.
- Made drag movement responsive while the pointer is moving, rather than only moving on release.
- Added halfway commit behavior: if the tile is dragged closer to the empty cell than its starting position, it completes the move on release.
- Added multi-tile sliding for rows and columns where the selected tile has one or more tiles between it and the empty cell.
- Added physical-style follower behavior:
  - Dragging the far tile can push the tiles between it and the empty space.
  - If the player drags back before release, already pushed follower tiles remain pushed.
  - Follower tiles visually stay where they were pushed until release, then snap into the resulting board state.
- Fixed a drag counter bug where drag moves could reset the move counter to 1 after a click move.

### Game Stats

- Added a move counter.
- Counted click, tap, drag, and multi-tile slide commits as moves.
- Submitted moves with leaderboard scores to break ties between equal completion times.

### Difficulty Levels

- Refactored puzzle logic to support variable grid sizes.
- Added three difficulties:
  - Easy: 3x3, tiles 1-8, 30 random scramble moves.
  - Medium: 4x4, tiles 1-15, 100 random scramble moves.
  - Hard: 5x5, tiles 1-24, 200 random scramble moves.
- Kept Medium as the default difficulty.
- Persisted selected difficulty in local storage.
- Made New Game use the selected difficulty.
- Kept board rendering square and responsive for all sizes.
- Added a Difficulty modal so players do not accidentally reset the current game by tapping a visible difficulty option.

### Leaderboard

- Added a Supabase `scores` table with:
  - `id`
  - `player_name`
  - `grid_size`
  - `time_in_seconds`
  - `moves`
  - `created_at`
- Added a Vercel serverless API route at `api/scores.ts`.
- Kept Supabase credentials server-side only.
- Added API support for:
  - Fetching top 10 scores.
  - Submitting scores.
  - Filtering scores by grid size.
  - Ordering scores by shortest time, then fewest moves, then earliest submission.
- Added a sanity check rejecting scores under 10 seconds.
- Added a leaderboard UI showing rank, name, difficulty, time, and moves.
- Added separate leaderboards per difficulty by filtering on the selected grid size.
- Added a leaderboard modal opened from the main game controls.
- Added a completion sheet that slides up after solving and prompts for a name only if the score qualifies for the top 10.

### UI and Layout

- Built a clean mobile-first layout inspired by the simplicity of 2048.
- Centered the board and used large touch targets.
- Kept the game screen visually quiet, with leaderboard and difficulty choices behind modals.
- Updated controls so Difficulty and Leaderboard sit on the first row, while New Game spans the full row below.

### Visual Polish

- Moved the board away from a flat 2048-style grid toward a physical sliding-puzzle tray.
- Added a wooden tray/rim treatment so the board reads as a constrained physical object.
- Removed internal grid lines that could be mistaken for walls or movement blockers.
- Simplified the shadow system so the board, rim, tiles, and recessed surface have a clearer visual hierarchy.
- Added a board-level down-right thickness shadow so the whole tray feels like it sits on the page.
- Reduced tile gaps to make the board feel tighter and more object-like.
- Reduced the board corner radius from 16px to 8px for a more solid, less pillowy tray shape.
- Removed the special movable-tile highlight so all tiles look visually consistent.
- Experimented with engraved number styling, then removed it because it made the numbers feel blurry.
- Tested Google Fonts for the title and tile numbers:
  - Title uses `Love Ya Like A Sister`.
  - Tile numbers use `Josefin Sans` at weight 600.
- Added subtle CSS-only texture to the board rim and recessed surface.
- Added an inline SVG noise texture to the tiles for a subtle material finish.

### Testing and Quality

- Added tests for puzzle generation, solvability, movement, win detection, and difficulty behavior.
- Added interaction tests for drag behavior, multi-tile movement, modals, move counting, and board size changes.
- Added leaderboard tests for fetching, filtering, qualifying, and submission behavior.
- Verified builds with `npm run build`.

## Current Architecture

### Frontend

- `src/App.tsx`: main game state, board rendering, timer, move counter, modals, drag behavior, and completion flow.
- `src/puzzle.ts`: board generation, movement rules, slide groups, solvability checks, and difficulty configuration.
- `src/Leaderboard.tsx`: leaderboard fetching, top-10 qualification, score submission, and score display.
- `src/styles.css`: responsive layout, board/tile styling, modals, completion sheet, and controls.

### Backend

- `api/scores.ts`: Vercel serverless route for leaderboard GET and POST requests.
- `supabase/schema.sql`: Supabase table and leaderboard indexes.

### Testing

- `src/puzzle.test.ts`: pure puzzle logic tests.
- `src/App.test.tsx`: game UI and interaction tests.
- `src/Leaderboard.test.tsx`: leaderboard UI and submission tests.

## Backlog

### High Priority

- Add rate limiting or basic abuse protection for score submission.
- Add stronger server-side validation for completed games if cheating becomes a concern.
- Add loading and error polish for leaderboard modals on slow connections.
- Add a deployment checklist for required Vercel environment variables and Supabase migrations.

### Gameplay Improvements

- Add an optional Restart Current Puzzle button if players want to retry the same scramble without creating a new game.
- Add keyboard controls for desktop players.
- Add an undo button for the previous move.
- Add optional sound and haptic feedback for tile movement and puzzle completion.
- Add a visible best local time per difficulty using local storage.

### Leaderboard Improvements

- Add pagination or "more scores" after the top 10.
- Add a personal score history stored locally.
- Add duplicate-name handling or player initials mode.
- Add an admin cleanup process for suspicious scores.
- Consider separate Supabase policies if a public read-only client is introduced later.

### Design Polish

- Add small motion refinements for the completion sheet and modal transitions.
- Re-check 5x5 typography and spacing across very small mobile screens after final visual styling settles.
- Add a subtle solved-state board animation.
- Improve empty leaderboard state copy and layout.
- Continue tuning the physical board style based on usability testing.
- Decide whether to keep Google Fonts as remote imports or self-host the final selected fonts.
- Decide whether CSS/SVG textures are enough or whether final art-directed texture assets are worth adding.

### Technical Improvements

- Split drag interaction helpers out of `App.tsx` if the file grows further.
- Add API route tests for `api/scores.ts`.
- Add Playwright coverage for mobile drag behavior in a real browser.
- Add CI commands for `npm test` and `npm run build`.
- Add a README with setup, development, deployment, Supabase, and Vercel instructions.

## Suggested Next Milestones

### Milestone 1: Production Hardening

- Add API tests for score submission and leaderboard filtering.
- Document required environment variables.
- Add rate limiting or lightweight bot protection. (not urgent)
- Create a deployment checklist.

### Milestone 2: Accessibility and Desktop Support

- Add keyboard movement.
- Review focus states and modal focus handling.
- Add reduced-motion handling for players who prefer less animation. (not urgent)

### Milestone 3: Retention Features

- Add local personal bests per difficulty.
- Add score history.
- Add optional sound/haptics.

### Milestone 4: Visual Polish

- Refine modal and completion animations.
- Add a solved-state celebration.
- Tune the 5x5 board for the smallest supported mobile viewport.
- Keep refining the board so it feels like the real physical version of the game.
- Add themes

### Milestone 5: Add journey Mode

- Create puzzles which need to solve a picture instead of ordering a numerical sequence
- Make at least 30 levels
