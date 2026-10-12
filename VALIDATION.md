# Step Work 0.8 validation

Verified October 11, 2026: **66 automated tests passed**, and `npm run build`
succeeded. Eleven new tests cover the changes listed below. Browser interaction
and visual checks of the 0.8 release remain pending; the existing local-file
browser automation restriction was respected. Historical checks below refer to
older releases, not a new visual verification of 0.8.

## Version 0.8 numerical and functional checks

- Transient conduction compared at 79 interior points with an independent
  Fourier-series solution of the heat equation: error below 0.02 °C at 10 s
  using 81 nodes and 5000 implicit time steps. Refinement from 11 nodes / 20
  steps reduces midpoint error by more than a factor of ten.
- Uniform-temperature equilibrium, maximum principle, resolution validation,
  and steady limit: 60 °C midpoint, 164 W heat flow and 9720 J stored energy
  for the 100 mm aluminum example at 300 s.
- Thermal refinement comparison and rejection at the maximum resolution.
- Symmetric airfoil: zero lift at zero angle, finite-wing analytical lift
  slope, induced-drag formula, sign reversal, and fourfold force at doubled
  speed. NACA 2412 zero-lift angle agrees with −2.07724° within 0.001°.
  These verify the implemented approximation, not CFD or experimental accuracy.
- Invalid airfoil codes and warnings at high angle/Mach and low aspect ratio.
- Line–circle tangency, fixed geometry, global-axis symmetry for circles and
  lines, saved-document validation, and geometric freedom with duplicate
  constraints and the redundant line rotation parameter excluded.

The build emits the existing large-bundle warning because it embeds the solid
engine. No new runtime browser walkthrough was completed.

## Version 0.6 milestone

The solid-study and solid-tool tests bring the automated suite to 55 passing
tests. Study checks include HEX8 stiffness symmetry and rigid translation,
analytic axial stretching, cantilever mesh convergence, force and moment
equilibrium, load scaling, voids/disconnected geometry, and input/size limits.
Tool checks compare plane cuts, shell, revolve and taper volumes with analytic
or expected geometry and verify linked rebuilds.

Numerical references used by the solid study:

- 100 × 10 × 10 mm bar, E = 200 GPa, ν = 0, 1,000 N axial force:
  0.005 mm extension, 10 MPa stress, and 2.5 N·mm strain energy.
- 100 × 10 × 10 mm cantilever, E = 200 GPa, ν = 0.3, 100 N transverse force:
  tip displacement approaches the 0.2 mm beam reference as the voxel mesh is
  refined; reactions and moments balance the applied load.

The standalone app has been built with the worker, mesh engine and example files
embedded. Browser checks for face picking, deformation rendering, and the final
offline packaged copy remain to be completed.

## Version 0.5 milestone

Six additional automated tests cover hole/sketch/height edits against analytic
volumes, boolean chains evaluated out of array order, failed edit isolation,
recipe undo/redo, detach, reload, invalid references and parameters, dependency
cycles including assembly links, and evaluating saved joint poses before cuts.

Standalone Chromium checks verified the Step Work name, legacy drawing import,
source width and height updates, hole diameter editing, missed-hole rejection,
source deletion protection, detach/undo, offline reload, union creation,
changing a union to an intersection, and rebuilding after an operand resize.
No runtime exceptions were observed during these checks.

## Version 0.4 milestone

Seven additional automated tests cover linked rectangles/circles/polygons,
constraint-driven updates, serialization, missing references, independent copies,
detach/undo, joint compatibility, and migration from formats 1 and 2.

The standalone HTML was tested in Chromium: changing a source width from 80 to
125 mm rebuilt the solid; changing source depth rebuilt two linked extrusions
while an independent duplicate retained its original depth. Height remained
editable, profile/placement controls were read-only, source deletion was blocked,
and detach, undo, extrusion creation, and autosave reload preserved expected state.
The broader browser checks below describe the preceding 0.3 release.

## Historical 0.3 automated checks

`npm test`: **45 passing tests**. `npm run build`: successful.

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

## Mobile layout update

Built the responsive layout and embedded phone-frame preview successfully; all
66 existing model/numerical tests still pass. The tests do not exercise the
new DOM layout or touch interactions. Local browser automation remains blocked;
no visual, physical-device or Windows-specific validation is claimed.
