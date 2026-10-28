import {describe,it,expect} from 'vitest';
import {orderingState,orderingMessages} from '../../src/lib/orderingStatus';
describe('backend-driven request availability',()=>{
 const active={testMode:false,ready:true,error:'',enabled:true,paused:false};
 it('allows active wording only when configuration and catalogue permit requests',()=>{
  expect(orderingState(active)).toBe('active');
  expect(orderingMessages.active).not.toContain('TESTVERSIE');
 });
 it.each([{enabled:false},{paused:true},{enabled:false,paused:true}])('shows a pause for backend restriction %j',change=>{
  expect(orderingState({...active,...change})).toBe('paused');
 });
 it('does not briefly claim availability while backend data is loading',()=>{
  expect(orderingState({...active,ready:false})).toBe('checking');
 });
 it('does not treat a failed backend check as active or test mode',()=>{
  expect(orderingState({...active,ready:false,error:'network error'})).toBe('unavailable');
 });
 it('never advertises real requests in a testing environment',()=>{
  expect(orderingState({...active,testMode:true})).toBe('test');
  expect(orderingMessages.test).toContain('Geen echte bestelaanvragen');
 });
});
