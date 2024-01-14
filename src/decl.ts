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
  content: CompressedDirRule //since we dont want uncompress the file, we just check the structure of the compressed file
}

type TextFileRule = {
  subtype: 'text'
}

type BinaryFileRule = {
  subtype: 'binary'
}

type Rules = FileRulePartial | DirRulePartial
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

type FileRuleFull = FileNameRule & FileSizeRule & FileSubTypeRule
type FileRulePartial = Partial<FileRuleFull>
type FileRule = FileRulePartial | RuleOp<FileRulePartial>

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
type DirRuleFull = DirNameRule & DirSizeRule & DirHasRule
type DirRulePartial = Partial<DirNameRule & DirSizeRule & DirHasRule>
type DirRule = DirRulePartial | RuleOp<DirRulePartial>
type CompressedDirRule = Partial<Omit<DirRuleFull, 'dirname'>>

type DirTestObject = {
  type: 'dir'
  rules?: DirRule
}

export {
  DirHasRule,
  DirNameRule,
  DirRule,
  DirRulePartial as DirRuleBase,
  DirSizeRule,
  DirTestObject,
  FileRule,
  FileRulePartial as FileRuleBase,
  FileSizeRule,
  FileTestObject,
  NameSpecifier,
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
