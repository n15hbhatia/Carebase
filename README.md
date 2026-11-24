# Carebase

**Every animal. Every update. Every next step.**

Carebase is a case management and handover tool for a small animal shelter, built from an ethnographic study at a shelter in Worli, Mumbai. It connects what staff already use (tokens, duty charts, whiteboards, Post-it notes, Excel and WhatsApp) instead of replacing them. Its centre is the **Care Status Card**: the current status, last action, next action, responsible person and last-updated time for every case, so anyone can take over an animal's care without having to ask.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build into dist/
```

No API keys are needed. Without Supabase credentials the app runs in **local demo mode**: data is saved in the browser's `localStorage`, every create/edit/delete works, and data survives a refresh. *Settings → Reset demo data* restores the sample shelter.

On the sign-in screen, pick any of the 10 fictional staff members. Each role sees what that person would see. The profile menu has a **Switch user** list, so you can create a handover as one person and acknowledge it as another.

## What's inside

| Module | Highlights |
|---|---|
| Overview | KPI cards computed from live data (click through to filtered lists), active cases, today's tasks with inline completion, upcoming surgeries, recent activity, staff overview, active cases by status |
| Animals | Search by name or token, filter by type and status, sort, paginate, archive or restore, delete with confirmation, photo upload, profile with treatment history, care updates, tasks and handovers |
| Cases | Ten statuses, filters (status, doctor, responsible, opened date range, animal type, "mine"), case page with header, **Care Status Card**, care journey timeline, care-update form, tasks, handover history, surgery scheduling and assignment |
| Handover | All, Pending and Completed tabs, a form that fills itself from the case, an editable two-sentence summary, and acknowledgement by the receiver only (with acceptance of responsibility), recorded in the case timeline |
| Tasks | Table and Kanban views (drag and drop, or use the menu), 8 categories, overdue worked out from the due time, filters for staff, date, status and category |
| Staff | 10 default staff (1 manager, 2 doctors, 4 assistants, 3 support staff), add, edit, change role, deactivate, profiles with cases, tasks, duties and activity |
| Duty Schedule | Week grid and day view, surgery days highlighted, surgeries from cases shown on the calendar, manager-only editing |
| Activity Log | Append-only, newest first, filters for date range, staff, type and case |
| Notifications | New case or task assigned, handover received, handover still unacknowledged after N hours, task overdue, case status changed, mark as read |
| Search | `/` or `Ctrl/⌘+K`. Searches tokens ("21" finds 021), animals, case IDs, staff and tasks, with results grouped by category |

### Role permissions (enforced in the UI and by RLS policies)

- **Manager:** full access, including staff, schedules, settings and deletion.
- **Doctor:** cases, status changes, assessments, care plans, surgeries, assigning tasks.
- **Assistant:** care updates (status locked), handovers, completing their own tasks, registering admissions.
- **Support Staff:** their own cleaning, feeding and general tasks.

## Project structure

```
src/
  lib/types.ts         domain model (mirrors the SQL schema)
  lib/store.tsx        all mutations; every action writes activity logs and notifications
  lib/adapters.ts      DataAdapter interface: localStorage (demo) and Supabase
  lib/permissions.ts   role → permission matrix
  data/seed.ts         internally consistent sample data, dated relative to today
  components/          UI primitives (shadcn-style, Radix), Care Status Card, timeline, forms
  pages/               one file per module
supabase/migrations/   schema, constraints, indexes and Row Level Security
```

## Connecting Supabase

1. Create a project, then run `supabase/migrations/*.sql` in the SQL editor (or `supabase db push`).
2. Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3. Insert your staff rows, and link each Supabase Auth user to a staff row in `public.users`.

The app then loads and saves through `createSupabaseAdapter`, which sends only the rows that changed. The pages don't change. **Not yet built:** the Supabase sign-in screen. The demo profile picker needs to be replaced with Supabase Auth (email or magic link) so that `auth.uid()` resolves for RLS. The Supabase adapter has not been run against a live project.

## Notes

All people, animals, owners and treatments are fictional. Treatment text is illustrative and is not veterinary advice. There is deliberately no chat, billing, inventory or adoption module: the research did not show a need for them.
