import test from 'node:test';
import assert from 'node:assert/strict';
import {initKernel,booleanOperation} from './kernel.js';
import {makeObject} from './model.js';
import {meshSolid} from './solid-study-mesh.js';
import {solveSolidStudy,hexElement} from './solid-study.js';
await initKernel();
const near=(a,b,t=1e-5)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
const inputs={young:200,poisson:.3,yieldStrength:250,support:0,loadFace:1,force:[0,0,-100]};
test('HEX8 stiffness is symmetric and rigid translation produces no force',()=>{
  const {K}=hexElement([2,3,4],200,.3);
  for(let i=0;i<24;i++){for(let j=0;j<24;j++)near(K[24*i+j],K[24*j+i],1e-8);for(let a=0;a<3;a++){let sum=0;for(let j=a;j<24;j+=3)sum+=K[24*i+j];near(sum,0,1e-8);}}
});
test('axial bar with zero Poisson ratio reproduces FL/EA and uniform stress',()=>{
  const mesh=meshSolid(makeObject('box',{w:100,d:10,h:10}),16),r=solveSolidStudy(mesh,{...inputs,poisson:0,force:[1000,0,0]});
  near(r.maxDisplacement,.005,1e-9);near(r.peakStress,10,1e-6);near(r.reaction[0],-1000,1e-5);near(r.strainEnergy,2.5,1e-6);
  assert.equal(mesh.volumeError,0);
});
test('cantilever refinement approaches analytical bending displacement and balances force and moment',()=>{
  const o=makeObject('box',{w:100,d:10,h:10}),coarse=solveSolidStudy(meshSolid(o,16),inputs),fine=solveSolidStudy(meshSolid(o,32),inputs),reference=100*100**3/(3*200000*(10*10**3/12));
  assert.ok(Math.abs(fine.maxDisplacement-reference)<Math.abs(coarse.maxDisplacement-reference));assert.ok(Math.abs(fine.maxDisplacement/reference-1)<.06);
  fine.reaction.forEach((v,a)=>near(v+inputs.force[a],0,1e-5));fine.reactionMoment.forEach((v,a)=>near(v+fine.loadMoment[a],0,1e-4));assert.ok(fine.residual<1e-6);
});
test('load scaling doubles displacement and stress while quadrupling elastic energy',()=>{
  const mesh=meshSolid(makeObject('box',{w:40,d:10,h:10}),16),a=solveSolidStudy(mesh,inputs),b=solveSolidStudy(mesh,{...inputs,force:[0,0,-200]});
  near(b.maxDisplacement,2*a.maxDisplacement,1e-8);near(b.peakStress,2*a.peakStress,1e-6);near(b.strainEnergy,4*a.strainEnergy,1e-7);
});
test('voxel mesher resolves a through-hole and rejects disconnected bodies',()=>{
  const box=makeObject('box',{w:30,d:30,h:10}),cutter=makeObject('cylinder',{r:5,h:12,z:-1}),drilled=booleanOperation(box,cutter,'subtract'),mesh=meshSolid(drilled,20);
  assert.ok(mesh.meshVolume<9000);assert.ok(Math.abs(mesh.volumeError)<.05);
  for(const c of mesh.cells){const p=[0,1,2].map(a=>c.reduce((s,i)=>s+mesh.nodes[i][a],0)/8);assert.ok(Math.hypot(p[0],p[1])>=5-1e-6);}
  const a=makeObject('box',{w:10,d:10,h:10,x:-20}),b=makeObject('box',{w:10,d:10,h:10,x:20});assert.throws(()=>meshSolid(booleanOperation(a,b,'add'),24),/disconnected/);
});
test('invalid materials, unsupported load cases and excessive meshes are rejected',()=>{
  const mesh=meshSolid(makeObject('box',{w:20,d:10,h:10}),8);
  for(const change of [{poisson:.499},{young:0},{force:[0,0,0]},{loadFace:0},{support:9}])assert.throws(()=>solveSolidStudy(mesh,{...inputs,...change}));
  assert.throws(()=>meshSolid(makeObject('box',{w:10,d:10,h:10}),64),/exceeds/);
});
