import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { ARTWORKS, tokensFor } from '../src/catalog.mjs';
import { MUSEUM_ICON_SVG } from '../src/museum-icon.mjs';
import { createNotes } from '../src/notes.mjs';
import { createNoteStore, placeStickyNote } from '../src/notes-core.mjs';
import { createPlugin } from '../src/client.mjs';
import { createPetFeatures } from '../src/pet.mjs';
import { createExperience } from '../src/experience.mjs';
import { createLocalMediaStore, inspectWallpaper } from '../src/media.mjs';
import { FROG_QUOTES, pickFrogQuote, startupTiming } from '../src/experience-core.mjs';
import { createAudioClip } from '../src/audio.mjs';
import { createGameMusic } from '../src/music.mjs';
import { createFocusClock } from '../src/focus-core.mjs';
import { createFocusFeatures } from '../src/focus.mjs';
import { keySpriteBackground, spriteFrameAt } from '../src/animation-core.mjs';
import { placePetCloud, nextPetReaction } from '../src/pet-core.mjs';
import { peakInfo, createMergeGame, createJigsaw, jigsawPath, placeJigsawPiece, placePetMenu } from '../src/game-core.mjs';

const root = new URL('../', import.meta.url);
const manifest = [];
const catalog = [];
for (const a of ARTWORKS) {
  const data = await readFile(new URL('wallpapers/' + a.file, root));
  if (data.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('Artwork is not a PNG: ' + a.file);
  const sha256 = createHash('sha256').update(data).digest('hex');
  manifest.push({ folder: 'wallpapers', file: a.file, sha256, bytes: data.length, width: data.readUInt32BE(16), height: data.readUInt32BE(20) });
  catalog.push({ ...a, tokens: tokensFor(a), url: '/naiwa-theme/assets/' + a.file + '?v=' + sha256.slice(0, 12) });
}
const assets = {};
for (const key of ['pet-idle', 'pet-laugh', 'pet-focus-states', 'puzzle-white-ballet', 'puzzle-black-runway', 'puzzle-twin-divas']) {
  const file = key + '.png';
  const data = await readFile(new URL('assets/' + file, root));
  if (data.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('Invalid pet artwork: ' + file);
  const sha256 = createHash('sha256').update(data).digest('hex');
  manifest.push({ folder: 'assets', file, sha256, bytes: data.length, width: data.readUInt32BE(16), height: data.readUInt32BE(20) });
  assets[key] = { url: '/naiwa-theme/assets/' + file + '?v=' + sha256.slice(0, 12) };
}
const animation = JSON.parse(await readFile(new URL('media/pet-laugh-animation.json', root), 'utf8'));
if (animation.frames !== animation.durations.length || animation.durations.some(ms => !(ms > 0)) || animation.startFrame >= animation.frames || animation.loopFrame >= animation.frames) throw new Error('Invalid pet animation timing');
for (const [key, file] of [['startup', 'startup.mp4'], ['startup-poster', 'startup-poster.jpg'], ['pet-laugh-audio', 'pet-laugh.mp3'], ['startup-piano', 'startup-piano.m4a'], ['pet-animation', animation.file]]) {
  const data = await readFile(new URL('media/' + file, root));
  const sha256 = createHash('sha256').update(data).digest('hex');
  manifest.push({ folder: 'media', file, sha256, bytes: data.length });
  assets[key] = { ...(key === 'pet-animation' ? animation : {}), url: '/naiwa-theme/assets/' + file + '?v=' + sha256.slice(0, 12) };
}
assets.reactions = [];
const reactions = JSON.parse(await readFile(new URL('media/reactions.json', root), 'utf8'));
for (const reaction of reactions) {
  const data = await readFile(new URL('media/' + reaction.file, root));
  if (!['GIF87a', 'GIF89a'].includes(data.subarray(0, 6).toString())) throw new Error('Invalid reaction GIF: ' + reaction.file);
  const sha256 = createHash('sha256').update(data).digest('hex');
  if (sha256 !== reaction.sha256) throw new Error('Reaction differs from supplied original: ' + reaction.file);
  manifest.push({ folder: 'media', file: reaction.file, sha256, bytes: data.length, width: data.readUInt16LE(6), height: data.readUInt16LE(8) });
  assets.reactions.push({ id: reaction.id, url: '/naiwa-theme/assets/' + reaction.file + '?v=' + sha256.slice(0, 12) });
}
const museumIcon = 'data:image/svg+xml,' + encodeURIComponent(MUSEUM_ICON_SVG);
const css = `body[data-naiwa-theme] { --naiwa-museum-icon: url("${museumIcon}"); }\n` + await readFile(new URL('src/theme.css', root), 'utf8') + '\n' + await readFile(new URL('src/pet.css', root), 'utf8') + '\n' + await readFile(new URL('src/experience.css', root), 'utf8') + '\n' + await readFile(new URL('src/notes.css', root), 'utf8') + '\n' + await readFile(new URL('src/focus.css', root), 'utf8');
const extras = `{createFocusClock:(${createFocusClock.toString()}),createFocusFeatures:(${createFocusFeatures.toString()}),createNoteStore:(${createNoteStore.toString()}),createNotes:(${createNotes.toString()}),museumIcon:${JSON.stringify(museumIcon)},createExperience:(${createExperience.toString()}),createMediaStore:(${createLocalMediaStore.toString()}),inspectWallpaper:(${inspectWallpaper.toString()}),assets:${JSON.stringify(assets)}, createFeatures:(${createPetFeatures.toString()}), core:{createGameMusic:(${createGameMusic.toString()}),placeStickyNote:(${placeStickyNote.toString()}),placePetCloud:(${placePetCloud.toString()}),nextPetReaction:(${nextPetReaction.toString()}),quotes:${JSON.stringify(FROG_QUOTES)},pickQuote:(${pickFrogQuote.toString()}),startupTiming:(${startupTiming.toString()}),createAudioClip:(${createAudioClip.toString()}),keySpriteBackground:(${keySpriteBackground.toString()}),spriteFrameAt:(${spriteFrameAt.toString()}),placePetMenu:(${placePetMenu.toString()}),createJigsaw:(${createJigsaw.toString()}),jigsawPath:(${jigsawPath.toString()}),placeJigsawPiece:(${placeJigsawPiece.toString()}),peakInfo:(${peakInfo.toString()}),createMergeGame:(${createMergeGame.toString()})}}`;
const outputs = new Map([
  ['lib/client.js', `/* Generated by scripts/build.mjs. Edit src/ instead. */\nwindow.__ModuleLoader__.load({\n  id: 'dsh-plugin-naiwa-theme',\n  factory(require) {\n    return (${createPlugin.toString()})(require('react'), ${JSON.stringify(catalog)}, ${JSON.stringify(css)}, ${extras});\n  }\n});\n`],
  ['lib/manifest.json', JSON.stringify(manifest, null, 2) + '\n']
]);
if (process.argv.includes('--check')) {
  for (const [path, expected] of outputs) {
    if (await readFile(new URL(path, root), 'utf8') !== expected) throw new Error(path + ' is stale; run npm run build');
  }
  console.log('Client bundle, manifest and all asset hashes are up to date.');
} else {
  await mkdir(new URL('lib/', root), { recursive: true });
  for (const [path, content] of outputs) await writeFile(new URL(path, root), content);
  console.log('Built eight native DSH themes, local wallpaper import and startup film. No runtime downloads.');
}
