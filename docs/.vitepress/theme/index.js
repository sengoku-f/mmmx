import DefaultTheme from "vitepress/theme";
import "./custom.css";
import "~/tailwind.css";
import IframeResizer from "@iframe-resizer/vue/iframe-resizer.vue";

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    // 注册自定义全局组件
    app.component("IframeResizer", IframeResizer);
  },
};
