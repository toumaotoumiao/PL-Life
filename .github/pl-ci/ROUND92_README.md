# Round 92 — current release contract

`round92-current-release-contract.test.cjs` is intentionally version-agnostic.
It reads the current version from `APP_UI_VERSION` and verifies that visible current-version labels, the first release note, the service-worker cache and the current showcase foundation stay in sync.

This test should normally survive a routine version bump unchanged. Update it only when the current product contract changes, for example when a new public image-export entrypoint is added or the release architecture changes.

No personal archive, workbook, screenshot or user content is included.
