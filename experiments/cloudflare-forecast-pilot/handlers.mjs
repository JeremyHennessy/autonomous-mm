// No HTTP/RPC/environment flag can activate live adapters in this build.
export default {
  async fetch() {return new Response('Private offline pilot; live operation unavailable.',{status:503,headers:{'cache-control':'no-store'}});},
  async scheduled(_event, _env, _ctx) {return {status:'disabled',reason:'offline-build'};}
};
export async function runWorkersAI(_env, _input) {
  // Future reviewed integration would use env.AI.run(CONFIG.model, input).
  // It must not be added until token accounting, quota and approval gates pass.
  throw new Error('live-inference-unimplemented');
}
export async function metaculusAdapter() {throw new Error('live-metaculus-unimplemented');}
