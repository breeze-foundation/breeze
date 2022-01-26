module.exports = {
    init: (app) => {
        app.get('/votestoday',(req,res) => {
            let startTs = new Date().setUTCHours(0,0,0,0)
            let startContentTs = startTs - config.maxContentAge
            let query = {
                $and: [
                    { 'votes.ts': { $gte: startTs } },
                    { ts: { $gte: startContentTs } }
                ]
            }
            db.collection('contents').find(query).toArray((e,c) => {
                if (e) return res.status(500).send({error: e})
                let votes = 0
                for (let i in c)
                    votes += c[i].votes.length
                return res.send({ votes: votes })
            })
        })
    }
}