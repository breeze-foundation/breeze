const parallel = require('run-parallel')
const cloneDeep = require('clone-deep')
const ProcessingQueue = require('./processingQueue')
const txHistory = require('./txHistory')
let cache = {
    copy: {
        accounts: {},
        contents: {},
        distributed: {},
        bridge: {}
    },
    accounts: {},
    contents: {},
    distributed: {},
    bridge: {},
    changes: [],
    inserts: [],
    rebuild: {
        changes: [],
        inserts: []
    },
    witnesses: {},
    witnessChanges: [],
    writerQueue: new ProcessingQueue(),
    rollback: function() {
        // rolling back changes from copied documents
        for (const col in cache.copy) {
            for (const key in cache.copy[col])
                cache[col][key] = cloneDeep(cache.copy[col][key])
            cache.copy[col] = {}
        }
        cache.changes = []

        // and discarding new inserts
        for (let i = 0; i < cache.inserts.length; i++) {
            let toRemove = cache.inserts[i]
            let key = cache.keyByCollection(toRemove.collection)
            delete cache[toRemove.collection][toRemove.document[key]]
        }
        cache.inserts = []

        // reset witness changes
        for (let i in cache.witnessChanges)
            if (cache.witnessChanges[i][1] === 0)
                cache.addWitness(cache.witnessChanges[i][0],true,()=>{})
            else if (cache.witnessChanges[i][1] === 1)
                cache.removeWitness(cache.witnessChanges[i][0],true)
        cache.witnessChanges = []
    },
    findOne: function(collection, query, cb) {
        if (['accounts','blocks','contents','bridge'].indexOf(collection) === -1) {
            cb(true)
            return
        }
        let key = cache.keyByCollection(collection)
        // searching in cache
        if (cache[collection][query[key]]) {
            let res = cloneDeep(cache[collection][query[key]])
            cb(null, res)
            return
        }
        
        // no match, searching in mongodb
        db.collection(collection).findOne(query, function(err, obj) {
            if (err) logr.debug('error cache')
            else {
                if (!obj) {
                    // doesnt exist
                    cb(); return
                }
                // found, adding to cache
                cache[collection][obj[key]] = obj

                // cloning the object before sending it
                let res = cloneDeep(obj)
                cb(null, res)
            }
        })
    },
    updateOne: function(collection, query, changes, cb) {
        cache.findOne(collection, query, function(err, obj) {
            if (err) throw err
            if (!obj) {
                cb(null, false); return
            }
            let key = cache.keyByCollection(collection)

            if (!cache.copy[collection][obj[key]])
                cache.copy[collection][obj[key]] = cloneDeep(cache[collection][obj[key]])
            
            for (let c in changes) 
                switch (c) {
                case '$inc':
                    for (let i in changes[c]) 
                        if (!cache[collection][obj[key]][i])
                            cache[collection][obj[key]][i] = changes[c][i]
                        else
                            cache[collection][obj[key]][i] += changes[c][i]
                    
                    break

                case '$push':
                    for (let p in changes[c]) {
                        if (!cache[collection][obj[key]][p])
                            cache[collection][obj[key]][p] = []
                        cache[collection][obj[key]][p].push(changes[c][p])
                    }
                    break

                case '$pull':
                    for (let l in changes[c]) 
                        for (let y = 0; y < cache[collection][obj[key]][l].length; y++)
                            if (typeof changes[c][l] === 'object') {
                                let matching = true
                                for (const v in changes[c][l])
                                    if (cache[collection][obj[key]][l][y][v] !== changes[c][l][v]) {
                                        matching = false
                                        break
                                    }
                                if (matching)
                                    cache[collection][obj[key]][l].splice(y, 1)
                            } else if (cache[collection][obj[key]][l][y] === changes[c][l]) 
                                cache[collection][obj[key]][l].splice(y, 1)
                            
                    break

                case '$set':
                    for (let s in changes[c]) 
                        cache[collection][obj[key]][s] = changes[c][s]
                    
                    break

                case '$unset':
                    for (let u in changes[c]) 
                        delete cache[collection][obj[key]][u]
                    
                    break
                
                default:
                    break
                }
            
            cache.changes.push({
                collection: collection,
                query: query,
                changes: changes
            })
            cb(null, true)
        })
    },
    updateMany: function(collection, query, changes, cb) {
        let key = cache.keyByCollection(collection)
        if (!query[key] || !query[key]['$in']) 
            throw 'updateMany requires a $in operator'
        

        let indexesToUpdate = query[key]['$in']
        let executions = []
        for (let i = 0; i < indexesToUpdate.length; i++) 
            executions.push(function(callback) {
                let newQuery = {}
                newQuery[key] = indexesToUpdate[i]
                cache.updateOne(collection, newQuery, changes, function(err, result) {
                    callback(null, result)
                })
            })
        
        parallel(executions, function(err, results) {
            cb(err, results)
        })
    },
    insertOne: function(collection, document, cb) {
        let key = cache.keyByCollection(collection)
        if (cache[collection][document[key]]) {
            cb(null, false); return
        }
        cache[collection][document[key]] = document
        cache.inserts.push({
            collection: collection,
            document: document
        })

        cb(null, true)
    },
    addWitness: (witness,isRollback,cb) => {
        if (!cache.witnesses[witness])
            cache.witnesses[witness] = 1
        if (!isRollback)
            cache.witnessChanges.push([witness,1])
        // make sure account is cached
        cache.findOne('accounts',{name:witness},() => cb())
    },
    removeWitness: (witness,isRollback) => {
        if (cache.witnesses[witness])
            delete cache.witnesses[witness]
        if (!isRollback)
            cache.witnessChanges.push([witness,0])
    },
    clear: function() {
        cache.changes = []
        cache.inserts = []
        cache.rebuild.changes = []
        cache.rebuild.inserts = []
        cache.witnessChanges = []
        for (const col in cache.copy)
            cache.copy[col] = {}
    },
    writeToDisk: function(rebuild, cb) {
        // if (cache.inserts.length) logr.debug(cache.inserts.length+' Inserts')
        let executions = []
        // executing the inserts (new comment / new account)
        let insertArr = rebuild ? cache.rebuild.inserts : cache.inserts
        for (let i = 0; i < insertArr.length; i++)
            executions.push(function(callback) {
                let insert = insertArr[i]
                db.collection(insert.collection).insertOne(insert.document, function(err) {
                    if (err) throw err
                    callback()
                })
            })

        // then the update with simple operation compression
        // 1 update per document concerned (even if no real change)
        let docsToUpdate = {
            accounts: {},
            contents: {},
            distributed: {},
            bridge: {}
        }
        let changesArr = rebuild ? cache.rebuild.changes : cache.changes
        for (let i = 0; i < changesArr.length; i++) {
            let change = changesArr[i]
            let collection = change.collection
            let key = change.query[cache.keyByCollection(collection)]
            docsToUpdate[collection][key] = cache[collection][key]
        }

        // if (cache.changes.length) logr.debug(cache.changes.length+' Updates compressed to '+Object.keys(docsToUpdate.accounts).length+' accounts, '+Object.keys(docsToUpdate.contents).length+' contents')

        for (const col in docsToUpdate) 
            for (const i in docsToUpdate[col]) 
                executions.push(function(callback) {
                    let key = cache.keyByCollection(col)
                    let newDoc = docsToUpdate[col][i]
                    let query = {}
                    query[key] = newDoc[key]
                    db.collection(col).replaceOne(query, newDoc, function(err) {
                        if (err) throw err
                        callback()
                    })
                })

        // witness stats
        if (process.env.WITNESS_STATS === '1') {
            let witnessStatsWriteOps = witnessStats.getWriteOps()
            for (let op in witnessStatsWriteOps)
                executions.push(witnessStatsWriteOps[op])
        }

        // tx history
        if (process.env.TX_HISTORY === '1') {
            let txHistoryWriteOps = txHistory.getWriteOps()
            for (let op in txHistoryWriteOps)
                executions.push(txHistoryWriteOps[op])
        }

        // current state at block number
        executions.push((callback) => db.collection('state').updateOne({_id: 0},{$set:{headBlock:chain.getLatestBlock()._id}},{ upsert: true },() => callback(null,true)))

        if (typeof cb === 'function') {
            let timeBefore = new Date().getTime()
            parallel(executions, function(err, results) {
                let execTime = new Date().getTime()-timeBefore
                if (!rebuild && execTime >= config.blockTime/2)
                    logr.warn('Slow write execution: ' + executions.length + ' mongo queries took ' + execTime + 'ms')
                else
                    logr.debug(executions.length+' mongo queries executed in '+execTime+'ms')
                cache.clear()
                cb(err, results)
            })
        } else {
            logr.debug(executions.length+' mongo ops queued')
            cache.writerQueue.push((callback) => parallel(executions,() => callback()))
            cache.clear()
        }
    },
    processRebuildOps: (cb,writeToDisk) => {
        for (let i in cache.inserts)
            cache.rebuild.inserts.push(cache.inserts[i])
        for (let i in cache.changes)
            cache.rebuild.changes.push(cache.changes[i])
        cache.inserts = []
        cache.changes = []
        cache.witnessChanges = []
        for (const col in cache.copy)
            cache.copy[col] = {}
        if (writeToDisk)
            cache.writeToDisk(true,cb)
        else
            cb()
    },
    keyByCollection: function(collection) {
        switch (collection) {
        case 'accounts':
            return 'name'
        
        default:
            return '_id'
        }
    },
    warmup: (collection, maxDoc) => new Promise((rs,rj) => {
        if (!collection || !maxDoc || maxDoc === 0)
            return rs(null)

        switch (collection) {
        case 'accounts':
            db.collection(collection).find({}, {
                sort: {node_appr: -1, name: -1},
                limit: maxDoc
            }).toArray(function(err, accounts) {
                if (err) throw err
                for (let i = 0; i < accounts.length; i++)
                    cache[collection][accounts[i].name] = accounts[i]
                rs(null)
            })
            break

        case 'contents':
        case 'bridge':
            db.collection(collection).find({}, {
                sort: {ts: -1},
                limit: maxDoc
            }).toArray(function(err, contents) {
                if (err) throw err
                for (let i = 0; i < contents.length; i++)
                    cache[collection][contents[i]._id] = contents[i]
                rs(null)
            })
            break
    
        default:
            rj('Collection type not found')
            break
        }
    }),
    warmupWitnesses: () => new Promise((rs) => {
        db.collection('accounts').find({
            $and: [
                {pub_witness: {$exists:true}},
                {pub_witness: {$ne: ''}}
            ]
        }).toArray((e,accs) => {
            if (e) throw e
            for (let i in accs) {
                cache.witnesses[accs[i].name] = 1
                if (!cache.accounts[accs[i].name])
                    cache.accounts[accs[i].name] = accs[i]
            }
            rs(accs.length)
        })
    })
}

module.exports = cache