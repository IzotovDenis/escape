// Pose timing and the articulated stride share simulation time, so pausing
// cannot advance either the painted actions or the running limbs.
const SLIDE_SECONDS = .85;
const SLIDE_ENTRY = .18;
const SLIDE_EXIT = .18;
const SLIDE_HOLD_END = SLIDE_SECONDS - SLIDE_EXIT;
const SLIDE_RECOVERY_SECONDS = .12;
const TRANSITION_SECONDS = .1;
const JUMP_ENTRY_SECONDS = .065;
const SLIDE_TRANSITION_SECONDS = .035;
const LANDING_SECONDS = .16;
const MENU = ['menu0', 'menu1', 'menu2', 'menu3'];
const JUMP = ['jump0', 'jump1', 'jump2'];

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
const dominant = pose => pose.mix < .5 ? pose.from : pose.to;

function sample(poses, progress, loop = false) {
  const position = loop ? progress % poses.length : clamp(progress, 0, poses.length - 1);
  const index = Math.floor(position);
  return {
    from: poses[index],
    to: poses[loop ? (index + 1) % poses.length : Math.min(index + 1, poses.length - 1)],
    mix: smooth(position - index),
  };
}

// One upright leg tuck, then exactly the same motion played backwards. The
// shared phase is continuous at the apex and does not stop at every key pose.
// Brief straight-leg holds give takeoff/landing blends a stable target.
export function sampleRedJump(progress) {
  const p = clamp(progress);
  const lead = JUMP_ENTRY_SECONDS / .9;
  const phase = smooth((Math.min(p, 1 - p) - lead) / (.5 - lead)) * (JUMP.length - 1);
  const index = Math.floor(phase);
  return { from: JUMP[index], to: JUMP[Math.min(index + 1, JUMP.length - 1)], mix: phase - index };
}

// These anchors control action handoffs. Continuous running is drawn by the
// articulated illustration using runCycle, without blending these images.
export function sampleRedRun(cycle) {
  return { from: 'run0', to: 'run4', mix: (1 - Math.cos(cycle * Math.PI * 2)) / 2 };
}

function slidingPose(elapsed, repeat, entryLead, side, startMix) {
  const entryTime = elapsed + (repeat ? repeat.entryStart : 0);
  let position;
  if (elapsed >= SLIDE_HOLD_END) {
    // Rise through exactly the same poses and timing as the dive, backwards.
    position = 3 * smooth((SLIDE_SECONDS - elapsed - entryLead) / (SLIDE_ENTRY - entryLead));
  } else if (repeat?.restoreFrom != null) {
    position = repeat.restoreFrom + (3 - repeat.restoreFrom) * smooth(elapsed / SLIDE_RECOVERY_SECONDS);
  } else {
    if (entryTime < entryLead) {
      return {
        pose: { from: 'run0', to: 'run4', mix: startMix + (side - startMix) * smooth(entryTime / entryLead) },
        position: 0,
      };
    }
    position = 3 * smooth((entryTime - entryLead) / (SLIDE_ENTRY - entryLead));
  }
  const route = [side ? 'run4' : 'run0', 'action12', 'action13', 'action14'];
  const index = Math.floor(position);
  return {
    pose: { from: route[index], to: route[Math.min(index + 1, 3)], mix: position - index },
    position,
  };
}

export function createRedRunnerMotion() {
  let initialized, mode, runPhase, menuPhase, lean, landingRemaining;
  let transition, slideRepeat, slideEntryLead, lastSlideElapsed, lastSlidePosition, output;
  let slideSide, slideStartMix, slideStartBounce, slideStartCycle, slideAnchorCycle;

  function reset() {
    initialized = false;
    mode = 'run';
    runPhase = menuPhase = lean = landingRemaining = 0;
    transition = slideRepeat = null;
    slideEntryLead = lastSlideElapsed = lastSlidePosition = slideSide = slideStartMix = slideStartBounce = 0;
    slideStartCycle = slideAnchorCycle = 0;
    output = { from: 'run0', to: 'run0', mix: 0, bounce: 0, lean: 0, slideBlend: 0, landing: 0, runCycle: 0 };
  }

  function update(dt, state) {
    // Position and visibility remain the caller's responsibility. All visual
    // clocks, including cross-action blends and landing recovery, stop here.
    if (initialized && !state.moving) return { ...output };
    const step = state.moving ? Math.max(0, finite(dt)) : 0;
    const nextMode = state.menu ? 'menu' : state.slide ? 'slide' : state.jumping ? 'jump' : 'run';
    const changed = initialized && nextMode !== mode;
    const elapsed = clamp(finite(state.slideProgress)) * SLIDE_SECONDS;
    landingRemaining = Math.max(0, landingRemaining - step);

    if (changed) {
      transition = {
        from: dominant(output), fromSlide: output.slideBlend, elapsed: 0,
        runCycle: output.runCycle,
        duration: nextMode === 'slide' ? SLIDE_TRANSITION_SECONDS : nextMode === 'jump' ? JUMP_ENTRY_SECONDS : TRANSITION_SECONDS,
        target: nextMode === 'jump' ? 'jump0' : nextMode === 'menu' ? 'menu0' : 'run0',
      };
      if (nextMode === 'slide') {
        const fromStride = mode === 'run' && output.from === 'run0' && output.to === 'run4';
        slideStartMix = fromStride ? output.mix : 0;
        slideStartBounce = fromStride ? output.bounce : 0;
        slideSide = slideStartMix >= .5 ? 1 : 0;
        slideStartCycle = output.runCycle;
        slideAnchorCycle = Math.round(slideStartCycle * 2) / 2;
        // Keep the complete in-between stride when entering the slide. Picking
        // only its dominant sprite used to snap the feet on the first frame.
        if (fromStride) transition = null;
        else transition.target = slideSide ? 'run4' : 'run0';
      }
      if (mode === 'jump' && nextMode === 'run') landingRemaining = LANDING_SECONDS;
      if (nextMode !== 'run') landingRemaining = 0;
      if (nextMode === 'jump' || nextMode === 'slide') runPhase = 0;
      if (mode === 'slide' && nextMode === 'run') {
        runPhase = slideSide / 2;
        transition.target = slideSide ? 'run4' : 'run0';
        if (lastSlidePosition < .02) transition = null;
      }
    }
    if (nextMode === 'slide') {
      if (mode !== 'slide' || !initialized) {
        slideRepeat = null;
        slideEntryLead = changed ? SLIDE_TRANSITION_SECONDS : 0;
        lastSlidePosition = 0;
      } else if (elapsed + 1e-6 < lastSlideElapsed) {
        const completedEntry = Math.min(SLIDE_ENTRY, lastSlideElapsed + (slideRepeat ? slideRepeat.entryStart : 0));
        slideRepeat = {
          entryStart: completedEntry,
          restoreFrom: lastSlideElapsed >= SLIDE_HOLD_END || slideRepeat?.restoreFrom != null ? lastSlidePosition : null,
        };
        // A repeated down retraces the current folded posture rather than
        // restarting the dive or resetting the silhouette/body height.
      }
      lastSlideElapsed = elapsed;
    }
    mode = nextMode;

    const rate = 13 + (clamp(finite(state.speed, 16), 16, 34) - 16) * .18;
    // Keep a fixed stride anchor during cross-action blends. A finished slide
    // already matches its stride anchor and can immediately resume running.
    if (mode === 'run' && !transition) runPhase = (runPhase + step * rate / 8) % 1;
    if (mode === 'menu') menuPhase = (menuPhase + step * 3.2) % MENU.length;
    const leanTarget = mode === 'menu' || mode === 'slide' ? 0 : clamp(-finite(state.laneError) * .055, -.12, .12);
    lean += (leanTarget - lean) * (1 - Math.exp(-step * 14));

    let pose, slideBlend = 0;
    if (mode === 'menu') pose = sample(MENU, menuPhase, true);
    else if (mode === 'jump') pose = sampleRedJump(finite(state.jumpProgress));
    else if (mode === 'slide') {
      const slide = slidingPose(elapsed, slideRepeat, slideEntryLead, slideSide, slideStartMix);
      pose = slide.pose;
      lastSlidePosition = slide.position;
      slideBlend = slide.position / 3;
    } else pose = sampleRedRun(runPhase);

    if (transition) {
      transition.elapsed += step;
      if (transition.elapsed + 1e-8 >= transition.duration) transition = null;
      else {
        // A short cross-action blend uses the previous dominant pose, keeping
        // the shader to two samples instead of stacking four translucent limbs.
        const weight = smooth(transition.elapsed / transition.duration);
        pose = { from: transition.from, to: transition.target ?? dominant(pose), mix: weight };
        slideBlend = transition.fromSlide + (slideBlend - transition.fromSlide) * weight;
      }
    }
    const bounce = mode === 'run' ? .025 * (1 - Math.cos(runPhase * Math.PI * 4))
      : mode === 'slide' && slideEntryLead > 0
        ? slideStartBounce * (1 - smooth((elapsed + (slideRepeat?.entryStart ?? 0)) / slideEntryLead)) : 0;
    const runCycle = mode === 'slide'
      ? slideStartCycle + (slideAnchorCycle - slideStartCycle) * (slideEntryLead > 0
        ? smooth((elapsed + (slideRepeat?.entryStart ?? 0)) / slideEntryLead) : 1)
      : transition && /^run/.test(transition.from) ? transition.runCycle : runPhase;
    output = {
      ...pose,
      bounce,
      lean,
      slideBlend,
      landing: smooth(landingRemaining / LANDING_SECONDS),
      runCycle,
    };
    initialized = true;
    return { ...output };
  }

  reset();
  return { reset, update };
}
