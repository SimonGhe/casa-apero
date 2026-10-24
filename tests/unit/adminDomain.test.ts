import {expect,it} from 'vitest';
import {csv,report,transition} from '../../worker/admin/domain';
import type {FinancialEvent} from '../../shared/admin';
const entry=(amount:number,cost:number|null,id='one',type='order',category='payment'):FinancialEvent=>({entity_type:type,entity_id:id,amount_cents:amount,cost_cents:cost,accounting_date:'2026-10-24',category});
it('enforces the production sequence and cancellation terminal state',()=>{
 expect(transition('new','confirmed')).toBe('confirmed');expect(transition('confirmed','cancelled')).toBe('cancelled');expect(()=>transition('new','completed')).toThrow();expect(()=>transition('cancelled','new')).toThrow();expect(()=>transition('completed','in_production')).toThrow();
});
it('reports paid amounts, physical sales and refunds in integer cents without invented costs',()=>{
 expect(report([entry(1398,600),entry(-699,-300),entry(2599,800,'market','event','event_sale')])).toMatchObject({revenueCents:3298,orderRevenueCents:699,eventRevenueCents:2599,knownCostCents:1100,estimatedProfitCents:2198});
 expect(report([entry(699,null)])).toMatchObject({estimatedProfitCents:null,unknownCostGroups:1,knownProfitCents:0});
 expect(report([entry(699,null),entry(-699,null,'one','order','refund')])).toMatchObject({estimatedProfitCents:0,unknownCostGroups:0});
 expect(report([entry(0,null,'free','event','event_sale')]).estimatedProfitCents).toBeNull();
});
it('exports Excel-compatible escaped CSV and neutralizes formula injection while preserving numeric refunds',()=>{
 const result=csv([['Naam','Bedrag'],['=HYPERLINK("bad")',-6.99],['  +SUM(A1)',6.99],['@cmd','tekst;met"quote'],['\t-formula','regel\n2']]);
 expect(result.charCodeAt(0)).toBe(0xfeff);expect(result).toContain('"\'=HYPERLINK(""bad"")";"-6,99"');expect(result).toContain('"\'  +SUM(A1)";"6,99"');expect(result).toContain('"\'@cmd";"tekst;met""quote"');expect(result).toContain('\r\n');
});
