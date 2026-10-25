# Route and Range

Adventure ride planner, live at https://routeandrange.pages.dev (Cloudflare Pages, deploys from `main`).

## How it's built

- `index.html` is the deployed page. It is **generated**: edit `src/`, then run `./build.sh`.
- `src/page.html`: page layout and styles.
- `src/js/`: the app, joined in file-name order:
  - `01-config.js`: service addresses (routing, map tiles, search, places)
  - `02-icons.js`: icons
  - `03-gpx.js`: GPX import and export
  - `04-search.js`: place search
  - `05-routing.js`: route requests (Stadia, falling back to OSRM)
  - `06-geometry.js`: distances, simplifying lines, matching places to the route
  - `07-places.js`: fuel, towns, sights, stays and medical along the route
  - `08-sun-weather.js`: sunset and weather
  - `09-contacts.js`: phone, web and email links
  - `10-app.js`: trip model, screens, map and fuel stop logic
- `functions/api/places.js`: Cloudflare function that relays place lookups to Overpass.
- `data/`: OpenStreetMap snapshots (fuel, towns, sights …), refreshed by `.github/workflows/data.yml`.

## Services

- Routing and map tiles: Stadia Maps, authorised by the domain `routeandrange.pages.dev` (no key in the code). Change `ROUTER` / `TILES` in `src/js/01-config.js` to switch.
- Weather: Open-Meteo. Search: Photon. Places: Overpass via `/api/places`.

## Before every push

```
./build.sh
```

Builds `index.html`, checks the script, and runs `tests/smoke.cjs` (Playwright). The test loads a 2-day trip with a fake routing server and checks the overview, day screens, fuel pill, map buttons and way choice. Don't push if it fails.
