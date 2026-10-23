import { DurableObject } from 'cloudflare:workers';
import { Pilot, SQLiteStore } from './core.mjs';
export { default } from './handlers.mjs';
export class ForecastPilot extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.pilot = new Pilot(new SQLiteStore(ctx.storage));
    });
  }
  // No admissions, mock injections, inference or submission RPCs are exposed.
  async tick() { return {status:'disabled',reason:'offline-build'}; }
  async stop() { this.pilot.stop(); return {status:'stopped'}; }
}
