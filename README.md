# MONGO_CONSOLE

> Full-stack MongoDB monitoring web app with a hacker / Matrix-green dark theme.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![MongoDB](https://img.shields.io/badge/MongoDB-7-green?logo=mongodb)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker)

---

## Features

| หน้า | ฟีเจอร์ |
|---|---|
| **Dashboard** | Server metrics, live OPS/SEC & connections charts (Recharts), database list |
| **DB Browser** | Tree navigator (DB → Collection), paginated document viewer, JSON detail |
| **Query Executor** | Monaco editor, `find` / `aggregate` modes, elapsed time |
| **Slow Queries** | `system.profile` log, `currentOp` monitor, query detail panel |
| **Connection Manager** | Multi-server support, credentials entered via UI (never stored) |

---

## Quick Start

### Development

```bash
# 1. Install dependencies
npm install

# 2. Set environment (see Configuration section)
cp .env.local.example .env.local

# 3. Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Configuration

### `.env.local`

```bash
# Single server
MONGODB_URI=mongodb://localhost:27017/?authSource=admin

# Multiple servers — comma-separated
MONGODB_URI=mongodb://localhost:27017/?authSource=admin,mongodb://localhost:37017/?authSource=admin

# With custom labels (pipe-separated)
MONGODB_URI=Local Dev|mongodb://localhost:27017,Production|mongodb://mongo.prod.com:27017
```

> **Note:** Do not put username/password in `MONGODB_URI` — enter credentials via the UI at `/connect`. The app injects credentials server-side only.

---

## Docker

### Run with Docker Compose

```bash
docker compose up -d
```

This starts:
- **MongoDB 7** on port `27017`
- **mongo-console** on port `3000`

### Build & publish image manually

```bash
./build.sh <version>

# Example
./build.sh 1.0.0
```

Script will:
1. `docker login`
2. Build multi-platform image (`linux/amd64`) with `BASE_PATH=/db-console` baked in
3. Push to `saharuth20/mongo-console:<version>`

### Build without the script

```bash
# Serve at root path /
docker build -t mongo-console .

# Serve under a subpath (e.g. /db-console via nginx)
docker build --build-arg BASE_PATH=/db-console -t mongo-console .
```

---

## Nginx Reverse Proxy (subpath)

To serve the app under `/db-console` add this to your nginx config:

```nginx
# Redirect /db-console → /db-console/
location = /db-console {
    return 301 /db-console/;
}

location /db-console/ {
    proxy_pass         http://127.0.0.1:3000;
    proxy_http_version 1.1;

    proxy_set_header   Upgrade           $http_upgrade;
    proxy_set_header   Connection        'upgrade';
    proxy_set_header   Host              $host;
    proxy_set_header   Origin            $http_origin;
    proxy_set_header   X-Real-IP         $remote_addr;
    proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header   X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
}
```

> **Important:** The image must be built with `--build-arg BASE_PATH=/db-console` (via `build.sh` or manually). `basePath` is baked into the Next.js bundle at build time — it cannot be changed at runtime.

---

## Project Structure

```
mongo-console/
├── app/
│   ├── layout.tsx              # Root layout + shared Navbar
│   ├── page.tsx                # Dashboard
│   ├── browser/page.tsx        # DB Browser
│   ├── query/page.tsx          # Query Executor
│   ├── slow/page.tsx           # Slow Queries
│   ├── connect/page.tsx        # Connection Manager
│   └── api/
│       ├── connect/            # POST connect, GET status, PATCH switch
│       ├── metrics/            # GET serverStatus + dbStats
│       ├── databases/          # GET list databases
│       ├── collections/[db]/   # GET collections in db
│       ├── documents/[db]/[col]/ # GET paginated documents
│       ├── query/              # POST execute find/aggregate
│       └── slow-queries/       # GET profiler + currentOp
├── components/
│   ├── Terminal.tsx            # Reusable hacker-style panel
│   ├── Navbar.tsx              # Top navigation + connection status
│   ├── Dashboard.tsx           # Live metrics + charts
│   ├── BrowserView.tsx         # DB tree + document viewer
│   ├── QueryView.tsx           # Monaco editor + results
│   ├── SlowView.tsx            # Profiler + currentOp table
│   └── Select.tsx              # Custom dropdown (no native widget)
├── lib/
│   ├── mongo.ts                # Multi-server MongoClient pool
│   └── store.ts                # Zustand global state
├── Dockerfile                  # Multi-stage Alpine build
├── docker-compose.yml          # MongoDB + app stack
├── build.sh                    # Build & push Docker image
└── .env.local.example          # Environment template
```

---

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS + custom CSS design system
- **Database driver:** MongoDB Node.js driver v7
- **Editor:** Monaco Editor (`@monaco-editor/react`)
- **Charts:** Recharts
- **State:** Zustand
- **Runtime:** Node.js 20 Alpine (Docker)
