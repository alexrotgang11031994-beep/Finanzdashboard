# Signalquellen — Status, Frische, Lizenz

Bewertung mit Stand August 2026. Konditionen ändern sich; vor produktivem Einsatz
jede Quelle selbst nachprüfen.

Drei Kategorien:

- **amtlich** — Behördendaten, gemeinfrei, kommerziell unbedenklich
- **lizenzpflichtig** — kostenpflichtige API mit Nutzungsvertrag
- **nur Verlinkung** — urheberrechtlich geschützt, Überschrift und Link erlaubt, Volltext nicht

---

## Die von dir gewünschten Quellen

### Nancy-Pelosi-Ticker (US-Kongress)

**Was es wirklich ist:** Der STOCK Act verpflichtet Senatorinnen und Abgeordnete,
Wertpapiergeschäfte innerhalb von **45 Tagen** offenzulegen. Die Rohdaten liegen
bei `disclosures.house.gov` und `efdsearch.senate.gov` — gemeinfrei, aber als
teils gescannte PDFs. Deshalb existieren die Aufbereiter.

**Die 45 Tage sind der Kern der Sache.** Wenn du das Signal siehst, ist das
Geschäft bis zu anderthalb Monate alt. Als tägliches Handelssignal ist das
strukturell ungeeignet. Als Beobachtung von Mustern über Zeit hat es Wert.

Anbieter:

| Anbieter | Zugang | Kosten | Anmerkung |
|---|---|---|---|
| Quiver Quantitative | dokumentierte JSON-API | ab ~25 $/Monat | Kostenlose Stufe nur verzögert und mit wenig Historie. Liefert Kongress, Insider, Lobbying, Regierungsaufträge aus einer Hand. Im Code vorbereitet. |
| Capitol Trades | Weboberfläche | kostenlos | Saubere Darstellung, aber keine offene API für kommerzielle Weiterverwendung. |
| Unusual Whales | Plattform | Abo | Kongress plus Optionsflüsse. Programmzugriff eingeschränkt. |
| House Stock Watcher | — | — | **Tot.** Der S3-Bucket liefert seit Anfang 2026 HTTP 403, das GitHub-Repo wird seit Mitte 2025 nicht mehr gepflegt. Nicht darauf aufbauen. |

Es gibt inzwischen auch ETFs, die Kongressgeschäfte nachbilden (NANC für
demokratische, KRUZ für republikanische Meldungen). Für dein Dashboard relevant
als Vergleichsmaßstab: Wenn ein fertiger ETF die Strategie abbildet, lässt sich
prüfen, ob sie überhaupt trägt.

### Trump-Ticker

Der Begriff ist mehrdeutig, und die Mehrdeutigkeit ist ein Produktproblem. Er
kann bedeuten:

1. Meldepflichtige Geschäfte der Familie oder verbundener Vehikel — dann läuft
   das über SEC Form 4 und Form 13D/G und ist amtlich verfügbar.
2. Kursbewegungen der DJT-Aktie selbst — normale Kursdaten.
3. Marktreaktionen auf Aussagen und Zolldrohungen — das ist Nachrichtenauswertung,
   keine Meldedatenquelle, und stark auslegungsabhängig.

**Sag mir, welche der drei du meinst**, dann baue ich den passenden Abruf. Ich
habe bewusst keine Variante geraten, weil sich die drei technisch und rechtlich
völlig unterschiedlich verhalten.

### Der Aktionär

Urheberrechtlich geschützte redaktionelle Inhalte. In einem kommerziellen Produkt
gilt: **Überschrift und Link, sonst nichts.** Kein Volltext, keine
Zusammenfassung, die den Artikel ersetzt, keine Übernahme der Kursziele als
eigene Aussage.

Der Abruf in `scripts/fetch-signals.mjs` setzt bewusst kein `summary`-Feld für
Presse-Feeds. Das ist kein Versehen, sondern die Grenze.

Wer mehr will, braucht eine Content-Lizenz vom Verlag. Bei einem Bezahlprodukt
ist das der saubere Weg, und Verlage verhandeln darüber.

### Große Häuser (Goldman Sachs, Morgan Stanley, BlackRock)

Hier ist die Trennlinie scharf:

- **Öffentliche Marktkommentare, Blogs, Ausblicke** — verlinkbar wie jede
  andere Publikation.
- **Analystenreports mit Kurszielen** — streng lizenziert, laufen über Bloomberg,
  Refinitiv, S&P Capital IQ. Weiterverbreitung ohne Vertrag ist eine
  Vertragsverletzung und potenziell teuer.

Die aggregierten Konsensschätzungen, die man auf Finanzportalen sieht, sind
selbst lizenzierte Daten. Wenn du Kursziele anzeigen willst, brauchst du einen
Datenvertrag — Financial Modeling Prep und Finnhub bieten das zu
Startup-tauglichen Preisen an.

---

## Meine drei zusätzlichen Empfehlungen

Ich habe nach drei Kriterien ausgewählt: rechtlich sauber, frischer als 45 Tage,
und für **dein** Depot tatsächlich relevant.

### 1. SEC Form 4 — US-Insidergeschäfte

**Warum besser als der Kongress-Ticker:** Meldefrist **zwei Handelstage** statt
45. Und es sind Menschen, die das Unternehmen von innen kennen, nicht Menschen,
die Gesetze darüber machen.

Amtlich, gemeinfrei, kostenlos über die EDGAR-Schnittstelle. Die SEC verlangt
lediglich einen aussagekräftigen User-Agent mit Kontaktadresse und begrenzt auf
etwa zehn Anfragen pro Sekunde. Beides ist im Skript berücksichtigt.

Deckt bei dir ab: NVIDIA, Broadcom, Palantir, Marvell, Intel, Micron, AMD,
Amazon, Alphabet, Microsoft, Tesla, Intuitive Surgical, Caterpillar.

Nebenbei: Der Hinweis, dass Insider bei NVIDIA, Palantir und Broadcom binnen
zwölf Monaten Aktien für rund 4,6 Mrd Dollar verkauft haben, stammt aus genau
dieser Quelle. Das ist die Art Signal, die man selbst sehen will.

**Status: aktiv im Code.**

### 2. Directors' Dealings nach Art. 19 MAR — europäische Insider

Das europäische Gegenstück. Führungskräfte börsennotierter EU-Unternehmen müssen
Eigengeschäfte binnen drei Geschäftstagen melden; die Veröffentlichung läuft über
EQS/DGAP und den Bundesanzeiger.

**Für dich besonders relevant, weil dein Depot stark europäisch ist:**
Rheinmetall (5.351 €), Allianz (2.690 €), SAP, Deutsche Telekom, Siemens,
Siemens Energy, Münchener Rück, RWE, Infineon, Bayer, Deutsche Post.

Diese Werte tauchen in keinem einzigen US-Tracker auf. Genau hier hat dein
Produkt einen Vorteil gegenüber den amerikanischen Angeboten — kaum jemand
bedient den deutschsprachigen Markt mit dieser Kombination.

Kostenlos, amtlich. Der Abruf ist noch nicht implementiert, weil die
Veröffentlichungswege heterogen sind; EQS bietet einen kommerziellen Feed an.

### 3. 13F-Filings — institutionelle Positionierung

Vermögensverwalter ab 100 Mio Dollar müssen ihre US-Aktienbestände quartalsweise
offenlegen, 45 Tage nach Quartalsende.

**Langsam, aber ehrlich:** zeigt, was große Häuser *getan* haben, nicht was sie
in Interviews sagen. Als Bestätigung oder Widerspruch zu einer eigenen These
nützlich, als Auslöser zu träge.

Kostenlos über EDGAR. Nützlich sind vor allem die Veränderungen zum Vorquartal,
nicht die Bestände selbst.

### Wenn du eine vierte willst

**ETF-Mittelzuflüsse.** Zeigt in Tagesfrequenz, wohin Geld tatsächlich fließt —
ohne Meinung, ohne Nachlauf. Anbieter unter anderem via justETF und den
Emittenten selbst. Das ist die frischeste der hier genannten Datenarten.

---

## Kursdaten

Kein Signal, aber Voraussetzung dafür, dass „Entwicklung" mehr zeigt als Snapshots.

| Anbieter | Kostenlose Stufe | Deutsche Börse | Bewertung für dich |
|---|---|---|---|
| Marketstack | ja, EOD | ja | **Beste Abdeckung außeramerikanischer Börsen**, bezahlt ab rund 10 $/Monat. Für dein Depot der passendste. |
| EODHD | begrenzt | ja | Starke globale Historie, gutes Preis-Leistungs-Verhältnis. |
| Twelve Data | 800 Anfragen/Tag | eingeschränkt | Kostenlose Stufe primär US, Devisen, Krypto. |
| Finnhub | 60 Anfragen/Minute | nur bezahlt | Gute Nachrichten und Termine, internationale Kurse kosten. |
| Alpha Vantage | 25 Anfragen/Tag | begrenzt | Zu wenig für 54 Positionen. |
| Tiingo | 1.000 Anfragen/Tag | begrenzt | Saubere Tagesschlusskurse, US-lastig. |

**Deine Lage:** 54 Positionen an deutschen, US-, niederländischen, dänischen,
britischen und kanadischen Börsen. Die kostenlosen Stufen decken das nicht ab.
Rechne mit 10 bis 30 Dollar im Monat, sobald es ernst wird.

**Architekturhinweis:** Kurse gehören serverseitig geholt. Ein API-Schlüssel im
Frontend ist öffentlich lesbar, egal wie er versteckt wird. `PRICES.provider`
auf `'static'` setzen und den Abruf wie bei den Signalen in einen Workflow legen.

---

## Was ich beim Bauen bewusst nicht gemacht habe

**Keine Beispiel-Signale.** Die Signalansicht bleibt leer, bis echte Daten da
sind. Platzhalter-Empfehlungen in einem Finanzprodukt sind der gefährlichste
Blindtext, den es gibt — sie sehen aus wie eine Aussage und sind keine.

**Keine erfundene Wertentwicklung.** Aus den Screenshots geht ein einziger
Zeitpunkt hervor. Die Ansicht „Entwicklung" sagt das und beginnt ab dem zweiten
gespeicherten Stand mit echten Datenpunkten.

**Kein Scoring über die Quellen hinweg.** Ein zusammengerechneter „Signal-Score"
aus Kongressdaten, Insidermeldungen und Presseüberschriften wäre die
verkaufsstärkste Funktion des Dashboards und zugleich die unehrlichste. Ich habe
keine belastbare Grundlage für die Gewichte, und geratene Gewichte in einer Zahl
zu verstecken, macht sie nicht besser. Wenn du das willst, sollte es auf einer
Auswertung beruhen, die man zeigen kann.
