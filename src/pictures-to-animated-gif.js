import GIF from 'gif.js';

export function picturesToAnimatedGif({ width, height, pictures }, done) {
  if (pictures.length < 1) {
    throw new Error('No pictures passed to picturesToAnimatedGif.');
  }

  var gif = new GIF({
    workers: 2,
    quality: 10
  });

  pictures.forEach(addToGif);
  gif.on('finished', passBlob);
  // TODO: Is there an error event?
  gif.render();

  function addToGif(picture) {
    var img = new Image(width, height);
    img.src = URL.createObjectURL(picture.file);
    const delay = picture.seconds * 1000;
    gif.addFrame(img, { delay });
  }

  function passBlob(blob) {
    done(null, blob);
  }
}
