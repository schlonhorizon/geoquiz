# GeoQuiz

GeoQuiz ist ein statisches Geografiequiz in Vanilla TypeScript und Vite. In „Finden“ klickst du das gesuchte Land auf der Weltkarte an. In „Benennen“ wählst du den Namen des hervorgehobenen Landes aus vier Antworten. [Spezifikation](docs/SPEC.md)

## Lokal starten

Node.js 24 und npm werden auch in GitHub Actions verwendet.

```sh
npm ci
npm run dev
npm test
npm run build
```

`npm run data` validiert die Quelldaten und erzeugt `public/data/`. Sowohl der Entwicklungsserver als auch der Produktionsbuild führen diesen Schritt beim Start aus. Vite kopiert die Ausgabe nach `dist/data/`.

## Daten pflegen

Jedes Set liegt unter `data/sets/<id>/`. `entities.csv` ist die Quelle für alle Entity-Werte. Die Datei nutzt UTF-8, Semikolons als Spaltentrenner und `|` für Listen und Aliasse. Leere Attributzellen werden als `null` ausgegeben. `set.json` definiert Attribute, Fragetexte und die Verknüpfung mit `map.topojson`.

Für ein neues Attribut genügen die CSV-Spalte und der Eintrag in `set.json`. Die Kartenspielfragen im Weltset stehen unter `map.prompts`. Der Platzhalter `{entity}` steht für den Ländernamen in „Finden“. Der Build nimmt neue Set-Ordner automatisch in `public/data/index.json` auf. Definition, Entities und Karte liegen danach unter `public/data/sets/<id>/`.

Das Set `world` enthält 193 UN-Mitglieder sowie Vatikanstadt, Palästina, Kosovo und Taiwan. Die Spielgeometrien stammen aus Natural Earth 50m. Das Objekt `land` enthält die grauen Gebiete außerhalb des Quiz. Belegung, Datenquellen, Lizenz und Kontinentzuordnungen stehen im [Validierungsreport](docs/world-data-report.md).

## GitHub Pages

In den Repository-Einstellungen unter **Pages → Build and deployment → Source** einmalig **GitHub Actions** auswählen. Der Workflow prüft Pull Requests und veröffentlicht nach einem erfolgreichen Build von `main` das Verzeichnis `dist/`. Auf `main` lässt er sich auch manuell starten. [Pages-Workflow](.github/workflows/pages.yml)
