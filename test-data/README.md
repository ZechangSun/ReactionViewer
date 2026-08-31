# Reaction Viewer test data

This deterministic set exercises file parsing, side-by-side layout, camera linking, centering, Kabsch alignment, and trajectory playback.

## Suggested checks

1. **Exact two-file Kabsch:** open `01-water-reference.xyz` and `02-water-rotated-translated.xyz`. Before alignment their orientations differ. Click **Kabsch align**; reported RMSD should be very close to `0.0000 Å`.
2. **Non-rigid difference:** open `01-water-reference.xyz` and `03-water-slightly-distorted.xyz`. Kabsch RMSD should remain non-zero.
3. **Three linked panels:** open `01-water-reference.xyz`, `02-water-rotated-translated.xyz`, and `03-water-slightly-distorted.xyz`. Rotate any panel; all three should follow.
4. **Synchronized animation:** open `07-water-vibration-12frames.trj` and `08-water-vibration-rigid-transform-12frames.trj`, align, then play. Both should advance together.
5. **Centering drift:** open `09-water-vibration-drift-12frames.xyz`. Play before and after **Center XYZ** to verify translational drift removal.
6. **Different trajectory lengths:** open `07-water-vibration-12frames.trj`, `10-methane-vibration-8frames.trj`, and `11-water-short-4frames.trj`. The shared timeline has 12 steps; shorter trajectories loop independently.
7. **Kabsch validation:** open water plus `06-ammonia.xyz` or `invalid/05-kabsch-element-mismatch.xyz`. Alignment should explain the element/count incompatibility.
8. **Parser errors:** open each of the first four files in `invalid/`; each should show a clear validation message.
9. **Metal contacts:** open `12-zinc-tetraammine-coordination.xyz`. Normal range should infer four Zn–N contacts and render them slightly thinner than N–H covalent bonds. Each dashed line is split at its midpoint and retains the normal Zn/N element colors; disabling **Metal contacts** should hide the Zn–N lines instead of turning them into solid bonds. Use `13-zinc-tetraammine-breathing-10frames.trj` to verify that contacts follow trajectory frames without cutoff flicker.
10. **Reaction mode:** select `reaction/reactant.xyz`, `reaction/transition_state.xyz`, and `reaction/product.xyz`. The energy strip should report a forward barrier of about 12.55 kcal/mol, reaction energy of about -6.28 kcal/mol, and reverse barrier of about 18.83 kcal/mol. C/Cl/F retain normal element colors with gold wireframe halos, their nearby environment is partially faded, distant context is strongly faded, and the transition state uses element-colored dashed partial bonds.
11. **Mixed ligands:** open `14-cisplatin-ptcl2n2-core.xyz`; Normal range should show two Pt–Cl and two Pt–N dashed contacts.
12. **Metal carbonyl:** open `15-iron-pentacarbonyl.xyz`; five Fe–C contacts should be dashed while the five C–O bonds remain solid, with no Fe–O contacts.
13. **Excluded pair types:** `16-diiron-metal-contact.xyz` must not label Fe–Fe as a metal–ligand contact, and `17-iron-hydride-policy.xyz` documents the current policy of excluding Fe–H from that category.
14. **Ligand dissociation:** play `18-zinc-ligand-dissociation-6frames.trj`; one Zn–N contact should persist briefly beyond the entry threshold, then disappear once without flickering back.
15. **Reaction matrix:** each subfolder under `reaction/` contains an independently selectable reactant / transition-state / product triplet. See `reaction/README.md` for the expected reaction center in each case.

## Regenerate

From the extension root, run:

```bash
npm run generate:test-data
```

The `.trj` files intentionally contain multi-frame XYZ text, matching the first-version TRJ contract of the extension.
