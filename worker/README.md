# Ugeplan sync — Cloudflare Worker

Tiny worker (~50 LoC) that stores Ugeplans JSON-data i Cloudflare KV. Bruges
til at synkronisere mellem dine enheder. Intet brugerlogin — sync-nøglen i
URL'en er den eneste credential.

## Pris og kvoter

Cloudflare Workers gratis tier:
- **100.000 requests/dag** → rigeligt; selv hyppig redigering er typisk
  <1.000 reads + <100 writes/dag
- **1 GB KV-storage** → en personlig todo-liste fylder typisk under 50 KB
- **1.000 KV writes/dag** → debounced 3 sek. push begrænser dette markant

Du rammer praktisk talt aldrig grænsen.

## Engangs-opsætning

### 1. Opret Cloudflare-konto

Gratis på [dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up).
Ingen betalingsoplysninger nødvendige.

### 2. Installér Wrangler og log ind

```bash
cd worker
npm install
npx wrangler login
```

Browseren åbner — godkend i din Cloudflare-konto.

### 3. Opret KV-namespace

```bash
npx wrangler kv namespace create TODO_KV
```

Output ligner:

```
🌀 Creating namespace with title "ugeplan-sync-TODO_KV"
✨ Success!
Add the following to your configuration file:
[[kv_namespaces]]
binding = "TODO_KV"
id = "abc123def456..."
```

Kopiér `id`-værdien.

### 4. Opdatér wrangler.toml

Åbn [`wrangler.toml`](wrangler.toml) og erstat `REPLACE_WITH_KV_NAMESPACE_ID`
med id'et fra forrige skridt.

### 5. (valgfrit) Restrict CORS

I [`wrangler.toml`](wrangler.toml) under `[vars]`, sæt `ALLOWED_ORIGINS` til
din GitHub Pages URL for ekstra sikkerhed:

```toml
ALLOWED_ORIGINS = "https://dit-brugernavn.github.io"
```

`"*"` er fint for personlig brug — sync-nøglen er den reelle beskyttelse.

### 6. Deploy

```bash
npx wrangler deploy
```

Output viser din Worker-URL:

```
✨ Success!
Deployed ugeplan-sync to https://ugeplan-sync.<dit-brugernavn>.workers.dev
```

Den URL skal du indtaste i appens **Indstillinger → Sync**.

### 7. Test

```bash
curl https://ugeplan-sync.<dit-brugernavn>.workers.dev/health
# {"ok":true,"service":"ugeplan-sync"}
```

## Lokal udvikling

```bash
npx wrangler dev
```

Lytter på `http://localhost:8787`. Brug den URL midlertidigt i appen for at
teste sync uden at deploye.

## Endpoints

```
GET  /health             → health-check
GET  /sync/:key          → returnerer { data: ... | null }
PUT  /sync/:key          ← gem JSON-payload, returnerer { ok: true }
```

`:key` skal være 16-128 tegn `[A-Za-z0-9_-]`.

## Sikkerhedsnoter

- Sync-nøglen er den eneste credential. **Den er en URL-bestanddel** — så
  send aldrig URL'en til andre, post den ikke i screenshots, etc.
- Mister du nøglen, mister du adgang. Generér en ny og importér via JSON.
- Worker'en gemmer data uændret (uden kryptering). Hvis du vil have
  end-to-end-kryptering kan vi tilføje det senere via Web Crypto API.
- Cloudflare KV er **eventually consistent** mellem regioner (~60 sek). I
  praksis er writes typisk synlige globalt på <5 sek.

## Slet alt

Vil du nulstille:

```bash
npx wrangler kv key delete --namespace-id <id> "<din-sync-nøgle>"
# eller slet hele namespacet:
npx wrangler kv namespace delete --namespace-id <id>
```
