import {readFile} from 'node:fs/promises';
import path from 'node:path';

// Keep the hosted asset declarations as explicit build-time contracts. Arrays
// retain their frame order; single-image declarations retain their string type.
const artwork = [
  ['HD2D_COMPANION_SRC', './art/jingyu-hd2d-r74.png'],
  ['HD2D_FLIGHT_SOURCES', ['a','b','c','d'].map(id => `./art/jingyu-flight-r73-${id}.png`)],
  ['HD2D_CAST_SRC', './art/jingyu-cast-r76.png'],
  ['HD2D_WIND_EXTRAS', ['bullet','spear','vortex'].map(kind => `./art/jingyu-wind-${kind}-r78.png`)],
  ['HD2D_WIND_SOURCES', ['blade','tornado'].map(kind => `./art/jingyu-wind-${kind}-r75.png`)]
];

const declaration = (name, value) => Array.isArray(value)
  ? `const ${name} = Object.freeze(${JSON.stringify(value)});`
  : `const ${name} = '${value}';`;

export async function embedPortableArtwork(source, base) {
  // Validate every marker before reading images, so a changed source manifest
  // cannot silently leave an external image in the complete offline edition.
  const entries = artwork.map(([name, paths]) => {
    const marker = declaration(name, paths);
    if (!source.includes(marker)) throw new Error(`Missing artwork declaration: ${name}`);
    return {name, paths, marker};
  });
  for (const {name, paths, marker} of entries) {
    const files = Array.isArray(paths) ? paths : [paths];
    const data = await Promise.all(files.map(async file => {
      const bytes = await readFile(path.join(base, file));
      return 'data:image/png;base64,' + bytes.toString('base64');
    }));
    const value = Array.isArray(paths) ? data : data[0];
    source = source.replace(marker, () => declaration(name, value));
  }
  return source;
}
