import { useEffect, useRef } from 'react';
import type { LocalConfig } from '../../shared/orders';

declare global {
  interface Window {
    turnstile?: {
      render: (element: HTMLElement, options: Record<string, unknown>) => string;
      remove: (id: string) => void;
    };
  }
}
export function Turnstile({ config, onToken, reset }: { config: LocalConfig; onToken: (token: string) => void; reset: number }) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (import.meta.env.MODE!=='test-checkout'&&import.meta.env.MODE!=='shop'&&config.turnstileMode === 'local-mock') { onToken('local-test-token'); return; }
    if (!config.siteKey || !['siteverify', 'siteverify-test'].includes(config.turnstileMode ?? '')) return;
    let cancelled = false;
    let id: string | undefined;
    const script = document.createElement('script');
    const render = () => {
      if (!cancelled && container.current && window.turnstile) id = window.turnstile.render(container.current, {
        sitekey: config.siteKey, action: 'order-request', callback: onToken,
        'expired-callback': () => onToken(''), 'error-callback': () => onToken(''),
      });
    };
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.onload = render;
    if (window.turnstile) render(); else document.head.appendChild(script);
    return () => { cancelled = true; if (id) window.turnstile?.remove(id); script.remove(); };
  }, [config, onToken, reset]);
  return config.turnstileMode === 'local-mock' ? <p className="summary-note">Beveiliging: lokale simulatie voor tests; er wordt geen Turnstile-script geladen.</p> : <div ref={container} aria-label="Beveiligingscontrole" />;
}
