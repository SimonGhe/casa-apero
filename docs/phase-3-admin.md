# Phase 3 — lokale studentenadministratie

Geïmplementeerd op `develop`, uitsluitend met lokale D1 en fictieve gegevens.
Geen push, deployment, productie-D1-koppeling, Access-aanpassing of echte bestelling.
De bestaande online staging Worker is niet gewijzigd en blijft alle API's weigeren.

## Lokaal openen

Vanuit `G:\Programming\sites\casa-apero`, met Node.js 24 en pnpm:

```powershell
pnpm.cmd install --frozen-lockfile
pnpm.cmd db:migrate
pnpm.cmd dev
```

In een tweede terminal:

```powershell
pnpm.cmd dev:admin
```

Open **http://127.0.0.1:5180/** en kies **Lokale testbeheerder starten**.
Dit is een fictieve ontwikkelsessie, geen Cloudflare Access-login. De lokale
storefront op poort 5173 en admin op 5180 delen dezelfde gesimuleerde D1-binding.
Beide servers luisteren uitsluitend op loopback. Gebruik geen echte klantgegevens.
Vite-caches zijn per modus gescheiden om gelijktijdige servers niet te verstoren.

Optionele demogegevens, wanneer beide servers draaien:

```powershell
pnpm.cmd demo:admin
```

Dit maakt drie nieuwe fictieve aanvragen: Nieuw, In productie en Afgerond/Betaald.
De bestaande vier producten/prijzen worden niet aangepast en ontbrekende kosten
worden niet ingevuld. Iedere uitvoering maakt nieuwe herkenbare testreferenties.
Voor de demo moeten de lokale aanvragen/producten niet gepauzeerd zijn en Olive
nog de bevestigde standaardprijs van 699 cent hebben. De demo verstuurt geen mail
en registreert alleen een fictieve bevestiging en contante betaling.

## Wat werkt

- Overzicht met nieuwe aanvragen, actieve productie en netto betaalde omzet in
  het huidige Brusselse kalenderjaar.
- Naam-/referentiezoekopdracht, paginering per 50 records en afzonderlijke details.
- Werkstatussen: Nieuw → Bevestigd → In productie → Klaar voor afhaling → Afgerond.
  Annuleren kan vóór afronding; afgerond/geannuleerd zijn eindstatussen.
- Interne notities, bevestigde afspraken en afzonderlijke betaalregistratie.
- Bevestiging vereist expliciete leveringskosten, afspraken en een beschrijving
  plus tijdstip van verstrekte duurzame bevestiging. De app produceert/verstuurt
  die bevestiging niet en controleert niet inhoudelijk of het bewijs rechtsgeldig is.
- Betaling: Onbetaald, Betaald, Deels terugbetaald, Terugbetaald. Ontvangen bedragen
  moeten het afgesproken totaal zijn. Er is geen automatische gateway of mail.
  Geen betalingen op vrijblijvende aanvragen; geen nieuwe betaling op geannuleerde
  orders. Eerdere ontvangsten worden met een afzonderlijke terugbetaling gecorrigeerd.
- Productnaam, omschrijving, prijs, onbekende/geschatte kostprijs, productiedagen,
  beschikbaarheid en productpauze in lokale D1; aparte globale bestelpauze.
  Bestaande itemprijzen blijven onveranderd. Bij bevestiging worden nog ontbrekende
  kostensnapshots eenmaal aangevuld vanuit de dan beschikbare productkosten.
- Fysieke evenementverkopen als samenvatting zonder klantgegevens, met aantallen,
  werkelijk ingevoerde stukprijzen en kostensnapshots. Een foutieve samenvatting
  wordt met reden ongeldig gemaakt en financieel tegengeboekt, niet verwijderd.
- Rapportperiode tot 366 dagen, order-/marktomzet, bekende geschatte productkosten,
  ontbrekende kosten en geschatte bijdrage/winst op productkosten.
- Excel-CSV voor orders en financieel log; auditweergave voor de laatste 100 acties
  en per order maximaal 100 wijzigingen.

De openbare storefrontteksten/foto's/prijzen blijven uit de bestaande vaste
catalogus komen. De lokale checkout rekent wel met D1 en respecteert wijzigingen
en pauzes server-side. Volledige dynamische publicatie van productmetadata moet
vóór productie apart geïntegreerd/getest worden. De admin benoemt dit expliciet.
Wijzigingen in lokale D1 publiceren niets naar staging of productie.

## Beveiligingsgrens

Er is een aparte Worker (`worker/admin.ts`), configuratie en frontend-entrypoint.
De storefront importeert geen admincode; staging blijft op `worker/staging.ts`
zonder DB of adminimports. `build:admin` gebruikt `wrangler.admin.jsonc` met
APP_ENV=disabled, geen D1, geen route, workers.dev uit, previews uit en wijzigingen
uit. Er is geen admin-deployscript. Een admin-build weigert alle publieke toegang.

Iedere admin-API controleert authenticatie/authorisatie vóór toegang tot D1,
ook exports, instellingen, details, rapporten en onbekende routes. API-responses
zijn `private, no-store`, noindex en nosniff; er zijn geen CORS-uitzonderingen.
Schrijfacties vereisen een exacte same-origin Origin en weigeren cross-site fetches.
Invoer is begrensd tot 16 KiB; tekst, bedragen, data, aantallen en statussen worden
gevalideerd. SQL-waarden gebruiken bindings, geen interpolatie van invoer.
Receiptcodes worden niet in adminresponsen opgenomen. Er is geen klant-/financiële
opslag in localStorage of sessionStorage en geen logging van klantpayloads.

### Fictieve lokale sessie

Alleen APP_ENV=local-admin, ADMIN_AUTH_MODE=local-session én een exacte loopbackhost
activeren de lokale login. Deze geeft een HS256-sessie voor maximaal twee uur,
met een cryptografisch willekeurige sleutel die uitsluitend in Worker-geheugen
bestaat. De cookie is HttpOnly, SameSite=Strict en beperkt tot `/api/admin`.
Omdat de lokale server HTTP gebruikt heeft deze ontwikkelcookie geen Secure-vlag.
Een Worker-herstart maakt bestaande sessies ongeldig. Afmelden verwijdert de cookie;
voor lokaal gestolen sessietokens bestaat geen afzonderlijke revocatielijst.
Deze route werkt niet op admin.casa-apero.com, workers.dev of staging.

### Voorbereide Cloudflare Access-validatie

De echte code accepteert uitsluitend HTTPS op exact **admin.casa-apero.com**,
APP_ENV=admin en ADMIN_AUTH_MODE=access. Alternatieve hostnamen, workers.dev,
publieke winkel- en staging-hostnamen worden vóór JWT-validatie geweigerd,
ongeacht een aangeleverde identiteit of een geldig JWT.

Nog te configureren, uitsluitend na goedkeuring voor een volgende fase:

- `ACCESS_ISSUER`: exacte `https://<team>.cloudflareaccess.com`, niet uit het JWT
  of een requestheader afgeleid. Alleen dit domeinpatroon is toegestaan.
- `ACCESS_AUDIENCE`: AUD-tag van de bestaande specifieke admin-Access-applicatie.
- `ADMIN_EMAIL_ALLOWLIST`: expliciet toegelaten, afzonderlijke beheerdersadressen;
  deze blijven server-side en worden niet in frontendcode geplaatst.
- Een apart goedgekeurde DB-binding en pas daarna `ADMIN_WRITES_ENABLED=true`.
  Ontbrekende waarden weigeren toegang; ontbrekende schrijfgoedkeuring weigert edits.

De server valideert `Cf-Access-Jwt-Assertion` met **jose** en de vaste issuer-JWKS
op `/cdn-cgi/access/certs`: RS256-signatuur, issuer, audience, vervaltijd, nbf,
sub/iat/email en applicatietype `app`. Pas daarna wordt de geverifieerde e-mail
tegen de allowlist gecontroleerd. `Cf-Access-Authenticated-User-Email`, een cookie
met Access-naam, forwarding-headers of clientrollen zijn geen autorisatiebewijs.
JWKS heeft een begrensde cache en timeout en ondersteunt sleutelrotatie via jose.
Netwerk-/sleutelfouten weigeren toegang. Alleen ondertekende lokale fixtures zijn
getest; de echte Access-applicatie is niet benaderd of aangepast.

Alle toegelaten studenten hebben in deze eerste versie dezelfde beheerdersrol.
Er worden geen onbevoegde leerlingen toegelaten en er is geen gedeelde productielogin.
Verdere rolverdeling (bijvoorbeeld productie zonder financiën/exports) moet vóór
een uitbreiding van de gebruikersgroep worden vastgelegd. Een Access-policy is
aanvullend vereist; de serverallowlist vervangt niet de edgepolicy.

## Dataconsistentie en audit

Migratie `0003_administration.sql` voegt kolommen aan bestaande orders/producten/
instellingen toe en maakt `event_sales`, `event_sale_items`, `audit_log` en
`financial_events`. Bestaande productnamen/prijzen en aanvragen blijven behouden.
Geldbedragen zijn integercenten. Er is geen voorraadmodel of voorraadaftrek.

Order-, betaal-, product- en pauzewijzigingen hebben een verwacht versienummer.
Een D1-batch werkt alleen bij die versie en voegt alle vervolgschrijfacties/audits
alleen bij de eigen mutatie-ID toe. Een gelijktijdige bewerker krijgt 409 en moet
vernieuwen. Geen dubbele boeking bij opnieuw versturen van een oude versie.
Fysieke samenvattingen gebruiken een unieke verzendcode plus genormaliseerde
payloadhash voor idempotentie; gewijzigde payload met dezelfde code geeft 409.
Bij een onbekende netwerkuitkomst moet de gebruiker eerst vernieuwen/controleren;
een paginaherlading bewaart geen invoer of verzendcode van de marktsamenvatting.

Alle financiële ontvangsten en terugbetalingen zijn afzonderlijke, positieve/negatieve
ledgerbedragen (geen echte banktransacties). Terugbetalingen zijn cumulatief en
kunnen niet hoger dan ontvangen bedragen worden. Kosten bij terugbetaling worden
naar verhouding in centen teruggenomen; cumulatieve afronding sluit bij volledig
terugbetalen exact aan. Betaalmethode en iedere mutatie worden geaudit.
Auditactor is de geverifieerde subject-ID, niet een clientveld.
Audit- en financiële tabellen zijn via SQLite-triggers append-only. Dit beschermt
applicatiebewerkingen; een beheerder met directe database/schema-macht kan deze
triggers verwijderen. Dit is geen externe onveranderlijke auditopslag.

## Rapportage en CSV

Aanvragen en onbetaalde bevestigingen tellen niet als omzet. Cashregistraties
volgen hun Brusselse registratiedatum; marktverkopen volgen de evenementdatum.
Een geannuleerde maar nog niet terugbetaalde ontvangst blijft in netto ontvangen
omzet staan totdat de terugbetaling is geregistreerd. Een ongeldig gemaakte
marktsamenvatting corrigeert haar oorspronkelijke evenementdatum.

Ontbrekende productkosten worden niet als nul aangenomen. Bij onbekende kosten
wordt totale geschatte winst NULL/Onbekend; het bekende deel staat apart.
De schatting is alleen op geregistreerde productkosten gebaseerd; vervoer, andere
bedrijfskosten en fiscale afhandeling zijn niet opgenomen. Het is geen nettowinst,
omzetbelastingberekening of wettelijke boekhouding. Oude betalingen zonder
ledger worden niet verzonnen/automatisch overgenomen; de vorige fase had alleen
onbetaalde fictieve aanvragen. Review een eventuele historische import apart.

Export is begrensd tot 10.000 regels en de gekozen periode, met UTF-8 BOM,
puntkomma's, decimale komma en CRLF. Tekstcellen worden volledig gequote en quotes
verdubbeld; formuleprefixen inclusief leidende whitespace worden geneutraliseerd.
Vertrouwde numerieke negatieve terugbetalingen blijven numerieke waarden.
Orderexport bevat persoonsgegevens en mag alleen intern gedeeld worden.
De orderexport selecteert aanmaakdatums in UTC; het financiële rapport gebruikt
de expliciete Brusselse boekingsdatum. Harmoniseer deze daggrens vóór productie.

## Tests en bouw

Gecontroleerd op 24 oktober 2026: TypeScript en alle drie builds (storefront,
admin-disabled en staging) geslaagd; 45 unit/integratietests, 36 bestaande
storefrontbrowsertests, 8 adminbrowsertests en 4 lokale stagingbrowsertests geslaagd.
Dependency-audit: geen bekende kwetsbaarheden. De lokale migratie is toegepast;
de fictieve demo doorloopt aanvraag, productie, afronding en betaalregistratie.
Mobiele adminweergave is visueel nagekeken. Artefactcontrole bevestigt dat
storefront/staging geen adminmodule of allowlist bevatten en de admin-build
APP_ENV=disabled, nul D1-bindingen, geen routes en workers.dev uit heeft.

```powershell
pnpm.cmd typecheck
pnpm.cmd build
pnpm.cmd build:admin
pnpm.cmd build:staging
pnpm.cmd test
pnpm.cmd test:e2e
pnpm.cmd test:admin
pnpm.cmd test:staging
pnpm.cmd audit
```

Alle tests blijven lokaal. De admintests gebruiken geïsoleerde Miniflare-D1's of
fictieve records in de lokale ontwikkel-D1. Adminbrowsertests draaien één worker
tegelijk en herstellen tijdelijke product-/pauzewijzigingen; voer ze sequentieel
met storefronttests uit omdat deze dezelfde lokale database gebruiken.
Adminartefacten staan in genegeerd `admin-test-results`; builds in `dist-admin`.
JWT-tests maken hun eigen RSA-sleutels in geheugen en dekken geldige tokens,
verkeerde signatuur/issuer/audience, verval/nbf, ontbrekende machtiging en hostbypass.

## Overige lanceringsvoorwaarden

- School/Vlajo-goedkeuring van verkoper, btw/prijsvermelding, privacyrollen,
  bewaartermijnen, proces voor inzage/verwijdering, levering en retouren.
- Daadwerkelijke duurzame contractbevestiging en online herroeping/ontvangstbewijs.
- Echte Access issuer/AUD, studentallowlist, policy, sessieduur en intrekken van toegang;
  eventuele rolverdeling, Access end-to-end-tests, productiebeveiliging/rate limits.
- Expliciete goedkeuring voor productie-D1-binding, eventuele migratie en deployment.
- Synchronisatie van publieke productmetadata met goedgekeurde D1-data, echte foto's,
  herziening van logging/back-ups, netto-kostencategorieën en fiscale rapportage.
- Herstelproces voor afgebroken mutaties/marktinvoer, CSV-deling en historische data.

## Bestanden

Nieuw: migratie 0003; `worker/admin.ts`, `worker/admin/auth.ts`, `api.ts`, `domain.ts`;
`shared/admin.ts`; `src/admin/main.tsx`, `Dashboard.tsx`, `api.ts`, `admin.css`;
beide `wrangler.admin*.jsonc`; `scripts/admin-demo.mjs`; `playwright.admin.config.ts`;
`tests/admin/dashboard.spec.ts`; drie `tests/unit/admin*.test.ts`; deze documentatie.
Gewijzigd: `vite.config.ts`, `package.json`, lockfile, `.gitignore`, README en
implementatieplan. De bestaande storefront/order/staging-handlers blijven intact.

Officiële bronnen gecontroleerd:
[Cloudflare JWT-validatie](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/)
en [Access application tokens](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/application-token/).
