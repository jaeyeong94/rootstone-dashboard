const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(
  path.join(__dirname, '../ref/Rebeta_v1-3.1_tearsheet_260215.html'),
  'utf8'
);
const lines = html.split('\n');

function extractPlotly(lineNum) {
  const line = lines[lineNum];
  const match = line.match(/var plotly_data = ({.*});/);
  if (!match) return null;
  return JSON.parse(match[1]);
}

function downsample(arr, factor) {
  return arr.filter((_, i) => i % factor === 0 || i === arr.length - 1);
}

// Strip time portion: "2021-03-02T00:00:00" -> "2021-03-02"
function cleanDates(arr) {
  return arr.map(d => typeof d === 'string' ? d.split('T')[0] : d);
}

const outDir = path.join(__dirname, '../src/data');
fs.mkdirSync(outDir, { recursive: true });

// 1. Cumulative Returns (line 1038)
const cumData = extractPlotly(1038);
if (cumData) {
  // Filter only the main series (with >100 data points)
  const mainSeries = cumData.data
    .filter(s => s.x && s.x.length > 100)
    .map(s => ({
      name: s.name,
      x: cleanDates(downsample(s.x, 3)),
      y: downsample(s.y, 3),
    }));
  fs.writeFileSync(path.join(outDir, 'cumulative-returns.json'), JSON.stringify(mainSeries));
  console.log('cumulative-returns:', mainSeries.length, 'series,', mainSeries[0].x.length, 'points each');
}

// 2. Underwater/Drawdown (line 1051) - series 2,3 are the actual data
const uwData = extractPlotly(1051);
if (uwData) {
  const mainSeries = uwData.data
    .filter(s => s.x && s.x.length > 100)
    .map(s => ({
      name: s.name,
      x: cleanDates(downsample(s.x, 3)),
      y: downsample(s.y, 3),
    }));
  fs.writeFileSync(path.join(outDir, 'underwater.json'), JSON.stringify(mainSeries));
  console.log('underwater:', mainSeries.length, 'series,', mainSeries[0].x.length, 'points each');
}

// 3. Rolling Sharpe 365d (line 1159)
const rsData = extractPlotly(1159);
if (rsData) {
  const mainSeries = rsData.data
    .filter(s => s.x && s.x.length > 100)
    .map(s => ({
      name: s.name,
      x: cleanDates(downsample(s.x, 3)),
      y: downsample(s.y, 3),
    }));
  fs.writeFileSync(path.join(outDir, 'rolling-sharpe.json'), JSON.stringify(mainSeries));
  console.log('rolling-sharpe:', mainSeries.length, 'series,', mainSeries[0].x.length, 'points each');
}

// Check file sizes
for (const f of ['cumulative-returns.json', 'underwater.json', 'rolling-sharpe.json']) {
  const stat = fs.statSync(path.join(outDir, f));
  console.log(f + ':', (stat.size / 1024).toFixed(1) + 'KB');
}

console.log('Done!');
