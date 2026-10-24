// Génère les icônes de l'app à partir du logo « toit à deux ».
// Usage : node scripts/icons.mjs
import sharp from 'sharp'
import { writeFile } from 'node:fs/promises'

const motif = `
  <path d="M24 52 L50 30 L76 52" fill="none" stroke="#FFFCF8" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="40" cy="66" r="8" fill="#F6F1EA"/>
  <circle cx="60" cy="66" r="8" fill="#B9D3BC"/>`
// Coins arrondis : icônes « classiques ». Plein cadre : iOS et Android arrondissent eux-mêmes.
const rounded = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="23" fill="#B4603A"/>${motif}</svg>`
const square = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#B4603A"/>${motif}</svg>`
// Android « maskable » : le dessin doit tenir dans le cercle central (80 %).
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#B4603A"/><g transform="translate(50 50) scale(0.8) translate(-50 -50)">${motif}</g></svg>`

const png = (svg, size, file) => sharp(Buffer.from(svg), { density: 600 }).resize(size, size).png().toFile(`public/${file}`)

await Promise.all([
  png(rounded, 64, 'pwa-64x64.png'),
  png(rounded, 192, 'pwa-192x192.png'),
  png(rounded, 512, 'pwa-512x512.png'),
  png(maskable, 512, 'maskable-icon-512x512.png'),
  png(square, 180, 'apple-touch-icon-180x180.png'),
])
const ico = await sharp(Buffer.from(rounded), { density: 300 }).resize(48, 48).png().toBuffer()
// Favicon PNG dans un conteneur ICO minimal.
const header = Buffer.alloc(22)
header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4)
header.writeUInt8(48, 6); header.writeUInt8(48, 7); header.writeUInt16LE(1, 10); header.writeUInt16LE(32, 12)
header.writeUInt32LE(ico.length, 14); header.writeUInt32LE(22, 18)
await writeFile('public/favicon.ico', Buffer.concat([header, ico]))
console.log('Icônes générées')
