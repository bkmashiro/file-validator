import { CompressedAdapter } from './compressed'
import { Tester } from './tester'
import util from 'util'

const test_path = '/home/shiyuzhe/lab/file-validator/test'

async function main() {
  const tester = new Tester()
  console.log(
    tester.TestDir(
      {
        type: 'dir',
        rules: {
          dirname: 'test',
          has: {
            'b.zip': {
              type: 'file',
              rules: {
                size: '1M',
                subtype: 'compressed',
                content: {
                  type: 'dir',
                  rules: {
                    dirname: 'b',
                    has: {
                      'b.txt': {
                        type: 'file',
                      },
                    },
                  },
                },
              },
            },
            'a.zip': 'file',
          },
        },
      },
      test_path,
    ),
  )

  console.log(util.inspect(tester.testObject, false, null, true))

  // const cp = new CompressedAdapter(
  //   '/home/shiyuzhe/lab/file-validator/test/a.zip',
  // )
  // console.log(util.inspect(await cp.getFileInfo(), false, null, true))
}

main()
