module.exports = {
    fields: ['pub'],
    validate: (tx, ts, legitUser, cb) => {
        // we don't need to validate anything here
        cb(true)
    },
    execute: (tx, ts, cb) => {
        // because if key is incorrect, we just unset it
        if (validate.publicKey(tx.data.pub, config.accountMaxLength))
            cache.updateOne('accounts', {
                name: tx.sender
            },{ $set: {
                pub_witness: tx.data.pub
            }}, function(){
                cache.addWitness(tx.sender,false,() => cb(true))
            })
        else
            cache.updateOne('accounts', {
                name: tx.sender
            },{ $unset: {
                pub_witness: ''
            }}, function(){
                cache.removeWitness(tx.sender)
                cb(true)
            })
    }
}