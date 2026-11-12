import sharp from "sharp";
import { readFile, writeFile } from "node:fs/promises";

// Temporary artwork: replace the SVG when the church provides its official icon.
const source = await readFile(new URL("../public/icons/church-source.svg", import.meta.url));
for (const size of [192, 512]) await writeFile(new URL(`../public/icons/church-${size}.png`, import.meta.url), await sharp(source).resize(size, size).png().toBuffer());
await writeFile(new URL("../public/icons/church-maskable-512.png", import.meta.url), await sharp(source).resize(512, 512).png().toBuffer());
await writeFile(new URL("../public/icons/apple-touch-icon.png", import.meta.url), await sharp(source).resize(180, 180).png().toBuffer());
const png = await sharp(source).resize(32, 32).png().toBuffer();
const header = Buffer.alloc(22);
header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4); header[6] = 32; header[7] = 32;
header.writeUInt16LE(1, 10); header.writeUInt16LE(32, 12); header.writeUInt32LE(png.length, 14); header.writeUInt32LE(22, 18);
await writeFile(new URL("../app/favicon.ico", import.meta.url), Buffer.concat([header, png]));
