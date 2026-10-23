using Workerd = import "/workerd/workerd.capnp";
const config :Workerd.Config = (services=[
(name="disk",disk=(path="DATA_DIRECTORY",writable=true)),
(name="test",worker=(compatibilityDate="2026-10-23",compatibilityFlags=["nodejs_compat"],globalOutbound="fixture",modules=[
(name="test.mjs",esModule=embed "test.mjs"),(name="admission.mjs",esModule=embed "../admission.mjs"),
(name="history-empty.mjs",esModule=embed "../history-empty.mjs"),
(name="config.mjs",esModule=embed "../config.mjs"),
(name="fixtures.mjs",esModule=embed "../fixtures.mjs"),
(name="ledger.mjs",esModule=embed "../ledger.mjs"),
(name="model.mjs",esModule=embed "../model.mjs"),
(name="runner.mjs",esModule=embed "../runner.mjs"),
(name="transport.mjs",esModule=embed "../transport.mjs"),
(name="wiring.mjs",esModule=embed "../wiring.mjs"),
(name="worker.mjs",esModule=embed "../worker.mjs"),
(name="deps/model-transport.mjs",esModule=embed "../deps/model-transport.mjs"),
(name="deps/strict-json.mjs",esModule=embed "../deps/strict-json.mjs"),
(name="deps/validator.mjs",esModule=embed "../deps/validator.mjs")
],bindings=[(name="PILOT",durableObjectNamespace="TestPilot"),(name="AI",service=(name="test",entrypoint="FakeAI")),(name="METACULUS_TOKEN",text="FICTIONAL-NOT-SECRET")],durableObjectNamespaces=[(className="TestPilot",uniqueKey="fictional-only-semantic-v2-test",enableSql=true)],durableObjectStorage=(localDisk="disk"))),
(name="fixture",worker=(compatibilityDate="2026-10-23",compatibilityFlags=["nodejs_compat"],globalOutbound="deny",modules=[(name="fixture.mjs",esModule=embed "fixture.mjs"),(name="admission.mjs",esModule=embed "../admission.mjs"),
(name="history-empty.mjs",esModule=embed "../history-empty.mjs"),
(name="config.mjs",esModule=embed "../config.mjs"),
(name="fixtures.mjs",esModule=embed "../fixtures.mjs"),
(name="ledger.mjs",esModule=embed "../ledger.mjs"),
(name="model.mjs",esModule=embed "../model.mjs"),
(name="runner.mjs",esModule=embed "../runner.mjs"),
(name="transport.mjs",esModule=embed "../transport.mjs"),
(name="wiring.mjs",esModule=embed "../wiring.mjs"),
(name="worker.mjs",esModule=embed "../worker.mjs"),
(name="deps/model-transport.mjs",esModule=embed "../deps/model-transport.mjs"),
(name="deps/strict-json.mjs",esModule=embed "../deps/strict-json.mjs"),
(name="deps/validator.mjs",esModule=embed "../deps/validator.mjs")])),
(name="deny",worker=(compatibilityDate="2026-10-23",globalOutbound="deny",modules=[(name="deny.mjs",esModule="export default {fetch(){throw Error('No external network');}};")]))
],sockets=[]);
