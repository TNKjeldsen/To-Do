# Ugeplan

Personlig ugeplan og to-do app. Local-first PWA — al data ligger på din enhed,
ingen konto, ingen backend, ingen tracking.

## Funktioner

- Ugevisning med datoer (mandag–søndag) og uge-navigation (forrige / i dag / næste)
- Hurtig oprettelse af opgaver direkte i dagen
- Underpunkter pr. opgave (tilføj, redigér, afkryds, slet)
- Flyt opgaver mellem dage:
  - **Desktop:** drag-and-drop mellem dagskolonner (eller "Flyt til…"-knap)
  - **Mobil:** "Flyt til…"-knap åbner en bottom sheet med ugedage og uge-navigation
- Markér opgaver / underpunkter som færdige
- JSON eksport / import for manuel backup eller flytning mellem enheder
- PWA — kan installeres på iPhone hjemmeskærm og fungerer offline

## Tech stack

- React 19 + Vite + TypeScript
- Tailwind CSS v4
- @dnd-kit for drag-and-drop
- date-fns
- vite-plugin-pwa (Workbox)
- localStorage til persistens

## Kom i gang

```bash
npm install
npm run dev
```

Åbn `http://localhost:5173` i din browser.

### Scripts

- `npm run dev` — udviklingsserver
- `npm run build` — produktionsbuild til `dist/`
- `npm run preview` — preview af det byggede output
- `npm run lint` — TypeScript type-check
- `npm run icons` — regenerér PWA-ikoner fra `public/favicon.svg`

## Deployment

### GitHub Pages (anbefales)

1. Push repoet til GitHub.
2. Gå til **Settings → Pages → Build and deployment** og vælg
   **GitHub Actions** som kilde.
3. Push til `main` — workflowet i [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)
   bygger og deployer automatisk.
4. App URL bliver `https://<bruger>.github.io/<repo-navn>/` (eller
   `https://<bruger>.github.io/` for et user/org-repo).

Workflowet sætter automatisk `VITE_BASE_PATH` korrekt baseret på repo-navnet.

### Cloudflare Pages

1. Opret et nyt projekt på [pages.cloudflare.com](https://pages.cloudflare.com)
   og forbind det til dit Git-repo.
2. **Build command:** `npm run build`
3. **Output directory:** `dist`
4. **Environment variables:** ingen krævet (`VITE_BASE_PATH` er som standard `/`).

App URL bliver `https://<projekt>.pages.dev` eller dit custom domæne.

### Lokalt på iPhone via WiFi (uden hosting)

`npm run dev -- --host` eller `npm run preview` lytter på dit lokale netværk.
Åbn URL'en (fx `http://192.168.1.50:5173`) på iPhone i Safari. Du kan ikke
installere PWA via et lokalt IP — det kræver HTTPS.

## Datalagring og sync

Al data gemmes i `localStorage` under nøglen `todo.app.v1`. Det betyder:

- Data er **per browser, per enhed, per Chrome-profil** — der er **ingen
  automatisk sync** mellem dine enheder.
- Brug **Indstillinger → Eksportér JSON** til at gemme en backup-fil. Læg
  den fx i iCloud Drive eller Google Drive, og **importér** den på en anden
  enhed for at flytte data.
- Inden import laves automatisk en sikkerhedskopi af eksisterende data.

Ægte automatisk cross-device sync kræver en cloud-komponent (kommer evt. i v2
via Cloudflare Workers + KV).

## PWA på iPhone

1. Åbn appens URL i Safari på iPhone (kræver HTTPS, dvs. GitHub Pages eller
   Cloudflare Pages).
2. Tryk på **Del-ikonet** → **Føj til hjemmeskærm**.
3. App-ikonet ligger nu på hjemmeskærmen og åbner i fuldskærm uden Safari-UI.
4. Appen virker også offline.

## Datastruktur

```ts
interface Subtask {
  id: string;
  text: string;
  done: boolean;
  order: number;
}

interface Task {
  id: string;
  title: string;
  date: string;       // YYYY-MM-DD (lokal dato)
  done: boolean;
  order: number;      // sortering inden for dagen
  createdAt: string;  // ISO timestamp
  updatedAt: string;
  subtasks: Subtask[];
}

interface AppData {
  schemaVersion: 1;
  tasks: Task[];
  exportedAt?: string;
}
```

## Begrænsninger / kendt opførsel

- Reordering af opgaver inden for samme dag (uden at flytte til en anden dag)
  understøttes ikke i v1.
- Drag-and-drop på mobil er bevidst slået fra for at undgå konflikter med
  scroll. Brug "Flyt til…"-knappen i stedet.
- localStorage har en grænse på ~5–10 MB; det rækker til mange tusinde opgaver.
