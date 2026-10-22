# MCP stdio — first executable slice

Run from repository root:

```bash
pnpm install
pnpm --filter @ai-composer/agent-api start:mcp
```

Configure your MCP client with the command `pnpm`, arguments `--filter @ai-composer/agent-api start:mcp`, and repository root as working directory. JSON-RPC 2.0 newline-delimited stdio transport; no messages are printed to stdout except protocol messages.

Tools: `music.open_snapshot` (explicit project JSON), `music.list_tracks`, `music.inspect_notes`, `music.propose_midi` (deterministic, no LLM Key), `music.close_snapshot`. Sessions are isolated in process memory, expire after 30 minutes, and cannot commit.

**Scope limitation:** This is a snapshot-only MCP proof of execution, not a live editor bridge. It does not read current browser state, does not support user authorization for remote connections, does not approve or commit edits, and does not run an internal LLM. External Agents may reason with their own general-purpose LLM and use this MCP to inspect and request bounded deterministic candidate notes. The full user-requested workflow requires a separately implemented, authorized live MusicProject bridge and user-visible preview. Do not claim the complete MCP product is delivered.

The MCP server does not expose OPENAI_API_KEY or other internal LLM credentials. This initial stdio adapter is intended for local clients only. The candidate generation helper is deterministic test scaffolding, **not** a dedicated music-generation model and **not** a replacement for LLM composition.
