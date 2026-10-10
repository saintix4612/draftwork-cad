import {kernelAPI,meshObject} from './kernel.js';

export const featureDefinitions={
  rounded:{name:'Rounded plate',description:'Round the four vertical corners of a rectangular plate. This does not round arbitrary selected mesh edges.',fields:{width:80,depth:50,height:10,radius:8}},
  chamfer:{name:'Chamfered block',description:'Equal chamfers on all twelve edges of a rectangular block.',fields:{width:60,depth:40,height:20,chamfer:3}},
  loft:{name:'Loft / transition',description:'Straight transition between two centered rectangular profiles, with an optional offset of the top profile.',fields:{bottomWidth:60,bottomDepth:40,topWidth:30,topDepth:20,height:50,offsetX:0,offsetY:0}},
  sweep:{name:'Swept elbow',description:'Circular tube swept around a planar arc. Bend radius is measured to the tube centerline.',fields:{bendRadius:40,outerRadius:8,wall:2,angle:90}},
  gear:{name:'Involute spur gear',description:'20° pressure-angle involute teeth. At least 18 teeth; root relief is approximate. Check fit before fabrication.',fields:{teeth:24,module:2,thickness:10,bore:8}},
  thread:{name:'Threaded rod',description:'A right-hand helical V ridge around a rod. This is a geometric thread study, without standard fit classes or allowances.',fields:{diameter:12,pitch:2,length:30,depth:1}},
  sheet:{name:'Bent sheet',description:'One 90° bend with constant thickness. Flange lengths are straight tangent lengths; developed length uses the supplied K-factor.',fields:{flangeA:40,flangeB:30,width:50,thickness:2,insideRadius:4,kFactor:.4}},
};
export function validateFeature(f){
  if(!f||!featureDefinitions[f.kind]||!f.params)throw Error('Unsupported modeling feature.');const p={};
  for(const k of Object.keys(featureDefinitions[f.kind].fields)){const n=f.params[k];if(!Number.isFinite(n)||Math.abs(n)>10000)throw Error(`Invalid ${k}.`);if(!['offsetX','offsetY','bore'].includes(k)&&n<=0)throw Error(`${k} must be positive.`);p[k]=n;}
  if(f.kind==='rounded'&&p.radius>=Math.min(p.width,p.depth)/2)throw Error('Corner radius must be less than half the smaller side.');
  if(f.kind==='chamfer'&&p.chamfer>=Math.min(p.width,p.depth,p.height)/2)throw Error('Chamfer must be less than half the smallest dimension.');
  if(f.kind==='sweep'&&(p.wall>=p.outerRadius||p.bendRadius<=p.outerRadius||p.angle>300))throw Error('Use wall < tube radius < bend radius, and an angle up to 300°.');
  if(f.kind==='gear'&&(!Number.isInteger(p.teeth)||p.teeth<18||p.teeth>100||p.bore<0||p.bore>=p.module*(p.teeth-2.5)))throw Error('Use 18–100 whole teeth and a bore smaller than the root diameter.');
  if(f.kind==='thread'&&(p.depth>=p.diameter/2||p.depth>p.pitch*.8||p.length/p.pitch>100||p.length<p.pitch))throw Error('Use 1–100 thread turns; depth must be below the radius and 0.8 × pitch.');
  if(f.kind==='sheet'&&(p.kFactor>1))throw Error('K-factor must be between 0 and 1.');
  return {kind:f.kind,params:p};
}
// Closed loft mesh: rings are CCW when viewed from above, caps point outwards.
function ringMesh(rings){
  const {Manifold,Mesh}=kernelAPI(),n=rings[0].length,v=rings.flat(2),indices=[];
  for(let z=0;z<rings.length-1;z++)for(let i=0;i<n;i++){const a=z*n+i,b=z*n+(i+1)%n,c=b+n,d=a+n;indices.push(a,b,c,a,c,d);}
  const bottom=v.length/3,top=bottom+1;
  for(const ring of [rings[0],rings.at(-1)])v.push(...[0,1,2].map(k=>ring.reduce((s,p)=>s+p[k],0)/n));
  for(let i=0;i<n;i++){indices.push(bottom,(i+1)%n,i);const a=(rings.length-1)*n+i,b=(rings.length-1)*n+(i+1)%n;indices.push(top,a,b);}
  return new Manifold(new Mesh({numProp:3,vertProperties:new Float32Array(v),triVerts:new Uint32Array(indices)}));
}
export function createFeature(input){
  const f=validateFeature(input),p=f.params,{Manifold}=kernelAPI();let m;const temporaries=[];const own=x=>(temporaries.push(x),x);
  try{
    if(f.kind==='rounded'){
      const points=[];for(const [cx,cy,start] of [[p.width/2-p.radius,p.depth/2-p.radius,0],[-p.width/2+p.radius,p.depth/2-p.radius,90],[-p.width/2+p.radius,-p.depth/2+p.radius,180],[p.width/2-p.radius,-p.depth/2+p.radius,270]])for(let i=0;i<=24;i++){const a=(start+i*90/24)*Math.PI/180;points.push([cx+p.radius*Math.cos(a),cy+p.radius*Math.sin(a)]);}m=own(Manifold.extrude([points],p.height));
    }
    if(f.kind==='chamfer'){
      const points=[],half=[p.width/2,p.depth/2,p.height/2];for(const sx of [-1,1])for(const sy of [-1,1])for(const sz of [-1,1]){const signs=[sx,sy,sz];for(let axis=0;axis<3;axis++)points.push(half.map((n,i)=>signs[i]*(n-(i===axis?0:p.chamfer))));}m=own(Manifold.hull(points));
    }
    if(f.kind==='loft'){
      const rect=(w,d,z,x=0,y=0)=>[[-w/2+x,-d/2+y,z],[w/2+x,-d/2+y,z],[w/2+x,d/2+y,z],[-w/2+x,d/2+y,z]];
      m=own(ringMesh([rect(p.bottomWidth,p.bottomDepth,0),rect(p.topWidth,p.topDepth,p.height,p.offsetX,p.offsetY)]));
    }
    if(f.kind==='sweep'){
      const circle=r=>Array.from({length:96},(_,i)=>[p.bendRadius+r*Math.cos(i*Math.PI/48),r*Math.sin(i*Math.PI/48)]);
      const outer=own(Manifold.revolve([circle(p.outerRadius)],Math.ceil(p.angle*128/360),p.angle)),inner=own(Manifold.revolve([circle(p.outerRadius-p.wall)],Math.ceil(p.angle*128/360),p.angle));m=own(outer.subtract(inner));
    }
    if(f.kind==='gear'){
      const pitch=p.module*p.teeth/2,base=pitch*Math.cos(20*Math.PI/180),root=pitch-1.25*p.module,outer=pitch+p.module,half=Math.PI/(2*p.teeth);
      const inv=r=>{const t=Math.sqrt(Math.max(0,r*r/base/base-1));return t-Math.atan(t);},pitchInv=inv(pitch),pts=[];
      for(let tooth=0;tooth<p.teeth;tooth++){
        const c=tooth*2*Math.PI/p.teeth,polar=(r,a)=>pts.push([r*Math.cos(c+a),r*Math.sin(c+a)]),start=Math.max(root,base),rootAngle=half+pitchInv-inv(start);
        polar(root,-Math.PI/p.teeth);polar(root,-rootAngle);
        for(let i=0;i<=10;i++){const r=start+(outer-start)*i/10;polar(r,-half-pitchInv+inv(r));}
        for(let i=10;i>=0;i--){const r=start+(outer-start)*i/10;polar(r,half+pitchInv-inv(r));}
        polar(root,rootAngle);
      }
      m=own(Manifold.extrude([pts],p.thickness));if(p.bore>0){const bore=own(Manifold.cylinder(p.thickness,p.bore/2,p.bore/2,96));m=own(m.subtract(bore));}
    }
    if(f.kind==='thread'){
      const core=p.diameter/2-p.depth,steps=Math.ceil(p.length/p.pitch*48),rings=[];
      // The triangular thread is swept helically and fused to its core.
      for(let i=0;i<=steps;i++){const z=i/steps*p.length,a=z/p.pitch*2*Math.PI;const profile=[[core-.05,z+p.pitch*.38],[p.diameter/2,z],[core-.05,z-p.pitch*.38]];rings.push(profile.map(([r,h])=>[r*Math.cos(a),r*Math.sin(a),h]));}
      const ridge=own(ringMesh(rings)),rod=own(Manifold.cylinder(p.length,core,core,96)),combined=own(rod.add(ridge)),clip=own(Manifold.cylinder(p.length,p.diameter,p.diameter,96));m=own(combined.intersect(clip));
    }
    if(f.kind==='sheet'){
      const R=p.insideRadius+p.thickness,r=p.insideRadius,pts=[[-p.flangeA,-R],[0,-R]];
      for(let i=1;i<=32;i++){const a=(-90+i*90/32)*Math.PI/180;pts.push([R*Math.cos(a),R*Math.sin(a)]);}pts.push([R,p.flangeB],[r,p.flangeB],[r,0]);for(let i=1;i<=32;i++){const a=-i*90/32*Math.PI/180;pts.push([r*Math.cos(a),r*Math.sin(a)]);}pts.push([-p.flangeA,-r]);m=own(Manifold.extrude([pts],p.width));
    }
    if(m.status()!=='NoError')throw Error('Feature could not produce a closed solid. Check its dimensions.');
    const result=meshObject(m,featureDefinitions[f.kind].name,'#76a5ae');result.feature=f;return result;
  }finally{for(const m of temporaries.reverse())m.delete();}
}
export const bendAllowance=p=>Math.PI/2*(p.insideRadius+p.kFactor*p.thickness);
export const developedLength=p=>p.flangeA+p.flangeB+bendAllowance(p);
