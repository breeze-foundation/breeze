module.exports = {
    init: (app) => {
        // get account info
        app.get('/account/:name', (req, res) => {
            if (!req.params.name)
                return res.status(400).send({error: 'account name is required'})
            db.collection('accounts').findOne({ name: req.params.name }, function (err, account) {
                if (!account)
                    return res.status(404).send({error: 'account not found'})
                let lastRead = account.lastRead || 0
                db.collection('notifications').find({ $and: [
                    { u: req.params.name },
                    { ts: { $gt: lastRead }}
                ]}).toArray(function (err, notifs) {
                    if (!notifs)
                        account.unread = 0
                    else
                        account.unread = notifs.length
                    res.send(account)
                })
            })
        })
    }
}
