import test from 'node:test';
import assert from 'node:assert/strict';
import {makeObject,documentFor,validateDocument,History} from './model.js';
import {initKernel,properties} from './kernel.js';
import {buildOperation,rebuildDocument} from './model-history.js';
import {independentCopy} from './linked-extrusions.js';
import {jointBase} from './assembly.js';
await initKernel();
const near=(a,b,t=.002)=>assert.ok(Math.abs(a-b)<=Math.abs(b)*t+1e-5,`${a} vs ${b}`);
function plate(){const sketch=makeObject('rectangle',{w:80,d:50,visible:false}),body=makeObject('box',{w:80,d:50,h:10,sketchId:sketch.id,visible:false});const hole=buildOperation({kind:'hole',baseId:body.id,diameter:10,x:0,y:0},[body]);return documentFor('Hole',[sketch,body,hole]);}
test('sketch, extrusion and hole edits rebuild the finished volume',()=>{
  const d=plate();d.objects[0].w=100;d.objects[1].h=20;d.objects[2].recipe.diameter=20;
  const result=rebuildDocument(d);near(properties(result.objects[2]).volume,(100*50-Math.PI*100)*20);
  assert.equal(d.objects[2].h,10);assert.equal(result.objects[2].id,d.objects[2].id);
  const loaded=rebuildDocument(JSON.parse(JSON.stringify(result)));near(properties(loaded.objects[2]).volume,properties(result.objects[2]).volume,1e-7);
});
test('boolean chains rebuild in dependency order regardless of array order',()=>{
  const a=makeObject('box',{w:20,d:20,h:10}),b=makeObject('box',{w:20,d:20,h:10,x:10});
  const union=buildOperation({kind:'boolean',baseId:a.id,toolId:b.id,operation:'add'},[a,b]);
  const hole=buildOperation({kind:'hole',baseId:union.id,diameter:4,x:0,y:0},[union]);
  const d=documentFor('Chain',[hole,union,b,a]);b.x=15;
  const result=rebuildDocument(d);near(properties(result.objects[0]).volume,7000-Math.PI*4*10);
  union.recipe.operation='intersect';hole.recipe.x=7.5;hole.recipe.diameter=2;
  near(properties(rebuildDocument(d).objects[0]).volume,1000-Math.PI*10);
});
test('bad edits reject atomically and history restores edited recipes',()=>{
  const d=plate(),original=JSON.stringify(d),bad=structuredClone(d);bad.objects[0].x=200;
  assert.throws(()=>rebuildDocument(bad),/misses/);assert.equal(JSON.stringify(d),original);
  const h=new History(d),next=structuredClone(d);next.objects[2].recipe.diameter=14;h.push(rebuildDocument(next));
  assert.equal(h.undo().objects[2].recipe.diameter,10);assert.equal(h.redo().objects[2].recipe.diameter,14);
  const copy=independentCopy(d.objects[2]);assert.equal(copy.recipe,undefined);near(properties(copy).volume,properties(d.objects[2]).volume,1e-9);
});
test('missing inputs, invalid parameters and cycles are rejected',()=>{
  const d=plate();for(const recipe of [{kind:'hole',baseId:'missing',diameter:10,x:0,y:0},{kind:'hole',baseId:d.objects[2].id,diameter:10,x:0,y:0},{kind:'hole',baseId:d.objects[1].id,diameter:-1,x:0,y:0}]){const bad=structuredClone(d);bad.objects[2].recipe=recipe;assert.throws(()=>validateDocument(bad));}
});
test('saved assembly pose is evaluated before dependent cuts',()=>{
  const parent=makeObject('box'),tool=makeObject('box',{w:5,d:5,h:12,z:-1}),base=makeObject('box',{w:20,d:20,h:10});
  const result=buildOperation({kind:'boolean',baseId:base.id,toolId:tool.id,operation:'subtract'},[base,tool]);
  const d=documentFor('Moving cutter',[result,tool,base,parent]);d.joints=[{id:'slide',parent:parent.id,child:tool.id,type:'slider',axis:'x',min:0,max:30,value:20,base:jointBase(parent,tool)}];
  near(properties(rebuildDocument(d).objects[0]).volume,4000);
  d.joints[0].parent=result.id;assert.throws(()=>validateDocument(d),/cycle/);
});
test('linked results cannot become moving joint children',()=>{
  const d=plate(),a=d.objects[1],b=d.objects[2];d.joints=[{id:'joint',parent:a.id,child:b.id,type:'fixed',axis:'x',min:0,max:0,value:0,base:jointBase(a,b)}];assert.throws(()=>validateDocument(d),/Detach/);
});
