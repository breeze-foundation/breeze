module.exports = {
    init: (app) => {
        // get blog of user
        app.get('/blog/:username', (req, res) => {
            let username = req.params.username
            let sort = req.query.sort
            let selector = { sort: {}, limit: 50 }
            if (sort === 'likes')
                selector.sort.likes = -1
            else
                selector.sort.ts = -1
            db.collection('contents').find({ pa: null, author: username }, selector).toArray(function (err, contents) {
                res.send(contents)
            })
        })
        app.get('/blog/:username/:author/:link', (req, res) => {
            db.collection('contents').findOne({
                $and: [
                    { author: req.params.author },
                    { link: req.params.link }
                ]
            }, function (err, content) {
                if (err || !content) {
                    res.send([])
                    return
                }
                let username = req.params.username
                let sort = req.query.sort
                let query = [
                    { pa: null },
                    { author: username }
                ]
                let selector = { sort: {}, limit: 50 }
                if (sort === 'likes') {
                    query.push({likes: { $lte: content.likes }})
                    selector.sort.likes = -1
                } else {
                    query.push({ts: { $lte: content.ts }})
                    selector.sort.ts = -1
                }
                db.collection('contents').find({ $and: query }, selector).toArray(function (err, contents) {
                    res.send(contents)
                })
            })
        })
    }
}
