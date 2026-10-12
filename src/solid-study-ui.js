import StudyWorker from './solid-study.worker.js?worker&inline';
import {meshSolid} from './solid-study-mesh.js';
import {solid} from './kernel.js';
import {isSolid} from './model.js';
export const STUDY_ASSUMPTIONS='Small-strain, static, homogeneous isotropic linear elasticity. Fully integrated HEX8 cells approximate the solid with a stair-step boundary. Entire chosen bounding side is fixed; total force is distributed by surface area on the loaded bounding side. No contact, plasticity, buckling, fatigue or dynamics. Peaks near clamps and corners are mesh-dependent. Refine and compare before interpreting results.';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>Number(n.toPrecision(5)).toLocaleString('en-US',{maximumFractionDigits:7});
const sides=['X minimum','X maximum','Y minimum','Y maximum','Z minimum','Z maximum'];
export function installSolidStudy(api){
  const button=document.createElement('button');button.id='solid-study';button.textContent='3D simulation';document.querySelector('.engineering-bar>div').append(button);
  const dialog=document.createElement('dialog');dialog.id='solid-study-dialog';dialog.className='study-dock';document.body.append(dialog);
  let worker=null,source=null,mesh=null,result=null,inputs=null,generation=0;
  function cancel(){generation++;worker?.terminate();worker=null;const b=dialog.querySelector('#solve-solid');if(b)b.disabled=false;}
  function invalidate(){cancel();mesh=null;result=null;api.clear();if(dialog.open){dialog.querySelector('#solid-study-result').innerHTML='';dialog.querySelector('#solid-study-status').textContent='Drawing changed. Close and reopen this study to select the current geometry.';source=null;}}
  function display(){if(mesh)api.show(mesh,result,{...inputs,scale:Number(dialog.querySelector('#deformation-scale').value),field:dialog.querySelector('#study-field').value,mesh:dialog.querySelector('#study-mesh').checked});}
  function read(){const form=dialog.querySelector('#solid-study-form'),n=k=>{const v=Number(form.elements[k].value);if(!form.elements[k].value.trim()||!Number.isFinite(v))throw Error('Enter finite values for '+k+'.');return v;};return {resolution:n('resolution'),young:n('young'),poisson:n('poisson'),yieldStrength:n('yieldStrength'),support:n('support'),loadFace:n('loadFace'),force:['fx','fy','fz'].map(n)};}
  function prepare(){if(!source)throw Error('Close and reopen the study after changing the model.');cancel();inputs=read();mesh=meshSolid(source,inputs.resolution);result=null;dialog.querySelector('#deformation-scale').value='0';dialog.querySelector('#solid-study-result').innerHTML=`<p>${mesh.cells.length} cells · ${mesh.nodes.length} nodes<br>Voxel volume difference: ${fmt(100*mesh.volumeError)}%<br>Cell size: ${mesh.spacing.map(fmt).join(' × ')} mm</p><p class="fine">Volume agreement does not prove that small holes or thin walls are resolved. Inspect the mesh and compare a finer study.</p>`;display();return generation;}
  function open(){
    const selected=api.document().objects.find(o=>o.id===api.selected());if(!selected||!isSolid(selected)){api.toast('Select a solid to study.');return;}
    cancel();api.clear();source=structuredClone(selected);mesh=null;result=null;
    const m=solid(source);let bounds;try{bounds=m.boundingBox();}finally{m.delete();}
    const size=bounds.max.map((v,i)=>v-bounds.min[i]),longest=Math.max(...size),axis=size.indexOf(longest),resolution=Math.min(40,Math.max(8,Math.floor(Math.cbrt(900/size.map(v=>v/longest).reduce((a,b)=>a*b,1)))));
    const field=(label,name,value)=>`<label class="student-field">${label}<input name="${name}" value="${value}" required></label>`;
    const select=(label,name,value)=>`<label class="student-field">${label}<select name="${name}">${sides.map((s,i)=>`<option value="${i}" ${value===i?'selected':''}>${s}</option>`).join('')}</select></label>`;
    dialog.innerHTML=`<form method="dialog"><button class="close" aria-label="Close 3D simulation">×</button></form><span class="eyebrow">STEP WORK / 3D STATIC STUDY</span><h2>${esc(source.name)}</h2><p class="fine">${STUDY_ASSUMPTIONS}</p><form id="solid-study-form"><div class="student-grid">${field('Young’s modulus (GPa)','young',200)}${field('Poisson ratio (0–0.45)','poisson',.3)}${field('Yield strength (MPa)','yieldStrength',250)}${field('Cells along longest side (8–64)','resolution',resolution)}${select('Fixed side — all translations','support',2*axis)}${select('Loaded side','loadFace',2*axis+1)}${field('Total force X (N)','fx',0)}${field('Total force Y (N)','fy',0)}${field('Total force Z (N)','fz',-100)}</div><div class="dialog-actions"><button id="mesh-solid" type="button">Preview mesh</button><button id="solve-solid" class="action-primary">Solve</button><button id="cancel-study" type="button">Cancel solve</button></div></form><p id="solid-study-status" role="status"></p><div id="solid-study-result"></div><label class="student-field">Display<select id="study-field"><option value="displacement">Displacement magnitude (mm)</option><option value="stress">Element von Mises stress (MPa)</option></select></label><label class="student-field">Deformation multiplier<input id="deformation-scale" type="number" min="0" max="100000" value="0"></label><label class="student-check"><input id="study-mesh" type="checkbox" checked> Show mesh edges</label><div class="study-legend"><span>Low</span><i></i><span>High</span></div><p class="fine">Green points: fixed nodes. Orange arrows: force direction. Deformation is a visual exaggeration, not a change to the part.</p>`;
    const status=()=>dialog.querySelector('#solid-study-status');
    dialog.querySelector('#mesh-solid').onclick=()=>{try{prepare();status().textContent='Mesh preview ready.';}catch(e){status().textContent=e.message;}};
    dialog.querySelector('#cancel-study').onclick=()=>{cancel();status().textContent='Solve cancelled.';};
    dialog.querySelector('#solid-study-form').oninput=()=>{cancel();mesh=null;result=null;api.clear();dialog.querySelector('#solid-study-result').innerHTML='';status().textContent='Inputs changed. Preview or solve again.';};
    dialog.querySelector('#solid-study-form').onsubmit=e=>{e.preventDefault();try{
      const current=prepare();status().textContent='Solving…';dialog.querySelector('#solve-solid').disabled=true;worker=new StudyWorker();
      worker.onmessage=event=>{if(current!==generation)return;const data=event.data;
        if(data.progress){status().textContent=`Solving: ${data.progress.iterations} iterations · relative residual ${data.progress.residual.toExponential(2)}`;return;}
        worker.terminate();worker=null;dialog.querySelector('#solve-solid').disabled=false;
        if(data.error){status().textContent=data.error;return;}
        result=data.result;status().textContent=`Converged in ${result.iterations} iterations · residual ${result.residual.toExponential(2)}`;
        dialog.querySelector('#deformation-scale').value=fmt(Math.min(100000,longest*.05/(result.maxDisplacement||1))).replaceAll(',','');
        dialog.querySelector('#solid-study-result').insertAdjacentHTML('beforeend',`<div class="student-stats"><div class="student-stat"><small>Max displacement</small><strong>${fmt(result.maxDisplacement)} mm</strong></div><div class="student-stat"><small>Peak von Mises</small><strong>${fmt(result.peakStress)} MPa</strong></div></div><p>Yield ratio: ${result.safetyFactor===null?'—':fmt(result.safetyFactor)}<br>Support reaction (N): ${result.reaction.map(fmt).join(', ')}</p>${result.largeDisplacement?'<p class="student-callout">Displacement exceeds 2% of the smallest part dimension. Small-displacement assumptions may be unsuitable.</p>':''}<p class="fine">Stress uses the highest Gauss-point value per element. Yield ratio covers this elastic approximation only.</p><button id="save-solid-study">Save study report</button>`);
        dialog.querySelector('#save-solid-study').onclick=()=>api.download(JSON.stringify({application:'Step Work',study:'3D linear static HEX8',assumptions:STUDY_ASSUMPTIONS,source,inputs,mesh,result},null,2),'solid-study.json','application/json');display();
      };
      worker.onerror=()=>{cancel();status().textContent='Study worker failed. Reduce mesh size and retry.';};worker.postMessage({mesh,inputs});
    }catch(error){status().textContent=error.message;}};
    for(const id of ['study-field','deformation-scale','study-mesh'])dialog.querySelector('#'+id).oninput=()=>{const scale=Number(dialog.querySelector('#deformation-scale').value);if(!Number.isFinite(scale)||scale<0||scale>100000){status().textContent='Use a deformation multiplier from 0 to 100000.';return;}display();};
    dialog.onclose=()=>{cancel();api.clear();};if(!dialog.open)dialog.show();
  }
  button.onclick=()=>{try{open();}catch(e){api.toast(e.message);}};
  return {invalidate};
}
