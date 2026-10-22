# LLM composition integration (local development)

The optional Node 22 agent-api service uses OpenAI Responses API `POST /v1/responses`, JSON-schema structured output and `store:false`. The default model is `gpt-4.1-mini`, configurable via OPENAI_MODEL; verify availability in your API account.

## Run locally

1. From the repository root: `pnpm install`.
2. In terminal A set `OPENAI_API_KEY` in your shell and run `pnpm dev:agent`. Do not paste tokens into chats or commit them.
3. In terminal B: `pnpm dev`. Open the Vite URL (usually http://localhost:5173).
4. In Agent panel type a musical request and click **AI 生成预览**. Edit/confirm/cancel in the Piano Roll.
5. `GET http://127.0.0.1:8787/health` checks that the service has a key, not whether the key/model works.

Web Vite proxies /api to loopback 127.0.0.1:8787. The service binds ONLY to loopback; do not expose it publicly without production authentication, authorization, CSRF protections and rate-limit infrastructure. The simple in-memory per-address rate limit is development-only.

The server sends a bounded recent-note window and user instruction to the configured model. Only `{notes:[{pitch,startTick,durationTicks,velocity}]}` is accepted and all generated notes must fall within the empty target range. Server AND browser independently validate proposals with music-core. They cannot delete or overwrite human notes. Confirmation happens in the browser; stale revision previews are rejected. Current UI appends at next 4/4 bar and limits each model request to 1–4 bars.

No live key/model call occurs in CI (a fake fetcher tests the API adapter). No assertion of musical quality or external API success has been made. No user music/prompt is logged by the app, but API provider processing is still subject to provider data policy.

## Limitations
No authentication for Internet hosting, no persistence, no project tempo/meter map, no model feedback loop, no structured instrument control, no harmony generation, no note deletion from model output, and no guarantee that model melodies are musically compelling.

## Rewriting an existing phrase

Choose **重写指定小节** in the Agent panel, set the first bar (1-based) and number of bars (1–4), and provide a musical instruction. The model sees the selected passage and nearby context; newly proposed notes show as blue ghosts while notes that would be removed show red. If any existing note straddles the selection or is locked, the operation is rejected before the API call. Click 确认应用 to atomically apply the verified change or 取消 to retain the original. Choose 轨道末尾续写 to append without deletions. This operates on one MIDI track and fixed 4/4 bar mapping in the current prototype.

## Strict pitch-only rewriting

Use the Piano Roll marquee, select **仅重写框选音符**, enable **只改音高**, and request a new melody shape. The local model is asked to preserve all original onset/length values, but these constraints are independently enforced by the composition validator. If the provider changes timing or note count, the request returns a validation error instead of silently changing the music. Original note IDs, velocity and unaffected notes are preserved. Deterministic ±12-semitone transposition is available without running the model. See [MUSIC_EDIT_CONSTRAINTS.md](MUSIC_EDIT_CONSTRAINTS.md).

## Three-track arrangement

Select a melody track and start bar (1–64), with 1–4 bars length. Use the **多轨 AI 编配** panel to request independent harmony, bass and accompaniment. Existing track notes are read-only; the three candidate tracks are shown as overlays on the Piano Roll, can be auditioned with the melody, and are saved only after explicit confirmation. The offline rule-based demo button requires no API credentials, but does not demonstrate professional harmony quality. See [MULTITRACK_ARRANGEMENT.md](MULTITRACK_ARRANGEMENT.md).

## Approved dual-access product contract (D-006; pending implementation)

The product must support **(A) MCP tools callable by an external Agent** and **(B) user-entered LLM API endpoint + API Key for internal generation**. In both modes MIDI candidates remain subject to the same Music Core scope/lock/revision validation, preview, explicit user approval and undo rules; D-005 still requires a general-purpose LLM rather than a dedicated music generation model.

**Current implementation is not either complete mode**: the loopback `agent-api` gets the OpenAI Key/model from process environment, no MCP server exists, and the Web app has no UI for an endpoint/Key. The existing provider's injected endpoint option is not a user-facing settings interface.

Implementation must separate internal Key from external MCP access, avoid embedding or persisting credentials in frontend storage, logs or project JSON, and account for the browser-held MusicProject session when exposing authorized MCP tools. API protocol differences, session security, secret lifetime, endpoint/redirect safety and deployment remain under review. Full specification: [LLM_ACCESS_MODES.md](LLM_ACCESS_MODES.md).
