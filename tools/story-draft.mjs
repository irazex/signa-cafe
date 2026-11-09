import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const DIR=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../.story-runtime');

export function openDraft({ dish, site, promos, date, rules="", dir=DIR }) {
  const fingerprint=crypto.createHash('sha256').update(JSON.stringify({dish,site,promos,date,rules})).digest('hex');
  const key=crypto.createHash('sha256').update(String(dish.key||dish.title)).digest('hex').slice(0,12);
  const file=path.join(dir,`draft-${date}-${key}.json`);
  let data={};
  if(fs.existsSync(file)) { const old=JSON.parse(fs.readFileSync(file,'utf8')); if(old.fingerprint===fingerprint)data=old.data; }
  return {
    data,
    save(value){
      fs.mkdirSync(dir,{recursive:true});
      fs.writeFileSync(file+'.tmp',JSON.stringify({fingerprint,date,dishKey:dish.key,data:value}),{mode:0o600});
      fs.renameSync(file+'.tmp',file);
    },
    remove(){fs.rmSync(file,{force:true});},
  };
}

export function draftedDish(date, pool, dir=DIR) {
  if(!fs.existsSync(dir))return null;
  for(const f of fs.readdirSync(dir).filter(f=>f.startsWith(`draft-${date}-`)&&f.endsWith('.json')).sort()) {
    const saved=JSON.parse(fs.readFileSync(path.join(dir,f),'utf8'));
    const dish=pool.find(d=>d.key===saved.dishKey);
    if(dish)return dish;
  }
  return null;
}
