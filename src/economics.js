const series = require('run-series')

let eco = {
    currentBlock: {
        posts: [],
        votes: {},
        voteCount: 0,
        vpCount: 0
    },
    complete: () => {
        eco.currentBlock = {
            posts: [],
            votes: {},
            voteCount: 0,
            vpCount: 0
        }
    },
    accountPrice: (username) => {
        let price = config.accountPriceMin
        let extra = config.accountPriceBase - config.accountPriceMin
        let mult = Math.pow(config.accountPriceChars / username.length, config.accountPriceCharMult)
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
    curationv2: (ts,cb) => {
        // to be called once after executing all transactions in a block
        if (config.ecoVersion === 3)
            return eco.ecov3(ts,cb)
        if (config.ecoVersion !== 2 || eco.currentBlock.voteCount === 0)
            return cb()
        let dists = {}
        let ops = []
        for (let au in eco.currentBlock.votes)
            for (let li in eco.currentBlock.votes[au]) {
                let a = au
                let l = li
                // author reward for post
                let ad = Math.floor(config.ecoAuthorReward*eco.currentBlock.votes[a][l].length/eco.currentBlock.voteCount)
                let cdt = 0
                if (process.env.DISTRIBUTED === '1')
                    ops.push((callback) => cache.insertOne('distributed', {
                        name: a,
                        dist: ad,
                        ts: ts,
                        _id: a+'/'+l+'/'+ts+'/author'
                    },() => callback()))
                if (!dists[a])
                    dists[a] = ad
                else
                    dists[a] += ad

                // curation reward for post
                for (let v in eco.currentBlock.votes[a][l]) {
                    let cd = Math.floor(config.ecoCurationReward*eco.currentBlock.votes[a][l][v].vp/eco.currentBlock.vpCount)
                    if (process.env.DISTRIBUTED === '1')
                        ops.push((callback) => cache.insertOne('distributed', {
                            name: eco.currentBlock.votes[a][l][v].u,
                            dist: cd,
                            ts: ts,
                            _id: a+'/'+l+'/'+eco.currentBlock.votes[a][l][v].u+'/curation'
                        },() => callback()))
                    if (!dists[eco.currentBlock.votes[a][l][v].u])
                        dists[eco.currentBlock.votes[a][l][v].u] = cd
                    else
                        dists[eco.currentBlock.votes[a][l][v].u] += cd
                    cdt += cd
                }

                // referral reward
                ops.push(eco.referralReward2(a,l,ad,ts))

                // update post info
                ops.push((callback) => cache.findOne('contents',{_id:a+'/'+l},(e,c) => {
                    let contentOp = {
                        $inc: { dist: ad + cdt, likes: eco.currentBlock.votes[a][l].length }
                    }
                    if (!config.hotfix1) {
                        for (let v in eco.currentBlock.votes[a][l])
                            c.votes.push(eco.currentBlock.votes[a][l][v])
                        contentOp.$set = { votes: c.votes }
                    }
                    cache.updateOne('contents',{_id:a+'/'+l},contentOp,() => callback())
                }))
            }
        for (let d in dists)
            ops.push(eco.incBalanceOp2(d,dists[d],ts))
        for (let v in config.vaults)
            if (config.vaults[v].reward > 0 && v !== 'airdrop') {
                ops.push(eco.incBalanceOp2(config.vaults[v].name,config.vaults[v].reward,ts))
                if (process.env.DISTRIBUTED === '1')
                    ops.push((callback) => cache.insertOne('distributed', {
                        name: config.vaults[v].name,
                        dist: config.vaults[v].reward,
                        ts: ts,
                        _id: ts+'/'+v
                    },() => callback()))
            }
        if (ops.length > 0)
            series(ops,() => {
                eco.complete()
                cb()
            })
        else {
            eco.complete()
            cb()
        }
    },
    ecov3: (ts,cb) => {
        let dists = {}
        let ops = []
        let authorRewardEach = Math.floor(config.ecoAuthorReward/eco.currentBlock.posts.length)
        for (let p in eco.currentBlock.posts) {
            // author reward
            if (process.env.DISTRIBUTED === '1')
                ops.push((callback) => cache.insertOne('distributed', {
                    name: eco.currentBlock.posts[p].author,
                    dist: authorRewardEach,
                    ts: ts,
                    _id: eco.currentBlock.posts[p].author+'/'+eco.currentBlock.posts[p].link+'/'+ts+'/author'
                },() => callback()))
            if (!dists[eco.currentBlock.posts[p].author])
                dists[eco.currentBlock.posts[p].author] = authorRewardEach
            else
                dists[eco.currentBlock.posts[p].author] += authorRewardEach

            // referral reward
            ops.push(eco.referralReward2(eco.currentBlock.posts[p].author,eco.currentBlock.posts[p].link,authorRewardEach,ts))

            // update post info
            ops.push((callback) => cache.updateOne('contents',{_id:eco.currentBlock.posts[p].author+'/'+eco.currentBlock.posts[p].link},{ $inc: { dist: authorRewardEach }},() => callback()))
        }
        if (eco.currentBlock.posts.length === 0)
            ops.push(eco.incBalanceOp2(config.vaults.airdrop.name,config.ecoAuthorReward+config.ecoAffiliateReward,ts))
        for (let d in dists)
            ops.push(eco.incBalanceOp2(d,dists[d],ts))
        for (let v in config.vaults)
            if (config.vaults[v].reward > 0) {
                ops.push(eco.incBalanceOp2(config.vaults[v].name,config.vaults[v].reward,ts))
                if (process.env.DISTRIBUTED === '1')
                    ops.push((callback) => cache.insertOne('distributed', {
                        name: config.vaults[v].name,
                        dist: config.vaults[v].reward,
                        ts: ts,
                        _id: ts+'/'+v
                    },() => callback()))
            }
        if (ops.length > 0)
            series(ops,() => {
                eco.complete()
                cb()
            })
        else {
            eco.complete()
            cb()
        }
    },
    incBalanceOp: (author,link,vote,username,amount,label) => {
        return (callback) => {
            logr.trace('increment',username,amount)
            cache.findOne('accounts', {name: username}, function(err, acc) {
                transaction.updateGrowInts(acc, vote.ts, function() {
                    transaction.adjustNodeAppr(acc, amount, function() {
                        cache.updateOne('accounts', {name: username}, {$inc: {balance: amount}}, () => {
                            if (process.env.DISTRIBUTED === '1')
                                cache.insertOne('distributed', {
                                    name: username,
                                    dist: amount,
                                    ts: vote.ts,
                                    _id: author+'/'+link+'/'+vote.u+'/'+username+'/'+label
                                }, () => callback())
                            else
                                callback()
                        })
                    })
                })
            },true)
        }
    },
    incBalanceOp2: (username,amount,ts) => {
        return (callback) => {
            logr.trace('increment2',username,amount)
            cache.findOne('accounts', {name: username}, function(err, acc) {
                transaction.updateGrowInts(acc, ts, function() {
                    transaction.adjustNodeAppr(acc, amount, function() {
                        cache.updateOne('accounts', {name: username}, {$inc: {balance: amount}}, () => {
                            callback()
                        })
                    })
                })
            },true)
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
            },true)
        }
    },
    referralReward2: (author,link,ad,ts) => {
        // referral reward v2
        return (callback) => {
            cache.findOne('accounts', {name: author}, (err,authorAcc) => {
                let refReceipient = authorAcc.ref ? authorAcc.ref : config.vaults.airdrop.name
                let totalAff = config.ecoVersion < 3 ? config.vaults.airdrop.reward : config.ecoAffiliateReward
                let amt = Math.floor(ad*totalAff/config.ecoAuthorReward)
                if (process.env.DISTRIBUTED === '1')
                    cache.insertOne('distributed', {
                        name: refReceipient,
                        dist: amt,
                        ts: ts,
                        _id: author+'/'+link+'/'+ts+'/referral'
                    },() => eco.incBalanceOp2(refReceipient,amt,ts)(callback))
                else
                    eco.incBalanceOp2(refReceipient,amt,ts)(callback)
            },true)
        }
    }
}

module.exports = eco