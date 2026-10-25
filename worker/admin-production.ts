import {adminApi,privateHeaders} from './admin/api';
import type {AdminEnv} from './admin/api';
import {authorizeAccess,sameOrigin} from './admin/access';
import {requireProductionDatabase} from './production-guard';
import {limitAdminWrites} from './admin/write-rate-limit';
import {ApiError} from './validation';
export default{async fetch(request:Request,env:AdminEnv):Promise<Response>{
 try{
  const actor=await authorizeAccess(request,env);if(env.APP_ENV!=='admin'||!env.DB)throw new ApiError(403,'admin_disabled','Beheer niet vrijgegeven.');
  await requireProductionDatabase(env.DB);const path=new URL(request.url).pathname;
  if(path==='/api/admin/local-login'||path==='/api/admin/logout'||/^\/(?:__debug|src|node_modules|@vite|@fs)(?:\/|$)/.test(path)||/\.(?:sql|map)$/.test(path))throw new ApiError(403,'forbidden','Niet beschikbaar.');
  if(path==='/api/admin'||path.startsWith('/api/admin/')){
   if(!['GET','HEAD'].includes(request.method)){sameOrigin(request);if(env.ADMIN_WRITES_ENABLED!=='true')throw new ApiError(403,'writes_disabled','Wijzigingen niet vrijgegeven.');await limitAdminWrites(env.DB,actor.id);}
   return adminApi(request,env);
  }
  if(path==='/api'||path.startsWith('/api/')||!['GET','HEAD'].includes(request.method))throw new ApiError(403,'forbidden','Niet beschikbaar.');
  const response=env.ASSETS?await env.ASSETS.fetch(request):new Response(null,{status:404});return new Response(response.body,{status:response.status,headers:{...Object.fromEntries(response.headers),...privateHeaders}});
 }catch(error){const e=error instanceof ApiError?error:new ApiError(503,'unavailable','Beheer tijdelijk niet beschikbaar.');return Response.json({error:{code:e.code,message:e.message}},{status:e.status,headers:privateHeaders});}
}};
