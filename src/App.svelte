<script>
  import Movie from './Movie.svelte';
  import { version } from '../package.json';
</script>

<main>
  <h1>Super Flip-O-Rama!</h1>
  <div>Make your animated gif here! (For free, without being tracked or hassled.)</div>
  <Movie />

  <div id="version-info">{version}</div>
</main>

<footer>
<a href="https://github.com/jimkang/super-flip-o-rama">Source.</a> Powered by <a href="https://github.com/jnordberg/gif.js">gif.js</a>.
</footer>

<style>
	main {
		text-align: center;
		padding: 1em;
		margin: 0 auto;
	}

  footer {
    text-align: center;
  }

	@media (min-width: 640px) {
		main {
			max-width: none;
		}
	}
</style>
