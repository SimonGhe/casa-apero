// Build/server configuration only; never imported by the browser entry point.
export function adminPreviewAccessConfig(values:Record<string,string|undefined>){
 const issuer=(values.CASA_ADMIN_PREVIEW_ACCESS_ISSUER??'').trim().replace(/\/$/,'');
 const audience=(values.CASA_ADMIN_PREVIEW_ACCESS_AUDIENCE??'').trim();
 const emails=(values.CASA_ADMIN_PREVIEW_ADMIN_EMAIL_ALLOWLIST??'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
 return {
  ACCESS_ISSUER:/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(issuer)?issuer:'',
  ACCESS_AUDIENCE:/^[a-f0-9]{64}$/i.test(audience)?audience:'',
  ADMIN_EMAIL_ALLOWLIST:emails.length&&emails.every(x=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x))?emails.join(','):'',
 };
}
