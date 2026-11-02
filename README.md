# Villu Online (வில்லு)

A web-based music streaming player for personal use, streaming directly from YouTube Music. No downloads, gapless playback, playlists, and dark minimalist UI.

- **Live URL**: [https://villu-online.gokulnaatheswaran.workers.dev](https://villu-online.gokulnaatheswaran.workers.dev)
- **Stack**: SvelteKit (Svelte 5 Runes) + Tailwind CSS v4 on Cloudflare Workers (D1 + KV).

---

## Features

- **Zero-download streaming**: High-quality AAC audio (`audio/mp4`) streamed directly in-browser.
- **Universal audio proxy**: Native byte range seeking (`206 Partial Content`) that works on any browser (Chrome, Safari, iOS, Firefox).
- **Gapless dual-engine playback**: 20s lookahead pre-buffering with smooth track transitions.
- **Fast cold-start (< 50ms)**: Instant home feed with cached playlists and background refresh.
- **Media Session API**: Native OS lock-screen controls, notification widget, and hardware media keys.
- **Playlists & library**: Custom playlists, liked songs, and listening history stored in Cloudflare D1 (SQLite).
- **Stream caching**: Pre-signed URL caching in Cloudflare KV with automatic expiration renewal.
- **Responsive UI**: Persistent glassmorphic dock player, full-screen expanded player, sliding queue manager, and desktop/mobile navigation.

---

## Tech Stack

- **Frontend**: [SvelteKit](https://kit.svelte.dev/) (Svelte 5 Runes) + [Tailwind CSS v4](https://tailwindcss.com/)
- **Runtime**: [Cloudflare Workers / Pages](https://developers.cloudflare.com/workers/) via `@sveltejs/adapter-cloudflare`
- **Database**: [Cloudflare D1](https://developers.cloudflare.com/d1/) (Serverless SQLite)
- **Cache**: [Cloudflare KV](https://developers.cloudflare.com/kv/)
- **Stream Resolver**: [youtubei.js](https://github.com/LuanRT/YouTube.js) + Innertube API

---

## Getting Started

### Prerequisites

- Node.js 20+
- npm

### Local Development

1. Clone and install dependencies:
```bash
npm install
```

2. Initialize local SQLite D1 database:
```bash
npx wrangler d1 execute villu-db --local --file=./schema.sql
```

3. Run dev server:
```bash
npm run dev
```

4. Or preview with Cloudflare Worker environment (D1 + KV bindings):
```bash
npm run build
npm run preview
```

Open [http://localhost:8788](http://localhost:8788).

---

## Cloudflare Deployment

### 1. Create Cloudflare Resources

Run the following with Wrangler or via the Cloudflare Dashboard:

```bash
# 1. Create D1 database
npx wrangler d1 create villu-db

# 2. Apply database schema to remote D1
npx wrangler d1 execute villu-db --remote --file=./schema.sql

# 3. Create KV namespace for stream caching
npx wrangler kv namespace create STREAM_CACHE
```

### 2. Configure `wrangler.jsonc`

Update `database_id` and `id` in `wrangler.jsonc` with the IDs returned from the commands above:

```jsonc
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "villu-db",
      "database_id": "<YOUR_D1_DATABASE_ID>"
    }
  ],
  "kv_namespaces": [
    {
      "binding": "STREAM_CACHE",
      "id": "<YOUR_KV_NAMESPACE_ID>"
    }
  ]
}
```

### 3. Remote Database Migration (For Existing Deployments)

If you have an existing remote D1 database, apply the auth migration:

```bash
npx wrangler d1 execute villu-db --remote --file=./migrations/0001_auth.sql
```

### 4. Deploy

**Option A — Direct deploy with Wrangler:**
```bash
npm run build
npx wrangler deploy
```

**Option B — Deploy from Cloudflare Dashboard (Git Integration):**
1. Connect this GitHub repository (`Gokulnaath17/villu_online`) in Cloudflare Dashboard (**Workers & Pages** -> **Create application** -> **Pages** or **Workers**).
2. Set Build command: `npm run build`
3. Set Output directory: `.svelte-kit/cloudflare`
4. In Settings -> **Bindings**, bind:
   - D1 Database: Variable name `DB` -> `villu-db`
   - KV Namespace: Variable name `STREAM_CACHE` -> `STREAM_CACHE`
5. Save and deploy.

### 5. First-Run Admin Setup & Security

1. Open your deployed URL.
2. The server detects that 0 accounts exist and automatically presents the **Setup Admin Account** screen.
3. Enter your desired admin username and master password.
4. Your account is created, any legacy playlists and history are claimed by your account, and registration is permanently locked down.
5. All application pages and API endpoints (including audio proxies) are protected behind your authenticated `HttpOnly` session.

---

## License

[MIT](LICENSE)
