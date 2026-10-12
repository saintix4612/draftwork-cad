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

// Implicit one-dimensional transient conduction with fixed end temperatures.
// Length: mm, area: mm², time: s, k: W/(m K), density: kg/m³, cp: J/(kg K).
export function transientThermalAnalysis(p){
  positive(p,['length','area','conductivity','density','specificHeat','duration']);
  const nodes=p.nodes??21,steps=p.steps??300;
  if(!Number.isInteger(nodes)||nodes<5||nodes>81||!Number.isInteger(steps)||steps<1||steps>5000)throw Error('Use 5–81 nodes and 1–5000 time steps.');
  if(![p.hot,p.cold,p.initial].every(Number.isFinite)||[p.hot,p.cold,p.initial].some(t=>t< -273.15))throw Error('Temperatures must be above absolute zero.');
  const L=p.length/1000,A=p.area/1e6,dx=L/(nodes-1),dt=p.duration/steps,alpha=p.conductivity/(p.density*p.specificHeat),r=alpha*dt/(dx*dx),m=nodes-2;
  if(!Number.isFinite(r)||!Number.isFinite(alpha)||alpha<=0)throw Error('Thermal properties exceed the supported range.');
  let T=Array(nodes).fill(p.initial);T[0]=p.hot;T[nodes-1]=p.cold;
  const snapshots=[{time:0,temperatures:T.slice()}],marks=new Set([Math.ceil(steps*.25),Math.ceil(steps*.5),Math.ceil(steps*.75),steps]);
  for(let step=1;step<=steps;step++){
    const lower=Array(m).fill(-r),diag=Array(m).fill(1+2*r),upper=Array(m).fill(-r),rhs=T.slice(1,-1);
    rhs[0]+=r*p.hot;rhs[m-1]+=r*p.cold;
    for(let i=1;i<m;i++){const q=lower[i]/diag[i-1];diag[i]-=q*upper[i-1];rhs[i]-=q*rhs[i-1];}
    const next=Array(nodes).fill(0);next[0]=p.hot;next[nodes-1]=p.cold;next[nodes-2]=rhs[m-1]/diag[m-1];
    for(let i=m-2;i>=0;i--)next[i+1]=(rhs[i]-upper[i]*next[i+2])/diag[i];
    T=next;
    if(marks.has(step))snapshots.push({time:step*dt,temperatures:T.slice()});
  }
  const heatCapacity=p.density*p.specificHeat*A*dx,energy=heatCapacity*(T.slice(1,-1).reduce((sum,v)=>sum+v,0)+(T[0]+T.at(-1))/2-(nodes-1)*p.initial);
  const heatIn=-p.conductivity*A*(T[1]-T[0])/dx,heatOut=-p.conductivity*A*(T.at(-1)-T.at(-2))/dx;
  if(!Number.isFinite(energy+heatIn+heatOut)||T.some(v=>!Number.isFinite(v)))throw Error('The transient thermal calculation overflowed.');
  return {snapshots:snapshots.map(s=>({time:s.time,temperatures:s.temperatures.map((T,i)=>({x:p.length*i/(nodes-1),T}))})),final:T,
    nodes,steps,dt,FourierNumber:r,thermalDiffusivity:alpha,storedEnergy:energy,heatRateIn:heatIn,heatRateOut:heatOut};
}

// Educational finite-wing estimate using thin-airfoil theory and a simple
// aspect-ratio lift-slope correction; it is not a CFD or viscous-drag model.
export function aeroAnalysis(p){
  positive(p,['chord','span','speed','density','viscosity']);
  if(!Number.isFinite(p.angle)||Math.abs(p.angle)>45)throw Error('Angle of attack must be between −45° and 45°.');
  const raw=String(p.airfoil??'0012').trim();
  const code=/^\d{1,4}$/.test(raw)?raw.padStart(4,'0'):raw;
  if(!/^\d{1,4}$/.test(raw))throw Error('Enter a four-digit NACA airfoil code such as 0012 or 2412.');
  const m=Number(code[0])/100,camberPosition=Number(code[1])/10,thickness=Number(code.slice(2))/100;
  if(thickness===0||(m>0&&(camberPosition===0||camberPosition>=1)))throw Error('Use a nonzero thickness and a valid camber position for this NACA 4-digit profile.');
  let integral=0;const n=400,h=Math.PI/n;
  const slope=theta=>{if(!m)return 0;const x=(1-Math.cos(theta))/2;return x<camberPosition?2*m/(camberPosition**2)*(camberPosition-x):2*m/((1-camberPosition)**2)*(camberPosition-x);};
  for(let i=0;i<=n;i++){const theta=i*h;integral+=(i===0||i===n?1:i%2?4:2)*slope(theta)*(1-Math.cos(theta));}
  const zeroLiftAngle=integral*h/(3*Math.PI),aspectRatio=p.span/p.chord,alpha=p.angle*Math.PI/180;
  const liftSlope=2*Math.PI*aspectRatio/(aspectRatio+2),CL=liftSlope*(alpha-zeroLiftAngle),CDi=CL*CL/(Math.PI*.8*aspectRatio);
  const q=.5*p.density*p.speed**2,area=p.chord/1000*p.span/1000,lift=q*area*CL,inducedDrag=q*area*CDi,reynolds=p.density*p.speed*(p.chord/1000)/p.viscosity,mach=p.speed/343;
  if(![CL,CDi,lift,inducedDrag,reynolds,mach].every(Number.isFinite))throw Error('The aerodynamic calculation overflowed. Check inputs and units.');
  const warnings=[];if(aspectRatio<4)warnings.push('Low aspect ratio: the simple finite-wing correction may be inaccurate.');if(Math.abs(p.angle)>12)warnings.push('Angle is beyond the usual attached-flow range; the linear model is unreliable and does not predict stall.');if(mach>.3)warnings.push('Compressibility may matter at this speed; this model assumes incompressible flow.');
  return {airfoil:code,camber:m,thickness,aspectRatio,zeroLiftAngle:zeroLiftAngle*180/Math.PI,liftSlope,CL,CDi,lift,inducedDrag,reynolds,mach,warnings,
    assumptions:'Thin-airfoil lift with a simple finite-span correction; induced drag only. No viscous/profile drag, stall, turbulence, compressibility correction, propeller effects or 3D flow field.'};
}

// Compare at common spatial locations; refinement remains within solver limits.
export function thermalConvergence(p){
  const coarse=transientThermalAnalysis(p),nodes=Math.min(81,2*(coarse.nodes-1)+1),steps=Math.min(5000,2*coarse.steps);
  if(nodes===coarse.nodes&&steps===coarse.steps)throw Error('Already at maximum resolution. Start with fewer than 81 nodes or 5000 steps.');
  const refined=transientThermalAnalysis({...p,nodes,steps});
  const differences=coarse.final.map((T,i)=>{const x=i/(coarse.nodes-1)*(nodes-1),j=Math.min(nodes-2,Math.floor(x)),f=x-j;return Math.abs(T-((1-f)*refined.final[j]+f*refined.final[j+1]));});
  return {coarse:{nodes:coarse.nodes,steps:coarse.steps},refined:{nodes,steps},maxTemperatureDifference:Math.max(...differences),storedEnergyDifference:Math.abs(coarse.storedEnergy-refined.storedEnergy),heatRateInDifference:Math.abs(coarse.heatRateIn-refined.heatRateIn),note:'Difference between two resolutions, not a certified error bound. Repeat refinement and consider spatial and temporal errors separately.'};
}
