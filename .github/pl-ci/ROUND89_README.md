# Round 89 — first-visit onboarding / Settings focus regression

- `round88-settings-live-browser.cjs` uses fresh, isolated browser contexts, gives the 450-ms first-visit guide time to appear, dismisses it using the real **不再提示** button, then clicks all eight Settings categories and opens the native file chooser. It also opens Settings immediately on a fresh visit and ensures the delayed guide cannot intercept any Settings click.
- `round89-onboarding-focus.test.cjs` executes the extracted first-visit onboarding functions in a synthetic VM, confirming delayed guidance respects an already open dialog, normal first-visit guidance still opens, and skipping the prompt does not mark it completed.
- `index.html` guards the delayed onboarding callback with the shared modal-presence function and closes an already displayed guide if Settings is explicitly opened. No user-data schema or backup engine changes.
- Run in GitHub Actions: `PL synthetic browser regression`; do not infer the outcome of the full browser test from Node tests or a metadata-only artifact.
