module.exports = {
    init: (app) => {
        // transfer history api
        app.get('/transfers/:user/:skip?', (req, res) => {
            if (process.env.TX_HISTORY !== '1')
                return res.status(500).send({error: 'TX_HISTORY module is disabled'})

            let skip = parseInt(req.params.skip)
            let user = req.params.user
            let ops = [3,13,23]
            let query = {
                $and: [
                    { $or: [
                        {'sender': user},
                        {'data.receiver': user},
                    ]},
                    { $or: []}
                ]
            }
            let filter = {
                sort: {includedInBlock: -1},
                limit: 50
            }

            for (let i in ops)
                query['$and'][1]['$or'].push({'type': ops[i]})
            
            if (!isNaN(skip) && skip > 0)
                filter.skip = skip
    
            db.collection('txs').find(query, filter).toArray(function(err, txs) {
                if (err || !txs)
                    return res.status(500).send({error: 'failed to query account history'})
                for (let t = 0; t < txs.length; t++)
                    delete txs[t]._id
                res.send(txs)
            })
        })
    }
}
