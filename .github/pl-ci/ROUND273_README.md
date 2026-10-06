# Round273 · D&D identity/combat template mapping

Stage101 adds a per-PC, per-template manual cell-reference map for seven D&D fields: background, species, alignment, level, proficiency bonus, initiative and hit points.

Safety contract:
- label anchors are evidence only and are never treated as writable cells;
- the user must independently confirm each A1 target reference in the current workbook;
- formula cells, label cells, missing cells and duplicate targets are rejected;
- only field-to-coordinate metadata is persisted with the local template;
- complete-backup metadata serialization must preserve the map;
- direct export writes only valid PC values into verified six-ability cells plus explicitly mapped fields.

The synthetic browser fixture contains no user workbook or user character data.
