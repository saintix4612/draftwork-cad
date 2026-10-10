export const UNITS={mm:1,cm:10,m:1000,in:25.4};
// Small arithmetic parser: no eval, functions, or executable expressions.
export function measurement(text,unit='mm',angle=false){
 let s=String(text).trim().toLowerCase(),factor=angle?1:UNITS[unit];
 const suffix=s.match(/\s*(mm|cm|in|m|°|deg)$/);
 if(suffix){if(angle&&!['°','deg'].includes(suffix[1]))throw Error('Use degrees for angles.');if(!angle&&!(suffix[1] in UNITS))throw Error('Use mm, cm, m, or in.');factor=angle?1:UNITS[suffix[1]];s=s.slice(0,suffix.index);}
 if(s.length>120||!s.trim())throw Error('Enter a measurement.');
 const tokens=s.match(/(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?|[()+*/-]/g)||[];
 if(tokens.join('')!==s.replace(/\s/g,''))throw Error('Use numbers, + − * /, parentheses, and an optional unit.');
 let i=0;function atom(){const t=tokens[i++];if(t==='+')return atom();if(t==='-')return -atom();if(t==='('){const n=sum();if(tokens[i++]!==')')throw Error('Missing closing parenthesis.');return n;}if(t===undefined||!Number.isFinite(Number(t)))throw Error('Invalid expression.');return Number(t);}
 function product(){let n=atom();while(tokens[i]==='*'||tokens[i]==='/'){const op=tokens[i++],v=atom();n=op==='*'?n*v:n/v;}return n;}
 function sum(){let n=product();while(tokens[i]==='+'||tokens[i]==='-'){const op=tokens[i++],v=product();n=op==='+'?n+v:n-v;}return n;}
 const n=sum()*factor;if(i!==tokens.length||!Number.isFinite(n)||Math.abs(n)>1e6)throw Error('Measurement must be finite and within ±1,000,000 mm.');return n;
}
export function validatePolygon(points){
 if(!Array.isArray(points)||points.length<3||points.length>256||points.some(p=>!Array.isArray(p)||p.length!==2||p.some(v=>!Number.isFinite(v)||Math.abs(v)>1e6)))throw Error('A profile needs 3–256 finite XY points.');
 const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
 const on=(a,b,c)=>Math.abs(cross(a,b,c))<1e-8&&c[0]>=Math.min(a[0],b[0])-1e-8&&c[0]<=Math.max(a[0],b[0])+1e-8&&c[1]>=Math.min(a[1],b[1])-1e-8&&c[1]<=Math.max(a[1],b[1])+1e-8;
 const intersects=(a,b,c,d)=>cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0||on(a,b,c)||on(a,b,d)||on(c,d,a)||on(c,d,b);
 let area=0;for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];if(Math.hypot(b[0]-a[0],b[1]-a[1])<1e-6)throw Error('Remove duplicate profile points.');area+=a[0]*b[1]-b[0]*a[1];for(let j=i+1;j<points.length;j++){if(j===i+1||(i===0&&j===points.length-1))continue;if(intersects(a,b,points[j],points[(j+1)%points.length]))throw Error('Profile edges must not cross or touch.');}}
 if(Math.abs(area)<1e-6)throw Error('The profile must enclose an area.');return points.map(p=>[...p]);
}
export function polygonArea(points){return Math.abs(points.reduce((s,p,i)=>{const q=points[(i+1)%points.length];return s+p[0]*q[1]-q[0]*p[1];},0))/2;}
export function snapPoint(point,candidates,step,tolerance){let best=null,d=tolerance;for(const p of candidates){const n=Math.hypot(point[0]-p[0],point[1]-p[1]);if(n<d){d=n;best=p;}}return best?{point:[...best],kind:'endpoint'}:{point:point.map(v=>Math.round(v/step)*step),kind:'grid'};}
