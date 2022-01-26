module.exports = {
    fields: ['link','burn'],
    validate: async (tx, ts, legitUser, cb) => {
        // first verify that the user isn't editing an existing content
        if (!validate.string(tx.data.link, config.linkMaxLength, config.accountMinLength))
            return cb(false, 'invalid tx data.link')
        if (!validate.integer(tx.data.burn,false,false))
            return cb(false, 'invalid burn amount')
        if (tx.data.burn < config.minPromoteBurnAmount)
            return cb(false, 'burn amount is less than minimum amount required')
        cache.findOne('contents', {_id: tx.sender+'/'+tx.data.link}, function(err, content) {
            if (err) throw err
            if (!content)
                return cb(false, 'cannot promote non-existent content')
            else if (content.promoted)
                return cb(false, 'can only promote once')
            else if (config.maxContentAge && ts - content.ts > config.maxContentAge)
                return cb(false, 'content too old to promote')
            cache.findOne('accounts', {name: tx.sender}, function(err, account) {
                if (err) throw err
                if (account.balance < tx.data.burn)
                    return cb(false, 'invalid tx not enough balance to burn')
                cb(true)
            })
        })
    },
    execute: (tx, ts, cb) => {
        // and burn some coins, update bw/vp and witness vote scores as usual
        cache.updateOne('accounts', {name: tx.sender}, {$inc: {balance: -tx.data.burn}}, function() {
            cache.findOne('accounts', {name: tx.sender}, function(err, sender) {
                sender.balance += tx.data.burn
                transaction.updateGrowInts(sender, ts, function() {
                    transaction.adjustNodeAppr(sender, -tx.data.burn, function() {
                        cache.updateOne('contents',
                            {_id: tx.sender+'/'+tx.data.link},
                            { $set: { promoted: tx.data.burn }}, () => {
                                cb(true, 0, tx.data.burn)
                            })
                    })
                })
            })
            
        })
    }
}