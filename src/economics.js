const series = require('run-series')

var eco = {
    accountPrice: (username) => {
        var price = config.accountPriceMin
        var extra = config.accountPriceBase - config.accountPriceMin
        var mult = Math.pow(config.accountPriceChars / username.length, config.accountPriceCharMult)
        price += Math.round(extra*mult)
        return price
    },
    curation: (author, link, vote, cb) => {
        // updating the content
        // increase the dist amount for display
        // and update the votes array
        cache.updateOne('contents', {_id: author+'/'+link}, {
            $push: { votes: vote },
            $inc: {dist: config.ecoAuthorReward + config.ecoCurationReward, likes: 1}
        }, function() {
            let feeOps = []
            feeOps.push(eco.incBalanceOp(author,link,vote,author,config.ecoAuthorReward,'author')) // author reward
            feeOps.push(eco.incBalanceOp(author,link,vote,vote.u,config.ecoCurationReward,'curation')) // curation reward
            for (let v in config.vaults) if (config.vaults[v].reward > 0)
                if (v !== 'airdrop')
                    feeOps.push(eco.incBalanceOp(author,link,vote,config.vaults[v].name,config.vaults[v].reward,v))
                else
                    feeOps.push(eco.referralReward(author,link,vote))
            if (feeOps.length > 0)
                series(feeOps,() => cb())
            else
                cb()
        })
    },
    incBalanceOp: (author,link,vote,username,amount,label) => {
        return (callback) => {
            logr.trace('increment',username,amount)
            cache.updateOne('accounts', {name: username}, {$inc: {balance: amount}}, () => {
                cache.insertOne('distributed', {
                    name: username,
                    dist: amount,
                    ts: vote.ts,
                    _id: author+'/'+link+'/'+vote.u+'/'+username+'/'+label
                }, () => {
                    cache.findOne('accounts', {name: username}, function(err, acc) {
                        acc.balance -= amount
                        transaction.updateGrowInts(acc, vote.ts, function() {
                            transaction.adjustNodeAppr(acc, amount, function() {
                                callback()
                            })
                        })
                    })
                })
            })
        }
    },
    referralReward: (author,link,vote) => {
        // airdrop reward
        return (callback) => {
            cache.findOne('accounts', {name: author}, (err,authorAcc) => {
                if (authorAcc.ref)
                    eco.incBalanceOp(author,link,vote,authorAcc.ref,config.vaults.airdrop.reward,'airdrop')(callback)
                else
                    eco.incBalanceOp(author,link,vote,config.vaults.airdrop.name,config.vaults.airdrop.reward,'airdrop')(callback)
            })
        }
    }
}

module.exports = eco