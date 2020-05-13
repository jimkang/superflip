const pageSize = 4096;

import GIFEncoder from 'gif.js/src/GIFEncoder.js';
// TODO: WebWorker
export async function picturesToAnimatedGif({
  canvas,
  width,
  height,
  pictures
}) {
  if (pictures.length < 1) {
    throw new Error('No pictures passed to picturesToAnimatedGif.');
  }

  canvas.width = width;
  canvas.height = height;
  var ctx = canvas.getContext('2d');

  var encoder = new GIFEncoder(width, height);

  encoder.writeHeader();
  // TODO: Parallelize with a pool of canvasses.
  for (let i = 0; i < pictures.length; ++i) {
    await addToGif(pictures[i]);
  }
  encoder.finish();

  var pages = encoder.stream().pages;

  var buffer = new Uint8Array(pages.length * pageSize);
  for (let i = 0; i < pages.length; ++i) {
    buffer.set(pages[i], i * pageSize);
  }
  return buffer;

  async function addToGif(picture) {
    var img = new Image(width, height);
    img.src = URL.createObjectURL(picture.file);
    // On Safari, the image data won't be ready until
    // the next tick.
    await new Promise(waitATick);
    ctx.drawImage(img, 0, 0, width, height);
    encoder.setRepeat(0);
    // TODO: Not sure this is actually working. Look into it.
    encoder.setDelay(picture.seconds * 100);
    var imageDataWrapper = ctx.getImageData(0, 0, width, height);
    encoder.addFrame(imageDataWrapper.data);
  }
}

function waitATick(resolve) {
  setTimeout(resolve, 0);
}
