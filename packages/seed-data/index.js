'use strict';

const fs = require('node:fs');
const path = require('node:path');

const dir = path.join(__dirname, 'leaflets');

/** Všechny referenční letáky (spec §19.3) načtené ze `leaflets/*.json`. */
const leaflets = fs
  .readdirSync(dir)
  .filter((file) => file.endsWith('.json'))
  .sort()
  .map((file) => JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')));

module.exports = { leaflets };
