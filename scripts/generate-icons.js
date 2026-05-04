const { Resvg } = require('@resvg/resvg-js');
const fs = require('fs');
const path = require('path');

const ASSETS = path.join(__dirname, '..', 'assets');

const STAR_PATH = 'M256,61 L300.08,195.32 L441.46,195.74 L327.33,279.18 L370.62,413.76 L256,331 L141.38,413.76 L184.67,279.18 L70.54,195.74 L211.92,195.32 Z';

const iconSvg = fs.readFileSync(path.join(ASSETS, 'icon.svg'), 'utf8');

const adaptiveSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    <clipPath id="L"><rect x="0" y="0" width="512" height="1024"/></clipPath>
    <clipPath id="R"><rect x="512" y="0" width="512" height="1024"/></clipPath>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="10" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <path
    d="M512,152 L593.1,400.4 L854.4,400.8 L643.2,554.6 L723.6,803.2 L512,650 L300.4,803.2 L380.8,554.6 L169.6,400.8 L430.9,400.4 Z"
    fill="#F5C518"
    clip-path="url(#L)"
    filter="url(#glow)"
  />
  <path
    d="M512,152 L593.1,400.4 L854.4,400.8 L643.2,554.6 L723.6,803.2 L512,650 L300.4,803.2 L380.8,554.6 L169.6,400.8 L430.9,400.4 Z"
    fill="none"
    stroke="#F5C518"
    stroke-width="44"
    stroke-linejoin="miter"
    stroke-miterlimit="10"
    clip-path="url(#R)"
  />
  <line x1="512" y1="152" x2="512" y2="650" stroke="#1E3A5F" stroke-width="8"/>
  <line x1="512" y1="152" x2="512" y2="650" stroke="#F5C518" stroke-width="3" opacity="0.5"/>
</svg>`;

function svgToPng(svgContent, outputPath, size) {
  const resvg = new Resvg(svgContent, {
    fitTo: { mode: 'width', value: size },
  });
  const png = resvg.render();
  fs.writeFileSync(outputPath, png.asPng());
  console.log(`Generated: ${path.basename(outputPath)} (${size}x${size})`);
}

svgToPng(iconSvg,    path.join(ASSETS, 'icon.png'),          1024);
svgToPng(adaptiveSvg, path.join(ASSETS, 'adaptive-icon.png'), 1024);
