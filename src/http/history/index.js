module.exports = {
    init: (app) => {
        // account history api
        app.get('/history/:author/:lastBlock/:skip?', (req, res) => {
            if (process.env.TX_HISTORY !== '1')
                return res.status(500).send({error: 'TX_HISTORY module is disabled'})

            let lastBlock = parseInt(req.params.lastBlock)
            let skip = parseInt(req.params.skip)
            let author = req.params.author
            let query = {
                $and: [
                    { $or: [
                        {'sender': author},
                        {'data.target': author},
                        {'data.receiver': author},
                        {'data.pa': author},
                        {'data.author': author}
                    ]}
                ]
            }
            let filter = {
                sort: {includedInBlock: -1},
                limit: 50
            }
    
            if (lastBlock > 0) 
                query['$and'].push({includedInBlock: {$lt: lastBlock}})
            
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
