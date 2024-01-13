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

interface FSProvider {
  statSync: (path: string) => {
    isDirectory: () => boolean
    isFile: () => boolean
    isSymbolicLink: () => boolean
    size: number
  }
  readdirSync: (path: string) => string[]
  existsSync: (path: string) => boolean
}

type ProviderEnv = 'compressed' | 'os'
class DirProvider {
  env: ProviderEnv
}
class FileProvider {
  env: ProviderEnv
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

  matchName = (name: string, specifier: NameSpecifier): boolean => {
    name = getFileName(name)
    if (typeof specifier === 'string') {
      return name === specifier
    } else if (specifier instanceof RegExp) {
      return specifier.test(name)
    } else if (typeof specifier === 'function') {
      return specifier(name)
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

  matchType = (type: FileType, path: string): boolean => {
    const stats = fs.statSync(path)
    let _type: FileType = 'symlink'
    if (stats.isDirectory()) {
      _type = 'dir'
    } else if (stats.isFile()) {
      _type = 'file'
    } else if (stats.isSymbolicLink()) {
      _type = 'symlink'
    } else {
      _type = 'unknown'
    }

    return type === _type
  }

  matchRule = (item: TestObject, path: string): boolean => {
    // before everything, check type
    if (item.type) {
      if (!this.matchType(item.type, path)) {
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

  matchSubType = (
    type: FileSubType,
    rules: FileRule,
    path: string,
  ): boolean => {
    if (type === 'compressed') {
      const cfr = rules as CompressedFileRule
    } else if (type === 'text') {
      // TODO
    } else if (type === 'binary') {
      // TODO
    }
    return true
  }

  matchFileRules = (rules: FileRule, filePath: string): boolean => {
    if ('filename' in rules) {
      if (!this.matchName(filePath, rules.filename!)) {
        bindMsg(rules, 'filename', `$NOT_FOUND: {rules.filename}`)
        return true
      }
    }
    if ('size' in rules) {
      const stats = fs.statSync(filePath)
      if (!this.matchSize(stats.size, rules.size!)) {
        bindMsg(rules, 'size', `ILLEGAL: ${rules.size}`)
        return false
      } else {
        bindMsg(rules, 'size', `MATCH: ${rules.size}`)
      }
    }
    if ('subtype' in rules) {
      if (!this.matchSubType(rules.subtype!, rules, filePath)) {
        bindMsg(rules, 'subtype', `ILLEGAL: ${rules.subtype}`)
        return false
      } else {
        bindMsg(rules, 'subtype', `MATCH: ${rules.subtype}`)
      }
    }
    if ('and' in rules) {
      return rules.and.every((rule) => this.matchFileRules(rule, filePath))
    }
    if ('or' in rules) {
      return rules.or.some((rule) => this.matchFileRules(rule, filePath))
    }
    if ('not' in rules) {
      return !this.matchFileRules(rules.not, filePath)
    }
    return true
  }

  matchDirRules = (rules: DirRule, dirPath: string): boolean => {
    if ('dirname' in rules) {
      if (!this.matchName(dirPath, rules.dirname!)) {
        bindMsg(rules, 'dirname', `${rules.dirname} not found`)
        console.log(rules)
        return false
      } else {
        bindMsg(rules, 'dirname', `MATCH: ${rules.dirname}`)
      }
    }
    if ('size' in rules) {
      const stats = fs.statSync(dirPath)
      if (!this.matchSize(stats.size, rules.size!)) {
        return false
      }
    }
    if ('has' in rules) {
      // const files = fs.readdirSync(dirPath)
      return Object.entries(rules.has!).every(([key, value]) => {
        const filePath = path.join(dirPath, key)
        if (fs.existsSync(filePath)) {
          if (value && typeof value === 'object') {
            const res = this.matchRule(value, filePath)
            if (res) {
              appendMsg(rules, 'has', `MATCH: "${key}"`)
            } else {
              appendMsg(rules, 'has', `ILLEGAL: "${key}"`)
            }
            return res
          } else {
            appendMsg(rules, 'has', `FOUND: "${key}"`)
            return true
          }
        }
        appendMsg(rules, 'has', `MISSING: "${key}"`)
        return false
      })
    }
    if ('and' in rules) {
      return rules.and.every((rule) => this.matchDirRules(rule, dirPath))
    }
    if ('or' in rules) {
      return rules.or.some((rule) => this.matchDirRules(rule, dirPath))
    }
    if ('not' in rules) {
      return !this.matchDirRules(rules.not, dirPath)
    }
    return true
  }

  TestDir = (testObj: TestObject, dir: string): boolean => {
    this.testObject = testObj
    return this.matchRule(testObj, dir)
  }
}

export { Tester }
