config = require('../src/config.js').read(0)
eco = require('../src/economics.js')

let name = ''
console.log('Length\tPrice')
console.log('=====================')
while (name.length < config.accountMaxLength) {
    name += 'a'
    let price = (eco.accountPrice(name)/1000000)+' DTC'
    console.log(name.length+'\t'+price)
}