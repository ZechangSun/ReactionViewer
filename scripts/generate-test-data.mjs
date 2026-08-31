import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const validDir = resolve(root, 'test-data/valid');
const invalidDir = resolve(root, 'test-data/invalid');
const reactionDir = resolve(root, 'test-data/reaction');
await mkdir(validDir, { recursive: true });
await mkdir(invalidDir, { recursive: true });
await mkdir(reactionDir, { recursive: true });

const water = [
  ['O', 0.000000, 0.000000, 0.000000],
  ['H', 0.957200, 0.000000, 0.000000],
  ['H', -0.239987, 0.927297, 0.000000],
];

const methane = [
  ['C', 0.000000, 0.000000, 0.000000],
  ['H', 0.629118, 0.629118, 0.629118],
  ['H', -0.629118, -0.629118, 0.629118],
  ['H', -0.629118, 0.629118, -0.629118],
  ['H', 0.629118, -0.629118, -0.629118],
];

const ammonia = [
  ['N', 0.000000, 0.000000, 0.116489],
  ['H', 0.000000, 0.939731, -0.271810],
  ['H', 0.813830, -0.469865, -0.271810],
  ['H', -0.813830, -0.469865, -0.271810],
];

const cisplatinCore = [
  ['Pt', 0.000, 0.000, 0.000],
  ['Cl', 2.300, 0.000, 0.000],
  ['Cl', 0.000, 2.300, 0.000],
  ['N', -2.050, 0.000, 0.000],
  ['N', 0.000, -2.050, 0.000],
];

const diironContact = [
  ['Fe', -1.225, 0.000, 0.000],
  ['Fe', 1.225, 0.000, 0.000],
];

const ironHydride = [
  ['Fe', 0.000, 0.000, 0.000],
  ['H', 1.550, 0.000, 0.000],
];

const reactionReactant = [
  ['C', 0.000, 0.000, 0.000], ['H', 0.000, 1.020, 0.000], ['H', 0.000, -0.510, 0.883],
  ['H', 0.000, -0.510, -0.883], ['Cl', 1.780, 0.000, 0.000], ['F', -3.200, 0.000, 0.000],
];
const reactionTransition = [
  ['C', 0.000, 0.000, 0.000], ['H', 0.000, 1.080, 0.000], ['H', 0.000, -0.540, 0.935],
  ['H', 0.000, -0.540, -0.935], ['Cl', 2.050, 0.000, 0.000], ['F', -1.950, 0.000, 0.000],
];
const reactionProduct = [
  ['C', 0.000, 0.000, 0.000], ['H', 0.000, 1.020, 0.000], ['H', 0.000, -0.510, 0.883],
  ['H', 0.000, -0.510, -0.883], ['Cl', 3.200, 0.000, 0.000], ['F', -1.350, 0.000, 0.000],
];

// These compact geometries are deliberately schematic. Their purpose is to
// make connectivity changes deterministic at the viewer's inference cutoffs,
// not to serve as optimized quantum-chemical structures.
const reactionCases = {
  'proton-transfer': {
    energies: [-75.000, -74.985, -75.005],
    label: 'O-to-N proton transfer',
    frames: [
      [['O', 0, 0, 0], ['H', 0.98, 0, 0], ['N', 2.80, 0, 0], ['C', -1.43, 0, 0], ['C', 4.27, 0, 0]],
      [['O', 0, 0, 0], ['H', 1.40, 0, 0], ['N', 2.80, 0, 0], ['C', -1.43, 0, 0], ['C', 4.27, 0, 0]],
      [['O', 0, 0, 0], ['H', 1.82, 0, 0], ['N', 2.80, 0, 0], ['C', -1.43, 0, 0], ['C', 4.27, 0, 0]],
    ],
  },
  'diels-alder': {
    energies: [-154.000, -153.970, -154.030],
    label: 'concerted Diels-Alder cycloaddition',
    frames: [
      [['C', 1.40, 0, 0], ['C', 0.70, 1.212436, 0], ['C', -0.70, 1.212436, 0], ['C', -1.40, 0, 0], ['C', 0.70, -4.00, 0], ['C', -0.70, -4.00, 0]],
      [['C', 1.40, 0, 0], ['C', 0.70, 1.212436, 0], ['C', -0.70, 1.212436, 0], ['C', -1.40, 0, 0], ['C', 0.70, -2.606, 0], ['C', -0.70, -2.606, 0]],
      [['C', 1.40, 0, 0], ['C', 0.70, 1.212436, 0], ['C', -0.70, 1.212436, 0], ['C', -1.40, 0, 0], ['C', 0.70, -1.212436, 0], ['C', -0.70, -1.212436, 0]],
    ],
  },
  'ring-opening': {
    energies: [-117.000, -116.975, -117.010],
    label: 'three-membered ring opening',
    frames: [
      [['C', -0.75, 0, 0], ['C', 0, 1.299038, 0], ['C', 0.75, 0, 0]],
      [['C', -1.05, 0, 0], ['C', 0, 1.00, 0], ['C', 1.05, 0, 0]],
      [['C', -1.50, 0, 0], ['C', 0, 0, 0], ['C', 1.50, 0, 0]],
    ],
  },
  'ligand-substitution': {
    energies: [-220.000, -219.985, -220.008],
    label: 'Zn nitrogen-to-oxygen ligand substitution',
    frames: [
      [['Zn', 0, 0, 0], ['N', 2.10, 0, 0], ['C', 3.50, 0, 0], ['O', -4.00, 0, 0], ['H', -4.96, 0, 0]],
      [['Zn', 0, 0, 0], ['N', 2.65, 0, 0], ['C', 4.05, 0, 0], ['O', -2.60, 0, 0], ['H', -3.56, 0, 0]],
      [['Zn', 0, 0, 0], ['N', 4.00, 0, 0], ['C', 5.40, 0, 0], ['O', -2.00, 0, 0], ['H', -2.96, 0, 0]],
    ],
  },
  'reductive-elimination': {
    energies: [-310.000, -309.975, -310.020],
    label: 'Pd carbon-carbon reductive elimination',
    frames: [
      [['Pd', 0, 0, 0], ['C', -1.80, 0, 0], ['C', 1.80, 0, 0], ['P', 0, 2.20, 0], ['P', 0, -2.20, 0]],
      [['Pd', 0, 0, 0], ['C', 2.50, 1.10, 0], ['C', 2.50, -1.10, 0], ['P', 0, 2.20, 0], ['P', 0, -2.20, 0]],
      [['Pd', 0, 0, 0], ['C', 3.00, 0.75, 0], ['C', 3.00, -0.75, 0], ['P', 0, 2.20, 0], ['P', 0, -2.20, 0]],
    ],
  },
};

function zincTetraammine(phase = 0) {
  const invSqrt3 = 1 / Math.sqrt(3);
  const directions = [[1, 1, 1], [-1, -1, 1], [-1, 1, -1], [1, -1, -1]]
    .map((vector) => vector.map((value) => value * invSqrt3));
  const atoms = [['Zn', 0, 0, 0]];
  const znN = 2.05 + 0.07 * Math.sin(phase);
  for (const direction of directions) {
    const nitrogen = direction.map((value) => value * znN);
    atoms.push(['N', ...nitrogen]);
    const helper = Math.abs(direction[2]) < 0.9 ? [0, 0, 1] : [0, 1, 0];
    const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const normalize = (vector) => {
      const length = Math.hypot(...vector);
      return vector.map((value) => value / length);
    };
    const u = normalize(cross(direction, helper));
    const v = cross(direction, u);
    for (let h = 0; h < 3; h++) {
      const angle = phase * 0.15 + h * 2 * Math.PI / 3;
      const offset = direction.map((value, axis) => 0.34 * value + 0.96 * (Math.cos(angle) * u[axis] + Math.sin(angle) * v[axis]));
      atoms.push(['H', nitrogen[0] + offset[0], nitrogen[1] + offset[1], nitrogen[2] + offset[2]]);
    }
  }
  return atoms;
}

function ironPentacarbonyl() {
  const directions = [
    [0, 0, 1], [0, 0, -1],
    [1, 0, 0], [-0.5, Math.sqrt(3) / 2, 0], [-0.5, -Math.sqrt(3) / 2, 0],
  ];
  const atoms = [['Fe', 0, 0, 0]];
  directions.forEach((direction) => {
    atoms.push(['C', ...direction.map((value) => value * 1.80)]);
    atoms.push(['O', ...direction.map((value) => value * 2.95)]);
  });
  return atoms;
}

function rotateTranslate(atoms, angles, translation) {
  const [ax, ay, az] = angles;
  const [cx, sx, cy, sy, cz, sz] = [Math.cos(ax), Math.sin(ax), Math.cos(ay), Math.sin(ay), Math.cos(az), Math.sin(az)];
  return atoms.map(([element, x, y, z]) => {
    const x1 = x;
    const y1 = cx * y - sx * z;
    const z1 = sx * y + cx * z;
    const x2 = cy * x1 + sy * z1;
    const y2 = y1;
    const z2 = -sy * x1 + cy * z1;
    return [element, cz * x2 - sz * y2 + translation[0], sz * x2 + cz * y2 + translation[1], z2 + translation[2]];
  });
}

function frame(atoms, comment) {
  return [
    String(atoms.length),
    comment,
    ...atoms.map(([element, x, y, z]) => `${element} ${x.toFixed(8)} ${y.toFixed(8)} ${z.toFixed(8)}`),
  ].join('\n');
}

function trajectory(base, count, options = {}) {
  const frames = [];
  for (let i = 0; i < count; i++) {
    const phase = (2 * Math.PI * i) / count;
    let atoms = base.map(([element, x, y, z], atomIndex) => {
      if (atomIndex === 0) return [element, x, y, z];
      const stretch = 1 + 0.045 * Math.sin(phase + atomIndex * 0.8);
      return [element, x * stretch, y * stretch, z * stretch + 0.035 * Math.cos(phase + atomIndex)];
    });
    if (options.drift) atoms = atoms.map(([e, x, y, z]) => [e, x + i * 0.16, y - i * 0.07, z + i * 0.04]);
    if (options.transform) atoms = rotateTranslate(atoms, options.transform.angles, options.transform.translation);
    frames.push(frame(atoms, `${options.name || 'trajectory'} frame ${i + 1}/${count}`));
  }
  return `${frames.join('\n')}\n`;
}

function zincTrajectory(count) {
  return `${Array.from({ length: count }, (_, i) => {
    const phase = 2 * Math.PI * i / count;
    return frame(zincTetraammine(phase), `tetraamminezinc metal-contact breathing frame ${i + 1}/${count}`);
  }).join('\n')}\n`;
}

function zincDissociationTrajectory() {
  const direction = [1, 1, 1].map((value) => value / Math.sqrt(3));
  const shifts = [0, 0.35, 0.53, 0.60, 0.75, 1.00];
  return `${shifts.map((shift, frameIndex) => {
    const atoms = zincTetraammine().map((atom, atomIndex) => {
      if (atomIndex < 1 || atomIndex > 4) return atom;
      return [atom[0], ...atom.slice(1).map((value, axis) => value + direction[axis] * shift)];
    });
    return frame(atoms, `tetraamminezinc ligand dissociation frame ${frameIndex + 1}/${shifts.length}`);
  }).join('\n')}\n`;
}

const files = new Map([
  ['valid/01-water-reference.xyz', `${frame(water, 'Water reference geometry')}\n`],
  ['valid/02-water-rotated-translated.xyz', `${frame(rotateTranslate(water, [0.73, -0.41, 1.12], [8.4, -3.2, 5.7]), 'Exact rigid transform of 01; expected Kabsch RMSD approximately 0')}\n`],
  ['valid/03-water-slightly-distorted.xyz', `${frame(water.map((atom, i) => i === 1 ? [atom[0], atom[1] + 0.035, atom[2] - 0.018, atom[3] + 0.012] : atom), 'Slightly distorted water; expected non-zero Kabsch RMSD')}\n`],
  ['valid/04-methane-reference.xyz', `${frame(methane, 'Methane tetrahedron reference')}\n`],
  ['valid/05-methane-rotated-translated.xyz', `${frame(rotateTranslate(methane, [-0.52, 0.91, -1.27], [-6.2, 4.8, 2.3]), 'Exact rigid transform of 04; expected Kabsch RMSD approximately 0')}\n`],
  ['valid/06-ammonia.xyz', `${frame(ammonia, 'Ammonia; useful as an intentionally incompatible third molecule')}\n`],
  ['valid/07-water-vibration-12frames.trj', trajectory(water, 12, { name: 'water vibration' })],
  ['valid/08-water-vibration-rigid-transform-12frames.trj', trajectory(water, 12, { name: 'transformed water vibration', transform: { angles: [0.73, -0.41, 1.12], translation: [8.4, -3.2, 5.7] } })],
  ['valid/09-water-vibration-drift-12frames.xyz', trajectory(water, 12, { name: 'drifting water vibration', drift: true })],
  ['valid/10-methane-vibration-8frames.trj', trajectory(methane, 8, { name: 'methane vibration', drift: true })],
  ['valid/11-water-short-4frames.trj', trajectory(water, 4, { name: 'short water trajectory' })],
  ['valid/12-zinc-tetraammine-coordination.xyz', `${frame(zincTetraammine(), 'Tetraamminezinc model; expected 4 inferred dashed Zn--N contacts')}\n`],
  ['valid/13-zinc-tetraammine-breathing-10frames.trj', zincTrajectory(10)],
  ['valid/14-cisplatin-ptcl2n2-core.xyz', `${frame(cisplatinCore, 'Square-planar cis-PtCl2N2 core; expected 2 Pt--Cl and 2 Pt--N contacts')}\n`],
  ['valid/15-iron-pentacarbonyl.xyz', `${frame(ironPentacarbonyl(), 'Trigonal-bipyramidal Fe(CO)5; expected 5 Fe--C contacts and 5 covalent C--O bonds')}\n`],
  ['valid/16-diiron-metal-contact.xyz', `${frame(diironContact, 'Fe--Fe pair; must not be classified as a metal-ligand or ordinary covalent candidate')}\n`],
  ['valid/17-iron-hydride-policy.xyz', `${frame(ironHydride, 'Fe--H policy case; hydrogen is excluded from inferred metal-ligand contacts')}\n`],
  ['valid/18-zinc-ligand-dissociation-6frames.trj', zincDissociationTrajectory()],
  ['invalid/01-bad-atom-count.xyz', '3\nClaims three atoms but contains two\nO 0 0 0\nH 0.95 0 0\n'],
  ['invalid/02-changed-atom-order.trj', '3\nframe 1\nO 0 0 0\nH 0.95 0 0\nH -0.24 0.93 0\n3\nframe 2 swaps atom order\nH 0.95 0 0\nO 0 0 0\nH -0.24 0.93 0\n'],
  ['invalid/03-nonnumeric-coordinate.xyz', '2\nBad coordinate\nH zero 0 0\nH 1 0 0\n'],
  ['invalid/04-zero-atoms.xyz', '0\nEmpty molecule\n'],
  ['invalid/05-kabsch-element-mismatch.xyz', '3\nSame count as water but incompatible element order\nN 0 0 0\nH 0.95 0 0\nH -0.24 0.93 0\n'],
  ['reaction/reactant.xyz', `${frame(reactionReactant, 'energy=-100.000000 hartree | SN2 reactant')}\n`],
  ['reaction/transition_state.xyz', `${frame(reactionTransition, 'energy=-99.980000 hartree | SN2 transition state')}\n`],
  ['reaction/product.xyz', `${frame(reactionProduct, 'energy=-100.010000 hartree | SN2 product')}\n`],
]);

const reactionFileNames = ['reactant.xyz', 'transition_state.xyz', 'product.xyz'];
for (const [caseName, reactionCase] of Object.entries(reactionCases)) {
  reactionCase.frames.forEach((atoms, index) => {
    const role = ['reactant', 'transition state', 'product'][index];
    files.set(
      `reaction/${caseName}/${reactionFileNames[index]}`,
      `${frame(atoms, `energy=${reactionCase.energies[index].toFixed(6)} hartree | ${reactionCase.label} ${role}`)}\n`,
    );
  });
}

for (const [relativePath, content] of files) {
  const target = resolve(root, 'test-data', relativePath);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content, 'utf8');
}

const readme = `# Reaction Viewer test data

This deterministic set exercises file parsing, side-by-side layout, camera linking, centering, Kabsch alignment, and trajectory playback.

## Suggested checks

1. **Exact two-file Kabsch:** open \`01-water-reference.xyz\` and \`02-water-rotated-translated.xyz\`. Before alignment their orientations differ. Click **Kabsch align**; reported RMSD should be very close to \`0.0000 Å\`.
2. **Non-rigid difference:** open \`01-water-reference.xyz\` and \`03-water-slightly-distorted.xyz\`. Kabsch RMSD should remain non-zero.
3. **Three linked panels:** open \`01-water-reference.xyz\`, \`02-water-rotated-translated.xyz\`, and \`03-water-slightly-distorted.xyz\`. Rotate any panel; all three should follow.
4. **Synchronized animation:** open \`07-water-vibration-12frames.trj\` and \`08-water-vibration-rigid-transform-12frames.trj\`, align, then play. Both should advance together.
5. **Centering drift:** open \`09-water-vibration-drift-12frames.xyz\`. Play before and after **Center XYZ** to verify translational drift removal.
6. **Different trajectory lengths:** open \`07-water-vibration-12frames.trj\`, \`10-methane-vibration-8frames.trj\`, and \`11-water-short-4frames.trj\`. The shared timeline has 12 steps; shorter trajectories loop independently.
7. **Kabsch validation:** open water plus \`06-ammonia.xyz\` or \`invalid/05-kabsch-element-mismatch.xyz\`. Alignment should explain the element/count incompatibility.
8. **Parser errors:** open each of the first four files in \`invalid/\`; each should show a clear validation message.
9. **Metal contacts:** open \`12-zinc-tetraammine-coordination.xyz\`. Normal range should infer four Zn–N contacts and render them slightly thinner than N–H covalent bonds. Each dashed line is split at its midpoint and retains the normal Zn/N element colors; disabling **Metal contacts** should hide the Zn–N lines instead of turning them into solid bonds. Use \`13-zinc-tetraammine-breathing-10frames.trj\` to verify that contacts follow trajectory frames without cutoff flicker.
10. **Reaction mode:** select \`reaction/reactant.xyz\`, \`reaction/transition_state.xyz\`, and \`reaction/product.xyz\`. The energy strip should report a forward barrier of about 12.55 kcal/mol, reaction energy of about -6.28 kcal/mol, and reverse barrier of about 18.83 kcal/mol. C/Cl/F retain normal element colors with gold wireframe halos, their nearby environment is partially faded, distant context is strongly faded, and the transition state uses element-colored dashed partial bonds.
11. **Mixed ligands:** open \`14-cisplatin-ptcl2n2-core.xyz\`; Normal range should show two Pt–Cl and two Pt–N dashed contacts.
12. **Metal carbonyl:** open \`15-iron-pentacarbonyl.xyz\`; five Fe–C contacts should be dashed while the five C–O bonds remain solid, with no Fe–O contacts.
13. **Excluded pair types:** \`16-diiron-metal-contact.xyz\` must not label Fe–Fe as a metal–ligand contact, and \`17-iron-hydride-policy.xyz\` documents the current policy of excluding Fe–H from that category.
14. **Ligand dissociation:** play \`18-zinc-ligand-dissociation-6frames.trj\`; one Zn–N contact should persist briefly beyond the entry threshold, then disappear once without flickering back.
15. **Reaction matrix:** each subfolder under \`reaction/\` contains an independently selectable reactant / transition-state / product triplet. See \`reaction/README.md\` for the expected reaction center in each case.

## Regenerate

From the extension root, run:

\`\`\`bash
npm run generate:test-data
\`\`\`

The \`.trj\` files intentionally contain multi-frame XYZ text, matching the first-version TRJ contract of the extension.
`;
await writeFile(resolve(root, 'test-data/README.md'), readme, 'utf8');

const reactionReadme = `# Reaction mechanism matrix

Select all three XYZ files inside one directory, then run **Reaction Viewer: Open Molecular Comparison**. These are schematic, deterministic regression geometries rather than optimized structures.

| Directory | Mechanism covered | Expected reaction-center change |
| --- | --- | --- |
| \`reaction/\` | SN2 substitution | break C–Cl, form C–F |
| \`proton-transfer/\` | heteroatom proton transfer | break O–H, form N–H |
| \`diels-alder/\` | concerted cycloaddition | form two C–C bonds |
| \`ring-opening/\` | ring cleavage | break one C–C bond |
| \`ligand-substitution/\` | coordination substitution | break Zn···N, form Zn···O |
| \`reductive-elimination/\` | organometallic elimination | break two Pd···C contacts, form C–C |

For every case, ordinary bond colors should stay element-based. Gold double halos mark the reaction-center atoms; the local shell remains visible but muted, distant context fades strongly, and only the transition-state panel receives dashed partial-bond overlays.
`;
await writeFile(resolve(reactionDir, 'README.md'), reactionReadme, 'utf8');

console.log(`Generated ${files.size} molecule fixtures in ${resolve(root, 'test-data')}`);
