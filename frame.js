/* ===================== КАМЕННАЯ РАМКА СТРАНИЦЫ =====================
   Рамка вырезается из фото настоящей каменной кладки (fon/rock.jpg):
   - внутренний край рваный (шум + смещение),
   - по краю объём (освещение), от рамки падает тень на игру.
   Перерисовываем при изменении размера окна. */
(function () {
  const frameEl = document.querySelector('.page-frame');
  if (!frameEl) return;

  function draw() {
    const W = window.innerWidth;
    const H = window.innerHeight;
    // толщина рамки: на телефоне тоньше, на большом экране толще
    const T = Math.round(Math.max(30, Math.min(60, Math.min(W, H) * 0.06)));
    // отступ для контента = рамка + рваный край
    document.documentElement.style.setProperty('--frame', Math.round(T * 1.35) + 'px');

    const S = Math.round(T * 9); // размер плитки текстуры: камень ≈ толщине рамки

    frameEl.innerHTML = `
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="rockTex" patternUnits="userSpaceOnUse" width="${S}" height="${S}">
      <image href="fon/rock.jpg" width="${S}" height="${S}" preserveAspectRatio="xMidYMid slice"/>
    </pattern>

    <!-- рваный край: шум сдвигает границу -->
    <filter id="rough" filterUnits="userSpaceOnUse" x="-100" y="-100" width="${W + 200}" height="${H + 200}">
      <!-- низкая частота и 2 октавы = крупные выступы размером с камень, а не «рваная бумага» -->
      <feTurbulence type="fractalNoise" baseFrequency="${(0.75 / T).toFixed(4)}" numOctaves="2" seed="4" result="noise"/>
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="${Math.round(T * 1.1)}"
        xChannelSelector="R" yChannelSelector="G"/>
    </filter>

    <mask id="frameMask" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}">
      <g filter="url(#rough)">
        <rect x="-100" y="-100" width="${W + 200}" height="${H + 200}" fill="#fff"/>
        <rect x="${T}" y="${T}" width="${W - 2 * T}" height="${H - 2 * T}" rx="${Math.round(T * 0.3)}" fill="#000"/>
      </g>
    </mask>

    <!-- цвет камня + объём по краю -->
    <filter id="rockLook" filterUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}">
      <feColorMatrix in="SourceGraphic" type="saturate" values="0.12" result="gray"/>
      <feComponentTransfer in="gray" result="dark">
        <feFuncR type="linear" slope="0.66" intercept="-0.02"/>
        <feFuncG type="linear" slope="0.66" intercept="-0.02"/>
        <feFuncB type="linear" slope="0.72" intercept="-0.02"/>
      </feComponentTransfer>

      <!-- объём края рамки -->
      <feGaussianBlur in="SourceAlpha" stdDeviation="${(T * 0.14).toFixed(1)}" result="edge"/>
      <feDiffuseLighting in="edge" surfaceScale="5" diffuseConstant="1.1" lighting-color="#fff" result="edgeLight">
        <feDistantLight azimuth="225" elevation="50"/>
      </feDiffuseLighting>

      <!-- объём каждого камня: светлое на фото = выпуклое, тёмные щели = впадины -->
      <feColorMatrix in="SourceGraphic" type="luminanceToAlpha" result="height"/>
      <feGaussianBlur in="height" stdDeviation="1.5" result="heightSoft"/>
      <feDiffuseLighting in="heightSoft" surfaceScale="${(T * 0.12).toFixed(1)}" diffuseConstant="1" lighting-color="#fff" result="stoneLight">
        <feDistantLight azimuth="225" elevation="55"/>
      </feDiffuseLighting>

      <feComposite in="dark" in2="edgeLight" operator="arithmetic" k1="1.25" k2="0" k3="0" k4="0" result="lit1"/>
      <feComposite in="lit1" in2="stoneLight" operator="arithmetic" k1="1.3" k2="0" k3="0" k4="0" result="lit2"/>
      <feComposite in="lit2" in2="SourceAlpha" operator="in"/>
    </filter>

    <filter id="shadowBlur" filterUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}">
      <feGaussianBlur stdDeviation="${(T * 0.25).toFixed(1)}"/>
    </filter>
  </defs>

  <!-- тень от камней на игру -->
  <g filter="url(#shadowBlur)" transform="translate(0, ${Math.round(T * 0.12)})">
    <rect width="${W}" height="${H}" fill="#000" fill-opacity="0.85" mask="url(#frameMask)"/>
  </g>

  <!-- сами камни -->
  <g filter="url(#rockLook)">
    <rect width="${W}" height="${H}" fill="url(#rockTex)" mask="url(#frameMask)"/>
  </g>
</svg>`;
  }

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(draw, 120);
  });
  draw();
})();
