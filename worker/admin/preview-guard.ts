import { ApiError } from '../validation';
import type { AdminEnv } from './api';
export const PREVIEW_DATASET='casa-apero-admin-staging-fictional-v1';
export async function requirePreviewDataset(env:AdminEnv&{ADMIN_PREVIEW_DATASET?:string;CHECKOUT_ENABLED?:string}){
 if(env.APP_ENV!=='admin-preview'||env.ADMIN_AUTH_MODE!=='access'||env.CHECKOUT_ENABLED!=='false'||env.ADMIN_PREVIEW_DATASET!==PREVIEW_DATASET||!env.DB)throw new ApiError(403,'preview_disabled','De beheertestomgeving is nog niet vrijgegeven.');
 await requireFictionalDataset(env.DB);
}
export async function requireFictionalDataset(db:D1Database){
 try{
  const marker=await db.prepare('SELECT dataset FROM admin_preview_guard WHERE id=1').first('dataset');
  const unexpected=await db.prepare("SELECT COUNT(*) AS n FROM orders WHERE source!='local_test' OR email NOT LIKE '%@example.invalid'").first<number>('n');
  if(marker!==PREVIEW_DATASET||unexpected!==0)throw new Error('Wrong dataset');
 }catch{throw new ApiError(403,'preview_dataset_rejected','Geen geverifieerde fictieve beheerdatabase.');}
}
