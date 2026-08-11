# Auf GitHub hochladen

Das Repo ist lokal bereits initialisiert: Branch `main`, ein Commit mit
27 versionierten Dateien. Es fehlt nur noch die Verbindung zu GitHub.

---

## Schritt 1 — Leeres Repo auf GitHub anlegen

Öffne **https://github.com/new** und trage ein:

| Feld | Wert |
|---|---|
| Repository name | `Investmentstratege` |
| Description | Portfolio, Sparpläne und Signalquellen in einer Ansicht |
| Sichtbarkeit | **Private** |
| Add a README file | **nicht** ankreuzen |
| .gitignore / License | **keine** auswählen |

Die drei letzten Punkte sind wichtig: Wird dort etwas angelegt, kollidiert es
mit dem vorhandenen Commit und der Push wird abgelehnt.

**Zur Sichtbarkeit:** In `src/data/portfolio.json` stehen deine 54 echten
Positionen mit Werten. Bei einem öffentlichen Repo ist das für jeden lesbar und
über die GitHub-Suche auffindbar. Nimm **Private**, solange du keine
Demodaten eingesetzt hast.

---

## Schritt 2 — Hochladen

Im entpackten Ordner ausführen, `DEIN-NAME` ersetzen:

```bash
cd investmentstratege
git remote add origin https://github.com/DEIN-NAME/Investmentstratege.git
git push -u origin main
```

Falls du SSH-Schlüssel eingerichtet hast, stattdessen:

```bash
git remote add origin git@github.com:DEIN-NAME/Investmentstratege.git
git push -u origin main
```

Der Commit-Autor steht auf einem Platzhalter. Vor dem Push korrigieren:

```bash
git config user.name  "Dein Name"
git config user.email "deine@mail.de"
git commit --amend --reset-author --no-edit
```

---

## Schritt 3 — Als Website veröffentlichen

Im Repo auf GitHub: **Settings → Pages → Source: „GitHub Actions"**.

Der mitgelieferte Workflow `deploy.yml` läuft dann bei jedem Push auf `main`.
Nach etwa einer Minute liegt die Seite unter
`https://DEIN-NAME.github.io/Investmentstratege/`.

**Achtung bei privaten Repos:** GitHub Pages ist dort nur in bezahlten Tarifen
verfügbar. Zwei Alternativen ohne Zusatzkosten:

- **Cloudflare Pages** — verbindet sich mit dem privaten Repo, Zugriffsschutz
  über Cloudflare Access in der kostenlosen Stufe enthalten
- **Netlify** — dasselbe Prinzip, Passwortschutz je nach Tarif

---

## Schritt 4 — Signale scharfschalten

Unter **Settings → Secrets and variables → Actions → New repository secret**:

| Name | Wert | Pflicht |
|---|---|---|
| `SEC_USER_AGENT` | `Investmentstratege deine@mail.de` | ja, sonst antwortet die SEC mit 403 |
| `QUIVER_API_KEY` | dein Schlüssel | nein, ohne wird der Abruf übersprungen |

Dann **Actions → „Signale aktualisieren" → Run workflow** einmal von Hand
auslösen. Danach läuft es werktags um 06:15 UTC von allein.

---

## Wenn etwas klemmt

| Meldung | Ursache | Lösung |
|---|---|---|
| `remote origin already exists` | Remote schon gesetzt | `git remote set-url origin <URL>` |
| `Updates were rejected` | Auf GitHub wurde doch eine README angelegt | `git pull --rebase origin main`, dann erneut pushen |
| `Permission denied (publickey)` | SSH-Schlüssel fehlt | HTTPS-Variante nehmen |
| Pages zeigt 404 | Source steht nicht auf „GitHub Actions" | Settings → Pages umstellen |
| Seite lädt, bleibt aber leer | `index.html` per Doppelklick geöffnet | Über `http://` aufrufen, ES-Module laufen nicht über `file://` |
