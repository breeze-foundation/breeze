module.exports = {
    init: (app) => {
        // get new contents
        app.get('/new/:skip?', (req, res) => {
            let query = {$and:[{ pa: null }]}
            let filter = { sort: { ts: -1 }, limit: 20 }
            let skip = parseInt(req.params.skip)
            if (req.query.category)
                query.$and.push({'json.category': req.query.category})
            if (req.query.tag)
                query.$and.push({'json.tags': req.query.tag})
            if (req.query.limit && !isNaN(parseInt(req.query.limit)))
                filter.limit = Math.max(1,Math.min(1000,parseInt(req.query.limit)))
            if (!isNaN(skip) && skip > 0)
                filter.skip = skip
            db.collection('contents').find(query, filter).toArray(function (err, contents) {
                res.send(contents)
            })
        })
    }
}
