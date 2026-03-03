# AWS Env Manager

A desktop tool for managing environment variables across multiple projects, with sync to AWS Parameter Store.

---

## What is this?

AWS Env Manager is a **cross-project environment variable management tool**. It gives you a structured GUI to organize env vars into namespaces, projects, and environments — then sync them to AWS Systems Manager Parameter Store.

This is **not a security tool**. It solves the operational challenge of managing env vars across many services and projects under a single umbrella. It assumes your infrastructure already uses **Parameter Store**, **S3**, and **IAM**.

---

## Features

- **Multi-environment key table** — view and edit all env values for a project side-by-side (dev / staging / prod)
- **Push to Parameter Store** — diff-first: review exactly what will be created, updated, or deleted before confirming
- **Pull from Parameter Store** — seed your local database from existing SSM parameters
- **Import / Export `.env`** — import from `.env` files; export any environment to `.env` format (clipboard)
- **S3 backup** — one-click gzip-compressed JSON backup of your entire local database
- **Restore from backup** — pick a `.gz` backup file and restore the full database
- **Cross-key links** — declare that two keys across projects must have the same value; broken links surface as validation errors
- **Secure keys** — flag a key as `SecureString` for SSM encryption
- **Key locking** — prevent accidental edits to critical keys; locked keys block deletion and pull operations
- **Namespace → Project → Environment** hierarchy for organizing large-scale configurations

---

## How it works

- Local SQLite database is the **working copy**
- Parameter Store path convention: `/<namespace>/<project>/<environment>/<KEY>`
- Push is a full sync: new keys → create, changed values → update, orphaned keys → delete
- AWS credentials read from `~/.aws/credentials` or a custom credentials file path (configurable per SSM / S3 profile in Settings)

---

## Production advice

This tool is for **managing and syncing** env vars to Parameter Store. It is not intended to be the runtime source of environment variables.

For production deployments, instead of committing `.env` files into source control or bundling them into deployments, your application should **fetch parameters from Parameter Store at process startup** and load them into environment variables. This keeps secrets out of your codebase and deployment artifacts.

Recommended flow:

1. Manage your variables in AWS Env Manager
2. Push to Parameter Store
3. At deployment, your process fetches parameters from Parameter Store at startup and loads them into its environment

---

## Prerequisites

- An AWS account with Parameter Store and (optionally) S3
- An IAM user or role with the following permissions:
  - `ssm:GetParametersByPath`, `ssm:DescribeParameters`, `ssm:PutParameter`, `ssm:DeleteParameter` — scoped to your namespace prefixes
  - `s3:PutObject`, `s3:ListBucket` — scoped to your backup bucket (if using S3 backup)
- Credentials configured in `~/.aws/credentials` under a named profile

### AWS setup

1. Create an IAM user with the permissions listed above
2. Add credentials to `~/.aws/credentials` under a named profile
3. Open Settings in the app and configure the profile name(s), region, and S3 bucket

---

## Known limitations

- **Single AWS account** — one account per app instance; no multi-account support
- **Plaintext local storage** — the SQLite database file is not encrypted at rest
- **Single user** — no multi-user or team sharing
- **No audit log** — changes are not tracked historically
- **Manual S3 setup** — the backup S3 bucket must be created and configured manually

---

## Tech stack

| Layer | Technology |
|---|---|
| Desktop | Tauri v2 |
| Frontend | React 19 + TypeScript |
| Local storage | SQLite (via tauri-plugin-sql) |
| AWS calls | AWS SDK for Rust (SSM + S3) |
| Tests | Vitest + Testing Library |

---

## Development

### Prerequisites

- Node.js ≥ 18
- Rust (via [rustup](https://rustup.rs))
- Tauri system deps (Linux): `libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev patchelf`

### Setup

```bash
npm install
```

### Run tests

```bash
# Frontend (TypeScript / React)
npm test

# Backend (Rust)
cd src-tauri && cargo test
```

### Dev server

```bash
npm run tauri dev
```

### Build

```bash
npm run tauri build
```

---

## Roadmap

- SQLite encryption at rest
- Multi-AWS-account support
- Scheduled / automatic sync
- Audit log
- Multi-user / team sharing

---

## License

MIT
