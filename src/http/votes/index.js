module.exports = {
    init: (app) => {
        // get votes history of a user
        app.get('/votes/:voter/:lastTs?', (req, res) => {
            let voter = req.params.voter
            let query = {
                $and: [{
                    'votes.u': voter,
                }]
            }

            // if lastTs is today, get today's votes by user instead
            if (req.params.lastTs === 'today') {
                let startTs = new Date().setUTCHours(0,0,0,0)
                let startContentTs = startTs - config.maxContentAge // oldest content ts possible on today's vote
                query.$and.push({ 'votes.ts': { $gte: startTs } })
                query.$and.push({ ts: { $gte: startContentTs } })
                db.collection('contents').find(query).toArray((e,contents) => {
                    if (e) return res.status(500).send({error: e})
                    extractVotes(contents,voter,(v) => res.send(v))
                })
            } else {
                let lastTs = parseInt(req.params.lastTs)
                if (!isNaN(lastTs) && lastTs > 0)
                    query['$and'].push({ ts: { $lt: lastTs } })

                db.collection('contents').find(query, { sort: { ts: -1 }, limit: 50 }).toArray((err, contents) => {
                    if (err) throw err
                    extractVotes(contents,voter,(v) => res.send(v))
                })
            }
        })
    }
}

function extractVotes(contents,voter,cb) {
    let votes = []
    for (let i = 0; i < contents.length; i++) 
        for (let y = 0; y < contents[i].votes.length; y++) 
            if (contents[i].votes[y].u === voter)
                votes.push({
                    author: contents[i].author,
                    link: contents[i].link,
                    vp: contents[i].votes[y].vp,
                    ts: contents[i].votes[y].ts,
                    contentTs: contents[i].ts,
                    burn: contents[i].votes[y].burn,
                    likes: contents[i].likes,
                    json: contents[i].json
                })
    cb(votes)
}