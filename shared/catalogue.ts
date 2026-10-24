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

export type Catalogue = {products:Product[];shopSettings:{ordersPaused:boolean;pauseMessage:string}};
export function validateCatalogue(value:unknown):Catalogue{
 const data=value as Catalogue;
 const only=(object:object,keys:string[])=>Object.keys(object).every(key=>keys.includes(key));
 if(!data||!Array.isArray(data.products)||data.products.length>4||typeof data.shopSettings?.ordersPaused!=='boolean'||typeof data.shopSettings.pauseMessage!=='string')throw new Error('Ongeldige collectiegegevens.');
 if(!only(data,['products','shopSettings'])||!only(data.shopSettings,['ordersPaused','pauseMessage']))throw new Error('Onverwachte collectievelden.');
 const ids=new Set<string>(),slugs=new Set<string>();
 for(const p of data.products){
  if(!['olive','dune-mini','dune-grand','aperitivo'].includes(p.id)||ids.has(p.id)||slugs.has(p.slug)||!/^[-a-z0-9]+$/.test(p.slug)||typeof p.name!=='string'||!p.name.trim()||typeof p.description!=='string'||typeof p.typeLabel!=='string'||!['Kommetjes','Aperoschalen'].includes(p.category)||typeof p.ordersPaused!=='boolean'||!Number.isSafeInteger(p.estimatedProductionDays)||(p.estimatedProductionDays??0)<1||!Array.isArray(p.variants)||p.variants.length!==1||p.variants[0].id!==`${p.id}-standard`||!Number.isSafeInteger(p.variants[0].priceCents)||p.variants[0].priceCents<0||!Array.isArray(p.images)||!p.images.length)throw new Error('Ongeldige productgegevens.');
  if(!only(p,['id','slug','name','description','category','typeLabel','images','variants','estimatedProductionDays','ordersPaused'])||!only(p.variants[0],['id','label','colour','priceCents'])||typeof p.variants[0].label!=='string')throw new Error('Onverwachte productvelden.');
  for(const image of p.images)if(!only(image,['src','alt','crop','isPlaceholder'])||typeof image.src!=='string'||!image.src.startsWith('/assets/')||image.src.includes('..')||typeof image.alt!=='string'||typeof image.isPlaceholder!=='boolean'||(image.crop!==undefined&&!['table','bowls','platter','detail'].includes(image.crop)))throw new Error('Ongeldig productbeeld.');
  ids.add(p.id);slugs.add(p.slug);
 }
 return data;
}
