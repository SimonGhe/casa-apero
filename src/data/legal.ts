export const legalVersion = 'Concept 0.1 · 24 oktober 2026';

export const legalPages = [
  { path: '/algemene-voorwaarden', title: 'Algemene voorwaarden' },
  { path: '/privacy', title: 'Privacyverklaring' },
  { path: '/wettelijke-vermeldingen', title: 'Wettelijke vermeldingen' },
  { path: '/herroepingsrecht', title: 'Herroepingsrecht, retouren en klachten' },
  { path: '/cookies', title: 'Cookiebeleid' },
] as const;

// Deliberately no submission mode, endpoint or customer fields in this phase.
export const checkoutStatus = 'inactive' as const;
