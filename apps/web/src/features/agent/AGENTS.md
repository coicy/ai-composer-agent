# Agent UI feature boundary
The web client talks only to /api/compose through Vite proxy. It never receives OPENAI_API_KEY.
Treat the server response as untrusted; validate with proposeWithProvider before the candidate enters the UI. Never log raw user music or credentials.
Show ghost-note preview, require user confirmation, and let music-core recheck revision and locks before applying.
