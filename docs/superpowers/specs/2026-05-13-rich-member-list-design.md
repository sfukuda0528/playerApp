# Rich Member List Design

## Goal

Make the member list feel richer while preserving the existing CampCanvas warm outdoor visual tone and current session behavior.

## Scope

- Update `InviteScreen` and `MainPage` member list presentation.
- Keep the existing participant source, host sorting, start navigation, QR display, and host kick behavior.
- Do not add new backend fields or realtime behavior.

## Visual Direction

Use the selected B direction:

- Show a prominent warm brown member summary panel.
- Emphasize the current count as `参加中 2 / 4`.
- Show a row of circular initial avatars for members and remaining empty slots.
- Keep host identity visible with a crown/host badge.
- Use the same warm cream, wheat, amber, brown, and orange palette already defined in `src/index.css`.

## Screen Behavior

`InviteScreen` uses the richest version because inviting members is the primary task before the session starts. It places the member summary inside the existing QR card and keeps the start button unchanged.

`MainPage` uses a slightly quieter version in the member tab so the member list, kick controls, and QR invite card remain scannable. Host users can still kick non-host participants from the list.

## Testing

Component tests should verify the visible richer UI markers without relying on style implementation details:

- Invite screen shows the member summary label.
- Invite screen shows empty slot count when fewer than the maximum participants are present.
- MainPage member tab shows the summary label.
- Existing member ordering and kick button tests continue to pass.
