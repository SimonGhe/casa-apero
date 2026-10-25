export const business = {
  about: [
    'Wij zijn Casa Apero, een mini-onderneming van 8 enthousiaste studenten met een passie voor keramiek en gezellig tafelen. Met veel liefde maken we onze eigen keramieken potjes en schalen. We vinden het belangrijk dat mensen samenkomen, genieten van lekker eten en mooie momenten delen aan tafel.',
    'We werken op een duurzame manier en omdat elk product met de hand gemaakt wordt, is elk stuk uniek. Met Casa Apero willen we van elk aperomoment iets bijzonders maken!',
  ],
  pickupArea: 'Julius en Maurits Sabbestraat, Brugge',
  productionTime: 'Ongeveer 2 weken. Dit is een schatting, geen gegarandeerde deadline.',
  delivery: import.meta.env.MODE==='shop'?'We bieden alleen afhaling op afspraak aan.':'Lokale levering rond Brugge is mogelijk in overleg. De mogelijkheden en eventuele kosten worden vooraf samen afgesproken.',
  payment: import.meta.env.MODE==='shop'?'Je betaalt bij afhaling: contant of via een vooraf afgesproken elektronische betaalmethode.':'Je betaalt bij afhaling of levering: contant of via een goedgekeurde elektronische betaalmethode.',
  // Vite only exposes this value after explicit publication approval at build time.
  publicContactEmail: __CASA_PUBLIC_CONTACT_EMAIL__,
  instagram: 'https://www.instagram.com/casa.apero.officieel/',
  tiktok: 'https://www.tiktok.com/@casa_apero',
};
