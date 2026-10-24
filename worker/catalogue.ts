import {validateCatalogue} from '../shared/catalogue.ts';
import type {Catalogue,Product} from '../shared/catalogue.ts';
export const PUBLIC_PRODUCT_SQL='SELECT id,variant_id,name,description,slug,category,type_label,images_json,price_cents,production_days,orders_paused FROM products WHERE published=1 ORDER BY sort_order,id';
export type PublicProductRow={id:string;variant_id:string;name:string;description:string;slug:string;category:Product['category'];type_label:string;images_json:string;price_cents:number;production_days:number;orders_paused:number};
export function projectCatalogue(rows:PublicProductRow[],paused:string|null):Catalogue{
 return validateCatalogue({products:rows.map(row=>({id:row.id,slug:row.slug,name:row.name,description:row.description,category:row.category,typeLabel:row.type_label,images:JSON.parse(row.images_json),variants:[{id:row.variant_id,label:'Standaard',priceCents:row.price_cents}],estimatedProductionDays:row.production_days,ordersPaused:row.orders_paused!==0})),shopSettings:{ordersPaused:paused!=='false',pauseMessage:'We nemen even de tijd voor onze lopende bestellingen. Nieuwe bestellingen zijn tijdelijk gepauzeerd.'}});
}
export async function readCatalogue(db:D1Database){
 const rows=await db.prepare(PUBLIC_PRODUCT_SQL).all<PublicProductRow>();
 const paused=await db.prepare("SELECT value FROM application_settings WHERE key='orders_paused'").first<string>('value');
 return projectCatalogue(rows.results,paused);
}
