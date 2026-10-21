import {test,expect} from '@playwright/test';

test('edit a note, change zoom, edit velocity, and undo in the browser',async({page})=>{
 await page.goto('/');
 await expect(page.getByRole('heading',{name:'AI Composer Agent'})).toBeVisible();
 await page.getByRole('button',{name:'+ 添加音符'}).click();
 const note=page.locator('.note').first();
 await expect(note).toBeVisible();
 await expect(page.getByText(/revision 1 · 1 notes/)).toBeVisible();
 const leftBefore=await note.evaluate(e=>(e as HTMLElement).style.left);
 const widthBefore=await note.evaluate(e=>(e as HTMLElement).style.width);
 await page.getByRole('combobox',{name:'水平缩放'}).selectOption('120');
 await expect(note).toHaveCSS('left','0px');
 expect(await note.evaluate(e=>(e as HTMLElement).style.left)).toBe(leftBefore);
 expect(await note.evaluate(e=>(e as HTMLElement).style.width)).not.toBe(widthBefore);
 const bar=page.getByRole('slider',{name:/音符力度/}).first();
 await expect(bar).toHaveAttribute('aria-valuenow','90');
 await bar.scrollIntoViewIfNeeded();
 const box=await bar.boundingBox();if(!box)throw new Error('no velocity bar');
 await page.mouse.move(box.x+box.width/2,box.y+2);
 await page.mouse.down();
 await page.mouse.move(box.x+box.width/2,box.y+24,{steps:5});
 await page.mouse.up();
 await expect(page.getByText(/revision 2 · 1 notes/)).toBeVisible();
 await expect(bar).not.toHaveAttribute('aria-valuenow','90');
 await page.getByRole('button',{name:'撤销'}).click();
 await expect(bar).toHaveAttribute('aria-valuenow','90');
});

test('marquee selection, one-transaction batch movement, undo and zoom',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'+ 添加音符'}).click();
 await page.getByRole('button',{name:'+ 添加音符'}).click();
 const notes=page.locator('.note');
 await expect(notes).toHaveCount(2);
 await notes.nth(0).scrollIntoViewIfNeeded();
 await page.getByRole('button',{name:'框选音符'}).click();
 // Toolbar focus scrolls the document; fetch fresh coordinates after restoring the note viewport.
 await notes.nth(0).scrollIntoViewIfNeeded();
 const first=await notes.nth(0).boundingBox(),second=await notes.nth(1).boundingBox();
 if(!first||!second)throw new Error('notes are outside visible scroll region');
 await page.mouse.move(first.x+3,first.y+3);
 await page.mouse.down();
 await page.mouse.move(second.x+second.width-3,second.y+second.height-3,{steps:6});
 await page.mouse.up();
 await expect(page.getByText('2 个已框选音符')).toBeVisible();
 await expect(page.locator('.note.multi-selected')).toHaveCount(2);
 await page.getByRole('button',{name:'编辑音符'}).click();
 // Clicking the toolbar scrolls the page to its top; restore the note to the visible viewport.
 await notes.nth(0).scrollIntoViewIfNeeded();
 const before0=await notes.nth(0).evaluate(e=>(e as HTMLElement).style.left);
 const before1=await notes.nth(1).evaluate(e=>(e as HTMLElement).style.left);
 const r=await notes.nth(0).boundingBox();if(!r)throw new Error('no movable note');
 await page.mouse.move(r.x+9,r.y+8);
 await page.mouse.down();
 await page.mouse.move(r.x+40,r.y+8,{steps:6});
 await page.mouse.up();
 const after0=await notes.nth(0).evaluate(e=>(e as HTMLElement).style.left);
 const after1=await notes.nth(1).evaluate(e=>(e as HTMLElement).style.left);
 expect(after0).not.toBe(before0);
 expect(after1).not.toBe(before1);
 await expect(page.getByText(/revision 3 · 2 notes/)).toBeVisible();
 await page.getByRole('button',{name:'撤销'}).click();
 expect(await notes.nth(0).evaluate(e=>(e as HTMLElement).style.left)).toBe(before0);
 expect(await notes.nth(1).evaluate(e=>(e as HTMLElement).style.left)).toBe(before1);
});

test('offline three-track arrangement is previewed, atomically approved and undone',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'+ 添加音符'}).click();
 await page.getByRole('button',{name:'规则编配预览（离线）'}).click();
 await expect(page.getByText(/候选：新增 3 个轨道/)).toBeVisible();
 const diagnostic=page.getByRole('region',{name:'编配结构诊断'});
 await expect(diagnostic).toContainText('证据不足');
 await expect(diagnostic).toContainText('结构统计');
 await expect(page.locator('.arrangement-ghost')).toHaveCount(8);
 await page.getByRole('combobox',{name:'编配预览轨道'}).selectOption('bass');
 await expect(page.locator('.arrangement-ghost.bass')).toHaveCount(8);
 await page.getByRole('button',{name:'确认新增 3 轨'}).click();
 const tracks=page.getByRole('combobox',{name:'当前轨道'});
 await expect(tracks.locator('option')).toHaveCount(4);
 await expect(page.getByText(/revision 2/)).toBeVisible();
 await tracks.selectOption('melody');
 await expect(page.locator('.note')).toHaveCount(1);
 await expect(page.locator('.note')).toHaveAttribute('title','pitch 72, start 0, duration 480');
 await page.getByRole('button',{name:'撤销'}).click();
 await expect(tracks.locator('option')).toHaveCount(1);
 await expect(page.locator('.note')).toHaveCount(1);
});

test('untrusted AI arrangement outside scope is rejected by browser validation',async({page})=>{
 await page.route('**/api/arrange',async route=>{
  const tracks=['harmony','bass','accompaniment'].map(role=>({role,notes:[{pitch:60,startTick:10000,durationTicks:480,velocity:80}]}));
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({tracks})});
 });
 await page.goto('/');
 await page.getByRole('button',{name:'+ 添加音符'}).click();
 await page.getByRole('button',{name:'AI 多轨编配预览'}).click();
 await expect(page.getByRole('alert')).toContainText('arrangement_note_outside_scope');
 await expect(page.getByRole('button',{name:'确认新增 3 轨'})).toHaveCount(0);
 await expect(page.getByRole('combobox',{name:'当前轨道'}).locator('option')).toHaveCount(1);
});

test('valid but questionable harmony shows advisory diagnostics without automatic rejection',async({page})=>{
 await page.route('**/api/arrange',async route=>{
  const tracks=[
   {role:'harmony',notes:[{pitch:73,startTick:0,durationTicks:480,velocity:80}]},
   {role:'bass',notes:[{pitch:80,startTick:0,durationTicks:480,velocity:75}]},
   {role:'accompaniment',notes:[{pitch:60,startTick:0,durationTicks:480,velocity:70}]}
  ];
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({tracks})});
 });
 await page.goto('/');
 await page.getByRole('button',{name:'+ 添加音符'}).click();
 await page.getByRole('button',{name:'AI 多轨编配预览'}).click();
 const diagnostic=page.getByRole('region',{name:'编配结构诊断'});
 await expect(diagnostic).toContainText('低音高于');
 await expect(diagnostic).toContainText('交叉');
 await expect(page.getByRole('button',{name:'确认新增 3 轨'})).toBeEnabled();
 await expect(page.getByRole('combobox',{name:'当前轨道'}).locator('option')).toHaveCount(1);
});

test('strict harmonic plan is enforced before atomic three-track confirmation',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'+ 添加音符'}).click();
 await page.getByRole('checkbox',{name:'启用可控和声规划'}).check();
 await page.getByRole('combobox',{name:'规划主音'}).selectOption('0');
 await page.getByRole('combobox',{name:'规划调式'}).selectOption('major');
 await page.getByRole('textbox',{name:'逐小节和弦级数'}).fill('1,4,5,1');
 await page.getByRole('button',{name:'规则编配预览（离线）'}).click();
 const review=page.getByRole('region',{name:'和声规划执行报告'});
 await expect(review).toContainText('I – IV – V – I');
 await expect(review).toContainText('硬约束');
 await expect(page.getByRole('button',{name:'确认新增 3 轨'})).toBeEnabled();
 await page.getByRole('button',{name:'确认新增 3 轨'}).click();
 await expect(page.getByRole('combobox',{name:'当前轨道'}).locator('option')).toHaveCount(4);
 await page.getByRole('combobox',{name:'当前轨道'}).selectOption('melody');
 await expect(page.locator('.note')).toHaveCount(1);
});
test('strict harmonic plan rejects an untrusted but structurally valid nonchord model response',async({page})=>{
 await page.route('**/api/arrange',async route=>{
  const tracks=[
   {role:'harmony',notes:[{pitch:61,startTick:0,durationTicks:480,velocity:80}]},
   {role:'bass',notes:[{pitch:36,startTick:0,durationTicks:480,velocity:80}]},
   {role:'accompaniment',notes:[{pitch:55,startTick:0,durationTicks:480,velocity:80}]}
  ];
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({tracks})});
 });
 await page.goto('/');
 await page.getByRole('button',{name:'+ 添加音符'}).click();
 await page.getByRole('checkbox',{name:'启用可控和声规划'}).check();
 await page.getByRole('button',{name:'AI 多轨编配预览'}).click();
 await expect(page.getByRole('alert')).toContainText('plan_scale_violation');
 await expect(page.getByRole('button',{name:'确认新增 3 轨'})).toHaveCount(0);
});

test('beat-level chord timeline generates two seventh chords with inversion in one bar',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'+ 添加音符'}).click();
 await page.getByRole('spinbutton',{name:'编配小节数'}).fill('1');
 await page.getByRole('checkbox',{name:'启用可控和声规划'}).check();
 await page.getByRole('checkbox',{name:'启用小节内和弦时间轴'}).check();
 const timeline=page.getByRole('group',{name:'和弦时间轴'});
 await timeline.getByRole('button',{name:'拆分'}).click();
 await expect(timeline.locator('.chord-event')).toHaveCount(2);
 await page.getByRole('checkbox',{name:'时间轴第1段七和弦'}).check();
 await page.getByRole('combobox',{name:'时间轴第1段转位'}).selectOption('1');
 await page.getByRole('combobox',{name:'时间轴第2段级数'}).selectOption('5');
 await page.getByRole('checkbox',{name:'时间轴第2段七和弦'}).check();
 await page.getByRole('button',{name:'规则编配预览（离线）'}).click();
 const report=page.getByRole('region',{name:'和声规划执行报告'});
 await expect(report).toContainText('Imaj7 · 第1转位');
 await expect(report).toContainText('V7');
 await expect(page.getByRole('button',{name:'确认新增 3 轨'})).toBeEnabled();
 await page.getByRole('button',{name:'确认新增 3 轨'}).click();
 await expect(page.getByRole('combobox',{name:'当前轨道'}).locator('option')).toHaveCount(4);
 await page.getByRole('combobox',{name:'当前轨道'}).selectOption('melody');
 await expect(page.locator('.note')).toHaveCount(1);
});

test('client rejects a bass line that violates a hard inversion at chord onset',async({page})=>{
 await page.route('**/api/arrange',async route=>{
  const tracks=[
   {role:'harmony',notes:[{pitch:64,startTick:0,durationTicks:480,velocity:80}]},
   {role:'bass',notes:[{pitch:36,startTick:0,durationTicks:480,velocity:80}]},
   {role:'accompaniment',notes:[{pitch:55,startTick:0,durationTicks:480,velocity:80}]}
  ];
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({tracks})});
 });
 await page.goto('/');
 await page.getByRole('button',{name:'+ 添加音符'}).click();
 await page.getByRole('spinbutton',{name:'编配小节数'}).fill('1');
 await page.getByRole('checkbox',{name:'启用可控和声规划'}).check();
 await page.getByRole('checkbox',{name:'启用小节内和弦时间轴'}).check();
 await page.getByRole('checkbox',{name:'时间轴第1段七和弦'}).check();
 await page.getByRole('combobox',{name:'时间轴第1段转位'}).selectOption('1');
 await page.getByRole('button',{name:'AI 多轨编配预览'}).click();
 await expect(page.getByRole('alert')).toContainText('plan_inversions_violation:bass');
 await expect(page.getByRole('button',{name:'确认新增 3 轨'})).toHaveCount(0);
});

test('seeded offline batch offers reproducible comparison and combines role-specific candidates atomically',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'+ 添加音符'}).click();
 await page.getByRole('spinbutton',{name:'编配随机种子'}).fill('19501');
 await page.getByRole('combobox',{name:'编配方案数'}).selectOption('3');
 await page.getByRole('button',{name:'按种子生成多方案（离线）'}).click();
 const bank=page.getByRole('region',{name:'编配候选对比'});
 await expect(bank.locator('.variant-cards button')).toHaveCount(3);
 const first=await page.locator('.arrangement-ghost').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('title')));
 await bank.locator('.variant-cards button').nth(1).click();
 const second=await page.locator('.arrangement-ghost').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('title')));
 expect(first).not.toEqual(second);
 await page.getByRole('combobox',{name:'和声选择方案'}).selectOption('0');
 await page.getByRole('combobox',{name:'低音选择方案'}).selectOption('1');
 await page.getByRole('combobox',{name:'伴奏选择方案'}).selectOption('2');
 await page.getByRole('button',{name:'组合所选声部并重新验证'}).click();
 await expect(page.getByRole('button',{name:'确认新增 3 轨'})).toBeEnabled();
 await expect(bank.getByText(/同一主旋律的 3 个编配候选/)).toBeVisible();
 await page.getByRole('button',{name:'确认新增 3 轨'}).click();
 const tracks=page.getByRole('combobox',{name:'当前轨道'});
 await expect(tracks.locator('option')).toHaveCount(4);
 await tracks.selectOption('melody');
 await expect(page.locator('.note')).toHaveCount(1);
 await page.getByRole('button',{name:'撤销'}).click();
 await expect(tracks.locator('option')).toHaveCount(1);
});

test('same seed reproduces exact offline candidate MIDI projection without modifying source',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'+ 添加音符'}).click();
 await page.getByRole('spinbutton',{name:'编配随机种子'}).fill('90210');
 const button=page.getByRole('button',{name:'按种子生成多方案（离线）'});
 await button.click();
 const projection=async()=>page.locator('.arrangement-ghost').evaluateAll(nodes=>nodes.map(n=>({
  title:n.getAttribute('title'),
  style:n.getAttribute('style')
 })));
 const first=await projection();
 await button.click();
 expect(await projection()).toEqual(first);
 await expect(page.getByRole('combobox',{name:'当前轨道'}).locator('option')).toHaveCount(1);
});

test('seed input cannot invoke arrangement generator with invalid value',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'+ 添加音符'}).click();
 await page.getByRole('spinbutton',{name:'编配随机种子'}).fill('-1');
 await page.getByRole('button',{name:'按种子生成多方案（离线）'}).click();
 await expect(page.getByRole('alert')).toContainText('随机种子必须');
 await expect(page.getByRole('region',{name:'编配候选对比'})).toHaveCount(0);
});

test('changing the harmony plan or selected source invalidates an earlier variant bank',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'+ 添加音符'}).click();
 await page.getByRole('button',{name:'按种子生成多方案（离线）'}).click();
 await expect(page.getByRole('region',{name:'编配候选对比'})).toBeVisible();
 await page.getByRole('checkbox',{name:'启用可控和声规划'}).check();
 await expect(page.getByRole('region',{name:'编配候选对比'})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'确认新增 3 轨'})).toHaveCount(0);
 await page.getByRole('button',{name:'按种子生成多方案（离线）'}).click();
 await expect(page.getByRole('region',{name:'编配候选对比'})).toBeVisible();
 await page.getByRole('spinbutton',{name:'编配起始小节'}).fill('2');
 await expect(page.getByRole('region',{name:'编配候选对比'})).toHaveCount(0);
});

test('scoped seeded regeneration previews an existing harmony track and preserves melody and bass',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'+ 添加音符'}).click();
 await page.getByRole('button',{name:'规则编配预览（离线）'}).click();
 await page.getByRole('button',{name:'确认新增 3 轨'}).click();
 const selector=page.getByRole('combobox',{name:'当前轨道'});
 await expect(selector.locator('option')).toHaveCount(4);
 await expect(selector).toHaveValue('arrange-1-melody-0-harmony');
 await page.getByRole('combobox',{name:'局部重编参考轨道'}).selectOption('melody');
 await page.getByRole('combobox',{name:'局部重编目标轨道'}).selectOption('arrange-1-melody-0-harmony');
 await page.getByRole('combobox',{name:'局部重编目标声部'}).selectOption('harmony');
 await page.getByRole('spinbutton',{name:'局部重编起始小节'}).fill('1');
 await page.getByRole('spinbutton',{name:'局部重编小节数'}).fill('1');
 await page.getByRole('spinbutton',{name:'局部重编随机种子'}).fill('19601');
 const noteCountBefore=await page.locator('.note').count();
 await page.getByRole('button',{name:'按种子局部重编（离线）'}).click();
 const review=page.getByRole('region',{name:'局部重编候选'});
 await expect(review).toContainText('2 个旧音符将替换为 2 个新音符');
 await expect(page.locator('.region-ghost')).toHaveCount(2);
 await expect(page.locator('.note.pending-delete')).toHaveCount(2);
 await expect(page.locator('.note')).toHaveCount(noteCountBefore);
 await page.getByRole('button',{name:'确认局部替换'}).click();
 await expect(review).toHaveCount(0);
 await expect(selector.locator('option')).toHaveCount(4);
 await expect(page.locator('.note')).toHaveCount(noteCountBefore);
 await page.getByRole('button',{name:'撤销'}).click();
 await expect(selector.locator('option')).toHaveCount(4);
 await expect(page.locator('.note')).toHaveCount(noteCountBefore);
 await selector.selectOption('melody');
 await expect(page.locator('.note')).toHaveCount(1);
});

test('cancelled scoped regeneration removes all ghost notes without changing the project',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'+ 添加音符'}).click();
 await page.getByRole('button',{name:'规则编配预览（离线）'}).click();
 await page.getByRole('button',{name:'确认新增 3 轨'}).click();
 await page.getByRole('button',{name:'按种子局部重编（离线）'}).click();
 await expect(page.locator('.region-ghost')).toHaveCount(2);
 await page.getByRole('button',{name:'取消局部候选'}).click();
 await expect(page.locator('.region-ghost')).toHaveCount(0);
 await expect(page.locator('.note.pending-delete')).toHaveCount(0);
 await expect(page.getByRole('region',{name:'局部重编候选'})).toHaveCount(0);
});

test('scoped remote proposal outside selected time window is rejected without mutation',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'+ 添加音符'}).click();
 await page.getByRole('button',{name:'规则编配预览（离线）'}).click();
 await page.getByRole('button',{name:'确认新增 3 轨'}).click();
 await page.route('**/api/arrange',async route=>{
  const tracks=['harmony','bass','accompaniment'].map(role=>({
   role,notes:[{pitch:60,startTick:9600,durationTicks:480,velocity:80}]
  }));
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({tracks})});
 });
 await page.getByRole('button',{name:'AI 局部重编'}).click();
 await expect(page.getByRole('alert')).toContainText('arrangement_note_outside_scope');
 await expect(page.getByRole('region',{name:'局部重编候选'})).toHaveCount(0);
 await expect(page.getByRole('combobox',{name:'当前轨道'}).locator('option')).toHaveCount(4);
});
