# photos.json

The file the server stores (Admin > a custom website project > Launch kit > Photo desk). The server's sanitizer
(`src/lib/kit/photos.js` in the Genius Websites repo) holds the same rules as `scripts/validate_photos.py`: a
file that passes the validator is stored exactly as written, with each `path` swapped for the stored upload. What
fails is changed or dropped, and the admin sees what was changed.

You don't type this file by hand: write `draft.json` (below) and let `scripts/build_photos.py` fill in the sizes,
crops and rounding.

```json
{
  "version": 1,
  "picks": [
    {
      "path": "photo-1.jpg",
      "role": "hero",
      "score": 9.1,
      "reason": "Sharp and wide, the whole car in even light",
      "alt": "Red sedan parked on a driveway in front of a row of trees",
      "focal": { "x": 0.54, "y": 0.61 },
      "crops": {
        "desktop": { "x": 0, "y": 0.1563, "w": 1, "h": 0.8437 },
        "phone": { "x": 0.2733, "y": 0, "w": 0.5333, "h": 1 }
      },
      "blur": [{ "x": 0.698, "y": 0.662, "w": 0.081, "h": 0.054, "kind": "plate" }],
      "width": 1800,
      "height": 1200
    }
  ],
  "pairs": [{ "before": "photo-5.jpg", "after": "photo-6.jpg", "note": "Mud washed off the doors and wheels" }],
  "shotList": ["...", "...", "..."],
  "notes": []
}
```

## Fields

Exactly these keys at every level; no others.

| Field | Rule |
|---|---|
| `version` | `1` |
| `picks` | Every photo of the request exactly once (one `analyze.py` could not read is left out and named in `notes`). At most 60. |
| `path` | The container file name the request lists (`photo-3.jpg`), never a folder path or the customer's own file name. |
| `role` | `hero` (at most 1, and exactly 1 when any photo is used), `about` (at most 1), `gallery` (at most 12), `before` / `after` (each in exactly one pair), `skip`. |
| `score` | 0-10, one decimal: how well the photo serves this site in this role (see art-direction.md). |
| `reason` | One plain line for the admin, at most 200 characters: why this role, or why skipped. |
| `alt` | What is visible, at most 160 characters (125 reads better); required unless `skip`. No claims (`data/claim_words.json` errors), no "Image of...", no plate numbers. |
| `focal` | `{x, y}`: the point every crop must keep, as fractions of the photo from the top left (0-1, 4 decimals). |
| `crops.desktop` | `{x, y, w, h}` fractions; 16:9 in pixels (within 2%). The site's wide hero and banners. |
| `crops.phone` | `{x, y, w, h}` fractions; 4:5 in pixels (within 2%). The same photo on a phone. |
| `blur` | Proposed boxes `{x, y, w, h, kind}` with `kind` `plate` or `face`, at most 12, inside the photo. An admin confirms each before anything is blurred. `[]` when nothing needs it. |
| `width`, `height` | The photo's pixel size as a browser shows it (EXIF rotation applied): `analysis.json`'s `width` and `height`. |
| `pairs` | At most 6. `before` and `after` name picks with those roles; each photo in one pair only. `note`: what changed, plainly, at most 200 characters, no claims (may be empty). |
| `shotList` | 3 to 10 different lines, each at most 200 characters: the shots to take on their next job. |
| `notes` | At most 8 lines, each at most 300 characters, for the admin (may be empty). |

All texts are one line: no line breaks or tabs, no double spaces, no spaces at the ends. Fractions have at most 4
decimal places, scores 1. All coordinates are of the photo as displayed (a phone photo stored sideways with an
EXIF turn counts as upright), which is what every script here measures and draws.

## What the server does with a bad file

| Problem | Server |
|---|---|
| Unknown or repeated `path` | pick dropped |
| Second hero or about | moved to the gallery while it has room, else skip |
| Gallery over 12 | the rest become skip |
| `before` / `after` not in a valid pair | after → gallery (while room), before → skip |
| Crop missing or not the right shape | recomputed around the focal point |
| `width` / `height` not the photo's size | replaced by the stored size (crops then go unchecked) |
| Blur box outside the photo or wrong kind | clipped, or dropped |
| Alt text or pair note with a claim | emptied |
| Over-long text | cut |

Every one of these is reported to the admin as a repair: make the validator pass instead.

## draft.json (what you write)

```json
{
  "picks": [
    { "path": "photo-1.jpg", "role": "hero", "score": 9.1, "reason": "...", "alt": "...",
      "focal": { "x": 0.55, "y": 0.6 },
      "zoom": { "desktop": 1, "phone": 0.85 },
      "crops": { "phone": { "x": 0.3, "y": 0, "w": 0.5333, "h": 1 } },
      "blur": [{ "x": 0.698, "y": 0.662, "w": 0.081, "h": 0.054, "kind": "plate" }] }
  ],
  "skip": {
    "photo-3.jpg": "Out of focus: the whole car is soft",
    "photo-9.png": { "reason": "A flyer, not a photo", "score": 0 }
  },
  "pairs": [{ "before": "photo-5.jpg", "after": "photo-6.jpg", "note": "..." }],
  "shotList": ["...", "...", "..."],
  "notes": []
}
```

- `focal` is optional: without it, `analyze.py`'s suggestion is used. Give your own whenever the subject isn't where
  the detail is (a car against a busy background, a face in an about photo).
- `zoom` (0.3-1, default 1) makes a crop tighter around the focal point; `crops` gives one outright (it must still
  be the right shape: `build_photos.py` reports it otherwise). Leave both out for most photos.
- `skip` is shorthand for unused photos: a reason, optionally a score (default: the tech score, at most 5).
- `build_photos.py` writes `photos.json` and validates it in the same step.
