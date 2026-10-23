#!/bin/sh
# Local only. Requires already-reviewed official workerd executable as argument.
set -eu
cd "$(dirname "$0")"
BIN=${1:?Pass the installed official workerd executable path}
DATA=$(mktemp -d /tmp/semantic-v2-pilot-synthetic.XXXXXX)
sed "s|DATA_DIRECTORY|$DATA|" config.capnp > run.capnp
"$BIN" test --experimental run.capnp
