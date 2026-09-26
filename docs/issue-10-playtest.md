# Issue #10 — Space Battle / Life Support closeout

Status: **device playtest pending**. PR #36 merged the playable mode into `main`. The automated checks below validate the implemented rules and input mappings; they do not establish real iPhone or iPad Safari behavior. Leave issue #10 open until the device checks pass and Drake approves the closeout.

## Merged implementation

- Space Battle / Life Support is a fixed-screen platformer with keyboard movement and separate touch buttons for Left, Right, Jump, and Repair. An ordinary fire clears on a descending stomp; an electrical panel requires a nearby, grounded Repair action.
- Uncontained fires and overload contact reduce system integrity. Hearts restore it up to five. Natural 1 changes each complete 12-opportunity icon cycle from two hearts and one overload to one heart and two overloads.
- Runs end at zero integrity or 60 seconds. The report includes the modified check, difficulty, Natural 1, role statistics, provisional raw score and rating, and the GM decision boundary. The scoring and difficulty values remain playtest tuning.

## Validation on the merged code — 2026-09-26

- `npm test`: **61/61 passed**. Focused coverage includes platform transitions, stomp direction, electrical repair distance, integrity and end rules, icon cycles, simultaneous keyboard/touch input, pause and retry, setup, scoring, and report text.
- `npm run build`: **passed** TypeScript and Vite production build. Vite still reports its known advisory for the 1,232.04 kB minified deferred runtime chunk (339.22 kB gzip); this is tracked separately in `docs/performance-decisions.md`.
- Local Codex in-app Chromium desktop pass: **completed one Medium (check 10), standard-icon run**. The game launched, keyboard movement and Jump moved the character onto a platform, and Repair input was exercised. Escape displayed the pause overlay at 41 seconds remaining; the timer stayed at 41 until explicit resume. The unattended run ended at zero integrity after 25.7 seconds, with 129 raw points and a complete Setback report. The report showed the check, difficulty, icon mix, fire/repair counts, integrity, and GM boundary. Copy reported success. No browser errors or warnings were observed. This pass did not verify a successful stomp or electrical repair, a 60-second completion, physical touch, or Safari behavior.

## Drake's device and desktop playtest — pending

Record the device model, OS, browser, viewport/orientation, modified check total, Natural 1 setting, and observed result for each run. Keep screenshots and raw reports private unless Drake chooses to share player-safe examples.

| Check | Real iPhone Safari | Real iPad Safari | Desktop keyboard |
| --- | --- | --- | --- |
| Move across platforms while jumping; move and press Repair together | Pending | Pending | Pending owner check; Codex separately observed a keyboard jump to a platform |
| Stomp orange fires from above; side contact does not clear them | Pending | Pending | Pending |
| Repair blue panels only while grounded and nearby | Pending | Pending | Pending |
| Hearts restore integrity; overloads and expired fires cost integrity; Natural 1 shows the altered icon mix | Pending | Pending | Pending |
| Pause, switch away and back, then resume explicitly; retry and rotate without blocked controls or clipped HUD | Pending | Pending | Pending |
| Reach both integrity failure and 60-second completion; read/select or copy the full GM report | Pending | Pending | Pending |

### Findings and disposition

No device findings have been reported yet. Record any defect with reproduction steps, affected device/browser, expected and observed behavior, and the fix or follow-up issue. Do not mark the device gate complete from desktop viewport emulation or automated tests.

## Closeout gate

After Drake reports the playtest results, fix any acceptance-blocking defects with focused regression coverage and repeat affected device checks. Update this record with the actual outcomes, run `npm test` and `npm run build`, and mark the closeout PR ready for Drake's review. Drake merges the PR; close #10 only after the merged record supports every acceptance criterion.
