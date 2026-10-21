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
