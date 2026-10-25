import {ApiError} from './validation';
export async function requireProductionDatabase(db:D1Database){
 const marker=await db.prepare("SELECT value FROM application_settings WHERE key='dataset'").first('value');
 const preview=await db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name='admin_preview_guard'").first<number>('n');
 const fictional=await db.prepare("SELECT COUNT(*) AS n FROM orders WHERE source='local_test' OR reference LIKE 'TEST-%' OR email LIKE '%@example.invalid'").first<number>('n');
 if(marker!=='production'||preview!==0||fictional!==0)throw new ApiError(403,'wrong_database','De productieomgeving is niet vrijgegeven.');
}
