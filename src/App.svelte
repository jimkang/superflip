<script>
  import Movie from './Movie.svelte';
  import { version } from '../package.json';
</script>

<main>
  <h1>Super Flip-O-Rama!</h1>
  <div>Make your stop-motion movie here. (Or just put together an animated gif of any kind.)</div>
  <Movie />

  <div id="version-info">{version}</div>
</main>

<style>
	main {
		text-align: center;
		padding: 1em;
		margin: 0 auto;
	}

	@media (min-width: 640px) {
		main {
			max-width: none;
		}
	}
</style>
