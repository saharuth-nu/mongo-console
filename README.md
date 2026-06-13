# MONGO_CONSOLE

> Full-stack MongoDB monitoring web app with a hacker / Matrix-green dark theme.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![MongoDB](https://img.shields.io/badge/MongoDB-7-green?logo=mongodb)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker)

---

## Features

| Page | Features |
|---|---|
| **Dashboard** | Live server metrics, OPS/SEC & connections charts, database list — auto-refreshes every 5s |
| **DB Browser** | Resizable tree navigator (DB → Collection, sorted A-Z), paginated document viewer, JSON detail panel |
| **Query Executor** | Monaco editor with MongoDB syntax (`ObjectId()`, `ISODate()`, `/regex/`), find / aggregate modes, pagination, per-page limit, refresh button |
| **Slow Queries** | `system.profile` log, `currentOp` monitor, query detail panel |
| **Connection Manager** | Multi-server support, per-server connect / disconnect, credentials entered via UI (never stored in browser) |

---

## Screenshots

> Dark hacker theme — Matrix-green on black, monospace font throughout.

---

## Quick Start

### Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Configuration

### `.env.local`

```bash
# Single server (no credentials — enter via UI)
MONGODB_URI=mongodb://localhost:27017/?authSource=admin

# Multiple servers — comma-separated
MONGODB_URI=mongodb://localhost:27017/?authSource=admin,mongodb://localhost:37017/?authSource=admin

# With custom labels (pipe-separated)
MONGODB_URI=Local Dev|mongodb://localhost:27017,Production|mongodb://mongo.prod.com:27017
```

> **Security:** Never put username/password in `MONGODB_URI`. Enter credentials via the UI at `/connect` — the app injects them server-side only and never stores passwords in the browser or logs.

---

## Docker

### Run with Docker Compose

```bash
docker compose up -d
```

Starts:
- **MongoDB 7** on port `27017`
- **mongo-console** on port `3000`

### Build & push image

```bash
./build.sh <version>

# Example
./build.sh 1.0.0
```

Builds a multi-platform (`linux/amd64`) image with `BASE_PATH=/db-console` baked in and pushes to `saharuth20/mongo-console:<version>`.

### Build manually

```bash
# Serve at root path /
docker build -t mongo-console .

# Serve under a subpath (e.g. /db-console via nginx)
docker build --build-arg BASE_PATH=/db-console -t mongo-console .
```

---

## Nginx Reverse Proxy (subpath deployment)

```nginx
location /db-console {
    proxy_pass         http://127.0.0.1:3000;
    proxy_http_version 1.1;

    proxy_set_header   Upgrade           $http_upgrade;
    proxy_set_header   Connection        'upgrade';
    proxy_set_header   Host              $host;
    proxy_set_header   X-Real-IP         $remote_addr;
    proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header   X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
}
```

> **Important:** The image must be built with `--build-arg BASE_PATH=/db-console`. The `basePath` is baked into the Next.js bundle at build time — it cannot be changed at runtime.

---

## Multi-compose MongoDB Networking

If MongoDB runs in a separate Docker Compose stack, join the same external network:

```bash
# Create shared network once
docker network create mongo-net
```

```yaml
# In both compose files
networks:
  mongo-net:
    external: true
```

Or reference an existing compose network by its full name (e.g. `mystack_default`):

```yaml
networks:
  mystack_default:
    external: true
```

---

## Query Syntax

The Query Executor accepts relaxed MongoDB syntax — not just strict JSON:

```js
// ObjectId filter
{ _id: ObjectId("64f1234abc567890def12345") }

// Regex
{ name: { $regex: /john/i } }
{ name: { $regex: "john", $options: "i" } }

// Date
{ createdAt: { $gte: ISODate("2024-01-01") } }

// Unquoted keys
{ status: "active", age: { $gte: 18 } }
```

---

## Project Structure

```
mongo-console/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                  # Dashboard
│   ├── browser/page.tsx          # DB Browser
│   ├── query/page.tsx            # Query Executor
│   ├── slow/page.tsx             # Slow Queries
│   ├── connect/page.tsx          # Connection Manager
│   └── api/
│       ├── connect/              # GET status, POST connect, PATCH switch, DELETE disconnect
│       ├── metrics/              # GET serverStatus + dbStats
│       ├── databases/            # GET list databases
│       ├── collections/[db]/     # GET collections (sorted A-Z)
│       ├── documents/[db]/[col]/ # GET paginated documents
│       ├── query/                # POST find/aggregate with BSON support
│       └── slow-queries/         # GET profiler + currentOp
├── components/
│   ├── Terminal.tsx              # Reusable hacker-style panel
│   ├── Navbar.tsx                # Top navigation + connection guard
│   ├── Dashboard.tsx             # Live metrics + charts
│   ├── BrowserView.tsx           # Resizable DB tree + document viewer
│   ├── QueryView.tsx             # Monaco editor + paginated results
│   ├── SlowView.tsx              # Profiler + currentOp table
│   └── Select.tsx                # Custom dropdown (no native widget)
├── lib/
│   ├── mongo.ts                  # Multi-server MongoClient pool
│   ├── api.ts                    # basePath-aware fetch helper
│   └── store.ts                  # Zustand global state
├── Dockerfile                    # Multi-stage Alpine build
├── docker-compose.yml            # MongoDB + app stack
├── build.sh                      # Build & push Docker image
└── .env.local.example
```

---

## Tech Stack

| | |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS + custom CSS design system |
| Database | MongoDB Node.js driver v7 |
| Editor | Monaco Editor |
| Charts | Recharts |
| Icons | Lucide React |
| State | Zustand |
| Runtime | Node.js 20 Alpine (Docker) |
