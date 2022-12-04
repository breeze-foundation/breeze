module.exports = {
    fields: ['link', 'pa', 'pp', 'json'],
    validate: (tx, ts, legitUser, cb) => {
        // permlink
        if (!validate.string(tx.data.link, config.linkMaxLength, config.accountMinLength)) {
            cb(false, 'invalid tx data.link'); return
        }
        // parent author
        if ((tx.data.pa || tx.data.pp) && !validate.string(tx.data.pa, config.accountMaxLength, config.accountMinLength, config.allowedUsernameChars, config.allowedUsernameCharsOnlyMiddle)) {
            cb(false, 'invalid tx data.pa'); return
        }
        // parent permlink
        if ((tx.data.pa || tx.data.pp) && !validate.string(tx.data.pp, config.linkMaxLength, config.accountMinLength)) {
            cb(false, 'invalid tx data.pp'); return
        }
        // handle arbitrary json input
        if (!validate.json(tx.data.json, config.jsonMaxBytes)) {
            cb(false, 'invalid tx data.json'); return
        }
        if (tx.data.pa && tx.data.pp) 
            // its a comment of another comment
            cache.findOne('contents', {_id: tx.data.pa+'/'+tx.data.pp}, function(err, content) {
                if (!content) {
                    cb(false, 'invalid tx parent comment does not exist'); return
                }
                cache.findOne('contents', {_id: tx.sender+'/'+tx.data.link}, function(err, content) {
                    if (content)
                        // user is editing an existing comment
                        if (content.pa !== tx.data.pa || content.pp !== tx.data.pp) {
                            cb(false, 'invalid tx parent comment cannot be edited'); return
                        } else 
                            cb(true)
                    else
                        // it is a new comment
                        cb(true)
                })
            })
        else 
            cb(true)
    },
    execute: (tx, ts, cb) => {
        cache.findOne('contents', {_id: tx.sender+'/'+tx.data.link}, function(err, content) {
            if (err) throw err
            if (content && process.env.CONTENTS === '1')
                // existing content being edited
                cache.updateOne('contents', {_id: tx.sender+'/'+tx.data.link}, {
                    $set: {json: tx.data.json}
                }, function(){
                    content.json = tx.data.json
                    cb(true)
                })
            else if (content) 
                // existing content being edited but node running without CONTENT module
                cb(true)
            else {
                // new content
                let newContent = {
                    _id: tx.sender+'/'+tx.data.link,
                    author: tx.sender,
                    link: tx.data.link,
                    pa: tx.data.pa,
                    pp: tx.data.pp,
                    json: process.env.CONTENTS === '1' ? tx.data.json : {},
                    child: [],
                    votes: [],
                    likes: 0,
                    ts: ts
                }
                cache.insertOne('contents', newContent, function(){
                    if (config.ecoVersion === 3)
                        eco.currentBlock.posts.push(tx.sender+'/'+tx.data.link)
                    if (tx.data.pa && tx.data.pp && process.env.CONTENTS === '1') 
                        cache.updateOne('contents', {_id: tx.data.pa+'/'+tx.data.pp}, { $push: {
                            child: [tx.sender, tx.data.link]
                        }}, function() {
                            cb(true)
                        })
                    else 
                        cb(true)
                })
            }
        })
    }
}