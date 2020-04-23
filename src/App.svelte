<script>
  import Movie from './Movie.svelte';
</script>

<main>
  <h1>Super Flip-O-Rama!</h1>
  <div>Make your stop-motion movie here. (Or just put together an animated gif of any kind.)</div>
  <Movie />
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
