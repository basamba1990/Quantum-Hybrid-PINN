# Production LH2 signed-upload verification — 2026-08-27

## Scope
Tested the production New Project flow with `LH2-SYNTHETIC-DENSE-6FRAME-URL-FIX`, six VTU frames and the matching sidecar.

## Observed result
The production import completed and redirected to:
`/dashboard/projects/67e5f8e4-4200-49c1-9867-890f2f190e96?cfdAnalysisId=e41ef895-59f1-4fe7-ab94-157004074733`

The project page displayed the volumetric CFD workspace with:
- mesh revision: `synthetic-lh2-dense-mesh-v1`
- 1,053 vertices
- 3,120 cells
- 6 available frames
- fields: temperature, pressure, velocity, region_id
- PNG, JSON, PDF and CSV field export controls
- transient time slider and Play transient control

This proves that the signed-upload path, persistence path, dataset retrieval path and render-ready buffer path are working for this test kit in the currently served production application.

## Scientific status
The dataset remains `UNVALIDATED`. The displayed gate matrix reported:
- G0: PASS — Evidence present
- G1: BLOCKED — Volume connectivity is structurally invalid
- G2–G5: NOT_REACHED because G1 is not satisfied

No solver validation, residual evidence or industrial certification is claimed. The viewer is render-ready independently from the certification gates.

## Remaining issue observed
Some legacy French UI strings remain on the project page, including the Sweet Spot unavailable message and the validation gate labels. This is separate from the signed-upload fix and requires the final routed-component translation pass.

## Code revision
The canonical signed URL fix was published as commit `053e63328441efd7fc6ff71ac0c6d97918e1075f` with Git author `basamba1990@yahoo.fr`.

## Interpretation
The previous `InvalidSignature` blocker is not reproduced by this LH2 production run. The result is a successful structural/rendering import, not a G0–G5 scientific validation.

## Browser evidence
The production run redirected to the project page and showed the render-ready volumetric workspace, including the canvas, six states, 1,053 vertices, 3,120 cells and export controls. The returned analysis ID was `e41ef895-59f1-4fe7-ab94-157004074733`. The page still contains a few French strings, but the core import and rendering labels are English.

The browser performance entries showed the upload-session response issuing canonical Supabase URLs of the form `/storage/v1/object/upload/sign/cfd-artifacts/<path>?token=...`; the direct upload and persistence completed successfully for all six LH2 frames.

## Deep Mining production verification
The production import also completed for `DEEP-MINING-BLOCK-ABSTRACT-PULSE-8FRAME-URL-FIX` and redirected to:
`/dashboard/projects/ba938377-d8a2-47e5-bee6-2384baf69e2d?cfdAnalysisId=583b53c6-0c73-43b3-8562-aa26112e6b24`

The page displayed:
- mesh revision: `deep-mining-block-acoustic-rd1-mesh-v1`
- 5,456 vertices
- 22,500 cells
- 8 available states
- fields including temperature, pressure, velocity, gas_concentration, leak_indicator, wavefront_indicator and region_id
- PNG, JSON, PDF and CSV export controls
- volumetric CFD canvas

The server/UI status remained `UNVALIDATED`; G0 passed, G1 was blocked by structurally invalid volume connectivity, and G2–G5 were not reached. The UI displayed `TRANSIENT PLAYBACK UNAVAILABLE` despite eight states being present; this is a separate playback/readiness issue to audit. No explosive charge, detonation energy, initiation procedure or real-mine claim was used.
