<script>
import ImageCanvasOps from 'image-canvas-ops';
import ErrorMessage from 'svelte-error-message';
import oknok from 'oknok';

export let index;
export let picture;

let pictureCopy;

//interface Picture {
  //file: File;
  //seconds: number;
  //maxSideLength: number;
  //width: number;
  //height: number;
//}

let error;

$: if (picture.file) {
  pictureCopy = picture;
  resizeImage();
}

function resizeImage() {
  var canvas = document.createElement('canvas');

  var imageCanvasOps = ImageCanvasOps({ canvas });
  imageCanvasOps.loadFileToCanvas(
    {
      file: pictureCopy.file,
      mimeType: pictureCopy.file.type,
      maxSideLength: pictureCopy.maxSideLength
    },
    oknok({ ok: getImage, nok: setError })
  );

  function getImage() {
    imageCanvasOps.getImageFromCanvas(oknok({ ok: useImage, nok: setError }));
  }

  function useImage(imageBlob) {
    pictureCopy.file = imageBlob;
    // Depending on a side effect here: The canvas will
    // be resized when the image is resized.
    pictureCopy.width = canvas.width;
    pictureCopy.height = canvas.height;
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
  <div>Seconds: <input type="number" step="0.1" bind:value="{pictureCopy.seconds}"></div>
  <img src="{URL.createObjectURL(pictureCopy.file)}" alt="Picture {index}" class="picture-img" decoding="sync">

  <ErrorMessage error={error} />
</li>
