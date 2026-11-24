# Validierungsreport für das Weltset

`npm run data` meldet **197 Spielentitäten, 197 zugeordnete Geometrien, 0 Fehler und 0 Warnungen**. Das Set enthält alle 193 UN-Mitglieder sowie Vatikanstadt, Palästina, Kosovo und Taiwan. Die vier zusätzlichen Einträge haben `un_member=false`. Für Kosovo verwendet das Quiz `XKX` als benutzerdefinierten Alpha-3-Code. Die Quelle führt es als `UNK`. [UN-Mitgliedstaaten](https://www.un.org/en/about-us/member-states) · [UN-Beobachterstaaten](https://www.un.org/en/about-us/non-member-states)

| Feld | Befüllte Zeilen |
|---|---:|
| `id`, `name`, `continent`, `un_member` | je 197/197 |
| `name_aliases` | 190/197 |
| `capital` | 188/197 |
| `capital_aliases` | 47/197 |
| `neighbors` | 157/197 |
| `seas`, `capital_lat`, `capital_lon`, `memberships`, `currency`, `central_bank`, `stock_index`, `regime_type` | je 0/197 |

- Ländernamen, Namensvarianten und Hauptstädte stammen aus `world-countries` 5.1.0. Geläufige deutsche Schreibweisen wurden ergänzt. Neun Hauptstädte bleiben wegen eines veralteten, strittigen oder uneindeutigen Eintrags offen: Äquatorialguinea, Eswatini, Indonesien, Israel, Jemen, Nauru, Palästina, Sri Lanka und Sudan. Für Äquatorialguinea führt die Paketversion beispielsweise noch Malabo. [world-countries 5.1.0](https://www.npmjs.com/package/world-countries/v/5.1.0) · [Dekret zur Hauptstadt Äquatorialguineas](https://www.guineaecuatorialpress.com/noticias/decreto_ley_por_el_que_se_declara_la_ciudad_de_la_paz_djibloho_capital_de_la_republica_de_guinea_ecuatorial)
- Nachbarschaften sind beidseitig bestätigte Landgrenzen aus `borders` zwischen Spielentitäten. Verweise auf Französisch-Guayana, Gibraltar, Hongkong, Macau und Westsahara entfallen. Der einseitige Eintrag von Sri Lanka zu Indien entfällt ebenfalls. `world-countries` unterscheidet Binnenstaaten, liefert aber keine Meeresnamen. Leere `seas`-Felder stehen deshalb für fehlende Meeresangaben. [Feldbeschreibung von world-countries](https://github.com/mledoze/countries)
- Natural Earth 5.1.2 liefert die Geometrien des 50m-Datensatzes `Admin 0 – Countries`. `ADM0_A3` ersetzt bei Frankreich und Norwegen den Platzhalter `ISO_A3=-99`. Die Natural-Earth-ID `KOS` ist `XKX` zugeordnet. Beim Build verschmilzt Somaliland (`SOL`) für das Quiz mit Somalia (`SOM`) und Nordzypern (`CYN`) mit Zypern (`CYP`). Klicks auf diese Flächen zählen entsprechend als Somalia oder Zypern. 42 Gebiete, darunter Westsahara und Grönland, liegen im grauen Hintergrundobjekt `land`. [Natural Earth 5.1.2](https://github.com/nvkelso/natural-earth-vector/blob/v5.1.2/geojson/ne_50m_admin_0_countries.geojson) · [Natural Earth Nutzungsbedingungen](https://www.naturalearthdata.com/about/terms-of-use/)
- Die Zuordnungen stehen in `map.mergeLand` in `set.json`. „Abhängige Gebiete“ könnten später als optionale Quiz-Einstellung hinzukommen.

Die aus `world-countries` abgeleiteten Länderdaten in `entities.csv` stehen unter ODbL 1.0. [Lizenz von world-countries](https://github.com/mledoze/countries/blob/master/LICENSE) · [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/)

## Kontinentzuordnungen zur Prüfung

Das Quiz verwendet pro Entität die Region aus `world-countries`. Für Amerika unterscheidet es die Subregion Südamerika und fasst Mittelamerika und die Karibik mit Nordamerika zusammen. Daraus ergeben sich 54 Länder in Afrika, 48 in Asien, 46 in Europa, 23 in Nordamerika, 14 in Ozeanien und 12 in Südamerika. Die Liste berücksichtigt Festland, vorgelagerte Inseln und getrennte Überseegebiete außerhalb der Antarktis. [world-countries](https://github.com/mledoze/countries) · [Übersicht zu transkontinentalen Ländern](https://worldpopulationreview.com/country-rankings/transcontinental-countries)

| Land | Im Quiz | Zweiter Kontinent oder geografische Abgrenzung |
|---|---|---|
| Ägypten | Afrika | Sinai liegt in Asien. |
| Russland | Europa | Sibirien und der Ferne Osten liegen in Asien. |
| Türkei | Asien | Ostthrakien liegt in Europa. |
| Kasachstan | Asien | Das Gebiet westlich des Uralflusses wird Europa zugerechnet. |
| Aserbaidschan | Asien | Bei der Wasserscheide des Großen Kaukasus als Grenze liegen Teile nördlich davon in Europa. |
| Georgien | Asien | Bei derselben Grenzziehung liegen Teile nördlich der Wasserscheide in Europa. |
| Griechenland | Europa | Einige Inseln der östlichen Ägäis können nach ihrer Lage an der anatolischen Küste Asien zugerechnet werden. |
| Spanien | Europa | Ceuta, Melilla und die Kanaren liegen in Afrika. |
| Portugal | Europa | Madeira wird geografisch Afrika zugerechnet. |
| Italien | Europa | Lampedusa und Lampione liegen auf dem afrikanischen Kontinentalschelf. |
| Frankreich | Europa | Überseegebiete liegen unter anderem in Nord- und Südamerika, Afrika und Ozeanien. |
| Dänemark | Europa | Grönland ist Teil des Königreichs und liegt in Nordamerika. |
| Niederlande | Europa | Die Karibischen Niederlande gehören geografisch zur Karibik und im Quiz zur Region Nordamerika. |
| Vereinigtes Königreich | Europa | Überseegebiete liegen unter anderem in Amerika, Afrika und Ozeanien. Die souveränen Stützpunktgebiete auf Zypern können geografisch zu Asien gerechnet werden. |
| Vereinigte Staaten | Nordamerika | Hawaii liegt in Ozeanien. |
| Kolumbien | Südamerika | San Andrés und Providencia liegen in der Karibik vor Mittelamerika. |
| Venezuela | Südamerika | Die Isla de Aves wird der nordamerikanischen Karibik zugerechnet. |
| Chile | Südamerika | Rapa Nui und Sala y Gómez gehören geografisch zu Polynesien. |
| Jemen | Asien | Sokotra liegt vor dem Horn von Afrika und kann geografisch Afrika zugerechnet werden. |
| Indonesien | Asien | Westneuguinea gehört geografisch zu Ozeanien. |
| Australien | Ozeanien | Die Weihnachtsinsel und die Kokosinseln können geografisch Asien zugerechnet werden. |
| Japan | Asien | Abgelegene pazifische Inseln wie Minamitorishima werden teils Ozeanien zugerechnet. |

Weitere Grenzfälle mit je einer Zuordnung im Quiz

- **Armenien → Asien.** Es liegt südlich des Großen Kaukasus. **Zypern → Europa.** Das folgt der Paketregion. Die geografische Zuordnung zu Westasien ist ebenfalls gebräuchlich.
- **Panama → Nordamerika.** Die Staatsgrenze zu Kolumbien ist hier die Grenze zwischen den Kontinenten. **Trinidad und Tobago → Nordamerika.** Die Karibikzuordnung gilt im Quiz auch für Inseln am südamerikanischen Kontinentalschelf.
- **Ecuador → Südamerika.** Das schließt die Galápagosinseln ein. **Timor-Leste → Asien.** Das folgt der Einordnung in Südostasien. **Island → Europa.** Die Zugehörigkeit zu verschiedenen tektonischen Platten ändert hier den Quiz-Kontinent nicht.
- Antarktische Gebietsansprüche zählen für diese Liste nicht zur Kontinentzuordnung. [Antarktisvertrag](https://www.ats.aq/e/antarctictreaty.html)
