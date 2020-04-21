<script>
import { movie } from './store';

function onAddPicturesClick() {
  movie.set({ pictures: $movie.pictures.concat([{ seconds: 0.5 }]) });
}
</script>

<section>
  <button id="add-pictures-button" on:click={onAddPicturesClick}>Add Pictures</button>

  <ul class="picture-list">
    {#each $movie.pictures as { blob, seconds }, i }
      <li>
        <h1>{i}</h1>
        <div>Seconds: <input type="number" step="0.1" value="{seconds}"></div>
        <img src="{blob}">
      </li>
    {/each}
  </ul>

  <button id="make-gif-button" on:click={onMakeGifClick}>Make gif!</button>

</section>
