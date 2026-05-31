#!/usr/bin/env node
/**
 * Version Validation Script
 * ===========================
 * This script runs BEFORE every build:exe to ensure the version number
 * in package.json has been increased compared to the last successful build.
 *
 * RULES:
 * 1. Every release MUST have a higher version than the previous release.
 * 2. The version in package.json is the SINGLE SOURCE OF TRUTH.
 * 3. GitHub release tags MUST match the version prefixed with 'v'.
 *    Example: package.json = 1.0.2  ->  GitHub Tag = v1.0.2
 * 4. If version was not bumped, the build is ABORTED with an error.
 *
 * HOW IT WORKS:
 * - Reads current version from package.json
 * - Reads last built version from .last-built-version (if exists)
 * - Compares semver: current MUST be > last
 * - If .last-built-version does not exist, any version is accepted
 *   (first build on this machine)
 * - On successful build, electron-builder will generate the installer
 *   and this script will have already validated the version.
 */

const fs = require('fs')
const path = require('path')

const rootDir = path.resolve(__dirname, '..')
const pkgPath = path.join(rootDir, 'package.json')
const lastVersionPath = path.join(rootDir, '.last-built-version')

function parseSemver(v) {
  const m = String(v).match(/^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/)
  if (!m) return null
  return {
    major: parseInt(m[1], 10),
    minor: parseInt(m[2], 10),
    patch: parseInt(m[3], 10),
    prerelease: m[4] || null,
    raw: String(v),
  }
}

function compareSemver(a, b) {
  if (a.major !== b.major) return a.major - b.major
  if (a.minor !== b.minor) return a.minor - b.minor
  if (a.patch !== b.patch) return a.patch - b.patch
  // prerelease versions are lower than release versions
  if (a.prerelease && !b.prerelease) return -1
  if (!a.prerelease && b.prerelease) return 1
  if (a.prerelease && b.prerelease) return a.prerelease.localeCompare(b.prerelease)
  return 0
}

function main() {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
  const currentVersion = pkg.version
  const current = parseSemver(currentVersion)

  if (!current) {
    console.error(`[validate-version] Invalid version in package.json: "${currentVersion}"`)
    console.error('  Version must be in format: MAJOR.MINOR.PATCH (e.g., 1.0.1)')
    process.exit(1)
  }

  console.log(`[validate-version] Current version: ${current.raw}`)

  if (!fs.existsSync(lastVersionPath)) {
    console.log('[validate-version] No previous build version found. Accepting current version.')
    // Still write it so next build must increase
    fs.writeFileSync(lastVersionPath, current.raw + '\n')
    process.exit(0)
  }

  const lastVersion = fs.readFileSync(lastVersionPath, 'utf8').trim()
  const last = parseSemver(lastVersion)

  if (!last) {
    console.error(`[validate-version] Invalid last built version in .last-built-version: "${lastVersion}"`)
    process.exit(1)
  }

  console.log(`[validate-version] Last built version: ${last.raw}`)

  const cmp = compareSemver(current, last)
  if (cmp <= 0) {
    console.error('[validate-version] VERSION NOT INCREASED. Build aborted.')
    console.error(`  Last built:  ${last.raw}`)
    console.error(`  Current:     ${current.raw}`)
    console.error('')
    console.error('  You MUST increase the version in package.json before every release.')
    console.error('  Example valid bumps:')
    console.error('    1.0.0 -> 1.0.1 (patch)')
    console.error('    1.0.1 -> 1.0.2 (patch)')
    console.error('    1.0.2 -> 1.1.0 (minor)')
    console.error('    1.1.0 -> 2.0.0 (major)')
    console.error('')
    console.error('  After changing the version, the GitHub release tag must match:')
    console.error(`    Tag: v${current.raw}`)
    process.exit(1)
  }

  console.log(`[validate-version] Version increased (${last.raw} -> ${current.raw}). Build allowed.`)
  fs.writeFileSync(lastVersionPath, current.raw + '\n')
  process.exit(0)
}

main()
