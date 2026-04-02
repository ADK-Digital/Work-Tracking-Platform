# Template Conversion Audit

This audit identifies institution-specific assumptions in the current productization copy and proposes a low-risk phased approach to convert it into a reusable template.

## Branding and naming assumptions

- UI branding still uses legacy product naming:
  - `Special Projects Tracker` appears in the browser title and app header.
- Package names still use legacy names (`special-projects-*`) which are non-blocking for runtime but not template-neutral.
- Database naming (`special_projects`) is still domain-specific to the original deployment naming.
- Archived migration documentation references the original institution name and repo path conventions.

## Auth and identity assumptions

- Authentication flow is Google OAuth-specific (`/auth/google`), including smoke tests that validate Google redirect targets.
- Google Workspace integration is first-class in backend auth and owner directory lookup (`googleId`, Directory API usage).
- Owner directory fallback group defaults to `cms-admins`, which is a role/group naming convention from the source institution.
- Deployment config includes a specific service-account secret name/file path tied to prior org naming conventions.
- Example/default env values assume district-style email domains (`yourdistrict.org`) and Google admin impersonation fields.

## Environment and deployment assumptions

- Production compose has institution-specific identifiers in container names, volume names, secret names, and host paths (for example `bscsd-*` and `/home/local-admin/...`).
- Default production URLs and callback URLs point to `pm-dev.bscsd.org`.
- NGINX certificate filenames are tied to a specific hostname (`pm-dev.bscsd.org`).
- Deploy script hardcodes repo location (`/var/home/local-admin/pm/bscsd-pm`) and assumes a specific server layout.
- Handbook operational commands mention host/user/path values that were specific to the original deployment.

## Documentation assumptions

- Handbook content included source-institution hostnames, DNS, admin group email, SSH username, and pathing.
- Asana migration README included institution-specific owner email mapping, personal home directories, and repo name.
- There was no root template audit artifact prior to this pass to guide staged conversion.

## Potentially hardcoded business logic assumptions

- `server/src/ownerDirectoryGroup.ts` falls back to `cms-admins` if no env-based group is configured.
- Archived Asana migration script includes institution-specific fallback owner emails and import directories. (Archived and not intended for re-run, but still a source of assumptions.)
- Auth and authorization model currently assumes Google identity attributes (`googleSub`, `googleId`) throughout backend/frontend models.

## Recommended phased conversion plan

### Phase 1 (completed in this pass) — safe text/docs genericization

- Replace user-facing branding with neutral template wording.
- Rewrite setup-oriented docs to remove institution-specific names, hosts, users, and paths.
- Preserve runtime behavior and deployment entrypoints.

### Phase 2 — configuration externalization (low-to-medium risk)

- Introduce explicit template defaults for hostname/cert/secret naming in `docker-compose.prod.yml` and `nginx` config via env substitution or deployment overlays.
- Replace fallback owner group constant with env-only defaulting that is clearly documented.
- Add a root `README.md` with template bootstrap instructions and environment matrix.

### Phase 3 — identity/provider abstraction (medium risk)

- Keep Google provider as default, but define provider-agnostic auth interfaces and naming to reduce Google-specific coupling.
- Evaluate whether user models should remain Google-centric or move to provider-neutral identity keys.

### Phase 4 — packaging and template hardening (medium risk)

- Rename package/service identifiers and compose resource names to neutral terms with migration notes.
- Add institution onboarding checklist and validation scripts for required env values.
- Add explicit template examples for domains, groups, secrets, and deployment paths.
