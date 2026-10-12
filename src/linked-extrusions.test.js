import test from 'node:test';
import assert from 'node:assert/strict';
import {makeObject,documentFor,validateDocument,History} from './model.js';
import {solveSketch} from './constraints.js';
import {independentCopy} from './linked-extrusions.js';
import {jointBase,applyJoints} from './assembly.js';

const fixture=()=>{const sketch=makeObject('rectangle',{w:30,d:20,visible:false});return documentFor('Linked plate',[sketch,makeObject('box',{sketchId:sketch.id,h:8})]);};
test('source profile and placement rebuild while independent height and appearance survive',()=>{
  const doc=fixture(),s=doc.objects[0];Object.assign(s,{w:75,d:45,x:10,y:20,z:5,rotation:30});
  const result=validateDocument(doc),b=result.objects[1];
  assert.deepEqual([b.w,b.d,b.x,b.y,b.z,b.rotation,b.h],[75,45,10,20,5,30,8]);
  assert.equal(doc.objects[1].w,80);assert.equal(b.visible,true);
  assert.deepEqual(validateDocument(JSON.parse(JSON.stringify(result))),result);
});
test('constraint-driven sketch edits propagate to the extrusion',()=>{
  const doc=fixture(),s=doc.objects[0];doc.constraints=[{id:'width',kind:'width',a:s.id,value:55}];
  const result=validateDocument(solveSketch(validateDocument(doc)));
  assert.ok(Math.abs(result.objects[1].w-55)<1e-4);
});
test('circles and polygon profiles remain linked without aliasing source points',()=>{
  for(const [type,solid,props] of [['circle','cylinder',{r:7}],['polygon','extrusion',{points:[[0,0],[30,0],[0,20]]}]]){
    const s=makeObject(type,props),b=makeObject(solid,{...props,sketchId:s.id,h:12});
    const result=validateDocument(documentFor(type,[s,b]));assert.equal(result.objects[1].r,s.r);
    if(type==='polygon'){assert.deepEqual(result.objects[1].points,s.points);assert.notEqual(result.objects[1].points,result.objects[0].points);}
  }
});
test('missing, incompatible, and self-referencing sources are rejected',()=>{
  for(const source of ['missing','self']){const d=fixture();d.objects[1].sketchId=source==='self'?d.objects[1].id:'missing';assert.throws(()=>validateDocument(d),/original/);}
  const d=fixture();d.objects[0].type='circle';assert.throws(()=>validateDocument(d),/original/);
});
test('detached copies stay independent and undo restores the link',()=>{
  const d=validateDocument(fixture()),h=new History(d),copy=independentCopy(d.objects[1]);
  delete d.objects[1].sketchId;h.push(d);assert.ok(h.undo().objects[1].sketchId);assert.equal(h.redo().objects[1].sketchId,undefined);
  assert.equal(copy.sketchId,undefined);d.objects[0].w=100;assert.equal(validateDocument(d).objects[1].w,30);
});
test('linked extrusion can drive an assembly parent but cannot be a joint child',()=>{
  const d=validateDocument(fixture()),parent=d.objects[1],child=makeObject('box',{x:20});d.objects.push(child);
  d.joints=[{id:'joint',parent:parent.id,child:child.id,type:'fixed',axis:'x',min:0,max:0,value:0,base:jointBase(parent,child)}];
  d.objects[0].x=10;assert.equal(applyJoints(validateDocument(d)).objects[2].x,30);
  d.joints[0].child=parent.id;d.joints[0].parent=child.id;assert.throws(()=>validateDocument(d),/Detach/);
});
test('older documents migrate to version 5',()=>{for(const version of [1,2])assert.equal(validateDocument({...fixture(),version}).version,5);});
