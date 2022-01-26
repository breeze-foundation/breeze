const https = require('https')
const http = require('http')

var apis = [
    'http://localhost:3001',
    'https://api.breezechain.org',
    'https://api.breezescan.io',
]

var witnesses = [
    'breeze', 'zurich'
]

var results = []
var finished = 0
for (let y = 0; y < witnesses.length; y++) {
    results.push(Array(apis.length))
    for (let i = 0; i < apis.length; i++) {
        var protocol = http
        if (apis[i].indexOf('https://') === 0)
            protocol = https
        protocol.get(apis[i]+'/account/'+witnesses[y], (resp) => {
            let data = ''
          
            // A chunk of data has been recieved.
            resp.on('data', (chunk) => {
                data += chunk
            })
          
            // The whole response has been received. Print out the result.
            resp.on('end', () => {
                finished++
                results[y][i] = JSON.parse(data).balance%100
                if (finished === apis.length * witnesses.length) {
                    for (let r = 0; r < results.length; r++) {
                        console.log('\n\n'+witnesses[r])
                        console.log(results[r])
                    }
                }
            });
          
          }).on("error", (err) => {
            console.log("Error: " + err.message);
        });
    }
}


