import { defineConfig } from "vitepress";
import { fileURLToPath, URL } from "node:url";
import path from "node:path";
const paragraphIds = require("./markdown-it-paragraph-ids.cjs");
import { generateSidebar } from "vitepress-sidebar";

import MiniSearch from "minisearch";

const suffixes = (term, minLength) => {
  if (term == null) {
    return;
  }
  const tokens = [];
  for (let i = 0; i <= term.length - minLength; i++) {
    tokens.push(term.slice(i));
  }
  return tokens;
};

const componentsSidebarOptions = {
  documentRootPath: "/docs",
  scanStartPath: "knowledge",
  resolvePath: "/knowledge/",
  useTitleFromFileHeading: true,
  useTitleFromFrontmatter: true,
  useFolderTitleFromIndexFile: true,
  useFolderLinkFromIndexFile: true,
  folderLinkNotIncludesFileName: true,
};

export default defineConfig({
  lang: "zh-CN",
  title: "baobaomi",
  description:
    "基于 KSW Design 设计体系的 Vue3 组件库，用于研发企业级中后台产品。",
  vite: {
    build: {
      rollupOptions: {
        external: ['fontfaceobserver'] // 将 'fontfaceobserver' 模块外部化
      }
    },
    plugins: [],
    resolve: {
      alias: [
        {
          find: /^.*\/VPLocalSearchBox\.vue$/,
          replacement: fileURLToPath(
            new URL("./MyCustomSearchBox.vue", import.meta.url)
          ),
        },
        {
          find: "~",
          replacement: path.resolve(__dirname, "../../"),
        },
      ],
    },
  },

  // 优化搜索引擎结果
  head: [
    ["link", { rel: "icon", type: "image/svg+xml", href: "/klogo.svg" }],
    ["meta", { property: "og:type", content: "website" }],
    ["meta", { property: "og:locale", content: "zh" }],
    [
      "meta",
      {
        property: "og:title",
        content:
          "KSW Design | 基于 KSW Design 设计体系的 Vue3 组件库，用于研发企业级中后台产品。",
      },
    ],
    ["meta", { property: "og:site_name", content: "KSW Design" }],
    // ['meta', { property: 'og:image', content: 'https://vitepress.dev/vitepress-og.jpg' }],
    // ['meta', { property: 'og:url', content: 'https://vitepress.dev/' }],
    // ['script', { src: 'https://cdn.usefathom.com/script.js', 'data-site': 'AZBRSFGG', 'data-spa': 'auto', defer: '' }]
  ],
  themeConfig: {
    logo: { src: "logo.png", width: 32, height: 32 },
    nav: [
      // 创建文章分类集 [1]:  在 head 中创建一个 分类集, 指向文件夹
      { text: "知识库", link: "/knowledge/button" },
      {
        text: "外部链接",
        items: [
          {
            text: "图标库",
            link: "https://sengoku-f.github.io/KSW-vue-icon/",
          },
          {
            text: "故事书",
            link: "https://ksw-storybook.design.donxj.com/",
          },
        ],
      },
      {
        text: "团队",
        link: "/team",
      },
    ],

    sidebar: {
      // 创建文章分类集 [2]: 用插件自动创建文章路由
      "/knowledge/": {
        base: "/knowledge/",
        items: [
          {
            text: "通用",
            items: generateSidebar(componentsSidebarOptions),
          },
        ],
      },
    },

    // 社交链接
    socialLinks: [
      { icon: "github", link: "https://github.com/baobaomi900901" },
    ],

    docFooter: {
      prev: "上一页",
      next: "下一页",
    },

    outline: {
      level: "deep",
      label: "页面导航",
    },

    langMenuLabel: "多语言",
    returnToTopLabel: "回到顶部",
    sidebarMenuLabel: "菜单",
    darkModeSwitchLabel: "主题",
    lightModeSwitchTitle: "切换到浅色模式",
    darkModeSwitchTitle: "切换到深色模式",

    search: {
      provider: "local",
      options: {
        translations: {
          button: {
            buttonText: "搜索文档",
            buttonAriaLabel: "搜索文档",
          },
          modal: {
            noResultsText: "无法找到相关结果",
            resetButtonTitle: "清除查询条件",
            footer: {
              selectText: "选择",
              navigateText: "切换",
              closeText: "关闭",
            },
          },
        },
        // disableDetailedView: true,
        detailedView: true,
        miniSearch: {
          options: {
            processTerm: (term) => suffixes(term, 2),
          },
          searchOptions: {
            processTerm: MiniSearch.getDefault("processTerm"),
          },
        },
      },
    },
  },
  cleanUrls: true,
  markdown: {
    config: (md) => {
      md.use(paragraphIds);
    },
  },
});
