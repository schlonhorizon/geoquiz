# Validierungsreport für das Weltset

`npm run data` meldet **197 Spielentitäten, 197 zugeordnete Geometrien, 0 Fehler und 0 Warnungen**. Das Set enthält alle 193 UN-Mitglieder sowie Vatikanstadt, Palästina, Kosovo und Taiwan. Die vier zusätzlichen Einträge haben `un_member=false`. Für Kosovo verwendet das Quiz `XKX` als benutzerdefinierten Alpha-3-Code. Die Quelle führt es als `UNK`. [UN-Mitgliedstaaten](https://www.un.org/en/about-us/member-states) · [UN-Beobachterstaaten](https://www.un.org/en/about-us/non-member-states)

| Feld | Befüllte Zeilen |
|---|---:|
| `id`, `name`, `continent`, `un_member` | je 197/197 |
| `name_aliases` | 190/197 |
| `capital` | 194/197 |
| `capital_aliases` | 52/197 |
| `capital_note` | 16/197 |
| `capital_lat`, `capital_lon` | je 194/197 |
| `continent_alt` | 7/197 |
| `continent_note` | 29/197 |
| `flag`, `color` | je 197/197 |
| `neighbors` | 157/197 |
| `currency` | 196/197 |
| `currency_alt` | 1/197 |
| `central_bank` | 185/197 |
| `central_bank_note` | 21/197 |
| `stock_index` | 134/197 |
| `stock_index_status` | 63/197 |
| `regime_type` | 173/197 |
| `government_form` | 197/197 |
| `government_form_note` | 27/197 |
| `seas`, `memberships` | je 0/197 |

- Ländernamen, Namensvarianten und die ursprünglichen Hauptstadtwerte stammen aus `world-countries` 5.1.0. Geläufige deutsche Schreibweisen wurden ergänzt. Die Korrekturen stehen unten. [world-countries 5.1.0](https://www.npmjs.com/package/world-countries/v/5.1.0)
- Nachbarschaften sind beidseitig bestätigte Landgrenzen aus `borders` zwischen Spielentitäten. Verweise auf Französisch-Guayana, Gibraltar, Hongkong, Macau und Westsahara entfallen. Der einseitige Eintrag von Sri Lanka zu Indien entfällt ebenfalls. `world-countries` unterscheidet Binnenstaaten, liefert aber keine Meeresnamen. Leere `seas`-Felder stehen deshalb für fehlende Meeresangaben. [Feldbeschreibung von world-countries](https://github.com/mledoze/countries)
- Die Grundgeometrien stammen aus Natural Earth 5.1.2 `Admin 0 – Countries` (1:50 Mio.). Sechs Landesflächen verwenden die detailreichere Version (1:10 Mio.). `ADM0_A3` ersetzt bei Frankreich und Norwegen den Platzhalter `ISO_A3=-99`. Die Natural-Earth-ID `KOS` ist `XKX` zugeordnet. Beim Build verschmilzt Somaliland (`SOL`) für das Quiz mit Somalia (`SOM`) und Nordzypern (`CYN`) mit Zypern (`CYP`). Klicks auf diese Flächen zählen entsprechend als Somalia oder Zypern. 42 Gebiete, darunter Westsahara und Grönland, liegen im grauen Hintergrundobjekt `land`. [Natural Earth 5.1.2](https://github.com/nvkelso/natural-earth-vector/blob/v5.1.2/geojson/ne_50m_admin_0_countries.geojson) · [Natural Earth Nutzungsbedingungen](https://www.naturalearthdata.com/about/terms-of-use/)
- Die Zuordnungen stehen in `map.mergeLand` in `set.json`. „Abhängige Gebiete“ könnten später als optionale Quiz-Einstellung hinzukommen.

Die aus `world-countries` abgeleiteten Länderdaten in `entities.csv` stehen unter ODbL 1.0. [Lizenz von world-countries](https://github.com/mledoze/countries/blob/master/LICENSE) · [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/)

## Kartendetails

Beide Auflösungen enthalten 197 Spielentitäten und verwenden dieselben Länder-IDs. Die 1:10-Mio.-Ebene übernimmt Finnland und Åland aus den Natural-Earth-Karteneinheiten, damit Åland als eigenständiges Hintergrundgebiet gezeichnet wird. Tuvalu behält seine Übersichtskontur, da der Hauptstadtpunkt in der originalen 1:10-Mio.-Geometrie im Wasser läge. Bei Gambia bleibt die Detailküste um Banjul vollständig erhalten. Der Build prüft in beiden Ebenen die Lage aller 194 Hauptstadtpunkte. [1:10-Mio.-Länder](https://github.com/nvkelso/natural-earth-vector/blob/v5.1.2/geojson/ne_10m_admin_0_countries.geojson) · [1:10-Mio.-Karteneinheiten](https://github.com/nvkelso/natural-earth-vector/blob/v5.1.2/geojson/ne_10m_admin_0_map_units.geojson)

Die Gewässer kommen aus Natural Earth 5.1.2. Die Übersicht nutzt die Seen bis Natural-Earth-Zoomstufe 3 und die Flussränge bis 4. Die Detailstufe übernimmt Seen ab 0,01 km². Kleinere Flächen sind in der TopoJSON-Auflösung kaum darstellbar. Flüsse der Ränge über 6 stehen als eigene Ebene für höheren Zoom bereit. [Natural Earth 5.1.2](https://github.com/nvkelso/natural-earth-vector/tree/v5.1.2/geojson)

Die Nachbearbeitung der Detailkarte mit Mapshaper behält 50 % der vereinfachbaren Punkte. Wenn dabei ein Hauptstadtpunkt außerhalb seiner Fläche landet oder sich ein kleiner Ring umkehrt, übernimmt der Export für diese Geometrie den zuvor validierten Ring. Die reguläre Datenvalidierung prüft das fertige Ergebnis. [Mapshaper](https://github.com/mbloch/mapshaper)

## Kerngebiete

Der Build schließt **101 Teilflächen in 15 Ländern** aus dem Kerngebiet aus. Automatisch entfallen Teilflächen, deren kürzester geografischer Abstand zum äußeren Rand der größten Teilfläche über 1.500 km liegt und deren Fläche unter 20 % der größten Teilfläche beträgt. Die vollständigen Landesflächen bleiben auf der Karte sichtbar und anklickbar.

| Land | ID | Ausgeschlossene Teilflächen |
|---|---|---:|
| Australien | AUS | 1 |
| Chile | CHL | 1 |
| Ecuador | ECU | 6 |
| Frankreich | FRA | 7 |
| Indien | IND | 4 |
| Indonesien | IDN | 19 |
| Kiribati | KIR | 10 |
| Kolumbien | COL | 2 |
| Neuseeland | NZL | 2 |
| Niederlande | NLD | 3 |
| Norwegen | NOR | 10 |
| Portugal | PRT | 5 |
| Spanien | ESP | 7 |
| Südafrika | ZAF | 1 |
| Vereinigte Staaten | USA | 23 |

`outline.exclude` entfernt die Galápagosinseln, die Kanarischen Inseln, Svalbard einschließlich Spitzbergen und Jan Mayen sowie San Andrés und Providencia. Für San Andrés und Providencia ergänzt die Weltkarte die beiden Polygone aus Natural Earth 1:10 Mio. [Natural Earth Admin 0, 1:10 Mio.](https://github.com/nvkelso/natural-earth-vector/blob/v5.1.2/geojson/ne_10m_admin_0_countries.geojson)

Bei Kiribati behält `outline.include` die Gilbertinseln um Süd-Tarawa im Kerngebiet. `outline.exclude` entfernt zusätzlich Teilflächen im zentralen Pazifik, die die automatische Auswahl um Kiritimati behalten hätte. Alaskas Festland bleibt nach der automatischen Regel enthalten. `outline.include` erhält weitere 37 Teilflächen Alaskas, darunter Kodiak. Die 16 in der Geometrie enthaltenen Aleuten-Teilflächen westlich von 170° W stehen in `outline.exclude`. Zusammen mit Hawaiis sieben Polygonen ergeben sie 23 ausgeschlossene Teilflächen für die USA. Alle 194 Hauptstadtpunkte liegen im jeweiligen Kerngebiet.

## Hauptstadt-Korrekturen

Stand der Korrekturen ist der 25. November 2026. In sechs zuvor offenen Fällen steht ein verifizierter Hauptwert in `capital`. Drei weitere Fälle sind im Atlas über `capital_note` erläutert.

| Land | Quizwert und Hinweis | Quelle |
|---|---|---|
| Äquatorialguinea | Ciudad de la Paz. Das Dekret vom 2. Januar 2026 löst Malabo ab. | [Regierungsdekret](https://www.guineaecuatorialpress.com/index.php/noticias/decreto_ley_por_el_que_se_declara_la_ciudad_de_la_paz_djibloho_capital_de_la_republica_de_guinea_ecuatorial) |
| Eswatini | Mbabane als Verwaltungshauptstadt. Lobamba zählt als Sitz von Parlament und Monarchie ebenfalls. | [Afrikanische Union](https://au.int/en/cities/lobambaroyal-and-legislative-mbabane-administrative) |
| Indonesien | Jakarta. Der Wechsel nach Nusantara erfordert einen Präsidialerlass. | [Indonesisches Verfassungsgericht, Mai 2026](https://en.mkri.id/news/details/2026-05-12/Capital_Relocation_Depends_on_Issuance_of_Presidential_Decree) · [Stand des Verfahrens, Oktober 2026](https://en.mkri.id/news/details/2026-10-29/Court_Declares_IKN_Law_Petition_Inadmissible) |
| Jemen | Sanaa als verfassungsmäßige Hauptstadt. Aden zählt als vorläufige Hauptstadt der international anerkannten Regierung ebenfalls. | [Ständige Vertretung bei den Vereinten Nationen](https://www.un.int/yemen/about) |
| Sri Lanka | Sri Jayewardenepura Kotte als Verwaltungshauptstadt und Parlamentssitz. Das Quiz akzeptiert geläufige Schreibvarianten einschließlich Kotte. Colombo wird im Hinweis als Wirtschaftszentrum eingeordnet. | [Botschaft Sri Lankas](https://www.emb-seoul.gov.lk/en/srilanka-at-glance) · [Parlament Sri Lankas](https://www.parliament.lk/files/pdf/parliament-booklet-v2019.pdf) |
| Sudan | Khartum. Die Regierung meldete im Januar 2026 ihre Rückkehr aus Port Sudan. | [Qatar News Agency zur Regierungsankündigung](https://qna.org.qa/en/news/news-details?date=12%2F01%2F2026&id=sudans-government-officially-returns-to-khartoum-after-25-years) |
| Israel und Palästina | Der Quizwert ist leer. Die Atlas-Hinweise erläutern Jerusalem, Ost-Jerusalem und den Verwaltungssitz der Palästinensischen Autonomiebehörde in Ramallah. | [Vereinte Nationen zum Status Jerusalems](https://www.un.org/unispal/permanent-status-issues/) · [Palästinensisches Außenministerium](https://www.mfae.gov.ps/en-us/fundamentalissues/jerusalem) · [UN-Bericht zu Ramallah](https://palestine.un.org/sites/default/files/2021-11/sdg_11_report_english.pdf) |
| Nauru | Der Quizwert ist leer. Die Regierung sitzt im Distrikt Yaren. | [UNCTAD](https://dgff2021.unctad.org/nauru/index.html) |

Südafrika und Bolivien akzeptieren ihre weiteren Hauptstadt- oder Regierungsstandorte beim Tippen. Die Hinweise für die Schweiz, Benin, die Elfenbeinküste, Malaysia und die Niederlande erklären Bundesstadt, Regierungssitz oder frühere Hauptstadt. [Südafrikanische Regierung](https://www.gov.za/south-africa-glance) · [Bolivianischer Staatenbericht](https://documents.un.org/doc/undoc/gen/g07/416/23/pdf/g0741623.pdf) · [Schweizer EDA](https://www.aboutswitzerland.eda.admin.ch/de/politisches-system) · [OECD zu Benin](https://www.oecd.org/content/dam/oecd/en/publications/reports/2026/01/global-forum-on-transparency-and-exchange-of-information-for-tax-purposes-benin-2026-second-round-phase-1_f469dbe5/4cfacc95-en.pdf) · [France Diplomatie zur Elfenbeinküste](https://www.diplomatie.gouv.fr/fr/information-par-pays/cote-d-ivoire/presentation-de-la-cote-d-ivoire) · [Malaysisches Außenministerium](https://www.kln.gov.my/web/fin_helsinki/post/federal-territory-day-hari-wilayah-persekutuan) · [Niederländische Regierung](https://www.government.nl/site/binaries/site-content/collections/documents/2017/04/21/culture-at-a-first-glance/CIB2015_ENG_publicatie_v8_DEF.pdf)

### Hauptstadtpunkte

**194 von 194 Ländern mit Hauptstadteintrag** haben ein Koordinatenpaar. Der Build prüft jedes Paar gegen das im Quiz verwendete Landespolygon, einschließlich der zusammengeführten Geometrien. Israel (`ISR`), Palästina (`PSE`) und Nauru (`NRU`) haben weiterhin einen Hauptstadt-Hinweis. Name und Punkt bleiben jeweils leer.

Die Punkte stammen überwiegend aus Natural Earth `Populated Places`, Version 5.1.2. Gitega, Porto-Novo, Juba, Sri Jayewardenepura Kotte und Dodoma wurden mit dem jeweils passenden Ortseintrag verknüpft. Der Punkt für Ciudad de la Paz wurde anhand von GeoNames ergänzt. Für einzelne Küsten-, Atoll- und Kleinstädte dient eine Position in der jeweiligen Stadt als Referenzpunkt. Süd-Tarawa wird durch einen Punkt im Stadtgebiet östlich von Bairiki repräsentiert. [Natural Earth Populated Places](https://github.com/nvkelso/natural-earth-vector/blob/v5.1.2/geojson/ne_10m_populated_places.geojson) · [GeoNames Ciudad de la Paz](https://www.geonames.org/12226438) · [Weltbank zu Süd-Tarawa](https://documents1.worldbank.org/curated/en/997801574719355577/pdf/Kiribati-South-Tarawa-Water-Supply-Project.pdf) · [UNESCO zu Majuro](https://tsunami.ioc.unesco.org/sites/default/files/medias/fichiers/2025/01/MH_MAJ_hazard_map_1.pdf)

Die Konturen von Dschibuti, Gambia, Liberia, Monaco, Schweden und Vatikanstadt stammen aus Natural Earth `Admin 0 – Countries` im Maßstab 1:10 Mio., damit die tatsächlichen Stadtpunkte mit der Quizkarte übereinstimmen. [Natural Earth Admin 0, 1:10 Mio.](https://github.com/nvkelso/natural-earth-vector/blob/v5.1.2/geojson/ne_10m_admin_0_countries.geojson)

## Flaggen-Hauptfarben

Alle 197 Werte liegen als manuell änderbares `#RRGGBB` in `entities.csv`. Der Startwert ist die häufigste sichtbare RGB-Farbe im gerasterten 4:3-SVG. Pixel ab 225 in allen drei Kanälen und Pixel unter 50 % Deckkraft werden beim Seed übersprungen. Bei gleich großen Flächen entscheidet beim Seed die erste gefundene Farbe. `npm run data:seed-colors` übernimmt vorhandene Werte und schreibt Ergänzungen in `entities.seed.csv`. [flag-icons 7.6.0](https://github.com/lipis/flag-icons/tree/v7.6.0)

In Afghanistan, Belgien, Deutschland und Palästina wurde bei gleich großen Streifen eine markantere Flaggenfarbe gewählt. In Papua-Neuguinea ist Rot die Hauptfarbe der diagonal geteilten Flagge. Die Niederlande verwenden Oranje (`#FF4F00`) als Nationalfarbe. In Libyen, St. Kitts und Nevis sowie Tansania bleibt die größere schwarze Fläche der Hauptwert. [Niederländisches Königshaus zu Oranje](https://www.royal-house.nl/topics/royal-house/name-of-the-royal-house)

<details>
<summary>Berechnete Flaggenfarben und verwendete Hauptfarben aller 197 Länder</summary>

| ID | Land | Berechnet | Verwendet |
|---|---|---|---|
| AFG | Afghanistan | `#000001` | `#009900` |
| AGO | Angola | `#FF0000` | `#FF0000` |
| ALB | Albanien | `#FF0000` | `#FF0000` |
| AND | Andorra | `#0018A8` | `#0018A8` |
| ARE | Vereinigte Arabische Emirate | `#FF0000` | `#FF0000` |
| ARG | Argentinien | `#74ACDF` | `#74ACDF` |
| ARM | Armenien | `#D90012` | `#D90012` |
| ATG | Antigua und Barbuda | `#CE1126` | `#CE1126` |
| AUS | Australien | `#00008B` | `#00008B` |
| AUT | Österreich | `#C8102E` | `#C8102E` |
| AZE | Aserbaidschan | `#00B9E4` | `#00B9E4` |
| BDI | Burundi | `#CF0921` | `#CF0921` |
| BEL | Belgien | `#000001` | `#FFD90C` |
| BEN | Benin | `#319400` | `#319400` |
| BFA | Burkina Faso | `#35A100` | `#35A100` |
| BGD | Bangladesch | `#006A4E` | `#006A4E` |
| BGR | Bulgarien | `#00966E` | `#00966E` |
| BHR | Bahrain | `#CE1126` | `#CE1126` |
| BHS | Bahamas | `#08CED6` | `#08CED6` |
| BIH | Bosnien und Herzegowina | `#000099` | `#000099` |
| BLR | Belarus | `#CE1720` | `#CE1720` |
| BLZ | Belize | `#003F87` | `#003F87` |
| BOL | Bolivien | `#007934` | `#007934` |
| BRA | Brasilien | `#229E45` | `#229E45` |
| BRB | Barbados | `#00267F` | `#00267F` |
| BRN | Brunei | `#F7E017` | `#F7E017` |
| BTN | Bhutan | `#FFD520` | `#FFD520` |
| BWA | Botswana | `#00CBFF` | `#00CBFF` |
| CAF | Zentralafrikanische Republik | `#FFFF00` | `#FFFF00` |
| CAN | Kanada | `#D52B1E` | `#D52B1E` |
| CHE | Schweiz | `#FF0000` | `#FF0000` |
| CHL | Chile | `#D52B1E` | `#D52B1E` |
| CHN | China | `#EE1C25` | `#EE1C25` |
| CIV | Elfenbeinküste | `#FF8200` | `#FF8200` |
| CMR | Kamerun | `#FCD116` | `#FCD116` |
| COD | Demokratische Republik Kongo | `#007FFF` | `#007FFF` |
| COG | Republik Kongo | `#FFFF00` | `#FFFF00` |
| COL | Kolumbien | `#FFE800` | `#FFE800` |
| COM | Komoren | `#239E46` | `#239E46` |
| CPV | Cabo Verde | `#081873` | `#081873` |
| CRI | Costa Rica | `#0000B4` | `#0000B4` |
| CUB | Kuba | `#002A8F` | `#002A8F` |
| CYP | Zypern | `#D47600` | `#D47600` |
| CZE | Tschechien | `#D7141A` | `#D7141A` |
| DEU | Deutschland | `#000001` | `#FFCC00` |
| DJI | Dschibuti | `#6699FF` | `#6699FF` |
| DMA | Dominica | `#108C00` | `#108C00` |
| DNK | Dänemark | `#C8102E` | `#C8102E` |
| DOM | Dominikanische Republik | `#002D62` | `#002D62` |
| DZA | Algerien | `#006233` | `#006233` |
| ECU | Ecuador | `#FFE800` | `#FFE800` |
| EGY | Ägypten | `#CE1126` | `#CE1126` |
| ERI | Eritrea | `#BE0027` | `#BE0027` |
| ESP | Spanien | `#AA151B` | `#AA151B` |
| EST | Estland | `#1791FF` | `#1791FF` |
| ETH | Äthiopien | `#298C08` | `#298C08` |
| FIN | Finnland | `#002F6C` | `#002F6C` |
| FJI | Fidschi | `#68BFE5` | `#68BFE5` |
| FRA | Frankreich | `#000091` | `#000091` |
| FSM | Föderierte Staaten von Mikronesien | `#6797D6` | `#6797D6` |
| GAB | Gabun | `#36A100` | `#36A100` |
| GBR | Vereinigtes Königreich | `#C8102E` | `#C8102E` |
| GEO | Georgien | `#FF0000` | `#FF0000` |
| GHA | Ghana | `#CE1126` | `#CE1126` |
| GIN | Guinea | `#FF0000` | `#FF0000` |
| GMB | Gambia | `#000099` | `#000099` |
| GNB | Guinea-Bissau | `#FCD116` | `#FCD116` |
| GNQ | Äquatorialguinea | `#3E9A00` | `#3E9A00` |
| GRC | Griechenland | `#0D5EAF` | `#0D5EAF` |
| GRD | Grenada | `#CE1126` | `#CE1126` |
| GTM | Guatemala | `#4997D0` | `#4997D0` |
| GUY | Guyana | `#399408` | `#399408` |
| HND | Honduras | `#18C3DF` | `#18C3DF` |
| HRV | Kroatien | `#FF0000` | `#FF0000` |
| HTI | Haiti | `#00209F` | `#00209F` |
| HUN | Ungarn | `#D43516` | `#D43516` |
| IDN | Indonesien | `#E70011` | `#E70011` |
| IND | Indien | `#FF9933` | `#FF9933` |
| IRL | Irland | `#009A49` | `#009A49` |
| IRN | Iran | `#DA0000` | `#DA0000` |
| IRQ | Irak | `#CE1126` | `#CE1126` |
| ISL | Island | `#003897` | `#003897` |
| ISR | Israel | `#0038B8` | `#0038B8` |
| ITA | Italien | `#009246` | `#009246` |
| JAM | Jamaika | `#FFCC00` | `#FFCC00` |
| JOR | Jordanien | `#FF0000` | `#FF0000` |
| JPN | Japan | `#BC002D` | `#BC002D` |
| KAZ | Kasachstan | `#00ABC2` | `#00ABC2` |
| KEN | Kenia | `#006600` | `#006600` |
| KGZ | Kirgisistan | `#FF0000` | `#FF0000` |
| KHM | Kambodscha | `#032EA1` | `#032EA1` |
| KIR | Kiribati | `#E73E2D` | `#E73E2D` |
| KNA | St. Kitts und Nevis | `#000001` | `#000001` |
| KOR | Südkorea | `#0047A0` | `#0047A0` |
| KWT | Kuwait | `#00D941` | `#00D941` |
| LAO | Laos | `#CE1126` | `#CE1126` |
| LBN | Libanon | `#EE161F` | `#EE161F` |
| LBR | Liberia | `#CC0000` | `#CC0000` |
| LBY | Libyen | `#000001` | `#000001` |
| LCA | St. Lucia | `#65CFFF` | `#65CFFF` |
| LIE | Liechtenstein | `#CE1126` | `#CE1126` |
| LKA | Sri Lanka | `#8D2029` | `#8D2029` |
| LSO | Lesotho | `#00209F` | `#00209F` |
| LTU | Litauen | `#006A44` | `#006A44` |
| LUX | Luxemburg | `#ED2939` | `#ED2939` |
| LVA | Lettland | `#981E32` | `#981E32` |
| MAR | Marokko | `#C1272D` | `#C1272D` |
| MCO | Monaco | `#F31830` | `#F31830` |
| MDA | Moldawien | `#DE2110` | `#DE2110` |
| MDG | Madagaskar | `#FC3D32` | `#FC3D32` |
| MDV | Malediven | `#D21034` | `#D21034` |
| MEX | Mexiko | `#006847` | `#006847` |
| MHL | Marshallinseln | `#3B5AA3` | `#3B5AA3` |
| MKD | Nordmazedonien | `#D20000` | `#D20000` |
| MLI | Mali | `#009A00` | `#009A00` |
| MLT | Malta | `#CF142B` | `#CF142B` |
| MMR | Myanmar | `#FECB00` | `#FECB00` |
| MNE | Montenegro | `#C40308` | `#C40308` |
| MNG | Mongolei | `#DA2032` | `#DA2032` |
| MOZ | Mosambik | `#FFCA00` | `#FFCA00` |
| MRT | Mauretanien | `#006233` | `#006233` |
| MUS | Mauritius | `#EE2737` | `#EE2737` |
| MWI | Malawi | `#F41408` | `#F41408` |
| MYS | Malaysia | `#CC0000` | `#CC0000` |
| NAM | Namibia | `#C70000` | `#C70000` |
| NER | Niger | `#E05206` | `#E05206` |
| NGA | Nigeria | `#008753` | `#008753` |
| NIC | Nicaragua | `#0067C6` | `#0067C6` |
| NLD | Niederlande | `#AE1C28` | `#FF4F00` |
| NOR | Norwegen | `#ED2939` | `#ED2939` |
| NPL | Nepal | `#CE0000` | `#CE0000` |
| NRU | Nauru | `#002170` | `#002170` |
| NZL | Neuseeland | `#00247D` | `#00247D` |
| OMN | Oman | `#EF2D29` | `#EF2D29` |
| PAK | Pakistan | `#0C590B` | `#0C590B` |
| PAN | Panama | `#0000AB` | `#0000AB` |
| PER | Peru | `#D91023` | `#D91023` |
| PHL | Philippinen | `#0038A8` | `#0038A8` |
| PLW | Palau | `#4AADD6` | `#4AADD6` |
| PNG | Papua-Neuguinea | `#000001` | `#FF0000` |
| POL | Polen | `#DC143C` | `#DC143C` |
| PRK | Nordkorea | `#C60000` | `#C60000` |
| PRT | Portugal | `#FF0000` | `#FF0000` |
| PRY | Paraguay | `#D52B1E` | `#D52B1E` |
| PSE | Palästina | `#000000` | `#009639` |
| QAT | Katar | `#8D1B3D` | `#8D1B3D` |
| ROU | Rumänien | `#00319C` | `#00319C` |
| RUS | Russland | `#0039A6` | `#0039A6` |
| RWA | Ruanda | `#00A1DE` | `#00A1DE` |
| SAU | Saudi-Arabien | `#165D31` | `#165D31` |
| SDN | Sudan | `#FF0000` | `#FF0000` |
| SEN | Senegal | `#0B7226` | `#0B7226` |
| SGP | Singapur | `#DF0000` | `#DF0000` |
| SLB | Salomonen | `#0000D6` | `#0000D6` |
| SLE | Sierra Leone | `#00CD00` | `#00CD00` |
| SLV | El Salvador | `#0F47AF` | `#0F47AF` |
| SMR | San Marino | `#19B6EF` | `#19B6EF` |
| SOM | Somalia | `#40A6FF` | `#40A6FF` |
| SRB | Serbien | `#C6363C` | `#C6363C` |
| SSD | Südsudan | `#0F47AF` | `#0F47AF` |
| STP | São Tomé und Príncipe | `#12AD2B` | `#12AD2B` |
| SUR | Suriname | `#377E3F` | `#377E3F` |
| SVK | Slowakei | `#EE1C25` | `#EE1C25` |
| SVN | Slowenien | `#0000BF` | `#0000BF` |
| SWE | Schweden | `#005293` | `#005293` |
| SWZ | Eswatini | `#3E5EB9` | `#3E5EB9` |
| SYC | Seychellen | `#D92223` | `#D92223` |
| SYR | Syrien | `#007A3D` | `#007A3D` |
| TCD | Tschad | `#002664` | `#002664` |
| TGO | Togo | `#118600` | `#118600` |
| THA | Thailand | `#A51931` | `#A51931` |
| TJK | Tadschikistan | `#CC0000` | `#CC0000` |
| TKM | Turkmenistan | `#00843D` | `#00843D` |
| TLS | Timor-Leste | `#CB000F` | `#CB000F` |
| TON | Tonga | `#C10000` | `#C10000` |
| TTO | Trinidad und Tobago | `#E00000` | `#E00000` |
| TUN | Tunesien | `#E70013` | `#E70013` |
| TUR | Türkei | `#E30A17` | `#E30A17` |
| TUV | Tuvalu | `#009FCA` | `#009FCA` |
| TWN | Taiwan | `#FF0000` | `#FF0000` |
| TZA | Tansania | `#000001` | `#000001` |
| UGA | Uganda | `#FFE700` | `#FFE700` |
| UKR | Ukraine | `#0057B8` | `#0057B8` |
| URY | Uruguay | `#0038A8` | `#0038A8` |
| USA | Vereinigte Staaten | `#BD3D44` | `#BD3D44` |
| UZB | Usbekistan | `#1EB53A` | `#1EB53A` |
| VAT | Vatikanstadt | `#FFE000` | `#FFE000` |
| VCT | St. Vincent und die Grenadinen | `#F4F100` | `#F4F100` |
| VEN | Venezuela | `#FFCC00` | `#FFCC00` |
| VNM | Vietnam | `#DA251D` | `#DA251D` |
| VUT | Vanuatu | `#D21034` | `#D21034` |
| WSM | Samoa | `#CE1126` | `#CE1126` |
| XKX | Kosovo | `#244AA5` | `#244AA5` |
| YEM | Jemen | `#F10600` | `#F10600` |
| ZAF | Südafrika | `#007847` | `#007847` |
| ZMB | Sambia | `#198A00` | `#198A00` |
| ZWE | Simbabwe | `#006400` | `#006400` |

</details>

## Weitere Länderdaten

Recherchestand der Wirtschaftsdaten ist der 25. November 2026. Die Regierungsformen haben das Berichtsjahr 2025. Befüllte Werte erscheinen im Atlas und stehen als Kategorien unter **Üben → Eigene Runde** zur Auswahl.

- **Währung.** Die Zuordnung aus `world-countries` 5.1.0 wurde mit der ISO-4217-Liste vom 17. September 2026 und amtlichen Angaben abgeglichen. Das Quiz verwendet als Hauptwert die nationale Währung oder die übernommene Fremdwährung. Für Panama stehen der Balboa und der dort ebenfalls gesetzliche US-Dollar als richtige Antworten zur Verfügung. `USD` zählt beim Tippen, Panama zählt auch bei der Rückwärtsfrage zum US-Dollar. In Palästina ist keine einheitliche Landeswährung hinterlegt. Deutsche Bezeichnungen folgen den lokalisierten Währungsnamen, ergänzt um ISO-Codes und geläufige Schreibweisen. [world-countries 5.1.0](https://github.com/mledoze/countries/blob/5.1.0/countries.json) · [ISO 4217](https://www.iso.org/iso-4217-currency-codes.html) · [Liste der ISO-Pflegestelle SIX](https://www.six-group.com/dam/download/financial-information/data-center/iso-currrency/lists/list-one.xml) · [IMF zu Panama](https://www.elibrary.imf.org/view/journals/002/2025/245/article-A002-en.xml) · [Palästinensische Währungsbehörde](https://www.pma.ps/Portals/0/Users/002/02/2/Publications/English/Annual%20Reports/Financial%20Stability%20Reports/Financial_Stability_Report_English_Final_web_2013.pdf)
- **Aktualisierte Währungszuordnungen.** Bulgarien verwendet seit dem 1. Januar 2026 den Euro. Für Sierra Leone gilt der neu denominierte Leone (`SLE`), für Simbabwe Zimbabwe Gold (`ZWG`) und für Kuba der kubanische Peso (`CUP`). Mikronesien verwendet den US-Dollar. Für Venezuelas Bolívar führt die ISO-Liste `VES` und `VED`. Das Quiz akzeptiert beide Codes. [EZB zur Euro-Einführung](https://www.ecb.europa.eu/press/pr/date/2026/html/ecb.pr260101~c830245e42.en.html) · [ISO-Liste](https://www.six-group.com/dam/download/financial-information/data-center/iso-currrency/lists/list-one.xml) · [Reserve Bank of Zimbabwe](https://www.rbz.co.zw/documents/press/2024/July/PRESS_STATEMENT_ON_ZiG_CURRENCY_CODE.pdf) · [IMF zu Mikronesien](https://www.elibrary.imf.org/view/journals/087/2024/003/article-A001-en.xml)
- **Zentralbank.** Erfasst ist die zuständige nationale Zentralbank oder Währungsbehörde. Bei den drei regionalen Zentralbanken steht für alle Mitglieder dieselbe Institution. Bei den 21 Ländern der Eurozone ist die jeweilige nationale Zentralbank der Quizwert. Die Auflösung und der Atlas ergänzen „Geldpolitik: EZB“. Das kanadische Aufsichtsverzeichnis diente als Ausgangspunkt, abgeglichen mit Zentralbankverbänden und einzelnen Institutionen. [OSFI](https://www.osfi-bsif.gc.ca/en/data-forms/reporting-returns/filing-financial-returns/financial-reporting-instructions/geographic-distribution-assets-liabilities-booked-canada-gq) · [BIZ](https://www.bis.org/about/organisation/members) · [AACB](https://www.aacb.org/en/member-central-banks) · [CEMLA](https://www.cemla.org/members.html) · [BCEAO](https://www.bceao.int/fr/etats-membres) · [BEAC](https://www.beac.int/) · [Eastern Caribbean Central Bank](https://stratplan.eccb-centralbank.org/) · [Zentralbank des Kosovo](https://bqk-kos.org/rreth-bqk/?lang=en) · [EZB zum Eurosystem](https://www.ecb.europa.eu/ecb/orga/escb/html/index.de.html)
- **Leitindex.** Pro Land ist ein repräsentativer Aktienindex hinterlegt. Wo mehrere Marktindizes infrage kommen, wurde einer ausgewählt. Die Vereinigten Arabischen Emirate sind mit dem FTSE ADX General Index der Börse Abu Dhabi vertreten. Die Mitglieder der Regionalbörsen BRVM und BVMAC teilen sich den jeweiligen Leitindex. [World Federation of Exchanges](https://focus.world-exchanges.org/issue/november-2026/market-statistics) · [FTSE Russell zu Abu Dhabi](https://www.lseg.com/en/ftse-russell/indices/adx) · [BRVM-Mitglieder](https://www.brvm.org/en/node/61597) · [BRVM Composite](https://www.brvm.org/en/summary) · [BVMAC-Mitglieder](https://www.bvm-ac.org/wp-content/uploads/2026/11/BOC-20261106.pdf) · [BVMAC All Share](https://www.bvm-ac.org/echos-du-marche/avis-n059-2023-bvmac-dg-relatif-au-lancement-de-lindice-boursier-de-la-bvmac/)
- **Weitere Indexquellen.** Die ausgewählten Indizes, die von den WFE-Reihen abweichen oder dort fehlen, wurden auf den Seiten der jeweiligen Börse oder des Indexanbieters geprüft. [Euronext](https://www.euronext.com/en/euronext-indices) · [Nasdaq Nordic und Baltikum](https://www.nasdaq.com/products/global-indexes/beta/european-indexes) · [DAX](https://stoxx.com/solutions/dax-de/) · [FTSE 100](https://www.lseg.com/en/ftse-russell/indices/ftse100) · [IBEX 35](https://www.bolsasymercados.es/bme-exchange/en/Indices/IBEX) · [ATX](https://www.wienerborse.at/en/index/atx-AT0000999982/?w=profile) · [S&P 500](https://www.spglobal.com/spdji/en/indices/equity/sp-500/) · [Nikkei 225](https://indexes.nikkei.co.jp/en/nkave/index/profile?cid=7&idx=nk225) · [Nifty 50](https://nsearchives.nseindia.com/content/indices/Method_NIFTY_Equity_Indices.pdf) · [IDX Composite](https://www.idx.co.id/Media/4nfhvmpl/fs-composite-2026-10.pdf) · [MSCI Merval](https://www.byma.com.ar/) · [MSCI IPSA](https://servicioscms.bolsadesantiago.com/Sintesis%20y%20Estadisticas/S%C3%ADntesis%20Estad%C3%ADstica%20Mensual%20Octubre%202026.pdf) · [MSCI COLCAP](https://www.msci.com/indexes/index/737809) · [MSCI NUAM Peru General](https://documents.bvl.com.pe/pubdif/boldia/bolres.htm)
- **Regierungsform.** Quelle ist Coppedge et al. (2026), *V-Dem Country-Year Dataset v16*, für 2025. Die Spalte `regime_type` enthält die deutschen Bezeichnungen des Indikators `v2x_regime` aus „Regimes of the World“. Die Werte 0 bis 3 stehen für geschlossene Autokratie, Wahlautokratie, Wahldemokratie und liberale Demokratie. Übernommen wurden belegte Zuordnungen über `country_text_id`. Für Palästina und Somalia liefert V-Dem unterschiedliche Werte für Westjordanland und Gaza beziehungsweise für Somalia und Somaliland. Diese Quizentitäten bleiben bei der Regierungsform leer. Auflösung und Atlas zeigen bei befülltem Wert den Zusatz „nach V-Dem 2025“. Die aus V-Dem abgeleitete Spalte steht unter CC BY-SA 4.0. [Datensatz und Zitierempfehlung](https://doi.org/10.23696/vdemds26) · [Codebook v16](https://www.v-dem.net/documents/70/codebook_v16.pdf) · [V-Dem zur Lizenz](https://www.v-dem.net/about/faq/) · [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)

Bei Rückwärtsfragen mit vier Optionen enthält die Auswahl genau ein passendes Land. Beim Tippen oder auf der Karte zählen alle im Set hinterlegten Länder, die denselben Wert teilen.

### Fehlende Werte

| Feld | Leer | Länder und Gründe |
|---|---:|---|
| Währung | 1 | `PSE`. Keine einheitliche Landeswährung. |
| Zentralbank | 12 | `AND FSM KIR LIE MCO MHL NRU PAN PLW TUV VAT` haben in diesem Datensatz keine eigene Zentralbank und keine zugeordnete gemeinsame Zentralbank. Für `YEM` bleibt der Wert wegen der getrennten Zuständigkeiten in Aden und Sanaa offen. [IMF zu Panama](https://dsbb.imf.org/egdds/dqaf-base/country/PAN/category/AAC00) · [IMF zu Jemen](https://www.elibrary.imf.org/view/journals/002/2026/080/article-A001-en.xml) |
| Leitindex | 63 | Der Atlas zeigt für 19 Länder „Keine Börse“ und für 44 „Nicht belegt“. Die vollständigen Listen stehen im Abschnitt zur zweiten Börsenrecherche. |
| Regierungsform | 24 | `AND ATG BHS BLZ BRN DMA FSM GRD KIR KNA LCA LIE MCO MHL NRU PLW SMR TON TUV VAT VCT WSM` fehlen in der V-Dem-Zuordnung für 2025. `PSE SOM` bleiben wegen unterschiedlicher Bewertungen der Teilgebiete leer. |

### Zweite Börsenrecherche

Die zweite Recherche ergänzt 39 Leitindex-Zuordnungen. Grundlage sind nationale und regionale Börsen, Aufsichtsstellen sowie bei einzelnen Märkten die Betreiber repräsentativer Aktienindizes. Die sechs Weltset-Länder der Eastern Caribbean Securities Exchange teilen sich den EC Share Index. Der Index bildet die in der gemeinsamen Börse gelisteten Aktien der Währungsunion ab. [World Federation of Exchanges](https://www.world-exchanges.org/membership/membership-overview) · [UN-Initiative Sustainable Stock Exchanges](https://www.unepfi.org/investment/sse/) · [ECSE-Mitglieder](https://www.ecseonline.com/faqs/) · [EC Share Index](https://old.ecseonline.com/ecse_index.php)

| Land | Neuer Leitindex | Quelle |
|---|---|---|
| Antigua und Barbuda | EC Share Index | [Marktbeleg](https://www.ecseonline.com/) |
| Bahamas | BISX All-Share Index | [Marktbeleg](https://www.bisxbahamas.com/index-information/) |
| Bosnien und Herzegowina | SASX-10 | [Marktbeleg](https://www.sase.ba/v1/en-us/Market/General-Information/Indices) |
| Barbados | BSE Local Index | [Marktbeleg](https://bse.com.bb/wp-content/uploads/2026/11/20261109.pdf) |
| Bhutan | Bhutan Stock Index | [Marktbeleg](https://rsebl.org.bt/bsi) |
| Botswana | Domestic Companies Index | [Marktbeleg](https://apis.bse.co.bw/storage/reports/09/2026/2026-09-28.pdf) |
| Dominica | EC Share Index | [Marktbeleg](https://www.ecseonline.com/) |
| Algerien | DZAIRINDEX | [Marktbeleg](https://www.sgbv.dz/commons/fr/boc/boc957165486.pdf) |
| Ecuador | ECUINDEX | [Marktbeleg](https://www.bolsadequito.com/documentos/marketing/guia_inversionista_extranjero-2024.pdf) |
| Fidschi | SPX Total Return Index | [Marktbeleg](https://marketreports.spx.com.fj/indicesdata.aspx) |
| Georgien | GSX Index | [Marktbeleg](https://gse.ge/en/gsx-index) |
| Grenada | EC Share Index | [Marktbeleg](https://www.ecseonline.com/) |
| Irak | ISX60 | [Marktbeleg](https://uploads.isc.gov.iq/upload/2026/11/18/6afd7e0f804b7.pdf) |
| Kirgisistan | KSE Index | [Marktbeleg](https://www.kse.kg/en/IndexAndCapitalization) |
| Kambodscha | CSX Index | [Marktbeleg](https://csx.com.kh/en/product/index.jsp) |
| St. Kitts und Nevis | EC Share Index | [Marktbeleg](https://www.ecseonline.com/) |
| Laos | LSX Composite Index | [Marktbeleg](https://www.set.or.th/th/market/index/gms-exchanges/overview) |
| Libanon | BLOM Stock Index | [Marktbeleg](https://investorrelations.blombank.com/BlomInvest/Indices2) |
| St. Lucia | EC Share Index | [Marktbeleg](https://www.ecseonline.com/) |
| Malediven | MASIX | [Marktbeleg](https://mma.gov.mv/documents/Annual%20Report/2025/Statistical%20Appendix-2025.pdf) |
| Nordmazedonien | MBI10 | [Marktbeleg](https://www.mse.mk/Repository/UserFiles/File/Indeksi/Metodologija-MBI10eng-latest.pdf) |
| Malta | MSE Equity Price Index | [Marktbeleg](https://borzamalta.com.mt/reports/MSE) |
| Myanmar | MYANPIX | [Marktbeleg](https://ysx-mm.com/wp-content/uploads/2026/11/Quarterly-News-letter-EN-Version.pdf) |
| Montenegro | MNSE10 | [Marktbeleg](https://dsbb.imf.org/e-gdds/dqaf-base/country/MNE/category/SPI00) |
| Mongolei | MSE TOP-20 Index | [Marktbeleg](https://mse.mn/uploads/laws/indexreg.pdf) |
| Mosambik | IBVM Acções | [Marktbeleg](https://bvm.co.mz/documentos/IBVM_Indice_BVM_Metodologia_Calculo.pdf) |
| Malawi | Malawi All Share Index | [Marktbeleg](https://mse.co.mw/market/reports) |
| Nepal | NEPSE Index | [Marktbeleg](https://www.nrb.org.np/database-on-nepalese-economy/financial-sector/) |
| Papua-Neuguinea | Kina Securities Index | [Marktbeleg](https://investors.kinabank.com.pg/Investors/?page=Market-Update) |
| Serbien | BELEX15 | [Marktbeleg](https://bgdx.rs/eng/proizvodi_i_usluge/indeksi_opste) |
| Eswatini | ESE All Share Index | [Marktbeleg](https://ese.co.sz/) |
| Syrien | Damascus Securities Exchange Weighted Index | [Marktbeleg](https://www.arab-exchanges.org/upload/5313websiteAnnual%202025%20Mid%20res.pdf) |
| Trinidad und Tobago | TTSE Composite Index | [Marktbeleg](https://www.stockex.co.tt/values-and-index-summary/) |
| Uganda | USE All Share Index | [Marktbeleg](https://use.or.ug/securities/equities) |
| Ukraine | PFTS Index | [Marktbeleg](https://pfts.ua/en/1-market-data/1-pfts-index) |
| Usbekistan | Uzbekistan Composite Index | [Marktbeleg](https://uzse.uz/legislations/146?locale=en) |
| St. Vincent und die Grenadinen | EC Share Index | [Marktbeleg](https://www.ecseonline.com/) |
| Venezuela | Índice Bursátil Caracas | [Marktbeleg](https://www.publicnow.com/view/4B35BD71632F8C09B705EB8CCECCC0A1683E7F00) |
| Simbabwe | ZSE All-Share Index | [Marktbeleg](https://www.rbz.co.zw/documents/monthly_review/2026/Monthly_Economic_Review_September_2026.pdf) |

Der Status „Keine Börse“ steht für Länder ohne eigene oder gemeinsam betriebene Wertpapierbörse. „Nicht belegt“ steht für einen fehlenden Nachweis eines repräsentativen Aktienindex. Darunter sind Börsen mit Anleihehandel, Märkte im Aufbau und schwer belegbare Fälle. Angola bereitet einen Börsenindex vor. Armeniens veröffentlichte AMX-Indexreihe ist ein Anleihenindex. Die dokumentierten nationalen Börsen von Guyana, Panama und Suriname bleiben ebenfalls bei „Nicht belegt“. Beide Status erscheinen im Atlas. Im Quiz zählen ausschließlich belegte Indexwerte. [Angola BODIVA](https://www.bodiva.ao/) · [Armenia Securities Exchange](https://amx.am/uploads/company/documents/En-AMXIndexAMDALL%20V%204_2024-06-11_13-20-06.pdf) · [Guyana Securities Council](https://www.guyanasecuritiescouncil.com/) · [Panama Latinex](https://latinexbolsa.com/es/) · [Suriname Stock Exchange](https://surinamestockexchange.com/) · [IFRS-Länderprofile zu Samoa](https://www.ifrs.org/use-around-the-world/use-of-ifrs-standards-by-jurisdiction/view-jurisdiction/samoa/) und [Jemen](https://www.ifrs.org/use-around-the-world/use-of-ifrs-standards-by-jurisdiction/view-jurisdiction/yemen/)

| Status | Anzahl | Länder-IDs |
|---|---:|---|
| Keine Börse | 19 | `AND BLZ ERI FSM GIN HTI KIR LIE MCO NRU PLW SMR STP TLS TON TUV VAT WSM YEM` |
| Nicht belegt | 44 | `AFG AGO ALB ARM AZE BDI BLR BOL BRN COD COM CPV CUB DJI DOM ETH GMB GTM GUY HND LBR LBY LSO MDA MDG MHL MRT NIC PAN PRK PRY SDN SLB SLE SLV SOM SSD SUR SYC TJK TKM URY VUT XKX` |

## Staatsformen

`government_form` ist für alle 197 Länder befüllt. Das Feld beschreibt die Verfassungsordnung oder, bei einer fehlenden oder nicht einheitlich wirksamen Verfassung, die belegte Übergangsordnung. Grundlage sind die vergleichende Typologie von Tristan Hotham (2026) und die dort verlinkten institutionellen Quellen. Die beiden semipräsidentiellen Untertypen sind im Quiz zusammengefasst. Die Schweizer Direktorialrepublik und die vom Parlament gewählte Exekutive sind eigene Antworten. „Regierende Monarchie“ bezeichnet konstitutionelle Monarchien mit eigenständiger Regierungsgewalt des Monarchen. Die für das Quiz abgeleiteten deutschen Klassen stehen unter CC BY-SA 4.0. [Hotham, veröffentlichter Datensatz](https://doi.org/10.5281/zenodo.24134970) · [Länderzeilen der verwendeten Revision](https://github.com/Tristan-Hotham/government-types/blob/21a997d06b606cadfc10c04495e589f3bd867457/data/countries.csv) · [Dokumentierte Einzelfallentscheidungen](https://github.com/Tristan-Hotham/government-types/blob/21a997d06b606cadfc10c04495e589f3bd867457/data/hand_decisions.csv) · [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)

| Fälle | Maßgebliche Grundlage |
|---|---|
| Bangladesch, Togo und die Schweiz | [Kabinett und Parlamentsverantwortung in Bangladesch](https://bdlaws.minlaw.gov.bd/act-367/part-details-201.html?lang=en) · [Verfassung Togos](https://assemblee-nationale.tg/wp-content/uploads/2024/09/TOGO-Constitution-du-6-mai-2024.pdf) · [Schweizer Bundesrat](https://www.admin.ch/en/federal-council-tasks-governing) |
| Aserbaidschan, Kasachstan und Tunesien | [Verfassung Aserbaidschans](https://president.az/en/pages/view/azerbaijan/constitution) · [Verfassung Kasachstans von 2026](https://old.adilet.zan.kz/eng/docs/K2600000000) · [Verfassung Tunesiens von 2022](https://www.constituteproject.org/constitution/Tunisia_2022?lang=en) |
| Guinea, Guinea-Bissau und Mali | [Verfassung Guineas von 2025](https://www.sgg.gov.gn/document/downloadfile/546) · [Reuters zur Verfassungsreform Guinea-Bissaus](https://www.reuters.com/world/africa/guinea-bissau-approves-new-constitution-that-expands-presidential-powers-2026-09-01/) · [Amtsblatt Malis](https://extranet.who.int/cpcd/sites/default/files/public_file_repository/MLI_Mali_Constitution_2023.pdf) |
| Haiti, Madagaskar und Südsudan | [Verfassung Haitis](https://www.constituteproject.org/constitution/Haiti_2012?lang=en) · [Verfassung Madagaskars](https://www.constituteproject.org/constitution/Madagascar_2010?lang=en) · [Übergangsverfassung Südsudans](https://www.constituteproject.org/constitution/South_Sudan_2013?lang=en) |
| Marshallinseln und Myanmar | [Verfassung der Marshallinseln](https://www.wipo.int/wipolex/en/legislation/details/8131) · [Verfassung Myanmars](https://www.refworld.org/sites/default/files/2025-05/constitution_de_2008.pdf) |
| Palästina und Somalia | [Palästinensisches Grundgesetz von 2003](https://www.elections.ps/Portals/0/pdf/The_Amended_Basic_Law_2003_EN.pdf) · [Somalische Bundesverfassung](https://moifar.gov.so/en/page/federal-constitution) · [Umsetzung der somalischen Verfassungsreform von 2026](https://somalipublicagenda.org/implementation-of-somalias-new-federal-constitution-key-developments-and-emerging-legal-questions/) |
| Burkina Faso, Niger, Eritrea und Vatikanstadt | [Übergangscharta Burkina Fasos](https://natlex.ilo.org/dyn/natlex2/r/natlex/fe/details?p3_isn=118687) · [Charta von Niger](https://presidence.ne/pages/refondation) · [UN-Bericht zu Eritrea](https://www.ohchr.org/Documents/HRBodies/HRCouncil/CoIEritrea/A_HRC_32_CRP.1_read-only.pdf) · [Grundgesetz der Vatikanstadt](https://www.vaticanstate.va/en/component/content/article/explanatory-note-regarding-the-fundamental-law.html?Itemid=216&catid=50) |

## Kontinentzuordnungen zur Prüfung

Das Quiz verwendet pro Entität die Region aus `world-countries`. Für Amerika unterscheidet es die Subregion Südamerika und fasst Mittelamerika und die Karibik mit Nordamerika zusammen. Daraus ergeben sich 54 Länder in Afrika, 48 in Asien, 46 in Europa, 23 in Nordamerika, 14 in Ozeanien und 12 in Südamerika. Die Hauptzuordnung steuert den Regionenfilter. Die Tabelle nennt die sieben zusätzlich akzeptierten Kontinenteinträge. Die geografischen Hinweise stehen in `continent_note` und erscheinen im Atlas. Sie beeinflussen die Quizwertung nicht. Zypern zählt als ausdrücklich gewählter Inselfall mit Europa und Asien. Separat geführte Gebiete wie Grönland, britische und australische Außengebiete zählen hier nicht zum jeweiligen Quizland. Frankreichs Übersee-Départements und die karibischen Gemeinden der Niederlande zählen zur Spielgeometrie ihrer Länder. [world-countries](https://github.com/mledoze/countries) · [Übersicht zu transkontinentalen Ländern](https://worldpopulationreview.com/country-rankings/transcontinental-countries) · [Insee zu Übersee-Départements](https://www.insee.fr/en/metadonnees/definition/c2031) · [Niederländische Regierung zur Karibik](https://www.government.nl/themes/government-and-democracy/caribbean-parts-of-the-kingdom/question-and-answer/what-are-the-different-parts-of-the-kingdom-of-the-netherlands)

| Land | Hauptzuordnung | Zusätzlich richtig | Geografische Einordnung |
|---|---|---|---|
| Ägypten | Afrika | Asien | Sinai liegt in Asien. |
| Russland | Europa | Asien | Sibirien und der Ferne Osten liegen in Asien. |
| Türkei | Asien | Europa | Ostthrakien liegt in Europa. |
| Kasachstan | Asien | Europa | Das Gebiet westlich des Uralflusses wird Europa zugerechnet. |
| Aserbaidschan | Asien | Europa | Bei der Wasserscheide des Großen Kaukasus als Grenze liegen Teile nördlich davon in Europa. |
| Georgien | Asien | Europa | Bei derselben Grenzziehung liegen Teile nördlich der Wasserscheide in Europa. |
| Griechenland | Europa | — | Einige Inseln der östlichen Ägäis können nach ihrer Lage an der anatolischen Küste Asien zugerechnet werden. |
| Spanien | Europa | — | Ceuta, Melilla und die Kanaren liegen in Afrika. |
| Portugal | Europa | — | Madeira wird geografisch Afrika zugerechnet. |
| Italien | Europa | — | Lampedusa und Lampione liegen auf dem afrikanischen Kontinentalschelf. |
| Frankreich | Europa | — | Die Geometrie enthält Mayotte, Réunion, Guadeloupe, Martinique und Französisch-Guayana. |
| Dänemark | Europa | — | Grönland ist Teil des Königreichs und liegt in Nordamerika. |
| Niederlande | Europa | — | Die Karibischen Niederlande liegen geografisch in der Karibik (Nordamerika). |
| Vereinigtes Königreich | Europa | — | Überseegebiete liegen unter anderem in Amerika, Afrika und Ozeanien. Die souveränen Stützpunktgebiete auf Zypern können geografisch zu Asien gerechnet werden. |
| Vereinigte Staaten | Nordamerika | — | Hawaii liegt in Ozeanien. |
| Kolumbien | Südamerika | — | San Andrés und Providencia liegen in der Karibik vor Mittelamerika. |
| Venezuela | Südamerika | — | Die Isla de Aves wird der nordamerikanischen Karibik zugerechnet. |
| Chile | Südamerika | — | Rapa Nui und Sala y Gómez gehören geografisch zu Polynesien. |
| Jemen | Asien | — | Sokotra liegt vor dem Horn von Afrika und kann geografisch Afrika zugerechnet werden. |
| Indonesien | Asien | — | Westneuguinea gehört geografisch zu Ozeanien. |
| Australien | Ozeanien | — | Die Weihnachtsinsel und die Kokosinseln können geografisch Asien zugerechnet werden. |
| Japan | Asien | — | Abgelegene pazifische Inseln wie Minamitorishima werden teils Ozeanien zugerechnet. |
| Zypern | Europa | Asien | Die Insel liegt geografisch in Westasien. Weltset und Regionenfilter folgen der Zuordnung zu Europa. |

Weitere Grenzfälle mit je einer Zuordnung im Quiz

- **Armenien → Asien.** Es liegt südlich des Großen Kaukasus.
- **Panama → Nordamerika.** Die Staatsgrenze zu Kolumbien ist hier die Grenze zwischen den Kontinenten. **Trinidad und Tobago → Nordamerika.** Die Karibikzuordnung gilt im Quiz auch für Inseln am südamerikanischen Kontinentalschelf.
- **Ecuador → Südamerika.** Das schließt die Galápagosinseln ein. **Timor-Leste → Asien.** Das folgt der Einordnung in Südostasien. **Island → Europa.** Die Zugehörigkeit zu verschiedenen tektonischen Platten ändert hier den Quiz-Kontinent nicht.
- Antarktische Gebietsansprüche zählen für diese Liste nicht zur Kontinentzuordnung. [Antarktisvertrag](https://www.ats.aq/e/antarctictreaty.html)
