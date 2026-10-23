# Offline launch candidate review

2026-10-23: independent final review accepted the frozen source, offline only.

102/102 dependency-free Node tests passed. Independent official workerd run passed with SQLite DO, fake Metaculus metadata/history/submission, page-shaped HTML source, fake AI and network-denied local fixture service. No active questions, live inference, forecast, credential access or deployment occurred.

Reviewed invariants (independent final polling/diagnostics review accepted): hard 3 acknowledged pairs, 5 total/daily model attempts, 5 question claims, 15 sources, 3 per question, 60 durable work wakes at 30-minute spacing, 2,400 durably reserved dispatch slots; no network after caps; 39 worst-case application dispatches below 40; flush before effects; restart consumes unfinished state; UNKNOWN never retries; exact frozen forecasting_end_date rather than wrap-up close_date ; 64 KiB / 1,024-chunk source ceiling; 1,200-byte bounded inert excerpts, no source credential or URL authority; minimal supported provider grammar plus strict local validator.

This exact semantic schema and its new fields have not been accepted in a new live call. Runtime Free CPU/quota, current provider deployment, useful source availability and factual/model quality remain external limitations. Safe model diagnostics distinguish invocation/promise/watchdog/validation/storage failure, preserving numeric usage without raw errors. A crash after invocation before telemetry persistence remains explicitly uncertain, never retryable.

CONFIG remains disabled. Actual account, round, window, source allowlist, fresh guard and schedule must be frozen and approved before any activation. This review is not permission for live reads, model calls, submissions, or deployment.
