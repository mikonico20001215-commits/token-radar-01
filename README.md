# Token Radar — radar-2

A token launch radar: a program plus the dashboard it writes. It reads the
sealed DefiLlama snapshot (`input/snapshot.json`, 758 protocols, 40 on the
watchlist, floor $50,000,000), scores every rankable pre-token protocol, and
writes a ranked board, a static dashboard, and a dossier.

## The model (radar-2)

Every row is scored by one function of the snapshot figures. No protocol
name is special-cased and no row is hand-picked.

```
implied = round( tvl_usd x 0.25
  x (1 + clamp(change_7d, -60, 120) / 100 x 0.5)
  x (0.6 + min(age_days, 1095) / 1095 x 0.4)
  x (1 + min(chains - 1, 5) x 0.025) )
```

- **Base:** TVL x 0.25. A protocol's size is the starting point for what a
  token could be worth if the record stayed as it is.
- **Growth:** the 7-day TVL change, clamped to [-60, +120]%, at half weight.
  A protocol that is growing fast is worth more than one the same size that
  is shrinking.
- **Maturity:** age since first listed, up to 3 years. A protocol that has
  run for years with no token recorded has had longer to build the user base
  a launch would price in; an unknown age counts as 365 days.
- **Breadth:** each extra chain up to 5 adds 2.5%. A protocol live on more
  chains has more places a token can land and more users to reach.

Implied value is the entry's own claim, never a promise and never a price.
A protocol is "pre-token" when the snapshot records no token for it
(no market cap, no CoinGecko id, no symbol) — the record, not proof that
it has none.

## Coverage

The board covers the whole watchlist (40) plus **every** rankable pre-token
protocol below the watchlist floor in this snapshot (186), for 226 rows —
not just the largest 160. Live-token protocols (24 shown) are set aside
with their market caps, never mixed into the ranking.

## Farm plans

Each row carries 8 farm steps, derived from the protocol's own record:
its category decides the core action (supply, provide liquidity, bridge,
stake, margin, and so on), its TVL decides the capital ($50–$250), its age
decides the hold (30–60 days), its 7-day TVL move decides the risk check
(a fall of 10% or more halves the first deposit), and its chain list
decides whether the plan repeats the core action on a second chain. The
weekly step is tailored to the category instead of a generic "do something".

## The dashboard

A static page with no network: ranked board, per-protocol detail view
(model inputs + farm plan), search, sort, and filters by category, chain,
and watchlist-only. The page recomputes each row's implied value from the
snapshot figures and checks it against the board.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json
```

Node 22+, standard library only. Output goes to `out/`: `board.json`,
`data.js`, `dashboard/`, `screenshots/`, `dossier.json`.

## Screenshots

`screenshots/` holds the three views the gate wants: the board, a detail
view, and a filtered view. They are re-rendered from the dashboard's own
files in a headless browser after any material dashboard change; the ones
in this repo predate the radar-2 controls and need re-rendering before
submission.
