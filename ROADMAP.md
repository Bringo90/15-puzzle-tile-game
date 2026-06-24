# Magic Box Roadmap and Backlog

This document summarizes the game development completed so far and keeps a lightweight backlog for future improvements.

## Current Product

Magic Box is a mobile-first sliding puzzle built with Vite, React, and TypeScript. It supports classic numbered puzzles, curated image-based Adventure levels, multiple board sizes, physical-feeling drag interactions, elapsed-time scoring, move counting, Supabase-backed leaderboards, app-wide themes, and a polished physical-tray visual style.

The current player experience is:

1. Start from the Main Menu.
2. Choose Classic New Game, Adventure Mode, Themes, or Leaderboard.
3. In Classic mode, choose a difficulty and solve a scrambled numbered puzzle.
4. In Adventure mode, choose an unlocked curated image level and solve it within the move limit.
5. Track elapsed time and moves, or moves remaining in Adventure mode.
6. Submit a Classic score if the completion time qualifies for the current difficulty leaderboard.
7. View the top 10 leaderboard for the selected difficulty.

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
- Moved difficulty selection behind the Main Menu's New Game flow and an in-game Difficulty button.

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
- Added a dedicated Main Menu as the first screen.
- Added Main Menu actions for New Game, Continue Game, Adventure Mode, Themes, and Leaderboard.
- Simplified the in-game controls to Main Menu, Difficulty, and New Game or Retry Level.
- Preserved the current run when returning to the Main Menu.
- Added smoother modal enter/exit animations and smoother screen transitions.

### Themes

- Added a theme architecture based on pre-built, selectable themes rather than player-customized colors.
- Added app-wide theme tokens for backgrounds, panels, controls, modals, board, tiles, overlays, accents, and typography.
- Added Classic Wood as the default theme.
- Added Night Mode as a second unlocked theme.
- Made themes affect the whole app, including page background, title, buttons, stats, modals, leaderboard rows, completion sheets, board, and tiles.
- Added locked theme states and local unlock progress.
- Added a Themes modal reachable from the Main Menu.

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
- Iterated Night Mode colors so the board rim, recessed surface, tiles, and app background read clearly in a darker palette.
- Replaced tile shadows with small borders for a cleaner, less muddy depth model.
- Increased tile border thickness to improve definition.
- Increased tile number size for better readability on phones.
- Tuned mobile tile gaps to keep the board tighter and easier to read.
- Added a blurrier layered board shadow for a more natural object-on-surface effect.
- Increased the board rim thickness outside the board bounds so the tray feels more substantial without shrinking the play area.

### Adventure Mode

- Added a separate Classic and Adventure mode structure.
- Added curated local Adventure level definitions with image source, grid size, shuffle length, and max move limit.
- Added sequential local Adventure progression:
  - Level 1 is unlocked by default.
  - Solving a level unlocks the next level.
  - Locked levels remain visible but obscure their image, title, difficulty, and move details.
- Rendered Adventure tiles as slices of the level image while keeping numbered board values internally for movement and win detection.
- Added responsive image-slice positioning so picture tiles align across grid sizes and tile gaps.
- Added a move countdown for Adventure levels.
- Added local Adventure completion progress and best results.
- Added failure state when the move countdown reaches zero.
- Kept Adventure scores local-only and separate from the Supabase Classic leaderboard.
- Added a hold gesture in Adventure mode that shows the full solution image as a hint without spending a move.
- Replaced the pre-move Adventure status text with a larger instruction explaining that players can press and hold a tile to preview the solution.
- Removed the extra Adventure preview screen so tapping an unlocked level starts the level directly.
- Added the same drive-in board entrance animation to Adventure levels, briefly showing the solved image before the scramble appears.

### Motion

- Added a Classic board entrance animation when starting a Classic game from the Main Menu:
  - The solved board slides in from the right.
  - It overshoots slightly left with a small counter-clockwise brake rotation.
  - It settles into place before swapping to the real scrambled board.
- Avoided replaying the Classic entrance when pressing in-game New Game.
- Fixed a post-intro flash caused by the generic board entrance animation replaying during the solved-to-scrambled swap.
- Reused the board entrance motion for Adventure mode.
- Kept tile movement logic separate from the entrance animation layer.

### Testing and Quality

- Added tests for puzzle generation, solvability, movement, win detection, and difficulty behavior.
- Added interaction tests for drag behavior, multi-tile movement, modals, move counting, and board size changes.
- Added leaderboard tests for fetching, filtering, qualifying, and submission behavior.
- Added tests for Main Menu flow, theme selection, Adventure progression, Adventure hint behavior, and board entrance animation behavior.
- Verified builds with `npm run build`.

## Current Architecture

### Frontend

- `src/App.tsx`: main game state, board rendering, timer, move counter, modals, drag behavior, and completion flow.
- `src/adventure.ts`: curated Adventure level definitions, image tile styling, Adventure scramble creation, and local progress helpers.
- `src/puzzle.ts`: board generation, movement rules, slide groups, solvability checks, and difficulty configuration.
- `src/Leaderboard.tsx`: leaderboard fetching, top-10 qualification, score submission, and score display.
- `src/themes.ts`: theme definitions, preview values, local theme selection, and unlock progress helpers.
- `src/styles.css`: responsive layout, board/tile styling, modals, completion sheet, and controls.

### Backend

- `api/scores.ts`: Vercel serverless route for leaderboard GET and POST requests.
- `supabase/schema.sql`: Supabase table and leaderboard indexes.

### Testing

- `src/puzzle.test.ts`: pure puzzle logic tests.
- `src/adventure.test.ts`: Adventure level validity, image tile mapping, and local Adventure progression tests.
- `src/App.test.tsx`: game UI and interaction tests.
- `src/Leaderboard.test.tsx`: leaderboard UI and submission tests.

## Backlog

### High Priority

- Decide the v1 Adventure level list, image assets, grid sizes, and move limits.
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
- Tune Adventure level move limits after playtesting.
- Decide whether Adventure retry should restore the same original scramble or generate a fresh scramble.

### Adventure Improvements

- Add more curated image levels.
- Create a consistent image art direction and asset pipeline.
- Add a clearer level-complete unlock moment when the next level becomes available.
- Add local Adventure level best-time and best-moves display in the level list.
- Consider Adventure chapters or worlds once there are enough levels.
- Consider achievements that unlock themes.
- Add accessibility text for image puzzles that does not spoil the solution.

### Leaderboard Improvements

- Add pagination or "more scores" after the top 10.
- Add a personal score history stored locally.
- Add duplicate-name handling or player initials mode.
- Add an admin cleanup process for suspicious scores.
- Consider separate Supabase policies if a public read-only client is introduced later.

### Design Polish

- Re-check 5x5 typography and spacing across very small mobile screens after final visual styling settles.
- Add a subtle solved-state board animation.
- Improve empty leaderboard state copy and layout.
- Continue tuning the physical board style based on usability testing.
- Decide whether to keep Google Fonts as remote imports or self-host the final selected fonts.
- Decide whether CSS/SVG textures are enough or whether final art-directed texture assets are worth adding.
- Tune the Adventure hint instruction copy and placement after mobile playtesting.
- Refine locked Adventure card styling so it feels mysterious but still readable.
- Continue tuning board entrance motion timing if it feels too strong after repeated play.

### Technical Improvements

- Split drag interaction helpers out of `App.tsx` if the file grows further.
- Split Main Menu, Adventure level select, Theme picker, and board rendering into smaller components if `App.tsx` grows further.
- Add API route tests for `api/scores.ts`.
- Add Playwright coverage for mobile drag behavior in a real browser.
- Add Playwright visual checks for board entrance motion and Adventure image tiles.
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

- Refine completion animations.
- Add a solved-state celebration.
- Tune the 5x5 board for the smallest supported mobile viewport.
- Keep refining the board so it feels like the real physical version of the game.
- Continue developing app-wide themes.

### Milestone 5: Adventure Mode Expansion

- Create more curated image puzzles instead of relying only on numerical sequence puzzles.
- Make at least 30 levels.
- Tune each level's grid size, scramble length, and move countdown.
- Decide whether themes are unlocked through Adventure progress, achievements, or both.
