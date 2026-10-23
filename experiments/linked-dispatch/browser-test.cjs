const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('assert');
const levels=require('./levels.json');const {initial,step}=require('./engine');
(async()=>{
const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',chromiumSandbox:true}),results=[];
for(const mode of [{name:'desktop',viewport:{width:1365,height:1000},isMobile:false,hasTouch:false},{name:'mobile',viewport:{width:390,height:844},isMobile:true,hasTouch:true},{name:'narrow',viewport:{width:320,height:740},isMobile:true,hasTouch:true}]){
 const context=await browser.newContext(mode),page=await context.newPage(),errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});page.on('request',r=>requests.push(r.url()));
 await page.goto('file://'+path.resolve('index.html'));await page.waitForSelector('.action');
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 const press=async loc=>mode.hasTouch?loc.tap():loc.click();let moves=0;
 for(let i=0;i<levels.length;i++){
 await page.selectOption('#level-select',String(i));assert.deepStrictEqual(await page.evaluate(()=>dispatchDebug.state),initial(levels[i]));
 const before=await page.evaluate(()=>dispatchDebug.state);await press(page.locator('[data-action="0"]'));assert.deepStrictEqual(await page.evaluate(()=>dispatchDebug.state),before);
 let s=initial(levels[i]);
 for(let a of levels[i].solution){await press(page.locator(`[data-action="${a}"]`));await press(page.locator('#commit'));s=step(levels[i],s,a);assert.deepStrictEqual(await page.evaluate(()=>dispatchDebug.state),s);moves++;}
 assert.strictEqual(s.status,'won');assert(await page.locator('#commit').isDisabled());
 await press(page.locator('#undo'));assert.strictEqual((await page.evaluate(()=>dispatchDebug.state)).status,'playing');
 await press(page.locator('#reset'));assert.deepStrictEqual(await page.evaluate(()=>dispatchDebug.state),initial(levels[i]));
 if(i===3)await page.screenshot({path:`evidence/${mode.name}-board4.png`,fullPage:true});
 }
 await page.selectOption('#level-select','2');await press(page.locator('[data-action="1"]'));await press(page.locator('#commit'));assert.strictEqual((await page.evaluate(()=>dispatchDebug.state)).status,'crash');await page.screenshot({path:`evidence/${mode.name}-crash.png`,fullPage:true});await press(page.locator('#undo'));assert.deepStrictEqual(await page.evaluate(()=>dispatchDebug.state),initial(levels[2]));
 await page.selectOption('#level-select','0');await page.screenshot({path:`evidence/${mode.name}-tutorial.png`,fullPage:true});
 // Keyboard parity including Enter when a preview card has focus.
 if(!mode.hasTouch){await page.locator('summary').click();await page.locator('#shortcuts').check();await page.locator('[data-action="0"]').focus();await page.keyboard.press('Enter');assert.strictEqual(await page.evaluate(()=>dispatchDebug.moves),1);await page.keyboard.press('z');assert.strictEqual(await page.evaluate(()=>dispatchDebug.moves),0);await page.keyboard.press('a');await page.keyboard.press('Enter');await page.keyboard.press('r');assert.strictEqual(await page.evaluate(()=>dispatchDebug.moves),0);}
 const external=requests.filter(u=>!u.startsWith('file:')&&!u.startsWith('data:'));assert.deepStrictEqual(errors,[]);assert.deepStrictEqual(external,[]);
 results.push({mode:mode.name,viewport:mode.viewport,touchEmulation:mode.hasTouch,boardsSolved:12,solutionActions:moves,undoResetPerBoard:true,previewNonMutating:true,crashUndo:true,horizontalOverflow:false,consoleErrors:errors,externalRequests:external,requests:[...new Set(requests)].map(u=>u.replace('file://'+process.cwd()+'/',''))});await context.close();
}
fs.writeFileSync('evidence/browser-results.json',JSON.stringify({browser:await browser.version(),engine:'Chromium via Playwright, actual headless Linux browser; touch emulation not physical device',results},null,2));await browser.close();console.log(JSON.stringify(results,null,2));
})().catch(e=>{console.error(e);process.exit(1)});
