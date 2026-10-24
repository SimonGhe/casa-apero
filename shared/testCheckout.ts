// Preset customer data only: testers never submit their actual contact details.
export const FICTIONAL_CUSTOMER={name:'Fictieve Testklant',email:'testklant@example.invalid',phone:'',notes:'FICTIEF — geen echte bestelling, betaling of productieopdracht.'} as const;
export const TEST_CHECKOUT_BASE='/test-bestellen';
export const TEST_CHECKOUT_API=TEST_CHECKOUT_BASE+'/api';
export const TEST_CHECKOUT_RATE_LIMIT=30;
