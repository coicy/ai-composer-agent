# Implementation status

The project includes a basic Piano Roll, multi-track selection, synthesized preview audio, MIDI import/export, revision-aware editing and undo, algorithmic melody composition and continuation. A CompositionProvider boundary validates generated notes in an empty target range.

Added local **agent-api** service with an OpenAI Responses API model adapter (key only on server), bounded JSON-schema structured output, timeout and safe error responses. Web app can request natural-language melody proposals and, after client-side validation, preview them on the piano roll for explicit approval. Default local-dev model is configurable by OPENAI_MODEL.

CI uses a mock network API and does **not** prove a real model API request or artistic quality. The backend binds to 127.0.0.1 and is not production-authenticated. Details: docs/LLM_INTEGRATION.md.
