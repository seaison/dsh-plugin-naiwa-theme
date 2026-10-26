/** Pure game and pricing-clock logic, also embedded in the browser bundle. */
export function peakInfo(timestamp = Date.now(), extraHolidays = []) {
  // Beijing time; weekends stay off-peak even when they are make-up workdays.
  const ranges = [['2026-01-01', '2026-01-03'], ['2026-02-15', '2026-02-23'], ['2026-04-04', '2026-04-06'], ['2026-05-01', '2026-05-05'], ['2026-06-19', '2026-06-21'], ['2026-09-25', '2026-09-27'], ['2026-10-01', '2026-10-07']];
  const offset = 8 * 3600000;
  const classify = time => {
    const d = new Date(time + offset);
    const day = d.toISOString().slice(0, 10);
    const holiday = extraHolidays.includes(day) || ranges.some(([start, end]) => day >= start && day <= end) || day.endsWith('-01-01');
    const weekend = d.getUTCDay() === 0 || d.getUTCDay() === 6;
    const mins = d.getUTCHours() * 60 + d.getUTCMinutes();
    const peak = !weekend && !holiday && ((mins >= 540 && mins < 720) || (mins >= 840 && mins < 1080));
    return { peak, holiday, weekend, day, minutes: mins, calendarKnown: d.getUTCFullYear() === 2026 };
  };
  const current = classify(timestamp);
  const midnight = Math.floor((timestamp + offset) / 86400000) * 86400000 - offset;
  let next = null;
  for (let day = 0; day < 10 && !next; day++) {
    for (const hour of [0, 9, 12, 14, 18, 24]) {
      const t = midnight + day * 86400000 + hour * 3600000;
      if (t > timestamp && classify(t).peak !== current.peak) { next = t; break; }
    }
  }
  return { ...current, next, remaining: next ? Math.max(0, next - timestamp) : 0, label: current.peak ? '高峰时段' : '谷地时段', reason: current.holiday ? '节假日全天空闲' : current.weekend ? '周末全天空闲' : '北京时间' };
}

/** Complementary edges, scattered pieces and snap placement for a physical jigsaw. */
export function createJigsaw(size, random = Math.random) {
  const cell = 420 / size;
  const pieces = [];
  const rng = () => Math.max(0, Math.min(0.999999, random()));
  const slots = [];
  const spacing = cell + 18;
  for (let y = 25; y < 680 - cell; y += spacing) {
    for (let x = 22; x < 960 - cell; x += spacing) {
      if (x + cell + 18 < 270 || x - 18 > 690 || y + cell + 18 < 110 || y - 18 > 530) slots.push({ x, y });
    }
  }
  for (let col = 0; col < size; col++) {
    slots.push({ x: 270 + col * cell, y: 680 - cell * 1.24 });
    slots.push({ x: 270 + col * cell, y: cell * .24 });
  }
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1)); [slots[i], slots[j]] = [slots[j], slots[i]];
  }
  for (let row = 0; row < size; row++) for (let col = 0; col < size; col++) {
    const id = row * size + col;
    const slot = slots[id % slots.length];
    pieces.push({ id, row, col, cell,
      edges: [row ? -pieces[id - size].edges[2] : 0, col < size - 1 ? (rng() < 0.5 ? 1 : -1) : 0, row < size - 1 ? (rng() < 0.5 ? 1 : -1) : 0, col ? -pieces[id - 1].edges[1] : 0],
      x: Math.max(cell * 0.22, Math.min(960 - cell * 1.22, slot.x + (rng() - 0.5) * 12)),
      y: Math.max(cell * 0.22, Math.min(680 - cell * 1.22, slot.y + (rng() - 0.5) * 12)),
      rotation: (rng() - 0.5) * 20, placed: false
    });
  }
  return pieces;
}

export function jigsawPath(piece) {
  const s = piece.cell;
  let path = 'M 0 0';
  const edge = (x, y, ux, uy, nx, ny, sign) => {
    const pt = (a, b) => `${(x + ux * a * s + nx * b * sign * s).toFixed(3)} ${(y + uy * a * s + ny * b * sign * s).toFixed(3)}`;
    if (!sign) { path += ' L ' + pt(1, 0); return; }
    path += ' L ' + pt(.35, 0);
    path += ' C ' + pt(.41, 0) + ' ' + pt(.42, .03) + ' ' + pt(.4, .08);
    path += ' C ' + pt(.32, .24) + ' ' + pt(.68, .24) + ' ' + pt(.6, .08);
    path += ' C ' + pt(.58, .03) + ' ' + pt(.59, 0) + ' ' + pt(.65, 0);
    path += ' L ' + pt(1, 0);
  };
  edge(0, 0, 1, 0, 0, -1, piece.edges[0]);
  edge(s, 0, 0, 1, 1, 0, piece.edges[1]);
  edge(s, s, -1, 0, 0, 1, piece.edges[2]);
  edge(0, s, 0, -1, -1, 0, piece.edges[3]);
  return path + ' Z';
}

export function placeJigsawPiece(piece, x, y) {
  if (piece.placed) return piece;
  const targetX = 270 + piece.col * piece.cell, targetY = 110 + piece.row * piece.cell;
  if (Math.hypot(x - targetX, y - targetY) <= piece.cell * .3) return { ...piece, x: targetX, y: targetY, rotation: 0, placed: true };
  const margin = piece.cell * .22;
  return { ...piece, x: Math.max(margin, Math.min(960 - piece.cell - margin, x)), y: Math.max(margin, Math.min(680 - piece.cell - margin, y)), rotation: 0 };
}

export function createMergeGame(random = Math.random) {
  const radii = [14, 18, 24, 31, 39, 48, 59, 71, 84, 98, 114];
  const state = { width: 360, height: 500, items: [], score: 0, maxLevel: 0, next: 0, over: false, won: false, time: 0, cooldown: 0, danger: 0 };
  let id = 0;
  const choose = () => Math.max(0, Math.min(3, Math.floor(random() * 4)));
  state.next = choose();
  const spawn = (level, x, y) => ({ id: ++id, level, x, y, vx: 0, vy: 0, angle: 0, spin: 0, born: state.time, r: radii[level] });
  function drop(x) {
    if (state.over || state.cooldown > 0 || !Number.isFinite(x)) return false;
    const r = radii[state.next];
    state.maxLevel = Math.max(state.maxLevel, state.next);
    const body = spawn(state.next, Math.min(state.width - r, Math.max(r, x)), 35);
    body.vy = 35; state.items.push(body);
    state.next = choose(); state.cooldown = 0.45;
    return true;
  }
  const boundaries = b => {
    if (b.x < b.r) { b.x = b.r; if (b.vx < 0) b.vx *= -.18; }
    if (b.x > state.width - b.r) { b.x = state.width - b.r; if (b.vx > 0) b.vx *= -.18; }
    if (b.y > state.height - b.r) {
      b.y = state.height - b.r;
      if (b.vy > 0) b.vy = b.vy > 70 ? -b.vy * .12 : 0;
      b.vx *= .96; b.spin *= .95;
    }
  };
  function step(dt) {
    if (state.over || !Number.isFinite(dt) || dt <= 0) return;
    dt = Math.min(dt, 1 / 20);
    state.time += dt; state.cooldown = Math.max(0, state.cooldown - dt);
    // Small integration steps plus iterative contact solving prevent fast drops
    // and dense piles from tunnelling through each other or the container.
    const substeps = Math.ceil(dt * 180), tick = dt / substeps, fresh = new Set();
    for (let sub = 0; sub < substeps; sub++) {
      for (const b of state.items) {
        b.vy += 850 * tick; b.vx *= Math.exp(-.7 * tick);
        b.x += b.vx * tick; b.y += b.vy * tick;
        b.angle = (b.angle || 0) + (b.spin || 0) * tick;
        boundaries(b);
      }
      for (let pass = 0; pass < 18; pass++) {
        const removed = new Set(), merged = [];
        for (let i = 0; i < state.items.length; i++) for (let j = i + 1; j < state.items.length; j++) {
          const a = state.items[i], b = state.items[j];
          if (removed.has(a.id) || removed.has(b.id)) continue;
          const dx = b.x - a.x, dy = b.y - a.y, distance = Math.hypot(dx, dy);
          const overlap = a.r + b.r - distance;
          if (overlap < -.005) continue;
          if (a.level === b.level && a.level < radii.length - 1 && !fresh.has(a.id) && !fresh.has(b.id)) {
            removed.add(a.id); removed.add(b.id);
            const level = a.level + 1, c = spawn(level, (a.x + b.x) / 2, (a.y + b.y) / 2);
            c.vx = (a.vx + b.vx) / 2; c.vy = Math.min(0, (a.vy + b.vy) / 2) - 25;
            boundaries(c); merged.push(c); fresh.add(c.id);
            state.score += 10 * 2 ** level; state.maxLevel = Math.max(state.maxLevel, level);
            if (level === radii.length - 1) state.won = true;
            continue;
          }
          const nx = distance > .001 ? dx / distance : (a.id < b.id ? 1 : -1), ny = distance > .001 ? dy / distance : 0;
          const ia = 1 / (a.r * a.r), ib = 1 / (b.r * b.r), inv = ia + ib;
          const correction = Math.max(0, overlap - .002) * .98 / inv;
          a.x -= nx * correction * ia; a.y -= ny * correction * ia;
          b.x += nx * correction * ib; b.y += ny * correction * ib;
          const speed = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
          if (speed < 0) {
            const impulse = -(speed < -70 ? 1.12 : 1) * speed / inv;
            a.vx -= impulse * nx * ia; a.vy -= impulse * ny * ia;
            b.vx += impulse * nx * ib; b.vy += impulse * ny * ib;
            const tangent = (b.vx - a.vx) * -ny + (b.vy - a.vy) * nx;
            const friction = Math.max(-impulse * .18, Math.min(impulse * .18, -tangent / inv));
            a.vx += ny * friction * ia; a.vy -= nx * friction * ia;
            b.vx -= ny * friction * ib; b.vy += nx * friction * ib;
            a.spin = a.vx / a.r; b.spin = b.vx / b.r;
          }
        }
        if (removed.size) state.items = state.items.filter(b => !removed.has(b.id)).concat(merged);
        for (const b of state.items) boundaries(b);
      }
    }
    const blocked = state.items.some(b => state.time - b.born > 2.5 && b.y - b.r < 74 && Math.abs(b.vy) < 80);
    state.danger = blocked ? state.danger + dt : 0;
    if (state.danger > 2) state.over = true;
  }
  function reset() {
    Object.assign(state, { items: [], score: 0, maxLevel: 0, next: choose(), over: false, won: false, time: 0, cooldown: 0, danger: 0 });
  }
  return { state, radii, drop, step, reset, spawn };
}

/** Context-menu placement: flip at edges and keep the mascot unobscured. */
export function placePetMenu(anchor, pet, viewport, box) {
  const gap = 12, width = box.width, height = box.height;
  let left = anchor.x + gap, top = anchor.y + 8;
  if (left + width > viewport.width - gap) left = anchor.x - width - gap;
  if (top + height > viewport.height - gap) top = anchor.y - height - 8;
  const intersects = () => left < pet.right + 4 && left + width > pet.left - 4 && top < pet.bottom + 4 && top + height > pet.top - 4;
  if (intersects()) {
    if (pet.left >= width + gap * 2) left = pet.left - width - gap;
    else if (viewport.width - pet.right >= width + gap * 2) left = pet.right + gap;
  }
  return { left: Math.max(gap, Math.min(viewport.width - width - gap, left)), top: Math.max(gap, Math.min(viewport.height - height - gap, top)) };
}
