import test from 'node:test';
import assert from 'node:assert/strict';
import {initKernel,properties} from './kernel.js';
import {makeObject,documentFor,validateDocument} from './model.js';
import {buildOperation,rebuildDocument} from './model-history.js';
await initKernel();
const near=(a,b,t=1e-5)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
test('plane cuts retain the chosen half and survive save/rebuild',()=>{
  const box=makeObject('box',{w:40,d:30,h:20}),r={kind:'plane',baseId:box.id,normal:[0,0,2],offset:7,reverse:true},cut=buildOperation(r,[box]);near(properties(cut).volume,40*30*7);
  const d=rebuildDocument(JSON.parse(JSON.stringify(documentFor('Cut',[box,cut]))));near(properties(d.objects[1]).volume,8400);d.objects[0].w=50;near(properties(rebuildDocument(d).objects[1]).volume,10500);
  near(properties(buildOperation({...r,reverse:false},[box])).volume,40*30*13);
});
test('hollowing subtracts a constant-wall cavity and preserves placement',()=>{
  const box=makeObject('box',{w:40,d:30,h:20,x:100,rotation:35}),r={kind:'shell',baseId:box.id,thickness:2},shell=buildOperation(r,[box]);near(properties(shell).volume,24000-36*26*18,.01);
  const d=documentFor('Shell',[box,shell]);d.objects[1].recipe.thickness=3;near(properties(rebuildDocument(d).objects[1]).volume,24000-34*24*17,.01);
  assert.throws(()=>buildOperation({...r,thickness:20},[box]),/thickness/);
});
test('revolved rectangle matches annular cylinder volume and radius edits propagate',()=>{
  const sketch=makeObject('rectangle',{w:10,d:20}),recipe={kind:'revolve',baseId:sketch.id,angle:360,radiusOffset:10},body=buildOperation(recipe,[sketch]);near(properties(body).volume,Math.PI*(15**2-5**2)*20,6);
  const d=validateDocument(documentFor('Revolve',[sketch,body]));d.objects[0].d=30;near(properties(rebuildDocument(d).objects[1]).volume,Math.PI*200*30,9);
  assert.throws(()=>buildOperation({...recipe,radiusOffset:0},[sketch]),/crosses/);
});
test('taper matches frustum volume and twisted polygon produces a closed solid',()=>{
  const sketch=makeObject('rectangle',{w:10,d:20}),r={kind:'taper',baseId:sketch.id,height:30,topScale:.5,twist:0};near(properties(buildOperation(r,[sketch])).volume,30/3*(200+50+100));
  const polygon=makeObject('polygon',{points:[[0,0],[20,0],[10,15]]});assert.ok(properties(buildOperation({...r,baseId:polygon.id,twist:90},[polygon])).volume>0);
  assert.throws(()=>buildOperation({...r,topScale:0},[sketch]),/topScale/);
});
