import {solid} from './kernel.js';

export const HEX_CORNERS=[[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]];
export const HEX_FACES=[[0,4,7,3],[1,2,6,5],[0,1,5,4],[3,7,6,2],[0,3,2,1],[4,5,6,7]];
const neighbors=[[-1,0,0],[1,0,0],[0,-1,0],[0,1,0],[0,0,-1],[0,0,1]];

// Center-sampled voxels deliberately expose a stair-step approximation, not a
// boundary-conforming mesh. Quantify the volume discrepancy for every study.
export function meshSolid(object,resolution=24) {
  if(!Number.isInteger(resolution)||resolution<8||resolution>64)throw Error('Use 8–64 cells along the longest side.');
  const m=solid(object);
  try{
    const bounds=m.boundingBox(),size=bounds.max.map((v,i)=>v-bounds.min[i]),longest=Math.max(...size);
    const divisions=size.map(v=>Math.max(2,Math.ceil(v/longest*resolution))),spacing=size.map((v,i)=>v/divisions[i]);
    if(divisions.reduce((a,b)=>a*b,1)>12000)throw Error('Requested grid exceeds 12,000 candidates. Reduce mesh resolution.');
    const occupied=new Map(),grid=[];
    for(let i=0;i<divisions[0];i++)for(let j=0;j<divisions[1];j++){
      const x=bounds.min[0]+(i+.5)*spacing[0],y=bounds.min[1]+(j+.5)*spacing[1];
      const hits=m.rayCast([x,y,bounds.max[2]+longest],[x,y,bounds.min[2]-longest]).map(h=>h.position[2]).sort((a,b)=>b-a);
      const levels=hits.filter((z,k)=>k===0||Math.abs(z-hits[k-1])>longest*1e-8);
      for(let k=0;k<divisions[2];k++){
        const z=bounds.min[2]+(k+.5)*spacing[2];
        if(levels.filter(h=>h>z).length%2){const key=[i,j,k].join(',');occupied.set(key,grid.length);grid.push([i,j,k]);}
      }
    }
    if(!grid.length)throw Error('No material resolved. Increase the mesh resolution.');
    if(grid.length>3000)throw Error('Mesh exceeds 3,000 solid cells. Reduce resolution.');
    // Separate components or point-only connections cannot represent one bonded solid.
    const seen=new Set([0]),queue=[0];
    for(let q=0;q<queue.length;q++)for(const delta of neighbors){const g=grid[queue[q]],index=occupied.get(g.map((n,a)=>n+delta[a]).join(','));if(index!==undefined&&!seen.has(index)){seen.add(index);queue.push(index);}}
    if(seen.size!==grid.length)throw Error('Mesh contains disconnected material. Select one connected part or increase resolution to resolve its connections.');
    const nodes=[],nodeIds=new Map(),cells=[],surface=[];
    for(const g of grid)cells.push(HEX_CORNERS.map(c=>{const ijk=g.map((n,a)=>n+c[a]),key=ijk.join(',');if(!nodeIds.has(key)){nodeIds.set(key,nodes.length);nodes.push(ijk.map((n,a)=>bounds.min[a]+n*spacing[a]));}return nodeIds.get(key);}));
    grid.forEach((g,e)=>neighbors.forEach((d,f)=>{if(!occupied.has(g.map((n,a)=>n+d[a]).join(',')))surface.push({nodes:HEX_FACES[f].map(i=>cells[e][i]),cell:e,side:f});}));
    const actualVolume=m.volume(),meshVolume=grid.length*spacing.reduce((a,b)=>a*b,1);
    return {nodes,cells,surface,spacing,bounds,divisions,actualVolume,meshVolume,volumeError:(meshVolume-actualVolume)/actualVolume};
  }finally{m.delete();}
}
