import crypto from 'crypto'
import { dirname, join } from 'path'

// eslint-disable-next-line import/no-named-as-default
import Arborist from '@npmcli/arborist'
import { createReadStream, copy, remove } from 'fs-extra'
import ignore from 'ignore'
import npmPacklist from 'npm-packlist'

import {
  readIgnoreFile,
  readPackageManifest,
  readSignatureFile,
  getStorePackagesDir,
  writePackageManifest,
  writeSignatureFile,
} from '.'

import type { PackageManifest } from '.'

const shortSignatureLength = 8

export const getFileHash = (srcPath: string, relPath: string = '') => {
  return new Promise<string>(async (resolve, reject) => {
    const stream = createReadStream(srcPath)
    const md5sum = crypto.createHash('md5')
    md5sum.update(relPath.replace(/\\/g, '/'))
    stream.on('data', (data: string) => md5sum.update(data))
    stream.on('error', reject).on('close', () => {
      resolve(md5sum.digest('hex'))
    })
  })
}

const copyFile = async (
  srcPath: string,
  destPath: string,
  relPath: string = '',
) => {
  await copy(srcPath, destPath)
  return getFileHash(srcPath, relPath)
}

const mapObj = <T, R, K extends string>(
  obj: Record<K, T>,
  mapValue: (value: T, key: K) => R,
): Record<string, R> => {
  if (Object.keys(obj).length === 0) return {}

  return Object.keys(obj).reduce<Record<string, R>>((resObj, key) => {
    if (obj[key as K]) {
      resObj[key] = mapValue(obj[key as K], key as K)
    }
    return resObj
  }, {})
}

const resolveWorkspaceDepVersion = (
  version: string,
  pkgName: string,
  workingDir: string,
): string => {
  if (version !== '*' && version !== '^' && version !== '~') {
    // Regular semver specification
    return version
  }
  // Resolve workspace version aliases
  const prefix = version === '^' || version === '~' ? version : ''

  try {
    const pkgPath = require.resolve(join(pkgName, 'package.json'), {
      paths: [workingDir],
    })

    const resolved = readPackageManifest(dirname(pkgPath))?.version

    return `${prefix}${resolved}` || '*'
  } catch (e) {
    console.warn('Could not resolve workspace package location for', pkgName)
    return '*'
  }
}

const resolveWorkspaces = (
  pkg: PackageManifest,
  workingDir: string,
): PackageManifest => {
  const resolveDeps = (deps: PackageManifest['dependencies']) => {
    return deps
      ? mapObj(deps, (val, depPkgName) => {
          if (val.startsWith('workspace:')) {
            const version = val.split(':')[1]
            const resolved = resolveWorkspaceDepVersion(
              version,
              depPkgName,
              workingDir,
            )
            console.log(
              `Resolving workspace package ${depPkgName} version ==> ${resolved}`,
            )
            return resolved
          }
          return val
        })
      : deps
  }

  return {
    ...pkg,
    dependencies: resolveDeps(pkg.dependencies),
    devDependencies: resolveDeps(pkg.devDependencies),
    peerDependencies: resolveDeps(pkg.peerDependencies),
  }
}

const modPackageDev = (pkg: PackageManifest) => {
  return {
    ...pkg,
    scripts: pkg.scripts
      ? {
          ...pkg.scripts,
          prepare: undefined,
          prepublish: undefined,
        }
      : undefined,
    devDependencies: undefined,
  }
}

const fixScopedRelativeName = (path: string) => path.replace(/^\.\//, '')

export const copyPackageToStore = async (options: {
  workingDir: string
  signature?: boolean
  changed?: boolean
  content?: boolean
  devMod?: boolean
  workspaceResolve?: boolean
}): Promise<string | false> => {
  const { workingDir, devMod = true } = options
  const pkg = readPackageManifest(workingDir)

  if (!pkg) throw 'Error copying package to store.'

  const copyFromDir = options.workingDir
  const storePackageStoreDir = join(
    getStorePackagesDir(),
    pkg.name,
    pkg.version,
  )

  const ignoreFileContent = readIgnoreFile(workingDir)

  const ignoreRule = ignore().add(ignoreFileContent)

  const arborist = new Arborist({ path: workingDir })
  const actual = await arborist.loadActual()

  const npmList = (await npmPacklist(actual)).map(fixScopedRelativeName)

  const filesToCopy = npmList.filter((f) => !ignoreRule.ignores(f))
  if (options.content) {
    console.info('Files included in published content:')
    filesToCopy.sort().forEach((f) => {
      console.log(`- ${f}`)
    })
    console.info(`Total ${filesToCopy.length} files.`)
  }
  const copyFilesToStore = async () => {
    await remove(storePackageStoreDir)
    return Promise.all(
      filesToCopy
        .sort()
        .map((relPath) =>
          copyFile(
            join(copyFromDir, relPath),
            join(storePackageStoreDir, relPath),
            relPath,
          ),
        ),
    )
  }
  const hashes = options.changed
    ? await Promise.all(
        filesToCopy
          .sort()
          .map((relPath) => getFileHash(join(copyFromDir, relPath), relPath)),
      )
    : await copyFilesToStore()

  const signature = crypto
    .createHash('md5')
    .update(hashes.join(''))
    .digest('hex')

  if (options.changed) {
    const publishedSig = readSignatureFile(storePackageStoreDir)
    if (signature === publishedSig) {
      return false
    } else {
      await copyFilesToStore()
    }
  }

  writeSignatureFile(storePackageStoreDir, signature)
  const versionPre = options.signature
    ? '+' + signature.substr(0, shortSignatureLength)
    : ''

  const resolveDeps = (pkg: PackageManifest): PackageManifest =>
    options.workspaceResolve ? resolveWorkspaces(pkg, workingDir) : pkg

  const pkgToWrite: PackageManifest = {
    ...resolveDeps(devMod ? modPackageDev(pkg) : pkg),
    knitSig: signature,
    version: pkg.version + versionPre,
  }
  writePackageManifest(storePackageStoreDir, pkgToWrite)
  return signature
}
