module.exports = {
    fields: ['destaddr','network','amount'],
    validate: (tx, ts, legitUser, cb) => {
        // external chain source address
        if (!validate.string(tx.data.destaddr))
            return cb(false,'invalid destination address string')

        // external chain network
        if (!validate.string(tx.data.network))
            return cb(false,'invalid destination chain network string')
        
        // amount in
        if (!validate.integer(tx.data.amount,true,false))
            return cb(false,'invalid amount integer')

        if (tx.sender === config.bridgeAccount)
            return cb(false,'bridge account cannot deposit coins to itself')

        // check if sender account has sufficient balance
        cache.findOne('accounts',{name: tx.sender}, (e,acc) => {
            if (acc.balance < tx.data.amount)
                return cb(false,'account does not have sufficient balance')
            else
                cb(true)
        })
    },
    execute: (tx, ts, cb) => {
        let transferOp = {
            data: {
                receiver: config.bridgeAccount,
                amount: tx.data.amount,
                memo: ''
            },
            sender: tx.sender,
            ts: ts
        }
        cache.insertOne('bridge',{_id: tx.hash, ts: ts, direction: 0, src: tx.sender, dest: tx.data.destaddr, network: tx.data.network, amount: tx.data.amount, status: 0}, () => require('./transfer').execute(transferOp,ts,() => cb(true)))
    },
}