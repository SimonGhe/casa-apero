export class AdminApiError extends Error {
 constructor(public status:number,message:string){super(message);}
}
export async function adminApi<T>(path:string,body?:unknown,method=body===undefined?'GET':'PUT'):Promise<T> {
 const response=await fetch(`/api/admin/${path}`,{method,credentials:'same-origin',cache:'no-store',
   ...(body===undefined?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})});
 if(response.status===204)return undefined as T;
 const result=await response.json();
 if(!response.ok)throw new AdminApiError(response.status,result.error?.message??'Beheeractie mislukt.');
 return result;
}
export function euroInput(value:FormDataEntryValue|null):number {
 const text=String(value??'').trim().replace(',','.');
 if(!/^\d+(?:\.\d{1,2})?$/.test(text))throw new Error('Vul bedragen in met maximaal twee decimalen.');
 const [euros,decimals='']=text.split('.');return Number(euros)*100+Number(decimals.padEnd(2,'0'));
}
export const amount=(cents:number|null)=>cents===null?'':(cents/100).toFixed(2);
