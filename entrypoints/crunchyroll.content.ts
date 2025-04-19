import type { ContentScriptContext, IntegratedContentScriptUi } from "#imports"
import type { TypedDocumentNode } from '@graphql-typed-document-node/core'
import { waitElement } from '@1natsu/wait-element'
import { parse } from 'graphql'
import { gql, GraphQLClient } from 'graphql-request'

import anilistLogo from '~/assets/anilist.svg?raw'


interface Media {
  id: number
  title: {
    english: string | null,
    native: string | null,
    romaji: string | null
  }
  siteUrl: string
}


const client = new GraphQLClient('https://graphql.anilist.co')

const searchAnimeQuery: TypedDocumentNode<{ Media: Media }, { search: string }> = parse(gql`
  query searchAnime($search: String) {
    Media(search: $search, type: ANIME) {
      id
      title {
        english
        native
        romaji
      }
      siteUrl
    }
  }
  `)

const CACHE: Record<string, Media> = {}

async function searchAnimeByName(name: string): Promise<{Media: Media}> {
  if (name in CACHE) {
    return { Media: CACHE[name] }
  }

  const { Media } = await client.request(searchAnimeQuery, {
      search: name
    }
  )

  CACHE[name] = Media
  return { Media: Media }
}

const homePattern = new MatchPattern('*://*.crunchyroll.com/*/')
const seriesPattern = new MatchPattern('*://*.crunchyroll.com/*/series/*')
const watchPattern = new MatchPattern('*://*.crunchyroll.com/*/watch/*')

export default defineContentScript({
  matches: ['*://*.crunchyroll.com/*'],
  runAt: 'document_end',
  async main(ctx) {
    async function handler({ newUrl }: { newUrl: URL }) {

      console.log('new url!', newUrl)

      if (seriesPattern.includes(newUrl)) {
        // await mainSeries(ctx)
      }
      else if (watchPattern.includes(newUrl)) {
        await mainWatch(ctx)
      }
      else if (homePattern.includes(newUrl)) {
        await mainHome(ctx)
      }
    }

    ctx.addEventListener(window, 'wxt:locationchange', handler)
    await handler({ newUrl: new URL(location.href) })
  },
});

function createAnilistButton(href: string): Element {
  const anchor = document.createElement('a')
  anchor.href = href
  anchor.target = '_blank'
  anchor.rel = 'noopener noreferrer'
  anchor.innerHTML = anilistLogo
  anchor.style.display = 'inline-flex'
  const svg = anchor.firstChild as SVGElement
  svg.setAttribute('width', '40')
  svg.setAttribute('height', '40')
  return anchor
}

function hasTextContent(node: Element): node is Element & { textContent: string } {
  return !!node.textContent
}

async function mainHome(ctx: ContentScriptContext) {
  let hero: Element | null = null
  const mountedUis = new Map<Element, IntegratedContentScriptUi<void>>()

  const heroObserver = new MutationObserver(async (mutations, observer) => {
    const newHero = document.querySelector('div[class^=hero-carousel__cards]')
    // when our Hero disappears, demount all uis and stop listening for hero changes
    if (hero && !newHero) {
      for (const [_key, ui] of mountedUis) {
        ui.remove()
      }
      observer.disconnect()
      return
    }
    // when no hero is there or it is the same as before, we don't need to do anything
    if (!newHero || hero === newHero) return
    hero = newHero

    // get all anime titles of the hero. Let's hope they are hydrated until now.
    const nodes = hero.querySelectorAll('h2[class^=hero-content-card__seo-title]')

    // Search for anilist links using AniList API
    const results = await Promise.all(
      Array.from(nodes).filter(hasTextContent).map(async node => {
        try {
          const result = await searchAnimeByName(node.textContent)
          return { node, media: result?.Media }
        } catch (e) {
          console.log(e)
          return Promise.reject(e)
        }
      })
    )

    // build ui
    for (const { node, media } of results) {
      if (!media) continue

      const ui = createIntegratedUi(ctx, {
        position: 'inline',
        anchor: node.parentElement?.parentElement?.querySelector('div[class^=hero-content-card__footer] div'),
        onMount: (container) => {
          const root = createAnilistButton(media.siteUrl)
          container.style.display = 'flex'
          container.style.marginTop = '5px'
          container.style.marginBottom = '5px'
          container.append(root)
        }
      })

      ui.mount()
      mountedUis.set(node, ui)
    }
  })

  heroObserver.observe(document.body, {subtree: true, childList: true})
}

async function mainWatch(ctx: ContentScriptContext) {
  console.log('undefined')
}