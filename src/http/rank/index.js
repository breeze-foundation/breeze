module.exports = {
    init: (app) => {
        app.get('/rank/:key',(req,res) => {
            let sorting = {$sort: {}}
            let projecting = {
                $project: {
                    _id: 0,
                    name: 1,
                    balance: 1,
                    subs: { $size: '$followers' },
                    subbed: { $size: '$follows' }
                }
            }
            let matching = {$match:{}}
            switch (req.params.key) {
            case 'balance':
                sorting.$sort.balance = -1
                break
            case 'subs':
                sorting.$sort.subs = -1
                break
            case 'witnesses':
                if (process.env.WITNESS_STATS !== '1')
                    return res.status(500).send({error: 'Witness stats module is disabled by node operator'})
                projecting.$project.node_appr = 1
                projecting.$project.pub_witness = 1
                projecting.$project.hasVote = {
                    $gt: ['$node_appr',0]
                }
                sorting.$sort.node_appr = -1
                matching.$match.hasVote = true
                matching.$match.pub_witness = { $exists: true, $ne: '' }
                break
            default:
                return res.status(400).send({error: 'invalid key'})
            }

            let aggregation = [projecting, sorting, {$limit: 100}]
            if (req.params.key === 'witnesses')
                aggregation.push(matching)

            db.collection('accounts').aggregate(aggregation).toArray((e,r) => {
                if (e)
                    return res.status(500).send(e)
                if (req.params.key !== 'witnesses')
                    return res.send(r)
                else {
                    for (let witness = 0; witness < r.length; witness++) {
                        delete r[witness].hasVote
                        r[witness].produced = witnessStats.witnesses[r[witness].name].produced
                        r[witness].missed = witnessStats.witnesses[r[witness].name].missed
                        r[witness].voters = witnessStats.witnesses[r[witness].name].voters
                        r[witness].last = witnessStats.witnesses[r[witness].name].last
                    }
                    res.send(r)
                }
            })
        })
    }
}