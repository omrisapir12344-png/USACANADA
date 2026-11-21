#!/usr/bin/env python3
"""Compute real driving distances/times for each day's "drive" list in data/trip.json.

Uses the public OSRM demo server (no API key). Run once:  python3 scripts/fetch-routes.py
Writes data/routes.json. OSRM times are free-flow estimates and usually optimistic.
"""
import json, time, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
trip = json.loads((ROOT / "data/trip.json").read_text(encoding="utf-8"))
pts = {p["id"]: p for p in trip["points"]}
out = {"source": "OSRM (router.project-osrm.org) · נתוני OpenStreetMap", "fetched": time.strftime("%Y-%m-%d"), "days": {}}
for day in trip["days"]:
    ids = day.get("drive")
    if not ids or len(ids) < 2:
        continue
    coords = ";".join(f"{pts[i]['lng']},{pts[i]['lat']}" for i in ids)
    req = urllib.request.Request(f"https://router.project-osrm.org/route/v1/driving/{coords}?overview=simplified&geometries=geojson",
                                 headers={"User-Agent": "TripGuideRoutes/1.0 (personal static travel page)"})
    data = json.load(urllib.request.urlopen(req, timeout=60))
    route = data["routes"][0]
    shuttle = {tuple(x) for x in day.get("shuttle", [])}
    legs = [{"from": ids[k], "to": ids[k + 1], "km": round(l["distance"] / 1000), "min": round(l["duration"] / 60),
             "mode": "shuttle" if (ids[k], ids[k + 1]) in shuttle else "car"} for k, l in enumerate(route["legs"])]
    out["days"][day["date"]] = {
        "legs": legs,
        "km": sum(l["km"] for l in legs if l["mode"] == "car"),
        "min": sum(l["min"] for l in legs if l["mode"] == "car"),
        "line": [[round(lat, 4), round(lng, 4)] for lng, lat in route["geometry"]["coordinates"]],
    }
    print(day["date"], out["days"][day["date"]]["km"], "km", out["days"][day["date"]]["min"], "min")
    time.sleep(1.5)
(ROOT / "data/routes.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
