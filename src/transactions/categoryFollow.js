module.exports = {
    fields: ['category'],
    validate: (tx,ts,u,cb) => {
        if (!validate.string(tx.data.category, config.categoryMaxLength, config.categoryMinLength))
            return cb(false,'invalid category string')

        cache.findOne('accounts', {name: tx.sender}, (err, acc) => {
            if (err) throw err
            if (!acc.categoryFollows) acc.categoryFollows = []
            if (acc.categoryFollows.indexOf(tx.data.category.toLowerCase()) > -1)
                return cb(false, 'already following category')
            if (acc.categoryFollows.length >= config.categoryMaxFollows)
                return cb(false, 'max follows reached')
            cb(true)
        })
    },
    execute: (tx,ts,cb) => {
        cache.updateOne('accounts',{name: tx.sender},{$push: {categoryFollows: tx.data.category.toLowerCase()}},() => cb(true))
    }
}