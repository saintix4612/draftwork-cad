import {solidToolNames} from './solid-tools.js';
import {solidToolFields,readSolidTool} from './solid-tools-ui.js';
import {featureInputs} from './model-history.js';
import {measurement,UNITS} from './engineering.js';

const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function installHistoryTools(api) {
  const button=document.createElement('button');button.id='model-history';button.textContent='Model history';
  document.querySelector('.engineering-bar>div').append(button);
  const dialog=document.createElement('dialog');dialog.id='history-dialog';document.body.append(dialog);
  function show() {
    const doc=api.document(),selected=doc.objects.find(o=>o.id===api.selected());
    const label=o=>o.recipe?(o.recipe.kind==='hole'?'Through-hole':solidToolNames[o.recipe.kind]||{add:'Union',subtract:'Cut',intersect:'Intersection'}[o.recipe.operation]):o.sketchId?'Extrusion':o.feature?'Generated feature':o.type;
    const sources=selected?featureInputs(selected).map(id=>doc.objects.find(o=>o.id===id)):[];
    const r=selected?.recipe;
    const field=(name,key,value)=>`<label class="operation-field">${name} (${api.unit()})<input name="${key}" value="${value/UNITS[api.unit()]}" required></label>`;
    dialog.innerHTML=`<form method="dialog"><button class="close" aria-label="Close model history">×</button></form><span class="eyebrow">STEP WORK / MODEL HISTORY</span><h2>${esc(selected?.name||'Model history')}</h2><p>Sketches feed extrusions; holes and boolean results follow their inputs. Select a source to edit it in Properties.</p>${sources.length?`<h3>Inputs</h3>${sources.map(o=>`<button data-source="${o.id}">${esc(o.name)}</button>`).join('')}`:''}${r?`<form id="recipe-form"><h3>Edit ${label(selected).toLowerCase()}</h3>${solidToolNames[r.kind]?solidToolFields(r,api.unit()):r.kind==='hole'?'<p class="fine">Through-hole along world Z. X/Y stay fixed in world coordinates.</p>'+field('Diameter','diameter',r.diameter)+field('World X','x',r.x)+field('World Y','y',r.y):`<label class="operation-field">Operation<select name="operation">${[['subtract','Subtract / cut'],['add','Union / join'],['intersect','Intersection']].map(([v,t])=>`<option value="${v}" ${r.operation===v?'selected':''}>${t}</option>`).join('')}</select></label>`}<button class="action-primary">Rebuild result</button><p id="history-error" role="alert"></p></form>`:''}${sources.length?'<button id="detach-feature">Detach selected result</button>':''}<h3>Features and inputs</h3><div class="history-list">${doc.objects.map(o=>`<div><button data-feature="${o.id}">${esc(o.name)}</button><small>${esc(label(o))}${featureInputs(o).length?' ← '+featureInputs(o).map(id=>esc(doc.objects.find(b=>b.id===id).name)).join(' + '):''}</small></div>`).join('')}</div>`;
    dialog.querySelectorAll('[data-source]').forEach(b=>b.onclick=()=>{dialog.close();api.select(b.dataset.source);});
    dialog.querySelectorAll('[data-feature]').forEach(b=>b.onclick=()=>{api.select(b.dataset.feature);show();});
    const form=dialog.querySelector('#recipe-form');
    if(form)form.onsubmit=e=>{e.preventDefault();try{let recipe={...r};if(solidToolNames[r.kind])recipe=readSolidTool(form,r,api.unit());else if(r.kind==='hole')for(const key of ['diameter','x','y'])recipe[key]=measurement(form.elements[key].value,api.unit());else recipe.operation=form.elements.operation.value;api.update(d=>{d.objects.find(o=>o.id===selected.id).recipe=recipe;});show();api.toast('Model rebuilt.');}catch(error){dialog.querySelector('#history-error').textContent=error.message;}};
    const detach=dialog.querySelector('#detach-feature');
    if(detach)detach.onclick=()=>{api.update(d=>{const o=d.objects.find(b=>b.id===selected.id);delete o.recipe;delete o.sketchId;});show();api.toast('Detached. Current geometry is preserved.');};
    if(!dialog.open)dialog.showModal();
  }
  button.onclick=show;
  return {show};
}
