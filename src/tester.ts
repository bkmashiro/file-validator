import path from 'path'
import fs from 'fs'
import {
  NameSpecifier,
  SizeSpecifier,
  FileSizeUnit,
  TestObject,
  FileRule,
  DirRule,
  FileType,
  FileSubType,
  CompressedFileRule,
} from './decl'
import { CompressedAdapter } from './compressed'
import { ZipEntry } from 'node-stream-zip'

type ProviderEnv = 'compressed' | 'os'

type Stats = {
  time: number
  compressedSize: number
  size: number
  name: string
  isDirectory: boolean
  isFile: boolean
  isSymbolicLink?: boolean
  comment: string
}
interface FileProvider {
  env: ProviderEnv
  stats(): Stats | PromiseLike<Stats>
  isFile(): boolean | PromiseLike<boolean>
  isDirectory(): boolean | PromiseLike<boolean>
  enumerate(): FileProvider[] | PromiseLike<FileProvider[]>
}

class OSFileProvider implements FileProvider {
  env: ProviderEnv = 'os'
  path: string
  osStats: fs.Stats

  constructor(p: string) {
    this.path = p
    this.osStats = fs.statSync(p)
  }
  // if is a folder, return all files and folders in it
  enumerate(): FileProvider[] {
    if (this.isDirectory()) {
      return fs.readdirSync(this.path).map((f) => {
        return new OSFileProvider(path.join(this.path, f))
      })
    }
    throw new Error('Not a directory')
  }

  isFile(): boolean {
    return this.osStats.isFile()
  }

  isDirectory(): boolean {
    return this.osStats.isDirectory()
  }

  stats(): Stats {
    this.osStats = fs.statSync(this.path)

    return {
      time: this.osStats.mtimeMs,
      compressedSize: 0,
      size: this.osStats.size,
      name: path.basename(this.path),
      isDirectory: this.osStats.isDirectory(),
      isFile: this.osStats.isFile(),
      comment: '',
    }
  }
}

type ZipFileInfo = {
  [key: string]: ZipFileInfo | ZipEntry
}
class CompressedFileProvider implements FileProvider {
  env: ProviderEnv = 'compressed'
  cp: CompressedAdapter
  fileInfo: ZipFileInfo
  current = ''
  constructor(file: string) {
    this.init(file)
    this.cp = new CompressedAdapter(file)
    this.fileInfo = {}
  }

  enumerate(): FileProvider[] | PromiseLike<FileProvider[]> {
    // enumerate all files and folders in current folder
    const cur = this.curr as unknown as ZipFileInfo
    if (cur.isDirectory) {
      return Object.entries(cur).map(([name, info]) => {
        const cp = new CompressedFileProvider(this.cp.zipFilePath)
        cp.current = path.join(this.current, name)
        return cp
      })
    } else {
      throw new Error('Not a directory')
    }
  }

  async stats() {
    await this.checkInit(this.stats, this._stats)
    return this._stats()
  }

  _stats() {
    const cur = this.curr as unknown as ZipEntry
    return {
      time: cur.time,
      compressedSize: cur.size,
      size: cur.size,
      name: cur.name,
      isDirectory: cur.isDirectory,
      isFile: !cur.isDirectory,
      comment: cur.comment,
    }
  }

  async isFile() {
    await this.checkInit(this.isFile, this._isFile)
    return this._isFile()
  }

  _isFile() {
    return !this.fileInfo.info.isDirectory as boolean
  }

  async isDirectory() {
    await this.checkInit(this.isDirectory, this._isDirectory)
    return this._isDirectory()
  }

  _isDirectory() {
    return this.fileInfo.info.isDirectory as boolean
  }

  init(file: string) {
    this.cp.getFileInfo().then((info) => {
      this.fileInfo = info
    })
  }

  async checkInit(oldFunc: Function, newFunc: Function) {
    if (!this.fileInfo) {
      await this.cp.getFileInfo()
    }

    oldFunc = newFunc
  }

  public get curr(): ZipFileInfo {
    const pathComponents = this.current.split('/')
    let currentLevel: ZipFileInfo = this.fileInfo
    for (const component of pathComponents) {
      currentLevel = currentLevel[component] as ZipFileInfo
    }
    return currentLevel
  }
}

type MatchResult = {
  [key: string]: any
}

function getFolderName(p: string): string {
  return path.dirname(p)
}

function getFileName(p: string): string {
  return path.basename(p)
}

function getExtension(p: string): string {
  return path.extname(p)
}

function getFileNameWithoutExtension(p: string): string {
  return path.basename(p, path.extname(p))
}

const MSG_TOKEN = Symbol('test-result')
function bindMsg(target: object, k: string, v: any) {
  if (Object.getOwnPropertyDescriptor(target, MSG_TOKEN)) {
    Object.assign((target as any)[MSG_TOKEN], {
      [k]: v,
    })
  } else {
    Object.defineProperty(target, MSG_TOKEN, {
      value: {
        [k]: v,
      },
      enumerable: true,
    })
  }
}

function appendMsg(target: object, k: string, v: any) {
  if (!Object.getOwnPropertyDescriptor(target, MSG_TOKEN)) {
    bindMsg(target, k, [v])
  } else {
    const msg = (target as any)[MSG_TOKEN]
    if (msg[k]) {
      msg[k].push(v)
    } else {
      msg[k] = [v]
    }
  }
  // console.log((target as any)[MSG_TOKEN][k])
}

class Tester {
  testObject?: TestObject

  matchName = async (file: FileProvider, specifier: NameSpecifier) => {
    const filename = (await file.stats()).name
    if (typeof specifier === 'string') {
      return filename === specifier
    } else if (specifier instanceof RegExp) {
      return specifier.test(filename)
    } else if (typeof specifier === 'function') {
      return specifier(filename)
    }
    return false
  }

  matchSize = (size: number, specifier: SizeSpecifier): boolean => {
    if (typeof specifier === 'number') {
      return size < specifier
    } else if (
      typeof specifier === 'string' &&
      specifier.match(/^(\d+)([A-Z]+)$/) // only number and unit
    ) {
      // with no mark
      const [, numberStr, unit] = specifier.match(/^(\d+)([A-Z]+)$/)!
      const number = parseFloat(numberStr)
      const sizeInBytes = this.convertToBytes(number, unit as FileSizeUnit)
      return size < sizeInBytes
    } else {
      const [, mark, numberStr, unit] = specifier.match(
        /^([<>]=?)(\d+)([A-Z]+)$/,
      )!
      const number = parseFloat(numberStr)
      const sizeInBytes = this.convertToBytes(number, unit as FileSizeUnit)

      switch (mark) {
        case '>':
          return size > sizeInBytes
        case '<':
          return size < sizeInBytes
        case '=':
          return size === sizeInBytes
        case '>=':
          return size >= sizeInBytes
        case '<=':
          return size <= sizeInBytes
        default:
          return false
      }
    }
  }

  convertToBytes = (size: number, unit: FileSizeUnit): number => {
    // missing unit
    if (!unit) {
      unit = 'B'
    }

    // if missing B
    if (!unit.endsWith('B') && unit.length === 1) {
      unit += 'B'
    }

    switch (unit) {
      case 'B':
        return size
      case 'KB':
        return size * 1024
      case 'MB':
        return size * 1024 * 1024
      case 'GB':
        return size * 1024 * 1024 * 1024
      case 'TB':
        return size * 1024 * 1024 * 1024 * 1024
      case 'PB':
        return size * 1024 * 1024 * 1024 * 1024 * 1024
      case 'EB':
        return size * 1024 * 1024 * 1024 * 1024 * 1024 * 1024
      default:
        throw new Error(`Invalid size unit: ${unit}`)
    }
  }

  matchType = async (type: FileType, file: FileProvider) => {
    const stats = await file.stats()
    let _type: FileType = 'symlink'
    if (stats.isDirectory) {
      _type = 'dir'
    } else if (stats.isFile) {
      _type = 'file'
    } else if (stats.isSymbolicLink) {
      // not supported by compressed file
      _type = 'symlink'
    } else {
      _type = 'unknown'
    }

    return type === _type
  }

  matchRule = async (item: TestObject, path: FileProvider) => {
    // before everything, check type
    if (item.type) {
      if (!(await this.matchType(item.type, path))) {
        bindMsg(item, 'type', `ILLEGAL: ${item.type}`)
        return false
      } else {
        bindMsg(item, 'type', `MATCH: ${item.type}`)
      }
    }

    if (item.type === 'file') {
      if (item.rules) {
        return this.matchFileRules(item.rules, path)
      }
      return true
    } else if (item.type === 'dir') {
      if (item.rules) {
        return this.matchDirRules(item.rules, path)
      }
      return true
    }
    return false
  }

  matchSubType = async (
    type: FileSubType,
    rules: FileRule,
    path: FileProvider,
  ): Promise<boolean> => {
    if (type === 'compressed') {
      const cfr = rules as CompressedFileRule
    } else if (type === 'text') {
      // TODO
    } else if (type === 'binary') {
      // TODO
    }
    return true
  }

  matchFileRules = async (
    rules: FileRule,
    file: FileProvider,
  ): Promise<boolean> => {
    if ('filename' in rules) {
      if (!this.matchName(file, rules.filename!)) {
        bindMsg(rules, 'filename', `$NOT_FOUND: {rules.filename}`)
        return true
      }
    }
    if ('size' in rules) {
      const stats = await file.stats()
      if (!this.matchSize(stats.size, rules.size!)) {
        bindMsg(rules, 'size', `ILLEGAL: ${rules.size}`)
        return false
      } else {
        bindMsg(rules, 'size', `MATCH: ${rules.size}`)
      }
    }
    if ('subtype' in rules) {
      if (!(await this.matchSubType(rules.subtype!, rules, file))) {
        bindMsg(rules, 'subtype', `ILLEGAL: ${rules.subtype}`)
        return false
      } else {
        bindMsg(rules, 'subtype', `MATCH: ${rules.subtype}`)
      }
    }
    if ('and' in rules) {
      return rules.and.every((rule) => this.matchFileRules(rule, file))
    }
    if ('or' in rules) {
      return rules.or.some((rule) => this.matchFileRules(rule, file))
    }
    if ('not' in rules) {
      return !this.matchFileRules(rules.not, file)
    }
    return true
  }

  matchDirRules = async (
    rules: DirRule,
    file: FileProvider,
  ): Promise<boolean> => {
    if ('dirname' in rules) {
      if (!this.matchName(file, rules.dirname!)) {
        bindMsg(rules, 'dirname', `${rules.dirname} not found`)
        console.log(rules)
        return false
      } else {
        bindMsg(rules, 'dirname', `MATCH: ${rules.dirname}`)
      }
    }
    if ('size' in rules) {
      const stats = await file.stats()
      if (!this.matchSize(stats.size, rules.size!)) {
        return false
      }
    }
    if ('has' in rules) {
      // const files = fs.readdirSync(dirPath)
      // return Object.entries(rules.has!).every(([key, value]) => {
      //   const filePath = path.join(file, key)
      //   if (fs.existsSync(filePath)) {
      //     if (value && typeof value === 'object') {
      //       const res = this.matchRule(value, filePath)
      //       if (res) {
      //         appendMsg(rules, 'has', `MATCH: "${key}"`)
      //       } else {
      //         appendMsg(rules, 'has', `ILLEGAL: "${key}"`)
      //       }
      //       return res
      //     } else {
      //       appendMsg(rules, 'has', `FOUND: "${key}"`)
      //       return true
      //     }
      //   }
      //   appendMsg(rules, 'has', `MISSING: "${key}"`)
      //   return false
      // })

      const files = await file.enumerate()
      const has = rules.has!
      for (const [key, value] of Object.entries(has)) {
        const filePath = path.join((await file.stats()).name, key)
        const found = await findFilenameAsync(files, key)
        if (!found) {
          appendMsg(rules, 'has', `MISSING: "${key}"`)
          return false
        }
        if (value && typeof value === 'object') {
          const res = await this.matchRule(value, found)
          if (!res) {
            appendMsg(rules, 'has', `ILLEGAL: "${key}"`)
            return false
          }
          appendMsg(rules, 'has', `MATCH: "${key}"`)
        } else {
          appendMsg(rules, 'has', `FOUND: "${key}"`)
        }
      }
    }
    if ('and' in rules) {
      return rules.and.every((rule) => this.matchDirRules(rule, file))
    }
    if ('or' in rules) {
      return rules.or.some((rule) => this.matchDirRules(rule, file))
    }
    if ('not' in rules) {
      return !this.matchDirRules(rules.not, file)
    }
    return true

    async function findFilenameAsync(files: FileProvider[], key: string) {
      for (const file of files) {
        if ((await file.stats()).name === key) {
          return file
        }
      }
    }
  }

  TestDir = async (testObj: TestObject, dir: string) => {
    this.testObject = testObj
    return await this.matchRule(testObj, new OSFileProvider(dir))
  }
}

export { Tester }
