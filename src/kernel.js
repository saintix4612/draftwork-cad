import Module from 'manifold-3d';
import {makeObject} from './model.js';
let api;
export const kernelAPI=()=>{if(!api)throw Error('Wait for the solid engine to load.');return api;};
export async function initKernel(options={}){if(!api){api=await Module(options);api.setup();}return api;}
const replace=(old,next)=>{old.delete();return next;};
export function solid(o){
 if(!api)throw Error('Solid engine is still loading.');const {Manifold,Mesh}=api;let m;
 if(o.type==='box') {m=Manifold.cube([o.w,o.d,o.h]);m=replace(m,m.translate([-o.w/2,-o.d/2,0]));}
 else if(o.type==='cylinder')m=Manifold.cylinder(o.h,o.r,o.r,128);
 else if(o.type==='extrusion')m=Manifold.extrude([o.points],o.h);
 else if(o.type==='mesh'){m=new Manifold(new Mesh({numProp:3,vertProperties:new Float32Array(o.mesh.vertices),triVerts:new Uint32Array(o.mesh.indices)}));m=replace(m,m.scale([o.w/o.mesh.size[0],o.d/o.mesh.size[1],o.h/o.mesh.size[2]]));}
 else throw Error('Select a 3D solid.');
 try{m=replace(m,m.rotate([o.rx||0,o.ry||0,o.rotation]));m=replace(m,m.translate([o.x,o.y,o.z]));if(m.status()!=='NoError')throw Error('This mesh is not a closed solid.');return m;}catch(e){m.delete();throw e;}
}
export function meshObject(m,name,color){
 if(m.isEmpty())throw Error('This operation produces an empty solid.');
 const raw=m.getMesh(),v=[],indices=Array.from(raw.triVerts);if(indices.length>300000)throw Error('Result is too complex (100,000 triangle limit).');
 const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
 for(let i=0;i<raw.vertProperties.length;i+=raw.numProp){for(let j=0;j<3;j++){const n=raw.vertProperties[i+j];v.push(n);min[j]=Math.min(min[j],n);max[j]=Math.max(max[j],n);}}
 const origin=[(min[0]+max[0])/2,(min[1]+max[1])/2,min[2]],size=max.map((n,i)=>n-min[i]);if(size.some(n=>n<1e-6))throw Error('Result has no thickness.');
 for(let i=0;i<v.length;i++)v[i]-=origin[i%3];
 return makeObject('mesh',{name,color,x:origin[0],y:origin[1],z:origin[2],w:size[0],d:size[1],h:size[2],mesh:{vertices:v,indices,size}});
}
export function booleanOperation(a,b,operation){const x=solid(a);let y,result;try{y=solid(b);if(!['add','subtract','intersect'].includes(operation))throw Error('Unsupported operation.');result=x[operation](y);return meshObject(result,`${a.name} ${operation==='subtract'?'cut':operation==='add'?'joined':'intersection'}`,a.color);}finally{x.delete();y?.delete();result?.delete();}}
export function properties(o){const m=solid(o);try{return {volume:m.volume(),area:m.surfaceArea(),triangles:m.numTri()};}finally{m.delete();}}
function orient(m,view){if(view==='front')return replace(m,m.rotate([-90,0,0]));if(view==='right'){m=replace(m,m.rotate([0,0,-90]));return replace(m,m.rotate([-90,0,0]));}return m;}
export function projectSolid(o,view='top'){let m=solid(o),cross;try{m=orient(m,view);cross=m.project();return cross.toPolygons();}finally{cross?.delete();m.delete();}}
export function sectionSolid(o,z){const m=solid(o);let cross;try{cross=m.slice(z);return cross.toPolygons();}finally{cross?.delete();m.delete();}}
export function drawingEdges(objects,view){
  const solids=[];try{
    for(const o of objects)solids.push(orient(solid(o),view));
    if(solids.reduce((sum,m)=>sum+m.numTri(),0)>50000||solids.length>40)throw Error('Hidden-edge drawing supports 40 bodies / 50,000 triangles. Disable hidden edges for a larger model.');
    const boxes=solids.map(m=>m.boundingBox()),top=Math.max(...boxes.map(b=>b.max[2]),1)+10,bottom=Math.min(...boxes.map(b=>b.min[2]),0)-10,result=[];
    for(const m of solids){const mesh=m.getMesh(),edges=new Map(),v=i=>Array.from(mesh.vertProperties.slice(i*mesh.numProp,i*mesh.numProp+3));
      for(let i=0;i<mesh.triVerts.length;i+=3){const ix=Array.from(mesh.triVerts.slice(i,i+3)),p=ix.map(v),a=p[1].map((n,k)=>n-p[0][k]),b=p[2].map((n,k)=>n-p[0][k]),normal=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],length=Math.hypot(...normal);if(length<1e-10)continue;for(let k=0;k<3;k++){const A=ix[k],B=ix[(k+1)%3],key=[Math.min(A,B),Math.max(A,B)].join(':');if(!edges.has(key))edges.set(key,{a:v(A),b:v(B),normals:[]});edges.get(key).normals.push(normal.map(n=>n/length));}}
      for(const edge of edges.values()){
        if(Math.hypot(edge.b[0]-edge.a[0],edge.b[1]-edge.a[1])<1e-6)continue;
        if(edge.normals.length===2&&edge.normals[0].reduce((s,n,k)=>s+n*edge.normals[1][k],0)>.995)continue;
        for(let step=0;step<8;step++){const at=t=>edge.a.map((n,k)=>n+(edge.b[k]-n)*t),mid=at((step+.5)/8);const hidden=solids.some((solid,i)=>{const box=boxes[i];if(mid[0]<box.min[0]-1e-5||mid[0]>box.max[0]+1e-5||mid[1]<box.min[1]-1e-5||mid[1]>box.max[1]+1e-5)return false;return solid.rayCast([mid[0],mid[1],top],[mid[0],mid[1],bottom]).some(hit=>hit.position[2]>mid[2]+1e-4);});result.push({a:at(step/8).slice(0,2),b:at((step+1)/8).slice(0,2),hidden});}
      }
    }return result;
  }finally{solids.forEach(m=>m.delete());}
}
