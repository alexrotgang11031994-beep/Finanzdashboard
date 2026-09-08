# Finanzdashboard

Portfolio-Dashboard mit Bestand, Sparplänen, Wertentwicklung und einem
Signal-Feed aus gekennzeichneten Fremdquellen.

Statische Seite ohne Build-Schritt. Läuft auf GitHub Pages, kostet nichts im
Betrieb und lässt sich als White-Label an Kunden ausliefern.

---

## In fünf Minuten live

```bash
# 1. Repo auf GitHub anlegen (leer, ohne README)
#    https://github.com/new

# 2. Lokal verbinden und hochladen
cd finanzdashboard
git init
git add .
git commit -m "Initialer Stand"
git branch -M main
git remote add origin git@github.com:DEIN-NAME/Finanzdashboard.git
git push -u origin main

# 3. Auf GitHub: Settings → Pages → Source: "GitHub Actions"
#    Der Workflow deploy.yml übernimmt den Rest.
```

Nach etwa einer Minute liegt die Seite unter
`https://DEIN-NAME.github.io/Finanzdashboard/`.

**Wichtig:** Auf `main` liegen deine echten Depotdaten. Solange das Repo
öffentlich ist, sind sie es auch. Für den Eigengebrauch: privates Repo plus
GitHub Pages im Bezahltarif, oder Deployment zu Cloudflare Pages / Netlify mit
Zugriffsschutz.

### Lokal ansehen

```bash
npm run dev        # oder: python3 -m http.server 8080
open http://localhost:8080
```

Direktes Öffnen der `index.html` per Doppelklick funktioniert **nicht** —
ES-Module brauchen `http://`, nicht `file://`.

---

## Aufbau

```
index.html                   Einstieg, lädt src/app.js als Modul
src/
  config.js                  ← Branding, Cluster, Regeln, Quellen, Rechts-Schalter
  styles.css                 ← Farben und Typografie, alles über CSS-Variablen
  app.js                     Laden der Daten, Tab-Routing
  data/
    portfolio.json           54 Positionen, Stand 09.08.2026
    savingsplans.json        29 Sparpläne
    snapshots.json           Startpunkt der Wertreihe
    signals.json             wird vom Workflow erzeugt
  lib/
    format.js                Zahlen-, Datums- und DOM-Hilfen
    metrics.js               Cluster, Herfindahl, Regelprüfung, Projektion
    prices.js                Kursanbindung mit Adapter
    store.js                 Snapshot-Historie im Browser
  views/                     eine Datei je Tab
scripts/
  fetch-signals.mjs          Signalabruf, läuft in der Action
.github/workflows/
  deploy.yml                 Pages-Deployment bei Push auf main
  signals.yml                werktäglich 06:15 UTC, committet signals.json
docs/
  RECHTLICHES.md             BaFin, MAR, Abgrenzung zur Anlageberatung
  QUELLEN.md                 Quellenbewertung, Lizenzen, Kursdatenanbieter
```

### Warum kein Framework, kein Build

Drei Gründe. Erstens: Ein Kunde, der das Repo übernimmt, braucht keine
Toolchain-Kenntnis. Zweitens: GitHub Pages liefert die Dateien direkt aus, ohne
Build-Schritt, der brechen kann. Drittens: Weniger Abhängigkeiten heißt weniger
Sicherheitsaktualisierungen bei einem Produkt, das im Finanzumfeld läuft.

Der Preis ist etwas mehr Handarbeit im DOM. Bei dieser Größe ist das der bessere
Handel.

---

## Die zwei Dinge, die du zuerst lesen solltest

### 1. Es gibt keine Kurshistorie

Die Screenshots zeigen genau einen Zeitpunkt: den 09.08.2026. Daraus eine
Wertentwicklungskurve zu zeichnen, hieße, sie zu erfinden. Der Tab „Entwicklung"
sagt das offen und beginnt mit einem einzigen Punkt.

Ab dem zweiten gespeicherten Stand entsteht dort eine echte Reihe. Zwei Wege
dorthin:

- **Manuell**: Knopf „Aktuellen Stand speichern". Landet im lokalen Speicher des
  Browsers, exportierbar als JSON.
- **Automatisch**: Kursanbindung aktivieren (siehe unten), dann kann ein
  Workflow täglich einen Punkt schreiben.

Was dort dann steht, ist übrigens **Kontostandsentwicklung, nicht Rendite** —
die Sparraten fließen mit ein. Für eine echte Rendite bräuchte es alle
Ein- und Auszahlungen mit Datum. Das steht als offener Punkt unten.

### 2. Der Rechts-Schalter

`PERSONALIZED_ADVICE` in `config.js` steht auf `false` und sollte dort bleiben,
bis eine Anwältin etwas anderes sagt. Die vollständige Begründung steht in
[docs/RECHTLICHES.md](docs/RECHTLICHES.md). Kurzfassung:

Allgemeine Fremdsignale mit Quellenangabe lösen eine **Anzeigepflicht** bei der
BaFin aus. Auf das konkrete Depot zugeschnittene Empfehlungen können
**Anlageberatung** sein — und die ist nach § 32 KWG beziehungsweise § 15 WpIG
erlaubnispflichtig, sobald sie gewerbsmäßig erbracht wird.

Deshalb teilen die Ansichten „Signale" und „Übersicht" im Code bewusst keinen
Zustand. Das ist kein Zufall der Architektur, sondern ihr Zweck.

---

## Konfiguration

### Kurse anbinden

```js
// src/config.js
export const PRICES = {
  provider: 'static',                   // Kurse aus src/data/prices.json
  staticFile: 'src/data/prices.json',
};
```

Erwartetes Format:

```json
{
  "asOf": "2026-08-11",
  "quotes": {
    "US67066G1040": { "price": 168.42, "currency": "USD", "factor": 1.031 }
  }
}
```

`factor` ist das Verhältnis zum Einstandswert im Snapshot. Wer echte Stückzahlen
statt Werte pflegt, ersetzt `revalue()` in `lib/prices.js` — vorgesehene Stelle,
etwa zehn Zeilen.

Anbietervergleich in [docs/QUELLEN.md](docs/QUELLEN.md). Für dein Depot mit
deutschen, US-, niederländischen, dänischen, britischen und kanadischen Werten
passt Marketstack oder EODHD am besten; die kostenlosen Stufen der US-lastigen
Anbieter decken die Deutsche Börse nicht ab.

### Signale aktivieren

Als Repository Secrets hinterlegen unter Settings → Secrets and variables →
Actions:

| Secret | Pflicht | Zweck |
|---|---|---|
| `SEC_USER_AGENT` | ja | Die SEC verlangt Name und Kontaktadresse, sonst gibt es 403 |
| `QUIVER_API_KEY` | nein | Kongressdaten; ohne Schlüssel wird der Abruf sauber übersprungen |

Dann einmal manuell auslösen: Actions → „Signale aktualisieren" → Run workflow.

### White-Label

Für einen neuen Mandanten reichen zwei Dateien:

1. `src/config.js` — `BRAND`, gegebenenfalls `CLUSTERS` und `RULES`
2. `src/styles.css` — der `:root`-Block ganz oben

Farben, Schrift, Maximalbreite und Akzent sind vollständig über CSS-Variablen
gesteuert. Es gibt keine hartkodierte Farbe außerhalb von `:root` und den
Cluster-Definitionen in `config.js`.

---

## Mehrbenutzerbetrieb

Die aktuelle Fassung ist eine Ein-Personen-Anwendung: Daten liegen als JSON im
Repo, Snapshots im lokalen Browserspeicher. Das reicht für dich und für eine
Demo beim Kunden.

Sobald mehrere Nutzer eigene Depots pflegen sollen, brauchst du:

- **Datenhaltung** — Supabase oder Cloudflare D1 sind für diesen Zuschnitt
  passend, beide mit brauchbarer kostenloser Stufe
- **Authentifizierung** — dann greift die DSGVO in vollem Umfang
- **Mandantentrennung** — auf Zeilenebene, nicht auf Anwendungsebene
- **Depot-Import** — Trade Republic hat keine offene Schnittstelle. Realistisch
  ist ein CSV-Import aus dem Steuerreport oder manuelle Pflege

`lib/store.js` ist die einzige Stelle, die dafür ausgetauscht werden muss. Die
Schnittstelle ist bewusst klein gehalten: `loadSnapshots`, `saveSnapshot`,
`clearSnapshots`, `exportSnapshots`.

---

## Offene Punkte

- [ ] Zeitgewichtete Rendite statt Kontostandsentwicklung — braucht alle Zahlungen mit Datum
- [ ] Directors' Dealings nach Art. 19 MAR anbinden (siehe QUELLEN.md)
- [ ] Was „Trump-Ticker" konkret meinen soll — drei mögliche Auslegungen in QUELLEN.md
- [ ] Währungsaufschlüsselung; der USD-Anteil im Depot ist hoch und derzeit nicht sichtbar
- [ ] Formaler Barrierefreiheitstest gegen WCAG 2.1 AA
- [ ] Shell-Position: Wert war im Screenshot abgeschnitten und ist aus dem Prozentanteil auf 1.410 € geschätzt
- [ ] ISINs in `portfolio.json` sind aus Kenntnis eingetragen und vor Kursabruf zu prüfen

---

## Haftungsausschluss

Dieses Projekt ist ein Darstellungswerkzeug, keine Anlageberatung. Es gibt keine
Kauf- oder Verkaufsempfehlungen ab und berücksichtigt keine persönlichen
Verhältnisse. Die MIT-Lizenz deckt den Quellcode ab, nicht die über die
Signalquellen bezogenen Inhalte Dritter.

Wer das Produkt gewerblich betreibt, prüft vorher die Punkte in
[docs/RECHTLICHES.md](docs/RECHTLICHES.md) mit einer Anwältin oder einem Anwalt
für Kapitalmarktrecht.
