import path from 'node:path'
import { pathToFileURL } from 'node:url'

////////////////////////////////////////////////////////////////////////////////////////////////////
//
////////////////////////////////////////////////////////////////////////////////////////////////////

export class ProxyImportMetaVariablesManager {
  // to ensure unique variable names in generated code
  static readonly guid = '5aa6825e_dad8_4150_85cf_cc17535c2a89'
  static readonly varRealImportMeta = `importMeta_${ProxyImportMetaVariablesManager.guid}`
  static readonly varImportMetaProxy = `importMetaProxy_${ProxyImportMetaVariablesManager.guid}`

  readonly varProcess = `process_${ProxyImportMetaVariablesManager.guid}`
  readonly varModule = `module_${ProxyImportMetaVariablesManager.guid}`
  readonly varRequire = `require_${ProxyImportMetaVariablesManager.guid}`

  readonly parentModule: string

  importProcess = false
  createRequire = false

  constructor(parentModule: string) {
    this.parentModule = parentModule
  }

  generate(): string[] {
    const lines: string[] = []
    if (this.importProcess)
      lines.push(`import * as ${this.varProcess} from 'node:process'`)
    if (this.createRequire) {
      lines.push(`import * as ${this.varModule} from 'node:module'`)
      lines.push(
        `const ${this.varRequire} = ${this.varModule}.createRequire(${JSON.stringify(this.parentModule)})`,
      )
    }
    return lines
  }
}

////////////////////////////////////////////////////////////////////////////////////////////////////
//
////////////////////////////////////////////////////////////////////////////////////////////////////

export class ProxyImportMetaInCommonJs {
  generate(): string {
    return `const ${ProxyImportMetaVariablesManager.varImportMetaProxy} = function() { throw new Error('import.meta is not supported in CommonJS') }`
  }
}

////////////////////////////////////////////////////////////////////////////////////////////////////
//
////////////////////////////////////////////////////////////////////////////////////////////////////

export class ProxyImportMeta {
  readonly dirname: string
  readonly filePath: string
  readonly fileBasename: string
  readonly fileUrl: string

  readonly meta: any
  readonly imports: ProxyImportMetaVariablesManager

  constructor(filePathValue: string) {
    this.dirname = JSON.stringify(path.dirname(filePathValue))
    this.filePath = JSON.stringify(filePathValue)
    this.fileBasename = JSON.stringify(path.basename(filePathValue))
    this.fileUrl = JSON.stringify(pathToFileURL(filePathValue).href)

    this.meta = import.meta as any
    this.imports = new ProxyImportMetaVariablesManager(filePathValue)
  }

  private getImportMetaKeys() {
    const keys = Object.keys(this.meta)
    if (keys.length > 0) return keys
    // in Bun, getting keys on the object directly does not work
    return Object.keys(Object.getPrototypeOf(this.meta))
  }

  private generateProperty(key: string) {
    if (['dir', 'dirname'].includes(key)) return `${key}: ${this.dirname}`
    if (['filename', 'path'].includes(key)) return `${key}: ${this.filePath}`
    if (key === 'file') return `${key}: ${this.fileBasename}`
    if (key === 'url') return `${key}: ${this.fileUrl}`

    if (key === 'env') {
      this.imports.importProcess = true
      return `get ${key}() { return ${this.imports.varProcess}.env }`
    }

    if (['resolve', 'resolveSync'].includes(key)) {
      this.imports.createRequire = true
      return `${key}(...args) { return ${this.imports.varRequire}.${key}(...args) }`
    }

    if (key === 'require') {
      this.imports.createRequire = true
      return `${key}(...args) { return ${this.imports.varRequire}(...args) }`
    }

    if (key === 'main') {
      // Works since this code is generated in "bundled" mode, so `import.meta.filename` does point
      // to the entry point file. Now, none of the user file will actually ever return true here,
      // since the generated entry point file is at an internal path.
      // I wonder if it should be set to true for `vite.config.{t,j}s`...
      return `get ${key}() { return ${ProxyImportMetaVariablesManager.varRealImportMeta}.filename === ${this.filePath} }`
    }

    return `get ${key}() { throw new Error('import.meta.${key} is not supported in bundled config files') }`
  }

  generate(): string {
    // it's important to keep this before `this.imports.generate`, since `this.generateProperty` has a
    // side effect affecting the output of `this.imports.generate`.
    const properties = this.getImportMetaKeys().map(
      (key) => `  ${this.generateProperty(key)},`,
    )

    return [
      ...this.imports.generate(),
      '',
      `const ${ProxyImportMetaVariablesManager.varImportMetaProxy} = {`,
      ...properties,
      `};`,
      '',
    ].join('\n')
  }
}
