"""Decode a user GIF into an unchanged RGB frame atlas for the canvas renderer."""
import hashlib
import json
import shutil
import sys
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parent.parent
source = Path(sys.argv[1])
image = Image.open(source)
width, height = image.size
columns = 10
count = image.n_frames
atlas = Image.new('RGB', (columns * width, ((count + columns - 1) // columns) * height), 'white')
durations = []
for index in range(count):
    image.seek(index)
    # GIF disposal/compositing is resolved by Pillow. No matte or art is changed.
    frame = image.convert('RGB')
    atlas.paste(frame, ((index % columns) * width, (index // columns) * height))
    durations.append(image.info.get('duration', 70))
atlas.save(root / 'media/pet-laugh-frames.png', optimize=True)
metadata = {
    'file': 'pet-laugh-frames.png', 'cellWidth': width, 'cellHeight': height,
    'columns': columns, 'frames': count, 'durations': durations,
    'startFrame': 32, 'loopFrame': 40, 'stillFrame': 48,
    'durationMs': sum(durations), 'introMs': sum(durations[32:]),
    'sourceFile': source.name,
    'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
    'background': 'Original RGB pixels; edge-connected white is keyed by the canvas renderer.'
}
(root / 'media/pet-laugh-animation.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + '\n')
reference = root / 'reference-media/naiwa-animation'
reference.mkdir(parents=True, exist_ok=True)
shutil.copyfile(source, reference / 'original.gif')
print(json.dumps(metadata, ensure_ascii=False))
