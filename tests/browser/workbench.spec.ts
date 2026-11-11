import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { EXAMPLES } from '../../src/model/examples';
import { makePart } from '../../src/model/library';
test.beforeEach(async({page})=>{await page.goto('/');await expect(page.locator('.brand h1')).toHaveText('MECHANICA');});
test('simulation runs, pauses, steps, and restores the design',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.getByRole('button',{name:'시뮬레이션 실행',exact:true}).click();
  await expect(page.locator('.mode-pill')).toHaveText('LIVE PHYSICS');
  await expect.poll(async()=>Number((await page.locator('.simulation-time').textContent())?.replace('s',''))).toBeGreaterThan(.3);
  await expect(page.locator('.live-readings strong').first()).not.toHaveText('0.0RPM');
  await page.screenshot({path:'test-results/mechanica-running.png'});
  await page.getByRole('button',{name:'시뮬레이션 일시정지',exact:true}).click();
  const paused=await page.locator('.simulation-time').textContent();await page.waitForTimeout(120);expect(await page.locator('.simulation-time').textContent()).toBe(paused);
  await page.getByRole('button',{name:'한 프레임 실행',exact:true}).click();await expect(page.locator('.simulation-time')).not.toHaveText(paused!);
  await page.getByRole('button',{name:'정지 및 설계 복귀',exact:true}).click();await expect(page.locator('.mode-pill')).toHaveText('DESIGN');await expect(page.locator('.simulation-time')).toHaveText('0.00s');
  await page.screenshot({path:'test-results/mechanica-design.png'});expect(errors).toEqual([]);
});
test('places, edits, duplicates, deletes, and undoes a part',async({page})=>{
  await page.locator('.part-card').filter({hasText:'평기어'}).click();
  await page.getByLabel('기계 설계 작업 공간').click({position:{x:360,y:120}});
  await expect(page.locator('.status-bar')).toContainText('5개 부품');
  const mass=page.getByRole('spinbutton',{name:'질량',exact:true});await mass.fill('4.2');await mass.press('Tab');await expect(mass).toHaveValue('4.2');
  await page.getByRole('button',{name:'복제',exact:true}).click();await expect(page.locator('.status-bar')).toContainText('6개 부품');
  await page.getByRole('button',{name:'실행 취소',exact:true}).click();await expect(page.locator('.status-bar')).toContainText('5개 부품');
  await page.getByRole('button',{name:'다시 실행',exact:true}).click();await expect(page.locator('.status-bar')).toContainText('6개 부품');
  await page.getByRole('button',{name:'선택 삭제',exact:true}).click();await expect(page.locator('.status-bar')).toContainText('5개 부품');
});
test('exports JSON, rejects malformed data, and restores IndexedDB after reload',async({page})=>{
  await page.getByRole('button',{name:'프로젝트',exact:true}).click();const downloadEvent=page.waitForEvent('download');await page.getByRole('menuitem',{name:'JSON 내보내기'}).click();const download=await downloadEvent;const path=await download.path();const saved=JSON.parse(await readFile(path!,'utf8'));expect(saved.parts).toHaveLength(4);expect(saved.connections).toHaveLength(3);
  await page.getByLabel('프로젝트 JSON 파일').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{"format":"bad"}')});
  await expect(page.getByRole('status')).toContainText('올바르지');await expect(page.locator('.status-bar')).toContainText('4개 부품');
  saved.name='저장 복원 검증';saved.id='browser-restoration';
  await page.getByLabel('프로젝트 JSON 파일').setInputFiles({name:'valid.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(saved))});
  await expect(page.locator('.project-title')).toContainText('저장 복원 검증');await expect(page.locator('.status-save')).toContainText('자동 저장됨');
  await page.reload();await expect(page.locator('.project-title')).toContainText('저장 복원 검증');await expect(page.locator('.status-bar')).toContainText('4개 부품');
});
test('all ten examples are available; crank piston translates under physics',async({page})=>{
  await page.getByRole('button',{name:/예제 기계 살펴보기/}).click();await expect(page.locator('.example-card')).toHaveCount(10);
  await page.locator('.example-card').filter({hasText:'크랭크–피스톤'}).click();
  await page.locator('.tree-row').filter({hasText:'피스톤'}).click();await page.getByRole('button',{name:'실시간 측정',exact:true}).click();
  await page.getByRole('button',{name:'시뮬레이션 실행',exact:true}).click();
  const position=page.locator('.measurement-list>div').filter({hasText:'위치 X'}).locator('strong');const first=await position.textContent();
  await expect(position).not.toHaveText(first!);await expect(page.locator('.mode-pill')).toHaveText('LIVE PHYSICS');await page.screenshot({path:'test-results/mechanica-piston.png'});
});
test('copies assemblies with their connections and persists user modules',async({page})=>{
  await page.locator('.tree-row').filter({hasText:'평기어 01'}).click();await page.locator('.tree-row').filter({hasText:'평기어 02'}).click({modifiers:['Shift']});
  await expect(page.locator('.selection-summary')).toContainText('2개 부품');
  await page.keyboard.press('Control+c');await page.keyboard.press('Control+v');await expect(page.locator('.status-bar')).toContainText('6개 부품');await expect(page.locator('.status-bar')).toContainText('4개 연결');
  await page.getByRole('button',{name:'모듈 저장',exact:true}).click();await page.getByLabel('모듈 이름').fill('테스트 감속 모듈');await page.getByRole('dialog').getByRole('button',{name:'모듈 저장',exact:true}).click();
  await page.getByRole('button',{name:/내 모듈/}).click();await expect(page.locator('.module-insert')).toContainText('테스트 감속 모듈');await page.locator('.module-insert').click();
  await expect(page.locator('.status-bar')).toContainText('8개 부품');await expect(page.locator('.status-bar')).toContainText('5개 연결');
  await expect(page.locator('.status-save')).toContainText('자동 저장됨');await page.reload();await page.getByRole('button',{name:/내 모듈/}).click();await expect(page.locator('.module-insert')).toContainText('테스트 감속 모듈');
});
test('rejects misaligned gearing instead of animating an impossible mechanism',async({page})=>{
  const x=page.getByRole('spinbutton',{name:'위치 X',exact:true});await x.fill('-1.2');await x.press('Tab');
  await page.getByRole('button',{name:'시뮬레이션 실행',exact:true}).click();await expect(page.getByRole('status')).toContainText('중심거리');await expect(page.locator('.mode-pill')).toHaveText('DESIGN');
});
test('exports real measurements as CSV',async({page})=>{
  await page.getByRole('button',{name:'시뮬레이션 실행',exact:true}).click();await expect.poll(async()=>Number((await page.locator('.simulation-time').textContent())?.replace('s',''))).toBeGreaterThan(.3);
  const event=page.waitForEvent('download');await page.getByRole('button',{name:'측정 CSV 다운로드',exact:true}).click();const file=await event;const content=await readFile((await file.path())!,'utf8');expect(content).toContain('time_s,rpm,torque_Nm');expect(content.trim().split('\n').length).toBeGreaterThan(2);
  await expect(page.locator('.scope-chart polyline')).toHaveAttribute('points',/.+,/);
});
test('fits a Chromebook viewport without horizontal document overflow',async({page})=>{
  await page.setViewportSize({width:1366,height:768});await expect(page.locator('.library-panel')).toBeVisible();await expect(page.locator('.inspector-panel')).toBeVisible();await expect(page.locator('.analysis-panel')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await page.screenshot({path:'test-results/mechanica-chromebook.png'});
  await page.setViewportSize({width:1024,height:768});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
test('builds a new working geared machine from independent library parts',async({page})=>{
  await page.getByRole('button',{name:'프로젝트',exact:true}).click();await page.getByRole('menuitem',{name:'새 프로젝트',exact:true}).click();
  await expect(page.locator('.status-bar')).toContainText('0개 부품');
  const canvas=page.getByLabel('기계 설계 작업 공간'),box=(await canvas.boundingBox())!;
  for(const x of [0,1.2]){
    await page.locator('.part-card').filter({hasText:'평기어'}).click();await canvas.click({position:{x:box.width/2+50,y:box.height/2}});
    const fx=page.getByRole('spinbutton',{name:'위치 X',exact:true}),fy=page.getByRole('spinbutton',{name:'위치 Y',exact:true});await fx.fill(String(x));await fx.press('Tab');await fy.fill('0');await fy.press('Tab');
  }
  await page.locator('.tree-row').first().click();await page.getByRole('checkbox',{name:'모터 구동 활성화',exact:true}).check();
  await page.getByRole('button',{name:'연결 도구',exact:true}).click();
  await canvas.click({position:{x:box.width/2,y:box.height/2}});await canvas.click({position:{x:box.width/2+1.2*85,y:box.height/2}});
  await expect(page.locator('.status-bar')).toContainText('1개 연결');
  await page.getByRole('button',{name:'선택 도구',exact:true}).click();await page.locator('.tree-row').last().click();
  await page.getByRole('button',{name:'시뮬레이션 실행',exact:true}).click();
  await expect.poll(async()=>parseFloat((await page.locator('.live-readings strong').first().textContent())??'0')).toBeLessThan(-5);
});
test('repairs a gear distance error with the visible one-click assistant',async({page})=>{
 const x=page.getByRole('spinbutton',{name:'위치 X',exact:true});await x.fill('-1.2');await x.press('Tab');
 await page.getByRole('button',{name:'시뮬레이션 실행',exact:true}).click();await expect(page.locator('.gear-assist')).toContainText('위치 조정 필요');await expect(page.locator('.gear-assist')).toContainText('300 mm');
 await page.getByRole('button',{name:'위치 맞추고 연결',exact:true}).click();await expect(page.locator('.gear-assist')).toContainText('맞물림 연결됨');
 await page.getByRole('button',{name:'시뮬레이션 실행',exact:true}).click();await expect(page.locator('.mode-pill')).toHaveText('LIVE PHYSICS');
});
test('resizes a frame using a canvas handle and undoes the change',async({page})=>{
 const p=EXAMPLES[0].build();p.parts=[makePart('frame',0,0,{width:3,height:.25})];p.connections=[];
 await page.getByLabel('프로젝트 JSON 파일').setInputFiles({name:'frame.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(p))});
 const width=page.getByRole('spinbutton',{name:'너비',exact:true});await expect(width).toHaveValue('3');
 const canvas=page.getByLabel('기계 설계 작업 공간'),box=(await canvas.boundingBox())!;
 const x=box.x+box.width/2+1.5*115,y=box.y+box.height/2-.025*115;
 await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+115,y,{steps:12});await page.mouse.up();await expect(width).toHaveValue('4');
 await page.keyboard.press('Control+z');await page.locator('.tree-row').first().click();await expect(width).toHaveValue('3');
 await page.screenshot({path:'test-results/resizing-handles.png'});
});
test('dragging nearby gears snaps to pitch distance instead of the grid',async({page})=>{
 const p=EXAMPLES[0].build();p.parts=[makePart('gear',0,0),makePart('gear',1.5,0)];p.connections=[];
 await page.getByLabel('프로젝트 JSON 파일').setInputFiles({name:'snap.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(p))});await expect(page.locator('.tree-row')).toHaveCount(2);
 const box=(await page.getByLabel('기계 설계 작업 공간').boundingBox())!,x=box.x+box.width/2+.75*115,y=box.y+box.height/2-.025*115;
 await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x-25,y,{steps:10});await page.mouse.up();
 await expect(page.getByRole('spinbutton',{name:'위치 X',exact:true})).toHaveValue('1.2');await expect(page.locator('.gear-assist')).toContainText('위치 정상');
});
