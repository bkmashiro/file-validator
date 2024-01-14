import StreamZip from 'node-stream-zip'

export const IS_ZIP_ENTRY = Symbol('IS_ZIP_ENTRY')
export class CompressedAdapter {
  zipFilePath: string

  constructor(zipFilePath: string) {
    this.zipFilePath = zipFilePath
  }

  async getFileInfo() {
    const zip = new StreamZip.async({ file: this.zipFilePath })

    try {
      const entries = await zip.entries()
      // console.log(entries)
      const fileTree = {}

      for (const entry of Object.values(entries)) {
        const pathComponents = entry.name.split('/')
        let currentLevel: {
          [key: string]: any
        } = fileTree

        // Build the tree structure
        for (const component of pathComponents) {
          if (!currentLevel[component]) {
            currentLevel[component] = {}
          }
          currentLevel = currentLevel[component]
        }

        // Add file information
        Object.assign(currentLevel, entry, { [IS_ZIP_ENTRY]: true })
      }

      return fileTree
    } finally {
      await zip.close()
    }
  }
}
