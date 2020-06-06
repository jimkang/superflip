<script>
import { movie } from './store';
import { Picture } from './picture';
import { picturesToAnimatedGif } from './pictures-to-animated-gif';
import ep from 'errorback-promise';

function onImagePickerChange() {
  var newPictures = [];
  for (var i = 0; i < this.files.length; ++i) {
    newPictures.push(Picture(this.files[i]));
  }
  console.log(newPictures);
  movie.set({ pictures: $movie.pictures.concat(newPictures) });
}

async function onMakeGifClick() {
  // TODO: Resize canvas to picture proportions
  var { error, values } = await ep(picturesToAnimatedGif, { imgNodeList: document.querySelectorAll('.picture-img'), pictures: $movie.pictures });
  if (error) {
    // TODO: Display error.
    console.error('Error while encoding gif.', error);
    return;
  }
  if (values.length < 1) {
    // TODO: Display error.
    console.error('Error while encoding gif.', new Error('No values passed back from picturesToAnimatedGif.'));
    return;
  }

  var resultGifImg = document.getElementById('result-gif');
  resultGifImg.src = URL.createObjectURL(values[0], { type: 'image/gif' });
}

</script>

<section>
  <h3>Pick pictures to add:</h3>
  <input id="image-picker" on:change={onImagePickerChange} type="file" multiple accept="image/*">

  <ul class="picture-list">
    {#each $movie.pictures as { file, seconds }, i }
      <li class="picture">
        <h1>{i}</h1>
        <div>Seconds: <input type="number" step="0.1" bind:value="{seconds}"></div>
        <img src="{URL.createObjectURL(file)}" alt="Picture {i}" class="picture-img" decoding="sync">
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
