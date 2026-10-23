import {DurableObject} from 'cloudflare:workers';
import {CONFIG} from './config.mjs';
import {handler,objectClass} from './wiring.mjs';
// Preserve the historical class/namespace without invoking or modifying its ledger.
export class IdentityCheck extends DurableObject {}
const services=Object.freeze({
 now:()=>Date.now(),
 request:(url,init)=>globalThis.fetch(url,init),
 setTimeout:(fn,ms)=>globalThis.setTimeout(fn,ms),
 clearTimeout:handle=>globalThis.clearTimeout(handle)
});
export class IdentityDiagnostic extends objectClass(DurableObject,CONFIG,services) {}
export default handler(CONFIG);
