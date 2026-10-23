/* Original Linked Dispatch rules. No dependencies or network. */
(function(root){
'use strict';
const initial = level => ({p:level.start.slice(), bits:level.bits||0, status:'playing',reason:''});
function step(level,state,action){
 if(state.status!=='playing'||!Number.isInteger(action)||action<0||action>=level.pairs)return structuredClone(state);
 const bits=state.bits^(1<<action);
 const p=state.p.map((at)=>at<0?-1:level.nodes[at].out[level.nodes[at].gate==null?0:((bits>>level.nodes[at].gate)&1)]);
 let reason='';
 if(p.some(at=>at===undefined))reason='End of route';
 else if(p[0]>=0&&p[0]===p[1])reason='Same junction collision';
 else if(state.p.every(at=>at>=0)&&p[0]===state.p[1]&&p[1]===state.p[0])reason='Head-on collision';
 else if(p.some((at,i)=>at>=0&&at===level.goals[1-i]))reason='Wrong depot';
 if(reason)return {p:p.map(v=>v===undefined?-2:v),bits,status:'crash',reason};
 const delivered=p.map((at,i)=>at===level.goals[i]?-1:at);
 return {p:delivered,bits,status:delivered.every(at=>at===-1)?'won':'playing',reason:''};
}
const key=s=>`${s.p.join(',')}/${s.bits}/${s.status}`;
class Game{
 constructor(level){this.level=level;this.reset()}
 reset(){this.state=initial(this.level);this.history=[];}
 move(action){if(this.state.status!=='playing'||action<0||action>=this.level.pairs||!Number.isInteger(action))return;this.history.push(structuredClone(this.state));this.state=step(this.level,this.state,action);}
 undo(){if(this.history.length)this.state=this.history.pop();}
}
const api={initial,step,key,Game};if(typeof module!=='undefined')module.exports=api;else root.Dispatch=api;
})(typeof window==='undefined'?globalThis:window);
