/**
 * Fetch HTML for all screens from a Google Stitch project and save to disk.
 * Usage: STITCH_API_KEY=your_key node scripts/fetch-stitch-screens.js
 * Or (PowerShell): $env:STITCH_API_KEY="your_key"; node scripts/fetch-stitch-screens.js
 */

import { stitch } from '@google/stitch-sdk'
import { mkdir, writeFile } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ID = process.env.STITCH_PROJECT_ID || '720721844184954687'
const OUT_DIR = join(__dirname, '..', 'stitch-export')

async function fetchUrl(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`)
  return res.text()
}

async function main() {
  const apiKey = process.env.STITCH_API_KEY
  if (!apiKey) {
    console.error('Set STITCH_API_KEY in the environment.')
    process.exit(1)
  }

  process.env.STITCH_API_KEY = apiKey

  console.log(`Fetching project ${PROJECT_ID}...`)
  const project = stitch.project(PROJECT_ID)
  const screens = await project.screens()
  console.log(`Found ${screens.length} screens.`)

  await mkdir(OUT_DIR, { recursive: true })

  for (let i = 0; i < screens.length; i++) {
    const screen = screens[i]
    const screenId = screen.id || screen.screenId
    const safeName = `screen-${i + 1}-${screenId?.slice(0, 8) || 'unknown'}.html`
    const outPath = join(OUT_DIR, safeName)

    console.log(`Fetching HTML for screen ${i + 1}/${screens.length} (${screenId})...`)
    const htmlUrl = await screen.getHtml()
    const html = await fetchUrl(htmlUrl)
    await writeFile(outPath, html, 'utf8')
    console.log(`  Saved to ${outPath}`)
  }

  console.log(`\nDone. All ${screens.length} screens saved to ${OUT_DIR}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
