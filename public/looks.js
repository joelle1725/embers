// Film looks. Used by the camera (live preview + saved photo) and by the host page (previews).
(function () {
  const LOOKS = {
    classic: {
      name: 'Classic disposable',
      blurb: 'Warm, grainy, faded blacks. The one-time-use camera feel.',
      contrast: 1.1, mul: [1.07, 1.02, 0.88], gain: 0.9, lift: [16, 13, 10], grain: 44, sat: 1.0, vig: 0.5, stamp: '#ff9a3c',
      css: { filter: 'contrast(1.08) saturate(1.1) sepia(0.2) brightness(1.03)', tint: 'rgba(255,150,50,0.10)', grain: 0.35 },
    },
    golden: {
      name: 'Golden hour',
      blurb: 'Soft, honeyed and glowing. Flattering for faces and string lights.',
      contrast: 0.98, mul: [1.12, 1.04, 0.82], gain: 0.88, lift: [26, 18, 9], grain: 30, sat: 1.12, vig: 0.42, stamp: '#ffb04a',
      css: { filter: 'contrast(1.0) saturate(1.2) sepia(0.3) brightness(1.06)', tint: 'rgba(255,170,70,0.16)', grain: 0.25 },
    },
    cool35: {
      name: 'Cool 35mm',
      blurb: 'Cooler shadows and punchy color, like daylight film. No date stamp.',
      contrast: 1.12, mul: [0.97, 1.03, 1.06], gain: 0.92, lift: [8, 13, 18], grain: 36, sat: 1.0, vig: 0.4, stamp: null,
      css: { filter: 'contrast(1.1) saturate(1.05) hue-rotate(-4deg) brightness(1.02)', tint: 'rgba(90,150,200,0.10)', grain: 0.30 },
    },
    mono: {
      name: 'Black and white',
      blurb: 'High contrast and heavy grain. Timeless, a little dramatic.',
      contrast: 1.22, mul: [1, 1, 1], gain: 0.95, lift: [10, 10, 10], grain: 56, sat: 0, vig: 0.55, stamp: null,
      css: { filter: 'grayscale(1) contrast(1.2) brightness(1.03)', tint: 'rgba(0,0,0,0)', grain: 0.42 },
    },
  };

  function stampText(d) {
    const p = (n) => String(n).padStart(2, '0');
    return "'" + p(d.getFullYear() % 100) + '  ' + p(d.getMonth() + 1) + '  ' + p(d.getDate());
  }

  const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);

  // Bakes the look into the canvas pixels (per pixel, so it works the same on iPhone and Android).
  function applyLook(ctx, w, h, key, date) {
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
      const n = (Math.random() - 0.5) * L.grain;
      d[i] = clamp(r + n); d[i + 1] = clamp(g + n); d[i + 2] = clamp(b + n);
    }
    ctx.putImageData(img, 0, 0);

    const grad = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,' + L.vig + ')');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    if (L.stamp) {
      ctx.font = Math.round(w * 0.036) + 'px "Courier New", monospace';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'alphabetic';
      ctx.shadowColor = 'rgba(255,120,0,0.8)';
      ctx.shadowBlur = Math.round(w * 0.008);
      ctx.fillStyle = L.stamp;
      ctx.fillText(stampText(date || new Date()), w - w * 0.05, h - w * 0.045);
      ctx.shadowBlur = 0;
    }
  }

  // A made-up party scene (dusk sky, string lights, two silhouettes) so hosts can compare looks.
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
