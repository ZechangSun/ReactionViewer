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
    return frame(zincTetraammine(phase), `tetraamminezinc coordination breathing frame ${i + 1}/${count}`);
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
  ['valid/12-zinc-tetraammine-coordination.xyz', `${frame(zincTetraammine(), 'Tetraamminezinc model; expected 4 dashed Zn--N coordination bonds')}\n`],
  ['valid/13-zinc-tetraammine-breathing-10frames.trj', zincTrajectory(10)],
  ['invalid/01-bad-atom-count.xyz', '3\nClaims three atoms but contains two\nO 0 0 0\nH 0.95 0 0\n'],
  ['invalid/02-changed-atom-order.trj', '3\nframe 1\nO 0 0 0\nH 0.95 0 0\nH -0.24 0.93 0\n3\nframe 2 swaps atom order\nH 0.95 0 0\nO 0 0 0\nH -0.24 0.93 0\n'],
  ['invalid/03-nonnumeric-coordinate.xyz', '2\nBad coordinate\nH zero 0 0\nH 1 0 0\n'],
  ['invalid/04-zero-atoms.xyz', '0\nEmpty molecule\n'],
  ['invalid/05-kabsch-element-mismatch.xyz', '3\nSame count as water but incompatible element order\nN 0 0 0\nH 0.95 0 0\nH -0.24 0.93 0\n'],
  ['reaction/reactant.xyz', `${frame(reactionReactant, 'energy=-100.000000 hartree | SN2 reactant')}\n`],
  ['reaction/transition_state.xyz', `${frame(reactionTransition, 'energy=-99.980000 hartree | SN2 transition state')}\n`],
  ['reaction/product.xyz', `${frame(reactionProduct, 'energy=-100.010000 hartree | SN2 product')}\n`],
]);

for (const [relativePath, content] of files) {
  await writeFile(resolve(root, 'test-data', relativePath), content, 'utf8');
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
9. **Coordination bonds:** open \`12-zinc-tetraammine-coordination.xyz\`. Normal cutoff should detect four Zn–N contacts and render them slightly thinner than N–H covalent bonds. Each dashed bond is split at its midpoint and retains the normal Zn/N element colors. Use \`13-zinc-tetraammine-breathing-10frames.trj\` to verify that dashed bonds follow trajectory frames.
10. **Reaction mode:** select \`reaction/reactant.xyz\`, \`reaction/transition_state.xyz\`, and \`reaction/product.xyz\`. The energy strip should report a forward barrier of about 12.55 kcal/mol, reaction energy of about -6.28 kcal/mol, and reverse barrier of about 18.83 kcal/mol. C–Cl breaking is red, C–F formation is green, and surrounding atoms fade while C/Cl/F retain their element colors.

## Regenerate

From the extension root, run:

\`\`\`bash
npm run generate:test-data
\`\`\`

The \`.trj\` files intentionally contain multi-frame XYZ text, matching the first-version TRJ contract of the extension.
`;
await writeFile(resolve(root, 'test-data/README.md'), readme, 'utf8');

console.log(`Generated ${files.size} molecule fixtures in ${resolve(root, 'test-data')}`);
