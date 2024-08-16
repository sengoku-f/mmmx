<script lang="ts" setup>
  import localSearchIndex from '@localSearchIndex'
  import {
    computedAsync,
    debouncedWatch,
    onKeyStroke,
    useEventListener,
    useLocalStorage,
    useScrollLock,
    useSessionStorage
  } from '@vueuse/core'
  import { useFocusTrap } from '@vueuse/integrations/useFocusTrap'
  import Mark from 'mark.js/src/vanilla.js'
  import MiniSearch, { type SearchResult } from 'minisearch'
  import { dataSymbol, inBrowser, useRouter } from 'vitepress'
  import {
    computed,
    createApp,
    markRaw,
    nextTick,
    onBeforeUnmount,
    onMounted,
    ref,
    shallowRef,
    watch,
    watchEffect,
    type Ref
  } from 'vue'
  import type { ModalTranslations } from 'vitepress/dist/types/local-search'
  import { pathToFile } from 'vitepress/dist/client/app/utils'
  import { escapeRegExp } from 'vitepress/dist/client/shared'
  import { useData } from 'vitepress/dist/client/theme-default/composables/data'
  import { LRUCache } from 'vitepress/dist/client/theme-default/support/lru'
  import { createSearchTranslate } from 'vitepress/dist/client/theme-default/support/translation'
  
  const emit = defineEmits<{
    (e: 'close'): void
  }>()
  
  const el = shallowRef<HTMLElement>()
  const resultsEl = shallowRef<HTMLElement>()
  
  /* Search */
  
  const searchIndexData = shallowRef(localSearchIndex)
  
  // hmr
  if (import.meta.hot) {
    import.meta.hot.accept('/@localSearchIndex', (m) => {
      if (m) {
        searchIndexData.value = m.default
      }
    })
  }
  
  interface Result {
    title: string
    titles: string[]
    text?: string
  }
  
  const vitePressData = useData()
  const { activate } = useFocusTrap(el, {
    immediate: true,
    allowOutsideClick: true,
    clickOutsideDeactivates: true,
    escapeDeactivates: true
  })
  const { localeIndex, theme } = vitePressData
  const searchIndex = computedAsync(async () =>
    markRaw(
      MiniSearch.loadJSON<Result>(
        (await searchIndexData.value[localeIndex.value]?.())?.default,
        {
          fields: ['title', 'titles', 'text'],
          storeFields: ['title', 'titles'],
          searchOptions: {
            fuzzy: 0.2,
            prefix: true,
            boost: { title: 4, text: 2, titles: 1 },
            ...(theme.value.search?.provider === 'local' &&
              theme.value.search.options?.miniSearch?.searchOptions)
          },
          ...(theme.value.search?.provider === 'local' &&
            theme.value.search.options?.miniSearch?.options)
        }
      )
    )
  )
  
  const disableQueryPersistence = computed(() => {
    return (
      theme.value.search?.provider === 'local' &&
      theme.value.search.options?.disableQueryPersistence === true
    )
  })
  
  const filterText = disableQueryPersistence.value
    ? ref('')
    : useSessionStorage('vitepress:local-search-filter', '')
  
  const showDetailedList = useLocalStorage(
    'vitepress:local-search-detailed-list',
    theme.value.search?.provider === 'local' &&
      theme.value.search.options?.detailedView === true
  )
  
  const disableDetailedView = computed(() => {
    return (
      theme.value.search?.provider === 'local' &&
      (theme.value.search.options?.disableDetailedView === true ||
        theme.value.search.options?.detailedView === false)
    )
  })
  
  const buttonText = computed(() => {
    const options = theme.value.search?.options ?? theme.value.algolia
  
    return (
      options?.locales?.[localeIndex.value]?.translations?.button?.buttonText ||
      options?.translations?.button?.buttonText ||
      'Search'
    )
  })
  
  watchEffect(() => {
    if (disableDetailedView.value) {
      showDetailedList.value = false
    }
  })
  
  const results: Ref<(SearchResult & Result)[]> = shallowRef([])
  
  const enableNoResults = ref(false)
  
  watch(filterText, () => {
    enableNoResults.value = false
  })
  
  const mark = computedAsync(async () => {
    if (!resultsEl.value) return
    return markRaw(new Mark(resultsEl.value))
  }, null)
  
  const cache = new LRUCache<string, Map<string, string>>(16) // 16 files
  
  debouncedWatch(
    () => [searchIndex.value, filterText.value, showDetailedList.value] as const,
    async ([index, filterTextValue, showDetailedListValue], old, onCleanup) => {
      if (old?.[0] !== index) {
        // in case of hmr
        cache.clear()
      }
  
      let canceled = false
      onCleanup(() => {
        canceled = true
      })
  
      if (!index) return
  
      // 搜索
      results.value = index
        .search(filterTextValue)
        .slice(0, 16) as (SearchResult & Result)[]
      enableNoResults.value = true
  
      // 高亮
      const mods = showDetailedListValue
        ? await Promise.all(results.value.map((r) => fetchExcerpt(r.id)))
        : []
      if (canceled) return
      for (const { id, mod } of mods) {
        const mapId = id.slice(0, id.indexOf('#'))
        let map = cache.get(mapId)
        if (map) continue
        map = new Map()
        cache.set(mapId, map)
        const comp = mod.default ?? mod
        if (comp?.render || comp?.setup) {
          const app = createApp(comp)
          // 关于缺失组件的静默警告
          app.config.warnHandler = () => {}
          app.provide(dataSymbol, vitePressData)
          Object.defineProperties(app.config.globalProperties, {
            $frontmatter: {
              get() {
                return vitePressData.frontmatter.value
              }
            },
            $params: {
              get() {
                return vitePressData.page.value.params
              }
            }
          })
          const div = document.createElement('div')
          app.mount(div)
          const headings = div.querySelectorAll('h1, h2, h3, h4, h5, h6')
          headings.forEach((el) => {
            const href = el.querySelector('a')?.getAttribute('href')
            const anchor = href?.startsWith('#') && href.slice(1)
            if (!anchor) return
            let html = ''
            while ((el = el.nextElementSibling!) && !/^h[1-6]$/i.test(el.tagName))
              html += el.outerHTML
            map!.set(anchor, html)
          })
          app.unmount()
        }
        if (canceled) return
      }
  
      const terms = new Set<string>()
  
      results.value = results.value.map((r) => {
        const [id, anchor] = r.id.split('#')
        const map = cache.get(id)
        const text = map?.get(anchor) ?? ''
        for (const term in r.match) {
          terms.add(term)
        }

        // 构造包含所有搜索词的正则表达式
        const searchTerms = Object.keys(r.match);
        const searchRegex = new RegExp(searchTerms.join('|'), 'gi');
        // 创建一个新的 DOMParser 对象
        const parser = new DOMParser()
        // 将 text 解析为 DOM
        const doc = parser.parseFromString(text, 'text/html')
        const docMatches = doc.querySelectorAll("p");

        let highlightedParentNode = null;

        for (const docMatche of docMatches) {
          if (searchRegex.test(docMatche.textContent)) {
            highlightedParentNode = docMatche.id;
            const [id, anchor] = r.id.split('#');
            r.id = [id, highlightedParentNode].join('#');
            break; // 退出循环
          }
        }

        return { ...r, text, highlightedParentNode }
      })
  
      await nextTick()
      if (canceled) return
  
      await new Promise((r) => {
        mark.value?.unmark({
          done: () => {
            mark.value?.markRegExp(formMarkRegex(terms), { done: r })
          }
        })
      })
  
      const excerpts = el.value?.querySelectorAll('.result .excerpt') ?? []
      for (const excerpt of excerpts) {
        excerpt
          .querySelector('mark[data-markjs="true"]')
          ?.scrollIntoView({ block: 'center' })
      }
      // FIXME：没有这整个页面滚动到底部
      resultsEl.value?.firstElementChild?.scrollIntoView({ block: 'start' })
    },
    { debounce: 200, immediate: true }
  )
  
  async function fetchExcerpt(id: string) {
    const file = pathToFile(id.slice(0, id.indexOf('#')))
    try {
      if (!file) throw new Error(`Cannot find file for id: ${id}`)
      return { id, mod: await import(/*@vite-ignore*/ file) }
    } catch (e) {
      console.error(e)
      return { id, mod: {} }
    }
  }
  
  /* 搜索输入焦点 */
  
  const searchInput = ref<HTMLInputElement>()
  const disableReset = computed(() => {
    return filterText.value?.length <= 0
  })
  function focusSearchInput(select = true) {
    searchInput.value?.focus()
    select && searchInput.value?.select()
  }
  
  onMounted(() => {
    focusSearchInput()
  })
  
  function onSearchBarClick(event: PointerEvent) {
    if (event.pointerType === 'mouse') {
      focusSearchInput()
    }
  }
  
  /* 搜索键盘选择 */
  
  const selectedIndex = ref(-1)
  const disableMouseOver = ref(false)
  
  watch(results, (r) => {
    selectedIndex.value = r.length ? 0 : -1
    scrollToSelectedResult()
  })
  
  function scrollToSelectedResult() {
    nextTick(() => {
      const selectedEl = document.querySelector('.result.selected')
      if (selectedEl) {
        selectedEl.scrollIntoView({
          block: 'nearest'
        })
      }
    })
  }
  
  onKeyStroke('ArrowUp', (event) => {
    event.preventDefault()
    selectedIndex.value--
    if (selectedIndex.value < 0) {
      selectedIndex.value = results.value.length - 1
    }
    disableMouseOver.value = true
    scrollToSelectedResult()
  })
  
  onKeyStroke('ArrowDown', (event) => {
    event.preventDefault()
    selectedIndex.value++
    if (selectedIndex.value >= results.value.length) {
      selectedIndex.value = 0
    }
    disableMouseOver.value = true
    scrollToSelectedResult()
  })
  
  const router = useRouter()
  
  onKeyStroke('Enter', (e) => {
    if (e.isComposing) return
  
    if (e.target instanceof HTMLButtonElement && e.target.type !== 'submit')
      return
  
    const selectedPackage = results.value[selectedIndex.value]
    if (e.target instanceof HTMLInputElement && !selectedPackage) {
      e.preventDefault()
      return
    }
  
    if (selectedPackage) {
      router.go(selectedPackage.id)
      emit('close')
    }
  })
  
  onKeyStroke('Escape', () => {
    emit('close')
  })
  
  // 翻译
  const defaultTranslations: { modal: ModalTranslations } = {
    modal: {
      displayDetails: 'Display detailed list',
      resetButtonTitle: 'Reset search',
      backButtonTitle: 'Close search',
      noResultsText: 'No results for',
      footer: {
        selectText: 'to select',
        selectKeyAriaLabel: 'enter',
        navigateText: 'to navigate',
        navigateUpKeyAriaLabel: 'up arrow',
        navigateDownKeyAriaLabel: 'down arrow',
        closeText: 'to close',
        closeKeyAriaLabel: 'escape'
      }
    }
  }
  
  const translate = createSearchTranslate(defaultTranslations)
  
  // Back
  
  onMounted(() => {
    // 防止去以前的网站
    window.history.pushState(null, '', null)
  })
  
  useEventListener('popstate', (event) => {
    event.preventDefault()
    emit('close')
  })
  
  /** Lock body */
  const isLocked = useScrollLock(inBrowser ? document.body : null)
  
  onMounted(() => {
    nextTick(() => {
      isLocked.value = true
      nextTick().then(() => activate())
    })
  })
  
  onBeforeUnmount(() => {
    isLocked.value = false
  })
  
  function resetSearch() {
    filterText.value = ''
    nextTick().then(() => focusSearchInput(false))
  }
  
  function formMarkRegex(terms: Set<string>) {
    return new RegExp(
      [...terms]
        .sort((a, b) => b.length - a.length)
        .map((term) => `(${escapeRegExp(term)})`)
        .join('|'),
      'gi'
    )
  }

  // 搜索后高亮
  async function clickSearchResults(p: any) {
    emit('close'); // 关闭搜索结果

    // 等待页面跳转完成
    await nextTick();
    
    const [id, anchor] = p.id.split('#');
    waitForElm(`.content-container main.main div.vp-doc [id="${anchor}"]`).then((elm) => {
        // console.log('Element is ready');
        // console.log("开始高亮");
        markKeywords(p.terms);
        // 如果 p.highlightedParentNode 不为 null，则给对应的节点添加类名
        // parentHighlight = document.querySelector('.custom-parent-highlight')
        // if (parentHighlight) {
        //   parentHighlight.classList.remove("custom-parent-highlight")
        // }
        // if (p.highlightedParentNode) {
        //   document.getElementById(p.highlightedParentNode).classList.add("custom-parent-highlight");
        // } else {
        //   console.error(`Element with id ${p.highlightedParentNode} not found.`);
        // }
        // console.log(elm.textContent);
    });
  }

  function markKeywords(terms: Set<string>) {
    try {
      // 获取 class="content" 的元素
      const contentElement = document.querySelector('.content-container');
      // 检查是否获取到该元素
      if (contentElement) {
        // 创建一个 Mark 实例，目标为 contentElement
        const markInstance = new Mark(contentElement);
        markInstance.unmark({
          done: () => {
            markInstance.markRegExp(formMarkRegex(terms), {
              className: 'custom-terms-highlight', // 使用自定义类名
            });
          }
        });
      } else {
        throw new Error('无法找到 class: .content-container');
      }
    } catch (error) {
      console.error('Error in markKeywords:', error);
    }
  }

  function waitForElm(selector) {
      return new Promise(resolve => {
          if (document.querySelector(selector)) {
              return resolve(document.querySelector(selector));
          }

          const observer = new MutationObserver(mutations => {
              if (document.querySelector(selector)) {
                  // console.log("停止监听");
                  observer.disconnect();
                  resolve(document.querySelector(selector));
              }
          });

          // 配置并启动观察器
          // console.log("开始监听");
          observer.observe(document.body, {
              childList: true,
              subtree: true
          });
      });
  }
  </script>
  
  <template>
    <Teleport to="body">
      <div
        ref="el"
        role="button"
        :aria-owns="results?.length ? 'localsearch-list' : undefined"
        aria-expanded="true"
        aria-haspopup="listbox"
        aria-labelledby="localsearch-label"
        class="VPLocalSearchBox"
      >
        <div class="backdrop" @click="$emit('close')" />
  
        <div class="shell">
          <form
            class="search-bar"
            @pointerup="onSearchBarClick($event)"
            @submit.prevent=""
          >
            <label
              :title="buttonText"
              id="localsearch-label"
              for="localsearch-input"
            >
              <span aria-hidden="true" class="vpi-search search-icon local-search-icon" />
            </label>
            <div class="search-actions before">
              <button
                class="back-button"
                :title="translate('modal.backButtonTitle')"
                @click="$emit('close')"
              >
                <span class="vpi-arrow-left local-search-icon" />
              </button>
            </div>
            <input
              ref="searchInput"
              v-model="filterText"
              :placeholder="buttonText"
              id="localsearch-input"
              aria-labelledby="localsearch-label"
              class="search-input"
            />
            <div class="search-actions">
              <button
                v-if="!disableDetailedView"
                class="toggle-layout-button"
                type="button"
                :class="{ 'detailed-list': showDetailedList }"
                :title="translate('modal.displayDetails')"
                @click="
                  selectedIndex > -1 && (showDetailedList = !showDetailedList)
                "
              >
                <span class="vpi-layout-list local-search-icon" />
              </button>
  
              <button
                class="clear-button"
                type="reset"
                :disabled="disableReset"
                :title="translate('modal.resetButtonTitle')"
                @click="resetSearch"
              >
                <span class="vpi-delete local-search-icon" />
              </button>
            </div>
          </form>
  
          <ul
            ref="resultsEl"
            :id="results?.length ? 'localsearch-list' : undefined"
            :role="results?.length ? 'listbox' : undefined"
            :aria-labelledby="results?.length ? 'localsearch-label' : undefined"
            class="results"
            @mousemove="disableMouseOver = false"
          >
            <li
              v-for="(p, index) in results"
              :key="p.id"
              role="option"
              :aria-selected="selectedIndex === index ? 'true' : 'false'"
            >
              <a
                :href="p.id"
                class="result"
                :class="{
                  selected: selectedIndex === index
                }"
                :aria-label="[...p.titles, p.title].join(' > ')"
                @mouseenter="!disableMouseOver && (selectedIndex = index)"
                @focusin="selectedIndex = index"
                @click="clickSearchResults(p)"
              >
                <div>
                  <div class="titles">
                    <span class="title-icon">#</span>
                    <span
                      v-for="(t, index) in p.titles"
                      :key="index"
                      class="title"
                    >
                      <span class="text" v-html="t" />
                      <span class="vpi-chevron-right local-search-icon" />
                    </span>
                    <span class="title main">
                      <span class="text" v-html="p.title" />
                    </span>
                  </div>
  
                  <div v-if="showDetailedList" class="excerpt-wrapper">
                    <div v-if="p.text" class="excerpt" inert>
                      <div class="vp-doc" v-html="p.text" />
                    </div>
                    <div class="excerpt-gradient-bottom" />
                    <div class="excerpt-gradient-top" />
                  </div>
                </div>
              </a>
            </li>
            <li
              v-if="filterText && !results.length && enableNoResults"
              class="no-results"
            >
              {{ translate('modal.noResultsText') }} "<strong>{{ filterText }}</strong
              >"
            </li>
          </ul>
  
          <div class="search-keyboard-shortcuts">
            <span>
              <kbd :aria-label="translate('modal.footer.navigateUpKeyAriaLabel')">
                <span class="vpi-arrow-up navigate-icon" />
              </kbd>
              <kbd :aria-label="translate('modal.footer.navigateDownKeyAriaLabel')">
                <span class="vpi-arrow-down navigate-icon" />
              </kbd>
              {{ translate('modal.footer.navigateText') }}
            </span>
            <span>
              <kbd :aria-label="translate('modal.footer.selectKeyAriaLabel')">
                <span class="vpi-corner-down-left navigate-icon" />
              </kbd>
              {{ translate('modal.footer.selectText') }}
            </span>
            <span>
              <kbd :aria-label="translate('modal.footer.closeKeyAriaLabel')">esc</kbd>
              {{ translate('modal.footer.closeText') }}
            </span>
          </div>
        </div>
      </div>
    </Teleport>
  </template>
  
  <style scoped>
  .VPLocalSearchBox {
    position: fixed;
    z-index: 100;
    inset: 0;
    display: flex;
  }
  
  .backdrop {
    position: absolute;
    inset: 0;
    background: var(--vp-backdrop-bg-color);
    transition: opacity 0.5s;
  }
  
  .shell {
    position: relative;
    padding: 12px;
    margin: 64px auto;
    display: flex;
    flex-direction: column;
    gap: 16px;
    background: var(--vp-local-search-bg);
    width: min(100vw - 60px, 900px);
    height: min-content;
    max-height: min(100vh - 128px, 900px);
    border-radius: 6px;
  }
  
  @media (max-width: 767px) {
    .shell {
      margin: 0;
      width: 100vw;
      height: 100vh;
      max-height: none;
      border-radius: 0;
    }
  }
  
  .search-bar {
    border: 1px solid var(--vp-c-divider);
    border-radius: 4px;
    display: flex;
    align-items: center;
    padding: 0 12px;
    cursor: text;
  }
  
  @media (max-width: 767px) {
    .search-bar {
      padding: 0 8px;
    }
  }
  
  .search-bar:focus-within {
    border-color: var(--vp-c-brand-1);
  }
  
  .local-search-icon {
    display: block;
    font-size: 18px;
  }
  
  .navigate-icon {
    display: block;
    font-size: 14px;
  }
  
  .search-icon {
    margin: 8px;
  }
  
  @media (max-width: 767px) {
    .search-icon {
      display: none;
    }
  }
  
  .search-input {
    padding: 6px 12px;
    font-size: inherit;
    width: 100%;
  }
  
  @media (max-width: 767px) {
    .search-input {
      padding: 6px 4px;
    }
  }
  
  .search-actions {
    display: flex;
    gap: 4px;
  }
  
  @media (any-pointer: coarse) {
    .search-actions {
      gap: 8px;
    }
  }
  
  @media (min-width: 769px) {
    .search-actions.before {
      display: none;
    }
  }
  
  .search-actions button {
    padding: 8px;
  }
  
  .search-actions button:not([disabled]):hover,
  .toggle-layout-button.detailed-list {
    color: var(--vp-c-brand-1);
  }
  
  .search-actions button.clear-button:disabled {
    opacity: 0.37;
  }
  
  .search-keyboard-shortcuts {
    font-size: 0.8rem;
    opacity: 75%;
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    line-height: 14px;
  }
  
  .search-keyboard-shortcuts span {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  
  @media (max-width: 767px) {
    .search-keyboard-shortcuts {
      display: none;
    }
  }
  
  .search-keyboard-shortcuts kbd {
    background: rgba(128, 128, 128, 0.1);
    border-radius: 4px;
    padding: 3px 6px;
    min-width: 24px;
    display: inline-block;
    text-align: center;
    vertical-align: middle;
    border: 1px solid rgba(128, 128, 128, 0.15);
    box-shadow: 0 2px 2px 0 rgba(0, 0, 0, 0.1);
  }
  
  .results {
    display: flex;
    flex-direction: column;
    gap: 6px;
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior: contain;
  }
  
  .result {
    display: flex;
    align-items: center;
    gap: 8px;
    border-radius: 4px;
    transition: none;
    line-height: 1rem;
    border: solid 2px var(--vp-local-search-result-border);
    outline: none;
  }
  
  .result > div {
    margin: 12px;
    width: 100%;
    overflow: hidden;
  }
  
  @media (max-width: 767px) {
    .result > div {
      margin: 8px;
    }
  }
  
  .titles {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    position: relative;
    z-index: 1001;
    padding: 2px 0;
  }
  
  .title {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  
  .title.main {
    font-weight: 500;
  }
  
  .title-icon {
    opacity: 0.5;
    font-weight: 500;
    color: var(--vp-c-brand-1);
  }
  
  .title svg {
    opacity: 0.5;
  }
  
  .result.selected {
    --vp-local-search-result-bg: var(--vp-local-search-result-selected-bg);
    border-color: var(--vp-local-search-result-selected-border);
  }
  
  .excerpt-wrapper {
    position: relative;
  }
  
  .excerpt {
    opacity: 75%;
    pointer-events: none;
    max-height: 140px;
    overflow: hidden;
    position: relative;
    opacity: 0.5;
    margin-top: 4px;
  }
  
  .result.selected .excerpt {
    opacity: 1;
  }
  
  .excerpt :deep(*) {
    font-size: 0.8rem !important;
    line-height: 130% !important;
  }
  
  .titles :deep(mark),
  .excerpt :deep(mark) {
    background-color: var(--vp-local-search-highlight-bg);
    color: var(--vp-local-search-highlight-text);
    border-radius: 2px;
    padding: 0 2px;
  }
  
  .excerpt :deep(.vp-code-group) .tabs {
    display: none;
  }
  
  .excerpt :deep(.vp-code-group) div[class*='language-'] {
    border-radius: 8px !important;
  }
  
  .excerpt-gradient-bottom {
    position: absolute;
    bottom: -1px;
    left: 0;
    width: 100%;
    height: 8px;
    background: linear-gradient(transparent, var(--vp-local-search-result-bg));
    z-index: 1000;
  }
  
  .excerpt-gradient-top {
    position: absolute;
    top: -1px;
    left: 0;
    width: 100%;
    height: 8px;
    background: linear-gradient(var(--vp-local-search-result-bg), transparent);
    z-index: 1000;
  }
  
  .result.selected .titles,
  .result.selected .title-icon {
    color: var(--vp-c-brand-1) !important;
  }
  
  .no-results {
    font-size: 0.9rem;
    text-align: center;
    padding: 12px;
  }
  
  svg {
    flex: none;
  }
  </style>
  