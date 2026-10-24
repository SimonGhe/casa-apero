export const EVENT_ATTEMPT_KEY='casa-apero.admin.event-attempt';
export function readEventAttempt():string|null{
 try{const id=sessionStorage.getItem(EVENT_ATTEMPT_KEY);return id&&/^[a-f0-9-]{36}$/.test(id)?id:null;}catch{return null;}
}
export function persistEventAttempt(id:string){
 // Opaque request ID only. No form contents, customer fields or JWTs.
 try{sessionStorage.setItem(EVENT_ATTEMPT_KEY,id);}catch{throw new Error('Je browser kan de verzendcode niet bewaren. Er is niets verstuurd.');}
}
export function finishEventAttempt(){try{sessionStorage.removeItem(EVENT_ATTEMPT_KEY);}catch{/* No new request is sent here. */}}
