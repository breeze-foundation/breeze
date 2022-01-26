module.exports = {
    init: (app) => {
        app.get('/promoted/:skip?', (req,res) => {
            let filters = { sort: { promoted: -1 }, limit: 3 }
            let skip = parseInt(req.params.skip)
            if (!isNaN(req.params.skip))
                filters.skip = skip
            db.collection('contents').find({
                $and: [
                    { promoted: { $exists: true } },
                    { ts: { $gte: new Date().getTime() - 86400000 } }
                ]
            }, filters).toArray((e,contents) => {
                if (e)
                    res.status(500).send({error: e.toString()})
                else
                    res.send(contents)
            })
        })
    }
}