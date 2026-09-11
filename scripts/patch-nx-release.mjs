/**
 * Patch Nx's resolve-changelog-renderer.js to skip TS transpiler registration
 * for non-TS files. TypeScript 7.x removed readConfigFile which Nx 22.7.1 relies on.
 * This only affects .js renderer files (like the default changelog renderer).
 */
import { readFileSync, writeFileSync } from 'node:fs'

const file = 'node_modules/nx/dist/src/command-line/release/utils/resolve-changelog-renderer.js'
const content = readFileSync(file, 'utf8')

if (content.includes('readConfigFile is not a function') || !content.includes('isTsFile')) {
  const patched = content.replace(
    /const rootTsconfigPath = \(0, typescript_1\.getRootTsConfigPath\)\(\);\s*if \(rootTsconfigPath\) \{\s*cleanupTranspiler = \(0, register_1\.registerTsProject\)\(rootTsconfigPath\);\s*\}/,
    `const isTsFile = interpolatedChangelogRendererPath.endsWith('.ts') || interpolatedChangelogRendererPath.endsWith('.tsx');
        if (isTsFile) {
            const rootTsconfigPath = (0, typescript_1.getRootTsConfigPath)();
            if (rootTsconfigPath) {
                cleanupTranspiler = (0, register_1.registerTsProject)(rootTsconfigPath);
            }
        }`,
  )
  if (patched !== content) {
    writeFileSync(file, patched)
    console.log('Patched nx resolve-changelog-renderer.js for TS 7.x compatibility')
  } else {
    console.log('nx resolve-changelog-renderer.js already patched or pattern not found')
  }
} else {
  console.log('nx resolve-changelog-renderer.js already patched')
}
