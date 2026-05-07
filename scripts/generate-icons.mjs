import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const publicDir = path.join(root, 'public');
const sourceSvg = path.join(publicDir, 'favicon.svg');

const maskableSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0ea5e9"/>
      <stop offset="100%" stop-color="#1e40af"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#g)"/>
  <g transform="translate(64,64)">
    <g stroke="#ffffff" stroke-width="28" stroke-linecap="round" stroke-linejoin="round" fill="none" transform="scale(0.75) translate(0,0)">
      <path d="M150 200 L226 276 L370 132"/>
      <path d="M150 320 L370 320"/>
      <path d="M150 400 L300 400"/>
    </g>
  </g>
</svg>
`;

async function main() {
  const svgBuffer = await fs.readFile(sourceSvg);

  const targets = [
    { name: 'pwa-192.png', size: 192, source: svgBuffer },
    { name: 'pwa-512.png', size: 512, source: svgBuffer },
    { name: 'apple-touch-icon.png', size: 180, source: svgBuffer },
    { name: 'favicon-32.png', size: 32, source: svgBuffer },
    { name: 'pwa-512-maskable.png', size: 512, source: Buffer.from(maskableSvg) },
  ];

  for (const t of targets) {
    const outPath = path.join(publicDir, t.name);
    await sharp(t.source)
      .resize(t.size, t.size, { fit: 'contain' })
      .png()
      .toFile(outPath);
    console.log('generated', t.name);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
