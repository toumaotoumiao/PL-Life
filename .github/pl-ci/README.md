# CI-only synthetic integration fixtures

No personal archives. Only fixed fictional data. This directory is committed under `.github` and is not part of the published site file set. The workflow runs on an ephemeral 127.0.0.1 random port. To keep report metadata redacted, do not add raw backups or screenshot uploads.

第72轮额外检查：`round72-log-status-regression.test.cjs` 验证独立 Log 备注的筛选统计、新建行不覆盖已有备注，以及桌次状态保存失败时的显示回退。

## Current-release maintenance policy

The CI suite is a long-lived release guard, not a snapshot of one historical version.

- `round92-current-release-contract.test.cjs` derives the current app version from `APP_UI_VERSION`; do not hard-code the latest release number in current-release assertions.
- Visible current-version labels, the first release note and the service-worker cache must all match `APP_UI_VERSION`.
- When production functions gain a new top-level dependency, isolated VM fixtures must load that dependency from the real source instead of copying a stale value into the test.
- PNG/showcase tests assert behavior contracts (unified final preview, PNG compatibility conversion, ZIP fallback) instead of a fixed raw call count.
- New public image-export entrypoints must be added to the current-release showcase contract when they are introduced.
- Synthetic fixtures must remain fictional and must never include user backups, player names, original workbooks or screenshots containing personal data.
- Release work is not complete until the current static tests pass and the Chromium steps have had a chance to run in GitHub Actions.


## Browser-flow maintenance

- Browser audits must follow the same visible user flow as the product. If a new privacy, safety, onboarding or confirmation preflight is introduced, the audit must operate that preflight and then continue to the target UI; do not bypass it with synthetic DOM clicks or leave it open for later view tests.
- A blocking modal left by one audit step is a test failure in its own right because it can create misleading downstream navigation failures.
- When an intentional product flow changes, update the live-browser audit and its static coverage contract in the same release.

- `round93-privacy-export-resume.test.cjs` protects the privacy-export continuation contract: the original export action resumes only after the confirm click finishes bubbling, and dynamic export buttons are reacquired from the live DOM after privacy-mode rerenders.
- `round94-calendar-separation.test.cjs` protects Calendar 2.0: personal statistics must show module names and KP/PL identity in calendar cells, while Planner annual export owns a separate scheduling/agenda renderer with plan/archive status instead of reusing the statistics timeline.
- Round95 guards Recap 2.0: single-table Log/web output, person-display modes, integrated record recap using the current query, and visible PL/KP organizer export composition.

## PC / module export 2.0 maintenance

- `round96-pc-module-export2-contract.test.cjs` keeps the public PC export image-first: the primary PC menu exposes the unified image dossier plus the independent CoC7 Excel export, while legacy HTML/package/card outputs are not restored as competing primary actions.
- The complete PC image contract must continue to cover the dossier fields already present in the archive (identity, CoC7 values, skills, background sections, inventory/assets, weapons, growth snapshots, run history and PC notes) rather than regressing to the old short card.
- Module public export defaults to the integrated high-density dossier. Table history keeps stable `moduleId` matching and separately controls people, PC and HO disclosure; hidden-person mode must never fall back to raw KP/PL names.
- PC/module export code remains a read-only presentation layer. New display controls must not rewrite `pcs`, `modules`, `runRecords`, attachment blobs or backup formats.


## Public-name and density 2.0 maintenance

- `round97-public-name-density-contract.test.cjs` keeps PL archive names and public export names separate. `publicName` is optional and persisted in canonical identity. It may participate as an additional search alias, but must never replace the archive name, relationship identity, or raw saved name.
- Public image flows that expose people use the same four modes: public name, archive name, numbered anonymity, or hidden. Privacy mask always wins and forces anonymous output.
- Density controls use the common compact / standard / relaxed vocabulary. High-density mode must reduce whitespace and increase page capacity; a label-only density switch is not sufficient.

- Schema 26 explicitly owns the optional public-name field. Older archives must still load with an empty public name and round-trip without rewriting the archive name.

## PC export runtime-boundary maintenance

- `round98-organizer-free-layout.test.cjs` is part of the live GitHub Actions release gate; free-lane layout, insertion and column locks must not be local-only checks.
- `round99-pc-export-runtime-boundary.test.cjs` protects the PC snapshot/export module boundary. Presentation code must consume the read-only `PLPCSnapshotTools` bridge instead of calling helpers that are private to another IIFE.
- PC/module preview generation must catch runtime failures, replace the loading placeholder with a retryable failure state, and report that formal archives and unsaved drafts were not rewritten.
- The compatibility-level runtime error banner must remain dismissible, keep copyable diagnostics behind a disclosure, and allow later independent errors to surface again after dismissal.
## Public image-export convergence maintenance

- `round100-public-image-export-convergence.test.cjs` is the whole-site presentation-export audit. Public-facing PNG flows must converge on the unified final preview; they must not silently fall back to direct downloads when the preview layer fails.
- Retired PC HTML/package/simple-card public actions must stay retired. The HTML builder may remain only as an internal technical/batch-archive dependency where preservation, not public presentation, is the goal.
- File-oriented workflows such as full backup ZIP, JSON/Excel export, raw media download and migration diagnostics remain file exports; do not wrap them in the public-image composer merely for visual consistency.
- When a new public image-export entrypoint is added, update Round100 and the current-release contract in the same release.
## Calendar readability 2.1 maintenance

- `round101-calendar-readability-cleanup.test.cjs` keeps the public annual calendar readable: live and exported calendars show full same-day module names, statistics calendar segments are forced onto separate half-year pages, and normal archived entries do not waste space on redundant “已／已归档” labels.
- The public statistics surface intentionally omits `PL 参团次数分布`; do not replace it with annual-highlight or completed-module cards unless the product requirement changes explicitly.
- Planner annual export keeps three distinct purposes: one-page overview, complete half-year calendar pages, and a dense agenda list. Do not merge these back into one duplicate calendar-plus-list output.
- `round102-environment-isolation.test.cjs` guards pathname-scoped localStorage / IndexedDB / Cache Storage / BroadcastChannel separation between `/PL-Life/` and `/PL-Life-Test/`.
- `round102-environment-isolation-browser.cjs` performs the same-origin dual-site check in Chromium after Playwright installation; the test site may copy legacy data, but test writes and cache cleanup must leave production bytes untouched.


## Production recap and PC archive layout maintenance

- `round103-records-recap-preview-layout.test.cjs` keeps integrated record recap readable on production: the desktop composer reserves enough width for the 1080px canvas, only one export page is previewed at a time, focus-preview mode can hide controls, and the historical high-density default migrates to standard.
- `round104-pc-archive-layout-contract.test.cjs` protects the complete PC image dossier geometry. The nine background fields remain one semantic “背景故事” section, long text is measured from real Canvas wrapping instead of fixed line caps, field/value grids compute their actual body height, and each archive block isolates Canvas alignment/font state before the next block is drawn.
- Complete-dossier presentation fixes are display-only. They must not mutate PC archive fields, schema version, backup formats, production/test environment namespaces or attachment databases.

## Final export preview return-flow maintenance

- `round106-inline-export-privacy.test.cjs` keeps public image composers non-blocking: privacy is controlled inside the export editor and changing it redraws the open preview without writing formal archive data.
- `round107-final-preview-return-contract.test.cjs` protects the final confirmation layer: it must state the current privacy snapshot, keep X/backdrop as plain dismiss actions, and expose `返回调整` only when the source export editor supplies a safe return callback.
- Planner year, detailed availability, preference, statistics, PL/KP organizer, single-table recap, integrated recap, PC dossier and module dossier must return to the same editing context rather than forcing users to navigate back from scratch.
- On narrow screens a one-page final preview uses two action columns; multi-page output keeps the ZIP + PNG + return/close three-action layout. Privacy-state/feedback/footer rows must remain explicit so mobile browsers do not create accidental implicit-grid placement.


## Module dossier spacing maintenance

- `round108-module-export-spacing-contract.test.cjs` protects the module integrated dossier against the text/border collision shown by long recruitment notes: panel height must be derived from real Canvas wrapping, not rough character-count estimates.
- Module profile text, recruitment fields, ratings and table-history blocks reserve explicit top/bottom padding and an inter-block gap; the standalone recruitment page also sizes its canvas from measured content.
- Keep the PC complete-archive measured spacing model intact when changing shared entity-export helpers. Presentation spacing fixes remain read-only and must not mutate module/PC archives or backup schemas.
- `round111-records-recap-gutter-contract.test.cjs` keeps the integrated recap header, body and footer on one horizontal gutter baseline, with deliberate mobile gutter reduction instead of edge-to-edge content.

- Round112: 单桌回顾高度计算运行级回归，禁止 `return218` / `return92` / `return180` 等数字返回值粘连为未定义变量，并执行 summary / schedule / cast / logs / reflection / fallback 全分支。
