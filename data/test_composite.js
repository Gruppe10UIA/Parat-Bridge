const https = require('https');
const sharp = require('sharp');
const fs = require('fs');

var lat = 58.1462;
var lng = 7.9956;
var zoom = 15;

var latRad = lat * Math.PI / 180;
var n = Math.pow(2, zoom);
var tileX = Math.floor((lng + 180) / 360 * n);
var tileY = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);

var exactX = (lng + 180) / 360 * n;
var exactY = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n;
var markerPixelX = Math.round((exactX - tileX + 1) * 256);
var markerPixelY = Math.round((exactY - tileY + 1) * 256);

console.log('Tile:', tileX, tileY);
console.log('Marker pixel:', markerPixelX, markerPixelY);

var tiles = [];
for (var dy = -1; dy <= 1; dy++) {
    for (var dx = -1; dx <= 1; dx++) {
        tiles.push({
            url: 'https://tile.openstreetmap.org/' + zoom + '/' + (tileX + dx) + '/' + (tileY + dy) + '.png',
            x: (dx + 1) * 256,
            y: (dy + 1) * 256
        });
    }
}

function fetchTile(url) {
    return new Promise(function(resolve, reject) {
        https.get(url, { headers: { 'User-Agent': 'Parat-Bridge/1.0' } }, function(res) {
            var chunks = [];
            res.on('data', function(chunk) { chunks.push(chunk); });
            res.on('end', function() {
                var buf = Buffer.concat(chunks);
                console.log('Fetched', url, ':', buf.length, 'bytes, status:', res.statusCode);
                resolve(buf);
            });
            res.on('error', reject);
        }).on('error', reject);
    });
}

console.log('Fetching 9 tiles...');
var promises = tiles.map(function(t) { return fetchTile(t.url); });

Promise.all(promises).then(function(buffers) {
    console.log('All tiles fetched, compositing...');

    var composites = buffers.map(function(buf, i) {
        return { input: buf, left: tiles[i].x, top: tiles[i].y };
    });

    var markerSize = 16;
    var markerSvg = Buffer.from(
        '<svg width="' + markerSize + '" height="' + markerSize + '">' +
        '<circle cx="8" cy="8" r="7" fill="red" stroke="white" stroke-width="2"/>' +
        '</svg>'
    );

    composites.push({
        input: markerSvg,
        left: markerPixelX - markerSize / 2,
        top: markerPixelY - markerSize / 2
    });

    return sharp({ create: { width: 768, height: 768, channels: 4, background: { r: 200, g: 200, b: 200, alpha: 1 } } })
        .composite(composites)
        .png()
        .toBuffer();
}).then(function(imageBuffer) {
    console.log('Composite done! Size:', imageBuffer.length, 'bytes');
    fs.writeFileSync('/tmp/test_map.png', imageBuffer);
    console.log('Written to /tmp/test_map.png');
}).catch(function(err) {
    console.error('FAILED:', err.message);
    console.error(err.stack);
});
