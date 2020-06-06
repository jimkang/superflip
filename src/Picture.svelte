<script>
import ImageCanvasOps from 'image-canvas-ops';
import ErrorMessage from 'svelte-error-message';
import oknok from 'oknok';

export let index;
export let picture;

//interface Picture {
  //file: File;
  //seconds: number;
  //maxSideLength: number;
  //width: number;
  //height: number;
//}

let error;

if (picture.file) {
  resizeImage();
}

function resizeImage() {
  var canvas = document.createElement('canvas');

  var imageCanvasOps = ImageCanvasOps({ canvas });
  imageCanvasOps.loadFileToCanvas(
    {
      file: picture.file,
      mimeType: picture.file.type,
      maxSideLength: picture.maxSideLength
    },
    oknok({ ok: getImage, nok: setError })
  );

  function getImage() {
    imageCanvasOps.getImageFromCanvas(oknok({ ok: useImage, nok: setError }));
  }

  function useImage(imageBlob) {
    picture.file = imageBlob;
    // Depending on a side effect here: The canvas will
    // be resized when the image is resized.
    picture.width = canvas.width;
    picture.height = canvas.height;
    canvas = undefined;
    // TODO: See if the canvas gets deallocated.
  }

  function setError(theError) {
    error = theError;
    canvas = undefined;
    // TODO: See if the canvas gets deallocated.
  }
}

</script>
<li class="picture">
  <h1>{index}</h1>
  <div>Seconds: <input type="number" step="0.1" bind:value="{picture.seconds}"></div>
  <img src="{URL.createObjectURL(picture.file)}" alt="Picture {index}" class="picture-img" decoding="sync">

  <ErrorMessage error={error} />
</li>
