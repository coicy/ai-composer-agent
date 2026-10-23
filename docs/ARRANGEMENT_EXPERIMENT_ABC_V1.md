# AI Composer Agent — 参考驱动编曲 A/B/C 实验 v1

## 状态与结果

**已真实生成、渲染、解析并验证** 3 个 Type-1 Standard MIDI 文件、3 个 MP3 文件；另有一个匿名试听页面。实验曲为 16 小节、4/4、112 BPM、480 PPQ、D Dorian，约 36.31 秒。4 轨为 Jazz Electric Guitar、Rhodes、Electric Finger Bass、GM Drums。音频由 FluidSynth 使用 TimGM6mb SoundFont 离线合成，统一响度约 −18 LUFS。

**这不是三个相互隔离的通用 LLM 调用。** 一个 GPT-6 对话内一次性作者化了共同旋律和三个不同编曲处理；Python 仅作既定音乐事件的展开、MIDI 序列化、合成和分析。测试可以比较作品及准备后续盲听，**不能**用来证明「结构化参考 MIDI 使通用 LLM 的编曲质量提高」的因果结论。

## 公共任务（严格固定）

> 为游戏场景编写一个带 Shuffle 倾向的 D Dorian 四轨短曲。16 小节、112 BPM、4/4。固定主旋律音高顺序和和声进行。使用 Jazz Electric Guitar、Rhodes、Electric Bass 与 GM 鼓组。重点表达有主次重音、自然摆动、稳定的调式中心及清晰声部分工。最终 MIDI 必须合法且可试听。

- 16 个小节和声进行（四小节一组）：`Dm9 / G13 / Dm9 / G13`；`Dm9 / Cmaj9 / G13 / Dm9`；`G13 / Dm9 / Cmaj9 / G13`；`Dm9 / Em7 / G13 / Dm9`。
- 三组的 **77 个主旋律音高完全一致**，且包含 D Dorian 的辨识音级 B 自然；允许节奏与奏法的变化。根音 D 为乐句着重点；音级集合为 D、E、F、G、A、B、C。
- 标准 MIDI 的 `key_signature` 标记为 **C**（无升降号，表达同一组音级），同时文字标记目标调式 **D Dorian**。MIDI 传统 Key Signature 事件没有完整的 Dorian 主音语义，不能以 D minor 自然小调的降 B 错标。
- 三组都使用相同音色及同一版 SoundFont，统一音量；因此可比较节奏/律动/配器的主观表现，但声部音符密度并不固定。

## 三个条件

| 条件 | 生成时使用的参考资料 | 编曲取向 |
|---|---|---|
| A：无参考 | 仅共用任务，不展示来源标签/音符统计 | 基于模型一般经验安排后半拍、和弦和鼓；不过度故意做坏基线 |
| B：风格标签 | 增加来源原文 `blues/shuffle`，不使用事件分布 | 使用较明确的 2:1 后半拍布局、重拍和切分伴奏 |
| C：结构化参考 | 增加两条真实授权 Groove MIDI 的中位后半拍、速度、力度及来源信息 | 采用差异化后半拍分布、力度/装饰/幽灵音与句末衔接；没有复制原始 MIDI 鼓型 |

### 实际参考证据

两条均来自 Google LLC 的 [Groove MIDI Dataset](https://magenta.withgoogle.com/datasets/groove)，授权 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)，保留于此前参考库 PR #19，未将原始 MIDI 打进本实验压缩包：

| 原始参考文件 | BPM | 采样数量（季度拍内 0.52–0.79 相位） | 参考相位中位数 | 四分位间距 | 力度标准差 |
|---|---:|---:|---:|---|---:|
| `midi/blues/blues_01.mid` | 112 | 33 | 0.6083 | 0.5604–0.6313 | 40.07 |
| `midi/blues/blues_02.mid` | 134 | 34 | 0.6469 | 0.6313–0.6750 | 39.56 |

两个参考属于 **同一演奏者 drummer4**，所以无法证明它们具有跨演奏者代表性；两者的来源风格 `blues/shuffle` 为 `source_declared` 而非独立音乐专家复核标签。样本力度范围包括不同鼓件，力度标准差也不可以直接视作人性化质量指标。

## 完成的机器可复核测量

| 指标 | A | B | C |
|---|---:|---:|---:|
| 主旋律音符数 | 77 | 77 | 77 |
| Rhodes 音符数 | 128 | 192 | 192 |
| 贝斯音符数 | 64 | 96 | 124 |
| 鼓组音符数 | 192 | 228 | 248 |
| 总音符数 | 461 | 593 | 641 |
| 鼓组拍内后半拍相位中位数 | 0.6208 | 0.6667 | 0.6354 |
| 鼓组力度标准差 | 9.34 | 17.42 | 20.57 |
| 音高违反 D Dorian | 0 | 0 | 0 |
| MP3 时长 | ≈36.31 秒 | ≈36.31 秒 | ≈36.31 秒 |
| MP3 响度 | −18.1 LUFS | −18.1 LUFS | −18.2 LUFS |

**Interpretation:** C 的鼓组时间相位位于两条参考中位数之间，且鼓组力度/声部密度变化更大；这些是**客观信号特征**，并不证明 C 在 Shuffle 自然度、游戏音乐适配或好听程度上优于 A、B。音符密度与伴奏内容同时变化，不能把主观差异归因于某一个节奏数值。

## 操作：试听与评分

1. 解压实验 ZIP，保持 `blind_listen.html` 与 `variant_A.mp3`、`variant_B.mp3`、`variant_C.mp3` 位于同一目录。
2. 用浏览器打开 `blind_listen.html`。页面随机映射显示作品 X/Y/Z，初始不展示组别。
3. 每段至少完整听两遍，按 **节奏清晰度、Shuffle 律动自然度、声部融合度、整体音乐性** 各 1–5 分评分；可补充描述性的自由文本。
4. 提交评分后揭晓 X/Y/Z 所对应条件，点击「保存评分 CSV」。
5. 首批建议请至少 5 位不同听者独立评价；对每项展示中位数、四分位范围及分歧意见，而非用单次分数宣称胜出。若今后有足够听评再检验条件差异。

## 操作：MIDI 工程检查

- 在 PR #18 的浏览器 Piano Roll 中分别导入 `variant_A.mid` 等，对比四轨密度、音高/时值和重拍。
- 标准 MIDI 导入当前不完整保留调式的自定义语义、节奏分类、许可来源信息；本实验把这些信息放在 `experiment_results.json` 和说明文档。
- MCP 的 `music.submit_candidate` 最多 64 个音符，本实验某些轨道超过 64，**不能**一次直接提交整首。必须分批，并处理 Music Core revision 演进；PR #21 的 `music.evaluate_composition_candidate` 是 dry-run，不负责跨调用批准或原子多轨提交。这里未声称整首已通过 MCP 提交。

## 操作：复核与复现

```bash
python verify_experiment.py
# 若有 Python mido + numpy、系统 FluidSynth 与 FFmpeg、合法的 TimGM6mb SoundFont
python build_experiment.py
python verify_experiment.py
```

`build_experiment.py` 默认从已有的 `/mnt/data/ai_composer_reference_pack_v2_44_midis.zip` 提取两个官方来源样本以验证 SHA-256；在其他机器运行时需修改源 ZIP 路径或提供同一份 44 文件的可信 ZIP。采用的 MIDI 文件未复制进交付包，以免重复分发 CC BY 4.0 数据。代码重运行也可能因系统音源、浮点版本或合成参数与此处产生不同的 MP3 位级哈希。

## 许可与权属边界

- 参考数据：Google LLC，Groove MIDI Dataset，[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)；本实验仅使用统计信息，并在文档中保留来源、作者/数据集、协议和文件 SHA。
- 离线音色：系统 `/usr/share/sounds/sf2/TimGM6mb.sf2`，Debian 发行包 `timgm6mb-soundfont` 将 SoundFont 标为 **GPL-2**，维护及来源署名 Tim Brechbill、David Bolton。SoundFont 文件**未打包**；对渲染音频的后续商业再分发，应单独做 SoundFont 样本许可审查，必要时改用明确允许音频再分发的音源重新渲染。
- 本次乐曲的主旋律/和声编配由 GPT-6 在当前对话创作，并未复制上述参考 MIDI 的完整音符序列。对 AI 作品是否适用版权保护存在司法辖区差异，不作权属保证。

## 局限与下一步

本次只有一个题目、一个作者化模型会话、三种同时构思的条件，没有独立模型运行、严格上下文隔离、风格专家确证、听评数据、随机种子平衡或统计显著性。**尚不能得出参考库有效或无效的结论。** 更严格的下一轮应由外部通用 LLM API/Codex 真正独立运行三组 prompt，记录每次工具调用与 token/model 版本，音符由模型逐组提出，再使用同一 MCP 校验链路生成/试听，而不能用预写 Python 编曲逻辑代替模型输出。