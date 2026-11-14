const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {pathToFileURL}=require('node:url');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const out=path.resolve('qa-v2');fs.mkdirSync(out,{recursive:true});
 const snap=name=>page.screenshot({path:path.join(out,name+'.png')});
 const run=async(id,t=3.5)=>{await page.evaluate(({id,t})=>{const s=systemStudio;s.pause();s.engine.select(id);s.engine.tick(t);s.refresh();},{id,t});};
 try{
  await page.goto(process.env.NOVASIGHT_URL||'http://127.0.0.1:8765/NovaSight%20System%20Studio/dist/index.html');await page.waitForFunction(()=>window.systemStudio?.scene);await run('crate');
  assert.equal(await page.locator('#decisionCode').innerText(),'A');await snap('desktop');
  await page.locator('[data-tab=sensors]').click();await page.waitForFunction(()=>document.querySelectorAll('#tofGrid button').length===64);assert.equal(await page.locator('#tofGrid button').count(),64);await page.locator('#tofGrid button').nth(35).click();assert.ok((await page.locator('#cellDetail').innerText()).includes('Ô 35'));await page.waitForTimeout(1500);await snap('sensors');
  await page.locator('#recordTime').fill('1');await page.locator('#recordTime').dispatchEvent('input');assert.equal(await page.evaluate(()=>systemStudio.engine.view().time),1);
  const eventCount=await page.evaluate(()=>systemStudio.engine.events.length);await page.locator('#stepNext').click();assert.equal(await page.evaluate(()=>systemStudio.engine.view().time),1.05);assert.equal(await page.evaluate(()=>systemStudio.engine.events.length),eventCount);await page.locator('#returnLive').click();
  await page.locator('#openWorkbench').click();await page.locator('#eventList button').filter({hasText:'DECISION'}).first().click();assert.ok(await page.locator('#eventParents button').count());await page.locator('#eventParents button').first().click();assert.ok((await page.locator('#eventDetail').innerText()).includes('"type"'));await snap('trace');
  await page.locator('[data-work=builder]').click();await page.locator('#addKind').selectOption('upper');await page.locator('#addObject').click();assert.equal(await page.locator('#objectSelect option').count(),2);
  await page.locator('#object-x').fill('1.4');await page.locator('#object-x').dispatchEvent('change');
  const box=await page.locator('#editorCanvas').boundingBox();await page.mouse.move(box.x+box.width*.50,box.y+box.height*.745);await page.mouse.down();await page.mouse.move(box.x+box.width*.59,box.y+box.height*.65,{steps:5});await page.mouse.up();assert.notEqual(await page.locator('#object-x').inputValue(),'1.4');await snap('builder');
  await page.locator('#applyWorld').click();await page.evaluate(()=>{systemStudio.pause();systemStudio.engine.tick(1);systemStudio.refresh();});assert.equal(await page.evaluate(()=>systemStudio.engine.world.length),2);assert.equal(await page.evaluate(()=>systemStudio.engine.scenario),'custom');
  await page.locator('#openWorkbench').click();await page.locator('[data-work=report]').click();await page.locator('#runSuite').click();await page.waitForFunction(()=>!document.querySelector('#runSuite').disabled);assert.equal(await page.locator('.suite-row').count(),11);assert.equal(await page.locator('.suite-row.fail').count(),0);await snap('report');
  const reportDownload=page.waitForEvent('download');await page.locator('#exportReport').click();await (await reportDownload).saveAs(path.join(out,'report.csv'));assert.ok(fs.readFileSync(path.join(out,'report.csv'),'utf8').includes('cane'));
  await page.locator('[data-work=replay]').click();const exampleDownload=page.waitForEvent('download');await page.locator('#exampleLog').click();await(await exampleDownload).saveAs(path.join(out,'sample.json'));
  await page.locator('#importLog').setInputFiles(path.join(out,'sample.json'));await page.waitForFunction(()=>systemStudio.engine.imported);assert.equal(await page.evaluate(()=>systemStudio.engine.origin),'simulation-recording');assert.ok((await page.locator('#importStatus').innerText()).includes('Đã nhập'));await snap('replay');
  await page.locator('#closeLab').click();await page.locator('#recordTime').fill('5');await page.locator('#recordTime').dispatchEvent('input');assert.equal(await page.evaluate(()=>systemStudio.engine.view().time),5);assert.equal(await page.locator('#decisionCode').innerText(),'A');
  await page.locator('#returnLive').click();assert.equal(await page.evaluate(()=>systemStudio.engine.imported),false);
  await page.locator('#sensorsPanel details summary').click();await page.locator('#resolution').selectOption('4');await page.evaluate(()=>{systemStudio.pause();systemStudio.engine.tick(.3);systemStudio.refresh();});assert.equal(await page.locator('#tofGrid button').count(),16);
  await page.locator('#resolution').selectOption('8');await page.evaluate(()=>{systemStudio.pause();systemStudio.engine.tick(3.5);systemStudio.refresh();});
  await page.locator('#runFaultScript').click();await page.evaluate(()=>{systemStudio.pause();systemStudio.engine.tick(4);systemStudio.refresh();});assert.equal(await page.locator('#modeLabel').innerText(),'TUNNEL');
  await page.evaluate(()=>{systemStudio.engine.tick(1.5);systemStudio.refresh();});assert.equal(await page.locator('#modeLabel').innerText(),'CANESYNC');
  for(const [id,code]of [['head','B'],['late','C'],['sun','D'],['water','D']]){await run(id);assert.equal(await page.locator('#decisionCode').innerText(),code,id);}
  await run('crate');await page.locator('#chapters button').nth(5).click();await page.waitForTimeout(1300);await snap('hardware');await page.locator('#chapters button').first().click();
  await page.setViewportSize({width:1024,height:768});await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.ok(await page.locator('#play').isVisible());
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(500);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:path.join(out,'mobile.png'),fullPage:true});
  await page.locator('#openWorkbench').click();await page.locator('[data-work=builder]').click();await snap('mobile-builder');assert.equal(await page.evaluate(()=>document.querySelector('#labDialog').scrollWidth<=document.querySelector('#labDialog').clientWidth+1),true);await page.locator('#closeLab').click();
  await page.route('https://**/*',r=>r.abort());await page.goto(pathToFileURL(path.resolve('dist/NovaSight-System-Studio.html')).href);await page.waitForFunction(()=>window.systemStudio?.scene);await page.evaluate(()=>systemStudio.pause());assert.equal(await page.locator('#scene canvas').count(),1);
  assert.deepEqual(errors,[]);console.log(JSON.stringify({sensorGrid:true,timeline:true,causalTrace:true,builder:true,replay:true,faultSuite:11,report:true,responsive:true,offline:true,errors,screenshots:out}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
