# GLPI Asset Hub — UI Improvement Notes

## Updated areas

- Rebuilt the GLPI connection screen as a responsive split-layout sign-in experience.
- Added a structured application header with page context, global search, notifications, refresh action and user identity.
- Redesigned the sidebar for clearer grouping, stronger active states and better information density.
- Reworked the dashboard hierarchy, metric cards, charts, quick actions and recent-assets section.
- Improved tables, filters, pagination, forms, modals, reports, imports and empty states.
- Added a polished light theme while retaining the existing dark mode.
- Added responsive layouts for desktop, tablet and mobile.

## UX and behavior fixes

- The GLPI connection screen now appears automatically when no saved session exists.
- Expired saved sessions return users to the connection screen with a clear message.
- The connection button now shows a loading state and prevents duplicate submissions.
- The login overlay cannot be dismissed while the user is unauthenticated.
- Dashboard counts are fetched concurrently instead of one request at a time.
- The status chart now uses actual dashboard asset status totals.
- Removed randomly generated license-expiry alerts.
- Added `Ctrl/Cmd + K` to focus global search.
- Search entered in an asset section is synchronized with that section’s filter.

## Files changed

- `index.html`
- `assets/css/style.css`
- `assets/js/app.js`

The GLPI API client and PHP backend were not changed.
