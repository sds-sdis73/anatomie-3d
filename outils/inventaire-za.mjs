import fs from 'fs';
import { lireFbx } from './lire-fbx.mjs';
const D='../sources-za/repo/Resources/Models/FBX/';
const files=['SkeletalSystem100','MuscularSystem100','Joints100','NervousSystem100','Regions of human body100'];
const all={};
for(const f of files){
  const root=lireFbx(D+f+'.fbx'); const list=[];
  root.traverse(o=>{ if(o.isMesh){ const g=o.geometry; const tri=g.index?g.index.count/3:g.attributes.position.count/3; const path=[]; let p=o.parent; while(p&&p!==root){path.unshift(p.name);p=p.parent;} list.push({n:o.name,tri,path:path.join(' > '),mat:[].concat(o.material).map(m=>m.name).join('|')}); }});
  all[f]=list; const tot=list.reduce((a,b)=>a+b.tri,0);
  console.log(f.padEnd(26), list.length,'objets', tot,'triangles');
  const top={}; for(const m of list){const k=m.path.split(' > ').slice(0,2).join(' > '); top[k]=(top[k]||[0,0]); top[k][0]++; top[k][1]+=m.tri;}
  for(const [k,v] of Object.entries(top).sort((a,b)=>b[1][1]-a[1][1]).slice(0,14)) console.log('   ',v[0],v[1],k);
}
fs.writeFileSync('inventaire-za.json',JSON.stringify(all));
