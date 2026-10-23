import {DurableObject} from 'cloudflare:workers';
export class IdentityCheck extends DurableObject {}
export class IdentityDiagnostic extends DurableObject {}
export default Object.freeze({fetch(){return new Response('Disabled',{status:503,headers:{'cache-control':'no-store'}});}});
