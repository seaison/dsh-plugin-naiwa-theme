/** Clear only the light neutral matte connected to each frame's outer border. */
export function keySpriteBackground(pixels, width, height, cellWidth, cellHeight, columns, frames) {
  const length = cellWidth * cellHeight;
  const visited = new Uint8Array(length), queue = new Uint32Array(length);
  for (let frame = 0; frame < frames; frame++) {
    const left = frame % columns * cellWidth, top = Math.floor(frame / columns) * cellHeight;
    if (left + cellWidth > width || top + cellHeight > height) break;
    visited.fill(0); let first = 0, last = 0;
    const enqueue = index => {
      if (visited[index]) return;
      visited[index] = 1;
      const pixel = ((top + Math.floor(index / cellWidth)) * width + left + index % cellWidth) * 4;
      if (pixels[pixel] < 228 || pixels[pixel + 1] < 228 || pixels[pixel + 2] < 228) return;
      pixels[pixel + 3] = 0; queue[last++] = index;
    };
    for (let x = 0; x < cellWidth; x++) { enqueue(x); enqueue((cellHeight - 1) * cellWidth + x); }
    for (let y = 0; y < cellHeight; y++) { enqueue(y * cellWidth); enqueue(y * cellWidth + cellWidth - 1); }
    while (first < last) {
      const index = queue[first++], x = index % cellWidth, y = Math.floor(index / cellWidth);
      if (x > 0) enqueue(index - 1);
      if (x + 1 < cellWidth) enqueue(index + 1);
      if (y > 0) enqueue(index - cellWidth);
      if (y + 1 < cellHeight) enqueue(index + cellWidth);
    }
    // Feather just the outermost light pixels and remove their white spill.
    for (let y = 0; y < cellHeight; y++) for (let x = 0; x < cellWidth; x++) {
      const pixel = ((top + y) * width + left + x) * 4;
      if (!pixels[pixel + 3]) continue;
      const edge = x > 0 && !pixels[pixel - 1] || x + 1 < cellWidth && !pixels[pixel + 7] || y > 0 && !pixels[pixel - width * 4 + 3] || y + 1 < cellHeight && !pixels[pixel + width * 4 + 3];
      if (!edge) continue;
      const coverage = Math.min(1, Math.max(0, (238 - Math.min(pixels[pixel], pixels[pixel + 1], pixels[pixel + 2])) / 48));
      if (coverage >= 1) continue;
      for (let channel = 0; channel < 3; channel++) pixels[pixel + channel] = Math.max(0, (pixels[pixel + channel] - 255 * (1 - coverage)) / Math.max(.001, coverage));
      pixels[pixel + 3] = Math.round(255 * coverage);
    }
  }
  return pixels;
}

/** Play the short lead-in once, then repeat the laugh without returning to idle. */
export function spriteFrameAt(animation, elapsedMs) {
  const { durations, startFrame, loopFrame } = animation;
  let elapsed = Math.max(0, Number.isFinite(elapsedMs) ? elapsedMs : 0);
  const intro = durations.slice(startFrame).reduce((a, b) => a + b, 0);
  let start = startFrame;
  if (elapsed >= intro) {
    const loop = durations.slice(loopFrame).reduce((a, b) => a + b, 0);
    elapsed = loop > 0 ? (elapsed - intro) % loop : 0; start = loopFrame;
  }
  for (let index = start; index < durations.length; index++) {
    if (elapsed < durations[index]) return index;
    elapsed -= durations[index];
  }
  return start;
}
