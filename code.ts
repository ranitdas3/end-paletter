figma.showUI(__html__, { width: 400, height: 600 });

type PaletteSystem = 'tailwind' | 'material' | 'ant' | 'carbon' | 'bootstrap' | 'radix';

type PaletteEntry = {
  id: string;
  color: string;
  system: PaletteSystem;
  scale: { stop: number; hex: string }[];
};

type PluginMessage =
  | { type: 'generate-scale'; color: string; system: PaletteSystem }
  | { type: 'insert-palette'; color: string; system: PaletteSystem }
  | { type: 'insert-custom-palette'; system: PaletteSystem; scale: { stop: number; hex: string }[]; name?: string }
  | { type: 'request-library' }
  | { type: 'save-library-entry'; entry: PaletteEntry }
  | { type: 'delete-library-entry'; id: string };

const LIBRARY_STORAGE_KEY = 'end-palette-library';

figma.ui.onmessage = async (msg: PluginMessage) => {

  if (msg.type === 'generate-scale') {
    const scale = generateScale(msg.color, msg.system);
    figma.ui.postMessage({ type: 'scale-result', scale });
  }

  if (msg.type === 'insert-palette') {
    const scale = generateScale(msg.color, msg.system);
    await insertPaletteIntoFigma(scale, msg.system);
  }

  if (msg.type === 'insert-custom-palette') {
    await insertPaletteIntoFigma(msg.scale, msg.system, msg.name);
  }

  if (msg.type === 'request-library') {
    const library = await getSavedLibrary();
    figma.ui.postMessage({ type: 'library-data', palettes: library });
  }

  if (msg.type === 'save-library-entry') {
    const library = await getSavedLibrary();
    const nextLibrary = [msg.entry, ...library.filter((entry) => !(entry.color === msg.entry.color && entry.system === msg.entry.system))];
    await figma.clientStorage.setAsync(LIBRARY_STORAGE_KEY, nextLibrary);
    figma.ui.postMessage({ type: 'library-data', palettes: nextLibrary });
  }

  if (msg.type === 'delete-library-entry') {
    const library = await getSavedLibrary();
    const nextLibrary = library.filter((entry) => entry.id !== msg.id);
    await figma.clientStorage.setAsync(LIBRARY_STORAGE_KEY, nextLibrary);
    figma.ui.postMessage({ type: 'library-data', palettes: nextLibrary });
  }

};

void initializeLibrary();

async function initializeLibrary() {
  const library = await getSavedLibrary();
  figma.ui.postMessage({ type: 'library-data', palettes: library });
}

async function getSavedLibrary(): Promise<PaletteEntry[]> {
  const library = await figma.clientStorage.getAsync(LIBRARY_STORAGE_KEY);
  return Array.isArray(library) ? library as PaletteEntry[] : [];
}

// --- Color helpers ---

function hexToHsl(hex: string): [number, number, number] {
  // Remove hash if present and expand 3-digit hex to 6-digit
  hex = hex.replace(/^#/, '');
  if (hex.length === 3) {
    hex = hex.split('').map(char => char + char).join('');
  }

  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;

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

function generateScale(hex: string, system: PaletteSystem = 'tailwind') {
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

async function insertPaletteIntoFigma(scale: { stop: number, hex: string }[], system: string, name?: string) {
  await figma.loadFontAsync({ family: "Inter", style: "Regular" });

  const parentFrame = figma.createFrame();
  parentFrame.name = name || `${system.charAt(0).toUpperCase() + system.slice(1)} Palette`;
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
