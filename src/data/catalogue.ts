// Generated snapshot for static previews. D1 is authoritative; see catalogue:snapshot.
import snapshot from './catalogue.snapshot.json';
import type {Catalogue} from '../../shared/catalogue';
export type {Product,ProductImage,ProductVariant} from '../../shared/catalogue';
export const {products,shopSettings}=snapshot as Catalogue;

export const money = (cents: number) => new Intl.NumberFormat('nl-BE', {
  style: 'currency', currency: 'EUR',
}).format(cents / 100);

export const leadTime = (days: number | null) => days === null
  ? 'Productietijd wordt nog bevestigd'
  : days === 14
    ? 'Geschatte productietijd: ongeveer 2 weken'
    : `Geschatte productietijd: ongeveer ${days} dagen`;
