const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Math3D = require('../media/math.js');

const root = path.resolve(__dirname, '../test-data');

test('all valid fixtures parse and every trajectory is internally consistent', () => {
  const files = fs.readdirSync(path.join(root, 'valid'));
  assert.equal(files.length, 13);
  for (const name of files) {
    const frames = Math3D.parseXYZ(fs.readFileSync(path.join(root, 'valid', name), 'utf8'), name);
    assert.ok(frames.length >= 1, name);
  }
});

test('coordination fixtures detect four Zn-N bonds and no Zn-H bonds', () => {
  const load = (name) => Math3D.parseXYZ(fs.readFileSync(path.join(root, 'valid', name), 'utf8'));
  for (const frames of [load('12-zinc-tetraammine-coordination.xyz'), load('13-zinc-tetraammine-breathing-10frames.trj')]) {
    for (const frame of frames) {
      const bonds = Math3D.findCoordinationBonds(frame.atoms);
      assert.equal(bonds.length, 4);
      assert.ok(bonds.every(({ metalIndex, donorIndex }) => frame.atoms[metalIndex].elem === 'Zn' && frame.atoms[donorIndex].elem === 'N'));
    }
  }
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
