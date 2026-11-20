// Film looks. Used by the camera (live preview + saved photo).
(function () {
  const LOOKS = {
    classic: {
      name: 'Classic disposable',
      blurb: 'Natural color with a hint of warmth and very fine grain.',
      contrast: 1.06, mul: [1.03, 1.01, 0.96], gain: 0.97, lift: [6, 5, 4], grain: 8, sat: 1.04, vig: 0.22, stamp: '#f2a65a',
      css: { filter: 'contrast(1.05) saturate(1.05) sepia(0.06)', tint: 'rgba(255,170,90,0.05)', grain: 0.07 },
    },
    golden: {
      name: 'Golden hour',
      blurb: 'Soft, warm light that flatters faces and string lights.',
      contrast: 1.0, mul: [1.06, 1.02, 0.92], gain: 0.97, lift: [9, 6, 2], grain: 7, sat: 1.08, vig: 0.18, stamp: '#f2a65a',
      css: { filter: 'contrast(1.0) saturate(1.1) sepia(0.12) brightness(1.03)', tint: 'rgba(255,185,100,0.08)', grain: 0.06 },
    },
    cool35: {
      name: 'Cool 35mm',
      blurb: 'Clean, slightly cool color with a little more contrast, like daylight film.',
      contrast: 1.08, mul: [0.98, 1.01, 1.04], gain: 0.97, lift: [3, 5, 8], grain: 8, sat: 1.02, vig: 0.2, stamp: null,
      css: { filter: 'contrast(1.06) saturate(1.03) hue-rotate(-3deg)', tint: 'rgba(100,150,200,0.05)', grain: 0.07 },
    },
    mono: {
      name: 'Black and white',
      blurb: 'Clean black and white with soft contrast and fine grain.',
      contrast: 1.14, mul: [1, 1, 1], gain: 0.97, lift: [5, 5, 5], grain: 12, sat: 0, vig: 0.28, stamp: null,
      css: { filter: 'grayscale(1) contrast(1.12)', tint: 'rgba(0,0,0,0)', grain: 0.1 },
    },
  };

  function stampText(d) {
    const p = (n) => String(n).padStart(2, '0');
    return "'" + p(d.getFullYear() % 100) + '  ' + p(d.getMonth() + 1) + '  ' + p(d.getDate());
  }

  const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);

  // Bakes the look into the canvas pixels (per pixel, so it works the same on iPhone and Android).
  function applyLook(ctx, w, h, key, date, showStamp) {
    const L = LOOKS[key] || LOOKS.classic;
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      let r = d[i], g = d[i + 1], b = d[i + 2];
      r = (r - 128) * L.contrast + 128; g = (g - 128) * L.contrast + 128; b = (b - 128) * L.contrast + 128;
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      r = lum + (r - lum) * L.sat; g = lum + (g - lum) * L.sat; b = lum + (b - lum) * L.sat;
      r *= L.mul[0]; g *= L.mul[1]; b *= L.mul[2];
      r = r * L.gain + L.lift[0]; g = g * L.gain + L.lift[1]; b = b * L.gain + L.lift[2];
      // Grain is strongest in the midtones and fades in deep shadows and bright highlights, like real film.
      const n = (Math.random() - 0.5) * L.grain * (1 - Math.min(Math.abs(lum - 128) / 190, 0.7));
      d[i] = clamp(r + n); d[i + 1] = clamp(g + n); d[i + 2] = clamp(b + n);
    }
    ctx.putImageData(img, 0, 0);

    const grad = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,' + L.vig + ')');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    const stampOn = showStamp === undefined ? false : showStamp;
    if (stampOn) {
      ctx.font = Math.round(w * 0.036) + 'px "Courier New", monospace';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = L.stamp || '#f2a65a';
      ctx.fillText(stampText(date || new Date()), w - w * 0.05, h - w * 0.045);
    }
  }

  // A made-up evening scene (dusk sky, string lights, two silhouettes) so hosts can compare looks.
  function drawSample(canvas, key) {
    const w = canvas.width, h = canvas.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#5b6fa8'); sky.addColorStop(0.45, '#d98f86'); sky.addColorStop(0.7, '#f2c27c'); sky.addColorStop(1, '#3a2a2a');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#fff1c9'; ctx.beginPath(); ctx.arc(w * 0.7, h * 0.52, w * 0.09, 0, 7); ctx.fill();
    ctx.fillStyle = '#4a3a38'; ctx.beginPath(); ctx.moveTo(0, h * 0.72);
    ctx.quadraticCurveTo(w * 0.3, h * 0.6, w * 0.6, h * 0.74); ctx.quadraticCurveTo(w * 0.85, h * 0.66, w, h * 0.72);
    ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.fill();
    // string lights
    ctx.strokeStyle = '#2a1e1c'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, h * 0.14); ctx.quadraticCurveTo(w / 2, h * 0.28, w, h * 0.12); ctx.stroke();
    for (let i = 1; i < 9; i++) {
      const t = i / 9, x = w * t, y = h * (0.14 + 0.1 * Math.sin(Math.PI * t) + (t > 0.5 ? -0.02 * (t - 0.5) * 4 : 0));
      ctx.fillStyle = '#ffe3a0'; ctx.beginPath(); ctx.arc(x, y + 6, w * 0.014, 0, 7); ctx.fill();
    }
    // two people
    function person(cx, base, s, shirt) {
      ctx.fillStyle = shirt; ctx.beginPath(); ctx.roundRect(cx - s * 0.5, base - s * 1.3, s, s * 1.3, s * 0.25); ctx.fill();
      ctx.fillStyle = '#d9a784'; ctx.beginPath(); ctx.arc(cx, base - s * 1.55, s * 0.34, 0, 7); ctx.fill();
    }
    person(w * 0.32, h * 0.92, w * 0.2, '#7d4a63');
    person(w * 0.55, h * 0.95, w * 0.22, '#35564f');
    applyLook(ctx, w, h, key, new Date());
  }

  window.LOOKS = LOOKS;
  window.applyLook = applyLook;
  window.drawSample = drawSample;
  window.stampText = stampText;
})();
