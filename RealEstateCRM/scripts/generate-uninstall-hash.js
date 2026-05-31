/**
 * Build-time script: generates bcrypt hash of the uninstall password.
 * Run before electron-builder so the hash is embedded in the installer.
 */
const fs = require('fs')
const path = require('path')
const bcrypt = require('bcryptjs')

const PASSWORD = process.env.UNINSTALL_PASSWORD || 'Binnaseer@4300'
const SALT_ROUNDS = 10

const hash = bcrypt.hashSync(PASSWORD, SALT_ROUNDS)

const outDir = path.join(__dirname, '..', 'electron', 'resources')
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

const payload = {
  hash,
  createdAt: new Date().toISOString(),
  version: 1,
}

fs.writeFileSync(
  path.join(outDir, 'uninstall-hash.json'),
  JSON.stringify(payload, null, 2),
  'utf8'
)

console.log(`Uninstall hash generated and saved to electron/resources/uninstall-hash.json`)
