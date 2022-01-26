module.exports = {
    init: (app) => {
        // get feed contents
        app.get('/categoryfeed/:username', (req, res) => {
            db.collection('accounts').findOne({ name: req.params.username }, function (err, account) {
                if (!account || !account.categoryFollows || account.categoryFollows.length === 0)
                    res.send([])
                else {
                    let queries = []
                    for (let i in account.categoryFollows)
                        queries.push({'json.category':account.categoryFollows[i]})
                    db.collection('contents').find({
                        $or: queries
                    }, { sort: { ts: -1 }, limit: 50 }).toArray(function (err, contents) {
                        res.send(contents)
                    })
                }
            })
        })
        app.get('/categoryfeed/:username/:author/:link', (req, res) => {
            db.collection('contents').findOne({
                $and: [
                    { author: req.params.author },
                    { link: req.params.link }
                ]
            }, function (err, content) {
                db.collection('accounts').findOne({ name: req.params.username }, function (err, account) {
                    if (!account.follows || account.categoryFollows.length === 0)
                        res.send([])
                    else {
                        let queries = []
                        for (let i in account.categoryFollows)
                            queries.push({'json.category':account.categoryFollows[i]})
                        db.collection('contents').find({
                            $and: [
                                { ts: { $lte: content.ts } },
                                { $or: queries }
                            ]
                        }, { sort: { ts: -1 }, limit: 50 }).toArray(function (err, contents) {
                            res.send(contents)
                        })
                    }
                })
            })
        })
    }
}
