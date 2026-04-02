# Work Tracking Platform

This repository contains a production-ready internal work tracking application template for managing projects and requests.

## What it includes

- React + Vite frontend
- Node.js + Express + Prisma backend
- PostgreSQL database
- MinIO object storage for attachments
- NGINX reverse proxy
- Google OAuth-based authentication
- Podman-based deployment workflow

## Deployment entrypoint

Use the existing deploy script:

```bash
./ops/deploy-prod.sh
```

## Notes

- Some compose-related filenames still use `docker-compose` naming for compatibility.
- The runtime is Podman.
- Backups are handled operationally and are not changed in this conversion pass.

## Template conversion status

See `TEMPLATE_CONVERSION_AUDIT.md` for a full inventory of institution-specific assumptions and a phased conversion plan.
