module.exports = {
    init: (app) => {
        // get trending
        app.get('/trending/:skip?',(req,res) => {
            let query = {$and:[{ pa: null }]}
            let filter = { sort: { likes: -1 }, limit: 50 }
            let skip = parseInt(req.params.skip)
            if (req.query.category)
                query.$and.push({'json.category': req.query.category})
            if (req.query.tag)
                query.$and.push({'json.tags': req.query.tag})
            if (req.query.limit && !isNaN(parseInt(req.query.limit)))
                filter.limit = Math.max(1,Math.min(1000,parseInt(req.query.limit)))
            if (req.query.after && !isNaN(parseInt(req.query.after)))
                query.ts = {$gte: parseInt(req.query.after)}
            if (!isNaN(skip) && skip > 0)
                filter.skip = skip
            db.collection('contents').find(query, filter).toArray(function (err, contents) {
                res.send(contents)
            })
        })
    }
}
