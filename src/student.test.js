import test from 'node:test';
import assert from 'node:assert/strict';
import {makeObject,documentFor,validateDocument} from './model.js';
import {solveSketch} from './constraints.js';
import {initKernel,properties,projectSolid,drawingEdges,sectionSolid} from './kernel.js';
import {createFeature,featureDefinitions,developedLength} from './features.js';
import {jointBase,applyJoints,validateJoints,interference} from './assembly.js';
import {beamAnalysis,trussAnalysis,thermalAnalysis} from './analysis.js';
import {drawingSheet} from './drawing.js';
await initKernel();
const near=(a,b,tol=1e-4)=>assert.ok(Math.abs(a-b)<tol,`${a} differs from ${b}`);
const relation=c=>({id:crypto.randomUUID(),...c});
test('horizontal and driving length solve together, then survive editing and serialization',()=>{
  const line=makeObject('line',{w:90,d:20}),doc=documentFor('constraint',[line]);doc.constraints=[relation({kind:'horizontal',a:line.id}),relation({kind:'length',a:line.id,value:100})];
  const result=solveSketch(doc),o=result.objects[0];near(Math.hypot(o.w,o.d),100);near(o.w*Math.sin(o.rotation*Math.PI/180)+o.d*Math.cos(o.rotation*Math.PI/180),0);
  o.x=35;const edited=solveSketch(result,{id:o.id,key:'x',value:35});near(edited.objects[0].x,35);assert.deepEqual(validateDocument(JSON.parse(JSON.stringify(edited))),edited);
});
test('concentric circles follow the edited center without losing their radii',()=>{
  const a=makeObject('circle',{r:20}),b=makeObject('circle',{r:5});const d=documentFor('c',[a,b]);d.constraints=[relation({kind:'concentric',a:a.id,b:b.id}),relation({kind:'radius',a:b.id,value:5})];a.x=23;const result=solveSketch(d,{id:a.id,key:'x',value:23});near(result.objects[1].x,23);near(result.objects[1].r,5);
});
test('parallel, perpendicular, equal and coincident lines solve against fixed reference',()=>{
  const a=makeObject('line',{x:0,y:0,w:30,d:0}),b=makeObject('line',{x:30,y:1,w:2,d:25});const d=documentFor('lines',[a,b]);d.constraints=[relation({kind:'fixed',a:a.id,values:{x:0,y:0,w:30,d:0,rotation:0}}),relation({kind:'perpendicular',a:b.id,b:a.id}),relation({kind:'equal',a:b.id,b:a.id}),relation({kind:'coincident',a:b.id,b:a.id,endA:0,endB:1})];let result=solveSketch(d);near(result.objects[1].x,30);near(result.objects[1].y,0);near(Math.hypot(result.objects[1].w,result.objects[1].d),30);d.constraints[1].kind='parallel';result=solveSketch(d);const q=result.objects[1],angle=q.rotation*Math.PI/180;near(q.w*Math.sin(angle)+q.d*Math.cos(angle),0);
});
test('conflicting dimensions fail without mutating the document',()=>{const a=makeObject('line',{w:100,d:0}),d=documentFor('bad',[a]);d.constraints=[relation({kind:'length',a:a.id,value:100}),relation({kind:'length',a:a.id,value:50})];const before=structuredClone(d);assert.throws(()=>solveSketch(d),/Conflicting/);assert.deepEqual(d,before);});
test('all feature generators produce positive closed solids and save their parameters',()=>{
  for(const [kind,def] of Object.entries(featureDefinitions)){const object=createFeature({kind,params:def.fields}),info=properties(object);assert.ok(info.volume>0,kind);assert.ok(info.triangles>0,kind);assert.deepEqual(validateDocument(documentFor(kind,[object])).objects[0].feature,object.feature);}
});
test('rounded plate, loft, tube sweep and threaded rod have plausible analytic volumes',()=>{
  const rounded=createFeature({kind:'rounded',params:featureDefinitions.rounded.fields}),p=featureDefinitions.rounded.fields;near(properties(rounded).volume,(p.width*p.depth-(4-Math.PI)*p.radius**2)*p.height,2);
  const loft=createFeature({kind:'loft',params:featureDefinitions.loft.fields});near(properties(loft).volume,50/3*(2400+600+Math.sqrt(2400*600)),.01);
  const sweep=createFeature({kind:'sweep',params:featureDefinitions.sweep.fields});near(properties(sweep).volume,Math.PI*(8**2-6**2)*40*Math.PI/2,10);
  const thread=createFeature({kind:'thread',params:featureDefinitions.thread.fields}),v=properties(thread).volume;assert.ok(v>Math.PI*5**2*30&&v<Math.PI*6**2*30,`thread volume ${v}`);
  near(developedLength(featureDefinitions.sheet.fields),70+Math.PI/2*(4+.4*2));
});
test('revolute joints rotate around the parent origin; slider moves in parent axes',()=>{
  const a=makeObject('box',{x:10}),b=makeObject('box',{x:30});const d=documentFor('assembly',[a,b]);d.joints=[{id:'joint',parent:a.id,child:b.id,type:'revolute',axis:'z',min:-180,max:180,value:90,base:jointBase(a,b)}];let result=applyJoints(d);near(result.objects[1].x,10);near(result.objects[1].y,20);near(result.objects[1].rotation,90);
  d.joints[0].type='slider';d.joints[0].axis='x';d.joints[0].value=5;result=applyJoints(d);near(result.objects[1].x,35);assert.deepEqual(validateDocument(d).joints,d.joints);
});
test('joint loops and multiple parents are rejected; interference measures real overlap',()=>{
  const a=makeObject('box',{w:10,d:10,h:10}),b=makeObject('box',{w:10,d:10,h:10,x:5}),c=makeObject('box',{w:10,d:10,h:10,x:15});const j={id:'one',parent:a.id,child:b.id,type:'fixed',axis:'z',min:0,max:0,value:0,base:jointBase(a,b)};assert.throws(()=>validateJoints([j,{...j,id:'two',parent:b.id,child:a.id}], [a,b]),/loop/);const collisions=interference([a,b,c]);assert.equal(collisions.length,1);near(collisions[0].volume,500);
});
test('beam FEM agrees with closed-form point and uniform loading for both supports',()=>{
  const p={length:1000,width:30,height:50,young:200,yieldStrength:250,load:100},L=1,E=200e9,I=.03*.05**3/12;
  for(const support of ['cantilever','simply-supported'])for(const loading of ['point','uniform']){const r=beamAnalysis({...p,support,loading});const deflection=loading==='point'?p.load*L**3/(E*I*(support==='cantilever'?3:48)):p.load*L**4/(E*I)*(support==='cantilever'?1/8:5/384);near(r.deflection,deflection*1000,1e-6);near(r.reactions.filter(r=>r.dof%2===0).reduce((s,r)=>s+r.value,0),100,1e-5);}
});
test('triangular truss recovers exact member forces and balances applied load',()=>{
  const p={young:200,area:100,yieldStrength:250,nodes:[{x:0,y:0,fx:0,fy:0,fixX:true,fixY:true},{x:1000,y:0,fx:0,fy:0,fixY:true},{x:500,y:500,fx:0,fy:-1000}],members:[[0,1],[0,2],[1,2]]};const r=trussAnalysis(p);near(r.members[0].force,500);near(r.members[1].force,-Math.sqrt(500000));near(r.reactions.filter(r=>r.dof%2===1).reduce((s,r)=>s+r.value,0),1000);assert.throws(()=>trussAnalysis({...p,nodes:p.nodes.map(n=>({...n,fixX:false,fixY:false}))}),/singular|Unstable/);
});
test('steady conduction matches Fourier law and reverses heat direction',()=>{const p={length:100,area:1000,conductivity:205,hot:100,cold:20};near(thermalAnalysis(p).heatRate,164);near(thermalAnalysis({...p,hot:20,cold:100}).heatRate,-164);assert.throws(()=>thermalAnalysis({...p,cold:-300}));});
test('right projection is YZ, front is XZ, and a midheight section encloses the box',()=>{
  const o=makeObject('box',{w:100,d:60,h:20,z:5});const size=paths=>{const pts=paths.flat();return [0,1].map(k=>Math.max(...pts.map(p=>p[k]))-Math.min(...pts.map(p=>p[k])));};assert.deepEqual(size(projectSolid(o,'right')),[60,20]);assert.deepEqual(size(projectSolid(o,'front')),[100,20]);assert.deepEqual(size(sectionSolid(o,10)),[100,60]);const front=projectSolid(o,'front').flat();near(Math.min(...front.map(p=>p[1])),5);
});
test('hidden edges distinguish obscured lines and sheets preserve tolerances and title block',()=>{
  const a=makeObject('box',{w:40,d:30,h:10}),edges=drawingEdges([a],'front');assert.ok(edges.some(e=>e.hidden));assert.ok(edges.some(e=>!e.hidden));const d=documentFor('Drawing',[a,makeObject('dimension',{w:40,d:0,tolerance:.05,offset:-15})]);d.sheet={section:true,sectionZ:5,author:'A < B',number:'ME-01',revision:'B',material:'Aluminum',notes:'Example',hiddenEdges:true};const loaded=validateDocument(JSON.parse(JSON.stringify(d))),svg=drawingSheet(loaded);assert.match(svg,/SECTION A–A/);assert.match(svg,/40 ±0.05 mm/);assert.match(svg,/A &lt; B/);assert.match(svg,/ME-01/);assert.match(svg,/url\(#section-hatch\)/);assert.doesNotMatch(svg,/NaN|Infinity/);
});
