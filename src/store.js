import { writable } from "svelte/store";

var movieDict = { pictures: [] };

export const movie = writable(movieDict);
