module.exports = {
    init: (app) => {
        app.get('/witness/:account',(req,res) => {
            if (!req.params.account)
                res.status(404).send({error: 'account is required'})
            db.collection('accounts').findOne({name: req.params.account}, (e,acc) => {
                if (e) return res.status(500).send(e)
                if (!acc) return res.status(404).send({error: 'account does not exist'})
                if (!acc.pub_witness) return res.status(404).send({error: 'account does not contain a witness signing key'})
                res.send({
                    name: acc.name,
                    balance: acc.balance,
                    node_appr: acc.node_appr,
                    pub_witness: acc.pub_witness,
                    subs: acc.followers.length,
                    subbed: acc.follows.length,
                    produced: witnessStats.witnesses[acc.name].produced,
                    missed: witnessStats.witnesses[acc.name].missed,
                    voters: witnessStats.witnesses[acc.name].voters,
                    last: witnessStats.witnesses[acc.name].last
                })
            })
        })
    }
}