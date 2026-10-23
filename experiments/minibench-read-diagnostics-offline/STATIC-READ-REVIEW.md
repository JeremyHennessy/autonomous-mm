# Static API read-contract review

Observed October 23, 2026. These are mutable official-source references, not pinned production revisions or a diagnosis of a historical runtime failure.

## Countless pagination compatibility

The official posts view uses CountlessLimitOffsetPagination. Its get_count() returns infinity; inherited get_next_link() ends traversal only when offset plus limit reaches count. A next link can therefore remain non-null for a short or empty page. Requiring next:null for successful termination is incompatible with this source contract; synthetic fixtures that always return next:null do not exercise it.

- https://github.com/Metaculus/metaculus/blob/main/posts/views.py#L69-L117
- https://github.com/Metaculus/metaculus/blob/main/utils/paginator.py#L5-L24
- https://github.com/encode/django-rest-framework/blob/master/rest_framework/pagination.py#L386-L393

The disabled repair requests 20 records per page, validates any next link against an independently constructed URL, terminates on short or empty pages, and fails after five full pages. It never follows arbitrary next URLs. This bounded traversal is a mutable observation, not an atomic whole-round snapshot.

## Identity fields

The official users/me route returns UserPrivateSerializer, inheriting id, is_bot, is_active and is_spam. Missing or unknown values still fail closed. Source definitions do not prove what a current gateway will return.

- https://github.com/Metaculus/metaculus/blob/main/users/urls.py#L3-L6
- https://github.com/Metaculus/metaculus/blob/main/users/views.py#L65-L74
- https://github.com/Metaculus/metaculus/blob/main/users/serializers.py#L31-L104

## Response bounds

The transport ceiling remains 131,072 bytes; metadata projection has a separate 65,536-byte ceiling. Official source does not guarantee that every valid page fits those bounds. Rejecting overflow is safe but may prevent useful discovery. The fixed 20-record page policy reduces response size without increasing the five-page cap or byte limits. No actual response size or historical failure cause is inferred from this static review.
