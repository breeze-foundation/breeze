const GrowInt = require('growint')
const CryptoJS = require('crypto-js')
const { EventEmitter } = require('events')
const cloneDeep = require('clone-deep')
const bson = require('bson')
const Transaction = require('./transactions')
const TransactionType = Transaction.Types
const max_mempool = process.env.MEMPOOL_SIZE || 200

// transaction types with arbitrary string input that requires bson serialization validation
const serializeValidation = [
    TransactionType.TRANSFER,
    TransactionType.COMMENT,
    TransactionType.VOTE,
    TransactionType.USER_JSON,
    TransactionType.NEW_KEY,
    TransactionType.ENABLE_NODE,
    TransactionType.NEW_WEIGHTED_KEY,
    TransactionType.BRIDGE_DEPOSIT,
    TransactionType.BRIDGE_UPDATE_TX,
    TransactionType.BRIDGE_WITHDRAW,
    TransactionType.CATEGORY_FOLLOW,
    TransactionType.CATEGORY_UNFOLLOW
]

transaction = {
    pool: [], // the pool holds temporary txs that havent been published on chain yet
    eventConfirmation: new EventEmitter(),
    addToPool: (txs) => {
        if (transaction.isPoolFull())
            return

        for (let y = 0; y < txs.length; y++) {
            let exists = false
            for (let i = 0; i < transaction.pool.length; i++)
                if (transaction.pool[i].hash === txs[y].hash)
                    exists = true
            
            if (!exists)
                transaction.pool.push(txs[y])
        }
        
    },
    isPoolFull: () => {
        if (transaction.pool.length >= max_mempool) {
            logr.warn('Mempool is full ('+transaction.pool.length+'/'+max_mempool+' txs), ignoring tx')
            return true
        }
        return false
    },
    removeFromPool: (txs) => {
        for (let y = 0; y < txs.length; y++)
            for (let i = 0; i < transaction.pool.length; i++)
                if (transaction.pool[i].hash === txs[y].hash) {
                    transaction.pool.splice(i, 1)
                    break
                }
    },
    cleanPool: () => {
        for (let i = 0; i < transaction.pool.length; i++)
            if (transaction.pool[i].ts + config.txExpirationTime < new Date().getTime()) {
                transaction.pool.splice(i,1)
                i--
            }
    },
    isInPool: (tx) => {
        let isInPool = false
        for (let i = 0; i < transaction.pool.length; i++)
            if (transaction.pool[i].hash === tx.hash) {
                isInPool = true
                break
            }
        return isInPool
    },
    isPublished: (tx) => {
        if (!tx.hash) return
        if (chain.recentTxs[tx.hash])
            return true
        return false
    },
    isValid: (tx, ts, cb) => {
        if (!tx) {
            cb(false, 'no transaction'); return
        }
        // checking required variables one by one
        
        if (!validate.integer(tx.type, true, false)) {
            cb(false, 'invalid tx type'); return
        }
        if (!tx.data || typeof tx.data !== 'object') {
            cb(false, 'invalid tx data'); return
        }
        if (!validate.string(tx.sender, config.accountMaxLength, config.accountMinLength, config.allowedUsernameChars, config.allowedUsernameCharsOnlyMiddle)) {
            cb(false, 'invalid tx sender'); return
        }
        if (!validate.integer(tx.ts, false, false)) {
            cb(false, 'invalid tx ts'); return
        }
        if (!tx.hash || typeof tx.hash !== 'string') {
            cb(false, 'invalid tx hash'); return
        }
        if (!tx.signature || (typeof tx.signature !== 'string' && !(config.multisig && Array.isArray(tx.signature)))) {
            cb(false, 'invalid tx signature'); return
        }
        // multisig transactions check
        // signatures in multisig txs contain an array of signatures and recid 
        if (config.multisig && Array.isArray(tx.signature))
            for (let s = 0; s < tx.signature.length; s++)
                if (!Array.isArray(tx.signature[s]) || tx.signature[s].length !== 2 || typeof tx.signature[s][0] !== 'string' || !Number.isInteger(tx.signature[s][1]))
                    return cb(false, 'invalid multisig tx signature #'+s)

        // enforce transaction limits
        if (config.txLimits[tx.type] && config.txLimits[tx.type] === 1) {
            cb(false, 'transaction type is disabled'); return
        }
        if (config.txLimits[tx.type] && config.txLimits[tx.type] === 2
            && tx.sender !== config.masterName) {
            cb(false, 'only "'+config.masterName+'" can execute this transaction type'); return
        }
        // avoid transaction reuse
        // check if we are within 1 minute of timestamp seed
        if (chain.getLatestBlock().timestamp - tx.ts > config.txExpirationTime) {
            cb(false, 'invalid timestamp'); return
        }
        // check if this tx hash was already added to chain recently
        if (transaction.isPublished(tx)) {
            cb(false, 'transaction already in chain'); return
        }
        // verify hash matches the transaction's payload
        let newTx = cloneDeep(tx)
        delete newTx.signature
        delete newTx.hash
        let computedHash = CryptoJS.SHA256(JSON.stringify(newTx)).toString()
        if (computedHash !== tx.hash) {
            cb(false, 'invalid tx hash does not match'); return
        }
        // ensure nothing gets lost when serialized in bson
        // skipped during replays or rebuilds
        if (!p2p.recovering && chain.getLatestBlock()._id > chain.restoredBlocks && serializeValidation.includes(tx.type)) {
            let bsonified = bson.deserialize(bson.serialize(newTx))
            let bsonifiedHash = CryptoJS.SHA256(JSON.stringify(bsonified)).toString()
            if (computedHash !== bsonifiedHash)
                return cb(false, 'unserializable transaction, perhaps due to non-utf8 character?')
        }
        // checking transaction signature
        chain.isValidSignature(tx.sender, tx.type, tx.hash, tx.signature, function(legitUser) {
            if (!legitUser) {
                cb(false, 'invalid signature'); return
            }
            if (!legitUser.bw) {
                cb(false, 'user has no bandwidth object'); return
            }

            let newBw = new GrowInt(legitUser.bw, {growth:legitUser.balance/(config.bwGrowth), max:config.bwMax}).grow(ts)

            if (!newBw) {
                logr.debug(legitUser)
                cb(false, 'error debug'); return
            }

            // checking if the user has enough bandwidth
            if (JSON.stringify(tx).length > newBw.v && tx.sender !== config.masterName) {
                cb(false, 'need more bandwidth ('+(JSON.stringify(tx).length-newBw.v)+' B)'); return
            }

            // check transaction specifics
            transaction.isValidTxData(tx, ts, legitUser, function(isValid, error) {
                cb(isValid, error)
            })
        })
    },
    isValidTxData: (tx, ts, legitUser, cb) => {
        Transaction.validate(tx, ts, legitUser, function(err, res) {
            cb(err, res)
        })
    },
    hasEnoughVP: (amount, ts, legitUser) => {
        // checking if user has enough power for a transaction requiring voting power
        let vpGrowConfig = {
            growth: legitUser.balance / config.vpGrowth,
            max: legitUser.maxVp || config.vpMax
        }
        let vpBefore = new GrowInt(legitUser.vp, vpGrowConfig).grow(ts)
        if (vpBefore.v < Math.abs(amount))
            return false
        return true
    },
    collectGrowInts: (tx, ts, cb) => {
        cache.findOne('accounts', {name: tx.sender}, async function(err, account) {
            // collect bandwidth
            let bandwidth = new GrowInt(account.bw, {growth:account.balance/(config.bwGrowth), max:config.bwMax})
            let needed_bytes = JSON.stringify(tx).length
            let bw = bandwidth.grow(ts)
            if (!bw) 
                throw 'No bandwidth error'
            
            bw.v -= needed_bytes
            if (tx.type === TransactionType.TRANSFER_BW)
                bw.v -= tx.data.amount

            // collect voting power when needed
            let vp = null
            let vpGrowConfig = {
                growth: account.balance / config.vpGrowth,
                max: account.maxVp || config.vpMax
            }

            switch (tx.type) {
            case TransactionType.VOTE:
                vp = new GrowInt(account.vp, vpGrowConfig).grow(ts)
                vp.v -= await transaction.nextVP(tx.sender,ts)
                break
            case TransactionType.TRANSFER_VP:
                vp = new GrowInt(account.vp, vpGrowConfig).grow(ts)
                vp.v -= tx.data.amount
                break
            case TransactionType.LIMIT_VP:
                vp = new GrowInt(account.vp, vpGrowConfig).grow(ts)
                break
            default:
                break
            }

            // update both at the same time !
            let changes = {bw: bw}
            if (vp) changes.vp = vp
            if (tx.type === TransactionType.VOTE) {
                for (let i in account.recentVotes)
                    if (account.recentVotes[i] + config.ecoCurationCycle < ts)
                        account.recentVotes.shift()
                    else break
                account.recentVotes.push(ts)
                changes.recentVotes = account.recentVotes
            }
            logr.trace('GrowInt Collect', account.name, changes)
            cache.updateOne('accounts', 
                {name: account.name},
                {$set: changes},
                function(err) {
                    if (err) throw err
                    cb(true)
                })
        })
    },
    execute: (tx, ts, cb) => {
        transaction.collectGrowInts(tx, ts, function(success) {
            if (!success) throw 'Error collecting bandwidth'
            Transaction.execute(tx, ts, cb)
        })
    },
    updateGrowInts: (account, ts, cb) => {
        // updates the bandwidth and vote tokens when the balance changes (transfer, monetary distribution)
        // account.balance is the one before the change (!)
        if (!account.bw || !account.vp) 
            logr.debug('error loading grow int', account)
        
        let bw = new GrowInt(account.bw, {growth:account.balance/(config.bwGrowth), max:config.bwMax}).grow(ts)
        let vp = new GrowInt(account.vp, {growth:account.balance/(config.vpGrowth)}).grow(ts)
        if (!bw || !vp) {
            logr.fatal('error growing grow int', account, ts)
            return
        }
        logr.trace('GrowInt Update', account.name, bw, vp)
        cache.updateOne('accounts', 
            {name: account.name},
            {$set: {
                bw: bw,
                vp: vp
            }},
            function(err) {
                if (err) throw err
                cb(true)
            })
    },
    adjustNodeAppr: (acc, newCoins, cb) => {
        // updates the node_appr values for the node owners the account approves (when balance changes)
        // account.balance is the one before the change (!)
        if (!acc.approves || acc.approves.length === 0 || !newCoins) {
            cb(true)
            return
        }

        let node_appr_before = Math.floor(acc.balance/acc.approves.length)
        acc.balance += newCoins
        let node_appr = Math.floor(acc.balance/acc.approves.length)
        
        let node_owners = []
        for (let i = 0; i < acc.approves.length; i++)
            node_owners.push(acc.approves[i])
        
        logr.trace('NodeAppr Update', acc.name, newCoins, node_appr-node_appr_before, node_owners.length)
        cache.updateMany('accounts', 
            {name: {$in: node_owners}},
            {$inc: {node_appr: node_appr-node_appr_before}}
            , function(err) {
                if (err) throw err
                cb(true)
            })
    },
    nextVP: (username,ts,offset = 0) => {
        return new Promise((rs) => cache.findOne('accounts',{name: username},(e,acc) => {
            let count = 0
            for (let t in acc.recentVotes)
                if (acc.recentVotes[t] + config.ecoCurationCycle >= ts)
                    count++
            rs(Math.ceil(config.ecoCurationVtBase*Math.pow(config.ecoCurationVtMult,count-1+offset)))
        }))
    }
}

module.exports = transaction