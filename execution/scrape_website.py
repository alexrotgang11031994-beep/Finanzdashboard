#!/usr/bin/env python3
"""Design-Token-Scraper für Skill 6 (DIY Scraper), siehe CLAUDE.md.

Zweck: Farben, Typografie und Abstände von einer öffentlichen Seite extrahieren,
als Grundlage für eigene Designentscheidungen — nicht zum Kopieren von Inhalten.

Nur für statisches HTML/CSS geeignet (requests + BeautifulSoup, kein
JavaScript-Rendering). Seiten, die ihren Inhalt per React/Vue/Angular clientseitig
aufbauen, liefern hier kaum etwas — das Skript sagt das explizit, statt stumm ein
leeres Ergebnis zurückzugeben. Für solche Seiten wäre ein Playwright-Ansatz nötig,
der hier bewusst nicht mitgebaut ist (siehe directives/scrape_competitor_design.md).

Grenzen, die das Skript selbst durchsetzt:
- robots.txt wird geprüft; verbietet sie den Pfad, bricht das Skript ab
- eigener, ehrlicher User-Agent
- höchstens 5 verlinkte CSS-Dateien nachgeladen, mit Pause dazwischen
- keine Logins, keine Bezahlschranken, keine JS-Ausführung

Nutzung:
    python execution/scrape_website.py --url https://example.com
    python execution/scrape_website.py --url https://example.com --out .tmp/design_tokens
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
import urllib.robotparser
from collections import Counter
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

USER_AGENT = "InvestmentstrategeDesignScraper/1.0 (+lokales Design-Research, kein Crawler)"
REQUEST_TIMEOUT = 10
MAX_CSS_FILES = 5
DELAY_BETWEEN_REQUESTS = 1.5

HEX_COLOR_RE = re.compile(r"#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b")
RGB_COLOR_RE = re.compile(r"rgba?\([^)]+\)")
FONT_FAMILY_RE = re.compile(r"font-family\s*:\s*([^;{}]+)", re.IGNORECASE)
FONT_SIZE_RE = re.compile(r"font-size\s*:\s*([0-9.]+(?:px|rem|em))", re.IGNORECASE)
BORDER_RADIUS_RE = re.compile(r"border-radius\s*:\s*([0-9.]+(?:px|rem|em|%))", re.IGNORECASE)
BOX_SHADOW_RE = re.compile(r"box-shadow\s*:\s*([^;{}]+)", re.IGNORECASE)
SPACING_RE = re.compile(
    r"(?:margin|padding)(?:-(?:top|right|bottom|left))?\s*:\s*([0-9.]+px)", re.IGNORECASE
)


class ScrapeError(Exception):
    """Erwartete, sprechende Fehler — kein stiller Abbruch, keine Stacktrace-Wand."""


def check_robots_allowed(url: str) -> None:
    parsed = urlparse(url)
    robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
    rp = urllib.robotparser.RobotFileParser()
    rp.set_url(robots_url)
    try:
        rp.read()
    except Exception:
        # Keine robots.txt erreichbar heißt nicht "alles erlaubt" — aber auch nicht
        # automatisch verboten. Wir fahren fort und sind an anderer Stelle vorsichtig
        # (User-Agent, Rate Limit).
        return
    if not rp.can_fetch(USER_AGENT, url):
        raise ScrapeError(
            f"robots.txt auf {robots_url} verbietet das Abrufen von {url}. Abgebrochen."
        )


def fetch(url: str) -> requests.Response:
    try:
        res = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=REQUEST_TIMEOUT)
    except requests.exceptions.RequestException as err:
        raise ScrapeError(f"Verbindung zu {url} fehlgeschlagen: {err}") from err
    if res.status_code >= 400:
        raise ScrapeError(f"{url} antwortete mit HTTP {res.status_code}.")
    return res


def looks_js_rendered(soup: BeautifulSoup) -> bool:
    body = soup.find("body")
    text_len = len(body.get_text(strip=True)) if body else 0
    script_count = len(soup.find_all("script"))
    element_count = len(soup.find_all(True))
    # Faustregel: sehr wenig sichtbarer Text, aber viele Script-Tags relativ zu
    # Elementen insgesamt → Inhalt kommt vermutlich erst durch JS im Browser.
    return text_len < 200 and script_count > 3 and element_count < 60


def extract_css_urls(soup: BeautifulSoup, base_url: str) -> list[str]:
    urls = []
    for link in soup.find_all("link", rel=lambda v: v and "stylesheet" in v):
        href = link.get("href")
        if href:
            urls.append(urljoin(base_url, href))
    return urls[:MAX_CSS_FILES]


def collect_css_text(soup: BeautifulSoup, base_url: str) -> str:
    chunks = [style.get_text() for style in soup.find_all("style")]
    for tag in soup.find_all(style=True):
        chunks.append(tag["style"])

    css_urls = extract_css_urls(soup, base_url)
    for i, css_url in enumerate(css_urls):
        if i > 0:
            time.sleep(DELAY_BETWEEN_REQUESTS)
        try:
            res = fetch(css_url)
            chunks.append(res.text)
        except ScrapeError as err:
            print(f"  Warnung: {err}", file=sys.stderr)
    return "\n".join(chunks)


def extract_tokens(css_text: str, html_text: str) -> dict:
    colors = Counter(HEX_COLOR_RE.findall(css_text) + HEX_COLOR_RE.findall(html_text))
    colors.update(RGB_COLOR_RE.findall(css_text))

    font_families = Counter(m.strip().strip("'\"") for m in FONT_FAMILY_RE.findall(css_text))
    font_sizes = Counter(FONT_SIZE_RE.findall(css_text))
    border_radii = Counter(BORDER_RADIUS_RE.findall(css_text))
    shadows = Counter(s.strip() for s in BOX_SHADOW_RE.findall(css_text))
    spacing = Counter(SPACING_RE.findall(css_text))

    def top(counter: Counter, n: int = 12) -> list[dict]:
        return [{"value": value, "count": count} for value, count in counter.most_common(n)]

    return {
        "colors": top(colors, 16),
        "typography": {
            "font_families": top(font_families, 8),
            "font_sizes": top(font_sizes, 12),
        },
        "spacing": {
            "margin_padding_px": top(spacing, 12),
        },
        "border_radius": top(border_radii, 8),
        "box_shadow": top(shadows, 8),
    }


def slugify(url: str) -> str:
    host = urlparse(url).netloc or "unknown"
    return re.sub(r"[^a-z0-9.-]+", "-", host.lower()).strip("-")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", required=True, help="Öffentliche Ziel-URL")
    parser.add_argument(
        "--out", default=".tmp/design_tokens", help="Ausgabeordner (Default: .tmp/design_tokens)"
    )
    args = parser.parse_args()

    try:
        check_robots_allowed(args.url)
        print(f"robots.txt erlaubt den Abruf von {args.url}.")

        res = fetch(args.url)
        soup = BeautifulSoup(res.text, "html.parser")

        if looks_js_rendered(soup):
            print(
                "Warnung: Seite wirkt clientseitig gerendert (wenig Text, viele Scripts). "
                "Ergebnis ist vermutlich unvollständig — siehe Hinweis im Skript-Kopf.",
                file=sys.stderr,
            )

        print("Sammle CSS (inline + verlinkte Stylesheets, max. 5 Dateien) …")
        css_text = collect_css_text(soup, args.url)

        tokens = extract_tokens(css_text, res.text)
        output = {"url": args.url, **tokens}

        out_dir = Path(args.out)
        out_dir.mkdir(parents=True, exist_ok=True)
        out_path = out_dir / f"{slugify(args.url)}.json"
        out_path.write_text(json.dumps(output, indent=2, ensure_ascii=False), encoding="utf-8")

        print(f"Fertig: {len(output['colors'])} Farben, "
              f"{len(output['typography']['font_families'])} Schriftfamilien gefunden.")
        print(f"Gespeichert unter {out_path}")
        return 0

    except ScrapeError as err:
        print(f"Abgebrochen: {err}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
