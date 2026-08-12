# Directive: Scrape Competitor Design

## Goal
Design-Tokens (Farben, Typografie, Abstände, Schatten) von einer öffentlich zugänglichen
Seite extrahieren, um Designentscheidungen für das Finanzdashboard zu informieren — nicht
um Inhalte zu kopieren oder Layouts 1:1 nachzubauen.

## Wann sinnvoll
Konkurrenz-/Referenzseiten aus dem Umfeld des Projekts: Parqet, getquin, Portfolio
Performance, Sharesight, Kubera, oder Stil-Referenzen wie Linear/Vercel/Stripe (siehe
Skill 1). Nur die öffentliche Startseite/Marketing-Seite, nie eingeloggte Bereiche.

## Inputs
- Ziel-URL (nur öffentlich erreichbare Seiten)
- Was extrahiert werden soll: `colors` | `typography` | `spacing` | `all` (Default: `all`)

## Skills
1. Skill 6 (DIY Scraper) — Extraktion selbst
2. Skill 1 (Design Direction) — Bewertung: was ist gut, was passt zu „vertrauenswürdig,
  seriös, kein Hype" (Ton des Projekts), was nicht

## Ausführung
```bash
python execution/scrape_website.py --url https://example.com --out .tmp/design_tokens
```
Details, Grenzen und Fehlerbilder: siehe Kopfkommentar in `execution/scrape_website.py`.

## Outputs
- JSON-Datei unter `.tmp/design_tokens/<host>.json`
- Kurze Einschätzung in Textform: übernehmenswert ja/nein, warum

## Grenzen (nicht verhandelbar)
- `robots.txt` wird vom Skript automatisch geprüft — verbietet sie den Pfad, bricht das
  Skript ab, nicht umgehen
- Keine Logins, keine Bezahlschranken umgehen
- Eigener User-Agent, max. 1 Anfrage alle paar Sekunden (im Skript fest verdrahtet)
- Ergebnis dient der eigenen Design-Entscheidung, nicht dem Kopieren fremder Inhalte/Screenshots
  in eigene, veröffentlichte Flächen (Urheberrecht)

## Edge Cases
- Seite ist React/Vue-gerendert, `requests` bekommt leeres HTML → Skript meldet das
  explizit („Kaum Inhalt gefunden — vermutlich JS-Rendering") statt stumm leere Tokens
  zurückzugeben. Für solche Seiten reicht der einfache Scraper nicht; das wäre der
  Fall für einen Playwright-Ansatz, der hier bewusst nicht mitgebaut wurde, um keine
  zusätzliche Abhängigkeit ungenutzt im Projekt liegen zu haben — bei Bedarf nachrüsten.
- Timeout/Verbindungsfehler → Skript bricht mit klarer Meldung ab, kein stiller Retry-Loop
