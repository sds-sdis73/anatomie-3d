import fs from 'fs';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { pathToFileURL } from 'url';
globalThis.self = globalThis; 
export function lireFbx(path){
  const buf = fs.readFileSync(path);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset+buf.byteLength);
  const loader = new FBXLoader();
  loader.manager.itemStart = ()=>{}; 
  return loader.parse(ab, '');
}
// lancé directement : node lire-fbx.mjs fichier.fbx (pas quand le module est importé)
if (process.argv[2] && process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const t0=Date.now(); const root = lireFbx(process.argv[2]);
  root.updateMatrixWorld(true);
  let n=0, tri=0; const ex=[];
  root.traverse(o=>{ if(o.isMesh){ n++; const g=o.geometry; const c=g.index?g.index.count/3:g.attributes.position.count/3; tri+=c; if(ex.length<40) ex.push(o.name+' '+c+' parent='+(o.parent&&o.parent.name)); }});
  console.log(process.argv[2].split('/').pop(), 'meshes',n,'triangles',tri, (Date.now()-t0)+'ms');
  console.log(ex.join('\n'));
  const box=new THREE.Box3().setFromObject(root); console.log('bbox',box.min,box.max);
}
