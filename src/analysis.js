import {linearSolve} from './constraints.js';
const positive=(p,keys)=>{for(const k of keys)if(!Number.isFinite(p[k])||p[k]<=0)throw Error(`${k} must be positive.`);};

// Euler–Bernoulli beam finite elements, SI units, two DOFs per node: v and dv/dx.
export function beamAnalysis(p){
  positive(p,['length','width','height','young','yieldStrength','load']);
  if(!['cantilever','simply-supported'].includes(p.support)||!['point','uniform'].includes(p.loading))throw Error('Choose a supported beam/load case.');
  const L=p.length/1000,b=p.width/1000,h=p.height/1000,E=p.young*1e9,I=b*h**3/12;
  if(L/h<10)throw Error('This slender-beam model requires length / height ≥ 10.');
  const elements=20,n=elements+1,ndof=2*n,le=L/elements,K=Array.from({length:ndof},()=>Array(ndof).fill(0)),F=Array(ndof).fill(0);
  const k0=[[12,6*le,-12,6*le],[6*le,4*le*le,-6*le,2*le*le],[-12,-6*le,12,-6*le],[6*le,2*le*le,-6*le,4*le*le]].map(row=>row.map(v=>v*E*I/le**3));
  const q=p.loading==='uniform'?-p.load:0,fe=[q*le/2,q*le*le/12,q*le/2,-q*le*le/12];
  for(let e=0;e<elements;e++){const ix=[2*e,2*e+1,2*e+2,2*e+3];for(let i=0;i<4;i++){F[ix[i]]+=fe[i];for(let j=0;j<4;j++)K[ix[i]][ix[j]]+=k0[i][j];}}
  if(p.loading==='point')F[p.support==='cantilever'?2*(n-1):elements]-=p.load;
  const fixed=p.support==='cantilever'?[0,1]:[0,2*(n-1)],free=Array.from({length:ndof},(_,i)=>i).filter(i=>!fixed.includes(i));
  const solution=linearSolve(free.map(i=>free.map(j=>K[i][j])),free.map(i=>F[i])),u=Array(ndof).fill(0);free.forEach((d,i)=>u[d]=solution[i]);
  const reactions=fixed.map(i=>({dof:i,value:K[i].reduce((s,v,j)=>s+v*u[j],0)-F[i]}));
  let maxMoment=0;for(let e=0;e<elements;e++){const local=u.slice(2*e,2*e+4),force=k0.map((row,i)=>row.reduce((s,v,j)=>s+v*local[j],0)-fe[i]);maxMoment=Math.max(maxMoment,Math.abs(force[1]),Math.abs(force[3]));}
  const stress=maxMoment*h/(2*I)/1e6,deflections=Array.from({length:n},(_,i)=>({x:i*le*1000,y:u[2*i]*1000}));
  const deflection=Math.max(...deflections.map(p=>Math.abs(p.y)));
  if(!Number.isFinite(stress+deflection))throw Error('The beam calculation overflowed. Check input units.');
  return {deflections,deflection,stress,maxMoment,safetyFactor:p.yieldStrength/stress,reactions,I,largeDeflection:deflection/p.length>.02};
}

// Linear, pin-jointed 2D truss stiffness method. Node coordinates: mm; load: N;
// area: mm²; Young's modulus: GPa. Supports constrain translation only.
export function trussAnalysis(p){
  positive(p,['young','area','yieldStrength']);
  if(!Array.isArray(p.nodes)||p.nodes.length<2||p.nodes.length>30||!Array.isArray(p.members)||p.members.length<1||p.members.length>80)throw Error('Use 2–30 nodes and 1–80 members.');
  const n=p.nodes.length,nd=2*n,E=p.young*1000,A=p.area,K=Array.from({length:nd},()=>Array(nd).fill(0)),F=Array(nd).fill(0),fixed=[];
  p.nodes.forEach((v,i)=>{if(!['x','y','fx','fy'].every(k=>Number.isFinite(v[k])))throw Error('Node values must be finite.');F[2*i]=v.fx;F[2*i+1]=v.fy;if(v.fixX)fixed.push(2*i);if(v.fixY)fixed.push(2*i+1);});
  const members=p.members.map(([a,b])=>{if(!Number.isInteger(a)||!Number.isInteger(b)||a===b||a<0||b<0||a>=n||b>=n)throw Error('Invalid member node indices.');const dx=p.nodes[b].x-p.nodes[a].x,dy=p.nodes[b].y-p.nodes[a].y,L=Math.hypot(dx,dy);if(L<1e-6)throw Error('A member has zero length.');const v=[-dx/L,-dy/L,dx/L,dy/L],ix=[2*a,2*a+1,2*b,2*b+1];for(let i=0;i<4;i++)for(let j=0;j<4;j++)K[ix[i]][ix[j]]+=E*A/L*v[i]*v[j];return {a,b,L,v,ix};});
  const free=Array.from({length:nd},(_,i)=>i).filter(i=>!fixed.includes(i)),u=Array(nd).fill(0);if(!free.length)throw Error('At least one displacement must be free.');
  const solution=linearSolve(free.map(i=>free.map(j=>K[i][j])),free.map(i=>F[i]));free.forEach((v,i)=>u[v]=solution[i]);
  const results=members.map(m=>{const strain=m.v.reduce((s,v,i)=>s+v*u[m.ix[i]],0)/m.L,stress=E*strain;return {...m,stress,force:stress*A};});
  const stress=Math.max(...results.map(m=>Math.abs(m.stress))),deflection=Math.max(...p.nodes.map((_,i)=>Math.hypot(u[2*i],u[2*i+1])));
  if(!Number.isFinite(stress+deflection))throw Error('Unstable truss. Check supports and member connectivity.');
  return {members:results,displacements:p.nodes.map((_,i)=>[u[2*i],u[2*i+1]]),stress,deflection,safetyFactor:stress>0?p.yieldStrength/stress:null,reactions:fixed.map(i=>({dof:i,value:K[i].reduce((s,v,j)=>s+v*u[j],0)-F[i]}))};
}
export function thermalAnalysis(p){positive(p,['length','area','conductivity']);if(!Number.isFinite(p.hot)||!Number.isFinite(p.cold)||p.hot< -273.15||p.cold< -273.15)throw Error('Temperatures must be above absolute zero.');const length=p.length/1000,area=p.area/1e6,heatRate=p.conductivity*area*(p.hot-p.cold)/length,gradient=(p.cold-p.hot)/length;if(!Number.isFinite(heatRate)||!Number.isFinite(gradient))throw Error('The thermal calculation overflowed. Check input units.');return {heatRate,gradient,temperatures:Array.from({length:11},(_,i)=>({x:p.length*i/10,T:p.hot+(p.cold-p.hot)*i/10}))};}
