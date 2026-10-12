import './mobile.css';

export function installMobile({cancel,finish,zoom}) {
  const app=document.querySelector('#app');
  const tools=document.createElement('section');tools.className='mobile-tools';tools.id='mobile-tools';
  const bars=[...document.querySelectorAll('.engineering-bar,.student-bar')];
  bars[0].before(tools);bars.forEach(bar=>tools.append(bar));
  const panels={objects:document.querySelector('.left-panel'),properties:document.querySelector('.right-panel'),tools};
  Object.entries(panels).forEach(([name,panel])=>{panel.id ||= 'mobile-'+name;const close=document.createElement('button');close.className='mobile-close';close.textContent='Close ×';close.setAttribute('aria-label','Close '+name);close.onclick=()=>show('');panel.prepend(close);});
  const shade=document.createElement('button');shade.className='mobile-shade';shade.setAttribute('aria-label','Close panel');shade.onclick=()=>show('');app.append(shade);
  const nav=document.createElement('nav');nav.className='mobile-nav';nav.setAttribute('aria-label','Workspace panels');
  nav.innerHTML='<button data-panel="">Canvas</button><button data-panel="objects">Objects</button><button data-panel="properties">Properties</button><button data-panel="tools">Tools</button>';
  app.append(nav);
  function show(name){app.dataset.mobilePanel=name;nav.querySelectorAll('button').forEach(b=>{b.classList.toggle('active',b.dataset.panel===name);b.setAttribute('aria-expanded',String(!!name&&b.dataset.panel===name));});}
  nav.querySelectorAll('button').forEach(b=>{if(b.dataset.panel)b.setAttribute('aria-controls',panels[b.dataset.panel].id);b.onclick=()=>show(app.dataset.mobilePanel===b.dataset.panel?'':b.dataset.panel);});
  tools.addEventListener('click',e=>{if(e.target.closest('button:not(.mobile-close)'))show('');});
  const actions=document.createElement('div');actions.className='mobile-canvas-actions';
  actions.innerHTML='<button data-mobile-action="cancel">Cancel</button><button data-mobile-action="finish">Finish polygon</button><button data-mobile-action="out" aria-label="Zoom out">−</button><button data-mobile-action="in" aria-label="Zoom in">+</button>';
  document.querySelector('#viewport').append(actions);
  actions.addEventListener('click',e=>{const key=e.target.closest('button')?.dataset.mobileAction;if(key==='cancel')cancel();if(key==='finish')finish();if(key==='in')zoom(1.25);if(key==='out')zoom(.8);});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')show('');});
  const media=matchMedia('(max-width:760px), (max-width:1000px) and (max-height:500px)');
  media.addEventListener('change',()=>show(''));show('');
}
