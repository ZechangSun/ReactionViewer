(function () {
  'use strict';

  const data = JSON.parse(document.getElementById('moleculeData').textContent);
  const viewersRoot = document.getElementById('viewers');
  const errorBox = document.getElementById('error');
  const status = document.getElementById('status');
  const playButton = document.getElementById('playButton');
  const slider = document.getElementById('frameSlider');
  const frameLabel = document.getElementById('frameLabel');
  const speedSelect = document.getElementById('speedSelect');
  const coordinationToggle = document.getElementById('coordinationToggle');
  const coordinationCutoff = document.getElementById('coordinationCutoff');
  const reactionCenterToggle = document.getElementById('reactionCenterToggle');
  const reactionSummary = document.getElementById('reactionSummary');
  let molecules = [];
  let timer = null;
  let currentFrame = 0;
  let reaction = null;

  try {
    molecules = data.map((file, index) => {
      const originalFrames = ReactionMath.parseXYZ(file.content, file.name);
      const shell = document.createElement('section');
      shell.className = 'viewer-shell';
      shell.innerHTML = `<div class="viewer-title"><span>${escapeHtml(file.name)}</span><span class="viewer-meta"></span></div><div class="viewer-canvas" id="viewer-${index}"></div>`;
      viewersRoot.appendChild(shell);
      const viewer = $3Dmol.createViewer(shell.querySelector('.viewer-canvas'), { backgroundColor: '#10151d', antialias: true });
      return { file, originalFrames, frames: originalFrames, viewer, model: null, coordinationByFrame: [], meta: shell.querySelector('.viewer-meta') };
    });

    setupReactionMode();
    rebuildModels(true);
    linkViews();
    updateTimeline();
    status.textContent = reaction
      ? `Reaction mode · ${reaction.center.broken.length} broken · ${reaction.center.formed.length} formed`
      : `${molecules.length} molecule${molecules.length === 1 ? '' : 's'} · linked rotation`;
  } catch (error) {
    showError(error);
  }

  document.getElementById('centerButton').addEventListener('click', () => {
    stop();
    try {
      molecules.forEach((molecule) => { molecule.frames = ReactionMath.centeredFrames(molecule.originalFrames); });
      rebuildModels(true);
      status.textContent = 'Each trajectory centered per frame';
      clearError();
    } catch (error) { showError(error); }
  });

  document.getElementById('alignButton').addEventListener('click', () => {
    stop();
    try {
      const reference = molecules[0].originalFrames[0].atoms;
      molecules[0].frames = ReactionMath.centeredFrames(molecules[0].originalFrames);
      const centeredReference = molecules[0].frames[0].atoms;
      const results = ['reference'];
      for (let i = 1; i < molecules.length; i++) {
        const transform = ReactionMath.kabschTransform(reference, molecules[i].originalFrames[0].atoms);
        const aligned = ReactionMath.applyTransform(molecules[i].originalFrames, transform);
        molecules[i].frames = ReactionMath.centeredFrames(aligned);
        results.push(`RMSD ${ReactionMath.rmsd(centeredReference, molecules[i].frames[0].atoms).toFixed(4)} Å`);
      }
      rebuildModels(true);
      status.textContent = molecules.length === 1 ? 'Centered (add another molecule for Kabsch)' : `Kabsch: ${results.slice(1).join(' · ')}`;
      clearError();
    } catch (error) { showError(error); }
  });

  document.getElementById('resetButton').addEventListener('click', () => {
    stop();
    molecules.forEach((molecule) => { molecule.frames = molecule.originalFrames; });
    rebuildModels(true);
    status.textContent = 'Original coordinates restored';
    clearError();
  });

  playButton.addEventListener('click', () => timer ? stop() : play());
  slider.addEventListener('input', () => { stop(); void setFrame(Number(slider.value)); });
  speedSelect.addEventListener('change', () => { if (timer) { stop(); play(); } });
  coordinationToggle.addEventListener('change', refreshCoordinationMode);
  coordinationCutoff.addEventListener('change', refreshCoordinationMode);
  reactionCenterToggle.addEventListener('change', () => {
    stop();
    rebuildModels(false);
    status.textContent = reactionCenterToggle.checked ? 'Reaction center highlighted' : 'Reaction-center highlight hidden';
  });
  window.addEventListener('resize', () => molecules.forEach((molecule) => molecule.viewer.resize()));

  function rebuildModels(zoom) {
    const cutoff = Number(coordinationCutoff.value);
    molecules.forEach((molecule) => {
      molecule.viewer.removeAllModels();
      molecule.viewer.removeAllShapes();
      molecule.coordinationByFrame = molecule.frames.map((frame) => ReactionMath.findCoordinationBonds(frame.atoms, cutoff));
      molecule.model = molecule.viewer.addModelsAsFrames(ReactionMath.toXYZ(molecule.frames), 'xyz');
      if (coordinationToggle.checked) removeCoordinationFromModel(molecule);
      const focusReactionCenter = Boolean(reaction && reactionCenterToggle.checked && reaction.center.atomIndices.length);
      const contextOpacity = focusReactionCenter ? 0.34 : 1;
      molecule.viewer.setStyle({}, {
        stick: { radius: 0.18, opacity: contextOpacity },
        sphere: { scale: 0.28, opacity: contextOpacity },
      });
      applyReactionCenterStyle(molecule);
      drawSceneOverlays(molecule, 0);
      if (zoom) molecule.viewer.zoomTo();
      molecule.viewer.render();
    });
    currentFrame = 0;
    updateTimeline();
  }

  function linkViews() {
    // Complete linkage means dragging any panel updates all the others; 3Dmol prevents relink recursion internally.
    molecules.forEach((source, i) => molecules.forEach((target, j) => {
      if (i !== j) source.viewer.linkViewer(target.viewer);
    }));
  }

  function maxFrames() {
    return Math.max(1, ...molecules.map((molecule) => molecule.frames.length));
  }

  async function setFrame(frame) {
    const total = maxFrames();
    currentFrame = ((frame % total) + total) % total;
    await Promise.all(molecules.map((molecule) => molecule.model.setFrame(currentFrame % molecule.frames.length)));
    molecules.forEach((molecule) => {
      drawSceneOverlays(molecule, currentFrame % molecule.frames.length);
      molecule.viewer.render();
    });
    slider.value = String(currentFrame);
    frameLabel.textContent = `${currentFrame + 1} / ${total}`;
  }

  function updateTimeline() {
    const total = maxFrames();
    slider.max = String(total - 1);
    slider.value = String(Math.min(currentFrame, total - 1));
    slider.disabled = total === 1;
    playButton.disabled = total === 1;
    frameLabel.textContent = `${Math.min(currentFrame, total - 1) + 1} / ${total}`;
  }

  function play() {
    if (maxFrames() <= 1) return;
    playButton.textContent = '⏸ Pause';
    timer = window.setInterval(() => { void setFrame(currentFrame + 1); }, Number(speedSelect.value));
  }

  function stop() {
    if (timer) window.clearInterval(timer);
    timer = null;
    playButton.textContent = '▶ Play';
  }

  function refreshCoordinationMode() {
    stop();
    rebuildModels(false);
    const count = molecules.reduce((sum, molecule) => sum + molecule.coordinationByFrame[0].length, 0);
    status.textContent = coordinationToggle.checked
      ? `Coordination mode · ${count} metal–donor bond${count === 1 ? '' : 's'} detected`
      : 'Coordination mode off · 3Dmol automatic bonds shown';
  }

  function removeCoordinationFromModel(molecule) {
    const state = molecule.model.getInternalState();
    state.frames.forEach((atoms, frameIndex) => {
      const pairs = molecule.coordinationByFrame[frameIndex] || [];
      pairs.forEach(({ i, j }) => {
        removeBond(atoms[i], j);
        removeBond(atoms[j], i);
      });
    });
    molecule.model.setInternalState(state);
    void molecule.model.setFrame(0);
  }

  function removeBond(atom, bondedIndex) {
    if (!atom || !Array.isArray(atom.bonds)) return;
    for (let position = atom.bonds.length - 1; position >= 0; position--) {
      if (atom.bonds[position] !== bondedIndex) continue;
      atom.bonds.splice(position, 1);
      if (Array.isArray(atom.bondOrder)) atom.bondOrder.splice(position, 1);
      if (Array.isArray(atom.bondStyles)) atom.bondStyles.splice(position, 1);
    }
  }

  function drawSceneOverlays(molecule, frameIndex) {
    molecule.viewer.removeAllShapes();
    const pairs = coordinationToggle.checked ? molecule.coordinationByFrame[frameIndex] || [] : [];
    if (pairs.length) {
      const atoms = molecule.frames[frameIndex].atoms;
      pairs.forEach(({ i, j }) => {
        addRoundedCoordinationBond(molecule.viewer, atoms[i], atoms[j]);
      });
    }
    drawReactionCenter(molecule, frameIndex);
    const frameCount = molecule.frames.length;
    const atomCount = molecule.frames[0].atoms.length;
    const coordText = coordinationToggle.checked ? ` · ${pairs.length} coord.` : '';
    molecule.meta.textContent = `${frameCount} frame${frameCount === 1 ? '' : 's'} · ${atomCount} atoms${coordText}`;
  }

  function addRoundedCoordinationBond(viewer, atomA, atomB) {
    const defaultColors = $3Dmol.elementColors && $3Dmol.elementColors.defaultColors;
    const colorA = defaultColors && defaultColors[atomA.elem] !== undefined ? defaultColors[atomA.elem] : 0xcccccc;
    const colorB = defaultColors && defaultColors[atomB.elem] !== undefined ? defaultColors[atomB.elem] : 0xcccccc;
    const dx = atomB.x - atomA.x;
    const dy = atomB.y - atomA.y;
    const dz = atomB.z - atomA.z;
    const length = Math.hypot(dx, dy, dz);
    // Use an even number of centered capsules so the middle gap is also the element-color boundary.
    const estimatedCount = Math.max(4, Math.round(length / 0.5));
    const dashCount = estimatedCount % 2 === 0 ? estimatedCount : estimatedCount + 1;
    // Rounded caps visually extend each segment, so a generous geometric gap keeps capsules distinct.
    const dashFraction = 0.32;
    for (let index = 0; index < dashCount; index++) {
      const startT = (index + 0.5 - dashFraction / 2) / dashCount;
      const endT = (index + 0.5 + dashFraction / 2) / dashCount;
      viewer.addCylinder({
        start: { x: atomA.x + dx * startT, y: atomA.y + dy * startT, z: atomA.z + dz * startT },
        end: { x: atomA.x + dx * endT, y: atomA.y + dy * endT, z: atomA.z + dz * endT },
        radius: 0.14,
        color: index < dashCount / 2 ? colorA : colorB,
        fromCap: 2,
        toCap: 2,
      });
    }
  }

  function setupReactionMode() {
    const roles = ReactionMath.inferReactionRoles(data);
    if (!roles) return;
    try {
      const center = ReactionMath.findReactionCenter(
        molecules[roles.reactant].originalFrames[0].atoms,
        molecules[roles.product].originalFrames[0].atoms,
      );
      const energies = {
        reactant: ReactionMath.parseEnergy(molecules[roles.reactant].originalFrames[0].comment),
        transitionState: ReactionMath.parseEnergy(molecules[roles.transitionState].originalFrames[0].comment),
        product: ReactionMath.parseEnergy(molecules[roles.product].originalFrames[0].comment),
      };
      reaction = {
        roles,
        center,
        energies,
        energetics: ReactionMath.reactionEnergetics(energies.reactant, energies.transitionState, energies.product),
      };
      molecules.forEach((molecule, index) => {
        molecule.reactionRole = Object.keys(roles).find((role) => roles[role] === index) || null;
      });
      reactionCenterToggle.disabled = center.atomIndices.length === 0;
      reactionCenterToggle.checked = center.atomIndices.length > 0;
      renderReactionSummary();
    } catch (error) {
      reaction = null;
      reactionCenterToggle.disabled = true;
      status.textContent = `Reaction mode unavailable: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  function renderReactionSummary() {
    if (!reaction) return;
    const values = reaction.energetics;
    const unit = values ? values.unit : '';
    const energyText = (role) => {
      if (values) return `${formatSigned(values[role])} ${unit}`;
      const energy = reaction.energies[role];
      if (!energy) return 'energy missing';
      return `${energy.value.toFixed(6)} ${energy.unit === 'unknown' ? '' : energy.unit}`.trim();
    };
    const metrics = values
      ? `<div class="barrier-metrics"><span>Forward ΔE‡ <b>${formatSigned(values.forwardBarrier)} ${unit}</b></span><span>Reaction ΔE <b>${formatSigned(values.product)} ${unit}</b></span><span>Reverse ΔE‡ <b>${formatSigned(values.reverseBarrier)} ${unit}</b></span></div>`
      : '<div class="barrier-metrics"><span>Add <b>energy=VALUE UNIT</b> to all three XYZ comment lines</span></div>';
    reactionSummary.innerHTML = `
      <div class="energy-step"><span class="role">Reactant</span><strong>${energyText('reactant')}</strong></div>
      <span class="energy-arrow">→</span>
      <div class="energy-step ts"><span class="role">Transition state</span><strong>${energyText('transitionState')}</strong></div>
      <span class="energy-arrow">→</span>
      <div class="energy-step"><span class="role">Product</span><strong>${energyText('product')}</strong></div>
      ${metrics}
      <div class="reaction-legend"><span><i class="legend-dot broken"></i>broken</span><span><i class="legend-dot formed"></i>formed</span><span><i class="legend-dot center"></i>focused atoms</span></div>`;
    reactionSummary.hidden = false;
  }

  function formatSigned(value) {
    const normalized = Math.abs(value) < 0.005 ? 0 : value;
    return `${normalized > 0 ? '+' : ''}${normalized.toFixed(2)}`;
  }

  function applyReactionCenterStyle(molecule) {
    if (!reaction || !reactionCenterToggle.checked || !reaction.center.atomIndices.length) return;
    molecule.model.setStyle(
      { index: reaction.center.atomIndices },
      {
        stick: { radius: 0.2, opacity: 0.96 },
        sphere: { scale: 0.33, opacity: 0.96 },
      },
      true,
    );
  }

  function drawReactionCenter(molecule, frameIndex) {
    if (!reaction || !reactionCenterToggle.checked || !molecule.reactionRole) return;
    const atoms = molecule.frames[frameIndex].atoms;
    if (molecule.reactionRole === 'reactant') {
      reaction.center.broken.forEach((bond) => addReactionBond(molecule.viewer, atoms, bond, 0xff5d67, false));
    } else if (molecule.reactionRole === 'product') {
      reaction.center.formed.forEach((bond) => addReactionBond(molecule.viewer, atoms, bond, 0x44d17a, false));
    } else if (molecule.reactionRole === 'transitionState') {
      reaction.center.broken.forEach((bond) => addReactionBond(molecule.viewer, atoms, bond, 0xff5d67, true));
      reaction.center.formed.forEach((bond) => addReactionBond(molecule.viewer, atoms, bond, 0x44d17a, true));
    }
  }

  function addReactionBond(viewer, atoms, bond, color, dashed) {
    const atomA = atoms[bond.i];
    const atomB = atoms[bond.j];
    if (!atomA || !atomB) return;
    if (!dashed) {
      viewer.addCylinder({
        start: { x: atomA.x, y: atomA.y, z: atomA.z },
        end: { x: atomB.x, y: atomB.y, z: atomB.z },
        radius: 0.23,
        color,
        opacity: 0.88,
        fromCap: 2,
        toCap: 2,
      });
      return;
    }
    const dx = atomB.x - atomA.x;
    const dy = atomB.y - atomA.y;
    const dz = atomB.z - atomA.z;
    const dashCount = 4;
    for (let index = 0; index < dashCount; index++) {
      const startT = (index + 0.30) / dashCount;
      const endT = (index + 0.70) / dashCount;
      viewer.addCylinder({
        start: { x: atomA.x + dx * startT, y: atomA.y + dy * startT, z: atomA.z + dz * startT },
        end: { x: atomA.x + dx * endT, y: atomA.y + dy * endT, z: atomA.z + dz * endT },
        radius: 0.17,
        color,
        fromCap: 2,
        toCap: 2,
      });
    }
  }

  function showError(error) {
    stop();
    errorBox.textContent = error instanceof Error ? error.message : String(error);
    errorBox.hidden = false;
    status.textContent = 'Unable to render';
  }

  function clearError() { errorBox.hidden = true; }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
  }
})();
