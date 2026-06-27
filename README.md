# 🪔 KumbhSetu — Unified Cross-Center Rescue Registry

**One registry. Every center. No one lost in the gap.**

> Claude Impact Lab · Mumbai 2026 — *Missing Persons at Kumbh Mela 2027*

At the Nashik–Trimbakeshwar Simhastha, thousands go missing daily — mostly elderly
pilgrims. The fatal flaw in today's system: **lost-and-found centers don't share data.**
A person found and logged at Center A is invisible to a family searching at Center B.
**KumbhSetu closes that gap** — one registry searchable across every center, with AI
identity matching that works despite blank names, transliteration, and incomplete records.

## How it maps to the judging criteria

| Criterion | What we built |
|---|---|
| **Cross-center search gap** *(the core problem)* | **Search & Match** queries *every* center at once and surfaces records a family at one desk could never see — including people already found / hospitalized elsewhere. |
| **System design** (duplicate, incomplete data) | A deterministic fuzzy matcher (Jaro-Winkler names + transliteration collapse, age-band adjacency, language, location, description) that **gracefully ignores blank fields**; a dedicated **Duplicate Detection** view merges the same person reported at multiple centers. |
| **Offline-first** | The matcher runs **entirely client-side** — flip the **Network toggle** to offline (networks collapse on Amrit Snan days) and search + dedupe still work. Online, Claude re-ranks and explains the top candidates. |
| **UX for phoneless / non-literate users** | **Operator Intake** is built for a volunteer helping a walk-up family with no phone: speak/paste in any language → Claude detects, translates, structures → instantly searchable. Big age-band/gender buttons, not free text. |
| **Responsible data handling** | Privacy by design: contact numbers **masked everywhere**, only identity-relevant fields sent to AI, consent gate on storing contacts, synthetic data only, minimization after reunion. |

Plus a **Hotspot Map** using the real geography datasets (CCTV, police, chokepoints,
zones) to show separation hotspots and route a found person to the nearest help point.

## Powered by Claude

`claude-opus-4-8` with adaptive thinking + structured outputs, behind a server-side proxy
(the API key never reaches the browser):

| Endpoint | Job |
|---|---|
| `POST /api/match` | Identity resolution — is each candidate the *same person* as the search? |
| `POST /api/dedupe` | Which candidates are duplicate reports of the same person across centers? |
| `POST /api/parse-intake` | Multilingual free text/voice → structured registry record |

**No key? It still runs** on the client-side deterministic matcher (labelled "⚙ Offline
match"), which is exactly the offline-first path the problem demands.

## Run it

```bash
npm install
cp .env.example .env       # add ANTHROPIC_API_KEY (optional — offline mode works without)
npm run dev                # → http://localhost:5173
```

### Use the real dataset
The app loads CSVs from `public/data/`. We ship **schema-exact synthetic data**
(`node data/generate.js` regenerates it). **Drop the provided CSVs into `public/data/`**
with the same filenames and the app uses them unchanged — every column name matches the
spec (`case_id`, `missing_person_name`, `age_band`, `is_duplicate_report`, …).

## Architecture

```
React + Vite (browser, :5173)
   │  loads /data/*.csv  ·  deterministic match runs HERE (offline-first)
   │  /api/*  (vite proxy)
   ▼
Express proxy (:8787)  ──►  Anthropic SDK  ──►  claude-opus-4-8
   │                          (match / dedupe / intake — structured outputs)
   └─ graceful fallback ──►  heuristic engines (no key / no network)
```

All missing-person records are **synthetic** — no real personal data. Geography data
(CCTV, police, chokepoints, zones) modeled on the Kumbhathon Innovation Foundation package.

Built with Claude Code.
