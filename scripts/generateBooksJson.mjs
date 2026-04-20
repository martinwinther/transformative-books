import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { mergeCanons, parseBooksFromCsv } from '../src/data/loadBooks.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')

const WESTERN_CSV_PATH = path.join(repoRoot, 'public', 'western-canon.csv')
const EASTERN_CSV_PATH = path.join(repoRoot, 'public', 'eastern-canon.csv')
const OUTPUT_PATH = path.join(repoRoot, 'public', 'api', 'v1', 'books.json')

function sortBooksDeterministically(books) {
  return [...books].sort((a, b) => {
    const titleCompare = a.title.localeCompare(b.title, 'en', { sensitivity: 'base' })
    if (titleCompare !== 0) return titleCompare

    return a.author.localeCompare(b.author, 'en', { sensitivity: 'base' })
  })
}

async function loadCanonBooks(canon, csvPath) {
  const csvText = await readFile(csvPath, 'utf8')
  return parseBooksFromCsv(canon, csvText)
}

async function generateBooksApiJson() {
  const [westernBooks, easternBooks] = await Promise.all([
    loadCanonBooks('western', WESTERN_CSV_PATH),
    loadCanonBooks('eastern', EASTERN_CSV_PATH),
  ])

  const mergedBooks = sortBooksDeterministically(mergeCanons(westernBooks, easternBooks))

  const payload = {
    version: 'v1',
    generatedAt: new Date().toISOString(),
    count: mergedBooks.length,
    data: mergedBooks,
  }

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true })
  await writeFile(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')

  console.log(`Generated ${OUTPUT_PATH} with ${payload.count} books.`)
}

generateBooksApiJson().catch((error) => {
  console.error('Failed to generate books API JSON:', error)
  process.exitCode = 1
})
