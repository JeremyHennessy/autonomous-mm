// Deliberately inert shell: no live RPC, alarms or inference are wired here.
export default {async fetch(){return new Response('Disabled offline rehearsal',{status:503});}};
