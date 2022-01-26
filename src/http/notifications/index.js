module.exports = {
    init: (app) => {
        // get notifications for a user
        app.get('/notifications/:name', (req, res) => {
            if (!req.params.name) {
                res.sendStatus(500)
                return
            }
            db.collection('notifications').find({ u: req.params.name }, { sort: { ts: -1 }, limit: 200 }).toArray(function (err, notifs) {
                if (!notifs) res.sendStatus(404)
                else res.send(notifs)
            })
        })
    }
}
