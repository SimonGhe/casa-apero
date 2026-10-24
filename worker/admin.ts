import { adminApi, privateHeaders } from './admin/api';
import type { AdminEnv } from './admin/api';
import { authorizeAdmin, localAdmin } from './admin/auth';
export default {
 async fetch(request: Request,env: AdminEnv): Promise<Response> {
   const url=new URL(request.url);
   if(url.pathname==='/api/admin'||url.pathname.startsWith('/api/admin/')) return adminApi(request,env);
   if(url.pathname.startsWith('/api/')) return Response.json({error:{code:'not_found',message:'Geen openbare API op deze beheeromgeving.'}},{status:404,headers:privateHeaders});
   try {
     if(!localAdmin(request,env)) await authorizeAdmin(request,env);
     if(!['GET','HEAD'].includes(request.method)) return new Response(null,{status:405,headers:privateHeaders});
     const result=env.ASSETS?await env.ASSETS.fetch(request):new Response(null,{status:404});
     return new Response(result.body,{status:result.status,headers:{...Object.fromEntries(result.headers),...privateHeaders}});
   } catch { return new Response('Beheer niet beschikbaar op deze host.',{status:403,headers:privateHeaders}); }
 },
};
