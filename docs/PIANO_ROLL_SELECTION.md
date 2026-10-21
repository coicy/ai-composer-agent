# Piano Roll mouse marquee and targeted AI rewriting

Two mouse tools: **编辑音符** retains drag/resize and double-click insertion; **框选音符** selects notes intersecting a two-dimensional drag rectangle. Hit testing and note time-scope calculation live in @ai-composer/piano-roll (unit-tested pure functions).

Selecting **仅重写框选音符** sends selected stable Note IDs and exact earliest start/latest end as the permitted scope. Unselected overlapping notes, including other voices and locked notes, are preserved. The server and browser independently validate IDs, bounds, permissions and dry-run the atomic change set. The UI marks candidate additions and intended deletions, and requires approval against current revision.

Selecting **重写指定小节** keeps full-bar behavior (rejects partial boundary overlaps); **轨道末尾续写** adds new music only.

Current limitations: one track at a time; no shift-add or multi-note manual drag; MIDI still uses fixed 4/4 for bar inputs; no semantic guarantee of instructions such as “retain rhythm” yet. No live paid-model quality evaluations have been performed.
