var config = require('./config.js').read(0)
var CryptoJS = require('crypto-js')
const secp256k1 = require('secp256k1')
const bs58 = require('base-x')(config.b58Alphabet)
//const bs58 = require('bs58')
let sign = (privKey, sender, tx) => {
    // parsing the tx
    tx = JSON.parse(tx)
    // add timestamp to seed the hash (avoid transactions reuse)
    tx.sender = sender
    tx.ts = new Date().getTime()
    var txString = JSON.stringify(tx)

    // hash the transaction
    tx.hash = CryptoJS.SHA256(txString).toString()

    // decode the key
    var rawPriv = bs58.decode(privKey)

    // sign the tx
    var signature = secp256k1.ecdsaSign(Buffer.from(tx.hash, 'hex'), rawPriv)

    // convert signature to base58
    tx.signature = bs58.encode(signature.signature)
    return tx
}

let cmds = {
    sign: (priv, sender, tx) => {
        return sign(priv, sender, tx)
    },

    createAccount: (privKey, sender, pub, name, ref) => {
        var tx = '{"type":0,"data":{"pub":"'+pub+'","name":"'+name+'","ref":"'+ref+'"}}'
        return sign(privKey, sender, tx)
    }, 

    approveNode: (privKey, sender, nodeName) => {
        var tx = '{"type":1,"data":{"target":"'+ nodeName +'"}}'
        return sign(privKey, sender, tx)
    }, 
	
    disapproveNode: (privKey, sender, nodeName) => {
        var tx = '{"type":2,"data":{"target":"'+ nodeName +'"}}'
        return sign(privKey, sender, tx)
    },

    transfer: (privKey, sender, receiver, amount, memo) => {
        if (!memo) memo=''
        var tx = '{"type":3,"data":{"receiver":"'+
			receiver+'", "amount":'+
			parseInt(amount)+', "memo":"'+memo+'"}}'
        return sign(privKey, sender, tx)
    },

    post: (privKey, sender, uri, content) => {
        var tx = '{"type":4,"data":{"link":"'+
			uri+'","json":'+content+'}}'
        return sign(privKey, sender, tx)
    },

    comment: (privKey, sender, uri, pa, pp, content) => {
        var tx = '{"type":4,"data":{"link":"'+
			uri+'", "pa":"'+
			pa+'", "pp":"'+
			pp+'", "json":'+content+'}}'
        return sign(privKey, sender, tx)
    },

    vote: (privKey, sender, link, author) => {
        var tx = '{"type":5,"data":{"link":"'+
			link+'", "author":"'+
			author+'"}}'
        return sign(privKey, sender, tx)
    },
	
    profile: (privKey, sender, content) => {
        var tx = '{"type":6,"data":{"json":'+content+'}}'
        return sign(privKey, sender, tx)
    },
	
    follow: (privKey, sender, username) => {
        var tx = '{"type":7,"data":{"target":"'+username+'"}}'
        return sign(privKey, sender, tx)
    },
	
    unfollow: (privKey, sender, username) => {
        var tx = '{"type":8,"data":{"target":"'+username+'"}}'
        return sign(privKey, sender, tx)
    },
	
    newKey: (privKey, sender, id, pub, types) => {
        var tx = '{"type":10,"data":{"id":"'+
			id+'","pub":"'+
			pub+'","types":'+types+'}}'
        return sign(privKey, sender, tx)
    },
	
    removeKey: (privKey, sender, id) => {
        var tx = '{"type":11,"data":{"id":"'+id+'"}}'
        return sign(privKey, sender, tx)
    },
	
    changePassword: (privKey, sender, pub) => {
        var tx = '{"type":12,"data":{"pub":"'+pub+'"}}'
        return sign(privKey, sender, tx)
    },
	
    promote: (privKey, sender, uri, burn) => {
        var tx = '{"type":13,"data":{"link":"'+uri+'", "burn":'+burn+'}}'
        return sign(privKey, sender, tx)
    },

    transferVt: (privKey, sender, receiver, amount) => {
        var tx = '{"type":14,"data":{"receiver":"'+
			receiver+'", "amount":'+
			parseInt(amount)+'}}'
        return sign(privKey, sender, tx)
    },

    transferBw: (privKey, sender, receiver, amount) => {
        var tx = '{"type":15,"data":{"receiver":"'+
			receiver+'", "amount":'+
			parseInt(amount)+'}}'
        return sign(privKey, sender, tx)
    },

    limitVt: (privKey, sender, amount) => {
        amount = parseInt(amount)
        if (amount === -1) amount = null
        var tx = '{"type":16,"data":{"amount":'+
			amount+'}}'
        return sign(privKey, sender, tx)
    },

    enableNode: (privKey, sender, pub) => {
        var tx = '{"type":18,"data":{"pub":"'+
			pub+'"}}'
        return sign(privKey, sender, tx)
    },

    newWeightedKey: (privKey, sender, id, pub, types, weight) => {
        let tx = '{"type":20,"data":{"id":"'+
			id+'","pub":"'+
			pub+'","types":'+types+',"weight":'+weight+'}}'
        return sign(privKey, sender, tx)
    },

    setSignatureThreshold: (privKey, sender, thresholds) => {
        let tx = '{"type":21,"data":{"thresholds":'+thresholds+'}}'
        return sign(privKey, sender, tx)
    },

    setPasswordWeight: (privKey, sender, weight) => {
        let tx = '{"type":22,"data":{"weight":'+weight+'}}'
        return sign(privKey, sender, tx)
    },

    bridgeDeposit: (privKey, sender, destaddr, network, amount) => {
        let tx = '{"type":23,"data":{"destaddr":"'+
            destaddr+'", "network": "'+network+'", "amount":'+
            parseInt(amount)+'}}'
        return sign(privKey, sender, tx)
    },

    bridgeUpdate: (privKey, sender, srctxid, desttxid, status) => {
        let tx = '{"type":24,"data":{"srctxid":"'+
            srctxid+'", "desttxid": "'+desttxid+'", "status":'+
            parseInt(status)+'}}'
        return sign(privKey, sender, tx)
    },

    bridgeWithdraw: (privKey, sender, srctxid, srcaddr, network, receiver, amount) => {
        let tx = '{"type":25,"data":{"srctxid":"'+
            srctxid+'", "srcaddr": "'+srcaddr+'", "network":"'+network+'", "receiver":"'+receiver+'", "amount":'+
            parseInt(amount)+'}}'
        return sign(privKey, sender, tx)
    },

    categoryFollow: (privKey, sender, category) => {
        let tx = '{"type":26,"data":{"category":"'+category+'"}}'
        return sign(privKey, sender, tx)
    },
	
    categoryUnfollow: (privKey, sender, category) => {
        let tx = '{"type":27,"data":{"category":"'+category+'"}}'
        return sign(privKey, sender, tx)
    },

    setLastRead: (privKey, sender) => {
        let tx = '{"type":28,"data":{}}'
        return sign(privKey, sender, tx)
    }
}

module.exports = cmds
