module.exports = {
    fields: ['srctxid','desttxid','status'],
    validate: (tx, ts, legitUser, cb) => {
        // source breeze tx hash that initiated the transfer operation, assuming that validation is done externally
        if (!validate.string(tx.data.srctxid))
            return cb(false,'invalid source tx id string')

        // destination external chain tx id (if any). Network should already have been specified in BRIDGE_DEPOSIT operation.
        if (!validate.string(tx.data.desttxid))
            return cb(false,'invalid destination tx id string')
        
        // bridge tx status - 0: Pending, 1: Success, 2: Errored
        if (!validate.integer(tx.data.status,true,false))
            return cb(false,'invalid status integer')

        if (tx.sender !== config.bridgeAccount)
            return cb(false,'only bridge account can update bridge tx status')

        cache.findOne('bridge', { _id: tx.data.srctxid }, (e,bridgetx) => {
            if (!bridgetx)
                return cb(false,'source tx not found')
            else if (bridgetx.status === 1)
                return cb(false,'bridge transaction already finalized')
            cb(true)
        })
    },
    execute: (tx, ts, cb) => {
        // update status for outgoing bridge transactions
        cache.updateOne('bridge', { _id: tx.data.srctxid }, { $set: {lastTs: ts, extid: tx.data.desttxid, status: tx.data.status }},() => cb(true))
    },
}