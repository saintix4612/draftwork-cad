export const sketchTypes = ['line', 'circle', 'rectangle'];
export const constraintKinds = ['horizontal', 'vertical', 'length', 'radius', 'width', 'depth', 'parallel', 'perpendicular', 'equal', 'concentric', 'coincident', 'distance', 'fixed'];
const fields = o => o.type === 'circle' ? ['x','y','r'] : ['x','y','w','d','rotation'];
const vector = o => { const a=o.rotation*Math.PI/180; return [o.w*Math.cos(a)-o.d*Math.sin(a),o.w*Math.sin(a)+o.d*Math.cos(a)]; };
const point = (o,end=0) => { const v=vector(o); return [o.x+(end?v[0]:0),o.y+(end?v[1]:0)]; };
const size = o => o.type==='circle'?o.r:Math.hypot(o.w,o.d);
export function validateConstraints(constraints,objects) {
  if(!Array.isArray(constraints)||constraints.length>80)throw Error('Use at most 80 sketch constraints.');
  const ids=new Set();
  return constraints.map(c=>{
    if(!c||!constraintKinds.includes(c.kind)||typeof c.id!=='string'||!/^[\w-]{1,100}$/.test(c.id)||ids.has(c.id))throw Error('Invalid sketch constraint.');ids.add(c.id);
    const a=objects.find(o=>o.id===c.a),b=objects.find(o=>o.id===c.b);
    if(!a||!sketchTypes.includes(a.type)||Math.abs(a.z)>1e-8)throw Error('Constraints apply to lines, circles and rectangles on XY at Z=0.');
    if(['horizontal','vertical','length'].includes(c.kind)&&a.type!=='line')throw Error('This constraint needs a line.');
    if(c.kind==='radius'&&a.type!=='circle')throw Error('Radius needs a circle.');
    if(['width','depth'].includes(c.kind)&&a.type!=='rectangle')throw Error('Width/depth needs a rectangle.');
    const result={id:c.id,kind:c.kind,a:c.a};
    if(['parallel','perpendicular','equal','concentric','coincident','distance'].includes(c.kind)) {
      if(!b||a.id===b.id||!sketchTypes.includes(b.type)||Math.abs(b.z)>1e-8)throw Error('Choose a different XY sketch as the reference.');
      if(['parallel','perpendicular','coincident'].includes(c.kind)&&(a.type!=='line'||b.type!=='line'))throw Error('This relation needs two lines.');
      if(c.kind==='concentric'&&(a.type!=='circle'||b.type!=='circle'))throw Error('Concentric needs two circles.');
      if(c.kind==='equal'&&!(a.type===b.type&&['line','circle'].includes(a.type)))throw Error('Equal needs two lines or two circles.');
      result.b=c.b;
    }
    if(['length','radius','width','depth','distance'].includes(c.kind)) {
      if(!Number.isFinite(c.value)||c.value<=0||c.value>1e6)throw Error('Constraint dimensions must be positive.');result.value=c.value;
    }
    if(c.kind==='coincident'){if(![0,1].includes(c.endA)||![0,1].includes(c.endB))throw Error('Invalid endpoint.');result.endA=c.endA;result.endB=c.endB;}
    if(c.kind==='fixed'){result.values={};for(const key of fields(a)){if(!Number.isFinite(c.values?.[key]))throw Error('Invalid fixed geometry.');result.values[key]=c.values[key];}}
    return result;
  });
}
function residuals(objects,constraints,drive) {
  const map=new Map(objects.map(o=>[o.id,o])),r=[];
  for(const c of constraints){const a=map.get(c.a),b=map.get(c.b),v=a.type==='line'?vector(a):null;
    if(c.kind==='horizontal')r.push(v[1]);
    if(c.kind==='vertical')r.push(v[0]);
    if(c.kind==='length')r.push(size(a)-c.value);
    if(c.kind==='radius')r.push(a.r-c.value);
    if(c.kind==='width')r.push(a.w-c.value);
    if(c.kind==='depth')r.push(a.d-c.value);
    if(c.kind==='equal')r.push(size(a)-size(b));
    if(c.kind==='concentric')r.push(a.x-b.x,a.y-b.y);
    if(c.kind==='distance')r.push(Math.hypot(a.x-b.x,a.y-b.y)-c.value);
    if(c.kind==='coincident'){const p=point(a,c.endA),q=point(b,c.endB);r.push(p[0]-q[0],p[1]-q[1]);}
    if(['parallel','perpendicular'].includes(c.kind)){const w=vector(b),n=Math.max(1e-9,Math.hypot(...v)*Math.hypot(...w));r.push(10*(c.kind==='parallel'?v[0]*w[1]-v[1]*w[0]:v[0]*w[0]+v[1]*w[1])/n);}
    if(c.kind==='fixed')for(const key of fields(a))r.push(a[key]-c.values[key]);
  }
  if(drive)r.push(map.get(drive.id)[drive.key]-drive.value);
  return r;
}
export function linearSolve(A,b,tolerance=1e-12) {
  const n=b.length,m=A.map((r,i)=>{const scale=Math.max(...r.map(Math.abs));if(scale===0)throw Error('The system is singular or insufficiently supported.');return [...r.map(v=>v/scale),b[i]/scale];});
  for(let i=0;i<n;i++){let p=i;for(let j=i+1;j<n;j++)if(Math.abs(m[j][i])>Math.abs(m[p][i]))p=j;
    if(Math.abs(m[p][i])<tolerance)throw Error('The system is singular or insufficiently supported.');
    [m[p],m[i]]=[m[i],m[p]];const scale=m[i][i];for(let k=i;k<=n;k++)m[i][k]/=scale;
    for(let j=0;j<n;j++)if(j!==i){const f=m[j][i];for(let k=i;k<=n;k++)m[j][k]-=f*m[i][k];}
  }return m.map(r=>r[n]);
}
// Damped least-squares on the constrained component. Unconstrained geometry is untouched.
export function solveSketch(document,drive=null) {
  const next=structuredClone(document),constraints=validateConstraints(next.constraints||[],next.objects);
  if(!constraints.length)return next;
  const involved=new Set(constraints.flatMap(c=>[c.a,c.b].filter(Boolean)));
  if(drive&&!involved.has(drive.id))return next;
  const objects=next.objects.filter(o=>involved.has(o.id));
  const variables=objects.flatMap(o=>fields(o).map(key=>({o,key})));
  if(variables.length>180)throw Error('Constrained sketches are limited to 180 variables.');
  let lambda=1e-4,r=residuals(objects,constraints,drive);
  const error=r=>r.reduce((s,n)=>s+n*n,0);
  for(let iteration=0;iteration<100&&Math.max(...r.map(Math.abs))>1e-6;iteration++){
    const J=r.map(()=>[]);
    variables.forEach(({o,key},j)=>{const old=o[key],h=1e-5*Math.max(1,Math.abs(old));o[key]+=h;const perturbed=residuals(objects,constraints,drive);o[key]=old;for(let i=0;i<r.length;i++)J[i][j]=(perturbed[i]-r[i])/h;});
    const n=variables.length,A=Array.from({length:n},()=>Array(n).fill(0)),b=Array(n).fill(0);
    for(let j=0;j<n;j++){for(let i=0;i<r.length;i++){b[j]-=J[i][j]*r[i];for(let k=0;k<n;k++)A[j][k]+=J[i][j]*J[i][k];}A[j][j]+=lambda;}
    const step=linearSolve(A,b,1e-20),old=variables.map(({o,key})=>o[key]);variables.forEach(({o,key},j)=>o[key]+=step[j]);
    const trial=residuals(objects,constraints,drive);
    if(error(trial)<error(r)){r=trial;lambda=Math.max(1e-10,lambda/3);}else{variables.forEach(({o,key},j)=>o[key]=old[j]);lambda*=10;}
  }
  if(Math.max(...r.map(Math.abs))>1e-4||objects.some(o=>fields(o).some(k=>!Number.isFinite(o[k])||Math.abs(o[k])>1e6)||(o.type==='circle'&&o.r<=0)||(o.type==='rectangle'&&(o.w<=0||o.d<=0))||(o.type==='line'&&size(o)<1e-6)))throw Error('Conflicting constraints or a degenerate sketch. Remove a relation or edit its driving dimension.');
  return next;
}
