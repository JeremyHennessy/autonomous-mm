using Workerd = import "/workerd/workerd.capnp";
const config :Workerd.Config = (
 services = [
  (name="test",worker=(compatibilityDate="2026-10-23",globalOutbound="fixture",modules=[
   (name="test.mjs",esModule=embed "test.mjs"),
   (name="runner.mjs",esModule=embed "../runner.mjs")
  ])),
  (name="fixture",worker=(compatibilityDate="2026-10-23",globalOutbound="internet",modules=[(name="fixture.mjs",esModule=embed "fixture.mjs")])),
  (name="internet",worker=(compatibilityDate="2026-10-23",globalOutbound="internet",modules=[(name="deny.mjs",esModule="export default {fetch(){throw Error('Network disabled');}};")]))
 ],
 sockets=[]
);
