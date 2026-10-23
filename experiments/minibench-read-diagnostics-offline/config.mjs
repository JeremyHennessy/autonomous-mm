// NOT ACTIVATED. No real round, account, evidence hosts, window or cron configured.
export const CONFIG=Object.freeze({enabled:false,semanticVersion:2,start:0,end:0,roundEnd:0,roundOpensAt:0,roundClosesAt:0,roundId:0,roundSlug:'DISABLED',accountId:0,participationVerified:false,primaryBotVerified:false,maxAgeMs:60000,sourceAllowlist:[]});
export const OBJECT_NAME='disabled-semantic-pilot-v2';
// Proposed public-source scope only. This does not enable CONFIG or authorize activation.
// Exact host/path rules are frozen; availability and evidentiary relevance remain unproved.
export const PROPOSED_SOURCE_ALLOWLIST=Object.freeze([
 Object.freeze({host:'www.bls.gov',pathPrefix:'/news.release/'}),
 Object.freeze({host:'www.federalreserve.gov',pathPrefix:'/newsevents/pressreleases/'}),
 Object.freeze({host:'www.bea.gov',pathPrefix:'/news/'}),
 Object.freeze({host:'www.nhc.noaa.gov',pathPrefix:'/archive/'}),
 Object.freeze({host:'www.anthropic.com',pathPrefix:'/news/'}),
]);
