# Agent UI feature boundary
The web client talks only to /api/compose through Vite proxy. It never receives OPENAI_API_KEY.
Treat the server response as untrusted; validate with proposeWithProvider before the candidate enters the UI. Never log raw user music or credentials.
Show ghost-note preview, require user confirmation, and let music-core recheck revision and locks before applying.

## 三轨编配
- 只能经过 `remote-arranger` 调用本地 /api/arrange，不得存储或打印模型密钥。
- 服务端返回的编配音符仍须在浏览器通过 `proposeArrangement` 二次校验。
- 编配预览音符不是工程真实数据；试听时的项目只存在临时内存，确认后提交三项原子 add_track。修改或撤销工程后必须使候选失效。

## Scoped regeneration
- A regenerated candidate is a **targeted edit** on an existing track; verify source/target are distinct and never edit other tracks or notes outside the selected scope.
- Target role must be explicitly identified; do not assume the active Piano Roll track is the read-only source.
- Remote proposals are untrusted and are revalidated with `proposeRegionRegeneration` before display.
- Blue ghost notes and red deletion markers are non-mutating; audition via a temporary `applyChangeSet` result; only approval commits, and revision changes invalidate previews.
- Do not silently reapply a previous HarmonyPlan: it is not persisted with imported MIDI or MusicProject in this prototype.

## Pitch-only scoped regeneration
- Checkbox input is explicit authorization for updating pitch only. The client sends only `editConstraint:'pitch_only'`, not editable model note IDs. The composition validator reconstructs exact original time/duration/velocity and commits `update_note.pitch` operations.
- Do not claim `pending-delete` means deletion while pitch-only mode is enabled; its preview marks the existing notes being updated. Never auto-relax this constraint if remote output fails.
