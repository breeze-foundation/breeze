const CryptoJS = require('crypto-js')
const { randomBytes } = require('crypto')
const secp256k1 = require('secp256k1')
const bs58 = require('base-x')(config.b58Alphabet)
const series = require('run-series')
const parallel = require('run-parallel')
const cloneDeep = require('clone-deep')
const transaction = require('./transaction.js')
const txtypes = require('./transactions').Types
const notifications = require('./notifications.js')
const txHistory = require('./txHistory')
const blocks = require('./blocks')
const GrowInt = require('growint')
const default_replay_output = 100
const replay_output = process.env.REPLAY_OUTPUT || default_replay_output
const max_batch_blocks = 10000

class Block {
    constructor(index, phash, timestamp, txs, miner, missedBy, signature, hash) {
        this._id = index
        this.phash = phash.toString()
        this.timestamp = timestamp
        this.txs = txs
        this.miner = miner
        if (missedBy) this.missedBy = missedBy
        this.hash = hash
        this.signature = signature
    }
}

let chain = {
    blocksToRebuild: [],
    restoredBlocks: 0,
    schedule: null,
    recentBlocks: [],
    recentTxs: {},
    getNewKeyPair: () => {
        let privKey, pubKey
        do {
            privKey = randomBytes(config.randomBytesLength)
            pubKey = secp256k1.publicKeyCreate(privKey)
        } while (!secp256k1.privateKeyVerify(privKey))
    
        return {
            pub: bs58.encode(pubKey),        
            priv: bs58.encode(privKey)
        }
    },
    getGenesisBlock: () => {
        return new Block(
            0,
            '0',
            0,
            [],
            config.masterName,
            null,
            '0000000000000000000000000000000000000000000000000000000000000000',
            config.originHash
        )
    },
    prepareBlock: () => {
        let previousBlock = chain.getLatestBlock()
        let nextIndex = previousBlock._id + 1
        let nextTimestamp = new Date().getTime()
        // grab all transactions and sort by ts
        let txs = []
        let mempool = transaction.pool.sort(function(a,b){return a.ts-b.ts})
        loopOne:
        for (let i = 0; i < mempool.length; i++) {
            if (txs.length === config.maxTxPerBlock)
                break
            for (let y = 0; y < txs.length; y++)
                if (txs[y].sender === mempool[i].sender)
                    continue loopOne
            txs.push(mempool[i])
        }

        loopTwo:
        for (let i = 0; i < mempool.length; i++) {
            if (txs.length === config.maxTxPerBlock)
                break
            for (let y = 0; y < txs.length; y++)
                if (txs[y].hash === mempool[i].hash)
                    continue loopTwo
            txs.push(mempool[i])
        }
        txs = txs.sort(function(a,b){return a.ts-b.ts})
        transaction.removeFromPool(txs)
        let miner = process.env.NODE_OWNER
        return new Block(nextIndex, previousBlock.hash, nextTimestamp, txs, miner)
    },
    hashAndSignBlock: (block) => {
        let nextHash = chain.calculateHashForBlock(block)
        let signature = secp256k1.ecdsaSign(Buffer.from(nextHash, 'hex'), bs58.decode(process.env.NODE_OWNER_PRIV))
        signature = bs58.encode(signature.signature)
        return new Block(block._id, block.phash, block.timestamp, block.txs, block.miner, block.missedBy, signature, nextHash)
        
    },
    canMineBlock: (cb) => {
        if (chain.shuttingDown) {
            cb(true, null); return
        }
        let newBlock = chain.prepareBlock()
        // run the transactions and validation
        // pre-validate our own block (not the hash and signature as we dont have them yet)
        // nor transactions because we will filter them on execution later
        chain.isValidNewBlock(newBlock, false, false, function(isValid) {
            if (!isValid) {
                cb(true, newBlock); return
            }
            cb(null, newBlock)
        })
    },
    mineBlock: (cb) => {
        if (chain.shuttingDown) return
        chain.canMineBlock(function(err, newBlock) {
            if (err) {
                cb(true, newBlock); return
            }

            // at this point transactions in the pool seem all validated
            // BUT with a different ts and without checking for double spend
            // so we will execute transactions in order and revalidate after each execution
            chain.executeBlockTransactions(newBlock, true, function(validTxs) {
                cache.rollback()
                // and only add the valid txs to the new block
                newBlock.txs = validTxs

                // always record the failure of others
                if (chain.schedule.shuffle[(newBlock._id-1)%config.witnesses].name !== process.env.NODE_OWNER)
                    newBlock.missedBy = chain.schedule.shuffle[(newBlock._id-1)%config.witnesses].name

                // hash and sign the block with our private key
                newBlock = chain.hashAndSignBlock(newBlock)
                
                // push the new block to consensus possible blocks
                // and go straight to end of round 0 to skip re-validating the block
                let possBlock = {
                    block: newBlock
                }
                for (let r = 0; r < config.consensusRounds; r++)
                    possBlock[r] = []

                logr.debug('Mined a new block, proposing to consensus')

                possBlock[0].push(process.env.NODE_OWNER)
                consensus.possBlocks.push(possBlock)
                consensus.endRound(0, newBlock)
                cb(null, newBlock)
            })
        })
    },
    validateAndAddBlock: (newBlock, revalidate, cb) => {
        // when we receive an outside block and check whether we should add it to our chain or not
        if (chain.shuttingDown) return
        chain.isValidNewBlock(newBlock, revalidate, false, function(isValid) {
            if (!isValid) {
                return cb(true, newBlock)
            }
            // straight execution
            chain.executeBlockTransactions(newBlock, revalidate, function(validTxs) {
                // if any transaction is wrong, thats a fatal error
                if (newBlock.txs.length !== validTxs.length) {
                    logr.error('Invalid tx(s) in block')
                    cb(true, newBlock); return
                }

                // add txs to recents
                chain.addRecentTxsInBlock(newBlock.txs)

                // remove all transactions from this block from our transaction pool
                transaction.removeFromPool(newBlock.txs)

                chain.addBlock(newBlock, function() {
                    // and broadcast to peers (if not replaying)
                    if (!p2p.recovering)
                        p2p.broadcastBlock(newBlock)

                    // process notifications and witness stats (non blocking)
                    notifications.processBlock(newBlock)

                    // emit event to confirm new transactions in the http api
                    if (!p2p.recovering)
                        for (let i = 0; i < newBlock.txs.length; i++)
                            transaction.eventConfirmation.emit(newBlock.txs[i].hash)

                    cb(null, newBlock)
                })
            })
        })
    },
    addRecentTxsInBlock: (txs = []) => {
        for (let t in txs)
            chain.recentTxs[txs[t].hash] = txs[t]
    },
    minerWorker: (block) => {
        if (p2p.recovering) return
        clearTimeout(chain.worker)

        if (chain.schedule.shuffle.length === 0) {
            logr.fatal('All witnesses gave up their stake? Chain is over')
            process.exit(1)
        }

        let mineInMs = null
        // if we are the next scheduled witness, try to mine in time
        if (chain.schedule.shuffle[(block._id)%config.witnesses].name === process.env.NODE_OWNER)
            mineInMs = config.blockTime
        // else if the scheduled witnesses miss blocks
        // backups witnesses are available after each block time intervals
        else for (let i = 1; i < 2*config.witnesses; i++)
            if (chain.recentBlocks[chain.recentBlocks.length - i]
            && chain.recentBlocks[chain.recentBlocks.length - i].miner === process.env.NODE_OWNER) {
                mineInMs = (i+1)*config.blockTime
                break
            }

        if (mineInMs) {
            mineInMs -= (new Date().getTime()-block.timestamp)
            mineInMs += 20
            logr.debug('Trying to mine in '+mineInMs+'ms')
            consensus.observer = false
            if (mineInMs < config.blockTime/2) {
                logr.warn('Slow performance detected, will not try to mine next block')
                return
            }
            chain.worker = setTimeout(function(){
                chain.mineBlock(function(error, finalBlock) {
                    if (error)
                        logr.warn('miner worker trying to mine but couldnt', finalBlock)
                })
            }, mineInMs)
        }
            
    },
    addBlock: async (block, cb) => {
        // add the block in our own db
        if (blocks.isOpen)
            blocks.appendBlock(block)
        else
            await db.collection('blocks').insertOne(block)

        // push cached accounts and contents to mongodb
        chain.cleanMemory()

        // update the config if an update was scheduled
        config = require('./config.js').read(block._id)
        witnessStats.processBlock(block)
        txHistory.processBlock(block)

        // if block id is mult of n witnesses, reschedule next n blocks
        if (block._id % config.witnesses === 0)
            chain.schedule = chain.minerSchedule(block)
        chain.recentBlocks.push(block)
        chain.minerWorker(block)
        chain.output(block)
        cache.writeToDisk(false)
        cb(true)
    },
    output: (block,rebuilding) => {
        chain.nextOutputTxs += block.txs.length
        if (block._id%replay_output === 0 || (!rebuilding && !p2p.recovering)) {
            let currentOutTime = new Date().getTime()
            let output = ''
            if (rebuilding)
                output += 'Rebuilt '

            output += '#'+block._id

            if (rebuilding)
                output += '/' + chain.restoredBlocks
            else
                output += '  by '+block.miner

            output += '  '+chain.nextOutputTxs+' tx'
            if (chain.nextOutputTxs>1)
                output += 's'
            output += '  delay: '+ (currentOutTime - block.timestamp)

            if (block.missedBy && !rebuilding)
                output += '  MISS: '+block.missedBy
            else if (rebuilding) {
                output += '  Performance: ' + Math.floor(replay_output/(currentOutTime-chain.lastRebuildOutput)*1000) + 'b/s'
                chain.lastRebuildOutput = currentOutTime
            }

            logr.info(output)
            chain.nextOutputTxs = 0
        }
    },
    nextOutputTxs: 0,
    lastRebuildOutput: 0,
    isValidPubKey: (key) => {
        try {
            return secp256k1.publicKeyVerify(bs58.decode(key))
        } catch (error) {
            return false
        }
    },
    isValidSignature: (user, txType, hash, sign, cb) => {
        // verify signature and bandwidth
        // burn account can never transact
        if (user === config.burnAccount)
            return cb(false)
        cache.findOne('accounts', {name: user}, function(err, account) {
            if (err) throw err
            if (!account) {
                cb(false); return
            } else if (chain.restoredBlocks && chain.getLatestBlock()._id < chain.restoredBlocks && process.env.REBUILD_NO_VERIFY === '1') 
                // no verify rebuild mode, only use if you know what you are doing
                return cb(account)
            
            // main key can authorize all transactions
            let allowedPubKeys = [[account.pub, account.pub_weight || 1]]
            let threshold = 1
            // add all secondary keys having this transaction type as allowed keys
            if (account.keys && typeof txType === 'number' && Number.isInteger(txType))
                for (let i = 0; i < account.keys.length; i++) 
                    if (account.keys[i].types.indexOf(txType) > -1)
                        allowedPubKeys.push([account.keys[i].pub, account.keys[i].weight || 1])

            // if there is no transaction type
            // it means we are verifying a block signature
            // so only the witness key is allowed
            if (txType === null)
                if (account.pub_witness)
                    allowedPubKeys = [[account.pub_witness, 1]]
                else
                    allowedPubKeys = []
            else 
            // compute required signature threshold
            if (account.thresholds && account.thresholds[txType])
                threshold = account.thresholds[txType]
            else if (account.thresholds && account.thresholds.default)
                threshold = account.thresholds.default
            
            // multisig transactions
            if (config.multisig && Array.isArray(sign))
                return chain.isValidMultisig(account,threshold,allowedPubKeys,hash,sign,cb)

            // single signature
            for (let i = 0; i < allowedPubKeys.length; i++) {
                let bufferHash = Buffer.from(hash, 'hex')
                let b58sign = bs58.decode(sign)
                let b58pub = bs58.decode(allowedPubKeys[i][0])
                if (secp256k1.ecdsaVerify(b58sign, bufferHash, b58pub) && allowedPubKeys[i][1] >= threshold) {
                    cb(account)
                    return
                }
            }
            cb(false)
        })
    },
    isValidMultisig: (account,threshold,allowedPubKeys,hash,signatures,cb) => {
        let validWeights = 0
        let validSigs = []
        let hashBuf = Buffer.from(hash, 'hex')
        for (let s = 0; s < signatures.length; s++) {
            let signBuf = bs58.decode(signatures[s][0])
            let recoveredPub = bs58.encode(secp256k1.ecdsaRecover(signBuf,signatures[s][1],hashBuf))
            if (validSigs.includes(recoveredPub))
                return cb(false, 'duplicate signatures found')
            for (let p = 0; p < allowedPubKeys.length; p++)
                if (allowedPubKeys[p][0] === recoveredPub) {
                    validWeights += allowedPubKeys[p][1]
                    validSigs.push(recoveredPub)
                }
        }
        if (validWeights >= threshold)
            cb(account)
        else
            cb(false, 'insufficient signature weight ' + validWeights + ' to reach threshold of ' + threshold)
    },
    isValidHashAndSignature: (newBlock, cb) => {
        // and that the hash is correct
        let theoreticalHash = chain.calculateHashForBlock(newBlock,true)
        if (theoreticalHash !== newBlock.hash) {
            logr.debug(typeof (newBlock.hash) + ' ' + typeof theoreticalHash)
            logr.error('invalid hash: ' + theoreticalHash + ' ' + newBlock.hash)
            cb(false); return
        }

        // finally, verify the signature of the miner
        chain.isValidSignature(newBlock.miner, null, newBlock.hash, newBlock.signature, function(legitUser) {
            if (!legitUser) {
                logr.error('invalid miner signature')
                cb(false); return
            }
            cb(true)
        })
    },
    isValidBlockTxs: (newBlock, cb) => {
        chain.executeBlockTransactions(newBlock, true, function(validTxs) {
            cache.rollback()
            if (validTxs.length !== newBlock.txs.length) {
                logr.error('invalid block transaction')
                cb(false); return
            }
            cb(true)
        })
    },
    isValidNewBlock: (newBlock, verifyHashAndSignature, verifyTxValidity, cb) => {
        if (!newBlock) return
        // verify all block fields one by one
        if (!newBlock._id || typeof newBlock._id !== 'number') {
            logr.error('invalid block _id')
            cb(false); return
        }
        if (!newBlock.phash || typeof newBlock.phash !== 'string') {
            logr.error('invalid block phash')
            cb(false); return
        }
        if (!newBlock.timestamp || typeof newBlock.timestamp !== 'number') {
            logr.error('invalid block timestamp')
            cb(false); return
        }
        if (!newBlock.txs || typeof newBlock.txs !== 'object' || !Array.isArray(newBlock.txs)) {
            logr.error('invalid block txs')
            cb(false); return
        }
        if (newBlock.txs.length > config.maxTxPerBlock) {
            logr.error('invalid block too many txs')
            cb(false); return
        }
        if (!newBlock.miner || typeof newBlock.miner !== 'string') {
            logr.error('invalid block miner')
            cb(false); return
        }
        if (verifyHashAndSignature && (!newBlock.hash || typeof newBlock.hash !== 'string')) {
            logr.error('invalid block hash')
            cb(false); return
        }
        if (verifyHashAndSignature && (!newBlock.signature || typeof newBlock.signature !== 'string')) {
            logr.error('invalid block signature')
            cb(false); return
        }
        if (newBlock.missedBy && typeof newBlock.missedBy !== 'string') 
            logr.error('invalid block missedBy')
           

        // verify that its indeed the next block
        let previousBlock = chain.getLatestBlock()
        if (previousBlock._id + 1 !== newBlock._id) {
            logr.error('invalid index')
            cb(false); return
        }
        // from the same chain
        if (previousBlock.hash !== newBlock.phash) {
            logr.error('invalid phash')
            cb(false); return
        }

        // check if miner isnt trying to fast forward time
        // this might need to be tuned in the future to allow for network delay / clocks desync / etc
        if (newBlock.timestamp > new Date().getTime() + config.maxDrift) {
            logr.error('timestamp from the future', newBlock.timestamp, new Date().getTime())
            cb(false); return
        }

        // check if miner is normal scheduled one
        let minerPriority = 0
        if (chain.schedule.shuffle[(newBlock._id-1)%config.witnesses].name === newBlock.miner) 
            minerPriority = 1
        // allow miners of n blocks away
        // to mine after (n+1)*blockTime as 'backups'
        // so that the network can keep going even if 1,2,3...n node(s) have issues
        else
            for (let i = 1; i <= config.witnesses; i++) {
                if (!chain.recentBlocks[chain.recentBlocks.length - i])
                    break
                if (chain.recentBlocks[chain.recentBlocks.length - i].miner === newBlock.miner) {
                    minerPriority = i+1
                    break
                }
            }
                

        if (minerPriority === 0) {
            logr.error('unauthorized miner')
            cb(false); return
        }

        // check if new block isnt too early
        if (newBlock.timestamp - previousBlock.timestamp < minerPriority*config.blockTime) {
            logr.error('block too early for miner with priority #'+minerPriority)
            cb(false); return
        }

        if (!verifyTxValidity) {
            if (!verifyHashAndSignature) {
                cb(true); return
            }
            chain.isValidHashAndSignature(newBlock, function(isValid) {
                if (!isValid) {
                    cb(false); return
                }
                cb(true)
            })
        } else
            chain.isValidBlockTxs(newBlock, function(isValid) {
                if (!isValid) {
                    cb(false); return
                }
                if (!verifyHashAndSignature) {
                    cb(true); return
                }
                chain.isValidHashAndSignature(newBlock, function(isValid) {
                    if (!isValid) {
                        cb(false); return
                    }
                    cb(true)
                })
            })
    },
    isValidNewBlockPromise: (newBlock, verifyHashAndSig, verifyTxValidity) => new Promise((rs) => chain.isValidNewBlock(newBlock, verifyHashAndSig, verifyTxValidity, rs)),
    executeBlockTransactions: (block, revalidate, cb) => {
        // revalidating transactions in orders if revalidate = true
        // adding transaction to recent transactions (to prevent tx re-use) if isFinal = true
        let executions = []
        let voteCount = 0 // for witness reward calculation
        let executedSuccessfully = []
        for (let i = 0; i < block.txs.length; i++) 
            executions.push(function(callback) {
                let tx = block.txs[i]
                if (revalidate)
                    transaction.isValid(tx, block.timestamp, function(isValid, error) {
                        if (isValid) 
                            transaction.execute(tx, block.timestamp, function(executed) {
                                if (!executed) {
                                    logr.fatal('Tx execution failure', tx)
                                    process.exit(1)
                                }
                                if (tx.type === txtypes.VOTE)
                                    voteCount++
                                if (executed)
                                    executedSuccessfully.push(tx)
                                callback(null, true)
                            })
                        else {
                            logr.debug(error, tx)
                            callback(null, false)
                        }
                    })
                else
                    transaction.execute(tx, block.timestamp, function(executed) {
                        if (!executed)
                            logr.fatal('Tx execution failure', tx)
                        if (tx.type === txtypes.VOTE)
                            voteCount++
                        if (executed)
                            executedSuccessfully.push(tx)
                        callback(null, true)
                    })
                i++
            })
        
        let blockTimeBefore = new Date().getTime()
        series(executions, function(err) {
            let string = 'executed'
            if(revalidate) string = 'validated & '+string
            logr.debug('Block '+string+' in '+(new Date().getTime()-blockTimeBefore)+'ms')
            if (err) throw err

            // process curations and witness rewards
            eco.curationv2(block.timestamp,() => chain.witnessRewards(block.miner, block.timestamp, voteCount, () => cb(executedSuccessfully)))
        })
    },
    minerSchedule: (block) => {
        let hash = block.hash
        let rand = parseInt('0x'+hash.substr(hash.length-config.witnessShufflePrecision))
        if (!p2p.recovering)
            logr.debug('Generating schedule... NRNG: ' + rand)
        let miners = chain.generateWitnesses(true, config.witnesses, 0)
        miners = miners.sort(function(a,b) {
            if(a.name < b.name) return -1
            if(a.name > b.name) return 1
            return 0
        })
        let shuffledMiners = []
        while (miners.length > 0) {
            let i = rand%miners.length
            shuffledMiners.push(miners[i])
            miners.splice(i, 1)
        }
        
        let y = 0
        while (shuffledMiners.length < config.witnesses) {
            shuffledMiners.push(shuffledMiners[y])
            y++
        }

        return {
            block: block,
            shuffle: shuffledMiners
        }
    },
    generateWitnesses: (withWitnessPub, limit, start) => {
        let witnesses = []
        let witnessAccs = withWitnessPub ? cache.witnesses : cache.accounts
        for (const key in witnessAccs) {
            if (!cache.accounts[key].node_appr || cache.accounts[key].node_appr <= 0)
                continue
            if (withWitnessPub && !cache.accounts[key].pub_witness)
                continue
            let newWitness = cloneDeep(cache.accounts[key])
            witnesses.push({
                name: newWitness.name,
                pub: newWitness.pub,
                pub_witness: newWitness.pub_witness,
                balance: newWitness.balance,
                approves: newWitness.approves,
                node_appr: newWitness.node_appr,
                json: newWitness.json,
            })
        }
        witnesses = witnesses.sort(function(a,b) {
            return b.node_appr - a.node_appr
        })
        return witnesses.slice(start, limit)
    },
    witnessRewards: (name, ts, voteCount, cb) => {
        // rewards witnesses who produced in the last config.witnessRewardBlocks with config.witnessReward Token/producer
        if (voteCount <= 0)
            return cb(0)
        let reward = config.witnessReward
        let witnessRewardOp = []
        let witnessRewardReceipients = {}
        let firstIndex = Math.max(0,chain.recentBlocks.length - config.witnessRewardBlocks + 1) // last n producers + current producer
        if (config.ecoVersion === 1)
            reward *= voteCount
        for (let i = firstIndex; i < chain.recentBlocks.length; i++) 
            if (!witnessRewardReceipients[chain.recentBlocks[i].miner])
                witnessRewardReceipients[chain.recentBlocks[i].miner] = reward
            else
                witnessRewardReceipients[chain.recentBlocks[i].miner] += reward
        if (!witnessRewardReceipients[name])
            witnessRewardReceipients[name] = reward
        else
            witnessRewardReceipients[name] += reward
        for (let r in witnessRewardReceipients) {
            logr.debug('witness reward of ' + witnessRewardReceipients[r] + ' to ' + r)
            witnessRewardOp.push(chain.witnessRewardOp(r,ts,witnessRewardReceipients[r]))
        }
        parallel(witnessRewardOp,() => cb())
    },
    witnessRewardOp: (miner,ts,amount) => {
        return ((callback) => {
            cache.findOne('accounts', {name: miner}, (err, account) => {
                let newBalance = account.balance + amount
                let newVt = new GrowInt(account.vp, {growth:account.balance/(config.vpGrowth)}).grow(ts)
                if (!newVt)
                    logr.debug('error growing grow int', account, ts)
                
                cache.updateOne('accounts',
                    {name: miner},
                    {$set: { vp: newVt, balance: newBalance}},
                    function(err) {
                        if (err) throw err
                        transaction.updateGrowInts(account, ts, function() {
                            transaction.adjustNodeAppr(account, amount, function() {
                                callback()
                            })
                        })
                    })
            })
        })
    },
    calculateHashForBlock: (block,deleteExisting) => {
        if (config.blockHashSerialization === 1)
            return chain.calculateHashV1(block._id, block.phash, block.timestamp, block.txs, block.miner, block.missedBy)
        else if (config.blockHashSerialization === 2) {
            let clonedBlock
            if (deleteExisting) {
                clonedBlock = cloneDeep(block)
                delete clonedBlock.hash
                delete clonedBlock.signature
            }
            return CryptoJS.SHA256(JSON.stringify(deleteExisting ? clonedBlock : block)).toString()
        }
    },
    calculateHashV1: (index, phash, timestamp, txs, miner, missedBy) => {
        let string = index + phash + timestamp + txs + miner
        if (missedBy) string += missedBy

        return CryptoJS.SHA256(string).toString()
    },    
    getLatestBlock: () => {
        return chain.recentBlocks[chain.recentBlocks.length-1]
    },    
    getFirstMemoryBlock: () => {
        return chain.recentBlocks[0]
    },
    cleanMemory: () => {
        chain.cleanMemoryBlocks()
        chain.cleanMemoryTx()
    },
    cleanMemoryBlocks: () => {
        if (config.ecoBlocksIncreasesSoon) {
            logr.trace('Keeping old blocks in memory because ecoBlocks is changing soon')
            return
        }
            
        let extraBlocks = chain.recentBlocks.length - config.ecoBlocks
        while (extraBlocks > 0) {
            chain.recentBlocks.splice(0,1)
            extraBlocks--
        }
    },
    cleanMemoryTx: () => {
        for (const hash in chain.recentTxs)
            if (chain.recentTxs[hash].ts + config.txExpirationTime < chain.getLatestBlock().timestamp)
                delete chain.recentTxs[hash]
    },
    batchLoadBlocks: (blockNum,cb) => {
        if (chain.blocksToRebuild.length === 0)
            if (blocks.isOpen) {
                chain.blocksToRebuild = blocks.readRange(blockNum, blockNum+max_batch_blocks-1)
                cb(chain.blocksToRebuild.shift())
            } else
                db.collection('blocks').find({_id: { $gte: blockNum, $lt: blockNum+max_batch_blocks }}).toArray((e,loadedBlocks) => {
                    if (e) throw e
                    if (loadedBlocks) chain.blocksToRebuild = loadedBlocks
                    cb(chain.blocksToRebuild.shift())
                })
        else cb(chain.blocksToRebuild.shift())
    },
    rebuildState: (blockNum,cb) => {
        // If chain shutting down, stop rebuilding and output last number for resuming
        if (chain.shuttingDown)
            return cb(null,blockNum)
            
        // Genesis block is handled differently
        if (blockNum === 0) {
            chain.recentBlocks = [chain.getGenesisBlock()]
            chain.schedule = chain.minerSchedule(chain.getGenesisBlock())
            chain.rebuildState(blockNum+1,cb)
            return
        }

        chain.batchLoadBlocks(blockNum, async (blockToRebuild) => {
            if (!blockToRebuild)
                // Rebuild is complete
                return cb(null,blockNum)
            
            // Validate block and transactions, then execute them
            if (process.env.REBUILD_NO_VALIDATE !== '1') {
                let isValidBlock = await chain.isValidNewBlockPromise(blockToRebuild,true,false)
                if (!isValidBlock)
                    return cb(true, blockNum)
            }
            chain.executeBlockTransactions(blockToRebuild,process.env.REBUILD_NO_VALIDATE !== '1',(validTxs) => {
                // if any transaction is wrong, thats a fatal error
                // transactions should have been verified in isValidNewBlock
                if (blockToRebuild.txs.length !== validTxs.length) {
                    logr.fatal('Invalid tx(s) in block found after starting execution')
                    return cb('Invalid tx(s) in block found after starting execution', blockNum)
                }
                
                // update the config if an update was scheduled
                chain.addRecentTxsInBlock(blockToRebuild.txs)
                config = require('./config.js').read(blockToRebuild._id)
                chain.cleanMemory()
                witnessStats.processBlock(blockToRebuild)
                txHistory.processBlock(blockToRebuild)

                let writeInterval = parseInt(process.env.REBUILD_WRITE_INTERVAL)
                if (isNaN(writeInterval) || writeInterval < 1)
                    writeInterval = 10000

                cache.processRebuildOps(() => {
                    if (blockToRebuild._id % config.witnesses === 0)
                        chain.schedule = chain.minerSchedule(blockToRebuild)
                    chain.recentBlocks.push(blockToRebuild)
                    chain.output(blockToRebuild, true)
                    
                    // process notifications and witness stats (non blocking)
                    notifications.processBlock(blockToRebuild)

                    // next block
                    chain.rebuildState(blockNum+1, cb)
                }, blockToRebuild._id % writeInterval === 0)
            })
        })
    }
}

module.exports = chain
