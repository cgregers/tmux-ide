# Home activity and search keyboard workflows

11 October 2026. Native Home now reuses its existing search/filter state for the
TUI shortcuts: `/` focuses agent search, `0` selects All, `w` selects Working,
`a` toggles Attention (returning to All), and Escape clears/exits focused search.
A visible hint documents these bindings. These shortcuts do not select a pane,
write registry state, request daemon changes or mutate the published roster.

Reference behavior: `application-home-agent-roster.tsx` and
`application-home-fleet.ts` in the TUI runtime. This slice covers loaded-roster
filtering; it does not qualify fleet-wide agent aggregation or machine filtering.

Shortcut handling requires Home and a published roster, declines modified keys
and dialogs, and preserves text editing/marked composition. Held `a` events do
not repeatedly toggle the filter. Workspace key routing remains with the terminal.

## Verification scope

The dedicated `home/tests/filter_keys.rs` exercises real headless keyboard dispatch
for filter transitions, search text containing shortcut characters and Escape,
checking that no terminal/browser command is emitted. Separate cases test
modifier/modal/Workspace/missing-roster refusal and marked IME/held-key behavior.
These are headless GPUI checks, not a physical macOS input or IME qualification.
Independent read-only review approved the shortcut ownership and TUI mapping.

Physical keyboard/pointer and normal/narrow native inspection remain pending: the
Mac was locked at the preceding native QA attempt, and no unlock has been reported.
Do not treat this evidence as release qualification, full Home/F5 parity, or a
physical visual comparison. Production sessions, the Showcase recording demo and
protected generated CLI bundle were not modified. No merge or publication.

Final gates: Rust default **2844 passed / 10 ignored**, all features
**2878 passed / 17 ignored**. Both workspace Clippy configurations
(`--all-targets --all-features` and `--all-targets --no-default-features`,
`-D warnings`), format, source-size and native debug build passed. The existing
`block 0.1.6` future-compatibility warning remains. No TypeScript source changed,
so the preceding bridge result (320 passed / five skipped) was not rerun.
