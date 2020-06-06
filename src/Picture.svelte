<script>
export let index;
export let file;
export let seconds;

import ImageCanvasOps from 'image-canvas-ops';
/*
var imageCanvasOps = ImageCanvasOps({
  canvas: document.getElementById('resize-canvas'),
  thumbnailCanvas: document.getElementById('thumbnail-canvas')
});
*/
</script>
<li class="picture">
  <h1>{index}</h1>
  <div>Seconds: <input type="number" step="0.1" bind:value="{seconds}"></div>
  <img src="{URL.createObjectURL(file)}" alt="Picture {index}" class="picture-img" decoding="sync">
</li>
