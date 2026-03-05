# Outlap

A feature-rich Formula 1 companion app that lets fans explore every session of the race weekend — from free practice to the chequered flag — with detailed lap-by-lap data, pace analytics, and championship standings.

Built with React Native and Expo, powered by the [OpenF1 API](https://openf1.org).

## Features

### Race Weekend Calendar
Browse the full F1 calendar across multiple seasons (2023–2026). Each Grand Prix card shows the circuit, country flag, date range, and a live status badge (Upcoming / Live / Finished). Tap into any GP for weekend highlights — pole sitter, podium finishers — and a full schedule of every session.

### Free Practice
- Driver and team compound pace rankings with compound filter chips
- Full classification sorted by fastest lap
- Per-driver detail view with stint-by-stint lap breakdown
- Interactive lap selection — toggle individual laps in/out to recalculate average pace on the fly

### Qualifying
- Classification with Q1 / Q2 / Q3 times and gap-to-pole
- Per-driver detail view with sector-level lap breakdown across each qualifying phase
- Three insight modes:
  - **Biggest Gains** — improvement from Q1 baseline to best lap
  - **Ideal Lap Potential** — theoretical best from combining fastest sectors
  - **Sector Times** — per-sector rankings across the field

### Race
- Full classification with grid position, pit stops, race time, and DNF/DNS/DSQ handling
- Overtake timeline — every on-track pass with driver profiles and lap context
- Five insight modes:
  - **Tyre Degradation** — per-stint degradation slope with safety car laps excluded
  - **Racecraft** — overtakes made/suffered, position gains/losses from grid to flag
  - **Pace Consistency** — coefficient of variation ranking with outlier filtering
  - **Compound Pace** — average lap time per compound with fuel load phase filter (heavy / medium / low)
  - **Pit Strategy** — team pit stop speed rankings, safety car pit counts, pre/post-stop lap delta analysis
- Per-driver detail view with full stint breakdown, interactive lap selection, and compound averages

### Driver Profiles
- Searchable driver grid for every season
- Season overview with headshot, team, key metrics (avg race/qualifying position, best results, wins, podiums)
- Expandable race-by-race and qualifying-by-qualifying result history

### Championship Standings
- Animated driver and constructor championship tables
- Spring-physics tab indicator with smooth segment transitions
- Pull-to-refresh for live updates during the season

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React Native 0.81 (New Architecture) + Expo 54 |
| Language | TypeScript 5.9 |
| Navigation | React Navigation 7 (native stack + bottom tabs) |
| HTTP | Axios |
| Persistence | AsyncStorage |
| Data Source | [OpenF1 REST API](https://api.openf1.org/v1) |

## Architecture

```
├── backend/
│   ├── api/           # HTTP client — rate limiting, caching, retry logic
│   └── service/       # Business logic — data assembly, analytics, insights
├── frontend/
│   ├── screen/        # Screen components (UI only, calls services)
│   ├── component/     # Reusable UI components
│   ├── navigation/    # Stack + tab navigator definitions
│   ├── hooks/         # Custom data-fetching hook
│   ├── theme/         # Design tokens (colors, spacing, typography, shadows)
│   └── config/        # App-wide constants
├── shared/            # Shared formatting utilities
└── utils/             # Domain helpers (driver, lap, tyre, session)
```

### Key Architecture Decisions

**Layered data flow** — A clean separation between raw API calls (`backend/api`), service-layer business logic (`backend/service`), and UI (`frontend/screen`). Screens never call the API directly.

**Two-level caching** — An LRU in-memory cache (200 entries) backed by persistent AsyncStorage with per-endpoint TTLs (2 minutes for live data up to 24 hours for static data). Includes stale-while-error fallback — if a fresh fetch fails, cached data up to 24 hours old is served instead.

**Rate limiting** — A custom concurrency queue enforces max 3 concurrent requests, 3 requests/second, and 30 requests/minute against the OpenF1 API, with exponential backoff and `Retry-After` header support.

**Inflight deduplication** — Duplicate concurrent requests for the same resource are collapsed into a single network call at both the API client and service layers.

**Session detail assembly** — Resources (drivers, laps, stints, results, race control, overtakes, pit stops, starting grid) are fetched in parallel via `Promise.all` and joined into per-driver data objects with type-discriminated session shapes.

**Generic data hook** — A single `useServiceRequest` hook handles all async data flows with loading/refreshing/error states, stale response prevention, and unmounted component safety.

## Design

The app uses a cohesive design system built from a single token file:

- **Typography** — Formula 1 and Titillium Web custom fonts with a 9-step type scale
- **Colors** — F1 brand red, team-accurate colors, tyre compound colors (Soft/Medium/Hard/Inter/Wet), podium gold/silver/bronze
- **Components** — Tyre compound badges with concentric-circle visuals, team-colored driver number badges, floating tab bar with animated pill indicator, racing-stripe accent cards
- **Tabular numbers** — All lap times use `tabular-nums` font variant for consistent alignment

## Getting Started

### Prerequisites

- Node.js
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator (macOS) or Android Emulator, or the Expo Go app on a physical device

### Installation

```bash
git clone https://github.com/lachezar-m/outlap.git
cd outlap
npm install
```

### Running

```bash
npx expo start
```

Scan the QR code with Expo Go (Android) or the Camera app (iOS), or press `i` / `a` to open in a simulator.

## License

This project is for personal and educational use.
