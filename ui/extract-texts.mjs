import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(__dirname, 'src');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

const strings = new Set();

walkDir(srcDir, (filePath) => {
  if (!filePath.endsWith('.tsx')) return; // Mostly look at TSX files for UI text
  const content = fs.readFileSync(filePath, 'utf-8');

  // Match text between > and <
  const jsxTextRegex = />([^<>{]+)</g;
  let match;
  while ((match = jsxTextRegex.exec(content)) !== null) {
    const text = match[1].trim();
    // Filter out empty, obvious code, single characters, or things without letters
    if (text && /[a-zA-Z]/.test(text) && text.length > 1 && !/^[&|;=]+$/.test(text)) {
        const cleanText = text.replace(/\s+/g, ' ');
        strings.add(cleanText);
    }
  }

  // Match common string attributes (placeholder, title, label, etc.)
  const attrRegex = /(?:placeholder|title|label|aria-label)=["']([^"']+)["']/g;
  while ((match = attrRegex.exec(content)) !== null) {
    const text = match[1].trim();
    if (text && /[a-zA-Z]/.test(text)) {
        strings.add(text);
    }
  }
});

const output = {};
Array.from(strings).sort().forEach((str, index) => {
    // Generate a reasonable key, e.g., text_001, or just use the text as key
    // Using the text itself as the key (or a sanitized version) is common for fallback
    output[str] = str; 
});

const outputPathEn = path.resolve(__dirname, 'src/locales/en/extracted.json');
const outputPathZh = path.resolve(__dirname, 'src/locales/zh/extracted.json');

fs.writeFileSync(outputPathEn, JSON.stringify(output, null, 2));
fs.writeFileSync(outputPathZh, JSON.stringify(output, null, 2));

console.log(`✅ Extracted ${strings.size} unique strings!`);
console.log(`📂 Saved to: ui/src/locales/en/extracted.json`);
console.log(`📂 Saved to: ui/src/locales/zh/extracted.json`);
