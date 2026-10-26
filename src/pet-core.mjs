/** Face into the chat and keep both cloud views inside the window. */
export function placePetCloud(position, petSize, viewport, reaction = false) {
  const mirrored = position.left < (position.minX + position.maxX) / 2;
  const width = Math.min(268, Math.max(1, viewport.width - 24));
  const height = Math.min(reaction ? 222 : 120, Math.max(1, viewport.height - 48));
  const wantedLeft = mirrored ? position.left + petSize - 42 : position.left + 42 - width;
  const left = Math.max(12, Math.min(viewport.width - width - 12, wantedLeft));
  const top = Math.max(24, Math.min(viewport.height - height - 24, position.top + 25 - height));
  const pointer = Math.max(22, Math.min(width - 22, position.left + (mirrored ? petSize - 15 : 15) - left));
  return { mirrored, left: left - position.left, top: top - position.top, width, height, pointer };
}

/** Uniform choice across the collection, excluding the last visible reaction. */
export function nextPetReaction(previous, count, random = Math.random) {
  if (count < 1) return null;
  if (count === 1) return 0;
  const exclude = Number.isInteger(previous) && previous >= 0 && previous < count;
  const index = Math.min(count - (exclude ? 2 : 1), Math.max(0, Math.floor(random() * (count - (exclude ? 1 : 0)))));
  return exclude && index >= previous ? index + 1 : index;
}
