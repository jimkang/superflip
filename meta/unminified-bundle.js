var app = (function() {
  "use strict";

  function noop() {}
  function run(fn) {
    return fn();
  }
  function blank_object() {
    return Object.create(null);
  }
  function run_all(fns) {
    fns.forEach(run);
  }
  function is_function(thing) {
    return typeof thing === "function";
  }
  function safe_not_equal(a, b) {
    return a != a
      ? b == b
      : a !== b || ((a && typeof a === "object") || typeof a === "function");
  }
  // Subscription convenience function
  function subscribe(store, ...callbacks) {
    if (store == null) {
      return noop;
    }
    const unsub = store.subscribe(...callbacks);
    return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
  }
  // What is $$ ?
  function component_subscribe(component, store, callback) {
    component.$$.on_destroy.push(subscribe(store, callback));
  }

  function append(target, node) {
    target.appendChild(node);
  }
  function insert(target, node, anchor) {
    target.insertBefore(node, anchor || null);
  }
  function detach(node) {
    node.parentNode.removeChild(node);
  }
  function destroy_each(iterations, detaching) {
    for (let i = 0; i < iterations.length; i += 1) {
      if (iterations[i]) iterations[i].d(detaching);
    }
  }
  function element(name) {
    return document.createElement(name);
  }
  function text(data) {
    return document.createTextNode(data);
  }
  function space() {
    return text(" ");
  }
  function listen(node, event, handler, options) {
    node.addEventListener(event, handler, options);
    return () => node.removeEventListener(event, handler, options);
  }
  function attr(node, attribute, value) {
    if (value == null) node.removeAttribute(attribute);
    else if (node.getAttribute(attribute) !== value)
      node.setAttribute(attribute, value);
  }
  function to_number(value) {
    return value === "" ? undefined : +value;
  }
  function children(element) {
    return Array.from(element.childNodes);
  }
  function set_input_value(input, value) {
    if (value != null || input.value) {
      input.value = value;
    }
  }

  let current_component;
  function set_current_component(component) {
    current_component = component;
  }

  const dirty_components = [];
  const binding_callbacks = [];
  const render_callbacks = [];
  const flush_callbacks = [];
  const resolved_promise = Promise.resolve();
  let update_scheduled = false;
  function schedule_update() {
    if (!update_scheduled) {
      update_scheduled = true;
      resolved_promise.then(flush);
    }
  }
  function add_render_callback(fn) {
    render_callbacks.push(fn);
  }
  let flushing = false;
  const seen_callbacks = new Set();
  function flush() {
    if (flushing) return;
    flushing = true;
    do {
      // first, call beforeUpdate functions
      // and update components
      for (let i = 0; i < dirty_components.length; i += 1) {
        const component = dirty_components[i];
        set_current_component(component);
        update(component.$$);
      }
      dirty_components.length = 0;
      while (binding_callbacks.length) binding_callbacks.pop()();
      // then, once components are updated, call
      // afterUpdate functions. This may cause
      // subsequent updates...
      for (let i = 0; i < render_callbacks.length; i += 1) {
        const callback = render_callbacks[i];
        if (!seen_callbacks.has(callback)) {
          // ...so guard against infinite loops
          seen_callbacks.add(callback);
          callback();
        }
      }
      render_callbacks.length = 0;
    } while (dirty_components.length);
    while (flush_callbacks.length) {
      flush_callbacks.pop()();
    }
    update_scheduled = false;
    flushing = false;
    seen_callbacks.clear();
  }
  function update($$) {
    if ($$.fragment !== null) {
      $$.update();
      run_all($$.before_update);
      const dirty = $$.dirty;
      $$.dirty = [-1];
      $$.fragment && $$.fragment.p($$.ctx, dirty);
      $$.after_update.forEach(add_render_callback);
    }
  }
  const outroing = new Set();
  let outros;
  function transition_in(block, local) {
    if (block && block.i) {
      outroing.delete(block);
      block.i(local);
    }
  }
  function transition_out(block, local, detach, callback) {
    if (block && block.o) {
      if (outroing.has(block)) return;
      outroing.add(block);
      outros.c.push(() => {
        outroing.delete(block);
        if (callback) {
          if (detach) block.d(1);
          callback();
        }
      });
      block.o(local);
    }
  }
  function create_component(block) {
    block && block.c();
  }
  function mount_component(component, target, anchor) {
    const { fragment, on_mount, on_destroy, after_update } = component.$$;
    fragment && fragment.m(target, anchor);
    // onMount happens before the initial afterUpdate
    add_render_callback(() => {
      const new_on_destroy = on_mount.map(run).filter(is_function);
      if (on_destroy) {
        on_destroy.push(...new_on_destroy);
      } else {
        // Edge case - component was destroyed immediately,
        // most likely as a result of a binding initialising
        run_all(new_on_destroy);
      }
      component.$$.on_mount = [];
    });
    after_update.forEach(add_render_callback);
  }
  function destroy_component(component, detaching) {
    const $$ = component.$$;
    if ($$.fragment !== null) {
      run_all($$.on_destroy);
      $$.fragment && $$.fragment.d(detaching);
      // TODO null out other refs, including component.$$ (but need to
      // preserve final state?)
      $$.on_destroy = $$.fragment = null;
      $$.ctx = [];
    }
  }
  function make_dirty(component, i) {
    if (component.$$.dirty[0] === -1) {
      dirty_components.push(component);
      schedule_update();
      component.$$.dirty.fill(0);
    }
    component.$$.dirty[(i / 31) | 0] |= 1 << i % 31;
  }
  function init(
    component,
    options,
    instance,
    create_fragment,
    not_equal,
    props,
    dirty = [-1]
  ) {
    const parent_component = current_component;
    set_current_component(component);
    const prop_values = options.props || {};
    const $$ = (component.$$ = {
      fragment: null,
      ctx: null,
      // state
      props,
      update: noop,
      not_equal,
      bound: blank_object(),
      // lifecycle
      on_mount: [],
      on_destroy: [],
      before_update: [],
      after_update: [],
      context: new Map(parent_component ? parent_component.$$.context : []),
      // everything else
      callbacks: blank_object(),
      dirty
    });
    let ready = false;
    $$.ctx = instance
      ? instance(component, prop_values, (i, ret, ...rest) => {
          const value = rest.length ? rest[0] : ret;
          if ($$.ctx && not_equal($$.ctx[i], ($$.ctx[i] = value))) {
            if ($$.bound[i]) $$.bound[i](value);
            if (ready) make_dirty(component, i);
          }
          return ret;
        })
      : [];
    $$.update();
    ready = true;
    run_all($$.before_update);
    // `false` as a special case of no DOM component
    $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
    if (options.target) {
      if (options.hydrate) {
        const nodes = children(options.target);
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        $$.fragment && $$.fragment.l(nodes);
        nodes.forEach(detach);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        $$.fragment && $$.fragment.c();
      }
      if (options.intro) transition_in(component.$$.fragment);
      mount_component(component, options.target, options.anchor);
      flush();
    }
    set_current_component(parent_component);
  }
  class SvelteComponent {
    $destroy() {
      destroy_component(this, 1);
      this.$destroy = noop;
    }
    $on(type, callback) {
      const callbacks =
        this.$$.callbacks[type] || (this.$$.callbacks[type] = []);
      callbacks.push(callback);
      return () => {
        const index = callbacks.indexOf(callback);
        if (index !== -1) callbacks.splice(index, 1);
      };
    }
    $set() {
      // overridden by instance, if it has props
    }
  }

  const subscriber_queue = [];
  /**
   * Create a `Writable` store that allows both updating and reading by subscription.
   * @param {*=}value initial value
   * @param {StartStopNotifier=}start start and stop notifications for subscriptions
   */
  function writable(value, start = noop) {
    let stop;
    const subscribers = [];
    function set(new_value) {
      if (safe_not_equal(value, new_value)) {
        value = new_value;
        if (stop) {
          // store is ready
          const run_queue = !subscriber_queue.length;
          for (let i = 0; i < subscribers.length; i += 1) {
            const s = subscribers[i];
            s[1]();
            subscriber_queue.push(s, value);
          }
          if (run_queue) {
            for (let i = 0; i < subscriber_queue.length; i += 2) {
              subscriber_queue[i][0](subscriber_queue[i + 1]);
            }
            subscriber_queue.length = 0;
          }
        }
      }
    }
    function update(fn) {
      set(fn(value));
    }
    function subscribe(run, invalidate = noop) {
      const subscriber = [run, invalidate];
      subscribers.push(subscriber);
      if (subscribers.length === 1) {
        stop = start(set) || noop;
      }
      run(value);
      return () => {
        const index = subscribers.indexOf(subscriber);
        if (index !== -1) {
          subscribers.splice(index, 1);
        }
        if (subscribers.length === 0) {
          stop();
          stop = null;
        }
      };
    }
    return { set, update, subscribe };
  }

  // User code!
  var movieDict = { pictures: [] };

  const movie = writable(movieDict);

  function Picture(file) {
    return {
      file,
      seconds: 0.5
    };
  }

  /* NeuQuant Neural-Net Quantization Algorithm
   * ------------------------------------------
   *
   * Copyright (c) 1994 Anthony Dekker
   *
   * NEUQUANT Neural-Net quantization algorithm by Anthony Dekker, 1994.
   * See "Kohonen neural networks for optimal colour quantization"
   * in "Network: Computation in Neural Systems" Vol. 5 (1994) pp 351-367.
   * for a discussion of the algorithm.
   * See also  http://members.ozemail.com.au/~dekker/NEUQUANT.HTML
   *
   * Any party obtaining a copy of these files from the author, directly or
   * indirectly, is granted, free of charge, a full and unrestricted irrevocable,
   * world-wide, paid up, royalty-free, nonexclusive right and license to deal
   * in this software and documentation files (the "Software"), including without
   * limitation the rights to use, copy, modify, merge, publish, distribute, sublicense,
   * and/or sell copies of the Software, and to permit persons who receive
   * copies from any such party to do so, with the only requirement being
   * that this copyright notice remain intact.
   *
   * (JavaScript port 2012 by Johan Nordberg)
   */

  var ncycles = 100; // number of learning cycles
  var netsize = 256; // number of colors used
  var maxnetpos = netsize - 1;

  // defs for freq and bias
  var netbiasshift = 4; // bias for colour values
  var intbiasshift = 16; // bias for fractions
  var intbias = 1 << intbiasshift;
  var gammashift = 10;
  var betashift = 10;
  var beta = intbias >> betashift; /* beta = 1/1024 */
  var betagamma = intbias << (gammashift - betashift);

  // defs for decreasing radius factor
  var initrad = netsize >> 3; // for 256 cols, radius starts
  var radiusbiasshift = 6; // at 32.0 biased by 6 bits
  var radiusbias = 1 << radiusbiasshift;
  var initradius = initrad * radiusbias; //and decreases by a
  var radiusdec = 30; // factor of 1/30 each cycle

  // defs for decreasing alpha factor
  var alphabiasshift = 10; // alpha starts at 1.0
  var initalpha = 1 << alphabiasshift;

  /* radbias and alpharadbias used for radpower calculation */
  var radbiasshift = 8;
  var radbias = 1 << radbiasshift;
  var alpharadbshift = alphabiasshift + radbiasshift;
  var alpharadbias = 1 << alpharadbshift;

  // four primes near 500 - assume no image has a length so large that it is
  // divisible by all four primes
  var prime1 = 499;
  var prime2 = 491;
  var prime3 = 487;
  var prime4 = 503;
  var minpicturebytes = 3 * prime4;

  /*
      Constructor: NeuQuant

      Arguments:

      pixels - array of pixels in RGB format
      samplefac - sampling factor 1 to 30 where lower is better quality

      >
      > pixels = [r, g, b, r, g, b, r, g, b, ..]
      >
    */
  function NeuQuant(pixels, samplefac) {
    var network; // int[netsize][4]
    var netindex; // for network lookup - really 256

    // bias and freq arrays for learning
    var bias;
    var freq;
    var radpower;

    /*
        Private Method: init

        sets up arrays
      */
    function init() {
      network = [];
      netindex = new Int32Array(256);
      bias = new Int32Array(netsize);
      freq = new Int32Array(netsize);
      radpower = new Int32Array(netsize >> 3);

      var i, v;
      for (i = 0; i < netsize; i++) {
        v = (i << (netbiasshift + 8)) / netsize;
        network[i] = new Float64Array([v, v, v, 0]);
        //network[i] = [v, v, v, 0]
        freq[i] = intbias / netsize;
        bias[i] = 0;
      }
    }

    /*
        Private Method: unbiasnet

        unbiases network to give byte values 0..255 and record position i to prepare for sort
      */
    function unbiasnet() {
      for (var i = 0; i < netsize; i++) {
        network[i][0] >>= netbiasshift;
        network[i][1] >>= netbiasshift;
        network[i][2] >>= netbiasshift;
        network[i][3] = i; // record color number
      }
    }

    /*
        Private Method: altersingle

        moves neuron *i* towards biased (b,g,r) by factor *alpha*
      */
    function altersingle(alpha, i, b, g, r) {
      network[i][0] -= (alpha * (network[i][0] - b)) / initalpha;
      network[i][1] -= (alpha * (network[i][1] - g)) / initalpha;
      network[i][2] -= (alpha * (network[i][2] - r)) / initalpha;
    }

    /*
        Private Method: alterneigh

        moves neurons in *radius* around index *i* towards biased (b,g,r) by factor *alpha*
      */
    function alterneigh(radius, i, b, g, r) {
      var lo = Math.abs(i - radius);
      var hi = Math.min(i + radius, netsize);

      var j = i + 1;
      var k = i - 1;
      var m = 1;

      var p, a;
      while (j < hi || k > lo) {
        a = radpower[m++];

        if (j < hi) {
          p = network[j++];
          p[0] -= (a * (p[0] - b)) / alpharadbias;
          p[1] -= (a * (p[1] - g)) / alpharadbias;
          p[2] -= (a * (p[2] - r)) / alpharadbias;
        }

        if (k > lo) {
          p = network[k--];
          p[0] -= (a * (p[0] - b)) / alpharadbias;
          p[1] -= (a * (p[1] - g)) / alpharadbias;
          p[2] -= (a * (p[2] - r)) / alpharadbias;
        }
      }
    }

    /*
        Private Method: contest

        searches for biased BGR values
      */
    function contest(b, g, r) {
      /*
          finds closest neuron (min dist) and updates freq
          finds best neuron (min dist-bias) and returns position
          for frequently chosen neurons, freq[i] is high and bias[i] is negative
          bias[i] = gamma * ((1 / netsize) - freq[i])
        */

      var bestd = ~(1 << 31);
      var bestbiasd = bestd;
      var bestpos = -1;
      var bestbiaspos = bestpos;

      var i, n, dist, biasdist, betafreq;
      for (i = 0; i < netsize; i++) {
        n = network[i];

        dist = Math.abs(n[0] - b) + Math.abs(n[1] - g) + Math.abs(n[2] - r);
        if (dist < bestd) {
          bestd = dist;
          bestpos = i;
        }

        biasdist = dist - (bias[i] >> (intbiasshift - netbiasshift));
        if (biasdist < bestbiasd) {
          bestbiasd = biasdist;
          bestbiaspos = i;
        }

        betafreq = freq[i] >> betashift;
        freq[i] -= betafreq;
        bias[i] += betafreq << gammashift;
      }

      freq[bestpos] += beta;
      bias[bestpos] -= betagamma;

      return bestbiaspos;
    }

    /*
        Private Method: inxbuild

        sorts network and builds netindex[0..255]
      */
    function inxbuild() {
      var i,
        j,
        p,
        q,
        smallpos,
        smallval,
        previouscol = 0,
        startpos = 0;
      for (i = 0; i < netsize; i++) {
        p = network[i];
        smallpos = i;
        smallval = p[1]; // index on g
        // find smallest in i..netsize-1
        for (j = i + 1; j < netsize; j++) {
          q = network[j];
          if (q[1] < smallval) {
            // index on g
            smallpos = j;
            smallval = q[1]; // index on g
          }
        }
        q = network[smallpos];
        // swap p (i) and q (smallpos) entries
        if (i != smallpos) {
          j = q[0];
          q[0] = p[0];
          p[0] = j;
          j = q[1];
          q[1] = p[1];
          p[1] = j;
          j = q[2];
          q[2] = p[2];
          p[2] = j;
          j = q[3];
          q[3] = p[3];
          p[3] = j;
        }
        // smallval entry is now in position i

        if (smallval != previouscol) {
          netindex[previouscol] = (startpos + i) >> 1;
          for (j = previouscol + 1; j < smallval; j++) netindex[j] = i;
          previouscol = smallval;
          startpos = i;
        }
      }
      netindex[previouscol] = (startpos + maxnetpos) >> 1;
      for (j = previouscol + 1; j < 256; j++) netindex[j] = maxnetpos; // really 256
    }

    /*
        Private Method: inxsearch

        searches for BGR values 0..255 and returns a color index
      */
    function inxsearch(b, g, r) {
      var a, p, dist;

      var bestd = 1000; // biggest possible dist is 256*3
      var best = -1;

      var i = netindex[g]; // index on g
      var j = i - 1; // start at netindex[g] and work outwards

      while (i < netsize || j >= 0) {
        if (i < netsize) {
          p = network[i];
          dist = p[1] - g; // inx key
          if (dist >= bestd) i = netsize;
          // stop iter
          else {
            i++;
            if (dist < 0) dist = -dist;
            a = p[0] - b;
            if (a < 0) a = -a;
            dist += a;
            if (dist < bestd) {
              a = p[2] - r;
              if (a < 0) a = -a;
              dist += a;
              if (dist < bestd) {
                bestd = dist;
                best = p[3];
              }
            }
          }
        }
        if (j >= 0) {
          p = network[j];
          dist = g - p[1]; // inx key - reverse dif
          if (dist >= bestd) j = -1;
          // stop iter
          else {
            j--;
            if (dist < 0) dist = -dist;
            a = p[0] - b;
            if (a < 0) a = -a;
            dist += a;
            if (dist < bestd) {
              a = p[2] - r;
              if (a < 0) a = -a;
              dist += a;
              if (dist < bestd) {
                bestd = dist;
                best = p[3];
              }
            }
          }
        }
      }

      return best;
    }

    /*
        Private Method: learn

        "Main Learning Loop"
      */
    function learn() {
      var i;

      var lengthcount = pixels.length;
      var alphadec = 30 + (samplefac - 1) / 3;
      var samplepixels = lengthcount / (3 * samplefac);
      var delta = ~~(samplepixels / ncycles);
      var alpha = initalpha;
      var radius = initradius;

      var rad = radius >> radiusbiasshift;

      if (rad <= 1) rad = 0;
      for (i = 0; i < rad; i++)
        radpower[i] = alpha * (((rad * rad - i * i) * radbias) / (rad * rad));

      var step;
      if (lengthcount < minpicturebytes) {
        samplefac = 1;
        step = 3;
      } else if (lengthcount % prime1 !== 0) {
        step = 3 * prime1;
      } else if (lengthcount % prime2 !== 0) {
        step = 3 * prime2;
      } else if (lengthcount % prime3 !== 0) {
        step = 3 * prime3;
      } else {
        step = 3 * prime4;
      }

      var b, g, r, j;
      var pix = 0; // current pixel

      i = 0;
      while (i < samplepixels) {
        b = (pixels[pix] & 0xff) << netbiasshift;
        g = (pixels[pix + 1] & 0xff) << netbiasshift;
        r = (pixels[pix + 2] & 0xff) << netbiasshift;

        j = contest(b, g, r);

        altersingle(alpha, j, b, g, r);
        if (rad !== 0) alterneigh(rad, j, b, g, r); // alter neighbours

        pix += step;
        if (pix >= lengthcount) pix -= lengthcount;

        i++;

        if (delta === 0) delta = 1;
        if (i % delta === 0) {
          alpha -= alpha / alphadec;
          radius -= radius / radiusdec;
          rad = radius >> radiusbiasshift;

          if (rad <= 1) rad = 0;
          for (j = 0; j < rad; j++)
            radpower[j] =
              alpha * (((rad * rad - j * j) * radbias) / (rad * rad));
        }
      }
    }

    /*
        Method: buildColormap

        1. initializes network
        2. trains it
        3. removes misconceptions
        4. builds colorindex
      */
    function buildColormap() {
      init();
      learn();
      unbiasnet();
      inxbuild();
    }
    this.buildColormap = buildColormap;

    /*
        Method: getColormap

        builds colormap from the index

        returns array in the format:

        >
        > [r, g, b, r, g, b, r, g, b, ..]
        >
      */
    function getColormap() {
      var map = [];
      var index = [];

      for (var i = 0; i < netsize; i++) index[network[i][3]] = i;

      var k = 0;
      for (var l = 0; l < netsize; l++) {
        var j = index[l];
        map[k++] = network[j][0];
        map[k++] = network[j][1];
        map[k++] = network[j][2];
      }
      return map;
    }
    this.getColormap = getColormap;

    /*
        Method: lookupRGB

        looks for the closest *r*, *g*, *b* color in the map and
        returns its index
      */
    this.lookupRGB = inxsearch;
  }

  var TypedNeuQuant = NeuQuant;

  /*
      LZWEncoder.js

      Authors
      Kevin Weiner (original Java version - kweiner@fmsware.com)
      Thibault Imbert (AS3 version - bytearray.org)
      Johan Nordberg (JS version - code@johan-nordberg.com)

      Acknowledgements
      GIFCOMPR.C - GIF Image compression routines
      Lempel-Ziv compression based on 'compress'. GIF modifications by
      David Rowley (mgardi@watdcsu.waterloo.edu)
      GIF Image compression - modified 'compress'
      Based on: compress.c - File compression ala IEEE Computer, June 1984.
      By Authors: Spencer W. Thomas (decvax!harpo!utah-cs!utah-gr!thomas)
      Jim McKie (decvax!mcvax!jim)
      Steve Davies (decvax!vax135!petsd!peora!srd)
      Ken Turkowski (decvax!decwrl!turtlevax!ken)
      James A. Woods (decvax!ihnp4!ames!jaw)
      Joe Orost (decvax!vax135!petsd!joe)
    */

  var EOF = -1;
  var BITS = 12;
  var HSIZE = 5003; // 80% occupancy
  var masks = [
    0x0000,
    0x0001,
    0x0003,
    0x0007,
    0x000f,
    0x001f,
    0x003f,
    0x007f,
    0x00ff,
    0x01ff,
    0x03ff,
    0x07ff,
    0x0fff,
    0x1fff,
    0x3fff,
    0x7fff,
    0xffff
  ];

  function LZWEncoder(width, height, pixels, colorDepth) {
    var remaining;
    var curPixel;
    var n_bits;
    var initCodeSize = Math.max(2, colorDepth);

    var accum = new Uint8Array(256);
    var htab = new Int32Array(HSIZE);
    var codetab = new Int32Array(HSIZE);

    var cur_accum,
      cur_bits = 0;
    var a_count;
    var free_ent = 0; // first unused entry
    var maxcode;

    // block compression parameters -- after all codes are used up,
    // and compression rate changes, start over.
    var clear_flg = false;

    // Algorithm: use open addressing double hashing (no chaining) on the
    // prefix code / next character combination. We do a variant of Knuth's
    // algorithm D (vol. 3, sec. 6.4) along with G. Knott's relatively-prime
    // secondary probe. Here, the modular division first probe is gives way
    // to a faster exclusive-or manipulation. Also do block compression with
    // an adaptive reset, whereby the code table is cleared when the compression
    // ratio decreases, but after the table fills. The variable-length output
    // codes are re-sized at this point, and a special CLEAR code is generated
    // for the decompressor. Late addition: construct the table according to
    // file size for noticeable speed improvement on small files. Please direct
    // questions about this implementation to ames!jaw.
    var g_init_bits, ClearCode, EOFCode;

    // Add a character to the end of the current packet, and if it is 254
    // characters, flush the packet to disk.
    function char_out(c, outs) {
      accum[a_count++] = c;
      if (a_count >= 254) flush_char(outs);
    }

    // Clear out the hash table
    // table clear for block compress
    function cl_block(outs) {
      cl_hash(HSIZE);
      free_ent = ClearCode + 2;
      clear_flg = true;
      output(ClearCode, outs);
    }

    // Reset code table
    function cl_hash(hsize) {
      for (var i = 0; i < hsize; ++i) htab[i] = -1;
    }

    function compress(init_bits, outs) {
      var fcode, c, i, ent, disp, hsize_reg, hshift;

      // Set up the globals: g_init_bits - initial number of bits
      g_init_bits = init_bits;

      // Set up the necessary values
      clear_flg = false;
      n_bits = g_init_bits;
      maxcode = MAXCODE(n_bits);

      ClearCode = 1 << (init_bits - 1);
      EOFCode = ClearCode + 1;
      free_ent = ClearCode + 2;

      a_count = 0; // clear packet

      ent = nextPixel();

      hshift = 0;
      for (fcode = HSIZE; fcode < 65536; fcode *= 2) ++hshift;
      hshift = 8 - hshift; // set hash code range bound
      hsize_reg = HSIZE;
      cl_hash(hsize_reg); // clear hash table

      output(ClearCode, outs);

      outer_loop: while ((c = nextPixel()) != EOF) {
        fcode = (c << BITS) + ent;
        i = (c << hshift) ^ ent; // xor hashing
        if (htab[i] === fcode) {
          ent = codetab[i];
          continue;
        } else if (htab[i] >= 0) {
          // non-empty slot
          disp = hsize_reg - i; // secondary hash (after G. Knott)
          if (i === 0) disp = 1;
          do {
            if ((i -= disp) < 0) i += hsize_reg;
            if (htab[i] === fcode) {
              ent = codetab[i];
              continue outer_loop;
            }
          } while (htab[i] >= 0);
        }
        output(ent, outs);
        ent = c;
        if (free_ent < 1 << BITS) {
          codetab[i] = free_ent++; // code -> hashtable
          htab[i] = fcode;
        } else {
          cl_block(outs);
        }
      }

      // Put out the final code.
      output(ent, outs);
      output(EOFCode, outs);
    }

    function encode(outs) {
      outs.writeByte(initCodeSize); // write "initial code size" byte
      remaining = width * height; // reset navigation variables
      curPixel = 0;
      compress(initCodeSize + 1, outs); // compress and write the pixel data
      outs.writeByte(0); // write block terminator
    }

    // Flush the packet to disk, and reset the accumulator
    function flush_char(outs) {
      if (a_count > 0) {
        outs.writeByte(a_count);
        outs.writeBytes(accum, 0, a_count);
        a_count = 0;
      }
    }

    function MAXCODE(n_bits) {
      return (1 << n_bits) - 1;
    }

    // Return the next pixel from the image
    function nextPixel() {
      if (remaining === 0) return EOF;
      --remaining;
      var pix = pixels[curPixel++];
      return pix & 0xff;
    }

    function output(code, outs) {
      cur_accum &= masks[cur_bits];

      if (cur_bits > 0) cur_accum |= code << cur_bits;
      else cur_accum = code;

      cur_bits += n_bits;

      while (cur_bits >= 8) {
        char_out(cur_accum & 0xff, outs);
        cur_accum >>= 8;
        cur_bits -= 8;
      }

      // If the next entry is going to be too big for the code size,
      // then increase it, if possible.
      if (free_ent > maxcode || clear_flg) {
        if (clear_flg) {
          maxcode = MAXCODE((n_bits = g_init_bits));
          clear_flg = false;
        } else {
          ++n_bits;
          if (n_bits == BITS) maxcode = 1 << BITS;
          else maxcode = MAXCODE(n_bits);
        }
      }

      if (code == EOFCode) {
        // At EOF, write the rest of the buffer.
        while (cur_bits > 0) {
          char_out(cur_accum & 0xff, outs);
          cur_accum >>= 8;
          cur_bits -= 8;
        }
        flush_char(outs);
      }
    }

    this.encode = encode;
  }

  var LZWEncoder_1 = LZWEncoder;

  /*
      GIFEncoder.js

      Authors
      Kevin Weiner (original Java version - kweiner@fmsware.com)
      Thibault Imbert (AS3 version - bytearray.org)
      Johan Nordberg (JS version - code@johan-nordberg.com)
    */

  function ByteArray() {
    this.page = -1;
    this.pages = [];
    this.newPage();
  }

  ByteArray.pageSize = 4096;
  ByteArray.charMap = {};

  for (var i = 0; i < 256; i++) ByteArray.charMap[i] = String.fromCharCode(i);

  ByteArray.prototype.newPage = function() {
    this.pages[++this.page] = new Uint8Array(ByteArray.pageSize);
    this.cursor = 0;
  };

  ByteArray.prototype.getData = function() {
    var rv = "";
    for (var p = 0; p < this.pages.length; p++) {
      for (var i = 0; i < ByteArray.pageSize; i++) {
        rv += ByteArray.charMap[this.pages[p][i]];
      }
    }
    return rv;
  };

  ByteArray.prototype.writeByte = function(val) {
    if (this.cursor >= ByteArray.pageSize) this.newPage();
    this.pages[this.page][this.cursor++] = val;
  };

  ByteArray.prototype.writeUTFBytes = function(string) {
    for (var l = string.length, i = 0; i < l; i++)
      this.writeByte(string.charCodeAt(i));
  };

  ByteArray.prototype.writeBytes = function(array, offset, length) {
    for (var l = length || array.length, i = offset || 0; i < l; i++)
      this.writeByte(array[i]);
  };

  function GIFEncoder(width, height) {
    // image size
    this.width = ~~width;
    this.height = ~~height;

    // transparent color if given
    this.transparent = null;

    // transparent index in color table
    this.transIndex = 0;

    // -1 = no repeat, 0 = forever. anything else is repeat count
    this.repeat = -1;

    // frame delay (hundredths)
    this.delay = 0;

    this.image = null; // current frame
    this.pixels = null; // BGR byte array from frame
    this.indexedPixels = null; // converted frame indexed to palette
    this.colorDepth = null; // number of bit planes
    this.colorTab = null; // RGB palette
    this.neuQuant = null; // NeuQuant instance that was used to generate this.colorTab.
    this.usedEntry = new Array(); // active palette entries
    this.palSize = 7; // color table size (bits-1)
    this.dispose = -1; // disposal code (-1 = use default)
    this.firstFrame = true;
    this.sample = 10; // default sample interval for quantizer
    this.dither = false; // default dithering
    this.globalPalette = false;

    this.out = new ByteArray();
  }

  /*
      Sets the delay time between each frame, or changes it for subsequent frames
      (applies to last frame added)
    */
  GIFEncoder.prototype.setDelay = function(milliseconds) {
    this.delay = Math.round(milliseconds / 10);
  };

  /*
      Sets frame rate in frames per second.
    */
  GIFEncoder.prototype.setFrameRate = function(fps) {
    this.delay = Math.round(100 / fps);
  };

  /*
      Sets the GIF frame disposal code for the last added frame and any
      subsequent frames.

      Default is 0 if no transparent color has been set, otherwise 2.
    */
  GIFEncoder.prototype.setDispose = function(disposalCode) {
    if (disposalCode >= 0) this.dispose = disposalCode;
  };

  /*
      Sets the number of times the set of GIF frames should be played.

      -1 = play once
      0 = repeat indefinitely

      Default is -1

      Must be invoked before the first image is added
    */

  GIFEncoder.prototype.setRepeat = function(repeat) {
    this.repeat = repeat;
  };

  /*
      Sets the transparent color for the last added frame and any subsequent
      frames. Since all colors are subject to modification in the quantization
      process, the color in the final palette for each frame closest to the given
      color becomes the transparent color for that frame. May be set to null to
      indicate no transparent color.
    */
  GIFEncoder.prototype.setTransparent = function(color) {
    this.transparent = color;
  };

  /*
      Adds next GIF frame. The frame is not written immediately, but is
      actually deferred until the next frame is received so that timing
      data can be inserted.  Invoking finish() flushes all frames.
    */
  GIFEncoder.prototype.addFrame = function(imageData) {
    this.image = imageData;

    this.colorTab =
      this.globalPalette && this.globalPalette.slice
        ? this.globalPalette
        : null;

    this.getImagePixels(); // convert to correct format if necessary
    this.analyzePixels(); // build color table & map pixels

    if (this.globalPalette === true) this.globalPalette = this.colorTab;

    if (this.firstFrame) {
      this.writeLSD(); // logical screen descriptior
      this.writePalette(); // global color table
      if (this.repeat >= 0) {
        // use NS app extension to indicate reps
        this.writeNetscapeExt();
      }
    }

    this.writeGraphicCtrlExt(); // write graphic control extension
    this.writeImageDesc(); // image descriptor
    if (!this.firstFrame && !this.globalPalette) this.writePalette(); // local color table
    this.writePixels(); // encode and write pixel data

    this.firstFrame = false;
  };

  /*
      Adds final trailer to the GIF stream, if you don't call the finish method
      the GIF stream will not be valid.
    */
  GIFEncoder.prototype.finish = function() {
    this.out.writeByte(0x3b); // gif trailer
  };

  /*
      Sets quality of color quantization (conversion of images to the maximum 256
      colors allowed by the GIF specification). Lower values (minimum = 1)
      produce better colors, but slow processing significantly. 10 is the
      default, and produces good color mapping at reasonable speeds. Values
      greater than 20 do not yield significant improvements in speed.
    */
  GIFEncoder.prototype.setQuality = function(quality) {
    if (quality < 1) quality = 1;
    this.sample = quality;
  };

  /*
      Sets dithering method. Available are:
      - FALSE no dithering
      - TRUE or FloydSteinberg
      - FalseFloydSteinberg
      - Stucki
      - Atkinson
      You can add '-serpentine' to use serpentine scanning
    */
  GIFEncoder.prototype.setDither = function(dither) {
    if (dither === true) dither = "FloydSteinberg";
    this.dither = dither;
  };

  /*
      Sets global palette for all frames.
      You can provide TRUE to create global palette from first picture.
      Or an array of r,g,b,r,g,b,...
    */
  GIFEncoder.prototype.setGlobalPalette = function(palette) {
    this.globalPalette = palette;
  };

  /*
      Returns global palette used for all frames.
      If setGlobalPalette(true) was used, then this function will return
      calculated palette after the first frame is added.
    */
  GIFEncoder.prototype.getGlobalPalette = function() {
    return (
      (this.globalPalette &&
        this.globalPalette.slice &&
        this.globalPalette.slice(0)) ||
      this.globalPalette
    );
  };

  /*
      Writes GIF file header
    */
  GIFEncoder.prototype.writeHeader = function() {
    this.out.writeUTFBytes("GIF89a");
  };

  /*
      Analyzes current frame colors and creates color map.
    */
  GIFEncoder.prototype.analyzePixels = function() {
    if (!this.colorTab) {
      this.neuQuant = new TypedNeuQuant(this.pixels, this.sample);
      this.neuQuant.buildColormap(); // create reduced palette
      this.colorTab = this.neuQuant.getColormap();
    }

    // map image pixels to new palette
    if (this.dither) {
      this.ditherPixels(
        this.dither.replace("-serpentine", ""),
        this.dither.match(/-serpentine/) !== null
      );
    } else {
      this.indexPixels();
    }

    this.pixels = null;
    this.colorDepth = 8;
    this.palSize = 7;

    // get closest match to transparent color if specified
    if (this.transparent !== null) {
      this.transIndex = this.findClosest(this.transparent, true);
    }
  };

  /*
      Index pixels, without dithering
    */
  GIFEncoder.prototype.indexPixels = function(imgq) {
    var nPix = this.pixels.length / 3;
    this.indexedPixels = new Uint8Array(nPix);
    var k = 0;
    for (var j = 0; j < nPix; j++) {
      var index = this.findClosestRGB(
        this.pixels[k++] & 0xff,
        this.pixels[k++] & 0xff,
        this.pixels[k++] & 0xff
      );
      this.usedEntry[index] = true;
      this.indexedPixels[j] = index;
    }
  };

  /*
      Taken from http://jsbin.com/iXofIji/2/edit by PAEz
    */
  GIFEncoder.prototype.ditherPixels = function(kernel, serpentine) {
    var kernels = {
      FalseFloydSteinberg: [[3 / 8, 1, 0], [3 / 8, 0, 1], [2 / 8, 1, 1]],
      FloydSteinberg: [
        [7 / 16, 1, 0],
        [3 / 16, -1, 1],
        [5 / 16, 0, 1],
        [1 / 16, 1, 1]
      ],
      Stucki: [
        [8 / 42, 1, 0],
        [4 / 42, 2, 0],
        [2 / 42, -2, 1],
        [4 / 42, -1, 1],
        [8 / 42, 0, 1],
        [4 / 42, 1, 1],
        [2 / 42, 2, 1],
        [1 / 42, -2, 2],
        [2 / 42, -1, 2],
        [4 / 42, 0, 2],
        [2 / 42, 1, 2],
        [1 / 42, 2, 2]
      ],
      Atkinson: [
        [1 / 8, 1, 0],
        [1 / 8, 2, 0],
        [1 / 8, -1, 1],
        [1 / 8, 0, 1],
        [1 / 8, 1, 1],
        [1 / 8, 0, 2]
      ]
    };

    if (!kernel || !kernels[kernel]) {
      throw "Unknown dithering kernel: " + kernel;
    }

    var ds = kernels[kernel];
    var index = 0,
      height = this.height,
      width = this.width,
      data = this.pixels;
    var direction = serpentine ? -1 : 1;

    this.indexedPixels = new Uint8Array(this.pixels.length / 3);

    for (var y = 0; y < height; y++) {
      if (serpentine) direction = direction * -1;

      for (
        var x = direction == 1 ? 0 : width - 1,
          xend = direction == 1 ? width : 0;
        x !== xend;
        x += direction
      ) {
        index = y * width + x;
        // Get original colour
        var idx = index * 3;
        var r1 = data[idx];
        var g1 = data[idx + 1];
        var b1 = data[idx + 2];

        // Get converted colour
        idx = this.findClosestRGB(r1, g1, b1);
        this.usedEntry[idx] = true;
        this.indexedPixels[index] = idx;
        idx *= 3;
        var r2 = this.colorTab[idx];
        var g2 = this.colorTab[idx + 1];
        var b2 = this.colorTab[idx + 2];

        var er = r1 - r2;
        var eg = g1 - g2;
        var eb = b1 - b2;

        for (
          var i = direction == 1 ? 0 : ds.length - 1,
            end = direction == 1 ? ds.length : 0;
          i !== end;
          i += direction
        ) {
          var x1 = ds[i][1]; // *direction;  //  Should this by timesd by direction?..to make the kernel go in the opposite direction....got no idea....
          var y1 = ds[i][2];
          if (x1 + x >= 0 && x1 + x < width && y1 + y >= 0 && y1 + y < height) {
            var d = ds[i][0];
            idx = index + x1 + y1 * width;
            idx *= 3;

            data[idx] = Math.max(0, Math.min(255, data[idx] + er * d));
            data[idx + 1] = Math.max(0, Math.min(255, data[idx + 1] + eg * d));
            data[idx + 2] = Math.max(0, Math.min(255, data[idx + 2] + eb * d));
          }
        }
      }
    }
  };

  /*
      Returns index of palette color closest to c
    */
  GIFEncoder.prototype.findClosest = function(c, used) {
    return this.findClosestRGB(
      (c & 0xff0000) >> 16,
      (c & 0x00ff00) >> 8,
      c & 0x0000ff,
      used
    );
  };

  GIFEncoder.prototype.findClosestRGB = function(r, g, b, used) {
    if (this.colorTab === null) return -1;

    if (this.neuQuant && !used) {
      return this.neuQuant.lookupRGB(r, g, b);
    }

    var minpos = 0;
    var dmin = 256 * 256 * 256;
    var len = this.colorTab.length;

    for (var i = 0, index = 0; i < len; index++) {
      var dr = r - (this.colorTab[i++] & 0xff);
      var dg = g - (this.colorTab[i++] & 0xff);
      var db = b - (this.colorTab[i++] & 0xff);
      var d = dr * dr + dg * dg + db * db;
      if ((!used || this.usedEntry[index]) && d < dmin) {
        dmin = d;
        minpos = index;
      }
    }

    return minpos;
  };

  /*
      Extracts image pixels into byte array pixels
      (removes alphachannel from canvas imagedata)
    */
  GIFEncoder.prototype.getImagePixels = function() {
    var w = this.width;
    var h = this.height;
    this.pixels = new Uint8Array(w * h * 3);

    var data = this.image;
    var srcPos = 0;
    var count = 0;

    for (var i = 0; i < h; i++) {
      for (var j = 0; j < w; j++) {
        this.pixels[count++] = data[srcPos++];
        this.pixels[count++] = data[srcPos++];
        this.pixels[count++] = data[srcPos++];
        srcPos++;
      }
    }
  };

  /*
      Writes Graphic Control Extension
    */
  GIFEncoder.prototype.writeGraphicCtrlExt = function() {
    this.out.writeByte(0x21); // extension introducer
    this.out.writeByte(0xf9); // GCE label
    this.out.writeByte(4); // data block size

    var transp, disp;
    if (this.transparent === null) {
      transp = 0;
      disp = 0; // dispose = no action
    } else {
      transp = 1;
      disp = 2; // force clear if using transparent color
    }

    if (this.dispose >= 0) {
      disp = this.dispose & 7; // user override
    }
    disp <<= 2;

    // packed fields
    this.out.writeByte(
      0 | // 1:3 reserved
      disp | // 4:6 disposal
      0 | // 7 user input - 0 = none
        transp // 8 transparency flag
    );

    this.writeShort(this.delay); // delay x 1/100 sec
    this.out.writeByte(this.transIndex); // transparent color index
    this.out.writeByte(0); // block terminator
  };

  /*
      Writes Image Descriptor
    */
  GIFEncoder.prototype.writeImageDesc = function() {
    this.out.writeByte(0x2c); // image separator
    this.writeShort(0); // image position x,y = 0,0
    this.writeShort(0);
    this.writeShort(this.width); // image size
    this.writeShort(this.height);

    // packed fields
    if (this.firstFrame || this.globalPalette) {
      // no LCT - GCT is used for first (or only) frame
      this.out.writeByte(0);
    } else {
      // specify normal LCT
      this.out.writeByte(
        0x80 | // 1 local color table 1=yes
        0 | // 2 interlace - 0=no
        0 | // 3 sorted - 0=no
        0 | // 4-5 reserved
          this.palSize // 6-8 size of color table
      );
    }
  };

  /*
      Writes Logical Screen Descriptor
    */
  GIFEncoder.prototype.writeLSD = function() {
    // logical screen size
    this.writeShort(this.width);
    this.writeShort(this.height);

    // packed fields
    this.out.writeByte(
      0x80 | // 1 : global color table flag = 1 (gct used)
      0x70 | // 2-4 : color resolution = 7
      0x00 | // 5 : gct sort flag = 0
        this.palSize // 6-8 : gct size
    );

    this.out.writeByte(0); // background color index
    this.out.writeByte(0); // pixel aspect ratio - assume 1:1
  };

  /*
      Writes Netscape application extension to define repeat count.
    */
  GIFEncoder.prototype.writeNetscapeExt = function() {
    this.out.writeByte(0x21); // extension introducer
    this.out.writeByte(0xff); // app extension label
    this.out.writeByte(11); // block size
    this.out.writeUTFBytes("NETSCAPE2.0"); // app id + auth code
    this.out.writeByte(3); // sub-block size
    this.out.writeByte(1); // loop sub-block id
    this.writeShort(this.repeat); // loop count (extra iterations, 0=repeat forever)
    this.out.writeByte(0); // block terminator
  };

  /*
      Writes color table
    */
  GIFEncoder.prototype.writePalette = function() {
    this.out.writeBytes(this.colorTab);
    var n = 3 * 256 - this.colorTab.length;
    for (var i = 0; i < n; i++) this.out.writeByte(0);
  };

  GIFEncoder.prototype.writeShort = function(pValue) {
    this.out.writeByte(pValue & 0xff);
    this.out.writeByte((pValue >> 8) & 0xff);
  };

  /*
      Encodes and writes pixel data
    */
  GIFEncoder.prototype.writePixels = function() {
    var enc = new LZWEncoder_1(
      this.width,
      this.height,
      this.indexedPixels,
      this.colorDepth
    );
    enc.encode(this.out);
  };

  /*
      Retrieves the GIF stream
    */
  GIFEncoder.prototype.stream = function() {
    return this.out;
  };

  var GIFEncoder_1 = GIFEncoder;

  const pageSize = 4096;
  // TODO: WebWorker
  async function picturesToAnimatedGif({ canvas, width, height, pictures }) {
    if (pictures.length < 1) {
      throw new Error("No pictures passed to picturesToAnimatedGif.");
    }

    canvas.width = width;
    canvas.height = height;
    var ctx = canvas.getContext("2d");

    var encoder = new GIFEncoder_1(width, height);

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

  /* src/Movie.svelte generated by Svelte v3.20.1 */

  function get_each_context(ctx, list, i) {
    const child_ctx = ctx.slice();
    child_ctx[4] = list[i].file;
    child_ctx[5] = list[i].seconds;
    child_ctx[6] = list;
    child_ctx[7] = i;
    return child_ctx;
  }

  // (6:4) {#each $movie.pictures as { file, seconds }
  function create_each_block(ctx) {
    let li;
    let h1;
    let t0;
    let t1;
    let div;
    let t2;
    let input;
    let input_updating = false;
    let t3;
    let img;
    let img_src_value;
    let img_alt_value;
    let t4;
    let dispose;

    function input_input_handler() {
      input_updating = true;
      /*input_input_handler*/ ctx[3].call(
        input,
        /*seconds*/ ctx[5],
        /*each_value*/ ctx[6],
        /*i*/ ctx[7]
      );
    }

    return {
      c() {
        li = element("li");
        h1 = element("h1");
        t0 = text(/*i*/ ctx[7]);
        t1 = space();
        div = element("div");
        t2 = text("Seconds: ");
        input = element("input");
        t3 = space();
        img = element("img");
        t4 = space();
        attr(input, "type", "number");
        attr(input, "step", "0.1");
        if (img.src !== (img_src_value = URL.createObjectURL(/*file*/ ctx[4])))
          attr(img, "src", img_src_value);
        attr(img, "alt", (img_alt_value = "Picture " + /*i*/ ctx[7]));
        attr(img, "class", "svelte-1g84jp3");
        attr(li, "class", "picture svelte-1g84jp3");
      },
      m(target, anchor, remount) {
        insert(target, li, anchor);
        append(li, h1);
        append(h1, t0);
        append(li, t1);
        append(li, div);
        append(div, t2);
        append(div, input);
        set_input_value(input, /*seconds*/ ctx[5]);
        append(li, t3);
        append(li, img);
        append(li, t4);
        if (remount) dispose();
        dispose = listen(input, "input", input_input_handler);
      },
      p(new_ctx, dirty) {
        ctx = new_ctx;

        if (!input_updating && dirty & /*$movie*/ 1) {
          set_input_value(input, /*seconds*/ ctx[5]);
        }

        input_updating = false;

        if (
          dirty & /*$movie*/ 1 &&
          img.src !== (img_src_value = URL.createObjectURL(/*file*/ ctx[4]))
        ) {
          attr(img, "src", img_src_value);
        }
      },
      d(detaching) {
        if (detaching) detach(li);
        dispose();
      }
    };
  }

  function create_fragment(ctx) {
    let section;
    let h3;
    let t1;
    let input;
    let t2;
    let ul;
    let t3;
    let button;
    let t5;
    let img;
    let t6;
    let em;
    let t8;
    let canvas;
    let dispose;
    let each_value = /*$movie*/ ctx[0].pictures;
    let each_blocks = [];

    for (let i = 0; i < each_value.length; i += 1) {
      each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    }

    return {
      c() {
        section = element("section");
        h3 = element("h3");
        h3.textContent = "Pick pictures to add:";
        t1 = space();
        input = element("input");
        t2 = space();
        ul = element("ul");

        for (let i = 0; i < each_blocks.length; i += 1) {
          each_blocks[i].c();
        }

        t3 = space();
        button = element("button");
        button.textContent = "Make gif!";
        t5 = space();
        img = element("img");
        t6 = space();
        em = element("em");
        em.textContent =
          "Right-click or hold your finger down over the gif to download it.";
        t8 = space();
        canvas = element("canvas");
        attr(input, "id", "image-picker");
        attr(input, "type", "file");
        input.multiple = true;
        attr(input, "accept", "image/*");
        attr(ul, "class", "picture-list svelte-1g84jp3");
        attr(button, "id", "make-gif-button");
        attr(img, "id", "result-gif");
        attr(img, "alt", "The resulting movie gif!");
        attr(canvas, "id", "frame-canvas");
        attr(canvas, "class", "svelte-1g84jp3");
      },
      m(target, anchor, remount) {
        insert(target, section, anchor);
        append(section, h3);
        append(section, t1);
        append(section, input);
        append(section, t2);
        append(section, ul);

        for (let i = 0; i < each_blocks.length; i += 1) {
          each_blocks[i].m(ul, null);
        }

        append(section, t3);
        append(section, button);
        append(section, t5);
        append(section, img);
        append(section, t6);
        append(section, em);
        insert(target, t8, anchor);
        insert(target, canvas, anchor);
        if (remount) run_all(dispose);

        dispose = [
          listen(input, "change", /*onImagePickerChange*/ ctx[1]),
          listen(button, "click", /*onMakeGifClick*/ ctx[2])
        ];
      },
      p(ctx, [dirty]) {
        if (dirty & /*URL, $movie*/ 1) {
          each_value = /*$movie*/ ctx[0].pictures;
          let i;

          for (i = 0; i < each_value.length; i += 1) {
            const child_ctx = get_each_context(ctx, each_value, i);

            if (each_blocks[i]) {
              each_blocks[i].p(child_ctx, dirty);
            } else {
              each_blocks[i] = create_each_block(child_ctx);
              each_blocks[i].c();
              each_blocks[i].m(ul, null);
            }
          }

          for (; i < each_blocks.length; i += 1) {
            each_blocks[i].d(1);
          }

          each_blocks.length = each_value.length;
        }
      },
      i: noop,
      o: noop,
      d(detaching) {
        if (detaching) detach(section);
        destroy_each(each_blocks, detaching);
        if (detaching) detach(t8);
        if (detaching) detach(canvas);
        run_all(dispose);
      }
    };
  }

  function instance($$self, $$props, $$invalidate) {
    let $movie;
    component_subscribe($$self, movie, $$value =>
      $$invalidate(0, ($movie = $$value))
    );

    function onImagePickerChange() {
      var newPictures = [];

      for (var i = 0; i < this.files.length; ++i) {
        newPictures.push(Picture(this.files[i]));
      }

      console.log(newPictures);

      movie.set({
        pictures: $movie.pictures.concat(newPictures)
      });
    }

    async function onMakeGifClick() {
      // TODO: Resize canvas to picture proportions
      var gifBuffer = await picturesToAnimatedGif({
        canvas: document.getElementById("frame-canvas"),
        width: 800,
        height: 600,
        pictures: $movie.pictures
      });

      console.log("gifBuffer", gifBuffer);
      var resultGifImg = document.getElementById("result-gif");
      resultGifImg.src = URL.createObjectURL(
        new Blob([gifBuffer.buffer], { type: "image/gif" })
      );
    }

    function input_input_handler(seconds, each_value, i) {
      each_value[i].seconds = to_number(this.value);
    }

    return [$movie, onImagePickerChange, onMakeGifClick, input_input_handler];
  }

  class Movie extends SvelteComponent {
    constructor(options) {
      super();
      init(this, options, instance, create_fragment, safe_not_equal, {});
    }
  }

  var version = "1.0.0";

  /* src/App.svelte generated by Svelte v3.20.1 */

  function create_fragment$1(ctx) {
    let main;
    let h1;
    let t1;
    let div0;
    let t3;
    let t4;
    let div1;
    let current;
    const movie = new Movie({});

    return {
      c() {
        main = element("main");
        h1 = element("h1");
        h1.textContent = "Super Flip-O-Rama!";
        t1 = space();
        div0 = element("div");
        div0.textContent =
          "Make your stop-motion movie here. (Or just put together an animated gif of any kind.)";
        t3 = space();
        create_component(movie.$$.fragment);
        t4 = space();
        div1 = element("div");
        div1.textContent = `${version}`;
        attr(div1, "id", "version-info");
        attr(main, "class", "svelte-10qvvts");
      },
      m(target, anchor) {
        insert(target, main, anchor);
        append(main, h1);
        append(main, t1);
        append(main, div0);
        append(main, t3);
        mount_component(movie, main, null);
        append(main, t4);
        append(main, div1);
        current = true;
      },
      p: noop,
      i(local) {
        if (current) return;
        transition_in(movie.$$.fragment, local);
        current = true;
      },
      o(local) {
        transition_out(movie.$$.fragment, local);
        current = false;
      },
      d(detaching) {
        if (detaching) detach(main);
        destroy_component(movie);
      }
    };
  }

  class App extends SvelteComponent {
    constructor(options) {
      super();
      init(this, options, null, create_fragment$1, safe_not_equal, {});
    }
  }

  const app = new App({
    target: document.body,
    props: {}
  });

  return app;
})();
//# sourceMappingURL=bundle.js.map
