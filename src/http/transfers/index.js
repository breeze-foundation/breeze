module.exports = {
    init: (app) => {
        // transfer history api
        app.get('/transfers/:user/:skip?', (req, res) => {
            let skip = parseInt(req.params.skip)
            let user = req.params.user
            let ops = [3,13,23]
            let query = {
                $and: [
                    { $or: [
                        {'txs.sender': user},
                        {'txs.data.receiver': user},
                    ]},
                    { $or: []}
                ]
            }
            let filter = {
                sort: {_id: -1},
                limit: 50
            }

            for (let i in ops)
                query['$and'][1]['$or'].push({'txs.type': ops[i]})
            
            if (!isNaN(skip) && skip > 0)
                filter.skip = skip
    
            db.collection('blocks').find(query, filter).toArray(function(err, blocks) {
                let txs = []
                for (let b = 0; b < blocks.length; b++)
                    for (let t = 0; t < blocks[b].txs.length; t++)
                        if ((blocks[b].txs[t].sender === user
                        || blocks[b].txs[t].data.receiver === user)
                        && ops.includes(blocks[b].txs[t].type))
                            txs.push(blocks[b].txs[t])
                res.send(txs)
            })
        })
    }
}
