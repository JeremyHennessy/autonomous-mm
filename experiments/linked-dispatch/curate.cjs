const fs=require('fs'),{solve,solo}=require('./generate.cjs');
const n=(x,y,out,gate=null)=>({x,y,out,gate});
const t1={title:'One pair, two gates',hint:'A links the two gates marked A. Flip A and watch both parcels follow the new arrows.',size:3,pairs:1,bits:0,start:[0,3],goals:[2,5],nodes:[n(0,0,[3,1],0),n(1,0,[2]),n(2,0,[]),n(0,1,[0,4],0),n(1,1,[5]),n(2,1,[])]};
const t2={title:'Every flip is a step',hint:'After A, flip B. There is no wait button: every flip moves both parcels.',size:3,pairs:2,bits:0,start:[0,3],goals:[2,5],nodes:[n(0,0,[3,1],0),n(1,0,[4,2],1),n(2,0,[]),n(0,1,[0,4],0),n(1,1,[1,5],1),n(2,1,[])]};
// Select a short, verified teaching conflict.
// The rejected first flip causes a collision; the valid route needs both pair controls.
let seed=7721;const rnd=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return Math.floor(seed/4294967296*n)};
let t3;
for(let it=0;it<30000;it++){
 const goals=[6+rnd(3),6+rnd(3)],start=[rnd(3),rnd(3)];if(goals[0]===goals[1]||start[0]===start[1])continue;
 const nodes=Array.from({length:9},(_,i)=>{let x=i%3,y=Math.floor(i/3),ne=[];if(x)ne.push(i-1);if(x<2)ne.push(i+1);if(y)ne.push(i-3);if(y<2)ne.push(i+3);return {x,y,out:goals.includes(i)?[]:[ne[rnd(ne.length)]],gate:null,ne}}),avail=nodes.map((_,i)=>i).filter(i=>!goals.includes(i));
 for(let g=0;g<2;g++)for(let k=0;k<2;k++){const i=avail.splice(rnd(avail.length),1)[0],n=nodes[i];n.gate=g;const opts=n.ne.filter(p=>p!==n.out[0]);n.out.push(opts[rnd(opts.length)]);}nodes.forEach(n=>delete n.ne);
 const l={size:3,pairs:2,bits:rnd(4),start,goals,nodes},r=solve(l);if(!r.solution||r.solution.length!==4||new Set(r.solution).size!==2)continue;
 const {step,initial}=require('./engine.js'),bad=step(l,initial(l),1-r.solution[0]);if(bad.status!=='crash')continue;
 if(r.solution.length<=Math.max(solo(l,0),solo(l,1)))continue;
 t3={...l,title:'One choice, two consequences',hint:'Check both next-step previews. One first flip is a crash; the other gives both parcels a safe route.',...r};break;
}
if(!t3)throw Error('No adequate teaching conflict found');
const titles=['Crossed intentions','Small detour','Return route','Shared decisions','Counterflow','Two routes, one clock','Passing space','Last parcel','Linked together'];
const levels=[t1,t2,t3,...require('./generated.json').selected.map((l,i)=>({...l,title:titles[i],hint:i===0?'A delivered parcel leaves the board. Keep the other moving safely.':'Preview a flip, then follow the arrows. Undo is always available.'}))].map((l,i)=>({...l,id:i+1,...solve(l)}));
fs.writeFileSync('levels.json',JSON.stringify(levels,null,2));fs.writeFileSync('levels.js','window.LEVELS='+JSON.stringify(levels.map(({solution,states,winEdges,crashEdges,soloLengths,coupledPairs,generationAttempt,...l})=>l))+';\n');console.log(levels.map(l=>({id:l.id,title:l.title,solution:l.solution,states:l.states})));
