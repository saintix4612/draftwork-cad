// Small-strain isotropic elasticity, fully integrated HEX8 elements.
// Units: mm, N, MPa. Engineering shear strains are used in B.
const signs=[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]];
function strainMatrix(spacing,point){
  const B=Array.from({length:6},()=>new Float64Array(24));
  signs.forEach(([a,b,c],i)=>{
    const [x,y,z]=point,gx=a*(1+b*y)*(1+c*z)/(4*spacing[0]),gy=b*(1+a*x)*(1+c*z)/(4*spacing[1]),gz=c*(1+a*x)*(1+b*y)/(4*spacing[2]),k=3*i;
    B[0][k]=gx;B[1][k+1]=gy;B[2][k+2]=gz;
    B[3][k]=gy;B[3][k+1]=gx;B[4][k+1]=gz;B[4][k+2]=gy;B[5][k]=gz;B[5][k+2]=gx;
  });return B;
}
function elasticity(young,poisson){
  const E=young*1000,lambda=E*poisson/((1+poisson)*(1-2*poisson)),mu=E/(2*(1+poisson));
  return Array.from({length:6},(_,i)=>Float64Array.from({length:6},(_,j)=>i<3&&j<3?lambda+(i===j?2*mu:0):i===j?mu:0));
}
export function hexElement(spacing,young,poisson){
  const D=elasticity(young,poisson),K=new Float64Array(576),Bs=[],g=1/Math.sqrt(3),jac=spacing.reduce((a,b)=>a*b,1)/8;
  for(const x of [-g,g])for(const y of [-g,g])for(const z of [-g,g]){
    const B=strainMatrix(spacing,[x,y,z]),DB=D.map(row=>Float64Array.from({length:24},(_,j)=>row.reduce((s,v,k)=>s+v*B[k][j],0)));Bs.push(B);
    for(let i=0;i<24;i++)for(let j=0;j<24;j++)for(let s=0;s<6;s++)K[24*i+j]+=B[s][i]*DB[s][j]*jac;
  }return {K,D,Bs};
}
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
export const vonMises=s=>Math.sqrt(((s[0]-s[1])**2+(s[1]-s[2])**2+(s[2]-s[0])**2)/2+3*(s[3]**2+s[4]**2+s[5]**2));

export function solveSolidStudy(mesh,p,progress=()=>{}) {
  if(!Number.isFinite(p.young)||p.young<=0||p.young>1000||!Number.isFinite(p.poisson)||p.poisson<0||p.poisson>.45||!Number.isFinite(p.yieldStrength)||p.yieldStrength<=0)throw Error('Use E > 0 up to 1000 GPa, Poisson ratio 0–0.45 and positive yield strength.');
  if(!Array.isArray(p.force)||p.force.length!==3||p.force.some(v=>!Number.isFinite(v)||Math.abs(v)>1e9)||Math.hypot(...p.force)===0)throw Error('Enter a finite, nonzero total force in N.');
  if(!Number.isInteger(p.support)||!Number.isInteger(p.loadFace)||p.support<0||p.support>5||p.loadFace<0||p.loadFace>5||p.support===p.loadFace)throw Error('Choose distinct fixed and loaded sides.');
  if(!mesh.cells.length||mesh.cells.length>3000||mesh.nodes.length>12000)throw Error('Study mesh exceeds supported limits.');
  const n=mesh.nodes.length*3,locked=new Uint8Array(n),F=new Float64Array(n),weights=new Float64Array(mesh.nodes.length),fixedNodes=[];
  const axis=Math.floor(p.support/2),boundary=mesh.bounds[p.support%2?'max':'min'][axis],tol=Math.max(...mesh.spacing)*1e-6;
  mesh.nodes.forEach((v,i)=>{if(Math.abs(v[axis]-boundary)<tol){fixedNodes.push(i);locked.fill(1,3*i,3*i+3);}});
  const loadAxis=Math.floor(p.loadFace/2),loadBoundary=mesh.bounds[p.loadFace%2?'max':'min'][loadAxis];
  for(const face of mesh.surface)if(face.side===p.loadFace&&face.nodes.every(i=>Math.abs(mesh.nodes[i][loadAxis]-loadBoundary)<tol)){
    const area=mesh.spacing.filter((_,a)=>a!==loadAxis).reduce((a,b)=>a*b,1);face.nodes.forEach(i=>weights[i]+=area/4);
  }
  const area=weights.reduce((a,b)=>a+b,0);
  if(fixedNodes.length<3||area===0)throw Error('The selected bounding side has no resolved support or load face. Choose another side or refine the mesh.');
  weights.forEach((w,i)=>p.force.forEach((f,a)=>F[3*i+a]=f*w/area));
  const {K,D,Bs}=hexElement(mesh.spacing,p.young,p.poisson),dofs=mesh.cells.map(c=>Int32Array.from(c.flatMap(i=>[3*i,3*i+1,3*i+2]))),diagonal=new Float64Array(n);
  for(const ids of dofs)for(let i=0;i<24;i++)diagonal[ids[i]]+=K[24*i+i];
  const multiply=(x,out,mask=true)=>{out.fill(0);for(const ids of dofs)for(let i=0;i<24;i++){let sum=0;const row=i*24;for(let j=0;j<24;j++)sum+=K[row+j]*x[ids[j]];out[ids[i]]+=sum;}if(mask)for(let i=0;i<n;i++)if(locked[i])out[i]=0;};
  const u=new Float64Array(n),r=F.slice(),z=new Float64Array(n),direction=new Float64Array(n),Ap=new Float64Array(n);
  for(let i=0;i<n;i++){if(locked[i])r[i]=0;if(!(diagonal[i]>0))throw Error('Mesh contains an unsupported node.');z[i]=r[i]/diagonal[i];direction[i]=z[i];}
  const norm=Math.sqrt(dot(r,r));if(norm===0)throw Error('All loaded nodes are fixed. Choose another loaded side.');
  let rz=dot(r,z),iterations=0,residual=1;
  for(;iterations<1600;iterations++){
    multiply(direction,Ap);const curvature=dot(direction,Ap);if(!(curvature>0))throw Error('Stiffness is singular. Check the mesh connections and supports.');
    const alpha=rz/curvature;
    for(let i=0;i<n;i++){u[i]+=alpha*direction[i];r[i]-=alpha*Ap[i];}
    residual=Math.sqrt(dot(r,r))/norm;
    if(iterations%25===0)progress({iterations,residual});
    if(residual<1e-8)break;
    for(let i=0;i<n;i++)z[i]=r[i]/diagonal[i];const next=dot(r,z),beta=next/rz;rz=next;
    for(let i=0;i<n;i++)direction[i]=z[i]+beta*direction[i];
  }
  multiply(u,Ap,false);
  let trueError=0;for(let i=0;i<n;i++)if(!locked[i])trueError+=(Ap[i]-F[i])**2;
  residual=Math.sqrt(trueError)/norm;
  if(residual>1e-6||!Number.isFinite(residual))throw Error('Solver did not converge. Reduce aspect ratio or mesh resolution. No result accepted.');
  const reaction=[0,0,0],reactionMoment=[0,0,0],loadMoment=[0,0,0];
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const center=mesh.bounds.min.map((v,a)=>(v+mesh.bounds.max[a])/2);
  mesh.nodes.forEach((v,i)=>{const arm=v.map((x,a)=>x-center[a]),f=Array.from(F.slice(3*i,3*i+3)),lm=cross(arm,f);lm.forEach((x,a)=>loadMoment[a]+=x);if(locked[3*i]){const force=f.map((x,a)=>Ap[3*i+a]-x),moment=cross(arm,force);force.forEach((x,a)=>reaction[a]+=x);moment.forEach((x,a)=>reactionMoment[a]+=x);}});
  const stresses=dofs.map(ids=>Math.max(...Bs.map(B=>{const strain=B.map(row=>row.reduce((s,v,i)=>s+v*u[ids[i]],0)),stress=D.map(row=>row.reduce((s,v,i)=>s+v*strain[i],0));return vonMises(stress);}))),displacements=mesh.nodes.map((_,i)=>Array.from(u.slice(3*i,3*i+3))),magnitudes=displacements.map(v=>Math.hypot(...v));
  const peakStress=Math.max(...stresses),maxDisplacement=Math.max(...magnitudes),loadNodes=Array.from(weights).map((w,i)=>w>0?i:-1).filter(i=>i>=0);
  if(!Number.isFinite(peakStress+maxDisplacement))throw Error('Study overflowed. Check units.');
  return {displacements,magnitudes,stresses,peakStress,maxDisplacement,safetyFactor:peakStress>0?p.yieldStrength/peakStress:null,reaction,reactionMoment,loadMoment,loadNodes,fixedNodes,loadArea:area,iterations:iterations+1,residual,strainEnergy:.5*dot(u,F),largeDisplacement:maxDisplacement/Math.min(...mesh.bounds.max.map((v,a)=>v-mesh.bounds.min[a]))>.02};
}
