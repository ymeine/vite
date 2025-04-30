import path from 'node:path'
import { pathToFileURL } from 'node:url'

class VariableFactory {
  static readonly guid = '5aa6825e_dad8_4150_85cf_cc17535c2a89' // to ensure unique variable names in generated code
  make(name: string) {
    return `${name}_${VariableFactory.guid}`
  }
}
const variableFactory = new VariableFactory()

class Context {
  static readonly varRealImportMeta = variableFactory.make('importMeta')
  static readonly varImportMetaProxy = variableFactory.make('importMetaProxy')

  readonly varProcess = variableFactory.make('process')
  readonly varModule = variableFactory.make('module')
  readonly varRequire = variableFactory.make('require')

  readonly parentModule: string

  constructor(parentModule: string) {
    this.parentModule = parentModule
  }

  getHeader() {
    return `
      import * as ${this.varProcess} from 'node:process'
      import * as ${this.varModule} from 'node:module'
      const ${this.varRequire} = ${this.varModule}.createRequire(${JSON.stringify(this.parentModule)})
    `
  }
}

export class ImportMetaProxyInCommonJs {
  static getDefines(): Record<string, string> {
    return {
      'import.meta': `${Context.varImportMetaProxy}.throwError`,
    }
  }

  getCode(): string {
    return `
      const ${Context.varImportMetaProxy} = {
        get throwError { throw new Error('import.meta is not supported in CommonJS') }
      }
    `
  }
}

export class ImportMetaProxyInEsm {
  static getDefines(): Record<string, string> {
    return {
      'import.meta': Context.varImportMetaProxy,
      [Context.varRealImportMeta]: `import.meta`, // for the generated proxy code
    }
  }

  readonly filePath: string
  constructor(filePath: string) {
    this.filePath = filePath
  }

  getCode(): string {
    const dirname = JSON.stringify(path.dirname(this.filePath))
    const filePath = JSON.stringify(this.filePath)
    const fileBasename = JSON.stringify(path.basename(this.filePath))
    const fileUrl = JSON.stringify(pathToFileURL(this.filePath).href)

    const context = new Context(this.filePath)

    return `
      ${context.getHeader()}

      const ${Context.varImportMetaProxy} = {
        dir: ${dirname},
        dirname: ${dirname},
        filename: ${filePath},
        path: ${filePath},
        file: ${fileBasename},
        url: ${fileUrl},
        get env() { return ${context.varProcess}.env },
        resolve(...args) { return ${context.varRequire}.resolve(...args) },
        resolveSync(...args) { return ${context.varRequire}.resolveSync(...args) },
        require(...args) { return ${context.varRequire}(...args) },
        main: false,
      }
    `
  }
}
