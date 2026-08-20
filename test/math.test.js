const test = require('node:test');
const assert = require('node:assert/strict');
const Math3D = require('../media/math.js');

test('parses a multi-frame XYZ trajectory', () => {
  const frames = Math3D.parseXYZ('2\nfirst\nH 0 0 0\nO 1 0 0\n2\nsecond\nH 0 1 0\nO 1 1 0\n');
  assert.equal(frames.length, 2);
  assert.equal(frames[1].atoms[1].elem, 'O');
  assert.equal(frames[1].atoms[1].y, 1);
});

test('rejects frames whose atom order changes', () => {
  assert.throws(
    () => Math3D.parseXYZ('2\na\nH 0 0 0\nO 1 0 0\n2\nb\nO 0 0 0\nH 1 0 0\n'),
    /changes atom ordering/,
  );
});

test('Kabsch aligns a rotated and translated molecule', () => {
  const reference = [
    { elem: 'C', x: 0, y: 0, z: 0 },
    { elem: 'H', x: 1, y: 0, z: 0 },
    { elem: 'O', x: 0, y: 2, z: 0 },
    { elem: 'N', x: 0, y: 0, z: 3 },
  ];
  const mobile = reference.map((atom) => ({
    ...atom,
    x: -atom.y + 8,
    y: atom.x - 3,
    z: atom.z + 5,
  }));
  const transform = Math3D.kabschTransform(reference, mobile);
  const aligned = Math3D.applyTransform([{ comment: '', atoms: mobile }], transform)[0].atoms;
  assert.ok(Math3D.rmsd(reference, aligned) < 1e-7);
});

test('Kabsch rejects mismatched elements', () => {
  const reference = [{ elem: 'H', x: 0, y: 0, z: 0 }, { elem: 'O', x: 1, y: 0, z: 0 }];
  const mobile = [{ elem: 'H', x: 0, y: 0, z: 0 }, { elem: 'N', x: 1, y: 0, z: 0 }];
  assert.throws(() => Math3D.kabschTransform(reference, mobile), /Atom 2 differs/);
});
