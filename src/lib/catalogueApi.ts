import {validateCatalogue} from '../../shared/catalogue';
import type {Catalogue} from '../../shared/catalogue';
let pending:Promise<Catalogue>|undefined;
// Share in-flight work only. Every later read goes back to the authoritative API.
export function getCatalogue():Promise<Catalogue>{
 if(pending)return pending;
 const request=(async()=>{
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try{const response=await fetch('/api/catalogue',{cache:'no-store',signal:controller.signal});if(!response.ok)throw new Error('Collectie niet beschikbaar');return validateCatalogue(await response.json());}finally{clearTimeout(timer);}
 })();
 pending=request;request.then(()=>{pending=undefined;},()=>{pending=undefined;});return request;
}
