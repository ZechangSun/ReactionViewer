# Reaction mechanism matrix

Select all three XYZ files inside one directory, then run **Reaction Viewer: Open Molecular Comparison**. These are schematic, deterministic regression geometries rather than optimized structures.

| Directory | Mechanism covered | Expected reaction-center change |
| --- | --- | --- |
| `reaction/` | SN2 substitution | break C–Cl, form C–F |
| `proton-transfer/` | heteroatom proton transfer | break O–H, form N–H |
| `diels-alder/` | concerted cycloaddition | form two C–C bonds |
| `ring-opening/` | ring cleavage | break one C–C bond |
| `ligand-substitution/` | coordination substitution | break Zn···N, form Zn···O |
| `reductive-elimination/` | organometallic elimination | break two Pd···C contacts, form C–C |

For every case, ordinary bond colors should stay element-based. Gold double halos mark the reaction-center atoms; the local shell remains visible but muted, distant context fades strongly, and only the transition-state panel receives dashed partial-bond overlays.
