# Last Session Return Design

## Goal

Allow users to return to the room they were in before a connection drop or app reload.

## Behavior

- After creating or joining a session, save the session object in browser local storage.
- On the top page, show a "前回の部屋に戻る" button only when a valid saved session exists.
- Clicking the button navigates to `/session/:sessionId` and passes the saved session through router state.
- If saved data is malformed, remove it and hide the button.
- When a session is ended by the user or via realtime status, clear the saved session.

## Architecture

Create a small local-storage helper for the last session. Components call the helper at existing session lifecycle points instead of duplicating storage parsing logic.

## Tests

- Storage helper saves, loads, clears, and rejects malformed values.
- Top page renders and navigates through the return button when a saved session exists.
- Create and join flows save successful sessions.
- Main page clears the saved session when the room ends.
