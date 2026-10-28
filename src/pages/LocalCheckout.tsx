import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { LocalConfig, Quote, Receipt, RequestInput } from '../../shared/orders';
import { useCart } from '../context/CartContext';
import { money,leadTime } from '../data/catalogue';
import { getLocalConfig, getQuote, getReceipt, OrderApiError, randomToken, RECEIPT_SESSION_KEY, ATTEMPT_SESSION_KEY, sendRequest,authenticatedTestApi } from '../lib/orderApi';
import { Turnstile } from '../components/Turnstile';
import {useCatalogue} from '../context/CatalogueContext';
import {FICTIONAL_CUSTOMER,TEST_CHECKOUT_BASE} from '../../shared/testCheckout';
const loopbackApi={config:getLocalConfig,quote:getQuote,receipt:getReceipt,send:sendRequest},testerApi=authenticatedTestApi();

export function LocalCheckout({authenticatedTest=false,publicCheckout=false}:{authenticatedTest?:boolean;publicCheckout?:boolean}) {
  const {config:getLocalConfig,quote:getQuote,receipt:getReceipt,send:sendRequest}=authenticatedTest?testerApi:loopbackApi;
  const receiptKey=publicCheckout?'casa-apero.customer-receipt':authenticatedTest?'casa-apero.tester-receipt':RECEIPT_SESSION_KEY,attemptKey=publicCheckout?'casa-apero.customer-attempt':authenticatedTest?'casa-apero.tester-attempt':ATTEMPT_SESSION_KEY;
  const confirmationPath=authenticatedTest?TEST_CHECKOUT_BASE+'/ontvangen':'/bestellen/ontvangen';
  const { lines, clear,hasUnavailableItems } = useCart();
  const {ready:catalogueReady,shopSettings,publicConfig}=useCatalogue();
  const navigate = useNavigate();
  const [localConfig, setConfig] = useState<LocalConfig>();
  const config=publicCheckout?publicConfig:localConfig;
  const [pricing, setPricing] = useState<Quote>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(false);
  const [token, setToken] = useState('');
  const [reset, setReset] = useState(0);
  const onToken = useCallback((value: string) => setToken(value), []);
  const attempt = useRef<{ input: RequestInput; key: string } | null>(null);
  const formRef=useRef<HTMLFormElement>(null);
  const identity=useRef<{key:string;token:string}|null>(null);
  const [recovering,setRecovering]=useState(true),[resuming,setResuming]=useState(false);
  const selection = JSON.stringify(lines.map(({ productId, variantId, quantity }) => ({ productId, variantId, quantity })));
  useEffect(()=>{
    let active=true;
    try{
      const key=sessionStorage.getItem(attemptKey),receiptToken=sessionStorage.getItem(receiptKey);
      if(!key){setRecovering(false);return;}
      if(!/^[a-f0-9-]{36}$/.test(key)||!receiptToken||!/^[a-f0-9]{64}$/.test(receiptToken))throw new Error('De vorige verzendcode kan niet veilig worden hersteld. Start geen nieuwe aanvraag; laat het team dit controleren.');
      identity.current={key,token:receiptToken};setResuming(true);
      getReceipt(receiptToken).then(()=>{if(active){sessionStorage.removeItem(attemptKey);clear();navigate(confirmationPath);}}).catch(failure=>{if(!active)return;if(failure instanceof OrderApiError&&failure.status===404)setRecovering(false);else setError('De vorige aanvraag kan niet worden gecontroleerd. Vernieuw de pagina voordat je opnieuw probeert.');});
    }catch(failure){setError(failure instanceof Error?failure.message:'Browseropslag niet beschikbaar.');}
    return()=>{active=false;};
    // Only on entry: cart edits must not reset an unresolved submission identity.
  },[]);

  useEffect(() => {
    if(publicCheckout)return;
    let active = true;
    getLocalConfig().then((value) => { if (active) setConfig(value); }).catch(() => { if (active) setConfig({ localRequests: false }); });
    return () => { active = false; };
  }, [publicCheckout]);
  useEffect(() => {
    if (!config?.localRequests || selection === '[]') return;
    let active = true;
    setPricing(undefined);
    getQuote(JSON.parse(selection)).then((value) => { if (active) setPricing(value); }).catch((failure: Error) => { if (active) setError(failure.message); });
    return () => { active = false; };
  }, [config, selection]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || recovering || !pricing || !token || !catalogueReady||hasUnavailableItems||shopSettings.ordersPaused||lines.some(line=>line.product.ordersPaused)) return;
    setError(''); setBusy(true);
    try {
      if (!attempt.current) {
        const fields = new FormData(event.currentTarget);
        const codes=identity.current??{key:crypto.randomUUID(),token:randomToken()};
        const input: RequestInput = {
          name: String(fields.get('name') ?? ''), email: String(fields.get('email') ?? ''), phone: String(fields.get('phone') ?? ''),
          arrangement: String(fields.get('arrangement')) as RequestInput['arrangement'],
          requestedDate: String(fields.get('requestedDate') ?? ''), notes: String(fields.get('notes') ?? ''),
          items: JSON.parse(selection), acknowledged: (fields.get('acknowledged') === 'on') as true,
          testDataOnly: publicCheckout?false:fields.get('testDataOnly') === 'on',
          expectedSubtotalCents: pricing.subtotalCents, receiptToken: codes.token,
        };
        // Only an opaque access code is stored; no customer form fields.
        sessionStorage.setItem(receiptKey, input.receiptToken);
        sessionStorage.setItem(attemptKey,codes.key);identity.current=codes;
        attempt.current = { input, key: codes.key };
      }
      await sendRequest(attempt.current.input, attempt.current.key, token);
      sessionStorage.removeItem(attemptKey);
      clear();
      navigate(confirmationPath);
    } catch (failure) {
      if(failure instanceof OrderApiError&&failure.code==='idempotency_conflict'&&identity.current){
        try{await getReceipt(identity.current.token);sessionStorage.removeItem(attemptKey);clear();navigate(confirmationPath);return;}catch{/* Preserve the original key and fail closed. */}
      }
      setError(failure instanceof Error ? failure.message : 'Aanvraag mislukt.');
      if(failure instanceof OrderApiError&&failure.code==='price_changed'){
        const acknowledgement=formRef.current?.elements.namedItem('acknowledged');if(acknowledgement instanceof HTMLInputElement)acknowledgement.checked=false;
      }
      if (failure instanceof OrderApiError && [400, 403, 409, 413, 415].includes(failure.status)) {
        attempt.current = null;
        setPending(false);
        getQuote(JSON.parse(selection)).then(setPricing).catch(() => setPricing(undefined));
      } else setPending(Boolean(attempt.current));
      setReset((value) => value + 1);
    } finally { setBusy(false); }
  }

  if (!config) return <div className="content-width page-space"><h1 className="page-title">{publicCheckout?'Afhaalaanvraag':'Lokale aanvraag'}</h1><p role="status">Beschikbaarheid controleren…</p></div>;
  if (!config.localRequests||authenticatedTest&&!config.authenticatedTest||publicCheckout&&(!config.publicRequests||catalogueReady&&shopSettings.ordersPaused)) return <div className="content-width page-space narrow-page"><h1 className="page-title">{publicCheckout?'Bestelaanvragen tijdelijk gepauzeerd':'Bestellen is niet beschikbaar'}</h1><p>{publicCheckout?'We nemen tijdelijk geen nieuwe bestelaanvragen aan. Bestaande aanvragen blijven bij het team in behandeling.':authenticatedTest?'Geen geldige testersessie. Meld je opnieuw aan; gewone bestellingen blijven uitgeschakeld.':'Het testformulier werkt uitsluitend in lokale ontwikkeling.'}</p>{authenticatedTest&&<a href={TEST_CHECKOUT_BASE}>Testerlogin opnieuw openen</a>}<Link to="/collectie">Terug naar de collectie</Link></div>;
  return <div className="content-width page-space narrow-page local-checkout">
    <p className="eyebrow">{publicCheckout?'Afhalen op afspraak':authenticatedTest?'TESTVERSIE — GEEN ECHTE BESTELLING':'Alleen lokale ontwikkeling'}</p><h1 className="page-title">{publicCheckout?'Jouw afhaalaanvraag':'Vrijblijvende testaanvraag'}</h1>
    <div className="notice"><strong>{publicCheckout?'Het team beoordeelt je bestelaanvraag.':'Gebruik uitsluitend fictieve testgegevens.'}</strong><p>{publicCheckout?'Met deze aanvraag sluit je nog geen koopovereenkomst. Het team neemt persoonlijk contact op om je aanvraag en afhaling af te spreken. Je aanvraag wordt pas na persoonlijke bevestiging aanvaard. Er wordt geen automatische bevestigingsmail verstuurd. Betaling bij afhaling: contant of een vooraf afgesproken elektronische methode. Reken na bevestiging op ongeveer twee weken productie.':'Dit is geen aankoop of productieopdracht. Je gaat geen betalingsverplichting aan. Er worden geen e-mails verstuurd.'}</p></div>
    {error && <p className="notice" role="alert">{error} {authenticatedTest&&<a href={TEST_CHECKOUT_BASE}>Testerlogin opnieuw openen</a>}</p>}
    {resuming&&!recovering&&<p className="notice">Een vorige poging gebruikt dezelfde verzendcode. Controleer eerst <Link to={confirmationPath}>het ontvangstbewijs</Link>. Is er nog geen ontvangstbewijs? Vul je gegevens opnieuw in; dezelfde code voorkomt een tweede aanvraag.</p>}
    {recovering&&!error&&<p role="status">Vorige verzendpoging controleren…</p>}
    {hasUnavailableItems&&<p className="notice" role="alert">Een geselecteerd product is niet meer beschikbaar. <Link to="/winkelmand">Pas je winkelmand aan</Link>.</p>}
    {!lines.length ? <p>Je winkelmand is leeg. <Link to="/collectie">Kies eerst een product</Link>.</p> : <>
      <section aria-label="Serverberekend overzicht"><h2>Jouw selectie</h2>{pricing ? <><ul className="checkout-lines">{pricing.items.map((line) => <li key={line.productId}><span>{line.name} · {line.quantity} × {money(line.unitPriceCents)}</span><strong>{money(line.totalCents)}</strong></li>)}</ul><p><strong>{publicCheckout?'Totaal bij afhaling':'Totaal producten'}: {money(pricing.subtotalCents)}</strong></p></> : <p role="status">Prijzen en beschikbaarheid controleren…</p>}<p>Alleen afhaling op afspraak; geen afhaalkosten of online betaling. Je betaalt bij afhaling: contant of via een vooraf afgesproken elektronische methode.</p><p>Handgemaakt op bestelling. {pricing&&leadTime(Math.max(...pricing.items.map(line=>line.productionDays)))}; geen gegarandeerde deadline. Je voorkeursdatum moet afzonderlijk bevestigd worden.</p></section>
      <form ref={formRef} onSubmit={submit} className="request-form">
        <fieldset disabled={busy || pending}><legend>{publicCheckout?'Jouw contactgegevens':'Jouw fictieve contactgegevens'}</legend>
          {authenticatedTest&&<p>Je echte loginadres wordt niet als klantgegeven opgeslagen. Deze vaste fictieve gegevens kun je niet wijzigen. Er volgt geen echte betaling, productie of afhaling.</p>}
          <label>Naam<input name="name" autoComplete="off" required minLength={2} maxLength={100} readOnly={authenticatedTest} defaultValue={authenticatedTest?FICTIONAL_CUSTOMER.name:undefined} /></label>
          <label>E-mailadres<input name="email" type="email" autoComplete="off" required maxLength={254} readOnly={authenticatedTest} defaultValue={authenticatedTest?FICTIONAL_CUSTOMER.email:undefined} /></label>
          <label>Telefoonnummer (optioneel)<input name="phone" type="tel" autoComplete="off" maxLength={40} readOnly={authenticatedTest} defaultValue={authenticatedTest?'':undefined} /></label>
          {publicCheckout?<><input type="hidden" name="arrangement" value="pickup"/><p>Afhaling op afspraak. Je voorkeursdatum is nog geen bevestigde afspraak.</p></>:<label>Afhaling<select name="arrangement" required defaultValue=""><option value="" disabled>Kies afhaling op afspraak</option><option value="pickup">Afhalen in Brugge op afspraak</option></select></label>}
          <label>Voorkeursdatum (optioneel)<input name="requestedDate" type="date" min={new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Brussels' })} /></label>
          <label>Opmerkingen (optioneel)<textarea name="notes" rows={3} maxLength={1000} readOnly={authenticatedTest} defaultValue={authenticatedTest?FICTIONAL_CUSTOMER.notes:undefined} /></label>
          <label className="request-check"><input name="acknowledged" type="checkbox" required />Ik heb de informatie gelezen en begrijp dat dit een vrijblijvende aanvraag is.</label>
          {!publicCheckout&&<label className="request-check"><input name="testDataOnly" type="checkbox" required />Ik gebruik uitsluitend fictieve testgegevens.</label>}
        </fieldset>
        <p>Lees de <Link to="/algemene-voorwaarden">algemene voorwaarden</Link>, <Link to="/privacy">privacyverklaring</Link> en <Link to="/herroepingsrecht">informatie over herroeping</Link>. Voor standaardproducten geldt bij verkoop op afstand in beginsel 14 dagen bedenktijd na ontvangst. De documenten zijn nog als concept aangeduid waar gegevens of goedkeuring ontbreken.</p>
        <Turnstile config={config} onToken={onToken} reset={reset} />
        {pending && <p>Je vorige poging kan al verwerkt zijn. Opnieuw proberen gebruikt dezelfde gegevens en verzendcode en maakt geen tweede aanvraag. <Link to={confirmationPath}>Controleer het ontvangstbewijs</Link>.</p>}
        <button className="button button-primary" type="submit" disabled={recovering || !pricing || !token || busy || !catalogueReady || hasUnavailableItems || shopSettings.ordersPaused || lines.some(line=>line.product.ordersPaused)}>{busy ? 'Aanvraag versturen…' : pending ? 'Dezelfde aanvraag opnieuw proberen' : publicCheckout?'Bestelaanvraag versturen':'Vrijblijvende testaanvraag versturen'}</button>
      </form>
    </>}
  </div>;
}

export function RequestConfirmation({authenticatedTest=false,publicCheckout=false}:{authenticatedTest?:boolean;publicCheckout?:boolean}) {
  const getReceipt=authenticatedTest?testerApi.receipt:loopbackApi.receipt;
  const receiptKey=publicCheckout?'casa-apero.customer-receipt':authenticatedTest?'casa-apero.tester-receipt':RECEIPT_SESSION_KEY,attemptKey=publicCheckout?'casa-apero.customer-attempt':authenticatedTest?'casa-apero.tester-attempt':ATTEMPT_SESSION_KEY;
  const [receipt, setReceipt] = useState<Receipt>();
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    try {
      const token = sessionStorage.getItem(receiptKey);
      if (!token) { setError('Geen ontvangstcode in dit tabblad.'); return; }
      getReceipt(token).then((value) => { if (active) {setReceipt(value);sessionStorage.removeItem(attemptKey);} }).catch((failure: Error) => { if (active) setError(failure.message); });
    } catch { setError('Je browser kan de ontvangstcode niet bewaren.'); }
    return () => { active = false; };
  }, []);
  return <div className="content-width page-space narrow-page">
    <p className="eyebrow">{publicCheckout?'Afhaalaanvraag':authenticatedTest?'TESTVERSIE — GEEN ECHTE BESTELLING':'Lokale test'}</p><h1 className="page-title">{receipt ? publicCheckout?'Aanvraag ontvangen':'Testaanvraag ontvangen' : 'Ontvangstbewijs'}</h1>
    {error ? <p role="alert">{error}</p> : receipt ? <>
      <p>Referentie: <strong data-testid="order-reference">{receipt.reference}</strong></p><p>Ontvangen op: {new Date(receipt.createdAt).toLocaleString('nl-BE', { timeZone: 'Europe/Brussels' })}</p>
      <p className="notice">{publicCheckout?'Je afhaalaanvraag is opgeslagen. Het team beoordeelt je aanvraag en neemt persoonlijk contact op. Pas na persoonlijke bevestiging is het een bevestigde bestelling. Er wordt geen automatische e-mail verstuurd. Dit ontvangstbewijs sluit geen koopovereenkomst en vervangt geen persoonlijke contractbevestiging.':'Dit is alleen het oorspronkelijke ontvangstbewijs van een vrijblijvende testaanvraag. Dit ontvangstbewijs sluit geen koopovereenkomst en geeft geen productieopdracht of betalingsverplichting. Dit scherm vervangt geen duurzame contractbevestiging en toont geen actuele productie- of betaalstatus.'}</p>
      <ul className="checkout-lines">{receipt.items.map((line) => <li key={line.productId}><span>{line.name} · {line.quantity} × {money(line.unitPriceCents)}</span><strong>{money(line.totalCents)}</strong></li>)}</ul>
      <p>{publicCheckout?'Totaal bij afhaling':'Totaal producten'}: <strong>{money(receipt.subtotalCents)}</strong>. Geen afhaalkosten; alleen afhaling op afspraak.</p>
      <p>{publicCheckout?'We spreken de afhaling persoonlijk af. Betaling bij afhaling: contant of via een vooraf afgesproken elektronische methode. Na bevestiging duurt de productie ongeveer twee weken.':'Status bij ontvangst: aanvraag ontvangen; nog geen bevestigde aankoop. Deze registratie start geen productie en verstuurt geen automatische e-mail. Het team moet bij een toekomstige echte aanvraag eerst een volledig aanbod, afspraken en een afzonderlijke bevestiging verzorgen.'} {!publicCheckout&&leadTime(Math.max(...receipt.items.map(line=>line.productionDays)))}</p>
      {publicCheckout&&<button type="button" className="button button-secondary" onClick={()=>window.print()}>Ontvangstbewijs afdrukken of als PDF bewaren</button>}
    </> : <p role="status">Ontvangstbewijs ophalen…</p>}
    <Link className="text-link" to="/winkelmand">Terug naar je winkelmand</Link>
  </div>;
}
