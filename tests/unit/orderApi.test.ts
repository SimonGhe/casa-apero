import {afterEach,expect,it,vi} from 'vitest';
import {getReceipt} from '../../src/lib/orderApi';
afterEach(()=>{vi.unstubAllGlobals();});
it('coalesces only in-flight receipt reads and never caches settled customer responses',async()=>{
 let release:()=>void=()=>{};const gate=new Promise<void>(resolve=>{release=resolve;});
 const transport=vi.fn(async()=>{await gate;return Response.json({reference:'TEST-FICTIONAL'});});vi.stubGlobal('fetch',transport);
 const first=getReceipt('a'.repeat(64)),second=getReceipt('a'.repeat(64));expect(first).toBe(second);expect(transport).toHaveBeenCalledTimes(1);
 release();await first;await getReceipt('a'.repeat(64));expect(transport).toHaveBeenCalledTimes(2);
 expect(transport.mock.calls[0][1]).toMatchObject({cache:'no-store'});
});
