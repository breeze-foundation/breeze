const parallel = require('run-parallel')

module.exports = {
    init: (app) => {
        app.get('/distribution',(req,res) => {
            let ops = []

            // 0.01 <= $$$ < 1,000,000 TOKENS
            for (let i = 0; i < 8; i++)
                ops.push((cb) => db.collection('accounts').aggregate([
                    {$match: {balance: {$gte: Math.pow(10,i+4), $lt: Math.pow(10,i+5)}}},
                    {$group: {_id: i, sum: {$sum: '$balance'}, count: {$sum: 1}}}
                ]).toArray((e,r) => cb(e,r[0])))

            // >=1,000,000 TOKENS
            ops.push((cb) => db.collection('accounts').aggregate([
                {$match: {balance: {$gte: Math.pow(10,12)}}},
                {$group: {_id: 8, sum: {$sum: '$balance'}, count: {$sum: 1}}}
            ]).toArray((e,r) => cb(e,r[0])))

            parallel(ops,(errors,results) => {
                if (errors)
                    return res.status(500).send(errors)
                return res.send(results)
            })
        })
    }
}