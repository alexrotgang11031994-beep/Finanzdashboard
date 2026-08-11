# Rechtliche Rahmenbedingungen

> Dies ist keine Rechtsberatung. Ich bin kein Anwalt. Der Text fasst zusammen, was
> öffentlich zugänglich ist, damit du mit einer Anwältin oder einem Anwalt für
> Kapitalmarktrecht ein konkretes Gespräch führen kannst statt eines allgemeinen.
> Für ein Produkt, das du an Kunden verkaufst, ist dieses Gespräch nicht optional.

---

## Die eine Entscheidung, die alles andere bestimmt

Es gibt eine Weiche in diesem Produkt, und sie liegt in `src/config.js`:

```js
export const PERSONALIZED_ADVICE = false;
```

**Auf `false`** zeigt das Dashboard fremde Signale als das an, was sie sind:
Daten Dritter mit Quelle und Datum, ohne Bezug zum Depot des Nutzers.

**Auf `true`** würde es Sätze bauen wie „Weil du NVIDIA hältst, solltest du X".
Das ist ein anderer Rechtsvorgang.

### Warum das der Unterschied zwischen zwei Regimen ist

Die BaFin unterscheidet in ihrem Merkblatt zum Tatbestand der Anlageberatung klar:
Anlagestrategieempfehlungen nach Art. 3 Abs. 1 Nr. 34 MAR sind **keine**
Anlageberatung, weil die Informationen für Informationsverbreitungskanäle oder die
Öffentlichkeit bestimmt sind und einem unbestimmten Personenkreis zugänglich
gemacht werden. Sie richten sich gerade nicht nach den persönlichen Umständen
eines Kunden.

Sobald eine Empfehlung auf die konkreten Verhältnisse einer bestimmten Person
zugeschnitten ist, kippt die Einordnung Richtung Anlageberatung. Und die ist
erlaubnispflichtig, wenn sie gewerbsmäßig erbracht wird oder einen in
kaufmännischer Weise eingerichteten Geschäftsbetrieb erfordert — § 32 Abs. 1
Satz 1 KWG in Verbindung mit § 1 Abs. 1a Satz 1 KWG, beziehungsweise § 15 Abs. 1
WpIG. Gewerbsmäßigkeit setzt dabei nur voraus, dass der Betrieb auf gewisse Dauer
angelegt ist und mit Gewinnerzielungsabsicht gehandelt wird. Ob tatsächlich
Gewinn entsteht, spielt keine Rolle.

Übersetzt: Ein Abo-Produkt mit personalisierten Empfehlungen ist ohne BaFin-Erlaubnis
sehr wahrscheinlich nicht zulässig. Ein Informationsprodukt mit allgemeinen,
klar zugeordneten Fremdsignalen ist ein deutlich kleineres Vorhaben.

**Deshalb ist der Schalter auf `false` und deshalb sind die Ansichten
„Signale" und „Übersicht" im Code getrennt.** Sie teilen bewusst keinen Zustand.

---

## Auch ohne Personalisierung: die Anzeigepflicht

Das wird gern übersehen. Nach MAR gilt die Pflicht nicht nur für den, der
Empfehlungen **erstellt**, sondern auch für den, der sie **weitergibt**.

Institutsunabhängige Personen, die Anlagestrategie- und Anlageempfehlungen im
Sinne der MAR erstellen und/oder weitergeben, müssen die Pflichten aus der MAR
und der Delegierten Verordnung (EU) 2016/958 einhalten. Dazu gehört eine Anzeige
gegenüber der BaFin. Die BaFin führt darüber eine öffentliche Liste der
institutsunabhängigen Ersteller und Weitergeber.

Die Anzeige geht postalisch an die BaFin, Referat WA 47, Frankfurt, mit
Identitätsnachweis. Nach ordnungsgemäßer Anzeige darf die Tätigkeit aufgenommen
werden — es ist also eine Anzeige, keine Genehmigung. Änderungen sind binnen vier
Wochen nachzumelden, ebenso die Einstellung der Tätigkeit.

Wird die Anzeige nicht oder nicht ordnungsgemäß erstattet, drohen Bußgelder von
bis zu 50.000 Euro. Zusätzlich können Wettbewerber abmahnen.

**Praktische Folge für dich:** Ein aggregierter Signal-Feed ist ziemlich sicher
eine Weitergabe im Sinne der MAR. Rechne mit der Anzeigepflicht und plane sie ein,
statt sie zu entdecken.

### Ausnahmen, die vermutlich nicht greifen

Ausgenommen sind unter anderem Wertpapierdienstleistungsunternehmen,
Kapitalverwaltungsgesellschaften, angestellte Analystinnen und Analysten sowie
Journalistinnen und Journalisten, sofern diese einer gleichwertigen, angemessenen
Selbstregulierung unterliegen. Ein SaaS-Dashboard fällt in keine dieser Kategorien.

---

## Pflichten aus der Delegierten Verordnung 2016/958

Wenn die Weitergabe greift, kommen inhaltliche Anforderungen dazu. Die wichtigsten
in Stichworten — die Verordnung selbst ist kurz und lesbar:

| Pflicht | Umsetzung im Code |
|---|---|
| Identität des Erstellers nennen | Feld `source` je Eintrag, Anzeige in `views/signals.js` |
| Empfehlung objektiv darstellen | Kein Umformulieren, kein Ranking, keine „Top-Pick"-Logik |
| Datum und Uhrzeit der Erstellung | Feld `date`, plus `generatedAt` im Datensatz |
| Interessenkonflikte offenlegen | `BRAND.operator` im Fuß; eigene Positionen offenlegen, falls vorhanden |
| Tatsachen von Auslegung trennen | Signale und Depotanalyse liegen in getrennten Ansichten |
| Aufzeichnungspflicht | Jeder Lauf committet `signals.json` — Git ist dein Archiv |

Der letzte Punkt ist ein angenehmer Nebeneffekt der Architektur: Weil der Workflow
jeden Tag committet, hast du eine lückenlose, zeitgestempelte Historie dessen,
was du wann angezeigt hast. Das ist bei einer Nachfrage der Aufsicht mehr wert,
als es jetzt klingt.

---

## Wenn du das Produkt an Kunden ausrollst

Zusätzlich zu prüfen, weil es nichts mit Kapitalmarktrecht zu tun hat und
trotzdem teuer werden kann:

- **DSGVO.** Depotdaten sind besonders sensibel. Verzeichnis von
  Verarbeitungstätigkeiten, Auftragsverarbeitungsverträge, Rechtsgrundlage,
  Löschkonzept. Bei mehreren Mandanten außerdem Mandantentrennung.
- **Impressumspflicht** nach § 5 DDG.
- **Fernabsatz und Widerrufsrecht**, sobald es ein Abo für Verbraucher gibt.
- **AGB mit Haftungsbegrenzung.** Ohne eine saubere Klausel zur Datenqualität
  bist du das Ausfallrisiko deiner Datenlieferanten.
- **Barrierefreiheitsstärkungsgesetz.** Seit Juni 2025 gilt es für viele
  digitale Dienstleistungen im B2C. Das Dashboard ist mit Tastaturfokus,
  Kontrastverhältnissen und `prefers-reduced-motion` vorbereitet, aber ein
  formaler Test steht aus.

---

## Kurzfassung in vier Sätzen

1. Allgemeine Fremdsignale mit Quellenangabe: Anzeigepflicht bei der BaFin,
   plus die Darstellungspflichten aus der Delegierten Verordnung.
2. Personalisierte Empfehlungen zum Depot des Nutzers: wahrscheinlich
   erlaubnispflichtige Anlageberatung. Anderes Vorhaben, andere Größenordnung.
3. Fremde redaktionelle Inhalte nur als Überschrift plus Link, niemals im Volltext.
4. Bevor Geld fließt, einmal zwei Stunden Fachanwalt bezahlen. Das ist der
   günstigste Posten in der ganzen Kalkulation.
