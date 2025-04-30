import path from 'node:path'
import { pathToFileURL } from 'node:url'

////////////////////////////////////////////////////////////////////////////////////////////////////
//
////////////////////////////////////////////////////////////////////////////////////////////////////

class ProxyImportMetaVariablesManager {
  // to ensure unique variable names in generated code
  static readonly guid = '5aa6825e_dad8_4150_85cf_cc17535c2a89'
  static readonly varRealImportMeta = `importMeta_${ProxyImportMetaVariablesManager.guid}`
  static readonly varImportMetaProxy = `importMetaProxy_${ProxyImportMetaVariablesManager.guid}`

  readonly varProcess = `process_${ProxyImportMetaVariablesManager.guid}`
  readonly varPath = `path_${ProxyImportMetaVariablesManager.guid}`
  readonly varModule = `module_${ProxyImportMetaVariablesManager.guid}`
  readonly varRequire = `require_${ProxyImportMetaVariablesManager.guid}`

  readonly parentModule: string

  constructor(parentModule: string) {
    this.parentModule = parentModule
  }

  getHeader() {
    return `
      import * as ${this.varProcess} from 'node:process'
      import * as ${this.varPath} from 'node:path'
      import * as ${this.varModule} from 'node:module'
      const ${this.varRequire} = ${this.varModule}.createRequire(${JSON.stringify(this.parentModule)})
    `
  }
}

////////////////////////////////////////////////////////////////////////////////////////////////////
//
////////////////////////////////////////////////////////////////////////////////////////////////////

export class ProxyImportMetaInCommonJs {
  static getDefines(): Record<string, string> {
    return {
      'import.meta': `${ProxyImportMetaVariablesManager.varImportMetaProxy}.throwError`,
    }
  }

  generate(): string {
    return `
      const ${ProxyImportMetaVariablesManager.varImportMetaProxy} = {
        get throwError { throw new Error('import.meta is not supported in CommonJS') }
      }
    `
  }
}

////////////////////////////////////////////////////////////////////////////////////////////////////
//
////////////////////////////////////////////////////////////////////////////////////////////////////

export class ProxyImportMetaInEsm {
  static getDefines(): Record<string, string> {
    return {
      'import.meta': ProxyImportMetaVariablesManager.varImportMetaProxy,
      [ProxyImportMetaVariablesManager.varRealImportMeta]: `import.meta`, // for the generated proxy code
    }
  }
  readonly dirname: string
  readonly filePath: string
  readonly fileBasename: string
  readonly fileUrl: string

  readonly meta: any
  readonly variables: ProxyImportMetaVariablesManager

  constructor(filePathValue: string) {
    this.dirname = JSON.stringify(path.dirname(filePathValue))
    this.filePath = JSON.stringify(filePathValue)
    this.fileBasename = JSON.stringify(path.basename(filePathValue))
    this.fileUrl = JSON.stringify(pathToFileURL(filePathValue).href)

    this.meta = import.meta as any
    this.variables = new ProxyImportMetaVariablesManager(filePathValue)
  }

  // FIXME 2025-04-30T12:48:14+02:00@Europe/Paris
  // main() should just return false: user file will never be the main module.
  // We could changes semantics and tell vite.config.ts is the main module, but in a Vite context,
  // checking for main does not even make sense
  generate(): string {
    return `
      ${this.variables.getHeader()}

      const ${ProxyImportMetaVariablesManager.varImportMetaProxy} = {
        dir: ${this.dirname},
        dirname: ${this.dirname},
        filename: ${this.filePath},
        path: ${this.filePath},
        file: ${this.fileBasename},
        url: ${this.fileUrl},
        get env() { return ${this.variables.varProcess}.env },
        resolve(...args) { return ${this.variables.varRequire}.resolve(...args) },
        resolveSync(...args) { return ${this.variables.varRequire}.resolveSync(...args) },
        require(...args) { return ${this.variables.varRequire}(...args) },
        get main() {
          const main = ${this.variables.varPath}.normalize(${ProxyImportMetaVariablesManager.varRealImportMeta}.filename)
          return main === ${this.variables.varPath}.normalize(${this.filePath})
        },
      }
    `
  }
}
