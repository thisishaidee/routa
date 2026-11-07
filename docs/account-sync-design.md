# ROUTA account and sync contract

Status: architecture and database migration only. Authentication and sync are not enabled yet.

## Product behavior

- Guest mode remains available; opening ROUTA never requires an account.
- Account creation is optional and uses email + password.
- Email confirmation is required once when registering. Normal subsequent sign-ins do not ask for another verification code.
- Password recovery uses the auth provider's recovery flow.
- A guest's existing local data is never replaced by an empty cloud workspace during sign-up.
- A verified account can use cloud sync across devices. Local storage remains the immediate cache so the app remains usable offline.
- Backup export/import remains available as a portability and recovery path.

## Workspace payload, schema version 1

The single row owned by an account contains one JSON object:

```ts
{
  profile: Profile;
  routine: Routine | null;
  progress: ProgressMap;
  notes: NotesMap;
  settings: Settings;
  checkIns: CheckInState;
  recovery: RecoveryState;
}
```

Do not include device alarm registrations, browser notification permission, session markers, or agent-link origin/token. These remain device-local. Reminder preference is part of Settings, but each device must still request its own browser/device permission.

## Database

Migration: `supabase/migrations/20261108000100_routa_workspaces.sql`

- One row per `auth.users.id`, enforced by the primary key.
- RLS is enabled and forced.
- Authenticated users can select only their own row directly. Anonymous users have no table privileges.
- Table writes are revoked from client roles; all inserts/updates go through the revision-checked RPC. The RPC runs with a fixed empty search path and row security enabled, and still checks the caller's authenticated user ID.
- No client-side service-role key is permitted.
- `save_routa_workspace` performs compare-and-swap using the expected revision. A stale device gets a conflict instead of silently overwriting a newer workspace.
- The RPC is security-invoker and still subject to RLS. It cannot act without an authenticated user.

## Guest-to-account migration

1. Read and validate all local records; if corruption is detected, stop and ask the user to restore/export/reset before account migration.
2. Preserve a complete local backup snapshot in memory and do not clear guest storage.
3. After email verification/sign-in, fetch the account workspace.
4. If the account has no workspace, create it from the guest snapshot with expected revision 0.
5. If the account already has a workspace and the guest also has data, do not choose either silently. Show a deliberate choice: keep the account workspace, replace it with the guest workspace after backup, or cancel.
6. Verify the saved revision and payload before marking sync active. Keep local data until the remote copy has been read back successfully.

## Sync and conflict rules

- First implementation uses one versioned workspace document and a revision number.
- Saves are serialized; each save uses the last confirmed revision.
- A revision conflict pauses outbound writes and reloads the newer remote workspace. It must not auto-overwrite.
- Independent progress/check-in additions can be merged only with explicit deterministic rules and tests.
- Same-day note edits and routine edits that changed on both devices require a conflict choice; do not use last-write-wins.
- Failed network writes keep local changes and show a pending-sync state. They are retried when connectivity returns.
- Sign-out stops cloud operations but does not delete local guest data.
- Account deletion and remote workspace deletion are out of scope until a separately confirmed deletion and export policy exists.

## Required security and integration tests before enabling sync

- Anonymous client cannot select, insert, update, or call the save RPC.
- User A cannot read or update User B's workspace, including by supplying User B's UUID.
- User A and User B can each create/read/update their own row.
- A stale revision cannot overwrite a newer revision.
- Invalid schema versions and non-object payloads are rejected.
- Signup requires email confirmation once; subsequent sign-in does not.
- Guest migration preserves all data and does not clear local storage before read-back verification.
- Corrupt local data blocks migration and automatic persistence.
- No service-role/secret key is present in browser code, public env vars, or Git history.

## Not yet done

The SQL migration has been committed to the feature branch, but it has not been applied to the Supabase project. No auth client, signup UI, sync worker, or environment variables have been added. Do not describe cloud sync as active until those steps are implemented, deployed to preview, and tested with two separate accounts.
