import {validatePolygon} from './engineering.js';
import {validateConstraints} from './constraints.js';
import {validateFeature} from './features.js';
import {validateJoints} from './assembly.js';
export const TYPES = ['box', 'cylinder', 'rectangle', 'circle', 'line', 'polygon', 'extrusion', 'mesh', 'dimension'];
export const isSolid = o => ['box', 'cylinder', 'extrusion', 'mesh'].includes(o.type);
export const makeObject = (type, props = {}) => ({id:crypto.randomUUID(), type, name:type[0].toUpperCase()+type.slice(1), x:0,y:0,z:0,w:80,d:60,h:40,r:25,rotation:0,rx:0,ry:0,color:'#7cb6bf',visible:true, ...props});
export function validateDocument(input) {
  if (!input || input.format !== 'draftwork' || ![1,2].includes(input.version) || !Array.isArray(input.objects) || input.objects.length > 2000) throw Error('This is not a supported Draftwork drawing.');
  if(input.units && input.units!=='mm')throw Error('Drawing storage units must be millimeters.');
  const ids = new Set();let totalIndices=0;
  const objects = input.objects.map(o => {
    if (!TYPES.includes(o.type) || typeof o.id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(o.id) || ids.has(o.id)) throw Error('Invalid or duplicate object.');
    ids.add(o.id);
    for (const k of ['x','y','z','w','d','h','r','rotation']) if (!Number.isFinite(o[k]) || Math.abs(o[k]) > 1000000) throw Error('Invalid object measurements.');
    if (o.h <= 0 || o.r <= 0 || (!['line','dimension'].includes(o.type) && (o.w <= 0 || o.d <= 0))) throw Error('Object sizes must be positive.');
    if (!/^#[\da-f]{6}$/i.test(o.color)) throw Error('Invalid object color.');
    const extra={rx:o.rx??0,ry:o.ry??0};
    if(o.feature)extra.feature=validateFeature(o.feature);
    if(o.type==='dimension'){
      if(o.offset!==undefined){if(!Number.isFinite(o.offset)||Math.abs(o.offset)>1e6)throw Error('Invalid dimension offset.');extra.offset=o.offset;}
      if(o.tolerance!==undefined){if(!Number.isFinite(o.tolerance)||o.tolerance<0||o.tolerance>1e6)throw Error('Invalid dimension tolerance.');extra.tolerance=o.tolerance;}
    }
    if(!Number.isFinite(extra.rx)||!Number.isFinite(extra.ry)||Math.abs(extra.rx)>1e6||Math.abs(extra.ry)>1e6)throw Error('Invalid rotation.');
    if(['polygon','extrusion'].includes(o.type))extra.points=validatePolygon(o.points);
    if(o.type==='mesh'){const m=o.mesh;if(!m||!Array.isArray(m.vertices)||!Array.isArray(m.indices)||!Array.isArray(m.size)||m.size.length!==3||m.size.some(n=>!Number.isFinite(n)||n<=0)||m.vertices.length<12||m.vertices.length%3||m.indices.length<12||m.indices.length%3||m.vertices.some(n=>!Number.isFinite(n)||Math.abs(n)>1e6)||m.indices.some(n=>!Number.isInteger(n)||n<0||n>=m.vertices.length/3))throw Error('Invalid solid mesh.');totalIndices+=m.indices.length;if(totalIndices>600000)throw Error('Drawing exceeds the 200,000 triangle limit.');extra.mesh=structuredClone(m);}
    return {...makeObject(o.type),...extra, ...Object.fromEntries(['id','type','x','y','z','w','d','h','r','rotation','color'].map(k=>[k,o[k]])),name:String(o.name || o.type).slice(0,100),visible:o.visible !== false};
  });
  const result={format:'draftwork',version:2,units:'mm',name:String(input.name || 'Untitled drawing').slice(0,100),objects};
  if(input.constraints)result.constraints=validateConstraints(input.constraints,objects);
  if(input.joints)result.joints=validateJoints(input.joints,objects);
  if(input.sheet){const s=input.sheet;result.sheet={};for(const k of ['author','number','revision','material','notes'])result.sheet[k]=String(s[k]||'').slice(0,k==='notes'?160:60);if(s.sectionZ!==undefined){if(!Number.isFinite(s.sectionZ)||Math.abs(s.sectionZ)>1e6)throw Error('Invalid section height.');result.sheet.sectionZ=s.sectionZ;}result.sheet.section=!!s.section;result.sheet.centerMarks=s.centerMarks!==false;}
  if(result.sheet)result.sheet.hiddenEdges=!!input.sheet.hiddenEdges;
  return result;
}
export const documentFor = (name, objects) => ({format:'draftwork',version:2,units:'mm',name,objects});
export class History {
  constructor(initial) { this.states=[structuredClone(initial)]; this.index=0; }
  push(value) { if(JSON.stringify(value)===JSON.stringify(this.states[this.index]))return; this.states.splice(this.index+1); this.states.push(structuredClone(value)); if(this.states.length>100)this.states.shift(); this.index=this.states.length-1; }
  undo() { if(this.index>0)this.index--; return structuredClone(this.states[this.index]); }
  redo() { if(this.index<this.states.length-1)this.index++; return structuredClone(this.states[this.index]); }
}
export function footprint(o) {
  const a=o.rotation*Math.PI/180, transform=([x,y])=>[o.x+x*Math.cos(a)-y*Math.sin(a),o.y+x*Math.sin(a)+y*Math.cos(a)];
  if(['polygon','extrusion'].includes(o.type))return o.points.map(transform);
  if(['line','dimension'].includes(o.type))return [[o.x,o.y],transform([o.w,o.d])];
  if(['circle','cylinder'].includes(o.type))return Array.from({length:64},(_,i)=>transform([o.r*Math.cos(i*Math.PI/32),o.r*Math.sin(i*Math.PI/32)]));
  return [[-o.w/2,-o.d/2],[o.w/2,-o.d/2],[o.w/2,o.d/2],[-o.w/2,o.d/2]].map(transform);
}
export function exportSVG(objects) {
  const shapes=objects.filter(o=>o.visible), points=shapes.flatMap(footprint);
  const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
  const minX=points.length?Math.min(...xs)-10:0,minY=points.length?Math.min(...ys)-10:0;
  const w=points.length?Math.max(...xs)-minX+10:100,h=points.length?Math.max(...ys)-minY+10:100;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}mm" height="${h}mm" viewBox="${minX} ${-minY-h} ${w} ${h}"><g fill="none" stroke="#152c39" stroke-width="0.5">${shapes.map(o=>`<${o.type==='line'?'polyline':'polygon'} points="${footprint(o).map(([x,y])=>`${x},${-y}`).join(' ')}"/>`).join('')}</g></svg>`;
}
export function exportDXF(objects) {
  let s='0\nSECTION\n2\nHEADER\n9\n$INSUNITS\n70\n4\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n';
  for(const o of objects.filter(o=>o.visible)) {
    if(['circle','cylinder'].includes(o.type)) {s+=`0\nCIRCLE\n8\n0\n10\n${o.x}\n20\n${o.y}\n30\n0\n40\n${o.r}\n`;continue;}
    const p=footprint(o),n=o.type==='line'?1:p.length;
    for(let i=0;i<n;i++){const a=p[i],b=p[(i+1)%p.length];s+=`0\nLINE\n8\n0\n10\n${a[0]}\n20\n${a[1]}\n30\n0\n11\n${b[0]}\n21\n${b[1]}\n31\n0\n`;}
  }
  return s+'0\nENDSEC\n0\nEOF\n';
}
export function demo() {
  return documentFor('Courtyard study',[
    makeObject('box',{name:'Foundation',w:320,d:240,h:8,z:-8,color:'#bac6c9'}),
    makeObject('box',{name:'West wall',x:-146,w:12,d:212,h:92,color:'#e4ded0'}),
    makeObject('box',{name:'North wall',y:100,w:280,d:12,h:92,color:'#e4ded0'}),
    makeObject('box',{name:'Entry wall',x:-95,y:-100,w:90,d:12,h:60,color:'#e4ded0'}),
    makeObject('box',{name:'Gallery plinth',x:30,y:30,w:90,d:70,h:28,color:'#488b99'}),
    makeObject('cylinder',{name:'Column 01',x:130,y:80,r:9,h:92,color:'#d7bfa2'}),
    makeObject('cylinder',{name:'Column 02',x:130,y:-80,r:9,h:92,color:'#d7bfa2'}),
    makeObject('box',{name:'Canopy beam',x:130,w:22,d:180,h:12,z:92,color:'#9c7662'}),
    makeObject('rectangle',{name:'Courtyard sketch',x:15,y:-58,w:130,d:45,color:'#dd8254'})
  ]);
}
