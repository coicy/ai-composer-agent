# Agent UI feature boundary
The web client talks only to /api/compose through Vite proxy. It never receives OPENAI_API_KEY.
Treat the server response as untrusted; validate with proposeWithProvider before the candidate enters the UI. Never log raw user music or credentials.
Show ghost-note preview, require user confirmation, and let music-core recheck revision and locks before applying.

## 三轨编配
- 只能经过 `remote-arranger` 调用本地 /api/arrange，不得存储或打印模型密钥。
- 服务端返回的编配音符仍须在浏览器通过 `proposeArrangement` 二次校验。
- 编配预览音符不是工程真实数据；试听时的项目只存在临时内存，确认后提交三项原子 add_track。修改或撤销工程后必须使候选失效。
