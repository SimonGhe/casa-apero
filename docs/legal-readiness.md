# Juridische voorbereiding — concept 0.1

Onderzocht op 24 oktober 2026. Dit is een implementatie- en beoordelingsdocument,
geen goedkeuring van de juridische of fiscale positie van Casa Apero.
Alleen lokaal op `develop`; geen push, productie-infrastructuur of orderontvangst.

## Implementatie

Routes: `/algemene-voorwaarden`, `/privacy`, `/wettelijke-vermeldingen`,
`/herroepingsrecht`, `/cookies`. Alle pagina's hebben conceptstatus, datum en
juridische navigatie in de bestaande huisstijl. De juridische verkoper, fiscale
gegevens, contactgegevens en verwerkingsverantwoordelijke blijven expliciete TODO's.
Geen nummers, leerlinggegevens of adressen van derden worden als verkoper ingevuld.

`CheckoutPreparation` toont de actuele selectie (naam, aantal, eenheidsprijs en
regeltotaal), producttotaal en nog onbepaalde leveringskosten. Productietijd,
afhaal-/leverafspraken, betaling en herroeping staan erbij. Het leesvakje is leeg
en uitgeschakeld; de bestelknop is uitgeschakeld. Er is geen formulier, endpoint,
klantopslag, aanvraag, contractbevestiging of betaling geïmplementeerd.

## Bronnen en afbakening

- [FOD: herroepingsrecht bij aankoop op afstand](https://economie.fgov.be/nl/themas/verkoop/reglementering/herroepingstermijnen/herroepingsrecht-bij-aankoop),
  bijgewerkt 7 september 2026: bedenktijd en online herroepingsfunctie.
- [FOD: uitleg herroeping](https://economie.fgov.be/sites/default/files/Files/Ventes/herroepingsrecht.pdf):
  termijnen, terugbetaling, retourkosten, waardevermindering en uitzonderingen.
  Standaardkeramiek die pas na bestelling wordt gemaakt is niet om die reden
  gepersonaliseerd; er is geen algemene uitsluiting opgenomen.
- [FOD: nieuwe online herroepingsfunctie](https://news.economie.fgov.be/270128-een-impulsieve-online-aankoop-er-is-een-weg-terug/):
  Belgische verplichting sinds 14 augustus 2026 volgens deze publicatie.
- [Richtlijn EU 2023/2673](https://eur-lex.europa.eu/legal-content/nl/TXT/?uri=CELEX%3A32023L2673):
  voegt art. 11a toe aan de consumentenrechtenrichtlijn. De EU-toepassingsdatum
  is 19 juni 2026. Verifieer Belgische omzetting en precieze toepassing vóór release;
  de functie is nu een lanceringsvoorwaarde, geen toekomstig extraatje.
- [FOD: informatieverplichtingen e-commerce, FAQ](https://economie.fgov.be/fr/themes/entreprises/guidance/pratiques-commerciales/obligations-dinformation-dans/questions-frequemment-posees):
  elektronische ontvangstmelding en contractbevestiging op duurzame drager zijn
  afzonderlijke verplichtingen; bevestiging uiterlijk bij levering.
- [Your Europe: overeenkomsten op afstand](https://europa.eu/youreurope/business/selling-goods-services/ecommerce-distance-selling/index_fr.htm):
  precontractuele informatie en schriftelijke bevestiging.
- [FOD: wet op de garantie](https://economie.fgov.be/nl/themas/consumentenbescherming/garantie/wet-op-de-garantie):
  twee jaar vanaf levering bij nieuwe goederen; wettelijke remedies blijven gelden.
- [GBA: cookies en andere traceringsmiddelen](https://www.gegevensbeschermingsautoriteit.be/professioneel/thema-s/cookies):
  regels omvatten vergelijkbare opslagtechnieken. Kortdurende winkelmandopslag kan
  noodzakelijk zijn voor een gevraagde dienst; onbeperkte opslag is niet vanzelf
  vrijgesteld. De duur is daarom begrensd op vier uur na de laatste wijziging.
- [Vlaamse Toezichtcommissie: rechten van betrokkenen](https://www.vlaanderen.be/vlaamse-toezichtcommissie/rechten-van-betrokkenen):
  art. 13/14 AVG, informatie over identiteit, doelen, rechtsgronden en rechten.
  De AVG-brontekst op EUR-Lex gaf bij controle een browser-verificatiepagina;
  geen succesvolle volledige verificatie van die tekst wordt geclaimd.
- [Vlajo: Mini-onderneming](https://www.vlajo.org/mini-onderneming/mini-onderneming)
  beschrijft het schoolleertraject.
  [Vlajo Market-voorwaarden](https://www.vlajo.org/algemene-voorwaarden-vlajo-market)
  betreffen de winkels binnen die marktplaats. De daar beschreven identiteit en
  btw-regeling zijn niet overgenomen als feiten voor deze zelfstandige webshop.

De bronnen onderbouwen de concepten, maar bepalen niet de onbevestigde rollen
van school/Vlajo. Teksten en toepasselijkheid moeten nog door hen worden beoordeeld.

## Opslag- en netwerkinventaris

Inspectie: `src`, `index.html`, Vite-configuratie, afhankelijkheden en publieke
assets. De module-script-tag laadt de eigen React-app. Productfoto's, logo en
lettertypes komen lokaal/systeemgebonden. Geen externe fonts, embeds, SDK's,
analytics, advertentiepixels, fetch-API, serviceworker, IndexedDB, sessionStorage
of app-cookies. Sociale kanalen zijn gewone externe links zonder vooraf geladen
feeds. De Vite-ontwikkelserver gebruikt ontwikkelverkeer zoals HMR; dit is geen
productietracker. Toekomstige hosting kan afzonderlijke logs en opslag toevoegen.

| Sleutel/techniek | Inhoud en doel | Duur/verwijdering |
| --- | --- | --- |
| `casa-apero.cart.v2`, localStorage | Genormaliseerde product-/variant-ID's, aantallen, vervaltijd; selectie herstellen | Vier uur na laatste wijziging; leegmaken verwijdert de sleutel; reload verlengt niet |
| `casa-apero.cart.v1`, oude localStorage | Vroegere winkelmand zonder vervaltijd | Verwijderd bij openen; niet gemigreerd |

Een lege mand schrijft geen nieuwe sleutel. Een verlopen mand wordt in een open
tabblad verwijderd via een timer, of bij het volgende bezoek. Browsers kunnen
timers uitstellen en gegevens in een gesloten browser fysiek bewaren: vier uur is
de gebruiksduur, geen garantie op fysieke verwijdering terwijl de app niet draait.
Bij geblokkeerde opslag blijft de mand in werkgeheugen bruikbaar, met melding.
Geen banner toegevoegd: alleen deze kortdurende gevraagde functie is aanwezig.
Deze noodzakelijkheid is een gemotiveerde beoordeling, geen algemene vrijstelling
voor toekomstige diensten. Herhaal netwerk-/opslagcontrole op de uiteindelijke host.

## Beslissingen voor school/Vlajo vóór opening

- Juridische verkoper/rechtsvorm/vertegenwoordiging; adres en retouradres;
  ondernemings- en btw-gegevens of toepasselijke vrijstelling. Afhaallocatie is
  geen bewijs van een juridisch vestigingsadres.
- Goedgekeurde zakelijke mailbox en telefoon/directe bereikbaarheid voor klanten,
  privacy, herroeping en klachten; geen privégegevens van studenten publiceren.
- Fiscale behandeling van de vier bevestigde consumentenprijzen, deliverygebied,
  leveringskosten en retourkosten; geen extra bedrag of boete is nu vastgesteld.
- Wie is verwerkingsverantwoordelijke, wie zijn verwerkers en wie mag welke
  klantgegevens zien? Leg overeenkomsten, doorgiften/waarborgen en hostinglogs vast.
- Bewaar-/verwijdertermijnen per categorie (aanvragen, orders, betaaladministratie,
  klachten, logs, back-ups) en eindeschooljaarprocedure; AVG-verzoeken behandelen.
- Bevestiging van elektronische betaalmethode en praktische klachtenafhandeling.
- Goedkeuring van juridische teksten, modelformulier en de bevestigingsprocedure.

## Duurzame bevestiging zonder automatische e-mail

Een ontvangstscherm, wijzigbare webpagina of link naar voorwaarden is niet op
zich een voldoende contractbevestiging. Een downloadknop alleen bewijst evenmin
dat de bevestiging werkelijk aan de klant is verstrekt. On-screen succes mag
dus nooit de volledige procedure vormen.

Voorgestelde route voor Phase 2, pas na goedkeuring:

1. Als essentiële kosten/voorwaarden nog niet bekend zijn: uitsluitend een
   **vrijblijvende bestelaanvraag**. Knop: `Vrijblijvende aanvraag versturen`.
   Benoem dat deze ontvangst geen overeenkomst en geen betaling veroorzaakt.
2. Bevoegd teamlid maakt een volledig aanbod met alle kosten, verkopergegevens,
   leveringsafspraak, voorwaardenversie, privacyinformatie, herroepingsinstructies
   en ingevuld modelformulier. Verstuur dit persoonlijk vanuit de goedgekeurde
   zakelijke mailbox (geen nieuwe integratie nodig), als tekst plus onveranderlijke
   bijlage. Leg afzonderlijk klantakkoord en contractmoment vast; start productie
   pas na de afgesproken bevestigingsstap.
3. Verstrek de afgesloten overeenkomst op een duurzame drager binnen redelijke
   termijn en uiterlijk bij levering. Een handmatig verzonden e-mail met volledige
   bevestiging/bijlage is een praktische optie. Als e-mail niet wordt gebruikt,
   is een tijdig verstrekt volledig papieren exemplaar een te beoordelen alternatief;
   dit vervangt niet zonder meer de elektronische ontvangstmelding.
4. Bewaar een onveranderlijke snapshot van producten, aantallen, prijzen, kosten,
   afspraken, voorwaarden, herroepingstekst en formulier met datum/versie. Registreer
   verzending/overhandiging, ontvanger en mislukking; behandel niet-afleverbare
   bevestigingen vóór levering. Publiceer geen document met persoonsgegevens op
   een openbaar voorspelbaar URL-adres.

Een eventuele latere direct bindende checkout heeft alle kosten en essentiële
voorwaarden vooraf vaststaan, een laatste controle-/correctiestap en de knop
`Bestelling met betalingsverplichting`. Betaling bij afhaling verandert die
verplichting niet. Geen vooraangevinkte akkoordvakken; een lees-/voorwaardenakkoord
is geen algemene AVG-toestemming en geen afstand van herroepingsrecht.

Zonder aantoonbaar werkende duurzame bevestiging blijven beide workflows dicht.
Een privéaccount/PDF-oplossing vereist apart onderzoek naar beschikbaarheid,
ongewijzigde opslag, actieve kennisgeving en bewijs van verstrekking.

## Technische releasevoorwaarden voor Phase 2

Begin met lokale Worker/D1-migraties en synthetische testgegevens. Server rekent
prijzen/kosten opnieuw uit, valideert producten/aantallen, bewaakt orderpauzes en
idempotentie en bewaart onveranderlijke snapshots. Geen vertrouwen op localStorage
of de disabled knop als serverbeveiliging. Activeer geen endpoint enkel met een
client-side boolean. Een vrijblijvende aanvraag is een apart domeinstatusmodel;
ontvangst, aanbod, akkoord en contractbevestiging moeten onderscheidbaar zijn.

Implementeer online herroeping met een vindbare functie gedurende de termijn,
minimale identificatie, duidelijke bevestigingsstap en onverwijlde bevestiging van
inhoud/datum/tijd op duurzame drager. Vermijd extra accounts als drempel.
Deze functie verwerkt persoonsgegevens en moet dezelfde beveiliging krijgen.

Cloudflare Access: individuele toegelaten identiteiten voor meerdere gemachtigde
studenten, minimale rollen, servervalidatie op iedere private API, intrekken van
toegang en audit zonder klantgegevens in algemene logs. Geen gedeelde login.
Configureer Turnstile, rate limits, verwerkersafspraken en bewaartermijnen vóór
productie. Controleer hostingopslag/cookies en free-tiergrenzen opnieuw.

Geen productieclaim zolang foto's, schoolgoedkeuring, identiteit, btw, kosten,
bereikbaar klantencontact, privacyproces, herroeping en duurzame bevestiging openstaan.
