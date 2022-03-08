module.exports = {
    fields: ['link', 'author'],
    validate: async (tx, ts, legitUser, cb) => {
        if (!validate.string(tx.data.author, config.accountMaxLength, config.accountMinLength, config.allowedUsernameChars, config.allowedUsernameCharsOnlyMiddle))
            return cb(false,'invalid tx data.author')

        if (!validate.string(tx.data.link, config.linkMaxLength, config.accountMinLength))
            return cb(false, 'invalid tx data.link')

        if (tx.sender === tx.data.author)
            return cb(false,'cannot vote for your own content')

        let nextvp = await transaction.nextVP(tx.sender,ts)
        if (!transaction.hasEnoughVP(nextvp, ts, legitUser))
            return cb(false, 'invalid tx not enough vp, attempting to spend ' + nextvp + ' VP')
            
        // checking if content exists
        cache.findOne('contents', {_id: tx.data.author+'/'+tx.data.link}, function(err, content) {
            if (!content) {
                cb(false, 'invalid tx non-existing content'); return
            }
            if (!config.allowRevotes) 
                for (let i = 0; i < content.votes.length; i++) 
                    if (tx.sender === content.votes[i].u) {
                        cb(false, 'invalid tx user has already voted'); return
                    }
            if (config.maxContentAge && ts - content.ts > config.maxContentAge)
                return cb(false, 'content too old to be voted on')
            cb(true)
        })
    },
    execute: async (tx, ts, cb) => {
        let vote = {
            u: tx.sender,
            ts: ts,
            vp: await transaction.nextVP(tx.sender,ts,-1)
        }
        if (config.ecoVersion === 1) {
            eco.curation(tx.data.author, tx.data.link, vote, () => cb(true))
        } else if (config.ecoVersion === 2) {
            if (!eco.currentBlock.votes[tx.data.author])
                eco.currentBlock.votes[tx.data.author] = {}
            if (!eco.currentBlock.votes[tx.data.author][tx.data.link])
                eco.currentBlock.votes[tx.data.author][tx.data.link] = [vote]
            else
                eco.currentBlock.votes[tx.data.author][tx.data.link].push(vote)
            eco.currentBlock.voteCount++
            eco.currentBlock.vpCount += vote.vp
            if (!config.hotfix1)
                return cb(true)
            cache.updateOne('contents', {_id: tx.data.author+'/'+tx.data.link}, {
                $push: { votes: vote }
            },() => cb(true))
        }
    }
}