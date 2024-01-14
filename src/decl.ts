type FileType = 'file' | 'dir' | 'symlink' | 'unknown'
type FileSubType = 'text' | 'binary' | 'compressed' | 'unknown'

type TestObject = FileTestObject | DirTestObject

type NameSpecifier = string | RegExp | ((name: string) => boolean)

type FileNameRule = {
  filename: NameSpecifier
}

type NumericalUnit = 'K' | 'M' | 'G' | 'T' | 'P' | 'E'
type FileSizeUnit = 'B' | `${NumericalUnit}B` | NumericalUnit
type Mark = '>' | '<' | '=' | '>=' | '<='
type NumberWithUnit = `${number}${FileSizeUnit}`
type SizeLimit = `${Mark}${NumberWithUnit}`
type SizeSpecifier =
  | number // less than, in bytes
  | NumberWithUnit
  | SizeLimit

type FileSizeRule = {
  size: SizeSpecifier
}

type FileSubTypeRule = CompressedFileRule | TextFileRule | BinaryFileRule

type CompressedFileRule = {
  subtype: 'compressed'
  content: DirRule  //since we dont want uncompress the file, we just check the structure of the compressed file
}

type TextFileRule = {
  subtype: 'text'
}

type BinaryFileRule = {
  subtype: 'binary'
}

type Rules = FileRuleBase | DirRuleBase
type RuleOp<R extends Rules> =
  | {
      and: R[]
    }
  | {
      or: R[]
    }
  | {
      not: R
    }

type OneFileRuleBase = FileNameRule | FileSizeRule | FileSubTypeRule
type ManyFileRuleBase = Partial<FileNameRule & FileSizeRule & FileSubTypeRule>
type FileRuleBase = OneFileRuleBase | ManyFileRuleBase
type FileRule = FileRuleBase | RuleOp<FileRuleBase>

type FileTestObject = {
  type: 'file'
  rules?: FileRule
}

type DirNameRule = {
  dirname: NameSpecifier
}

type DirSizeRule = {
  size: SizeSpecifier
}

type DirHasRule = {
  has: { [key: string]: TestObject | FileType }
}

type OneDirRuleBase = DirNameRule | DirSizeRule | DirHasRule
type ManyDirRuleBase = Partial<DirNameRule & DirSizeRule & DirHasRule>
type DirRuleBase = OneDirRuleBase | ManyDirRuleBase
type DirRule = DirRuleBase | RuleOp<DirRuleBase>
type CompressedDirRule = Omit<DirRuleBase, 'folder'>

type DirTestObject = {
  type: 'dir'
  rules?: CompressedDirRule
}

export {
  DirHasRule,
  DirNameRule,
  DirRule,
  DirRuleBase,
  DirSizeRule,
  DirTestObject,
  FileRule,
  FileRuleBase,
  FileSizeRule,
  FileTestObject,
  ManyDirRuleBase,
  ManyFileRuleBase,
  NameSpecifier,
  OneDirRuleBase,
  OneFileRuleBase,
  RuleOp,
  Rules,
  SizeLimit,
  SizeSpecifier,
  TestObject,
  FileType,
  FileSubType,
  FileNameRule,
  FileSizeUnit,
  Mark,
  NumberWithUnit,
  CompressedFileRule,
  TextFileRule,
  BinaryFileRule,
}
