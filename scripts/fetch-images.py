#!/usr/bin/env python3
"""Download freely licensed photos from Wikimedia Commons for every point in data/trip.json.

Run once (no API key needed):   python3 scripts/fetch-images.py [--per 3] [--only id1,id2] [--force]

- Uses the public Commons API, honours rate limits (HTTP 429 / Retry-After).
- Keeps only CC BY, CC BY-SA, CC0 and public-domain images, landscape, >= 1200 px wide.
- Saves resized WebP (~1200 px wide) to assets/img/<point-id>/<n>.webp
- Writes author / license / source for every image to data/credits.json
- Optional per-point search override: "imageQuery" in trip.json, or exact files in "imageFiles".
"""
import argparse, io, json, re, sys, time, urllib.error, urllib.parse, urllib.request
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
TRIP = ROOT / "data" / "trip.json"
CREDITS = ROOT / "data" / "credits.json"
IMG = ROOT / "assets" / "img"
UA = {"User-Agent": "TripGuideImageFetcher/1.0 (personal non-commercial static travel page)"}
LICENSE_OK = re.compile(r"^(CC BY(-SA)? [0-9.]+|CC BY(-SA)?|CC0|Public domain|PD.*)$", re.I)
SKIP_KINDS = {"transport"}
GENERIC = {"lake", "lakes", "falls", "mount", "national", "park", "the", "and", "viewpoint", "trail", "center", "centre",
           "international", "airport", "river", "canyon", "glacier", "alaska", "alberta", "british", "columbia", "pier"}


def match_words(point):
    """Words a file title must contain, so a search for 'Sunrise, Mount Rainier' doesn't return Bryce Canyon."""
    if point.get("imageMatch") is not None:
        return [w.lower() for w in point["imageMatch"]]
    words = re.findall(r"[a-z0-9']+", (point.get("nameEn") or "").lower())
    return [w for w in words if len(w) > 2 and w not in GENERIC][:2]


def get(url, timeout=60):
    for attempt in range(8):
        try:
            return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout).read()
        except urllib.error.HTTPError as e:
            if e.code not in (429, 503):
                raise
            wait = int(e.headers.get("Retry-After") or 0) or 15 * (attempt + 1)
            print(f"   rate limited, waiting {wait}s", flush=True)
            time.sleep(wait)
    raise RuntimeError("gave up after repeated rate limiting")


def api(**params):
    params.update(format="json", action="query")
    return json.loads(get("https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(params)))


def clean(html):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", html or "")).strip() or "Unknown"


def candidates(point):
    common = dict(prop="imageinfo", iiprop="url|size|extmetadata", iiurlwidth=1200)
    if point.get("imageFiles"):
        data = api(titles="|".join(point["imageFiles"]), **common)
    else:
        q = point.get("imageQuery") or point.get("nameEn") or point["name"]
        data = api(generator="search", gsrsearch=f"filetype:bitmap {q}", gsrnamespace=6, gsrlimit=20, **common)
    pages = sorted(data.get("query", {}).get("pages", {}).values(), key=lambda p: p.get("index", 0))
    must = [] if point.get("imageFiles") else match_words(point)
    for p in pages:
        title = p["title"].lower()
        if any(w not in title for w in must) or "(bw)" in title or "black and white" in title:
            continue
        ii = (p.get("imageinfo") or [{}])[0]
        md = ii.get("extmetadata", {})
        lic = clean(md.get("LicenseShortName", {}).get("value"))
        w, h = ii.get("width", 0), ii.get("height", 1)
        if not LICENSE_OK.match(lic) or w < 1200 or w < h * 1.15 or "thumburl" not in ii:
            continue
        yield {"title": p["title"], "thumb": ii["thumburl"], "author": clean(md.get("Artist", {}).get("value")),
               "license": lic, "licenseUrl": md.get("LicenseUrl", {}).get("value", ""), "source": ii["descriptionurl"]}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--per", type=int, default=3)
    ap.add_argument("--only", default="")
    ap.add_argument("--force", action="store_true")
    a = ap.parse_args()

    trip = json.loads(TRIP.read_text(encoding="utf-8"))
    credits = json.loads(CREDITS.read_text(encoding="utf-8")) if CREDITS.exists() else {}
    credits.setdefault("points", {})
    only = set(filter(None, a.only.split(",")))

    for point in trip["points"]:
        pid = point["id"]
        if (only and pid not in only) or (not only and point.get("kind") in SKIP_KINDS):
            continue
        if credits["points"].get(pid) and not a.force:
            continue
        print(f"* {pid}", flush=True)
        out, entries = IMG / pid, []
        out.mkdir(parents=True, exist_ok=True)
        try:
            for c in candidates(point):
                im = Image.open(io.BytesIO(get(c["thumb"]))).convert("RGB")
                if im.width > 1200:
                    im = im.resize((1200, round(im.height * 1200 / im.width)), Image.LANCZOS)
                n = len(entries) + 1
                im.save(out / f"{n}.webp", "WEBP", quality=78, method=6)
                c.pop("thumb")
                entries.append({"file": f"assets/img/{pid}/{n}.webp", **c})
                print(f"   {n}: {c['title']} | {c['license']}", flush=True)
                time.sleep(2)
                if len(entries) >= a.per:
                    break
        except Exception as e:  # keep going; rerun later for missing points
            print(f"   failed: {e}", flush=True)
        if entries:
            credits["points"][pid] = entries
            CREDITS.write_text(json.dumps(credits, ensure_ascii=False, indent=2), encoding="utf-8")
        time.sleep(3)
    print("done", flush=True)


if __name__ == "__main__":
    sys.exit(main())
