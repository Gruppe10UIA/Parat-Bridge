const https = require('https');
const sharp = require('sharp');

function fetchTile(url) {
    return new Promise(function(resolve, reject) {
        https.get(url, { headers: { 'User-Agent': 'Parat-Bridge/1.0' } }, function(res) {
            var chunks = [];
            res.on('data', function(chunk) { chunks.push(chunk); });
            res.on('end', function() { resolve(Buffer.concat(chunks)); });
            res.on('error', reject);
        }).on('error', reject);
    });
}

fetchTile('https://tile.openstreetmap.org/15/17061/10222.png')
    .then(function(buf) {
        console.log('Tile fetched, bytes:', buf.length);
        console.log('First bytes (hex):', buf.slice(0, 8).toString('hex'));
        return sharp(buf).metadata();
    })
    .then(function(meta) {
        console.log('Sharp metadata:', JSON.stringify(meta));
        console.log('SUCCESS: tiles + sharp working');
    })
    .catch(function(err) {
        console.error('FAILED:', err.message);
    });
