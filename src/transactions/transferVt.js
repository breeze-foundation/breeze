module.exports = {
    fields: ['receiver', 'amount'],
    validate: (tx, ts, legitUser, cb) => {
        if (!validate.string(tx.data.receiver, config.accountMaxLength, config.accountMinLength, config.allowedUsernameChars, config.allowedUsernameCharsOnlyMiddle)) {
            cb(false, 'invalid tx data.receiver'); return
        }
        if (!validate.integer(tx.data.amount, false, false)) {
            cb(false, 'invalid tx data.amount'); return
        }
        if (!transaction.hasEnoughVP(tx.data.amount, ts, legitUser)) {
            cb(false, 'invalid tx not enough vp'); return
        }
        cache.findOne('accounts', {name: tx.data.receiver}, function(err, account) {
            if (err) throw err
            if (!account) cb(false, 'invalid tx receiver does not exist')
            else cb(true)
        })
    },
    execute: (tx, ts, cb) => {
        cache.findOne('accounts', {name: tx.data.receiver}, function(err, account) {
            if (err) throw err
            account.vp.v += tx.data.amount
            cache.updateOne('accounts', {name: tx.data.receiver}, {$set: {vp: account.vp}}, function() {
                cb(true)
            })
        })
    }
}