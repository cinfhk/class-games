# Class Games · Ázia

Two Asia-themed games (Slovak hangman + quiz about Taiwan/Mongolia/China) with a shared live leaderboard. Built for sharing one link with classmates.

## How students use it

1. Open the shared link (`index.html#room=XXX`).
2. Type their name.
3. Click a game card, play, and the score lands on the leaderboard automatically.

## How the teacher sets it up

1. Open `index.html`.
2. Click **Vytvoriť herňu** — this creates a shared "room" on jsonblob.com (free, no signup).
3. Copy the URL (now contains `#room=XXX`) and share it with the class.
4. Open the same URL on a projector to show the live leaderboard.

## Scoring

- **Quiz**: time-based — faster correct answers earn more points (max ~300).
- **Hangman**: `wins × 100 + streak × 50 − hintsUsed × 15`. Click 🏁 Odoslať to submit current score.

The leaderboard sums each player's best score per game.

## Files

- `index.html` — landing page, leaderboard, room/player setup
- `asia-quiz.html` — 15-question quiz (auto-submits on results)
- `asia-hangman.html` — hangman with submit button
- `shared.js` — leaderboard client (jsonblob.com)
