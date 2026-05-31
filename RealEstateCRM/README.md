# RealEstateCRM

Offline-first Windows desktop CRM for real-estate, colony, housing society, plot, customer, sales, payment, refund, document, and financial management.

## Stack

- React.js + Tailwind CSS frontend
- Electron.js desktop runtime
- Node.js + Express.js REST API
- Local PostgreSQL database
- Background sync engine for cloud synchronization
- Electron Builder NSIS Windows installer

## Core Features

- Fully offline-first local PostgreSQL storage
- Secure JWT authentication
- Role-based access control
- Customer, colony, block, plot, sale, payment, refund, finance, document, report, notification, and user modules
- Responsive desktop, laptop, tablet, and mobile layout
- Dark/light mode
- Local backup and restore utilities
- Background sync queue with retries, conflict resolution, duplicate prevention, sync logs, and sync status tracking
- Windows EXE installer configuration with custom install directory and shortcuts

## Default Demo Login

- Username: `admin`
- Password: `admin123`

## Prerequisites

Install these on the target development/build machine:

- Node.js 20+
- PostgreSQL 15+
- npm 10+
- Windows 10/11 for EXE packaging

## Local Database Setup

Create a PostgreSQL database:

```sql
CREATE DATABASE realestate_crm;
```

Configure credentials in:

```text
backend/.env
```

Run schema and seed scripts after dependencies are installed.

## Install Dependencies

From the project root:

```bash
npm install
```

This installs root, frontend, backend, and Electron dependencies via the `postinstall` script.

## Development Run

```bash
npm run dev
```

This starts:

- Frontend Vite server on `http://localhost:3000`
- Backend Express API on `http://localhost:5000`
- Electron desktop shell

## Production Build

```bash
npm run build:all
```

## Build Windows EXE Installer

```bash
npm run build:exe
```

Output will be generated in:

```text
dist/
```

## Installer Behavior

The Windows installer is configured for:

- Product name: `RealEstateCRM`
- Default installation path: `C:\Program Files\RealEstateCRM\`
- Custom install directory selection
- Desktop shortcut
- Start menu shortcut
- Required app folders:
  - `data`
  - `backups`
  - `logs`
  - `uploads`

## Offline Sync

Local changes are written to PostgreSQL first and inserted into `sync_queue`.

The sync engine:

- Processes pending queue records
- Pushes local changes to the cloud database when configured
- Pulls recent cloud changes
- Resolves conflicts by latest timestamp
- Tracks status in `sync_logs`
- Retries failed records up to the configured retry count

Cloud sync requires `CLOUD_DB_*` variables in `backend/.env`.

## Backup and Restore

Backup:

```bash
cd backend
npm run backup
```

Restore:

```bash
cd backend
npm run restore -- path/to/backup-file.backup
```

## Production Notes

For a truly bundled enterprise installer, ship PostgreSQL using one of these approaches:

1. Install PostgreSQL as a prerequisite through IT policy.
2. Bundle PostgreSQL binaries and initialize a private cluster under the application data directory.
3. Use a managed local PostgreSQL service installer step.

The current scaffold provides the application architecture and installer hooks needed for this setup. PostgreSQL runtime bundling should be finalized based on your licensing/deployment policy.

## Important Security Steps Before Deployment

- Replace `JWT_SECRET` in production.
- Use a strong PostgreSQL password.
- Restrict file-system permissions for uploads/backups.
- Configure encrypted backups if handling sensitive customer documents.
- Configure a secure cloud database connection for sync.
