<section>
  <h3>Pick pictures to add:</h3>
  <input id="image-picker" on:change={onImagePickerChange} type="file" multiple accept="image/*">

  <ul class="picture-list">
    {#each $movie.pictures as { file, seconds }, i }
      <li class="picture">
        <h1>{i}</h1>
        <div>Seconds: <input type="number" step="0.1" value="{seconds}"></div>
        <img src="{URL.createObjectURL(file)}" alt="Picture {i}">
      </li>
    {/each}
  </ul>

  <button id="make-gif-button" on:click={onMakeGifClick}>Make gif!</button>

  <img id="result-gif" alt="The resulting movie gif!">
  <em>Right-click or hold your finger down over the gif to download it.</em>
</section>

<canvas id="frame-canvas"></canvas>

<style>
.picture-list {
  max-width: 90%;
}

.picture img {
  max-height: 50vh;
}

#frame-canvas {
  display: none;
}
</style>

<script>
import { movie } from './store';
import { Picture } from './picture';
import { picturesToAnimatedGif } from './pictures-to-animated-gif';

function onImagePickerChange() {
  var newPictures = [];
  for (var i = 0; i < this.files.length; ++i) {
    newPictures.push(Picture(this.files[i]));
  }
  console.log(newPictures);
  movie.set({ pictures: $movie.pictures.concat(newPictures) });
}

function onMakeGifClick() {
  var gifBuffer = picturesToAnimatedGif({ canvas: document.getElementById('frame-canvas'), width: 500, height: 500, pictures: $movie.pictures });
  console.log('gifBuffer', gifBuffer);
  var resultGifImg = document.getElementById('result-gif');
  resultGifImg.src = URL.createObjectURL(new Blob([gifBuffer.buffer], { type: 'image/gif' }));
}

</script>
