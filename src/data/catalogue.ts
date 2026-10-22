export type ProductImage = {
  src: string;
  alt: string;
  crop?: 'table' | 'bowls' | 'platter' | 'detail';
  isPlaceholder: boolean;
};

export type ProductVariant = {
  id: string;
  label: string;
  colour?: string;
  priceCents: number;
};

export type Product = {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: 'Kommetjes' | 'Aperoschalen';
  typeLabel: string;
  images: ProductImage[];
  variants: ProductVariant[];
  estimatedProductionDays: number | null;
  ordersPaused: boolean;
};

const image = (crop: ProductImage['crop']): ProductImage => ({
  src: '/assets/market-stand.png',
  alt: 'Tijdelijk beeld uit het oorspronkelijke Casa Apero sfeerbeeld. Geen foto van dit product; echte productfoto volgt.',
  crop,
  isPlaceholder: true,
});

// Each product has one internal standard SKU; this is not a customer-selectable variant.
export const products: Product[] = [
  {
    id: 'olive', slug: 'olive', name: 'Olive',
    description: 'Handgemaakt keramieken potje met een unieke groene binnenkant. Perfect voor dips, sausjes of kleine aperohapjes.',
    category: 'Kommetjes', typeLabel: 'Klein potje met groene binnenkant',
    images: [image('bowls'), image('table')],
    variants: [{ id: 'olive-standard', label: 'Standaard', priceCents: 699 }],
    estimatedProductionDays: 14, ordersPaused: false,
  },
  {
    id: 'dune-mini', slug: 'dune-mini', name: 'Dune Mini',
    description: 'Handgemaakt keramieken potje in een zachte beige tint met leuk detail. Ideaal voor olijven, nootjes of andere kleine hapjes.',
    category: 'Kommetjes', typeLabel: 'Klein beige potje',
    images: [image('detail'), image('bowls')],
    variants: [{ id: 'dune-mini-standard', label: 'Standaard', priceCents: 699 }],
    estimatedProductionDays: 14, ordersPaused: false,
  },
  {
    id: 'dune-grand', slug: 'dune-grand', name: 'Dune Grand',
    description: 'Handgemaakt keramieken potje met een natuurlijke beige uitstraling. Perfect voor grotere porties snacks of om te delen tijdens een aperomoment.',
    category: 'Kommetjes', typeLabel: 'Groot beige potje',
    images: [image('table'), image('detail')],
    variants: [{ id: 'dune-grand-standard', label: 'Standaard', priceCents: 1299 }],
    estimatedProductionDays: 14, ordersPaused: false,
  },
  {
    id: 'aperitivo', slug: 'aperitivo', name: 'Aperitivo',
    description: 'Handgemaakte keramieken aperoschalen, ideaal om hapjes stijlvol te serveren tijdens gezellige momenten met vrienden en familie.',
    category: 'Aperoschalen', typeLabel: 'Keramieken aperoschaal',
    images: [image('platter'), image('table')],
    variants: [{ id: 'aperitivo-standard', label: 'Standaard', priceCents: 2599 }],
    estimatedProductionDays: 14, ordersPaused: false,
  },
];

export const shopSettings = {
  ordersPaused: false,
  pauseMessage: 'We nemen even de tijd voor onze lopende bestellingen. Nieuwe bestellingen zijn tijdelijk gepauzeerd.',
};

export const money = (cents: number) => new Intl.NumberFormat('nl-BE', {
  style: 'currency', currency: 'EUR',
}).format(cents / 100);

export const leadTime = (days: number | null) => days === null
  ? 'Productietijd wordt nog bevestigd'
  : days === 14
    ? 'Geschatte productietijd: ongeveer 2 weken'
    : `Geschatte productietijd: ongeveer ${days} dagen`;
