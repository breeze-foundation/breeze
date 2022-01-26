// witness indexer from extended api
let indexer = {
    witnesses: {
        breeze: {
            produced: 1,
            missed: 0,
            voters: 1, // genesis
            last: 0
        }
    },
    updates: {
        witnesses: []
    },
    processBlock: (block) => {
        if (process.env.WITNESS_STATS !== '1') return
        if (!block)
            throw new Error('cannot process undefined block')

        // Setup new witness accounts
        if (!indexer.witnesses[block.miner])
            indexer.witnesses[block.miner] = {
                produced: 0,
                missed: 0,
                voters: 0,
                last: 0
            }
        if (block.missedBy && !indexer.witnesses[block.missedBy])
            indexer.witnesses[block.missedBy] = {
                produced: 0,
                missed: 0,
                voters: 0,
                last: 0
            }

        // Increment produced/missed
        indexer.witnesses[block.miner].produced += 1
        indexer.witnesses[block.miner].last = block._id
        if (block.missedBy) indexer.witnesses[block.missedBy].missed += 1

        if (!indexer.updates.witnesses.includes(block.miner))
            indexer.updates.witnesses.push(block.miner)

        if (block.missedBy && !indexer.updates.witnesses.includes(block.missedBy))
            indexer.updates.witnesses.push(block.missedBy)

        // Look for approves/disapproves in tx
        for (let i = 0; i < block.txs.length; i++)
            if (block.txs[i].type === 1) {
                // APPROVE_NODE_OWNER
                if (!indexer.witnesses[block.txs[i].data.target]) indexer.witnesses[block.txs[i].data.target] = {
                    produced: 0,
                    missed: 0,
                    voters: 0,
                    last: 0
                }
                indexer.witnesses[block.txs[i].data.target].voters += 1
                if (!indexer.updates.witnesses.includes(block.txs[i].data.target))
                    indexer.updates.witnesses.push(block.txs[i].data.target)
            } else if (block.txs[i].type === 2) {
                // DISAPPROVE_NODE_OWNER
                if (!indexer.witnesses[block.txs[i].data.target]) indexer.witnesses[block.txs[i].data.target] = {
                    produced: 0,
                    missed: 0,
                    voters: 0,
                    last: 0
                }
                indexer.witnesses[block.txs[i].data.target].voters -= 1
                if (!indexer.updates.witnesses.includes(block.txs[i].data.target))
                    indexer.updates.witnesses.push(block.txs[i].data.target)
            } else if (block.txs[i].type === 18 && !indexer.witnesses[block.txs[i].sender]) {
                // ENABLE_NODE
                indexer.witnesses[block.txs[i].sender] = {
                    produced: 0,
                    missed: 0,
                    voters: 0,
                    last: 0
                }
                if (!indexer.updates.witnesses.includes(block.txs[i].sender))
                    indexer.updates.witnesses.push(block.txs[i].sender)
            }
    },
    getWriteOps: () => {
        if (process.env.WITNESS_STATS !== '1') return []
        let ops = []
        for (let acc in indexer.updates.witnesses) {
            let updatedWitness = indexer.updates.witnesses[acc]
            ops.push((cb) => db.collection('witnesses').updateOne({_id: updatedWitness },{
                $set: indexer.witnesses[updatedWitness]
            },{ upsert: true },() => cb(null,true)))
        }
        indexer.updates.witnesses = []
        return ops
    },
    loadIndex: () => {
        return new Promise((rs,rj) => {
            if (process.env.WITNESS_STATS !== '1') return rs()
            db.collection('witnesses').find({},{}).toArray((e,witnesses) => {
                if (e) return rj(e)
                if (witnesses) for (let i in witnesses) {
                    indexer.witnesses[witnesses[i]._id] = witnesses[i]
                    delete indexer.witnesses[witnesses[i]._id]._id
                }
                rs()
            })
        })
    }
}

module.exports = indexer