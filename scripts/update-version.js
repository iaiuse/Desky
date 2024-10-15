const fs = require('fs');
const path = require('path');

const versionFile = path.join(__dirname, '..', 'version.json');
const packageFile = path.join(__dirname, '..', 'package.json');

const versionData = JSON.parse(fs.readFileSync(versionFile, 'utf8'));
const packageData = JSON.parse(fs.readFileSync(packageFile, 'utf8'));

versionData.version = packageData.version;

fs.writeFileSync(versionFile, JSON.stringify(versionData, null, 2));
console.log(`版本已更新至 ${packageData.version}`);