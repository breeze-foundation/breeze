module.exports = {
    fields: ['category'],
    validate: (tx,ts,u,cb) => {
        if (!validate.string(tx.data.category, config.categoryMaxLength, config.categoryMinLength))
            return cb(false,'invalid category string')

        cache.findOne('accounts', {name: tx.sender}, (err, acc) => {
            if (err) throw err
            if (!acc.categoryFollows) acc.categoryFollows = []
            if (acc.categoryFollows.indexOf(tx.data.category) === -1)
                return cb(false, 'Already following category')
            cb(true)
        })
    },
    execute: (tx,ts,cb) => {
        cache.updateOne('accounts',{name: tx.sender},{$pull: {categoryFollows: tx.data.category.toLowerCase()}},() => cb(true))
    }
}
