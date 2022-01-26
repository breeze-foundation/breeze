module.exports = {
    fields: ['srctxid','srcaddr','network','receiver','amount'],
    validate: (tx, ts, legitUser, cb) => {
        // external chain tx id
        if (!validate.string(tx.data.srctxid))
            return cb(false,'invalid source tx id string')

        // external chain source address
        if (!validate.string(tx.data.srcaddr))
            return cb(false,'invalid source address string')

        // external chain network
        if (!validate.string(tx.data.network))
            return cb(false,'invalid destination chain network string')

        // receiver breeze account
        if (!validate.string(tx.data.receiver, config.accountMaxLength, config.accountMinLength, config.allowedUsernameChars, config.allowedUsernameCharsOnlyMiddle))
            return cb(false, 'invalid tx data.receiver')
        
        // amount in
        if (!validate.integer(tx.data.amount,true,false))
            return cb(false,'invalid amount integer')

        if (tx.sender !== config.bridgeAccount)
            return cb(false,'only bridge account can finalize withdrawals')

        // check if bridge account has sufficient balance
        cache.findOne('accounts',{name: tx.sender}, (e,bridgeAccount) => {
            if (bridgeAccount.balance < tx.data.amount)
                return cb(false,'bridge account does not have sufficient balance')
            cache.findOne('accounts',{name: tx.data.receiver}, (e,receiverAccount) => {
                if (!receiverAccount)
                    return cb(false,'receiver account does not exist')
                cache.findOne('bridge',{_id: tx.data.srctxid},(e,bridgetx) => {
                    if (bridgetx && bridgetx.status === 1)
                        return cb(false,'bridge transaction already finalized')
                    cb(true)
                })
            })
        })
    },
    execute: (tx, ts, cb) => {
        // update status for outgoing bridge transactions
        cache.insertOne('bridge', { _id: tx.hash, ts: ts, direction: 1, src: tx.data.srcaddr, dest: tx.data.receiver, network: tx.data.network, amount: tx.data.amount, extid: tx.data.srctxid, status: 1 }, () => require('./transfer').execute(tx,ts,() => cb(true)))
    },
}