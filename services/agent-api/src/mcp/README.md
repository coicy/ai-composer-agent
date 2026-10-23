# MCP stdio — first executable slice

Run from repository root:

```bash
pnpm install
pnpm --filter @ai-composer/agent-api start:mcp
```

Configure your MCP client with the command `pnpm`, arguments `--filter @ai-composer/agent-api start:mcp`, and repository root as working directory. JSON-RPC 2.0 newline-delimited stdio transport; no messages are printed to stdout except protocol messages.

Tools: `music.open_snapshot` (explicit project JSON), `music.list_tracks`, `music.inspect_notes`, `music.propose_midi` (proposal request stub), `music.submit_candidate` (validates externally generated MIDI notes; no commit), `music.close_snapshot`. Sessions are isolated in process memory, expire after 30 minutes, and cannot commit.

**Scope limitation:** This is a snapshot-only MCP proof of execution, not a live editor bridge. It does not read current browser state, does not support user authorization for remote connections, does not approve or commit edits, and does not run an internal LLM. External Agents may reason with their own general-purpose LLM and use this MCP to inspect and request bounded validated candidate notes. The full user-requested workflow requires a separately implemented, authorized live MusicProject bridge and user-visible preview. Do not claim the complete MCP product is delivered.

The MCP server does not expose OPENAI_API_KEY or other internal LLM credentials. This initial stdio adapter is intended for local clients only. The server does not generate music: an external general-purpose LLM must supply note candidates through `music.submit_candidate`. `music.propose_midi` currently returns an empty draft envelope; it is not a music generator.

## Reproducible real-transport E2E checks

Run `pnpm --filter @ai-composer/agent-api test:mcp-e2e` from the repository root (Node.js 22 and pnpm 10). The test launches `src/mcp/index.ts` in an independent Node.js subprocess with `--import tsx`, writes newline-delimited JSON-RPC requests to stdin, and parses actual stdout responses. It checks initialization, tool schemas, snapshots, MIDI preview dry-run, invalid inputs, locked tracks, revision conflicts, isolation, revocation, and JSON-RPC parse errors. No paid model, API key, browser, or remote server is used.

Every completed run writes `services/agent-api/test-results/mcp-stdio-transcript.json` with the literal request/response messages and assertion names. GitHub Actions job `mcp-e2e` uploads it as artifact `mcp-stdio-transcript` for 14 days, including failed test runs when the test teardown can write its report. This report contains **synthetic fixture projects only** and is not evidence of a live browser-editor bridge. A successful `mcp-e2e` job proves the protocol paths exercised by the checks, not generic compatibility with all MCP hosts.

## Licensed MIDI reference lookup — dependent PR

This branch implements **three public-data, read-only MCP tools**:

- `music.reference_coverage` (no parameters): observed meters, pitched vs. drum-only counts, license counts, explicitly absent or unknown features.
- `music.search_references` (optional `meter`, exact `sourceStyle`, `usage`, `pitched`, `verifiedMode`, `verifiedGroove`, `limit` 1–10, `offset` 0–500): returns an AND-filtered, bounded list, with title, exact SHA-256 identifier, source credit, license and evidence URLs.
- `music.get_reference` (`id` is SHA-256): returns observed pitch/onset/dynamic statistics and license provenance; no original MIDI note events or bytes.

These tools do **not** access project snapshots, editor state, API credentials or approval tokens. They do not commit music changes.

### Local reference setup

The complete corpus is versioned on [PR #19](https://github.com/coicy/ai-composer-agent/pull/19). Once both dependent branches are merged, the MCP server discovers `references/catalog/manifest.json` automatically. Prior to merging, set the operator-owned `AI_COMPOSER_MIDI_CATALOG_PATH` environment variable to the absolute path to the **PR #19 checkout** at `references/catalog/manifest.json`.

```sh
pnpm install
AI_COMPOSER_MIDI_CATALOG_PATH=/absolute/path/to/references/catalog/manifest.json pnpm --filter @ai-composer/agent-api start:mcp
```

Missing catalog returns `reference_catalog_unavailable` (not fabricated matches). The server verifies all MIDI files' SHA-256 hashes against the checked-in catalog and requires per-file credit and rights evidence. Query parameters cannot supply files, URLs or network endpoints. The catalog is cached after first use; restart the MCP subprocess after replacing the reference files.

All original MIDI licensing remains independent of the application's own code license. CC BY 4.0 materials require the specified attribution. The response returns `credit`, `license`, `licenseUrl`, `rightsEvidenceUrl` and `sourceUrl` for traceability. A source genre tag is not an expert-verified style; mode or groove queries return **zero** until independently reviewed labels are available.

### Test scope and CI dependency

This is a dependent integration PR, based on MCP PR #18. CI pins the immutable reference corpus commit `a06a9ed7` from PR #19; it tests the true stdio subprocess against the 44 copyrighted/licensed MIDI references, and publishes literal request/response logs. Synthetic unit tests cover modified MIDI bytes, invalid rights, path traversal, missing corpus, unsupported filters and cases where scale or Swing would be wrongly inferred. No specialized music model or private keys are used.

**Not implemented:** LLM music quality evaluation, live browser-to-MCP project bridge, preview approval, replay of reference audio, or automated verification of the full musical style.

## Experimental opt-in seeded musical inspiration (stacked PR)

- `music.draw_inspiration`: requires an authorized snapshot session, unlocked `trackId`, explicit `seed` (uint32), `tonic`, `mode`, `meter`, `groove`, and a bounded tick scope. Optional `level`: `subtle` (2 low-intensity cards), `balanced` (3 up to medium), `adventurous` (4 up to high), and `focus` axes (`rhythm`, `motif`, `harmony`, `texture`, `form`, `expression`). The tool returns reproducible *original musical directions* only, with version and seed, never MIDI notes or approval.
- `music.prepare_composition_brief` may optionally take `inspirationSeed`, `inspirationLevel` and `inspirationFocus`; the returned brief then contains an `inspiration` plan. Without a seed this behavior is completely disabled; an intensity/focus without seed is rejected. The actual external general-purpose LLM still authors the MIDI and must submit it through Music Core dry-run / human approval in later phases.
- Track locks and project snapshot revisions are still enforced. Cards that require another editable track are filtered if none exists. Meter and phrase length filter inappropriate cards. Re-rolling changes only the caller-supplied seed; neither the model nor local PRNG is guaranteed to create better music.
- Source license attribution and reference provenance remain in the reference tool; no third-party creativity prompts/cards or MIDI notes have been copied. The seeded card algorithm is deterministic, but a remote LLM output **is not** guaranteed deterministic by the same seed.

Details: `docs/INSPIRATION_AND_NEXT_EXPERIMENT_PLAN.md`.
