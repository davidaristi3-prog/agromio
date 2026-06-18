// Genera los íconos PWA (icon-192.png, icon-512.png) con la marca AGROMIO:
// fondo teal y monograma "A" en blanco (estilo línea, sin depender de fuentes).
// Uso: node scripts/gen-icons.mjs
import sharp from 'sharp'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = join(__dirname, '..', 'public')

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0f5d57"/>
  <g fill="none" stroke="#ffffff" stroke-width="34" stroke-linecap="round" stroke-linejoin="round">
    <path d="M150 395 L256 130 L362 395"/>
    <path d="M180 318 L332 318"/>
  </g>
</svg>`

const buf = Buffer.from(svg)

for (const size of [192, 512]) {
  await sharp(buf, { density: 384 })
    .resize(size, size)
    .png()
    .toFile(join(publicDir, `icon-${size}.png`))
  console.log(`icon-${size}.png generado`)
}
