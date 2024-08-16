<!--
* @description  参数1
* @fileName  loading
* @author userName
* @date 2024-08-14 10:18:49
* @version V3.0.0
!-->
<template>
  <div id="loading" ref="loading" class="loading">
    <div class="move"></div>
    <div class="flex items-center gap-8">
      <div ref="containerBox" class="containerBox move">
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
            <div class="box-face box-face3"></div>
          </div>
        </div>
      </div>
    </div>
    <div ref="progress" class="progress">
      <div class="w-full flex justify-center items-end mb-2">
        <span ref="progressSpan" class="progress-span text-2xl">0</span>
        <span class="ml-1 mb-0.5">%</span>
      </div>
      <div ref="progressLine" class="progressLine"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { signal } from "./gobalState";
import FontFaceObserver from "fontFaceObserver";

// gsap
import { gsap } from "gsap";
const loading = ref();
const containerBox = ref();
const boxFaces = ref();
const progress = ref();
const progressSpan = ref();
const progressLine = ref();
const tl = gsap.timeline({
  paused: true,
});
const numberObject = { value: 0 };

const fontLoading = ref(true);

onMounted(() => {
  const link = document.createElement("link");
  link.href =
    "https://fonts.googleapis.com/css2?family=Foldit:wght@100..900&display=swap";
  link.rel = "stylesheet";
  document.head.appendChild(link);

  const font = new FontFaceObserver("Foldit");
  font.load().then(
    function () {
      // console.log("加载成功");
      tl.play();
    },
    function () {
      console.log("字体加载失败");
      tl.play();
    }
  );

  const Anime_LogoShow = gsap.fromTo(
    containerBox.value,
    {
      opacity: 0,
    },
    {
      y: 0,
      opacity: 1,
      duration: 1.25,
    }
  );
  const Anime_ProgressShow = gsap.fromTo(
    progress.value,
    {
      opacity: 0,
    },
    {
      y: 0,
      opacity: 1,
      duration: 1.25,
    }
  );
  const Anime_LogoRotate = gsap.fromTo(
    boxFaces.value,
    {
      y: "2rem",
      rotateY: 0,
    },
    {
      y: "-2rem",
      rotateY: -360,
      duration: 3,
      ease: "power2.out", // 动画缓动效果
      onStart: () => {
        Anime_ProgressText.play();
      },
      onComplete: () => {
        // 清除 boxFaces.value 的行类样式
        // boxFaces.value.style = "";
      },
    }
  );
  const Anime_ProgressText = gsap.fromTo(
    numberObject,
    {
      value: 0,
    },
    {
      value: 100,
      duration: 3,
      ease: "power2.out", // 动画缓动效果
      paused: true,
      onUpdate: () => {
        // 每次更新时，将当前数值设置到元素的文本内容
        progressSpan.value.textContent = Math.floor(numberObject.value);
        progressLine.value.style.width = `${numberObject.value}%`;
      },
    }
  );
  const Anime_ProgressHide = gsap.to(progress.value, {
    y: "2rem",
    opacity: 0,
    duration: 0.75,
    onComplete: () => {
      progress.value.style.display = "none";
      signal.value = true;
    },
  });
  const Anime_LogoHide = gsap.to(containerBox.value, {
    y: "2rem",
    opacity: 0,
    duration: 1,
  });
  const Anime_BGHide = gsap.to(loading.value, {
    backgroundColor: "rgba(30, 20, 40, 0)",
    duration: 1,
    onComplete: () => {
      loading.value.style.display = "none";
    },
  });
  tl.add(Anime_LogoShow);
  tl.add(Anime_ProgressShow, "-=1");
  tl.add(Anime_LogoRotate, "+=0.5");
  tl.add(Anime_ProgressHide, "+=1");
  tl.add(Anime_LogoHide, "-=0.5");
  tl.add(Anime_BGHide);
});
</script>
<style scoped>
.loading {
  background-color: rgba(30, 20, 40, 1);
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 9999;
}

.containerBox {
  width: 4rem;
  height: 4rem;
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  transition: 1.5s transform cubic-bezier(0.79, 0, 0.54, 0.99);
}
.box-wrapper {
  position: absolute;
  perspective: 300px;
  perspective-origin: 100% 32px;
}
.box-faces {
  width: 4rem;
  position: relative;
  transform-style: preserve-3d;
  /* transition: 1.5s transform cubic-bezier(0.79, 0, 0.54, 0.99); */
  user-select: none;
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
  background-image: url("../docs/public/Virtual-image.png");
  background-repeat: no-repeat;
  /* 图片自适应宽高 */
  background-size: cover;
}
.box-face1 {
  transform: translateZ(32px);
  background-color: black;
  color: white;
}

@keyframes move {
  from {
    transform: rotate(180deg);
  }
  to {
    transform: rotate(540deg);
  }
}

.progress {
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  justify-content: center;
  /* align-items: center; */
  width: 100vw;

  font-family: "Foldit", sans-serif;
  font-optical-sizing: auto;
  font-weight: 500;
  font-style: normal;
}
.progressLine {
  background: red;
  height: 2px;
  width: 0;
}
</style>
