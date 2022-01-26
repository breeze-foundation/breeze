module.exports = {
    init: (app) => {
        app.get('/bridge/new/:status/:skip?',(req,res) => {
            let skip = parseInt(req.params.skip)
            let status = parseInt(req.params.status)
            let validStatuses = [0,1,2]
            if (isNaN(status) || !validStatuses.includes(status))
                return res.status(400).send({error: 'invalid status'})

            let filter = {
                sort: {ts: -1},
                limit: 50
            }
            if (!isNaN(skip) && skip > 0)
                filter.skip = skip

            db.collection('bridge').find({status: status},filter).toArray((e,txs) => {
                if (e)
                    return res.status(500).send({error: e})
                res.send(txs)
            })
        })

        app.get('/bridge/history/:username/:direction/:skip?',(req,res) => {
            let skip = parseInt(req.params.skip)
            let direction = parseInt(req.params.direction)
            if (isNaN(direction) || direction !== 0 || direction !== 1)
                return res.status(400).send({error: 'invalid direction'})
            
            let query = {
                $and: [{direction: req.params.direction}]
            }
            let filter = {
                sort: {ts: -1},
                limit: 50
            }
            if (!isNaN(skip) && skip > 0)
                filter.skip = skip

            if (direction === 0)
                query.$and.push({src: req.params.username})
            else if (direction === 1)
                query.$and.push({dest: req.params.username})
            
            
            db.collection('bridge').find(query,filter).toArray((e,txs) => {
                if (e)
                    return res.status(500).send({error: e})
                res.send(txs)
            })
        })
    }
}