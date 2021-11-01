<script>
import Picture from './Picture.svelte';
import { picturesToAnimatedGif } from './pictures-to-animated-gif';
import ep from 'errorback-promise';

$: pictures = [];
let resultGifBlob;
let processingInProgress = false;

// TODO: Make this user-configurable
let maxSideLength = 1024;

function onImagePickerChange() {
  var newPictures = [];
  for (var i = 0; i < this.files.length; ++i) {
    newPictures.push({
      seconds: 0.3,
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
  resultGifBlob = null;
  processingInProgress = true;

  var { error, values } = await ep(
    picturesToAnimatedGif, { imgNodeList, pictures }
  );

  processingInProgress = false;

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

<section class="centered-col">
  <h3>Pick pictures to add:</h3>
  <input id="image-picker" on:change={onImagePickerChange} type="file" multiple accept="image/*">

  <ul class="picture-list">
    {#each pictures as picture, index }
      <Picture index={index} picture={picture} />
    {/each}
  </ul>

  <button id="make-gif-button" on:click={onMakeGifClick}>Make gif!</button>

  {#if processingInProgress }
    <div class="processing-message">Building your gif…</div>
  {/if}

  {#if resultGifBlob }
    <div class="result-zone centered-col">
      <img id="result-gif" src={ URL.createObjectURL(resultGifBlob, { type: 'image/gif' }) } alt="The resulting movie gif!">
      <em>Right-click or hold your finger down over the gif to download it.</em>
    </div>
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

.result-zone {
  border: 2px solid #222;
  border-radius: 0.5rem;
}

.processing-message {
  animation: rainbow-saturated 5s infinite;
  border-width: 8px;
  border-style: solid;
  border-radius: 1rem;
  padding: 1rem;
  background-color: #222;
  color: white;
  font-weight: bold;
  font-size: 2em;
  max-width: 20rem;
  margin-left: auto;
  margin-right: auto;
}

@keyframes rainbow-saturated {
  0% { border-color: hsla(202.12, 80%, 70.00%, 1.0) }
  33% { border-color: hsla(351.76, 90%, 70.00%, 1.0) }
  66% { border-color: hsla(120.00, 75%, 60.00%, 1.0) }
  100% { border-color: hsla(202.12, 80%, 70.00%, 1.0) }
}
</style>
