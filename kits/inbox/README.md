# Photos for the week's posts

One folder per week, named after that week's Monday: kits/inbox/2026-11-02/

- Friday, The Garage: garage-1.jpg (main picture), garage-2.jpg ... (extra slides)
- Saturday, Breakfast Run: breakfast-1.jpg (the vehicle outside), breakfast-2.jpg (the food), breakfast-3.jpg ... (candids)
- notes.json, only the parts you have:

{
  "garage": { "vehicle": "Alfa 105 Stepnose", "line": "New seats in.", "more": "" },
  "breakfast": { "place": "Die Strandloper", "town": "Langebaan", "vehicle": "Bedford", "order": "Fish and chips", "verdict": "Going back.", "lat": -33.07, "lon": 18.03 }
}

Easiest: send the photos to Claude in chat with the place, town and what you drove; Claude puts them here and rebuilds the week.
Then: node scripts/post-kits.mjs --from 2026-11-02
