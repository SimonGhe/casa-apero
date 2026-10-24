import { adminApi,privateHeaders } from './admin/api';
import type { AdminEnv } from './admin/api';
import { authorizeAccess } from './admin/access';
import { requirePreviewDataset } from './admin/preview-guard';
import { ApiError } from './validation';
import { sameOrigin } from './admin/access';
import { limitAdminWrites } from './admin/write-rate-limit';
export interface PreviewEnv extends AdminEnv {ADMIN_PREVIEW_DATASET?:string;CHECKOUT_ENABLED?:string}
export default {
 async fetch(request:Request,env:PreviewEnv):Promise<Response>{
  try{
   // Authenticate the exact origin before looking at the database or assets.
   const actor=await authorizeAccess(request,env);
   const path=new URL(request.url).pathname;
   if(path==='/api/admin/local-login'||path==='/api/admin/logout'||/^\/(?:__debug|cdn-cgi\/local|src|node_modules|@vite|@id|@fs)(?:\/|$)/.test(path)||/\.(?:map|sql)$/.test(path))throw new ApiError(403,'preview_forbidden','Niet beschikbaar in de online beheertest.');
   await requirePreviewDataset(env);
   if(path==='/api/admin'||path.startsWith('/api/admin/')){
    if(!['GET','HEAD'].includes(request.method)){
     sameOrigin(request);
     if(env.ADMIN_WRITES_ENABLED!=='true')throw new ApiError(403,'writes_disabled','Beheerwijzigingen zijn nog niet ingeschakeld.');
     await limitAdminWrites(env.DB!,actor.id);
    }
    return await adminApi(request,env);
   }
   if(path==='/api'||path.startsWith('/api/'))throw new ApiError(403,'checkout_disabled','Klantbestellingen zijn uitgeschakeld.');
   if(!['GET','HEAD'].includes(request.method))throw new ApiError(403,'preview_forbidden','Deze actie is niet beschikbaar.');
   if(!env.ASSETS)throw new ApiError(503,'assets_unavailable','Beheerweergave niet beschikbaar.');
   const response=await env.ASSETS.fetch(request);
   return new Response(response.body,{status:response.status,headers:{...Object.fromEntries(response.headers),...privateHeaders}});
  }catch(error){
   const failure=error instanceof ApiError?error:new ApiError(503,'preview_unavailable','Beheertest tijdelijk niet beschikbaar.');
   return Response.json({error:{code:failure.code,message:failure.message}},{status:failure.status,headers:privateHeaders});
  }
 },
};
