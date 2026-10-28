export type OrderingState='test'|'checking'|'active'|'paused'|'unavailable';
export function orderingState(input:{testMode:boolean;ready:boolean;error:string;enabled:boolean;paused:boolean}):OrderingState{
 if(input.testMode)return 'test';
 if(input.error)return 'unavailable';
 if(!input.ready)return 'checking';
 return input.enabled&&!input.paused?'active':'paused';
}
export const orderingMessages:Record<OrderingState,string>={
 test:'TESTVERSIE — Geen echte bestelaanvragen. Gebruik alleen fictieve gegevens.',
 checking:'Beschikbaarheid van bestelaanvragen controleren…',
 active:'Bestelaanvragen mogelijk · Alleen afhaling op afspraak · Persoonlijke bevestiging',
 paused:'Tijdelijk gepauzeerd — We nemen nu geen nieuwe bestelaanvragen aan.',
 unavailable:'Bestelaanvragen tijdelijk niet beschikbaar. Vernieuw de pagina of probeer later opnieuw.',
};
