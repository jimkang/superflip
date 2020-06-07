<script>
import Picture from './Picture.svelte';
import { picturesToAnimatedGif } from './pictures-to-animated-gif';
import ep from 'errorback-promise';

$: pictures = [];
let resultGifBlob;

// TODO: Make this user-configurable
let maxSideLength = 1024;

function onImagePickerChange() {
  var newPictures = [];
  for (var i = 0; i < this.files.length; ++i) {
    newPictures.push({
      seconds: 1,
      file: this.files[i],
      maxSideLength,
      width: 0,
      height: 0
    });
  }
  pictures = newPictures;
}

async function onMakeGifClick() {
  var imgNodeList = document.querySelectorAll('.picture-img');
  var { error, values } = await ep(
    picturesToAnimatedGif, { imgNodeList, pictures }
  );

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

  resultGifBlob = values[0];
}
</script>

<section>
  <h3>Pick pictures to add:</h3>
  <input id="image-picker" on:change={onImagePickerChange} type="file" multiple accept="image/*">

  <ul class="picture-list">
    {#each pictures as picture, index }
      <Picture index={index} picture={picture} />
    {/each}
  </ul>

  <button id="make-gif-button" on:click={onMakeGifClick}>Make gif!</button>

  {#if resultGifBlob }
    <img id="result-gif" src={URL.createObjectURL(resultGifBlob, { type: 'image/gif' })} alt="The resulting movie gif!">
    <em>Right-click or hold your finger down over the gif to download it.</em>
  {/if}
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
