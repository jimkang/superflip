import GIF from 'gif.js';

export function picturesToAnimatedGif({ imgNodeList, pictures }, done) {
  if (imgNodeList.length < 1) {
    throw new Error('No pictures passed to picturesToAnimatedGif.');
  }

  var enclosingBox = pictures.reduce(getEnclosingBox, { width: 0, height: 0 });

  var gif = new GIF({
    workers: 2,
    quality: 10,
    width: enclosingBox.width,
    height: enclosingBox.height
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

function getEnclosingBox(box, picture) {
  if (picture.width > box.width) {
    box.width = picture.width;
  }
  if (picture.height > box.height) {
    box.height = picture.height;
  }
  return box;
}
