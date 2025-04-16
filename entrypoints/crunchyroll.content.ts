import type { ContentScriptContext } from "#imports"
import { gql, GraphQLClient } from 'graphql-request'

import anilistLogo from '~/assets/anilist.svg'

const client = new GraphQLClient('https://https://graphql.anilist.co')

interface Media {
  id: number
  title: {
    english: string | null,
    native: string | null,
    romaji: string | null
  }
  siteUrl: string
}

async function searchAnimeByName(name: string): Promise<Media> {
  return client.request<Media>(gql`
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
    `
  )
}

const seriesPattern = new MatchPattern('*://*.crunchyroll.com/*/series/*');
const watchPattern = new MatchPattern('*://*.crunchyroll.com/*/watch/*')

export default defineContentScript({
  matches: ['*://*.crunchyroll.com/*'],
  main(ctx) {
    ctx.addEventListener(window, 'wxt:locationchange', async ({ newUrl }) => {
      console.log('New url ', newUrl)
      if (seriesPattern.includes(newUrl)) {
        await mainSeries(ctx)
      }
    })

    console.log('Hello content.');
  },
});

function createAnilistAnchor(href: string): Element {
  const anchor = document.createElement('a')
  anchor.href = href
  const logo = document.createElement('object')
  logo.setAttribute('src', anilistLogo)
  anchor.append(logo)
  return anchor
}

async function mainSeries(ctx: ContentScriptContext) {
  const route = window.location.href.split('/')
  const searchTerm = route[route.indexOf('series') + 2]
  const anime = await searchAnimeByName(searchTerm)
  console.log(anime)
  const ui = createIntegratedUi(ctx, {
    position: 'inline',
    anchor: '.bottom-actions-wrapper',
    onMount: (container) => {
      const anchor = createAnilistAnchor(anime.siteUrl)
      container.insertBefore(anchor, container.childNodes[1])
    },
  })
  ui.mount()
}