module.exports = {
    init: (app) => {
        // get distributions for a user
        app.get('/distributed/:name', (req, res) => {
            if (!req.params.name) {
                res.sendStatus(500)
                return
            }
            db.collection('distributed').find({ name: req.params.name }, { sort: { ts: -1 }, limit: 200 }).toArray(function (err, distributions) {
                if (!distributions) res.sendStatus(404)
                else res.send(distributions)
            })
        })

        // today's total dist
        app.get('/distributed/:name/today', (req, res) => {
            if (!req.params.name)
                return res.sendStatus(500)
            db.collection('distributed').find({ $and: [
                { name: req.params.name },
                { ts: { $gte: new Date().getTime() - 86400000 }}
            ]}).toArray(function (err, distributions) {
                if (!distributions)
                    return res.send({ dist: 0 })
                let total = 0
                for (let i = 0; i < distributions.length; i++)
                    total += distributions[i].dist
                res.send({ dist: total })
            })
        })
    }
}
