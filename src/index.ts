import { CompressedAdapter } from './compressed'
import { Tester } from './tester'
import util from 'util'

const test_path = '/home/shiyuzhe/lab/file-validator/test'

async function main() {
  const tester = new Tester()
  console.log(
    await tester.TestDir(
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
                  has: {
                    folder: {
                      type: 'dir',
                      rules: {
                        has: {
                          'a.txt': 'file',
                        },
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
}

main()
