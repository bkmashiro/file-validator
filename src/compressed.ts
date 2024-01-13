import StreamZip from 'node-stream-zip'

// const zip = new StreamZip.async({ file: 'archive.zip' })

// const entriesCount = await zip.entriesCount

// console.log(`Entries read: ${entriesCount}`)

// const entries = await zip.entries()
// for (const entry of Object.values(entries)) {
//   const desc = entry.isDirectory ? 'directory' : `${entry.size} bytes`
//   console.log(`Entry ${entry.name}: ${desc}`)
// }

// // Do not forget to close the file once you're done
// await zip.close()

export class CompressedAdapter {
  zipFilePath: string

  constructor(zipFilePath: string) {
    this.zipFilePath = zipFilePath
  }

  async getFileInfo() {
    const zip = new StreamZip.async({ file: this.zipFilePath })

    try {
      const entries = await zip.entries()
      console.log(entries)
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
        currentLevel = entry
      }

      return fileTree
    } finally {
      await zip.close()
    }
  }
}
