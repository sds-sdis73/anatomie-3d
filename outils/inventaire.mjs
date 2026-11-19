import fs from 'fs';
const S = process.argv[2];
const rows = fs.readFileSync(S+'/isa_element_parts.txt','utf8').trim().split('\n').slice(1).map(l=>l.split('\t'));
const byConcept = new Map(), byFile = new Map();
for (const [id,name,fj] of rows){ if(!byConcept.has(id)) byConcept.set(id,{name,files:new Set()}); byConcept.get(id).files.add(fj); if(!byFile.has(fj)) byFile.set(fj,new Set()); byFile.get(fj).add(id); }
const cats = {bone:'bone organ',muscle:'muscle organ',cartilage:'cartilage organ component',ligament:'ligament organ',tendon:'tendon',skin:'skin',nerve:'nerve',artery:'artery',vein:'vein'};
const catIds = {}; for (const [k,n] of Object.entries(cats)){ for (const [id,c] of byConcept) if(c.name===n) catIds[k]=id; }
const out=[];
for (const [fj,ids] of byFile){
  let best=null; for(const id of ids){ const c=byConcept.get(id); if(!best||c.files.size<best.files.size) best={...c,id}; }
  const tags=Object.entries(catIds).filter(([k,id])=>ids.has(id)).map(([k])=>k);
  const txt=fs.readFileSync(`${S}/obj/isa_BP3D_4.0_obj_99/${fj}.obj`,'utf8');
  const nv=(txt.match(/^v /gm)||[]).length, nf=(txt.match(/^f /gm)||[]).length;
  out.push({fj,name:best.name,shared:best.files.size,tags:tags.join(','),nv,nf});
}
fs.writeFileSync('inventaire.json',JSON.stringify(out,null,0));
const sum=(f)=>out.filter(f).reduce((a,o)=>a+o.nf,0);
for(const k of Object.keys(cats)) console.log(k, out.filter(o=>o.tags.split(',').includes(k)).length, 'faces', sum(o=>o.tags.split(',').includes(k)));
console.log('sans catégorie', out.filter(o=>!o.tags).length, 'total faces', sum(()=>true));
