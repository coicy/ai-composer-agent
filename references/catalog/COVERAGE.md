# 多维 MIDI 覆盖矩阵（自动生成）

> MIDI 事件证据与未验证风格严格分离；文件夹名不是互斥的流派标签。

- MIDI 文件数：44
- 原有风格/场景索引组数：17
- 拍号专项采样桶数：3

## 拍号覆盖

| 拍号 | MIDI 数量 | 结果 |
|---|---:|---|
| 2/4 | 2 | 已有证据 |
| 3/4 | 3 | 已有证据 |
| 4/4 | 32 | 已有证据 |
| 6/8 | 3 | 已有证据 |
| 9/8 | 0 | **待补充** |
| 12/8 | 0 | **待补充** |
| 5/4 | 1 | 已有证据 |
| 5/8 | 1 | 已有证据 |
| 7/8 | 0 | **待补充** |
| 7/4 | 0 | **待补充** |

## 来源与能力边界

| 指标 | 数量 |
|---|---:|
| 来源：game_composition_midi | 8 |
| 来源：human_drum_performance | 28 |
| 来源：score_derived_midi | 8 |
| pitched_material | 16 |
| drum_only | 28 |
| meter_unknown | 0 |
| human_performance_drums | 28 |
| velocity_variation_observed | 37 |
| expert_verified_mode | 0 |
| expert_verified_groove | 0 |
| expert_verified_form | 0 |

## 样本独立性风险

- blues: 2 clips from 1 documented drummer(s); recordings are not independent performers.
- dance: 2 clips from 1 documented drummer(s); recordings are not independent performers.
- meter_6_8: 3 clips from 1 documented drummer(s); recordings are not independent performers.
- meter_5_4: only 1 source clip(s); useful as a meter probe but insufficient for style representativity.
- meter_5_8: only 1 source clip(s); useful as a meter probe but insufficient for style representativity.

## 重要提示

- Original index groups are not mutually exclusive musical genres.
- Drum-only MIDI files must not count toward pitch/mode/harmony coverage.
- Key signatures and pitch-class histograms are not verified key or mode labels.
- Sixteenth-phase timing histograms are not swing or human-feel certifications.
- Game usage labels are not genre labels.
- MIDI instrument programs do not fully capture synthesized audio timbre.

## 报告范围

已观测：MIDI 音符、拍号/速度元事件、来源标签、力度数值。
未证明：感知拍型分组、Swing 类别、主音和调式、和弦功能、曲式、风格审美。
未知不是否定；以上音乐学标签需要可信注释或专家复核。
