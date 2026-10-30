// Local asset preparation only. Never connects to D1 or Cloudflare.
import {readFile,readdir,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
const require=createRequire(import.meta.url);
// Reuse the installed toolchain's Sharp, without adding a runtime dependency.
const installed=(await readdir('node_modules/.pnpm')).filter(n=>n.startsWith('sharp@')).sort();
if(!installed.length)throw Error('Sharp is required for one-time photo preparation.');
const sharp=require(resolve('node_modules/.pnpm',installed[0],'node_modules/sharp'));
const manifest=JSON.parse(await readFile('assets/products/photo-manifest.json','utf8'));
await mkdir('public/assets/products',{recursive:true});
let bytes=0;
for(const entries of [...Object.values(manifest.products),...Object.values(manifest.drafts)])for(const photo of entries){
 for(const width of [960,480]){
  let input=sharp('assets/'+photo.original).rotate();
  if(photo.extract)input=input.extract(photo.extract);
  const path=`public/assets/products/${photo.output}${width===480?'-480':''}.webp`;
  const result=await input.resize({width,withoutEnlargement:false}).webp({quality:82,effort:5}).toFile(path);
  bytes+=result.size;
 }
}
const sql=[
 '-- Official product photography. Presentation only; never replace prices or order snapshots.',
 '-- Generated from assets/products/photo-manifest.json by scripts/prepare-product-photos.mjs.',
 '-- No Olive Grande insert: its price and final product details are not confirmed.',
];
for(const [id,entries] of Object.entries(manifest.products)){
 const images=entries.map(p=>({src:`/assets/products/${p.output}.webp`,alt:p.alt,isPlaceholder:false}));
 sql.push(`UPDATE products SET images_json='${JSON.stringify(images).replaceAll("'","''")}',version=version+1 WHERE id='${id}';`);
}
await writeFile('migrations/0006_product_photography.sql',sql.join('\n')+'\n');
console.log(`Prepared responsive WebP photos (${Math.round(bytes/1024)} KiB total) and image-only migration. No databases modified.`);
