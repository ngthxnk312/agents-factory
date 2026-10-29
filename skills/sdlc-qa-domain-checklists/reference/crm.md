# CRM checklist (web and mobile)

Scope: leads, contacts, accounts/companies, opportunities/deals, pipelines, activities (calls, meetings, tasks, notes), cases/tickets, campaigns, imports/exports, field-sales mobile apps. Use with `cross-cutting.md`.

## State dimensions

Record lifecycle (new, qualified, converted, won/lost, closed, archived, soft-deleted); ownership (mine, team's, other team's, unassigned); sharing (private, team, organization, explicitly shared); user role (sales rep, manager, admin, read-only, external partner); device connectivity (online, offline, syncing, conflict).

## Checklist

### Records (CRUD)

- Create with required/optional fields, field types (phone, email, URL, currency, picklists, multi-select, lookup), default values, validation rules
- Edit inline and in forms; read-only fields by role/stage; field history if specified
- [C] Delete: soft delete and restore window; cascade or block for related records (contacts of an account, activities of a deal); permanent purge permissions
- Conversion: lead → contact/account/opportunity maps every field; no data loss; conversion idempotent

### Duplicates and merge

- [C] Duplicate detection rules (email, phone normalization, name + company, fuzzy matching) on create, import and API
- [C] Merge: choose surviving values, re-parent related records (activities, deals, attachments), keep audit; merge conflicts; un-merge if supported
- Cross-team duplicates visible/hidden per sharing rules

### Ownership, sharing and permissions

- [C] Record visibility by role hierarchy and sharing rules, including in search, reports, exports, dashboards and mobile caches
- Reassignment (single and bulk) moves related records as specified and notifies owners
- Territory/team changes recalculate access

### Pipeline and forecasting

- Stage transitions allowed/forbidden; required fields per stage; probability and amount rollups; currency conversion with dated rates
- Won/lost requires reason; reopening rules; forecast categories and totals at period boundaries

### Activities and communication

- Scheduling across time zones and daylight-saving; reminders; recurring events; calendar sync conflicts
- Email/call logging association to the right records; no sending to real people from test environments

### Search, list views, reports

- Global search across objects respects permissions; partial/phonetic/diacritic matching as specified
- Saved filters, sorting, pagination, column configuration; report totals equal list totals

### Import / export

- Mapping, required fields, validation errors per row, duplicate handling, large files (max, max+1), encoding and delimiters, re-import idempotency
- [C] Export respects permissions; personal data export logged

### Mobile and offline sync

- Offline create/edit queued; sync on reconnect; [C] conflict resolution when the same record changed on server and device; deleted-on-server while edited offline
- Partial sync scope (only my records / recent) and its effect on search
- Attachments and photos from camera/gallery: size limits, compression, permissions, upload resume
- Location check-ins and permissions; background sync limits; logout clears cached data

### Integrations

Email/calendar, telephony, marketing tools, enrichment services, ERP/billing: failures, duplicate webhooks, rate limits, field mapping changes.

### Privacy

[C] Consent and communication preferences honored; data subject requests (export, erase/anonymize) cover all related records and backups as specified; personal data not in logs/analytics.

## Common defects

Duplicates created by import or mobile sync; merge losing activities; ownership change leaving orphan records; users seeing records via search/report that they cannot open; time-zone shifted meetings; offline edits silently overwritten.

## Signs of a weak suite

No duplicate/merge cases; permissions tested only on record pages (not search/reports/exports/mobile cache); no offline conflict cases; lifecycle transitions only on happy path.

## Automation notes

Candidates: validation rules, permission and sharing matrices via API, import validation sets, duplicate rules. Partial/manual: calendar/email provider integrations, camera/location on real devices, long-running sync under real network conditions.
