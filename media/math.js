(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ReactionMath = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function parseXYZ(text, name = 'molecule.xyz') {
    const lines = text.replace(/\r/g, '').split('\n');
    const frames = [];
    let cursor = 0;
    while (cursor < lines.length) {
      while (cursor < lines.length && !lines[cursor].trim()) cursor++;
      if (cursor >= lines.length) break;
      const count = Number(lines[cursor].trim());
      if (!Number.isInteger(count) || count <= 0) {
        throw new Error(`${name}: expected a positive atom count at line ${cursor + 1}`);
      }
      const startLine = cursor + 1;
      cursor++;
      if (cursor >= lines.length) throw new Error(`${name}: missing comment line after line ${startLine}`);
      const comment = lines[cursor++];
      const atoms = [];
      for (let i = 0; i < count; i++, cursor++) {
        if (cursor >= lines.length) throw new Error(`${name}: incomplete frame starting at line ${startLine}`);
        const parts = lines[cursor].trim().split(/\s+/);
        if (parts.length < 4) throw new Error(`${name}: invalid atom at line ${cursor + 1}`);
        const xyz = parts.slice(1, 4).map(Number);
        if (!xyz.every(Number.isFinite)) throw new Error(`${name}: invalid coordinates at line ${cursor + 1}`);
        atoms.push({ elem: normalizeElement(parts[0]), x: xyz[0], y: xyz[1], z: xyz[2] });
      }
      frames.push({ comment, atoms });
    }
    if (!frames.length) throw new Error(`${name}: no XYZ frames found`);
    const atomCount = frames[0].atoms.length;
    const elements = frames[0].atoms.map((atom) => atom.elem).join(',');
    frames.forEach((frame, index) => {
      if (frame.atoms.length !== atomCount) throw new Error(`${name}: frame ${index + 1} has a different atom count`);
      if (frame.atoms.map((atom) => atom.elem).join(',') !== elements) {
        throw new Error(`${name}: frame ${index + 1} changes atom ordering`);
      }
    });
    return frames;
  }

  function normalizeElement(value) {
    const match = String(value).match(/[A-Za-z]+/);
    if (!match) throw new Error(`Invalid element symbol: ${value}`);
    const letters = match[0];
    return letters[0].toUpperCase() + letters.slice(1).toLowerCase();
  }

  function centroid(atoms) {
    const sum = atoms.reduce((acc, atom) => [acc[0] + atom.x, acc[1] + atom.y, acc[2] + atom.z], [0, 0, 0]);
    return sum.map((value) => value / atoms.length);
  }

  function centeredFrames(frames) {
    return frames.map((frame) => {
      const c = centroid(frame.atoms);
      return {
        comment: frame.comment,
        atoms: frame.atoms.map((atom) => ({ ...atom, x: atom.x - c[0], y: atom.y - c[1], z: atom.z - c[2] })),
      };
    });
  }

  // Horn's quaternion solution computes the same optimal proper rotation as Kabsch SVD.
  function kabschTransform(referenceAtoms, mobileAtoms) {
    if (referenceAtoms.length !== mobileAtoms.length || referenceAtoms.length < 2) {
      throw new Error('Kabsch alignment needs matching atom counts (at least 2 atoms).');
    }
    const mismatch = referenceAtoms.findIndex((atom, i) => atom.elem !== mobileAtoms[i].elem);
    if (mismatch >= 0) throw new Error(`Atom ${mismatch + 1} differs (${referenceAtoms[mismatch].elem} vs ${mobileAtoms[mismatch].elem}).`);
    const refCenter = centroid(referenceAtoms);
    const mobCenter = centroid(mobileAtoms);
    const h = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (let i = 0; i < referenceAtoms.length; i++) {
      const p = [mobileAtoms[i].x - mobCenter[0], mobileAtoms[i].y - mobCenter[1], mobileAtoms[i].z - mobCenter[2]];
      const q = [referenceAtoms[i].x - refCenter[0], referenceAtoms[i].y - refCenter[1], referenceAtoms[i].z - refCenter[2]];
      for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) h[row][col] += p[row] * q[col];
    }
    const [sxx, sxy, sxz] = h[0];
    const [syx, syy, syz] = h[1];
    const [szx, szy, szz] = h[2];
    const n = [
      [sxx + syy + szz, syz - szy, szx - sxz, sxy - syx],
      [syz - szy, sxx - syy - szz, sxy + syx, szx + sxz],
      [szx - sxz, sxy + syx, -sxx + syy - szz, syz + szy],
      [sxy - syx, szx + sxz, syz + szy, -sxx - syy + szz],
    ];
    const quaternion = largestEigenvectorSymmetric(n);
    const rotation = quaternionToMatrix(quaternion);
    return { rotation, mobileCenter: mobCenter, referenceCenter: refCenter };
  }

  function largestEigenvectorSymmetric(matrix) {
    // Shifted power iteration remains stable when the largest algebraic eigenvalue is not largest by magnitude.
    const bound = Math.max(...matrix.map((row, i) => row.reduce((sum, value, j) => sum + (i === j ? 0 : Math.abs(value)), Math.abs(row[i]))));
    let vector = [1, 0.37, -0.19, 0.11];
    for (let iteration = 0; iteration < 300; iteration++) {
      const next = matrix.map((row, i) => row.reduce((sum, value, j) => sum + value * vector[j], bound * vector[i]));
      const norm = Math.hypot(...next);
      if (norm < 1e-14) return [1, 0, 0, 0];
      vector = next.map((value) => value / norm);
    }
    return vector;
  }

  function quaternionToMatrix([w, x, y, z]) {
    return [
      [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
      [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
      [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
    ];
  }

  function applyTransform(frames, transform) {
    const { rotation: r, mobileCenter: m, referenceCenter: c } = transform;
    return frames.map((frame) => ({
      comment: frame.comment,
      atoms: frame.atoms.map((atom) => {
        const p = [atom.x - m[0], atom.y - m[1], atom.z - m[2]];
        return {
          ...atom,
          x: r[0][0] * p[0] + r[0][1] * p[1] + r[0][2] * p[2] + c[0],
          y: r[1][0] * p[0] + r[1][1] * p[1] + r[1][2] * p[2] + c[1],
          z: r[2][0] * p[0] + r[2][1] * p[1] + r[2][2] * p[2] + c[2],
        };
      }),
    }));
  }

  function toXYZ(frames) {
    return frames.map((frame) => [
      frame.atoms.length,
      frame.comment || 'Reaction Viewer',
      ...frame.atoms.map((atom) => `${atom.elem} ${atom.x.toFixed(8)} ${atom.y.toFixed(8)} ${atom.z.toFixed(8)}`),
    ].join('\n')).join('\n');
  }

  function rmsd(referenceAtoms, mobileAtoms) {
    const sum = referenceAtoms.reduce((acc, atom, i) => {
      const other = mobileAtoms[i];
      return acc + (atom.x - other.x) ** 2 + (atom.y - other.y) ** 2 + (atom.z - other.z) ** 2;
    }, 0);
    return Math.sqrt(sum / referenceAtoms.length);
  }

  const covalentRadii = {
    H: 0.31, B: 0.85, C: 0.76, N: 0.71, O: 0.66, F: 0.57, Si: 1.11, P: 1.07, S: 1.05, Cl: 1.02,
    As: 1.19, Se: 1.20, Br: 1.20, I: 1.39, Li: 1.28, Be: 0.96, Na: 1.66, Mg: 1.41, Al: 1.21,
    K: 2.03, Ca: 1.76, Sc: 1.70, Ti: 1.60, V: 1.53, Cr: 1.39, Mn: 1.39, Fe: 1.32, Co: 1.26, Ni: 1.24,
    Cu: 1.32, Zn: 1.22, Ga: 1.22, Rb: 2.20, Sr: 1.95, Y: 1.90, Zr: 1.75, Nb: 1.64, Mo: 1.54, Tc: 1.47,
    Ru: 1.46, Rh: 1.42, Pd: 1.39, Ag: 1.45, Cd: 1.44, In: 1.42, Sn: 1.39, Cs: 2.44, Ba: 2.15, La: 2.07,
    Ce: 2.04, Pr: 2.03, Nd: 2.01, Sm: 1.98, Eu: 1.98, Gd: 1.96, Tb: 1.94, Dy: 1.92, Ho: 1.92, Er: 1.89,
    Tm: 1.90, Yb: 1.87, Lu: 1.87, Hf: 1.75, Ta: 1.70, W: 1.62, Re: 1.51, Os: 1.44, Ir: 1.41, Pt: 1.36,
    Au: 1.36, Hg: 1.32, Tl: 1.45, Pb: 1.46, Bi: 1.48, Th: 2.06, U: 1.96,
  };

  const metals = new Set([
    'Li', 'Be', 'Na', 'Mg', 'Al', 'K', 'Ca', 'Sc', 'Ti', 'V', 'Cr', 'Mn', 'Fe', 'Co', 'Ni', 'Cu', 'Zn', 'Ga',
    'Rb', 'Sr', 'Y', 'Zr', 'Nb', 'Mo', 'Tc', 'Ru', 'Rh', 'Pd', 'Ag', 'Cd', 'In', 'Sn', 'Cs', 'Ba', 'La', 'Ce',
    'Pr', 'Nd', 'Pm', 'Sm', 'Eu', 'Gd', 'Tb', 'Dy', 'Ho', 'Er', 'Tm', 'Yb', 'Lu', 'Hf', 'Ta', 'W', 'Re', 'Os',
    'Ir', 'Pt', 'Au', 'Hg', 'Tl', 'Pb', 'Bi', 'Fr', 'Ra', 'Ac', 'Th', 'Pa', 'U', 'Np', 'Pu',
  ]);
  const donorElements = new Set(['B', 'C', 'N', 'O', 'F', 'Si', 'P', 'S', 'Cl', 'As', 'Se', 'Br', 'I']);

  function findCoordinationBonds(atoms, cutoffScale = 1.32) {
    const bonds = [];
    for (let i = 0; i < atoms.length; i++) {
      for (let j = i + 1; j < atoms.length; j++) {
        const iMetal = metals.has(atoms[i].elem);
        const jMetal = metals.has(atoms[j].elem);
        if (iMetal === jMetal) continue;
        const metalIndex = iMetal ? i : j;
        const donorIndex = iMetal ? j : i;
        if (!donorElements.has(atoms[donorIndex].elem)) continue;
        const dx = atoms[i].x - atoms[j].x;
        const dy = atoms[i].y - atoms[j].y;
        const dz = atoms[i].z - atoms[j].z;
        const distance = Math.hypot(dx, dy, dz);
        const metalRadius = covalentRadii[atoms[metalIndex].elem] || 1.45;
        const donorRadius = covalentRadii[atoms[donorIndex].elem] || 0.8;
        const cutoff = Math.min(3.4, cutoffScale * (metalRadius + donorRadius));
        if (distance >= 0.5 && distance <= cutoff) bonds.push({ i, j, metalIndex, donorIndex, distance });
      }
    }
    return bonds;
  }

  function findCovalentBonds(atoms, cutoffScale = 1.22) {
    const bonds = [];
    for (let i = 0; i < atoms.length; i++) {
      for (let j = i + 1; j < atoms.length; j++) {
        if (metals.has(atoms[i].elem) !== metals.has(atoms[j].elem)) continue;
        const dx = atoms[i].x - atoms[j].x;
        const dy = atoms[i].y - atoms[j].y;
        const dz = atoms[i].z - atoms[j].z;
        const distance = Math.hypot(dx, dy, dz);
        const radiusI = covalentRadii[atoms[i].elem] || 0.77;
        const radiusJ = covalentRadii[atoms[j].elem] || 0.77;
        if (distance >= 0.45 && distance <= cutoffScale * (radiusI + radiusJ)) bonds.push({ i, j, distance });
      }
    }
    return bonds;
  }

  function findReactionCenter(reactantAtoms, productAtoms) {
    if (reactantAtoms.length !== productAtoms.length) throw new Error('Reaction-center detection needs matching atom counts.');
    const mismatch = reactantAtoms.findIndex((atom, index) => atom.elem !== productAtoms[index].elem);
    if (mismatch >= 0) throw new Error(`Reaction atom ${mismatch + 1} differs (${reactantAtoms[mismatch].elem} vs ${productAtoms[mismatch].elem}).`);
    const key = ({ i, j }) => `${Math.min(i, j)}-${Math.max(i, j)}`;
    const reactant = new Map(findCovalentBonds(reactantAtoms).map((bond) => [key(bond), bond]));
    const product = new Map(findCovalentBonds(productAtoms).map((bond) => [key(bond), bond]));
    const broken = [...reactant].filter(([bondKey]) => !product.has(bondKey)).map(([, bond]) => bond);
    const formed = [...product].filter(([bondKey]) => !reactant.has(bondKey)).map(([, bond]) => bond);
    const atomIndices = [...new Set([...broken, ...formed].flatMap(({ i, j }) => [i, j]))].sort((a, b) => a - b);
    return { broken, formed, atomIndices };
  }

  function parseEnergy(comment) {
    const text = String(comment || '');
    const labeled = text.match(/(?:\benergy\b|\bE(?:\([^)]*\))?)\s*[:=]\s*([-+]?\d+(?:\.\d*)?(?:[Ee][-+]?\d+)?)/i);
    if (!labeled) return null;
    const value = Number(labeled[1]);
    if (!Number.isFinite(value)) return null;
    const tail = text.slice((labeled.index || 0) + labeled[0].length).toLowerCase();
    let unit = 'unknown';
    let kcalFactor = 1;
    if (/\b(?:hartree|hartrees|ha|a\.?u\.?)\b/.test(tail)) { unit = 'hartree'; kcalFactor = 627.509474; }
    else if (/\bev\b/.test(tail)) { unit = 'eV'; kcalFactor = 23.060548; }
    else if (/\bkj\s*\/?\s*mol(?:e)?\b/.test(tail)) { unit = 'kJ/mol'; kcalFactor = 0.239005736; }
    else if (/\bkcal\s*\/?\s*mol(?:e)?\b/.test(tail)) { unit = 'kcal/mol'; kcalFactor = 1; }
    return { value, unit, kcalMol: unit === 'unknown' ? null : value * kcalFactor };
  }

  function inferReactionRoles(files) {
    if (!Array.isArray(files) || files.length !== 3) return null;
    const roles = {};
    for (let index = 0; index < files.length; index++) {
      const name = String(files[index].name || '').toLowerCase().replace(/\.[^.]+$/, '');
      let role = null;
      if (/(?:^|[_\-\s])(transition[_\-\s]*state|ts)(?:$|[_\-\s])/.test(`_${name}_`) || name === 'transition_state') role = 'transitionState';
      else if (/(?:reactant|reactants|reagent)/.test(name)) role = 'reactant';
      else if (/(?:product|products)/.test(name)) role = 'product';
      if (role && roles[role] === undefined) roles[role] = index;
    }
    if (roles.reactant === undefined || roles.transitionState === undefined || roles.product === undefined) return null;
    return roles;
  }

  function reactionEnergetics(reactantEnergy, transitionEnergy, productEnergy) {
    if (!reactantEnergy || !transitionEnergy || !productEnergy) return null;
    const allKnown = [reactantEnergy, transitionEnergy, productEnergy].every((energy) => energy.kcalMol !== null);
    if (allKnown) {
      return {
        unit: 'kcal/mol',
        reactant: 0,
        transitionState: transitionEnergy.kcalMol - reactantEnergy.kcalMol,
        product: productEnergy.kcalMol - reactantEnergy.kcalMol,
        forwardBarrier: transitionEnergy.kcalMol - reactantEnergy.kcalMol,
        reverseBarrier: transitionEnergy.kcalMol - productEnergy.kcalMol,
      };
    }
    if (![reactantEnergy, transitionEnergy, productEnergy].every((energy) => energy.unit === 'unknown')) return null;
    return {
      unit: 'energy units',
      reactant: 0,
      transitionState: transitionEnergy.value - reactantEnergy.value,
      product: productEnergy.value - reactantEnergy.value,
      forwardBarrier: transitionEnergy.value - reactantEnergy.value,
      reverseBarrier: transitionEnergy.value - productEnergy.value,
    };
  }

  return {
    parseXYZ, centeredFrames, kabschTransform, applyTransform, toXYZ, rmsd,
    findCoordinationBonds, findCovalentBonds, findReactionCenter,
    parseEnergy, inferReactionRoles, reactionEnergetics,
  };
});
