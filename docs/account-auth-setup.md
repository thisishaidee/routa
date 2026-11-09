# ROUTA account authentication setup

ROUTA uses Supabase Auth with email/password authentication. Guest use remains available; account creation is optional.

## Required deployment variables

Set these in the Vercel Preview environment before testing the account UI:

- VITE_SUPABASE_URL: the ROUTA Supabase project URL.
- VITE_SUPABASE_PUBLISHABLE_KEY: the project's publishable key.

Only the publishable key belongs in browser code. Never expose a Supabase secret or service-role key.

## Supabase Auth settings

1. Keep email confirmations enabled so new accounts must verify their email once.
2. Set the Site URL to the deployed preview URL while testing.
3. Add the preview URL and production URL to the allowed redirect URLs.
4. Configure an email provider / SMTP before public signup testing; the default email service may have delivery limits.

Password reset uses the same site origin and Supabase's recovery flow.

## Cloud backup behavior in this first implementation

- Existing local ROUTA data is not uploaded at signup or sign-in automatically.
- The signed-in user chooses Sync cloud backup.
- If there is no cloud workspace, ROUTA creates one from the current local backup.
- If a cloud workspace already exists, ROUTA asks whether to restore cloud data or replace it with this device's data.
- Revision checks prevent a stale device from silently saving over a newer cloud revision.
- This is an explicit/manual sync foundation, not continuous background sync yet.
- Local backup export/import remains available.
