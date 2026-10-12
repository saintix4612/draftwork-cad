import {footprint,isSolid} from './model.js';
import {projectSolid,sectionSolid,drawingEdges,kernelAPI} from './kernel.js';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const round=n=>Number(n.toFixed(3));
export function contours(objects,view='top'){
  return objects.filter(o=>o.visible&&o.type!=='dimension').flatMap(o=>isSolid(o)?projectSolid(o,view).map(points=>({points,closed:true})):view==='top'?[{points:footprint(o),closed:o.type!=='line'}]:[]);
}
function bounds(paths){const b={minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity};for(const {points} of paths)for(const [x,y] of points){b.minX=Math.min(b.minX,x);b.minY=Math.min(b.minY,y);b.maxX=Math.max(b.maxX,x);b.maxY=Math.max(b.maxY,y);}if(!Number.isFinite(b.minX))return {minX:0,minY:0,maxX:100,maxY:100};return b;}
const path=p=>`<${p.closed?'polygon':'polyline'} points="${p.points.map(([x,y])=>`${x},${-y}`).join(' ')}"/>`;
function dimensionPoints(o){const [a,b]=footprint(o),dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy),offset=o.offset??12;if(len<1e-8)return null;const ox=-dy/len*offset,oy=dx/len*offset;return {a,b,A:[a[0]+ox,a[1]+oy],B:[b[0]+ox,b[1]+oy],len};}
function annotationBounds(objects){return objects.filter(o=>o.visible&&o.type==='dimension').flatMap(o=>{const p=dimensionPoints(o);return p?[{points:[p.a,p.b,p.A,p.B],closed:false}]:[];});}
function dimensionSVG(objects,k=1){return objects.filter(o=>o.visible&&o.type==='dimension').map(o=>{const p=dimensionPoints(o);if(!p)return '';const {a,b,A,B,len}=p,label=round(len)+(o.tolerance?' ±'+round(o.tolerance):'')+' mm';return `<g fill="none" stroke="#567683" stroke-width="${.2/k}"><path d="M${a[0]},${-a[1]}L${A[0]},${-A[1]} M${b[0]},${-b[1]}L${B[0]},${-B[1]} M${A[0]},${-A[1]}L${B[0]},${-B[1]}"/><circle cx="${A[0]}" cy="${-A[1]}" r="${.45/k}" fill="#567683"/><circle cx="${B[0]}" cy="${-B[1]}" r="${.45/k}" fill="#567683"/></g><text x="${(A[0]+B[0])/2}" y="${-(A[1]+B[1])/2-2/k}" font-family="Arial,sans-serif" font-size="${2.6/k}" text-anchor="middle" fill="#385d6b">${label}</text>`;}).join('');}
function centerSVG(objects,k){return objects.filter(o=>o.visible&&['circle','cylinder'].includes(o.type)&&Math.abs(o.rx||0)<1e-6&&Math.abs(o.ry||0)<1e-6).map(o=>{const r=o.r+3/k;return `<path d="M${o.x-r},${-o.y}h${2*r} M${o.x},${-o.y-r}v${2*r}" stroke="#83939b" stroke-width="${.15/k}" stroke-dasharray="${4/k} ${1/k} ${.5/k} ${1/k}" fill="none"/>`;}).join('');}
export function projectionSVG(objects){const paths=contours(objects),b=bounds([...paths,...annotationBounds(objects)]),w=b.maxX-b.minX+20,h=b.maxY-b.minY+20;return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}mm" height="${h}mm" viewBox="${b.minX-10} ${-b.maxY-10} ${w} ${h}"><g fill="none" stroke="#152c39" stroke-width="0.25">${paths.map(path).join('')}</g>${dimensionSVG(objects)}</svg>`;}
export function projectionDXF(objects){let s='0\nSECTION\n2\nHEADER\n9\n$INSUNITS\n70\n4\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n';for(const p of contours(objects)){for(let i=0;i<p.points.length-(p.closed?0:1);i++){const a=p.points[i],b=p.points[(i+1)%p.points.length];s+=`0\nLINE\n8\n0\n10\n${a[0]}\n20\n${a[1]}\n30\n0\n11\n${b[0]}\n21\n${b[1]}\n31\n0\n`;}}return s+'0\nENDSEC\n0\nEOF\n';}
function envelope(objects,view){const groups=objects.filter(o=>o.visible&&isSolid(o)).map(o=>projectSolid(o,view));if(!groups.length)return [];const combined=kernelAPI().CrossSection.union(groups);try{return combined.toPolygons().map(points=>({points,closed:true}));}finally{combined.delete();}}
export function drawingSheet(doc){
  const sheet=doc.sheet||{},bodies=doc.objects.filter(o=>o.visible&&isSolid(o));
  const views=['top','front',sheet.section?'section':'right'].map(v=>{
    let paths,edges=[];
    if(v==='section')paths=bodies.flatMap(o=>sectionSolid(o,sheet.sectionZ??0).map(points=>({points,closed:true})));
    else if(sheet.hiddenEdges){paths=envelope(doc.objects,v);if(v==='top')paths.push(...contours(doc.objects.filter(o=>!isSolid(o)),v));edges=drawingEdges(bodies,v);}
    else paths=contours(doc.objects,v);
    return {v,paths,edges,b:bounds([...paths,...(v==='top'?annotationBounds(doc.objects):[])])};
  });
  const largest=Math.max(1,...views.map(({b})=>Math.max((b.maxX-b.minX)/70,(b.maxY-b.minY)/110)));
  const denominator=[1,2,5,10,20,50,100,200,500,1000,2000,5000,10000,20000].find(n=>n>=largest)||Math.ceil(largest),k=1/denominator;
  const content=views.map(({v,paths,edges,b},i)=>{
    const x=12+i*92,y=35,w=(b.maxX-b.minX)*k,h=(b.maxY-b.minY)*k,tx=x+(76-w)/2,ty=y+15+h;
    const g=bounds(paths),gx=tx+(g.minX-b.minX)*k,gy=ty+(b.minY-g.minY)*k,gw=(g.maxX-g.minX)*k,gh=(g.maxY-g.minY)*k;
    const overall=paths.length?`<path d="M${gx},${gy+3}v9 M${gx+gw},${gy+3}v9 M${gx},${gy+9}h${gw} M${gx-3},${gy}h-8 M${gx-3},${gy-gh}h-8 M${gx-8},${gy}v${-gh}" fill="none" stroke="#54707c" stroke-width=".2"/><text x="${gx+gw/2}" y="${gy+8}" text-anchor="middle" font-size="2.5">${round(g.maxX-g.minX)}</text><text transform="translate(${gx-9} ${gy-gh/2}) rotate(-90)" text-anchor="middle" font-size="2.5">${round(g.maxY-g.minY)}</text>`:'';
    const sectionPath=paths.map(p=>'M'+p.points.map(([x,y])=>`${x},${-y}`).join('L')+'Z').join(' ');
    const geometry=v==='section'?`<path d="${sectionPath}" fill="url(#section-hatch)" fill-rule="evenodd"/>`:paths.map(path).join('');
    const edgeLines=edges.map(e=>`<path d="M${e.a[0]},${-e.a[1]}L${e.b[0]},${-e.b[1]}" ${e.hidden?`stroke="#7c8d96" stroke-width="${.16/k}" stroke-dasharray="${1.5/k} ${.7/k}"`:''}/>`).join('');
    const annotation=v==='top'?`${sheet.centerMarks!==false?centerSVG(doc.objects,k):''}${dimensionSVG(doc.objects,k)}`:'';
    return `<text x="${x+38}" y="${y}" text-anchor="middle" font-size="3.2">${v==='section'?'SECTION A–A · Z='+round(sheet.sectionZ??0)+' mm':v.toUpperCase()}</text><g transform="translate(${tx-b.minX*k} ${ty+b.minY*k}) scale(${k})" fill="none" stroke="#263d47" stroke-width="${.25/k}">${geometry}${edgeLines}${annotation}</g>${overall}${!paths.length?`<text x="${x+38}" y="75" text-anchor="middle" font-size="3">No geometry at this cut</text>`:''}`;
  }).join('');
  const notes=String(sheet.notes||'').match(/.{1,100}(?:\s|$)|.{1,100}/g)||[];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="297mm" height="210mm" viewBox="0 0 297 210"><defs><pattern id="section-hatch" patternUnits="userSpaceOnUse" width="${3/k}" height="${3/k}" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="${3/k}" stroke="#92a2ab" stroke-width="${.25/k}"/></pattern></defs><rect width="297" height="210" fill="white"/><g font-family="Arial,sans-serif" fill="#263d47"><rect x="7" y="7" width="283" height="196" fill="none" stroke="#263d47" stroke-width=".4"/><text x="14" y="20" font-size="4">${esc(doc.name.slice(0,80))}</text><text x="283" y="27" text-anchor="end" font-size="2.7">STEP WORK / ENGINEERING STUDY</text>${content}<path d="M7 177H290 M190 177V203" stroke="#263d47" stroke-width=".3"/><text x="13" y="183" font-size="2.6">Dimensions in mm · scale 1:${denominator} · A4 landscape / print at 100%</text><text x="13" y="188" font-size="2.5">Author: ${esc(sheet.author||'—')} · Material: ${esc(sheet.material||'—')}</text>${notes.slice(0,2).map((line,i)=>`<text x="13" y="${193+i*4}" font-size="2.3">${esc(line)}</text>`).join('')}<text x="196" y="184" font-size="2.5">Drawing: ${esc((sheet.number||'SW-001').slice(0,36))}</text><text x="196" y="190" font-size="2.5">Rev ${esc((sheet.revision||'A').slice(0,12))} · ${new Date().toISOString().slice(0,10)} · 1 / 1</text><text x="196" y="196" font-size="2.3">${sheet.hiddenEdges?'Hidden edges: sampled mesh visibility':'Projected silhouettes · no hidden edges'}</text><text x="13" y="201" font-size="2.1">Mesh-based study drawing. Check details and dimensions before fabrication. Section cuts are horizontal in world coordinates.</text></g></svg>`;
}
