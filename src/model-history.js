import {solidToolNames,validateSolidTool,buildSolidTool,profileTypes} from './solid-tools.js';
import {booleanOperation,solid,properties} from './kernel.js';
import {makeObject,validateDocument,isSolid} from './model.js';
import {solveSketch} from './constraints.js';
import {applyJoints} from './assembly.js';

export const featureInputs = o => o.sketchId ? [o.sketchId] : o.recipe ?
  [o.recipe.baseId,...(o.recipe.kind==='boolean'?[o.recipe.toolId]:[])] : [];

export function validateRecipe(recipe) {
  if(!recipe || !['hole','boolean',...Object.keys(solidToolNames)].includes(recipe.kind))throw Error('Invalid modeling operation.');
  const id=value=>{if(typeof value!=='string'||!/^[\w-]{1,100}$/.test(value))throw Error('Invalid operation input.');return value;};
  const clean={kind:recipe.kind,baseId:id(recipe.baseId)};
  if(solidToolNames[recipe.kind])return validateSolidTool({...recipe,baseId:clean.baseId});
  if(recipe.kind==='boolean') {
    if(!['add','subtract','intersect'].includes(recipe.operation))throw Error('Invalid boolean operation.');
    return {...clean,toolId:id(recipe.toolId),operation:recipe.operation};
  }
  if(!['diameter','x','y'].every(k=>Number.isFinite(recipe[k])&&Math.abs(recipe[k])<=1e6)||recipe.diameter<=0)throw Error('Enter a positive hole diameter and finite world coordinates.');
  return {...clean,diameter:recipe.diameter,x:recipe.x,y:recipe.y};
}

// Include joint parents so an operation using a moving body evaluates its saved pose first.
export function featureOrder(objects,joints=[]) {
  const byId=new Map(objects.map(o=>[o.id,o])),moving=new Map(joints.map(j=>[j.child,j]));
  const active=new Set(),done=new Set(),ordered=[];
  if(objects.filter(o=>o.recipe).length>80)throw Error('Use at most 80 linked solid operations.');
  function visit(o,depth=0) {
    if(active.has(o.id))throw Error('Model history and assembly links cannot form a cycle.');
    if(done.has(o.id))return;
    if(depth>80)throw Error('Model history exceeds 80 dependency levels.');
    if(o.recipe && (o.type!=='mesh'||o.sketchId||o.feature))throw Error('Only a result mesh can store a modeling operation.');
    if(moving.has(o.id)&&(o.recipe||o.sketchId))throw Error('Detach the linked feature before using it as a moving assembly body.');
    active.add(o.id);
    for(const id of featureInputs(o)) {
      const input=byId.get(id);
      if(!input || (o.recipe&&!(['revolve','taper'].includes(o.recipe.kind)?profileTypes.includes(input.type):isSolid(input))))throw Error('A linked operation is missing a solid input. Detach or delete its result first.');
      if(o.recipe?.toolId===o.recipe?.baseId && o.recipe?.kind==='boolean')throw Error('Choose two distinct solid inputs.');
      visit(input,depth+1);
    }
    const joint=moving.get(o.id);
    if(joint){const parent=byId.get(joint.parent);if(!parent)throw Error('Missing assembly parent.');visit(parent,depth+1);}
    active.delete(o.id);done.add(o.id);ordered.push(o.id);
  }
  objects.forEach(o=>visit(o));return ordered;
}

export function buildOperation(recipe,objects) {
  recipe=validateRecipe(recipe);
  const base=objects.find(o=>o.id===recipe.baseId);
  if(!base)throw Error('Missing base body.');
  if(solidToolNames[recipe.kind])return buildSolidTool(recipe,base);
  if(recipe.kind==='boolean') {
    const tool=objects.find(o=>o.id===recipe.toolId);
    if(!tool)throw Error('Missing tool body.');
    return {...booleanOperation(base,tool,recipe.operation),recipe};
  }
  const m=solid(base);let bounds;
  try{bounds=m.boundingBox();}finally{m.delete();}
  const cutter=makeObject('cylinder',{r:recipe.diameter/2,x:recipe.x,y:recipe.y,z:bounds.min[2]-1,h:bounds.max[2]-bounds.min[2]+2});
  const result=booleanOperation(base,cutter,'subtract');
  if(Math.abs(properties(base).volume-properties(result).volume)<1e-6)throw Error('The hole misses its base body. Adjust its world X/Y or undo the source edit.');
  return {...result,name:base.name+' hole',recipe};
}

export function rebuildDocument(input,drive=null) {
  let next=validateDocument(solveSketch(validateDocument(input),drive));
  const order=featureOrder(next.objects,next.joints||[]);
  for(const id of order) {
    const o=next.objects.find(b=>b.id===id),joint=next.joints?.find(j=>j.child===id);
    if(joint)next.objects=applyJoints({...next,joints:[joint]}).objects;
    if(o.recipe) {
      let result;
      try{result=buildOperation(o.recipe,next.objects);}catch(e){throw Error(o.name+': '+e.message);}
      const rebuilt={...result,id:o.id,name:o.name,color:o.color,visible:o.visible};
      next.objects[next.objects.findIndex(b=>b.id===id)]=rebuilt;
    }
  }
  return validateDocument(next);
}
