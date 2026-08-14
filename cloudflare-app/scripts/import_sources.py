#!/usr/bin/env python3
"""Import NYC Open Data amenities into Supabase.

This is intentionally independent of Django and DynamoDB. Add a source by
implementing a function that yields normalized rows from the SOURCES table.
Run with DATABASE_API/PUBLISHABLE_DB_KEY (or SUPABASE_URL/
SUPABASE_PUBLISHABLE_KEY) in the environment.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any, Iterable

import requests

ROOT = Path(__file__).resolve().parents[2]


def load_dotenv(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def odata(dataset: str, top: int = 100000) -> list[dict[str, Any]]:
    response = requests.get(
        f"https://data.cityofnewyork.us/api/odata/v4/{dataset}",
        params={"$top": top, "$skip": 0, "$count": "true", "$format": "json"},
        timeout=180,
    )
    response.raise_for_status()
    payload = response.json()
    return payload.get("value", [])


def coords(geometry: Any) -> tuple[float, float] | None:
    if isinstance(geometry, dict) and isinstance(geometry.get("coordinates"), list):
        values = geometry["coordinates"]
        if len(values) >= 2:
            try:
                return float(values[1]), float(values[0])
            except (TypeError, ValueError):
                return None
    return None


def row(type_name: str, source: str, external_id: Any, name: Any,
        latitude: Any, longitude: Any, raw: dict[str, Any], **extra: Any) -> dict[str, Any] | None:
    try:
        lat, lon = float(latitude), float(longitude)
    except (TypeError, ValueError):
        return None
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        return None
    return {
        "type_name": type_name,
        "source": source,
        "external_id": str(external_id),
        "name": str(name or type_name)[:200],
        "latitude": lat,
        "longitude": lon,
        "raw_data": raw,
        **extra,
    }


def fountains() -> Iterable[dict[str, Any]]:
    for item in odata("qnv7-p7a2", 10000):
        point = coords(item.get("the_geom"))
        if point:
            yield row("Water Fountain", "nyc_water_fountains", item.get("system") or item.get("_id") or item.get("ID"), item.get("Location") or item.get("location"), *point, item, address=item.get("propertyna") or "", description=item.get("Position") or "")


def restrooms() -> Iterable[dict[str, Any]]:
    for item in odata("i7jb-7jku", 10000):
        point = coords(item.get("location_1"))
        if point:
            status = str(item.get("status") or "").lower()
            yield row("Restroom", "nyc_public_restrooms", item.get("__id") or f"{point[0]}_{point[1]}", item.get("facility_name"), *point, item, address=item.get("location_type") or "", description=item.get("additional_notes") or "", operator=item.get("operator") or "", active=status == "operational", seasonal=str(item.get("open_year_round") or "").lower() == "seasonal", accessibility=item.get("accessibility") or "", hours_of_operation={"raw": item.get("hours_of_operation") or ""})


def bike_racks() -> Iterable[dict[str, Any]]:
    for item in odata("592z-n7dk", 100000):
        point = coords(item.get("the_geom"))
        if point:
            yield row("Bike Rack", "nyc_bike_racks", item.get("site_id") or f"{point[0]}_{point[1]}", item.get("ntaname") or item.get("ifoaddress"), *point, item, address=item.get("ifoaddress") or "", description=f"Type: {item.get('racktype') or 'Standard Rack'}")


def cooling_sites() -> Iterable[dict[str, Any]]:
    for item in odata("h2bn-gu9k", 5000):
        # Current dataset normally uses x/y; retain the conversion hook here
        # for future source changes rather than silently importing bad points.
        if item.get("x") is None or item.get("y") is None:
            continue
        yield row(str(item.get("featuretype") or "Cooling Site"), "nyc_cooling_sites", item.get("__id"), item.get("propertyname") or "Cooling Site", item.get("y"), item.get("x"), item, address=item.get("subpropertyname") or "", description=f"Type: {item.get('featuretype') or 'Cooling Site'}", active=str(item.get("status") or "").lower() == "activated")


def linknyc() -> Iterable[dict[str, Any]]:
    """Merge LinkNYC status and Wi-Fi datasets by source ID or coordinates."""
    status_url = "n6c5-95xh"
    wifi_url = "yjub-udmw"
    merged: dict[str, dict[str, Any]] = {}
    by_coord: dict[str, str] = {}

    def coordinate(item: dict[str, Any]) -> tuple[float, float] | None:
        lat, lon = item.get("latitude"), item.get("longitude")
        geo = item.get("geocoded_column") or item.get("location_lat_long")
        if lat in (None, "") and isinstance(geo, dict):
            values = geo.get("coordinates")
            if isinstance(values, list) and len(values) >= 2:
                lon, lat = values[0], values[1]
        try:
            return float(lat), float(lon)
        except (TypeError, ValueError):
            return None

    def key(item: dict[str, Any], point: tuple[float, float]) -> tuple[str, str]:
        source_id = str(item.get("site_id") or item.get("sourceid") or "").strip().upper()
        coord_key = f"{point[0]:.5f}|{point[1]:.5f}"
        return (f"id:{source_id}" if source_id else f"coord:{coord_key}", coord_key)

    for item in odata(status_url):
        point = coordinate(item)
        if not point:
            continue
        item_id, coord_key = key(item, point)
        status = str(item.get("status") or "")
        address = ", ".join(str(item.get(k) or "").strip() for k in ("address", "city", "boro") if item.get(k))
        details = [f"Type: {item.get('kiosk_type')}" if item.get("kiosk_type") else "", f"Kiosk status: {status}" if status else "", f"WiFi: {item.get('wifi_status')}" if item.get("wifi_status") else "", f"Tablet: {item.get('tablet_status')}" if item.get("tablet_status") else "", f"Phone: {item.get('phone_status')}" if item.get("phone_status") else ""]
        merged[item_id] = {"id": item_id, "coord_key": coord_key, "canonical_id": str(item.get("site_id") or "").strip().upper(), "name": f"LinkNYC {item.get('site_id')}" if item.get("site_id") else "LinkNYC Kiosk", "latitude": point[0], "longitude": point[1], "address": address, "description": " | ".join(x for x in details if x), "operator": "", "active": status.lower() not in {"removed", "retired", "relocated", "decommissioned"}, "raw": item}
        by_coord[coord_key] = item_id

    for item in odata(wifi_url):
        provider = str(item.get("provider") or "").strip()
        source_id = str(item.get("sourceid") or "").strip()
        if "linknyc" not in provider.lower() and not source_id.upper().startswith("LINK-"):
            continue
        point = coordinate(item)
        if not point:
            continue
        item_id, coord_key = key(item, point)
        target = item_id if item_id in merged else by_coord.get(coord_key, item_id)
        address = ", ".join(str(item.get(k) or "").strip() for k in ("location", "city", "boroname") if item.get(k))
        details = [f"Provider: {provider}" if provider else "", f"Location type: {item.get('location_t')}" if item.get("location_t") else "", f"SSID: {item.get('ssid')}" if item.get("ssid") else "", f"Remarks: {item.get('remarks')}" if item.get("remarks") else ""]
        candidate = {"id": target, "coord_key": coord_key, "canonical_id": source_id.upper(), "name": f"LinkNYC {source_id}" if source_id else "LinkNYC Kiosk", "latitude": point[0], "longitude": point[1], "address": address, "description": " | ".join(x for x in details if x), "operator": provider, "active": True, "raw": item}
        if target in merged:
            current = merged[target]
            current["address"] = current["address"] or candidate["address"]
            current["description"] = " | ".join(x for x in (current["description"], candidate["description"]) if x)
            current["operator"] = current["operator"] or provider
            current["active"] = current["active"] and candidate["active"]
            current["raw"] = {"status": current["raw"], "wifi": item}
        else:
            merged[target] = candidate
        by_coord[coord_key] = target

    for item in merged.values():
        external_id = f"linknyc:{item['canonical_id']}" if item["canonical_id"] else f"linknyc:coord:{item['coord_key']}"
        yield row("LinkNYC Kiosk", "nyc_linknyc", external_id, item["name"], item["latitude"], item["longitude"], item["raw"], address=item["address"], description=item["description"], operator=item["operator"], active=item["active"])


SOURCES = {"fountains": fountains, "restrooms": restrooms, "bike-racks": bike_racks, "cooling-sites": cooling_sites, "linknyc": linknyc}


class Supabase:
    def __init__(self) -> None:
        self.url = os.environ.get("SUPABASE_URL") or os.environ.get("DATABASE_API")
        self.key = os.environ.get("SUPABASE_PUBLISHABLE_KEY") or os.environ.get("PUBLISHABLE_DB_KEY")
        if not self.url or not self.key:
            raise RuntimeError("Set DATABASE_API and PUBLISHABLE_DB_KEY first")
        self.headers = {"apikey": self.key, "Authorization": f"Bearer {self.key}", "Content-Type": "application/json", "Prefer": "resolution=merge-duplicates,return=representation"}

    def upsert(self, table: str, values: list[dict[str, Any]], on_conflict: str) -> list[dict[str, Any]]:
        response = requests.post(f"{self.url.rstrip('/')}/rest/v1/{table}?on_conflict={on_conflict}", headers=self.headers, json=values, timeout=120)
        if not response.ok:
            raise RuntimeError(f"Supabase {table} upsert failed ({response.status_code}): {response.text[:500]}")
        return response.json() if response.content else []


def run(selected: list[str]) -> None:
    db = Supabase()
    total = 0
    for source_name in selected:
        rows = list(SOURCES[source_name]())
        if not rows:
            print(f"{source_name}: no valid rows")
            continue
        type_names = sorted({r["type_name"] for r in rows})
        types = db.upsert("amenity_types", [{"name": name, "color": "#3388ff", "icon": ""} for name in type_names], "name")
        type_ids = {item["name"]: item["id"] for item in types}
        payload = []
        for item in rows:
            payload.append({k: v for k, v in {"external_id": item["external_id"], "amenity_type_id": type_ids[item["type_name"]], "name": item["name"], "latitude": item["latitude"], "longitude": item["longitude"], "address": item.get("address", ""), "description": item.get("description", ""), "operator": item.get("operator", ""), "hours_of_operation": item.get("hours_of_operation", {}), "accessibility": item.get("accessibility", ""), "active": item.get("active", True), "seasonal": item.get("seasonal", False), "source": item["source"], "raw_data": item["raw_data"]}.items()})
        # PostgREST accepts batches; keeping this bounded makes the script safe
        # for the large bike-rack dataset and easier to retry.
        for start in range(0, len(payload), 500):
            db.upsert("amenities", payload[start:start + 500], "amenity_type_id,external_id")
        print(f"{source_name}: upserted {len(payload)} rows")
        total += len(payload)
    print(f"Done: {total} amenities upserted")


if __name__ == "__main__":
    load_dotenv(ROOT / ".env.postgres")
    parser = argparse.ArgumentParser()
    parser.add_argument("sources", nargs="*", choices=[*SOURCES, "all"], default=["all"])
    args = parser.parse_args()
    selected = list(SOURCES) if "all" in args.sources else args.sources
    try:
        run(selected)
    except (requests.RequestException, RuntimeError, ValueError) as exc:
        print(f"Import failed: {exc}", file=sys.stderr)
        raise SystemExit(1)
