import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getLocalConfig } from '../lib/orderApi';

export function LocalRequestLink() {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => { if (['staging','test-checkout','shop'].includes(import.meta.env.MODE)) return; let active = true; getLocalConfig().then((config) => { if (active) setEnabled(config.localRequests); }).catch(() => undefined); return () => { active = false; }; }, []);
  return import.meta.env.MODE !== 'staging' && enabled ? <div className="notice"><strong>Lokale ontwikkeltest</strong><p>Test een vrijblijvende aanvraag met uitsluitend fictieve gegevens. De openbare checkout blijft gesloten.</p><Link className="text-link" to="/bestellen/lokaal">Test het lokale bestelformulier</Link></div> : null;
}
