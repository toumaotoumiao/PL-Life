# Round 74 CoC7 Excel filled-card regression

This CI fixture is synthetic only. It reproduces structural traits observed in user-supplied filled CoC7 cards without storing names, stories, or original workbook bytes.

Checks:
- shifted Kagura-family section anchors (including a 2020/06-style layout)
- only allocated skills are auto-imported for unverified family variants
- custom named rows with incomplete weapon fields are retained
- cached Excel error values are not imported as assets
- hidden/helper cells do not become arbitrary “user edits”
- export writes to the original workbook layout where the section structure is recognized
