import GIF from 'gif.js';

export function picturesToAnimatedGif({ imgNodeList, pictures }, done) {
  if (imgNodeList.length < 1) {
    throw new Error('No pictures passed to picturesToAnimatedGif.');
  }

  var gif = new GIF({
    workers: 2,
    quality: 10
  });

  for (var i = 0; i < imgNodeList.length; ++i) {
    addToGif(imgNodeList[i], pictures[i]);
  }

  gif.on('finished', passBlob);
  // TODO: Is there an error event?
  gif.render();

  function addToGif(img, picture) {
    const delay = picture.seconds * 1000;
    gif.addFrame(img, { delay, copy: true, dispose: 2 });
  }

  function passBlob(blob) {
    done(null, blob);
  }
}
