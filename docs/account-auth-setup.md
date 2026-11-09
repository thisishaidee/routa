# ROUTA account setup

ROUTA uses Supabase Auth in the browser with the project's publishable key. Never put a Supabase secret/service-role key in a Vite variable or client bundle.

Configure these build-time variables in the preview/deployment environment:

- `VITE_SUPABASE_URL`: the Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY`: the Supabase publishable key

In Supabase Auth settings:

1. Enable email/password sign-in.
2. Keep email confirmation enabled for signup.
3. Add the exact ROUTA preview and production origins to the allowed redirect URLs.
4. Configure the email confirmation and password recovery templates to use the configured Supabase redirect URL.
5. Keep the public site URL and redirect allowlist restricted to ROUTA origins.

The app provides guest use, email/password signup, email/password sign-in, email verification on signup, password reset, and password update after recovery. Existing local data is not deleted by signup or sign-in.

The account card currently provides an explicit first cloud backup and restore. It deliberately does not silently overwrite an existing cloud workspace. Automatic background sync, revision conflict resolution, and guest-to-existing-account merge are not yet enabled; they require the next sync milestone and dedicated cross-device tests.

The workspace table is protected by RLS. Client reads are scoped to the signed-in user; writes go through the revision-checked save RPC. Do not grant browser clients direct insert/update access.
