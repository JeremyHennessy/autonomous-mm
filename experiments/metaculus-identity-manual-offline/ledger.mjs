// Candidate adapter, never initialized against live storage. Fresh identity required.
// transactionSync and sync are Cloudflare SQLite Durable Object storage APIs.
export async function ledger(storage,config){
 const window=JSON.stringify(config);
 storage.transactionSync(()=>{
  storage.sql.exec('CREATE TABLE IF NOT EXISTS diagnostic_identity (id INTEGER PRIMARY KEY CHECK(id=1),window TEXT NOT NULL,state TEXT NOT NULL,diagnostic TEXT)');
  storage.sql.exec("INSERT OR IGNORE INTO diagnostic_identity(id,window,state) VALUES(1,?,'ready')",window);
  if(storage.sql.exec('SELECT window FROM diagnostic_identity WHERE id=1').toArray()[0]?.window!==window)throw Error('config');
 });await storage.sync();
 return {
  async claimOnce(){let claimed=false;storage.transactionSync(()=>{if(storage.sql.exec('SELECT state FROM diagnostic_identity WHERE id=1').toArray()[0]?.state==='ready'){storage.sql.exec("UPDATE diagnostic_identity SET state='reserved' WHERE id=1");claimed=true;}});await storage.sync();return claimed;},
  async persist(value){storage.transactionSync(()=>{const state=storage.sql.exec('SELECT state FROM diagnostic_identity WHERE id=1').toArray()[0]?.state;if(state!=='reserved'&&!(state==='verified'&&value.state==='uncertain'&&value.category==='clock'))throw Error('terminal');storage.sql.exec('UPDATE diagnostic_identity SET state=?,diagnostic=? WHERE id=1',value.state,JSON.stringify(value));});await storage.sync();}
 };
}
// Use lexical global receiver in any FUTURE reviewed runtime wrapper, not bare injection:
// request: (url, init) => globalThis.fetch(url, init)
// No actual wrapper, routes, scheduled handler, config window or bindings here.
