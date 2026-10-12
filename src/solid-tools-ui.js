import {solidToolNames,profileTypes} from './solid-tools.js';
import {buildOperation} from './model-history.js';
import {solid} from './kernel.js';
import {measurement,UNITS} from './engineering.js';

const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function solidToolFields(r,unit){
  const input=(label,name,value,kind='length')=>`<label class="operation-field">${label}${kind==='length'?' ('+unit+')':kind==='angle'?' (°)':''}<input name="${name}" value="${kind==='length'?value/UNITS[unit]:value}" required></label>`;
  if(r.kind==='plane')return '<p class="fine">World plane: normal · position = offset. Keep the side toward the normal, or reverse it.</p>'+r.normal.map((n,i)=>input('Normal '+['X','Y','Z'][i],'n'+i,n,'scalar')).join('')+input('Plane offset','offset',r.offset)+`<label class="student-check"><input name="reverse" type="checkbox" ${r.reverse?'checked':''}> Keep opposite side</label>`;
  if(r.kind==='shell')return '<p class="fine">Open at local +Z; constant side wall and bottom thickness. Supports straight boxes, cylinders and sketch extrusions.</p>'+input('Wall / bottom thickness','thickness',r.thickness);
  if(r.kind==='revolve')return '<p class="fine">Sketch local X becomes radius and Y becomes height. The radius offset moves the profile away from the axis. The result axis is local Z at the sketch origin.</p>'+input('Revolve angle','angle',r.angle,'angle')+input('Radius offset','radiusOffset',r.radiusOffset);
  return '<p class="fine">Extrude along the sketch local Z axis. Scale and twist vary from bottom to top.</p>'+input('Height','height',r.height)+input('Top / bottom scale','topScale',r.topScale,'scalar')+input('Twist','twist',r.twist,'angle');
}
export function readSolidTool(form,r,unit){
  const result={...r},num=(key,angle=false)=>measurement(form.elements[key].value,unit,angle);
  if(r.kind==='plane'){result.normal=[0,1,2].map(i=>num('n'+i,true));result.offset=num('offset');result.reverse=form.elements.reverse.checked;}
  if(r.kind==='shell')result.thickness=num('thickness');
  if(r.kind==='revolve'){result.radiusOffset=num('radiusOffset');result.angle=num('angle',true);}
  if(r.kind==='taper'){result.height=num('height');result.topScale=num('topScale',true);result.twist=num('twist',true);}
  return result;
}
export function installSolidTools(api){
  const button=document.createElement('button');button.id='solid-tools';button.textContent='3D tools';document.querySelector('.engineering-bar>div').append(button);
  const dialog=document.createElement('dialog');dialog.id='solid-tools-dialog';document.body.append(dialog);
  function open(kind){
    const selected=api.document().objects.find(o=>o.id===api.selected());if(!selected){api.toast('Select a solid or a closed sketch first.');return;}
    const editing=!!solidToolNames[selected.recipe?.kind];kind??=editing?selected.recipe.kind:profileTypes.includes(selected.type)?'taper':'plane';
    const base=editing?api.document().objects.find(o=>o.id===selected.recipe.baseId):selected;
    let bounds={min:[base.x-base.w/2,base.y-base.d/2,base.z],max:[base.x+base.w/2,base.y+base.d/2,base.z+base.h]};
    if(!profileTypes.includes(base.type)){const m=solid(base);try{bounds=m.boundingBox();}finally{m.delete();}}
    const defaults={plane:{normal:[0,0,1],offset:(bounds.min[2]+bounds.max[2])/2,reverse:true},shell:{thickness:Math.min(base.w,base.d,base.h)/10},revolve:{angle:360,radiusOffset:base.type==='circle'?base.r+5:base.type==='polygon'?Math.max(0,-Math.min(...base.points.map(p=>p[0])))+5:base.w/2+5},taper:{height:40,topScale:.6,twist:0}};
    const recipe=editing&&selected.recipe.kind===kind?selected.recipe:{kind,baseId:base.id,...defaults[kind]};
    dialog.innerHTML=`<form method="dialog"><button class="close" aria-label="Close 3D tools">×</button></form><span class="eyebrow">STEP WORK / 3D TOOLS</span><h2>${editing?'Edit linked feature':'Build from '+esc(base.name)}</h2><label class="operation-field">Tool<select id="solid-tool-kind">${Object.entries(solidToolNames).map(([k,n])=>`<option value="${k}" ${kind===k?'selected':''}>${n}</option>`).join('')}</select></label><form id="solid-tool-form">${solidToolFields(recipe,api.unit())}<div class="dialog-actions"><button class="action-primary">${editing?'Update feature':'Create linked result'}</button>${kind==='plane'?'<button type="button" id="pick-cut-face">Pick surface plane</button>':''}</div><p id="solid-tool-error" role="alert"></p></form><p class="fine">The source is preserved and linked. Changes rebuild the result. Plane cuts support mesh facets; hollowing is limited to straight extrusions.</p>`;
    dialog.querySelector('#solid-tool-kind').onchange=e=>open(e.target.value);
    const form=dialog.querySelector('#solid-tool-form');form.onsubmit=e=>{e.preventDefault();try{const r=readSolidTool(form,recipe,api.unit()),result=buildOperation(r,api.document().objects);if(editing){Object.assign(result,{id:selected.id,name:selected.name,color:selected.color,visible:selected.visible});api.update(d=>{d.objects[d.objects.findIndex(o=>o.id===selected.id)]=result;},result.id);}else api.install(result,[base.id]);dialog.close();api.view('3d');api.fit();}catch(error){dialog.querySelector('#solid-tool-error').textContent=error.message;}};
    const pick=dialog.querySelector('#pick-cut-face');if(pick)pick.onclick=()=>{dialog.close();api.pickFace(base.id,face=>{dialog.showModal();face.normal.forEach((n,i)=>form.elements['n'+i].value=Number(n.toFixed(8)));form.elements.offset.value=Number(((face.offset-Math.min(...bounds.max.map((v,i)=>v-bounds.min[i]))*.25)/UNITS[api.unit()]).toFixed(6));form.elements.reverse.checked=true;api.toast('Plane placed one-quarter of the part thickness inward. Adjust its offset before applying.');});};
    if(!dialog.open)dialog.showModal();
  }
  button.onclick=()=>{try{open();}catch(e){api.toast(e.message);}};return {open};
}
