import * as THREE from 'three';

export function studyView(mesh,result,options={}){
  const group=new THREE.Group(),positions=[],colors=[],color=new THREE.Color(),scale=options.scale||0,field=options.field||'displacement';
  const peak=result?(field==='stress'?result.peakStress:result.maxDisplacement):1;
  const moved=i=>mesh.nodes[i].map((v,a)=>v+(result?result.displacements[i][a]*scale:0));
  for(const face of mesh.surface)for(const index of [0,1,2,0,2,3]){
    const i=face.nodes[index];positions.push(...moved(i));
    const value=result?(field==='stress'?result.stresses[face.cell]:result.magnitudes[i]):0;
    if(result)color.setHSL((1-Math.min(1,value/(peak||1)))*.66,.8,.5);else color.set('#91b6bd');colors.push(color.r,color.g,color.b);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.computeVertexNormals();
  group.add(new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.8,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1})));
  if(options.mesh!==false){const lines=[];for(const face of mesh.surface)for(let k=0;k<4;k++)lines.push(...moved(face.nodes[k]),...moved(face.nodes[(k+1)%4]));const wire=new THREE.BufferGeometry();wire.setAttribute('position',new THREE.Float32BufferAttribute(lines,3));group.add(new THREE.LineSegments(wire,new THREE.LineBasicMaterial({color:'#244553',transparent:true,opacity:.35})));}
  const axis=Math.floor(options.support/2),bound=mesh.bounds[options.support%2?'max':'min'][axis],fixed=result?.fixedNodes||mesh.nodes.map((p,i)=>Math.abs(p[axis]-bound)<1e-6?i:-1).filter(i=>i>=0);
  const support=new THREE.BufferGeometry().setFromPoints(fixed.map(i=>new THREE.Vector3(...mesh.nodes[i])));group.add(new THREE.Points(support,new THREE.PointsMaterial({color:'#29a25b',size:6,sizeAttenuation:false,depthTest:false})));
  if(options.force?.some(v=>v!==0)){
    const la=Math.floor(options.loadFace/2),lb=mesh.bounds[options.loadFace%2?'max':'min'][la],ids=result?.loadNodes||mesh.nodes.map((p,i)=>Math.abs(p[la]-lb)<1e-6?i:-1).filter(i=>i>=0),direction=new THREE.Vector3(...options.force).normalize(),length=Math.max(...mesh.bounds.max.map((v,a)=>v-mesh.bounds.min[a]))*.12;
    for(let q=0;q<ids.length;q+=Math.max(1,Math.ceil(ids.length/9))){const arrow=new THREE.ArrowHelper(direction,new THREE.Vector3(...moved(ids[q])),length,'#df713d',length*.25,length*.13);group.add(arrow);}
  }
  return group;
}
