import {DurableObject} from 'cloudflare:workers';
import {handler,objectClass} from './wiring.mjs';
export class FiniteRehearsal extends objectClass(DurableObject) {}
export default handler();
