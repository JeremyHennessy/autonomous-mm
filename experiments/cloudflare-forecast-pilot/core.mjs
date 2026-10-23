import {createHash} from 'node:crypto'; // Offline harness only; runtime integration remains gated.
// PRIVATE OFFLINE HARNESS. No networking, credentials, or production adapters.
export const CONFIG = Object.freeze({version:3, mode:'mock-only', model:'@cf/meta/llama-3.3-70b-instruct-fp8-fast', start:1792627200000, duration:14*86400000, roundId:'SYNTHETIC-ROUND-NOT-REAL-001', roundEnd:1793232000000, questions:20, dailyQuestions:5, dailyAttempts:5, attempts:24, sourcesPerQuestion:3, sources:60, inputTokens:8000, outputTokens:2000});
export const CONFIG_JSON = JSON.stringify(CONFIG);
export const CONFIG_HASH = 'e91aaab1da800913e441eacff4e01bf845f2df8899d187749a0d0142eec3bd96';
const day = t => new Date(t).toISOString().slice(0,10);
const fail = code => { throw new Error(code); };
const safeId = id => typeof id==='string' && /^SYNTHETIC-NOT-REAL-[A-Za-z0-9-]{1,64}$/.test(id);
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function envelope(question, kind, probability, forecastDigest=null) {
  const payload=kind==='forecast'?{probability}:{text:`SYNTHETIC MOCK ONLY: probability ${probability}`,forecastDigest};
  const content={origin:'mock',configHash:CONFIG_HASH,roundId:CONFIG.roundId,question,effect:kind,payload};
  return {...content,contentDigest:digest(content)};
}
const same = (a,b) => JSON.stringify(a)===JSON.stringify(b);
const fresh = () => ({version:3, hash:CONFIG_HASH, last:CONFIG.start, stopped:false, reason:null, flight:null, questions:[], attempts:[], sources:[], effects:[]});
function validate(s) {
  if (!s || s.version!==3 || s.hash!==CONFIG_HASH || !Number.isSafeInteger(s.last) || s.last<CONFIG.start || typeof s.stopped!=='boolean' || !['questions','attempts','sources','effects'].every(k=>Array.isArray(s[k]))) fail('state');
  if(s.questions.length>20 || s.attempts.length>24 || s.sources.length>60 || new Set(s.questions.map(q=>q.id)).size!==s.questions.length) fail('state');
  const dailyQ={}, dailyA={};
  for(const q of s.questions) { if(q.roundId!==CONFIG.roundId||!safeId(q.id)||q.type!=='binary'||!['ready','valid','abstained'].includes(q.status)||!/^\d{4}-\d{2}-\d{2}$/.test(q.day)) fail('state'); if((dailyQ[q.day]=(dailyQ[q.day]||0)+1)>5) fail('state'); }
  const ids=new Set(s.questions.map(q=>q.id));
  const validDay=d=> /^\d{4}-\d{2}-\d{2}$/.test(d) && Number.isFinite(Date.parse(d+'T00:00:00Z')) && Date.parse(d+'T00:00:00Z')>=CONFIG.start && Date.parse(d+'T00:00:00Z')<CONFIG.start+CONFIG.duration;
  if(s.questions.some(q=>!validDay(q.day)) || new Set(s.attempts.map(a=>a.question)).size!==s.attempts.length) fail('state');
  for(const table of ['attempts','sources','effects']) for(const row of s[table]) {
    if(row.origin!=='mock'||!validDay(row.day)) fail('state');
    if(['valid','confirmed'].includes(row.status) && (row.receipt?.origin!=='mock'||row.receipt?.ack!=='confirmed')) fail('state');
  }
  for(const q of s.questions) if(q.status==='valid' && (!Number.isFinite(q.probability)||q.probability<=0||q.probability>=1||!s.attempts.some(a=>a.question===q.id&&a.status==='valid'&&a.receipt?.probability===q.probability))) fail('state');
  for(const a of s.attempts) {if(a.inputBudget!==8000||a.outputBudget!==2000||!ids.has(a.question)||!['reserved','valid','uncertain'].includes(a.status)||!/^\d{4}-\d{2}-\d{2}$/.test(a.day)) fail('state'); if((dailyA[a.day]=(dailyA[a.day]||0)+1)>5) fail('state');}
  for(const id of ids) if(s.sources.filter(x=>x.question===id).length>3) fail('state');
  for(const a of s.attempts) if(a.status==='valid' && (!Number.isFinite(a.receipt.probability)||a.receipt.probability<=0||a.receipt.probability>=1||!Number.isInteger(a.receipt.inputTokens)||a.receipt.inputTokens<0||a.receipt.inputTokens>8000||!Number.isInteger(a.receipt.outputTokens)||a.receipt.outputTokens<0||a.receipt.outputTokens>2000)) fail('state');
  if(s.sources.some(x=>!ids.has(x.question)||!['reserved','confirmed','uncertain'].includes(x.status))) fail('state');
  if(s.effects.some(x=>!ids.has(x.question)||!['forecast','comment'].includes(x.kind)||!['held','reserved','confirmed','uncertain'].includes(x.status)) || new Set(s.effects.map(x=>x.question+':'+x.kind)).size!==s.effects.length) fail('state');
  const forecasts=s.effects.filter(e=>e.kind==='forecast');
  if(s.effects.length!==forecasts.length*2) fail('state');
  for(let i=0;i<forecasts.length;i++) {
    const f=forecasts[i], c=s.effects.find(e=>e.question===f.question&&e.kind==='comment');
    const q=s.questions.find(q=>q.id===f.question&&q.status==='valid');
    if(!q||!c||f.status==='held'||c.finalComment!==(i===19)) fail('state');
    const fe=envelope(q.id,'forecast',q.probability), ce=envelope(q.id,'comment',q.probability,fe.contentDigest);
    if(!same(f.envelope,fe)||!same(c.envelope,ce)) fail('state');
    if(c.status!=='held'&&f.status!=='confirmed') fail('state');
    if(i<forecasts.length-1&&(f.status!=='confirmed'||c.status!=='confirmed')) fail('state');
    for(const e of [f,c]) if(e.status==='confirmed'&&!same(e.receipt?.envelope,e.envelope)) fail('state');
  }
  if(s.flight!==null && (!['attempts','sources','effects'].includes(s.flight.table)||!Number.isInteger(s.flight.index)||s[s.flight.table][s.flight.index]?.status!=='reserved')) fail('state');
  if(['attempts','sources','effects'].some(k=>s[k].some((x,i)=>x.status==='reserved' && !(s.flight?.table===k && s.flight.index===i)))) fail('state');
}
export class Pilot {
  constructor(store, now=Date.now) {
    this.store=store; this.now=now; this.poisoned=false;
    this.change(s=>{ if(s.flight) {s[s.flight.table][s.flight.index].status='uncertain'; s.flight=null; s.stopped=true; s.reason='interrupted';} });
  }
  change(fn) {
    if(this.poisoned) fail('storage');
    try { return this.store.atomic(raw=> {const s=raw===null?fresh():JSON.parse(raw); validate(s); const result=fn(s); validate(s); return {raw:JSON.stringify(s), result};}); }
    catch(e) { this.poisoned=true; throw e; }
  }
  // Denials are returned, not thrown inside the transaction, so stop flags persist.
  act(fn, finalCommentQuestion=null) {
    const result=this.change(s=>{
      const now=this.now();
      if(!Number.isSafeInteger(now)||now<s.last||now<CONFIG.start) {s.stopped=true;s.reason='time';return {error:'time'};}
      s.last=now;
      if(now>=Math.min(CONFIG.start+CONFIG.duration,CONFIG.roundEnd)) {s.stopped=true;s.reason='deadline';}
      if(!s.stopped&&s.effects.filter(e=>e.kind==='forecast'&&e.status==='confirmed').length>=20) {s.stopped=true;s.reason='accepted-limit';}
      const closingComment=s.reason==='accepted-limit'&&s.effects.some(e=>e.question===finalCommentQuestion&&e.finalComment===true&&e.status==='held');
      if(s.stopped&&!closingComment) return {error:s.reason||'stopped'};
      if(s.flight) return {error:'busy'};
      return fn(s, day(now));
    });
    if(result?.error) fail(result.error); return result;
  }
  stop() {this.change(s=>{s.stopped=true;s.reason='stop';});}
  snapshot() {if(this.poisoned) fail('storage');try {const s=JSON.parse(this.store.read());validate(s);return s;} catch(e) {this.poisoned=true;throw e;}}
  admit(question) {
    return this.act((s,d)=>{
      if(question.roundId!==CONFIG.roundId||question.roundEnd!==CONFIG.roundEnd) return {error:'round-mismatch'};
      if(!safeId(question.id)||question.type!=='binary') return {error:'synthetic-binary-only'};
      if(s.questions.some(q=>q.id===question.id)) return {error:'duplicate'};
      if(s.questions.length>=20||s.questions.filter(q=>q.day===d).length>=5) return {error:'question-budget'};
      s.questions.push({id:question.id,type:'binary',roundId:CONFIG.roundId,day:d,status:'ready'}); return question.id;
    });
  }
  reserve(table, question, kind) {
    return this.act((s,d)=>{
      if(!['attempts','sources','effects'].includes(table)) return {error:'table'};
      const q=s.questions.find(q=>q.id===question); if(!q) return {error:'question'};
      if(table==='attempts' && (q.status!=='ready'||s.attempts.some(a=>a.question===question))) return {error:'no-rerun'};
      if(table==='attempts' && (s.attempts.length>=24||s.attempts.filter(a=>a.day===d).length>=5)) return {error:'attempt-budget'};
      if(table==='sources' && (q.status!=='ready'||s.sources.length>=60||s.sources.filter(x=>x.question===question).length>=3)) return {error:'source-budget'};
      if(table==='effects') {
        if(q.status!=='valid'||!['forecast','comment'].includes(kind)) return {error:'effect-blocked'};
        if(kind==='comment') {
          const held=s.effects.findIndex(e=>e.question===question&&e.kind==='comment'&&e.status==='held');
          if(held<0) return {error:s.effects.some(e=>e.question===question&&e.kind==='comment')?'effect-blocked':'forecast-unconfirmed'};
          if(!s.effects.some(e=>e.question===question&&e.kind==='forecast'&&e.status==='confirmed')) return {error:'forecast-unconfirmed'};
          s.effects[held].status='reserved';s.flight={table,index:held};
          return {table,index:held,envelope:structuredClone(s.effects[held].envelope)};
        }
        if(s.effects.some(e=>e.question===question&&e.kind===kind)) return {error:'effect-blocked'};
        if(s.effects.some(e=>e.status!=='confirmed')) return {error:'pair-incomplete'};
        const fe=envelope(question,'forecast',q.probability);
        const ce=envelope(question,'comment',q.probability,fe.contentDigest);
        const index=s.effects.length;
        s.effects.push({question,day:d,kind:'forecast',status:'reserved',origin:'mock',envelope:fe},
          {question,day:d,kind:'comment',status:'held',origin:'mock',finalComment:index===38,envelope:ce});
        s.flight={table,index};return {table,index,envelope:structuredClone(fe)};
      }
      const index=s[table].length; s[table].push({question,day:d,status:'reserved',...(kind?{kind}:{}),...(table==='attempts'?{inputBudget:8000,outputBudget:2000}:{}),origin:'mock'}); s.flight={table,index}; return {table,index};
    }, table==='effects'&&kind==='comment'?question:null);
  }
  finish(ticket, receipt) {
    return this.change(s=>{
      if(!s.flight||s.flight.table!==ticket.table||s.flight.index!==ticket.index) fail('ticket');
      const row=s[ticket.table][ticket.index];
      const now=this.now(); const timely=Number.isSafeInteger(now)&&now>=s.last&&now<Math.min(CONFIG.start+CONFIG.duration,CONFIG.roundEnd);
      if(timely) s.last=now;
      const closingComment=s.reason==='accepted-limit'&&ticket.table==='effects'&&row.kind==='comment'&&row.finalComment===true;
      let valid=timely&&(!s.stopped||closingComment)&&receipt?.origin==='mock'&&receipt?.ack==='confirmed';
      if(ticket.table==='effects') valid=valid&&same(ticket.envelope,row.envelope)&&same(receipt.envelope,row.envelope);
      if(ticket.table==='attempts') valid=valid&&Number.isFinite(receipt.probability)&&receipt.probability>0&&receipt.probability<1&&Number.isInteger(receipt.inputTokens)&&receipt.inputTokens>=0&&receipt.inputTokens<=8000&&Number.isInteger(receipt.outputTokens)&&receipt.outputTokens>=0&&receipt.outputTokens<=2000;
      row.status=valid?(ticket.table==='attempts'?'valid':'confirmed'):'uncertain';
      if(valid) row.receipt={origin:'mock',ack:'confirmed',...(ticket.table==='attempts'?{probability:receipt.probability,inputTokens:receipt.inputTokens,outputTokens:receipt.outputTokens}:ticket.table==='effects'?{envelope:structuredClone(row.envelope)}:{})};
      if(ticket.table==='attempts') {const q=s.questions.find(q=>q.id===row.question);q.status=valid?'valid':'abstained'; if(valid) q.probability=receipt.probability;}
      s.flight=null;
      if(!valid){s.stopped=true;s.reason='uncertain-or-invalid-receipt';}
      else if(s.effects.filter(e=>e.kind==='forecast'&&e.status==='confirmed').length>=20) {s.stopped=true;s.reason='accepted-limit';}
      return valid;
    });
  }
  async inferMock(question, prompt, adapter, tokenProof) {
    // Only a synthetic test proof is accepted. It is NOT a production tokenizer.
    if(tokenProof?.origin!=='mock'||tokenProof.prompt!==prompt||!Number.isInteger(tokenProof.tokens)||tokenProof.tokens<0||tokenProof.tokens>8000) fail('abstain-unverified-token-count');
    const ticket=this.reserve('attempts',question);
    let receipt;
    try {receipt=await adapter(CONFIG.model,{messages:[{role:'user',content:prompt}],max_tokens:2000});}
    catch {receipt={origin:'mock',ack:'uncertain'};}
    return this.finish(ticket,receipt);
  }
  async effectMock(question,kind,adapter) {
    const ticket=this.reserve('effects',question,kind); let receipt;
    try {receipt=await adapter(structuredClone(ticket.envelope));} catch {receipt={origin:'mock',ack:'uncertain'};}
    return this.finish(ticket,receipt);
  }
}
// A single pilot is the coordination atom: its entire budget must be atomic.
export class SQLiteStore {
  constructor(storage) {this.storage=storage; storage.sql.exec('CREATE TABLE IF NOT EXISTS pilot (id INTEGER PRIMARY KEY CHECK (id=1), body TEXT NOT NULL)');}
  read() {const rows=this.storage.sql.exec('SELECT body FROM pilot WHERE id=1').toArray();if(rows.length!==1) fail('state');return rows[0].body;}
  atomic(fn) {
    return this.storage.transactionSync(()=>{
      const rows=this.storage.sql.exec('SELECT body FROM pilot WHERE id=1').toArray();
      const {raw,result}=fn(rows.length?rows[0].body:null);
      this.storage.sql.exec('INSERT INTO pilot (id,body) VALUES (1,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body',raw);
      return result;
    });
  }
}
