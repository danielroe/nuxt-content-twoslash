import fs from 'node:fs/promises'
import { join } from 'pathe'
import { addPlugin, addTemplate, createResolver, defineNuxtModule } from '@nuxt/kit'
import type {} from '@nuxt/schema'
import fg from 'fast-glob'
import type { TwoslashOptions } from 'twoslash'

// Module options TypeScript interface definition
export interface ModuleOptions {
  /**
   * Include type decalrations generated by Nuxt (auto-imports etc.)
   *
   * @default true
   */
  includeNuxtTypes?: boolean

  /**
   * Compiler options for Twoslash
   */
  compilerOptions?: TwoslashOptions['compilerOptions']

  /**
   * Handbook options for Twoslash
   */
  handbookOptions?: TwoslashOptions['handbookOptions']
}

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: 'nuxt-content-twoslash',
    configKey: 'twoslash',
  },
  // Default configuration options of the Nuxt module
  defaults: {
    includeNuxtTypes: true,
  },
  setup(options, nuxt) {
    const resolver = createResolver(import.meta.url)
    addPlugin(resolver.resolve('./runtime/plugin'))

    const types: Record<string, string> = {}

    const path = addTemplate({
      filename: 'twoslash-meta.mjs',
      write: true,
      getContents: () => {
        return [
          `export const moduleOptions = ${JSON.stringify(options, null, 2)}`,
          `export const typeDecorations = ${JSON.stringify(types, null, 2)}`,
        ].join('\n')
      },
    })
    nuxt.options.alias ||= {}
    nuxt.options.alias['#twoslash-meta'] = path.dst
    nuxt.options.nitro.alias ||= {}
    nuxt.options.nitro.alias['#twoslash-meta'] = path.dst

    let isHookCalled = false

    // eslint-disable-next-line ts/ban-ts-comment, ts/prefer-ts-expect-error
    // @ts-ignore
    nuxt.hook('mdc:configSources', async (sources: string[]) => {
      sources.push(resolver.resolve('./runtime/mdc.config'))
      isHookCalled = true
    })

    nuxt.hook('app:resolve', () => {
      if (!isHookCalled)
        console.error('[nuxt-content-twoslash] TwoSlash doesn\'t get initialized properly, you may need to put this module before `@nuxt/content`.')
    })

    if (options.includeNuxtTypes) {
      ;(async () => {
        const files = await fg('**/*.d.ts', {
          cwd: nuxt.options.buildDir,
          onlyFiles: true,
        })
        await Promise.all(
          files.map(async (file) => {
            types[`.nuxt/${file}`] = await fs.readFile(join(nuxt.options.buildDir, file), 'utf-8')
          }),
        )
      })()
    }
  },
})
