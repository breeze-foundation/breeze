module.exports = {
    fields: ['name', 'pub', 'ref'],
    validate: (tx, ts, legitUser, cb) => {
        if (!validate.string(tx.data.name, config.accountMaxLength, config.accountMinLength, config.allowedUsernameChars, config.allowedUsernameCharsOnlyMiddle)) {
            cb(false, 'invalid tx data.name'); return
        }
        if (!validate.publicKey(tx.data.pub, config.accountMaxLength)) {
            cb(false, 'invalid tx data.pub'); return
        }

        let lowerUser = tx.data.name.toLowerCase()

        for (let i = 0; i < lowerUser.length; i++) {
            const c = lowerUser[i]
            // allowed username chars
            if (config.allowedUsernameChars.indexOf(c) === -1) 
                if (config.allowedUsernameCharsOnlyMiddle.indexOf(c) === -1) {
                    cb(false, 'invalid tx data.name char '+c); return
                } else if (i === 0 || i === lowerUser.length-1) {
                    cb(false, 'invalid tx data.name char '+c+' can only be in the middle'); return
                }
            
        }

        cache.findOne('accounts', {name: lowerUser}, function(err, account) {
            if (err) throw err
            if (account)
                return cb(false, 'invalid tx data.name already exists')
            cache.findOne('accounts', {name: tx.sender}, function(err, account) {
                if (err) throw err
                if (account.balance < eco.accountPrice(lowerUser))
                    cb(false, 'invalid tx not enough balance')
                else if (tx.data.ref) 
                    cache.findOne('accounts', {name: tx.data.ref}, (e,refacc) => {
                        if (!refacc)
                            cb(false, 'invalid tx referrer account does not exist')
                        else
                            cb(true)
                    })
                else
                    cb(true)
            })
        })
    },
    execute: (tx, ts, cb) => {
        cache.insertOne('accounts', {
            name: tx.data.name.toLowerCase(),
            pub: tx.data.pub,
            balance: 0,
            bw: {v:0,t:0},
            vp: {v:0,t:0},
            follows: [],
            followers: [],
            keys: [],
            recentVotes: [],
            ref: tx.data.ref,
            refCount: 0,
            created: {
                by: tx.sender,
                ts: ts
            }
        }, function(){
            if (tx.sender !== config.masterName || config.masterPaysForUsernames || tx.data.name.length < config.accountMinLengthFeelessMaster)
                cache.updateOne('accounts', 
                    {name: tx.sender},
                    {$inc: {balance: -eco.accountPrice(tx.data.name)}}, function() {
                        cache.findOne('accounts', {name: tx.sender}, function(err, acc) {
                            if (err) throw err
                            // update his bandwidth
                            acc.balance += eco.accountPrice(tx.data.name)
                            transaction.updateGrowInts(acc, ts, function() {
                                transaction.adjustNodeAppr(acc, -eco.accountPrice(tx.data.name), function() {
                                    if (tx.data.ref)
                                        cache.updateOne('accounts', {name: tx.data.ref}, {$inc: {refCount: 1}}, () => cb(true, null, eco.accountPrice(tx.data.name)))
                                    else
                                        cb(true, null, eco.accountPrice(tx.data.name))
                                })
                            })
                        })
                    })
            else if (tx.data.ref)
                cache.updateOne('accounts', {name: tx.data.ref}, {$inc: {refCount: 1}}, () => cb(true))
            else
                cb(true)
        })
    }
}