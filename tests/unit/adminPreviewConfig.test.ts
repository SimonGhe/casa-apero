import {expect,it} from 'vitest';
import {adminPreviewAccessConfig} from '../../src/lib/adminPreviewConfig';
it('keeps missing/placeholder Access configuration fail-closed and maps only validated server values',()=>{
 expect(adminPreviewAccessConfig({})).toEqual({ACCESS_ISSUER:'',ACCESS_AUDIENCE:'',ADMIN_EMAIL_ALLOWLIST:''});
 expect(adminPreviewAccessConfig({CASA_ADMIN_PREVIEW_ACCESS_AUDIENCE:'<paste exact AUD tag copied from Cloudflare>'}).ACCESS_AUDIENCE).toBe('');
 expect(adminPreviewAccessConfig({CASA_ADMIN_PREVIEW_ACCESS_ISSUER:'https://evil.invalid',CASA_ADMIN_PREVIEW_ADMIN_EMAIL_ALLOWLIST:'bad'})).toMatchObject({ACCESS_ISSUER:'',ADMIN_EMAIL_ALLOWLIST:''});
 expect(adminPreviewAccessConfig({CASA_ADMIN_PREVIEW_ACCESS_ISSUER:'https://fixture.cloudflareaccess.com/',CASA_ADMIN_PREVIEW_ACCESS_AUDIENCE:'a'.repeat(64),CASA_ADMIN_PREVIEW_ADMIN_EMAIL_ALLOWLIST:' TEST@EXAMPLE.INVALID '})).toEqual({ACCESS_ISSUER:'https://fixture.cloudflareaccess.com',ACCESS_AUDIENCE:'a'.repeat(64),ADMIN_EMAIL_ALLOWLIST:'test@example.invalid'});
});
