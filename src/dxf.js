import {makeObject,documentFor,validateDocument} from './model.js';
import {validatePolygon} from './engineering.js';
export function importDXF(text,name='Imported drawing'){
 const lines=text.replace(/\r/g,'').trimEnd().split('\n');if(lines.length%2)throw Error('Malformed ASCII DXF: expected code/value pairs.');const pairs=[];for(let i=0;i<lines.length;i+=2){const code=Number(lines[i].trim());if(!Number.isInteger(code))throw Error('Invalid DXF group code.');pairs.push([code,lines[i+1].trim()]);}
 let unitCode=0;const unitIndex=pairs.findIndex(([c,v])=>c===9&&v==='$INSUNITS');if(unitIndex>=0&&pairs[unitIndex+1]?.[0]===70)unitCode=Number(pairs[unitIndex+1][1]);const factors={0:1,1:25.4,2:304.8,4:1,5:10,6:1000,14:100};if(!(unitCode in factors))throw Error('Unsupported DXF units. Convert to mm, cm, m, inches, or feet first.');const factor=factors[unitCode];
 const objects=[],unsupported=new Set();let section='',i=0;
 while(i<pairs.length){const [code,value]=pairs[i++];if(code===0&&value==='SECTION'){section=pairs[i++]?.[1];continue;}if(code===0&&value==='ENDSEC'){section='';continue;}if(section!=='ENTITIES'||code!==0)continue;const data=[];while(i<pairs.length&&pairs[i][0]!==0)data.push(pairs[i++]);const get=(c,defaultValue=0)=>{const raw=data.find(p=>p[0]===c)?.[1];const n=raw===undefined?defaultValue:Number(raw);if(!Number.isFinite(n))throw Error('DXF contains an invalid coordinate.');return n;};const n=data.find(p=>p[0]===8)?.[1]||value;
 if(get(38)!==0||get(30)!==0||get(31)!==0||get(210)!==0||get(220)!==0||get(230,1)!==1)throw Error('Only planar XY DXF entities are supported.');
 if(value==='LINE')objects.push(makeObject('line',{name:n,x:get(10)*factor,y:get(20)*factor,w:(get(11)-get(10))*factor,d:(get(21)-get(20))*factor}));
 else if(value==='CIRCLE')objects.push(makeObject('circle',{name:n,x:get(10)*factor,y:get(20)*factor,r:get(40)*factor}));
 else if(value==='LWPOLYLINE'){if(data.some(([c,v])=>[40,41,42,43].includes(c)&&Number(v)!==0))throw Error('Curved or wide polylines are not supported.');const points=[];for(let j=0;j<data.length;j++)if(data[j][0]===10){const y=data[j+1];if(y?.[0]!==20)throw Error('Invalid polyline vertex.');points.push([Number(data[j][1])*factor,Number(y[1])*factor]);}if((get(70)&1)!==0){objects.push(makeObject('polygon',{name:n,points:validatePolygon(points)}));}else{for(let j=1;j<points.length;j++)objects.push(makeObject('line',{name:n,x:points[j-1][0],y:points[j-1][1],w:points[j][0]-points[j-1][0],d:points[j][1]-points[j-1][1]}));}}
 else unsupported.add(value);
 if(objects.length>2000)throw Error('DXF exceeds 2,000 objects.');}
 if(unsupported.size)throw Error('Unsupported DXF entities: '+[...unsupported].join(', ')+'. Export LINE, CIRCLE, or straight LWPOLYLINE only.');if(!objects.length)throw Error('No supported geometry found in this DXF.');return {document:validateDocument(documentFor(name,objects)),unitless:unitCode===0};
}
