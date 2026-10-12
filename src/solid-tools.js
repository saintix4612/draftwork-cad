import {kernelAPI,solid,meshObject} from './kernel.js';

export const solidToolNames={plane:'Plane cut',shell:'Hollow extrusion',revolve:'Revolve profile',taper:'Taper / twist extrusion'};
export const profileTypes=['rectangle','circle','polygon'];
export function validateSolidTool(r){
  const clean={kind:r.kind,baseId:r.baseId};
  const number=(key,min,max)=>{if(!Number.isFinite(r[key])||r[key]<min||r[key]>max)throw Error(`Invalid ${key}: use ${min} to ${max}.`);clean[key]=r[key];};
  if(r.kind==='plane'){
    if(!Array.isArray(r.normal)||r.normal.length!==3||r.normal.some(n=>!Number.isFinite(n)||Math.abs(n)>1e6)||Math.hypot(...r.normal)<1e-8)throw Error('Plane normal must be a nonzero finite vector, with components up to 1,000,000.');
    const length=Math.hypot(...r.normal);clean.normal=r.normal.map(n=>n/length);number('offset',-1e6,1e6);clean.reverse=!!r.reverse;
  }else if(r.kind==='shell')number('thickness',.001,1e5);
  else if(r.kind==='revolve'){number('angle',1,360);number('radiusOffset',-1e5,1e5);}
  else if(r.kind==='taper'){number('height',.001,1e5);number('topScale',.05,5);number('twist',-360,360);}
  else throw Error('Unsupported solid tool.');
  return clean;
}
const profile=o=>o.type==='polygon'||o.type==='extrusion'?o.points:o.type==='circle'||o.type==='cylinder'?Array.from({length:128},(_,i)=>[o.r*Math.cos(i*Math.PI/64),o.r*Math.sin(i*Math.PI/64)]):[[-o.w/2,-o.d/2],[o.w/2,-o.d/2],[o.w/2,o.d/2],[-o.w/2,o.d/2]];

export function buildSolidTool(recipe,base){
  const r=validateSolidTool(recipe),{Manifold,CrossSection}=kernelAPI(),owned=[];
  const own=m=>(owned.push(m),m);
  const placed=m=>own(own(m.rotate([base.rx||0,base.ry||0,base.rotation])).translate([base.x,base.y,base.z]));
  try{
    let result;
    if(r.kind==='plane'){
      const m=own(solid(base)),normal=r.normal.map(n=>r.reverse?-n:n),offset=r.reverse?-r.offset:r.offset;
      result=own(m.trimByPlane(normal,offset));
      if(Math.abs(result.volume()-m.volume())<1e-7)throw Error('The plane does not remove material. Move it inside the part.');
    }else if(r.kind==='shell'){
      if(!['box','cylinder','extrusion'].includes(base.type))throw Error('Hollowing supports boxes, cylinders and straight sketch extrusions. Use their original body before cuts.');
      if(r.thickness>=base.h)throw Error('Wall thickness must be less than the extrusion height.');
      const cs=own(new CrossSection([profile(base)])),inside=own(cs.offset(-r.thickness,'Miter',2,64));
      if(inside.isEmpty())throw Error('Wall thickness leaves no cavity. Reduce thickness.');
      const cutter=placed(own(own(inside.extrude(base.h-r.thickness+Math.max(1,base.h*.001))).translate([0,0,r.thickness])));
      result=own(own(solid(base)).subtract(cutter));
    }else{
      if(!profileTypes.includes(base.type))throw Error('Select a rectangle, circle or closed polygon sketch.');
      let points=profile(base);
      if(r.kind==='revolve'){
        points=points.map(([x,y])=>[x+r.radiusOffset,y]);
        if(points.some(p=>p[0]<-1e-8))throw Error('Profile crosses the revolve axis. Increase the radius offset.');
        result=placed(own(Manifold.revolve([points],128,r.angle)));
      }else result=placed(own(Manifold.extrude([points],r.height,Math.max(0,Math.ceil(Math.abs(r.twist)/5)),r.twist,[r.topScale,r.topScale])));
    }
    if(result.status()!=='NoError')throw Error('Operation did not produce a closed solid.');
    return {...meshObject(result,base.name+' '+solidToolNames[r.kind].toLowerCase(),base.color),recipe:r};
  }finally{owned.reverse().forEach(m=>m.delete());}
}
