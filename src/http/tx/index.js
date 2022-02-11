module.exports = {
    init: (app) => {
        // tx lookup by hash
        app.get('/tx/:txhash',(req,res) => {
            if (process.env.TX_HISTORY !== '1')
                return res.status(500).send({error: 'TX_HISTORY module is disabled'})
            db.collection('txs').findOne({ _id: req.params.txhash },(e,tx) => {
                if (!tx)
                    res.status(404).send({error: 'transaction not found'})
                else {
                    delete tx._id
                    res.send(tx)
                }
            })
        })
    }
}