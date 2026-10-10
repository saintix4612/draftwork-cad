# Draftwork CAD 0.3 validation

Validated October 10, 2026 on macOS using Node and Chromium.

## Automated checks

`npm test`: **32 passing tests**. `npm run build`: successful.

Tests cover drawing validation/serialization, undo/redo, unit arithmetic,
polygon rejection, DXF conversion, solid boolean volumes and through-holes,
constraint solving and conflicting dimensions, all seven feature generators,
feature parameter persistence, assembly transforms/cycle rejection, volumetric
interference, front/right projection axes, section contours, hidden-edge
classification, dimension tolerances and escaped sheet titles.

Numerical reference checks include:

- 1 m cantilever, 30 × 50 mm rectangular section, E = 200 GPa, 100 N tip load:
  0.533333 mm deflection, 8 MPa bending stress, reactions 100 N / 100 N·m.
- Point and uniform loading on cantilever and simply supported beams compared
  with their closed-form Euler–Bernoulli solutions.
- Symmetric triangular truss under a 1,000 N apex load: bottom member 500 N
  tension, inclined members 707.1068 N compression, support reactions 500 N each.
  Unsupported trusses are rejected as singular.
- 100 mm conductor, area 1,000 mm², k = 205 W/(m·K), end temperatures 100/20 °C:
  164 W heat flow. Reversing the temperatures reverses the heat-flow sign.
- Primitive boolean volumes, loft volume, rounded-plate area × thickness,
  swept tube volume and positive thread volume above the core-cylinder volume.

## Browser checks

- Loaded the constraint exercise and changed the outer circle's X to 25 mm;
  the concentric bore followed while retaining its 6 mm radius.
- Created a rounded plate, edited its radius from 8 to 12 mm and rebuilt it.
- Created a gear and a revolute joint. At 60°, a 100 mm offset became
  X = 50 mm, Y = 86.602540 mm, rotation = 60°.
- Ran motion and exploded previews; browser-saved drawing JSON was unchanged.
- Checked interference on separated parts; no overlap was reported.
- Ran beam, truss and thermal examples through their visible forms and checked
  their displayed values against the reference results above.
- Saved and reopened a drawing containing five constraints, one joint and
  generated solid features. The counts and geometry were preserved.
- Opened the actual standalone HTML using a `file:` URL. Disabled network
  access, reloaded, initialized the embedded solid engine and generated a thread.
- Exported STL from the standalone file.
- Previewed and exported an annotated drawing with a title block, sampled hidden
  edges and a hatched horizontal section. Printed PDF was confirmed to be one
  A4 landscape page (841.92 × 594.96 pt).
- Opened both packaged example drawings; the feature gallery contains seven
  solids. Inspected workspace, assembly and sheet screenshots.

## Known limits of this validation

This is numerical and functional verification of the implemented study tools,
not a certification of structural safety, manufacturing suitability, drafting
standards or compatibility with every CAD program. Cross-browser checks on
Safari/Firefox and broad randomized geometry testing have not been performed.
The build reports an expected large-bundle notice because the standalone file
embeds the WebAssembly solid engine. Manifold's Node-only import is externalized
by Vite; the browser path was verified in the offline standalone test.

See README.md for the supported feature scope and remaining limitations.
