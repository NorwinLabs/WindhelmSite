const fs = require('fs');

// Read version.json
const versionPath = './version.json';
const versionData = JSON.parse(fs.readFileSync(versionPath, 'utf8'));

// Increment build number
versionData.build += 1;

// Update patch version (x.x.PATCH)
const versionParts = versionData.version.split('.');
versionParts[2] = parseInt(versionParts[2]) + 1;
versionData.version = versionParts.join('.');

// Update timestamp
versionData.lastUpdated = new Date().toISOString();

// Write back to version.json
fs.writeFileSync(versionPath, JSON.stringify(versionData, null, 2) + '\n');

console.log(`Version updated to ${versionData.version} (build ${versionData.build})`);
