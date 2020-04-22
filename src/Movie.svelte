<script>
import { movie } from './store';
import { Picture } from './picture';

function onImagePickerChange() {
  var newPictures = [];
  for (var i = 0; i < this.files.length; ++i) {
    newPictures.push(Picture(this.files[i]));
  }
  console.log(newPictures);
  movie.set({ pictures: $movie.pictures.concat(newPictures) });
}

</script>

<section>
  <h3>Pick pictures to add:</h3>
  <input id="image-picker" on:change={onImagePickerChange} type="file" multiple accept="image/*">

  <ul class="picture-list">
    {#each $movie.pictures as { file, seconds }, i }
      <li class="picture">
        <h1>{i}</h1>
        <div>Seconds: <input type="number" step="0.1" value="{seconds}"></div>
        <img src="{URL.createObjectURL(file)}">
      </li>
    {/each}
  </ul>

  <button id="make-gif-button" on:click={onMakeGifClick}>Make gif!</button>

</section>
