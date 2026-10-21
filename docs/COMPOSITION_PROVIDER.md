# CompositionProvider — Replaceable composition engine contract

The provider boundary is now implemented in `packages/composition/src/contracts`.
`CompositionProvider.generate(context, signal?)` returns an untrusted value. Current contract accepts only `{notes: [{pitch,startTick,durationTicks,velocity}]}`. A deterministic `SeededProvider` is provided for development, **not** an LLM integration.

The orchestrator `proposeWithProvider` validates project, track, exclusive empty tick scope, size, numeric note bounds, unknown fields, note end times, IDs and a full dry-run through music-core. It returns `ValidatedComposition` whose ChangeSet contains `baseRevision`. It does not commit. The web application or a future server must expose a preview and require explicit approval. Music-core rechecks stale revision/locks on commit.

Provider never receives direct commit access. Runtime adapters and secret keys belong under services/agent-api, not composition or frontend. Raw model JSON is not trusted even when structured output mode is enabled.

Current limitation: additive-only empty-scope generation; not supporting modifications/deletions, selective replacement, arbitrary meter/key, musical quality assessment or LLM prompts. Future model adapters must supply controlled context and validation, rate limits, timeouts and version-aware results.

## Verification
`pnpm --filter @ai-composer/composition test`; `pnpm check`.
