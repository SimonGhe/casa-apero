import {createContext,useContext,useEffect,useState} from 'react';
import type {ReactNode} from 'react';
import {validateCatalogue} from '../../shared/catalogue';
import type {Catalogue} from '../../shared/catalogue';
import snapshot from '../data/catalogue.snapshot.json';
import {getCatalogue} from '../lib/catalogueApi';
import {TEST_CHECKOUT_BASE,TEST_CHECKOUT_API} from '../../shared/testCheckout';
import {getLocalConfig} from '../lib/orderApi';
import type {LocalConfig} from '../../shared/orders';
import {orderingState,orderingMessages} from '../lib/orderingStatus';
import type {OrderingState} from '../lib/orderingStatus';

const protectedTest=import.meta.env.MODE==='test-checkout'&&typeof window!=='undefined'&&window.location.pathname.startsWith(TEST_CHECKOUT_BASE);
const live=import.meta.env.MODE==='shop'||protectedTest||(import.meta.env.DEV&&import.meta.env.MODE!=='staging'&&typeof window!=='undefined'&&['localhost','127.0.0.1','[::1]'].includes(window.location.hostname));
const frozen=validateCatalogue(snapshot);
type State=Catalogue&{ready:boolean;error:string;loading:boolean;orderingState:OrderingState;publicConfig?:LocalConfig};
const CatalogueContext=createContext<State|null>(null);
export function CatalogueProvider({children}:{children:ReactNode}){
 const [data,setData]=useState<Catalogue>(live?{products:[],shopSettings:{...frozen.shopSettings,ordersPaused:true}}:frozen),[ready,setReady]=useState(!live),[error,setError]=useState('');
 const [publicConfig,setPublicConfig]=useState<LocalConfig>();
 useEffect(()=>{
  if(!live)return;
  let active=true,sequence=0;
  async function refresh(){const request=++sequence;setReady(false);try{
   const [value,config]=await Promise.all([protectedTest?fetch(TEST_CHECKOUT_API+'/catalogue',{credentials:'same-origin',cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('Testercatalogus niet beschikbaar');return r.json();}).then(validateCatalogue):getCatalogue(),import.meta.env.MODE==='shop'?getLocalConfig():Promise.resolve(undefined)]);if(active&&request===sequence){setData(value);setPublicConfig(config);setReady(true);setError('');}
  }catch{if(active&&request===sequence){setReady(false);setError('De collectie kan niet worden gecontroleerd. Toevoegen en aanvragen zijn tijdelijk geblokkeerd. Vernieuw de pagina.');}}}
  void refresh();const focus=()=>void refresh();window.addEventListener('focus',focus);
  return()=>{active=false;window.removeEventListener('focus',focus);};
 },[]);
 const status=orderingState({testMode:import.meta.env.MODE!=='shop',ready,error,enabled:publicConfig?.publicRequests===true,paused:data.shopSettings.ordersPaused});
 return <CatalogueContext.Provider value={{...data,shopSettings:{...data.shopSettings,pauseMessage:orderingMessages[status==='test'?'paused':status],ordersPaused:!ready||data.shopSettings.ordersPaused||(import.meta.env.MODE==='shop'&&publicConfig?.publicRequests!==true)},ready,error,loading:!ready&&!error&&data.products.length===0,orderingState:status,publicConfig}}>{children}</CatalogueContext.Provider>;
}
export function useCatalogue(){const value=useContext(CatalogueContext);if(!value)throw new Error('CatalogueProvider ontbreekt');return value;}
