figma.showUI(__html__, { width: 320, height: 400 });

figma.ui.onmessage = async (msg: { type: string, color: string, system: 'tailwind' | 'material' | 'ant' | 'carbon' | 'bootstrap' | 'radix' }) => {

  if (msg.type === 'generate-scale') {
    const scale = generateScale(msg.color, msg.system);
    figma.ui.postMessage({ type: 'scale-result', scale });
  }

  if (msg.type === 'insert-palette') {
    const scale = generateScale(msg.color, msg.system);
    await insertPaletteIntoFigma(scale, msg.system);
  }

};

// --- Color helpers ---

function hexToHsl(hex: string): [number, number, number] {
  // Remove hash if present and expand 3-digit hex to 6-digit
  hex = hex.replace(/^#/, '');
  if (hex.length === 3) {
    hex = hex.split('').map(char => char + char).join('');
  }

  let r = parseInt(hex.slice(0, 2), 16) / 255;
  let g = parseInt(hex.slice(2, 4), 16) / 255;
  let b = parseInt(hex.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return [h * 360, s * 100, l * 100];
}

function hslToHex(h: number, s: number, l: number): string {
  h /= 360; s /= 100; l /= 100;
  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  const toHex = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function generateScale(hex: string, system: 'tailwind' | 'material' | 'ant' | 'carbon' | 'bootstrap' | 'radix' = 'tailwind') {
  const [h, s] = hexToHsl(hex);

  let stops: number[];
  let lightnesses: number[];

  if (system === 'material') {
    stops = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];
    lightnesses = [96, 90, 80, 68, 56, 45, 36, 28, 20, 12];
  } else if (system === 'ant') {
    stops = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    lightnesses = [96, 88, 78, 67, 56, 45, 34, 24, 15, 9];
  } else if (system === 'carbon') {
    stops = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    lightnesses = [95, 88, 80, 70, 60, 50, 40, 30, 20, 10];
  } else if (system === 'bootstrap') {
    stops = [100, 200, 300, 400, 500, 600, 700, 800, 900];
    lightnesses = [92, 83, 74, 63, 50, 40, 30, 20, 10];
  } else if (system === 'radix') {
    stops = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    lightnesses = [99, 97, 94, 90, 85, 79, 71, 60, 49, 41, 28, 10];
  } else {
    // Tailwind
    stops = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
    lightnesses = [97, 94, 86, 76, 64, 52, 40, 30, 22, 14, 10];
  }

  return stops.map((stop, i) => ({
    stop,
    hex: hslToHex(h, s, lightnesses[i])
  }));
}

async function insertPaletteIntoFigma(scale: { stop: number, hex: string }[], system: string) {
  await figma.loadFontAsync({ family: "Inter", style: "Regular" });

  const parentFrame = figma.createFrame();
  parentFrame.name = `${system.charAt(0).toUpperCase() + system.slice(1)} Palette`;
  parentFrame.resize(scale.length * 120 + 20, 160);
  parentFrame.fills = []; // Transparent parent container frame

  scale.forEach(({ stop, hex }, i) => {
    const cleanHex = hex.replace(/^#/, '');
    const r = parseInt(cleanHex.slice(0, 2), 16) / 255;
    const g = parseInt(cleanHex.slice(2, 4), 16) / 255;
    const b = parseInt(cleanHex.slice(4, 6), 16) / 255;

    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const textColor = luminance > 0.5 ? { r: 0, g: 0, b: 0 } : { r: 1, g: 1, b: 1 };

    const swatch = figma.createFrame();
    swatch.name = `${system}-${stop}`;
    swatch.resize(100, 120);
    swatch.x = 10 + i * 120;
    swatch.y = 20;
    swatch.fills = [{ type: 'SOLID', color: { r, g, b } }];
    swatch.cornerRadius = 8;
    parentFrame.appendChild(swatch);

    const textStop = figma.createText();
    textStop.fontName = { family: "Inter", style: "Regular" };
    textStop.characters = String(stop);
    textStop.fontSize = 14;
    textStop.fills = [{ type: 'SOLID', color: textColor }];
    textStop.x = 12;
    textStop.y = 12;
    swatch.appendChild(textStop);

    const textHex = figma.createText();
    textHex.fontName = { family: "Inter", style: "Regular" };
    textHex.characters = hex.toUpperCase();
    textHex.fontSize = 11;
    textHex.fills = [{ type: 'SOLID', color: textColor }];
    textHex.x = 12;
    textHex.y = 96;
    swatch.appendChild(textHex);
  });

  figma.currentPage.appendChild(parentFrame);
  figma.currentPage.selection = [parentFrame];
  figma.viewport.scrollAndZoomIntoView([parentFrame]);
}