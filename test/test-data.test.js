const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Math3D = require('../media/math.js');

const root = path.resolve(__dirname, '../test-data');

test('all valid fixtures parse and every trajectory is internally consistent', () => {
  const files = fs.readdirSync(path.join(root, 'valid'));
  assert.equal(files.length, 18);
  for (const name of files) {
    const frames = Math3D.parseXYZ(fs.readFileSync(path.join(root, 'valid', name), 'utf8'), name);
    assert.ok(frames.length >= 1, name);
  }
});

test('metal-contact fixtures infer four Zn-N contacts and no Zn-H contacts', () => {
  const load = (name) => Math3D.parseXYZ(fs.readFileSync(path.join(root, 'valid', name), 'utf8'));
  for (const frames of [load('12-zinc-tetraammine-coordination.xyz'), load('13-zinc-tetraammine-breathing-10frames.trj')]) {
    for (const frame of frames) {
      const bonds = Math3D.findMetalLigandContacts(frame.atoms);
      assert.equal(bonds.length, 4);
      assert.ok(bonds.every(({ metalIndex, donorIndex }) => frame.atoms[metalIndex].elem === 'Zn' && frame.atoms[donorIndex].elem === 'N'));
    }
  }
});

test('metal-containing pairs are not mislabeled as ordinary covalent bonds', () => {
  const atoms = [
    { elem: 'Fe', x: 0, y: 0, z: 0 },
    { elem: 'Fe', x: 2.2, y: 0, z: 0 },
    { elem: 'C', x: 0, y: 0, z: 2.0 },
    { elem: 'C', x: 0, y: 0, z: 3.4 },
  ];
  const bonds = Math3D.findCovalentBonds(atoms);
  assert.deepEqual(bonds.map(({ i, j }) => [i, j]), [[2, 3]]);
  assert.ok(bonds.every((bond) => bond.kind === 'covalent'));
});

test('metal-contact tracking uses hysteresis to avoid threshold flicker', () => {
  const frame = (distance) => ({ atoms: [
    { elem: 'Zn', x: 0, y: 0, z: 0 },
    { elem: 'N', x: distance, y: 0, z: 0 },
  ] });
  const tracked = Math3D.trackMetalLigandContacts([
    frame(2.54), frame(2.58), frame(2.71), frame(2.54),
  ]);
  assert.deepEqual(tracked.map((bonds) => bonds.length), [1, 1, 0, 1]);
});

test('reaction-center inference includes changing metal-ligand contacts', () => {
  const reactant = [
    { elem: 'Zn', x: 0, y: 0, z: 0 },
    { elem: 'N', x: 2.1, y: 0, z: 0 },
  ];
  const product = [
    { elem: 'Zn', x: 0, y: 0, z: 0 },
    { elem: 'N', x: 4.0, y: 0, z: 0 },
  ];
  const center = Math3D.findReactionCenter(reactant, product);
  assert.deepEqual(center.broken.map(({ i, j, kind }) => [i, j, kind]), [[0, 1, 'metalContact']]);
  assert.deepEqual(center.formed, []);
});

test('mixed Pt ligands are inferred without changing their contact type', () => {
  const atoms = Math3D.parseXYZ(fs.readFileSync(path.join(root, 'valid/14-cisplatin-ptcl2n2-core.xyz'), 'utf8'))[0].atoms;
  const contacts = Math3D.findMetalLigandContacts(atoms);
  assert.equal(contacts.length, 4);
  assert.deepEqual(
    contacts.map(({ donorIndex }) => atoms[donorIndex].elem).sort(),
    ['Cl', 'Cl', 'N', 'N'],
  );
});

test('Fe(CO)5 keeps Fe-C contacts separate from covalent C-O bonds', () => {
  const atoms = Math3D.parseXYZ(fs.readFileSync(path.join(root, 'valid/15-iron-pentacarbonyl.xyz'), 'utf8'))[0].atoms;
  for (const range of [1.20, 1.32, 1.48]) {
    const contacts = Math3D.findMetalLigandContacts(atoms, range);
    assert.equal(contacts.length, 5);
    assert.ok(contacts.every(({ metalIndex, donorIndex }) => atoms[metalIndex].elem === 'Fe' && atoms[donorIndex].elem === 'C'));
  }
  const covalent = Math3D.findCovalentBonds(atoms);
  assert.equal(covalent.length, 5);
  assert.ok(covalent.every(({ i, j }) => new Set([atoms[i].elem, atoms[j].elem]).size === 2
    && [atoms[i].elem, atoms[j].elem].includes('C')
    && [atoms[i].elem, atoms[j].elem].includes('O')));
});

test('metal-metal and metal-hydrogen policy fixtures remain unclassified', () => {
  for (const name of ['16-diiron-metal-contact.xyz', '17-iron-hydride-policy.xyz']) {
    const atoms = Math3D.parseXYZ(fs.readFileSync(path.join(root, 'valid', name), 'utf8'))[0].atoms;
    assert.deepEqual(Math3D.findMetalLigandContacts(atoms), [], name);
    assert.deepEqual(Math3D.findCovalentBonds(atoms), [], name);
  }
});

test('a dissociating ligand is retained briefly and then removed once', () => {
  const frames = Math3D.parseXYZ(fs.readFileSync(path.join(root, 'valid/18-zinc-ligand-dissociation-6frames.trj'), 'utf8'));
  const counts = Math3D.trackMetalLigandContacts(frames).map((contacts) => contacts.length);
  assert.deepEqual(counts, [4, 4, 4, 4, 3, 3]);
});

test('metal-contact inference is invariant to rigid translation and rotation', () => {
  const atoms = Math3D.parseXYZ(fs.readFileSync(path.join(root, 'valid/14-cisplatin-ptcl2n2-core.xyz'), 'utf8'))[0].atoms;
  const transformed = atoms.map((atom) => ({ ...atom, x: -atom.y + 8, y: atom.x - 3, z: atom.z + 5 }));
  const pairs = (items) => items.map(({ i, j }) => `${i}-${j}`);
  assert.deepEqual(pairs(Math3D.findMetalLigandContacts(transformed)), pairs(Math3D.findMetalLigandContacts(atoms)));
});

test('bond presentation hides only bonds that receive explicit dashed overlays', () => {
  const metalContacts = [{ i: 0, j: 1, kind: 'metalContact' }];
  const reactionBonds = [{ i: 0, j: 1 }, { i: 2, j: 3 }];
  const shown = Math3D.planBondPresentation(metalContacts, reactionBonds, true);
  assert.deepEqual(shown.hiddenBaseBonds.map(({ i, j }) => [i, j]), [[0, 1], [2, 3]]);
  assert.equal(shown.metalContactOverlays.length, 1);
  assert.equal(shown.reactionOverlays.length, 2);

  const hidden = Math3D.planBondPresentation(metalContacts, reactionBonds, false);
  assert.deepEqual(hidden.hiddenBaseBonds.map(({ i, j }) => [i, j]), [[0, 1], [2, 3]]);
  assert.deepEqual(hidden.metalContactOverlays, []);
  assert.equal(hidden.reactionOverlays.length, 2);
});

test('only the transition state receives reaction-bond overlays', () => {
  const names = ['reactant.xyz', 'product.xyz'];
  const [reactant, product] = names.map((name) => Math3D.parseXYZ(fs.readFileSync(path.join(root, 'reaction', name), 'utf8'))[0].atoms);
  const center = Math3D.findReactionCenter(reactant, product);
  assert.deepEqual(Math3D.reactionBondOverlays(center, 'reactant'), []);
  assert.deepEqual(Math3D.reactionBondOverlays(center, 'product'), []);
  assert.equal(Math3D.reactionBondOverlays(center, 'transitionState').length, 2);
});

test('reaction focus separates core, local shell, and distant context', () => {
  const atoms = [
    { elem: 'C', x: 0, y: 0, z: 0 },
    { elem: 'H', x: 1.1, y: 0, z: 0 },
    { elem: 'O', x: 2.4, y: 0, z: 0 },
    { elem: 'Cl', x: 3.2, y: 0, z: 0 },
  ];
  assert.deepEqual(Math3D.reactionFocusLayers(atoms, [0], 2.5), {
    core: [0], shell: [1, 2], context: [3],
  });
  assert.ok(Math3D.reactionHaloRadius('Cl') > Math3D.reactionHaloRadius('C'));
  assert.ok(Math3D.reactionHaloRadius('C') > 0.6);
});

test('rigid water fixture aligns to near-zero RMSD', () => {
  const load = (name) => Math3D.parseXYZ(fs.readFileSync(path.join(root, 'valid', name), 'utf8'))[0].atoms;
  const reference = load('01-water-reference.xyz');
  const mobile = load('02-water-rotated-translated.xyz');
  const aligned = Math3D.applyTransform([{ comment: '', atoms: mobile }], Math3D.kabschTransform(reference, mobile))[0].atoms;
  assert.ok(Math3D.rmsd(reference, aligned) < 1e-7);
});

test('malformed parser fixtures are rejected', () => {
  for (const name of ['01-bad-atom-count.xyz', '02-changed-atom-order.trj', '03-nonnumeric-coordinate.xyz', '04-zero-atoms.xyz']) {
    assert.throws(() => Math3D.parseXYZ(fs.readFileSync(path.join(root, 'invalid', name), 'utf8'), name), name);
  }
});

test('reaction fixtures expose energies, roles, barriers, and the expected bond changes', () => {
  const names = ['reactant.xyz', 'transition_state.xyz', 'product.xyz'];
  const files = names.map((name) => ({ name }));
  const roles = Math3D.inferReactionRoles(files);
  assert.deepEqual(roles, { reactant: 0, transitionState: 1, product: 2 });
  const frames = names.map((name) => Math3D.parseXYZ(fs.readFileSync(path.join(root, 'reaction', name), 'utf8'))[0]);
  const energies = frames.map((frame) => Math3D.parseEnergy(frame.comment));
  const profile = Math3D.reactionEnergetics(...energies);
  assert.ok(Math.abs(profile.forwardBarrier - 12.55018948) < 1e-6);
  assert.ok(Math.abs(profile.product + 6.27509474) < 1e-6);
  assert.ok(Math.abs(profile.reverseBarrier - 18.82528422) < 1e-6);
  const center = Math3D.findReactionCenter(frames[0].atoms, frames[2].atoms);
  assert.deepEqual(center.broken.map(({ i, j }) => [i, j]), [[0, 4]]);
  assert.deepEqual(center.formed.map(({ i, j }) => [i, j]), [[0, 5]]);
  assert.deepEqual(center.atomIndices, [0, 4, 5]);
});

test('reaction mechanism matrix infers every intended covalent and coordination change', () => {
  const cases = [
    {
      directory: 'proton-transfer',
      broken: [[0, 1, 'covalent']],
      formed: [[1, 2, 'covalent']],
      core: [0, 1, 2],
    },
    {
      directory: 'diels-alder',
      broken: [],
      formed: [[0, 4, 'covalent'], [3, 5, 'covalent']],
      core: [0, 3, 4, 5],
    },
    {
      directory: 'ring-opening',
      broken: [[0, 2, 'covalent']],
      formed: [],
      core: [0, 2],
    },
    {
      directory: 'ligand-substitution',
      broken: [[0, 1, 'metalContact']],
      formed: [[0, 3, 'metalContact']],
      core: [0, 1, 3],
    },
    {
      directory: 'reductive-elimination',
      broken: [[0, 1, 'metalContact'], [0, 2, 'metalContact']],
      formed: [[1, 2, 'covalent']],
      core: [0, 1, 2],
    },
  ];

  const names = ['reactant.xyz', 'transition_state.xyz', 'product.xyz'];
  assert.deepEqual(Math3D.inferReactionRoles(names.map((name) => ({ name }))), {
    reactant: 0, transitionState: 1, product: 2,
  });

  for (const reactionCase of cases) {
    const frames = names.map((name) => Math3D.parseXYZ(
      fs.readFileSync(path.join(root, 'reaction', reactionCase.directory, name), 'utf8'),
      `${reactionCase.directory}/${name}`,
    )[0]);
    const center = Math3D.findReactionCenter(frames[0].atoms, frames[2].atoms);
    const summarize = (bonds) => bonds.map(({ i, j, kind }) => [i, j, kind]);

    assert.deepEqual(summarize(center.broken), reactionCase.broken, `${reactionCase.directory}: broken bonds`);
    assert.deepEqual(summarize(center.formed), reactionCase.formed, `${reactionCase.directory}: formed bonds`);
    assert.deepEqual(center.atomIndices, reactionCase.core, `${reactionCase.directory}: core atoms`);
    assert.equal(
      Math3D.reactionBondOverlays(center, 'transitionState').length,
      reactionCase.broken.length + reactionCase.formed.length,
      `${reactionCase.directory}: transition-state overlays`,
    );
    assert.deepEqual(Math3D.reactionBondOverlays(center, 'reactant'), []);
    assert.deepEqual(Math3D.reactionBondOverlays(center, 'product'), []);

    const focus = Math3D.reactionFocusLayers(frames[1].atoms, center.atomIndices);
    assert.deepEqual(focus.core, reactionCase.core, `${reactionCase.directory}: focus core`);
    assert.equal(
      new Set([...focus.core, ...focus.shell, ...focus.context]).size,
      frames[1].atoms.length,
      `${reactionCase.directory}: focus partitions every atom`,
    );

    const energies = frames.map(({ comment }) => Math3D.parseEnergy(comment));
    assert.ok(energies.every((energy) => energy && Number.isFinite(energy.value)), `${reactionCase.directory}: energies`);
    const profile = Math3D.reactionEnergetics(...energies);
    assert.ok(profile.forwardBarrier > 0, `${reactionCase.directory}: positive forward barrier`);
  }
});
