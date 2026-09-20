# Source synchronization

Reviewed on 2026-09-20 against getmcpads source revision `41cc1ca`.

- Bound automatic pagination to four pages, 100,000 rows and a 30-second total deadline.
- Expose pagination and truncation diagnostics while preserving hourly data and native metadata.
- Remove provider error bodies from logs and errors; bound search-type comparison fan-out.

The public server remains self-contained. Hosted billing, workspaces, account-selection storage, creative galleries, Launcher files and MCP Apps UI are outside this synchronization. Existing standalone protections and public features newer than the hosted source are retained.

Validation uses synthetic data. No live advertising write is required by the test suite. The generated server-card.json is the source of truth for this revision's tool schemas.

Maintainer: Emmanuel, getmcpads. Contact: hello@getmcpads.com.
