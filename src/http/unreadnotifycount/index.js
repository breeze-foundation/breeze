module.exports = {
    init: (app) => {
        // get unread notifications count
        app.get('/unreadnotifycount/:name', (req,res) => {
            if (!req.params.name)
                return res.status(400).send({error: 'username is required'})
            db.collection('accounts').findOne({name: req.params.name}, (e,acc) => {
                if (!acc)
                    return res.status(404).send({error: 'account not found'})
                let lastRead = acc.lastRead || 0
                db.collection('notifications').find({ $and: [
                    { u: req.params.name },
                    { ts: { $gt: lastRead }}
                ]}).toArray(function (err, notifs) {
                    if (!notifs) res.sendStatus({count: 0})
                    else res.send({count: notifs.length})
                })
            })
        })
    }
}