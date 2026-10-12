const solidTypes = {rectangle:'box', circle:'cylinder', polygon:'extrusion'};

// Profiles are sketches, so links cannot form a recursive feature graph.
export function rebuildExtrusions(objects, joints = []) {
  const byId = new Map(objects.map(o => [o.id, o]));
  for (const body of objects) {
    if (body.sketchId === undefined) continue;
    const sketch = byId.get(body.sketchId);
    if (!sketch || solidTypes[sketch.type] !== body.type)
      throw Error('An extrusion needs its original rectangle, circle, or polygon sketch.');
    if (joints.some(j => j.child === body.id))
      throw Error('Detach this extrusion from its sketch before using it as a moving assembly body.');
    for (const key of ['x','y','z','rotation','rx','ry','w','d','r']) body[key] = sketch[key];
    if (sketch.type === 'polygon') body.points = structuredClone(sketch.points);
  }
  return objects;
}

export function independentCopy(object) {
  const copy = structuredClone(object);
  delete copy.sketchId;
  delete copy.recipe;
  return copy;
}
