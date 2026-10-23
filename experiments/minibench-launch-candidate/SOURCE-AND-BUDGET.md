# Frozen source proposal and conservative budget basis

Read-only official documentation reviewed 2026-10-23; no contest questions inspected.

Proposed exact public source rules, frozen before admission:

- www.bls.gov with /news.release/ prefix. Authority: https://www.bls.gov/bls/newsrels.htm . Research retrieval of the directory returned 503; no claim that Worker retrieval will succeed. A failure abstains/stops according to the reviewed transport policy, never retries through another host.
- www.federalreserve.gov with /newsevents/pressreleases/ prefix. Authority: https://www.federalreserve.gov/newsevents/pressreleases.htm and its official press release directory.
- www.bea.gov with /news/ prefix. Authority: https://www.bea.gov/news and https://www.bea.gov/news/current-releases .

These are a deliberately narrow starting set, not evidence that this round contains suitable questions. No source may be synthesized by the model. Only exact allowed URLs already present in question rules can be fetched. No Metaculus question/community pages, search engine results, alternate subdomains, redirects, query strings, credentials or recursive links. DNS remains Cloudflare's managed resolver; hostname allowlisting does not independently pin resolved IPs. Official authoritative hosts mitigate but do not prove absence of DNS compromise. If strict network-level IP pinning is demanded, this implementation does not provide it.

The fixed model's official page documents a 24,000-token context window:
https://developers.cloudflare.com/workers-ai/models/llama-3.3-70b-instruct-fp8-fast/

Official pricing lists 26,668 neurons per million input tokens and 204,805 per million output tokens:
https://developers.cloudflare.com/workers-ai/platform/pricing/

Conservative reservation: 24,000*26,668/1,000,000  + 512*204,805/1,000,000  = 744.89216 neurons; round up to 745. Five calls reserve 3,725 neurons. This is a bound based on the documented supported context and output maximum, NOT actual token measurement, proof of remaining daily shared quota, or invoice evidence. Serialized-request 8,000 UTF-8-byte cap is an independent size constraint, never an 8,000-token claim. Provider-managed chat template/context enforcement remains an external platform assumption. No plan change, paid fallback or extra credentials are proposed. Free daily allowance is shared with other activity; quota errors halt and consume the reservation.

Additional topic diversity reviewed before protocol freeze:
- www.nhc.noaa.gov /archive/: official NHC archive documentation at https://www.nhc.noaa.gov/data/ describes tropical-cyclone advisory archives; indexed official example https://www.nhc.noaa.gov/archive/2025/ . Research retrieval returned 403, so this is authority/path evidence, not proof of runtime availability. The Worker must reject 403, never bypass or follow redirects.
- www.anthropic.com /news/: official newsroom https://www.anthropic.com/news links direct canonical articles such as https://www.anthropic.com/news/an-update-on-independent-evaluators . Useful only for the company's own claims/announcements, not independent verification of performance.

The research tool's OpenAI/index directory request reported a redirect to /news. It is not included in this initial proposal. No runtime redirect following or recursive retrieval is allowed. These five host rules broaden possible topics but do not establish adequate evidence for any contest question, and primary-source text alone does not establish a valid probability.
