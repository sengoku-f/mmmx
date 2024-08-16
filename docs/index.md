---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: "KSW"
  text: "knowledge base"
  tagline: Store knowledge about design and code
  actions:
    - theme: brand
      text: Markdown Examples
      link: ./示例/markdown-examples
    - theme: alt
      text: API Examples
      link: ./示例/markdown-examples

features:
  - title: 项目 A
    details: 简介
    link: ./示例/markdown-examples
  - title: 项目 B
    details: 简介
  - title: 项目 C
    details: 简介
---

<!-- 自定模块 -->

{{signal}}
<loading></loading>

<script setup>
import { ref, reactive, onMounted, watch ,nextTick} from "vue";
import loading from "../src/loading.vue";
import { signal } from "../src/gobalState.js"; // loading 动画执行状态
import { gsap } from "gsap";


const loge=ref();
const logoBox=ref();
const loadingDom=ref();
const divContent = `
       <div ref="containerBox" class="containerBox2">
           <div class="box-wrapper">
               <div ref="boxFaces" class="box-faces">
                 <div class="box-face box-face1">
                   <p>W</p>
                 </div>
                 <div class="box-face box-face2">
                   <p>P</p>
                 </div>
                 <div class="box-face box-face4">
                   <p>C</p>
                 </div>
                 <div class="box-face box-face3">
                 </div>
               </div>
           </div>
       </div>`;
const tl = gsap.timeline();

watch(signal, (newVal, oldVal) => {
  nextTick(() => {
    if (newVal) {
      loge.value.insertAdjacentHTML('afterbegin', divContent);
      console.log(newVal, loadingDom.value);
      // const addDom = gsap.to(loadingDom.value, {
      //   backgroundColor: "rgba(20,20,20,0.5)",
      //   duration: 0.5,
      //   delay: 2,
      //   onComplete: () => {
      //     loadingDom.value.style.zIndex = 0;
      //     loadingDom.value.style.display = "none";
      //   }
      // })
      // const logoHide = gsap.to(logoBox.value, {
      //   y: '2rem',
      //   opacity: 0,
      //   duration: 1,
      // })
      // tl.add(addDom)
    }

  })
})


onMounted(() => {
  loadingDom.value = document.querySelector(".loading");
  loge.value = document.querySelector(".container > .title");
  logoBox.value = document.querySelector(".containerBox2");
  // loadingDom.value.style.zIndex = 0;
  // loadingDom.value.style.display = "none";

  // loge.value.insertAdjacentHTML('afterbegin', divContent);
})
</script>

<style >
  .Home{
    color:red
  }
  img{
    border-radius: 0;
  }
.container > .title {
  position: relative;
}
.VPImage.logo{
  margin-right: 1rem;
  opacity: 0;
}
.containerBox2 {
  width: 4rem;
  height: 4rem;
  transform: scale(0.5);
  position: absolute;
  top: 50%;
  left: 0;
  transform: translate(-12px, -50%) scale(0.5);
  z-index: 9999;
}
.containerBox2 >.box-wrapper {
  position: absolute;
  perspective: 300px;
  perspective-origin: 100% 32px;
}
.containerBox2 >.box-wrapper >.box-faces {
  width: 4rem;
  position: relative;
  transform-style: preserve-3d;
  transition: 1.5s transform cubic-bezier(0.79, 0, 0.54, 0.99);
  user-select: none;
  pointer-events: none;
}
.box-face {
  position: absolute;
  width: 4rem;
  height: 4rem;
  display: flex;
  justify-content: center;
  align-items: center;

  border: 0.125rem solid black;
  background-color: #fff;
  color: black;
  font-weight: 600;
}
.box-face4 {
  transform: translateZ(-32px) rotateY(180deg);
}
.box-face2 {
  transform: rotateY(-270deg) translateX(32px);
  transform-origin: top right;
}
.box-face3 {
  transform: rotateY(270deg) translateX(-32px);
  transform-origin: center left;
  font-size: 1.5rem;
  background-image: url("./public/Virtual-image.png");
  background-repeat: no-repeat;
  /* 图片自适应宽高 */
  background-size: cover;
}
.box-face1 {
  transform: translateZ(32px);
  /* background-color: #000; */
  color: white;
  box-sizing: border-box;
  overflow: hidden;
  box-shadow: inset 0px 0px 40px rgba(0, 0, 0, .8), 0px 8px 20px rgba(0, 0, 0, .6);
}

.box-face1:after {
  content: '';
  position: absolute;
  top: -30px;
  right: -30px;
  bottom: -30px;
  left: -30px;
  background: conic-gradient(from 180deg at 50% 50%, #12001B -97.5deg, #000000 14.05deg, #040EFF 54.01deg, #8000FF 113.42deg, #00B6B6 185.62deg, #12001B 262.5deg, #000000 374.05deg);
  filter: blur(20px) brightness(1.5);
  z-index: -1;
  animation: 10s move linear infinite;
}
@keyframes move {
  from {
    transform: rotate(180deg);
  }
  to {
    transform: rotate(540deg);
  }
}

.containerBox2 .box-faces:hover {
  transform: rotateY(-270deg);
  transition: 2s transform cubic-bezier(0.79, 0, 0.54, 0.99);
}
</style>
