// Central place to read environment variables from — never read process.env
// directly elsewhere (CODING_STANDARDS.md §3).

export const config = {
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    // Server-only — never reference this outside a server context.
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  },
  anthropic: {
    // Server-only — the AI draft-generation action must call this from the
    // server, never the client (see PROJECT_STATE.md §10).
    apiKey: process.env.ANTHROPIC_API_KEY,
    // Optional. Anthropic's API rejects an *unscoped* (org-level) key
    // unless every request also carries an `anthropic-workspace-id`
    // header naming which workspace to bill/run under — confirmed by a
    // live 400 from the real API during this feature's build, not
    // guessed. Leave unset if ANTHROPIC_API_KEY is already a
    // workspace-scoped key (Anthropic Console → Settings → API Keys);
    // set this only if it's an unscoped/org key instead.
    workspaceId: process.env.ANTHROPIC_WORKSPACE_ID,
  },
};
