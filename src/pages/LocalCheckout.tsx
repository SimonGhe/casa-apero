import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { LocalConfig, Quote, Receipt, RequestInput } from '../../shared/orders';
import { useCart } from '../context/CartContext';
import { money } from '../data/catalogue';
import { getLocalConfig, getQuote, getReceipt, OrderApiError, randomToken, RECEIPT_SESSION_KEY, sendRequest } from '../lib/orderApi';
import { Turnstile } from '../components/Turnstile';

export function LocalCheckout() {
  const { lines, clear } = useCart();
  const navigate = useNavigate();
  const [config, setConfig] = useState<LocalConfig>();
  const [pricing, setPricing] = useState<Quote>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(false);
  const [token, setToken] = useState('');
  const [reset, setReset] = useState(0);
  const onToken = useCallback((value: string) => setToken(value), []);
  const attempt = useRef<{ input: RequestInput; key: string } | null>(null);
  const selection = JSON.stringify(lines.map(({ productId, variantId, quantity }) => ({ productId, variantId, quantity })));

  useEffect(() => {
    let active = true;
    getLocalConfig().then((value) => { if (active) setConfig(value); }).catch(() => { if (active) setConfig({ localRequests: false }); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!config?.localRequests || selection === '[]') return;
    let active = true;
    setPricing(undefined);
    getQuote(JSON.parse(selection)).then((value) => { if (active) setPricing(value); }).catch((failure: Error) => { if (active) setError(failure.message); });
    return () => { active = false; };
  }, [config, selection]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !pricing || !token) return;
    setError(''); setBusy(true);
    try {
      if (!attempt.current) {
        const fields = new FormData(event.currentTarget);
        const input: RequestInput = {
          name: String(fields.get('name') ?? ''), email: String(fields.get('email') ?? ''), phone: String(fields.get('phone') ?? ''),
          arrangement: fields.get('arrangement') === 'delivery' ? 'delivery' : 'pickup',
          requestedDate: String(fields.get('requestedDate') ?? ''), notes: String(fields.get('notes') ?? ''),
          items: JSON.parse(selection), acknowledged: (fields.get('acknowledged') === 'on') as true,
          testDataOnly: (fields.get('testDataOnly') === 'on') as true,
          expectedSubtotalCents: pricing.subtotalCents, receiptToken: randomToken(),
        };
        // Only an opaque access code is stored; no customer form fields.
        sessionStorage.setItem(RECEIPT_SESSION_KEY, input.receiptToken);
        attempt.current = { input, key: crypto.randomUUID() };
      }
      await sendRequest(attempt.current.input, attempt.current.key, token);
      clear();
      navigate('/bestellen/ontvangen');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Aanvraag mislukt.');
      if (failure instanceof OrderApiError && [400, 403, 409, 413, 415].includes(failure.status)) {
        attempt.current = null;
        setPending(false);
        getQuote(JSON.parse(selection)).then(setPricing).catch(() => setPricing(undefined));
      } else setPending(Boolean(attempt.current));
      setReset((value) => value + 1);
    } finally { setBusy(false); }
  }

  if (!config) return <div className="content-width page-space"><h1 className="page-title">Lokale aanvraag</h1><p role="status">Beschikbaarheid controleren…</p></div>;
  if (!config.localRequests) return <div className="content-width page-space narrow-page"><h1 className="page-title">Bestellen is niet beschikbaar</h1><p>Het testformulier werkt uitsluitend in lokale ontwikkeling.</p><Link to="/bestellen">Bestelinformatie</Link></div>;
  return <div className="content-width page-space narrow-page local-checkout">
    <p className="eyebrow">Alleen lokale ontwikkeling</p><h1 className="page-title">Vrijblijvende testaanvraag</h1>
    <div className="notice"><strong>Gebruik uitsluitend fictieve testgegevens.</strong><p>Dit is geen aankoop of productieopdracht. Je gaat geen betalingsverplichting aan. Er worden geen e-mails verstuurd.</p></div>
    {error && <p className="notice" role="alert">{error}</p>}
    {!lines.length ? <p>Je winkelmand is leeg. <Link to="/collectie">Kies eerst een product</Link>.</p> : <>
      <section aria-label="Serverberekend overzicht"><h2>Jouw selectie</h2>{pricing ? <><ul className="checkout-lines">{pricing.items.map((line) => <li key={line.productId}><span>{line.name} · {line.quantity} × {money(line.unitPriceCents)}</span><strong>{money(line.totalCents)}</strong></li>)}</ul><p><strong>Totaal producten: {money(pricing.subtotalCents)}</strong></p></> : <p role="status">Prijzen en beschikbaarheid controleren…</p>}<p>Leveringskosten en definitief totaal: nog overeen te komen. Afhalen in Brugge op afspraak; lokale levering alleen in overleg. Betaling later bij afhaling of levering, contant of via een goedgekeurde elektronische methode.</p><p>Handgemaakt op bestelling: ongeveer twee weken productietijd, geen gegarandeerde deadline. Je voorkeursdatum moet afzonderlijk bevestigd worden.</p></section>
      <form onSubmit={submit} className="request-form">
        <fieldset disabled={busy || pending}><legend>Jouw fictieve contactgegevens</legend>
          <label>Naam<input name="name" autoComplete="off" required minLength={2} maxLength={100} /></label>
          <label>E-mailadres<input name="email" type="email" autoComplete="off" required maxLength={254} /></label>
          <label>Telefoonnummer (optioneel)<input name="phone" type="tel" autoComplete="off" maxLength={40} /></label>
          <label>Afhaling of levering<select name="arrangement"><option value="pickup">Afhalen in Brugge op afspraak</option><option value="delivery">Lokale levering aanvragen (kosten in overleg)</option></select></label>
          <label>Voorkeursdatum (optioneel)<input name="requestedDate" type="date" min={new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Brussels' })} /></label>
          <label>Opmerkingen (optioneel)<textarea name="notes" rows={3} maxLength={1000} /></label>
          <label className="request-check"><input name="acknowledged" type="checkbox" required />Ik heb de informatie gelezen en begrijp dat dit een vrijblijvende aanvraag is.</label>
          <label className="request-check"><input name="testDataOnly" type="checkbox" required />Ik gebruik uitsluitend fictieve testgegevens.</label>
        </fieldset>
        <p>Lees de <Link to="/algemene-voorwaarden">algemene voorwaarden</Link>, <Link to="/privacy">privacyverklaring</Link> en <Link to="/herroepingsrecht">informatie over herroeping</Link>. Voor standaardproducten geldt bij latere verkoop op afstand in beginsel 14 dagen bedenktijd na ontvangst. De conceptteksten moeten nog goedgekeurd worden.</p>
        <Turnstile config={config} onToken={onToken} reset={reset} />
        {pending && <p>Je vorige poging kan al verwerkt zijn. Opnieuw proberen gebruikt dezelfde gegevens en verzendcode en maakt geen tweede aanvraag. <Link to="/bestellen/ontvangen">Controleer het ontvangstbewijs</Link>.</p>}
        <button className="button button-primary" type="submit" disabled={!pricing || !token || busy}>{busy ? 'Aanvraag versturen…' : pending ? 'Dezelfde aanvraag opnieuw proberen' : 'Vrijblijvende testaanvraag versturen'}</button>
      </form>
    </>}
  </div>;
}

export function RequestConfirmation() {
  const [receipt, setReceipt] = useState<Receipt>();
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    try {
      const token = sessionStorage.getItem(RECEIPT_SESSION_KEY);
      if (!token) { setError('Geen ontvangstcode in dit tabblad.'); return; }
      getReceipt(token).then((value) => { if (active) setReceipt(value); }).catch((failure: Error) => { if (active) setError(failure.message); });
    } catch { setError('Je browser kan de ontvangstcode niet bewaren.'); }
    return () => { active = false; };
  }, []);
  return <div className="content-width page-space narrow-page">
    <p className="eyebrow">Lokale test</p><h1 className="page-title">{receipt ? 'Testaanvraag ontvangen' : 'Ontvangstbewijs'}</h1>
    {error ? <p role="alert">{error}</p> : receipt ? <>
      <p>Referentie: <strong data-testid="order-reference">{receipt.reference}</strong></p><p>Ontvangen op: {new Date(receipt.createdAt).toLocaleString('nl-BE', { timeZone: 'Europe/Brussels' })}</p>
      <p className="notice">Dit is alleen een ontvangstbewijs van een vrijblijvende testaanvraag. Er is geen koopovereenkomst, productieopdracht of betalingsverplichting. Dit scherm vervangt geen duurzame contractbevestiging.</p>
      <ul className="checkout-lines">{receipt.items.map((line) => <li key={line.productId}><span>{line.name} · {line.quantity} × {money(line.unitPriceCents)}</span><strong>{money(line.totalCents)}</strong></li>)}</ul>
      <p>Totaal producten: <strong>{money(receipt.subtotalCents)}</strong>. Leveringskosten en definitief totaal zijn nog niet overeengekomen.</p>
      <p>Status: aanvraag ontvangen; geen bevestigde aankoop. Er wordt niets geproduceerd en geen automatische e-mail verstuurd. Bij een toekomstige echte aanvraag moet het team eerst een volledig aanbod, afspraken en een afzonderlijke bevestiging verzorgen. De productie duurt daarna naar schatting twee weken; betaling bij afhaling of levering.</p>
    </> : <p role="status">Ontvangstbewijs ophalen…</p>}
    <Link className="text-link" to="/winkelmand">Terug naar je winkelmand</Link>
  </div>;
}
