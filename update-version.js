const fs = require('fs');
const { execSync } = require('child_process');

// Get commit count and short hash
def getVersion() {
  const count = execSync('git rev-list --count HEAD').toString().trim();
  const hash = execSync('git rev-parse --short HEAD').toString().trim();
  return `v1.0.${count}+${hash}`;
}

const version = getVersion();
const filePath = 'index.html';

let html = fs.readFileSync(filePath, 'utf8');

// Replace the version number in the footer
html = html.replace(/<span id="version-number">.*?<\/span>/,
  `<span id="version-number">${version}</span>`);

fs.writeFileSync(filePath, html);
console.log(`Updated version to ${version}`);
