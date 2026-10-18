# Agent guide for this fork

Read `CLAUDE.md` for the code layout and commands. This is the user's fork: push user changes to the `fork` remote, and use `origin` only to inspect upstream updates.

## Deployment work

Before changing hosting, authentication, account data, or MCP, read `docs/SELF_HOSTING.md`, `docs/SELF_HOSTING_HTTPS.md`, and `mcp/README.md`. In the owner's workspace, `../deployment.local.md` records the private home deployment; read it when present. Keep `.env`, `data/`, account exports, and backups outside Git.

The home service should listen on loopback and be exposed to the owner's tailnet through Tailscale Serve. Set `RP_ID` to the exact HTTPS hostname without a scheme and `ORIGIN` to its full HTTPS origin. A hostname change requires an account/passkey migration. The bundled MCP reads local state files and will become stale if it remains pointed at the laptop after the account moves.

## Verification

Before implementation, record the meaningful failure modes and expected results. Verify critical account, workout, sync, and deployment journeys end to end, retain a repeatable command or trace, and distinguish passes from blocked checks. Add isolated tests for behavior that an end to end check cannot cover reliably. Report any remaining unverified failure modes.
