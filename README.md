# Step Work 0.8

**Download and open — no installation or unzipping:**

- [Windows download](https://github.com/saintix4612/step-work/releases/download/v0.8-mobile/Step-Work-Windows.html)
- [Mac download](https://github.com/saintix4612/step-work/releases/download/v0.8-mobile/Step-Work-Mac.html)
- [Release notes and editable source](https://github.com/saintix4612/step-work/releases/tag/v0.8-mobile)

Save the HTML file, then open it in Chrome or Edge. Both downloads contain the same portable app.

Step Work is an open-source, MIT-licensed CAD and engineering analysis workspace.
It combines dimensioned 2D sketches, editable 3D solids, assembly motion,
engineering drawings, and structural, thermal and aerodynamic analysis in a
portable browser application. Built for saintix4612 with assistance from
OpenAI Codex.

Previously named Draftwork CAD; existing drawing files remain compatible.

## New in 0.8

- Line–circle tangency, global X/Y symmetry for lines/circles, and a local
  remaining-geometric-freedom count in Sketch constraints.
- A coherent aluminum thermal example (205 W/m·K, 2700 kg/m³, 900 J/kg·K),
  labeled time curves and a **Check finer resolution** button. The comparison
  is included when you save the calculation report after running it.
- Aerodynamic angle sweep from −12° to +12°, stricter airfoil-code validation,
  and a warning for low aspect ratio. This is still a linear lift/induced-drag
  model; it does not calculate stall or airflow.
- Eleven additional tests covering thermal analytical references/refinement,
  aerodynamic reference values/scaling, sketch relations and saved drawings.

To try the heat example: **Analysis lab → Transient heat conduction → Calculate**.
Choose **Check finer resolution** to compare final temperatures, energy and heat
flow with a finer calculation. This comparison is not a guaranteed error bound.

## Mobile layout and Windows sharing

The mobile update adapts the workspace to narrow screens: Canvas, Objects,
Properties and Tools appear in the bottom navigation. Sketch tools scroll across
one row; Cancel, Finish polygon and zoom controls do not require a keyboard.
In Select mode, one finger orbits the 3D view and pans a 2D view; two fingers use
OrbitControls for zoom/pan. Two-finger gestures do not place sketch points.

`Step-Work-Phone-Preview.html` contains the actual app in a resizable phone frame
(390 × 780, 360 × 740 or landscape). Its autosave keys are separate. It previews
layout and interaction; it does not emulate phone hardware or Safari.

Share `Step-Work-Windows.html` as a single file. The recipient saves it and opens
it in Edge or Chrome, with no archive, terminal or developer tools. This is a
portable browser app, not a Windows executable or installer. The same app also
runs on Mac. Drawings are saved separately using Save file.

The mobile build and 66 numerical/model tests pass. Physical phone testing,
Windows browser testing and a visual walkthrough remain pending. iOS opening
of local HTML varies by app; this release does not add mobile hosting or a PWA.

## Open the app

Open `Step-Work.html` from a packaged build in a modern desktop browser.
It includes its 3D engine and needs no developer tools, account, or server.
Google Fonts are optional; system fonts work offline. WebGL and WebAssembly
must be available. Download drawing files as backups of browser autosave.

To edit the source, install Node.js 22.12+ (or 20.19+), then:

```sh
npm ci
npm run dev
npm test
npm run build
```

The build produces `dist/index.html` for static hosting and
`dist/Step-Work.html` as a standalone file. Source licenses are embedded in
the standalone file and also included under `dist/licenses/`.

## Student workflow

1. **Sketch.** Draw lines, rectangles, circles or closed polygons on XY. Select
   an object and enter measurements, including expressions such as `1/4 in` or
   `(30+20)*2`. Choose mm, cm, m or inches for the inspector; saved geometry is mm.
2. **Constrain.** Open Sketch constraints for lines, circles and rectangles at
   Z=0. Set horizontal/vertical, length/radius/width/depth, parallel/perpendicular,
   equal, concentric, coincident endpoints, center/start distance, or fixed.
   Edit driving dimensions in the relation list. Conflicting edits are rejected.
   The built-in exercise demonstrates equal parallel lines and concentric circles.
3. **Model.** Extrude rectangles, circles or polygons into linked solids. Edit the
   source sketch to rebuild the profile and placement; height stays independent.
   Use **Edit source sketch** or **Detach extrusion** in Properties. Duplicates
   and patterns are independent copies. Add boxes/cylinders;
   union, subtract or intersect bodies; drill a world-Z through-hole; repeat
   objects in a linear pattern. Open **Model history** to edit a hole diameter,
   world X/Y, or boolean operation; navigate inputs or detach a result.
   Changes to source sketches, solid dimensions, and generated feature parameters
   rebuild the downstream results. Edit XYZ position and XYZ rotation.
4. **Use features.** Model features creates rounded plates, chamfered blocks,
   rectangular lofts, swept tube elbows, involute spur gears, geometric threaded
   rods and a single-bend sheet. Reopen the panel on a generated part to edit
   its parameters. Sheet development uses `BA = angle × (inside radius + K × thickness)`.
5. **Assemble.** Position parts and attach a moving body to a parent using a
   fixed, revolute or slider joint. Joint axes and origins belong to the parent.
   Use a slider to save a new pose, preview motion, check overlapping volume,
   or inspect an exploded view. Closing the panel resets display-only previews.
6. **Study.** Analysis lab has a 20-element Euler–Bernoulli beam model, a 2D
   pin-jointed truss stiffness solver, steady and transient 1D heat conduction,
   and a simplified finite-wing airfoil estimate. Each study shows its
   assumptions and provides a downloadable JSON report.
7. **Draw and export.** Place linear dimension annotations with D. In Sheet setup,
   edit annotation offsets/tolerances, the title block, circular center marks,
   sampled hidden edges and a horizontal section cut. Save an A4 SVG sheet or
   print to PDF at actual size. Export STL/OBJ solids and SVG/DXF top outlines.
8. **Use 3D tools.** Select a solid and choose **3D tools** to cut it with a
   plane, hollow a supported straight extrusion, revolve a sketch profile, or
   taper/twist an extrusion. Each result stays linked to its source and rebuilds
   when its inputs change. Plane picking reads a mesh facet, so it is an
   approximate picked face rather than a persistent CAD face reference.
9. **Run a solid study.** Select one solid and choose **3D simulation**. The app
   samples it into a voxel mesh, applies a fixed bounding side and a total force
   on another side, then estimates linear elastic displacement and von Mises
   stress. Change material values, support/load faces, mesh resolution, and
   visualization. A JSON report records inputs, mesh resolution/error, results,
   and assumptions.

## Controls and files

Click twice for a line, rectangle, circle or dimension. For a polygon, click its
vertices and press Enter to close it. Shift locks the current drawing segment
to an axis. Grid spacing is adjustable, with proximity snapping to sketch points.
The displayed grid lines remain 10 mm apart regardless of the snap spacing.

ISO: left-drag orbits, right-drag pans, scroll zooms. Top/front/right: left-drag
pans. F fits the drawing. V/L/R/C/P/B/Y/M/D select tools; Esc cancels drawing;
Delete removes selection; Cmd/Ctrl Z undoes; Cmd/Ctrl Shift Z redoes;
Cmd/Ctrl D duplicates; Cmd/Ctrl S downloads a drawing.

`.stepwork` files include objects, feature parameters, constraints, joints and
sheet settings. New files use format version 5 so older editors do not silently
discard these features. Existing Draftwork version-1 through version-4 drawings remain readable.
The internal `draftwork` format identifier is retained for compatibility. Open also accepts
ASCII DXF LINE, CIRCLE and straight LWPOLYLINE entities in supported units.
Unsupported DXF entities are reported explicitly; unitless DXF is treated as mm.

STL is unitless: import its coordinates as millimeters. Separate bodies remain
separate unless explicitly joined. DXF export contains geometry outlines only;
use SVG/PDF sheets for dimensions and annotations.

## Scope and limits

Step Work uses a mesh-based geometry engine and bounded engineering models.
The limits below define where its results require another tool or independent review.

- Constraints cover XY lines, circles and rectangles, up to 80 relations / 180 variables.
  Line–circle tangency uses the infinite line; symmetry reflects two lines or
  circles across global X/Y. Remaining freedoms use a local numerical rank
  estimate, which can be misleading at singular geometries.
  New extrusions, holes and booleans retain their inputs. Older unlinked results
  stay independent. Linked operations are capped at 80 operations / 80 dependency
  levels. Detach a linked result before making it a moving joint child.
- Rounded/chamfered features are dedicated generators, not arbitrary mesh-edge
  fillets. Lofts connect two rectangular profiles; sweeps follow circular tube arcs.
  Threads have no standardized fit allowance. Gears have approximate root relief.
  Sheet metal is limited to one 90° bend; there is no general unfolding solver.
- Boolean results keep cached meshes and editable input references. Hole centers
  remain fixed in world X/Y and drill along world Z. Missing inputs, dependency
  loops, empty results and missed holes reject the entire edit. Patterns remain
  independent copies. Suppression, reordering and replacing inputs are not yet supported.
- Assemblies are acyclic single-parent joint chains, up to 60 joints. Motion is
  kinematic, not a gravity/contact/dynamics simulation. Saved joint poses rebuild
  dependent cuts; live motion preview is disabled when linked cuts exist.
  Interference checks cover
  up to 40 visible bodies, detect overlapping volume and exclude mere touching.
- The 3D structural study uses a small-strain, linear-elastic static model.
  It uses a voxelized approximation and fully integrated eight-node brick cells;
  curved surfaces and small details become stair-stepped or may not resolve.
  The app reports voxel-volume error but that does not prove local geometry or
  stress accuracy. Models are limited to 3,000 filled cells and 12,000 solver
  nodes. Supports clamp all translations on one bounding plane; force is spread
  over another plane. The solver omits contact, buckling, plasticity, fatigue,
  thermal loads and stress concentrations. Results are not certified for design
  or safety decisions. Use mesh refinement and an established solver for real
  engineering decisions.
- Transient heat conduction is one-dimensional with fixed end temperatures,
  constant properties and insulated sides. The airfoil tool uses thin-airfoil
  lift theory with a simple finite-span correction and estimates induced drag
  only. It does not predict profile drag, stall, turbulence or a flow field; its
  outputs are for learning and comparison, not aircraft design or safety.
- Plane cuts use a world-space plane. Hollowing is limited to boxes, cylinders
  and straight polygon extrusions with a constant wall and bottom thickness.
  Revolve and taper tools use defined sketch profiles, not arbitrary imported
  solid features. These tools do not provide a manufacturing-ready feature tree.
- Analysis does not mesh arbitrary CAD solids. Beam/truss models are linear and
  exclude buckling, joints, stress concentrations and nonlinear material response.
  Yield safety factors cover only the displayed idealized stress. Thermal analysis
  excludes convection, radiation and transients. There is no airflow/CFD solver.
- Drawing dimensions are independent annotations, not associative references.
  Sections are horizontal XY cuts. Hidden edges use eight visibility samples per
  sharp mesh edge; very short visibility changes may be missed. This mode is
  limited to 40 bodies / 50,000 triangles. GD&T, arbitrary sections, drafting
  standards certification, and general automatic hole recognition are absent.
- No DWG, STEP, IGES, native SolidWorks/Fusion files, cloud collaboration or
  project server. Imports are capped at 10 MB, drawings at 2,000 objects and
  200,000 mesh triangles. Boolean/feature results are capped at 100,000 triangles.

## Verification

`npm test` compares operations against analytic volumes, solves/rejects sketch
relations, exercises saved-file validation, checks assembly poses and interference,
compares beam results with closed-form solutions, verifies truss equilibrium and
Fourier heat conduction, and checks projection axes and annotated section sheets.
See `VALIDATION.md` for the browser checks performed for this release.

## Contributing and credits

Contributions are welcome. Include reproduction steps for bugs, tests for numerical
changes, and before/after screenshots for UI work. Disclose AI assistance and
verify generated changes. Keep educational assumptions visible in analysis tools.

- [Three.js](https://threejs.org/) — MIT; rendering, controls and mesh exporters.
- [Manifold](https://github.com/elalish/manifold) — Apache-2.0; solid geometry,
  booleans, sections, projections and mesh validation.
- [Vite](https://vite.dev/) — MIT; development and build tooling.
- DM Sans and IBM Plex Mono — SIL Open Font License; optional Google Fonts.

Step Work source is MIT licensed. Dependencies retain their authors' licenses.
