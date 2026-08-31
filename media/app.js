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
      molecule.coordinationByFrame = ReactionMath.trackMetalLigandContacts(molecule.frames, cutoff);
      molecule.model = molecule.viewer.addModelsAsFrames(ReactionMath.toXYZ(molecule.frames), 'xyz');
      removeOverlayBondsFromModel(molecule);
      const focusReactionCenter = Boolean(reaction && reactionCenterToggle.checked && reaction.center.atomIndices.length);
      molecule.reactionFocus = focusReactionCenter
        ? ReactionMath.reactionFocusLayers(molecule.frames[0].atoms, reaction.center.atomIndices)
        : null;
      const contextOpacity = focusReactionCenter ? 0.07 : 1;
      molecule.viewer.setStyle({}, {
        stick: { radius: 0.18, opacity: contextOpacity },
        sphere: { scale: 0.28, opacity: contextOpacity },
      });
      applyReactionFocusStyle(molecule);
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
      ? `Metal contacts · ${count} inferred contact${count === 1 ? '' : 's'} shown`
      : 'Metal contacts hidden';
  }

  function reactionOverlayBonds(molecule) {
    if (!reaction || !reactionCenterToggle.checked || !molecule.reactionRole) return [];
    return ReactionMath.reactionBondOverlays(reaction.center, molecule.reactionRole);
  }

  function removeOverlayBondsFromModel(molecule) {
    const state = molecule.model.getInternalState();
    state.frames.forEach((atoms, frameIndex) => {
      const presentation = ReactionMath.planBondPresentation(
        molecule.coordinationByFrame[frameIndex] || [],
        reactionOverlayBonds(molecule),
        coordinationToggle.checked,
      );
      presentation.hiddenBaseBonds.forEach(({ i, j }) => {
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
    const presentation = ReactionMath.planBondPresentation(
      molecule.coordinationByFrame[frameIndex] || [],
      reactionOverlayBonds(molecule),
      coordinationToggle.checked,
    );
    const pairs = presentation.metalContactOverlays;
    if (pairs.length) {
      const atoms = molecule.frames[frameIndex].atoms;
      pairs.forEach(({ i, j }) => {
        const focusReactionCenter = Boolean(reaction && reactionCenterToggle.checked && reaction.center.atomIndices.length);
        const touchesCore = focusReactionCenter && molecule.reactionFocus.core.some((index) => index === i || index === j);
        const touchesShell = focusReactionCenter && molecule.reactionFocus.shell.some((index) => index === i || index === j);
        const opacity = !focusReactionCenter || touchesCore ? 1 : touchesShell ? 0.34 : 0.07;
        addElementColoredDashedBond(molecule.viewer, atoms[i], atoms[j], opacity, 0.14);
      });
    }
    presentation.reactionOverlays.forEach(({ i, j }) => {
      addElementColoredDashedBond(molecule.viewer, molecule.frames[frameIndex].atoms[i], molecule.frames[frameIndex].atoms[j], 1, 0.16);
    });
    drawReactionFocusHalos(molecule, frameIndex);
    const frameCount = molecule.frames.length;
    const atomCount = molecule.frames[0].atoms.length;
    const coordText = coordinationToggle.checked ? ` · ${pairs.length} metal contact${pairs.length === 1 ? '' : 's'}` : '';
    molecule.meta.textContent = `${frameCount} frame${frameCount === 1 ? '' : 's'} · ${atomCount} atoms${coordText}`;
  }

  function addElementColoredDashedBond(viewer, atomA, atomB, opacity = 1, radius = 0.14) {
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
        radius,
        color: index < dashCount / 2 ? colorA : colorB,
        opacity,
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
      <div class="reaction-legend"><span><i class="legend-dot center"></i>reaction center</span><span><i class="legend-dot context"></i>faded context</span></div>`;
    reactionSummary.hidden = false;
  }

  function formatSigned(value) {
    const normalized = Math.abs(value) < 0.005 ? 0 : value;
    return `${normalized > 0 ? '+' : ''}${normalized.toFixed(2)}`;
  }

  function applyReactionFocusStyle(molecule) {
    if (!molecule.reactionFocus) return;
    if (molecule.reactionFocus.shell.length) {
      molecule.model.setStyle(
        { index: molecule.reactionFocus.shell },
        {
          stick: { radius: 0.18, opacity: 0.34 },
          sphere: { scale: 0.29, opacity: 0.30 },
        },
        true,
      );
    }
    molecule.model.setStyle(
      { index: molecule.reactionFocus.core },
      {
        stick: { radius: 0.21, opacity: 1 },
        sphere: { scale: 0.36, opacity: 1 },
      },
      true,
    );
  }

  function drawReactionFocusHalos(molecule, frameIndex) {
    if (!molecule.reactionFocus) return;
    const atoms = molecule.frames[frameIndex].atoms;
    molecule.reactionFocus.core.forEach((index) => {
      const atom = atoms[index];
      if (!atom) return;
      const radius = ReactionMath.reactionHaloRadius(atom.elem);
      molecule.viewer.addSphere({
        center: { x: atom.x, y: atom.y, z: atom.z },
        radius,
        color: 0xffd166,
        opacity: 0.46,
        wireframe: true,
        quality: 1,
      });
      molecule.viewer.addSphere({
        center: { x: atom.x, y: atom.y, z: atom.z },
        radius: radius + 0.10,
        color: 0xffe29a,
        opacity: 0.10,
        wireframe: true,
        quality: 1,
      });
    });
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
