module.exports = {
    fields: [],
    validate: (tx,ts,u,cb) => cb(true),
    execute: (tx,ts,cb) => cache.updateOne('accounts', {name: tx.sender}, {$set: { lastRead: ts }}, () => cb(true))
}