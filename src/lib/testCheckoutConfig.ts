// Server build configuration. Never import this module from a browser entry.
export function testCheckoutConfig(env:Record<string,string|undefined>){
 return {
  TEST_CHECKOUT_ENABLED:env.CASA_TEST_CHECKOUT_ENABLED==='true'?'true':'false',
  TEST_CHECKOUT_ISSUER:(env.CASA_TEST_CHECKOUT_ISSUER??'').trim().replace(/\/$/,''),
  TEST_CHECKOUT_AUDIENCE:(env.CASA_TEST_CHECKOUT_AUDIENCE??'').trim(),
  TEST_CHECKOUT_ALLOWED_EMAILS:(env.CASA_TEST_CHECKOUT_ALLOWED_EMAILS??'').trim(),
  ADMIN_ACCESS_AUDIENCE:(env.CASA_TEST_CHECKOUT_ADMIN_AUDIENCE??'').trim(),
  TURNSTILE_SITE_KEY:(env.CASA_TEST_CHECKOUT_TURNSTILE_SITE_KEY??'').trim(),
 };
}
