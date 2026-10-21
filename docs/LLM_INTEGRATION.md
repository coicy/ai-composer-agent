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
