var config = {
    history: {
        0: {
            // this is the block 0 configuration for mainnet
            accountPriceBase: 200000000,
            accountPriceCharMult: 4,
            accountPriceChars: 5,
            accountPriceMin: 2000000,
            accountMaxLength: 50,
            accountMinLength: 1,
            accountMinLengthFeelessMaster: 7,
            // allowed username chars
            allowedUsernameChars: 'abcdefghijklmnopqrstuvwxyz0123456789',
            allowedUsernameCharsOnlyMiddle: '-.',
            // should we allow people to vote multiple times on the same content ?
            allowRevotes: false,
            // the base58 encoding alphabet
            b58Alphabet: '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz',
            // the block #0 genesis timestamp
            block0ts: 1621522223702,
            // the block time in ms
            blockTime: 3000,
            // bridge account username
            bridgeAccount: 'bridge',
            // burn account username
            burnAccount: 'null',
            // the number of ms needed for 0.000001 Token to generate 1 byte of bw
            bwGrowth: 36000000000, // +100 bytes per hour per Token (3600s * 1000ms * 1000000 / 100b)
            // the maximum bandwidth an account can have available
            bwMax: 64000,
            // rules for category names
            categoryMinLength: 1,
            categoryMaxLength: 30,
            categoryMaxFollows: 1000,
            // the number of rounds of consensus before block is valid (min 2)
            consensusRounds: 2,
            // the number of blocks from the past taken into consideration for econonomics
            ecoBlocks: 9600, // 8 hours
            // the required number of ms before a vote reward can be claimed
            ecoClaimTime: 604800000, // 7 days
            // author reward per vote (0.1 Token/vote)
            ecoAuthorReward: 100000,
            // curation reward per vote (0.05 Token/vote)
            ecoCurationReward: 50000,
            // period to be taken into consideration for calculation of VP required for next vote
            ecoCurationCycle: 86400000, // 24 hours
            // base vp (fist vote in 24 hours)
            ecoCurationVtBase: 50,
            // incremental vp multiplier for following votes within a 24 hour window
            ecoCurationVtMult: 1.33,
            // economy revision
            ecoVersion: 1,
            // the maximum number of follows a single account can do
            followsMax: 2000,
            // the max size of a stringified json input (content / user profile)
            // best if kept slightly lower than bwMax
            jsonMaxBytes: 60000,
            // the max length of a key identifier
            keyIdMaxLength: 25,
            // the max length of post link
            linkMaxLength: 500,
            // how many max witnesses there can be, and how much tokens and VP they earn per "mined" block
            witnessReward: 10000,
            witnessRewardBlocks: 11,
            witnesses: 5,
            // how long of the end of the block hash is used for the witness pseudo random generator shuffle
            witnessShufflePrecision: 6,
            // the maximum number of witnesses an account can vote for
            witnessMaxVotes: 5,
            // the "master" account starting stake (total starting supply)
            // not applied if starting from a genesis.zip file
            masterBalance: 21000000000000,
            // the init account username
            masterName: 'breeze',
            // if false master can create accounts with usernames without burning tokens
            masterPaysForUsernames: false,
            // the master account public original key (irrelevant if using genesis)
            masterPub: '25ZroSRojDVJxsVDs4nU9E6zZkXttYp73ykRF6ymtvyG8',
            // the master account public witness key  (irrelevant if using genesis)
            masterPubWitness: '25ZroSRojDVJxsVDs4nU9E6zZkXttYp73ykRF6ymtvyG8',
            // maximum content age that can be voted on
            maxContentAge: 86400000,
            // the maximum time drift in ms before a block is invalid
            maxDrift: 200,
            // the maximum number of transactions in a single block
            maxTxPerBlock: 200,
            // the max length of a transfer memo
            memoMaxLength: 250,
            // the minimum burn amount for PROMOTE operation
            minPromoteBurnAmount: 100000,
            // multisig operations
            multisig: true,
            // defines how long it takes for a notification to get deleted, and how often the purge happens
            // e.g.: purge notifications older than 56*3600 blocks every 3600 blocks
            notifPurge: 3600,
            notifPurgeAfter: 56,
            // the maximum number of mentions triggering a notification
            notifMaxMentions: 10,
            // the sha256sum hash of block 0 (new origin hash -> new chain)
            originHash: 'b7ee9e7A2ccdea3b204f0c6084e9b92db64B5eaf7a8d10d59447bdc9738a6d0c',
            // the default number of random bytes to use for new key generation
            randomBytesLength: 32,
            // the time after which transactions expire and wont be accepted by nodes anymore
            txExpirationTime: 60000,
            // limit which transactions are available
            // key: transaction id (see transaction.js:TransactionType)
            // value: null/0 (default): enabled, 1: disabled, 2: master-only
            txLimits: {
                14: 2,
                15: 2
            },
            vaults: {
                airdrop: {
                    // airdrop rewards for authors with no ref defined
                    name: 'breeze-airdrop',
                    reward: 50000 // 0.05 Token
                },
                lpMining: {
                    // LP mining rewards
                    name: 'breeze-lpminer',
                    reward: 300000 // 0.3 Token
                },
                staking: {
                    // staking rewards
                    name: 'breeze-staker',
                    reward: 250000 // 0.25 Token
                },
                daf: {
                    // development appraisal fund
                    name: 'breeze-daf',
                    reward: 30000 // 0.03 Token
                },
                dao: {
                    // dao fund
                    name: 'breeze-dao',
                    reward: 100000 // 0.1 Token
                },
                charity: {
                    // charity share
                    name: 'breeze-charity',
                    reward: 10000 // 0.01 Token
                }
            },
            // the number of ms needed for 0.000001 Token to generate 1 VP
            vpGrowth: 120000000000, // +1 VP per 2 minutes per Token (60 * 1000 * 1000000 * 2min)
            // hard cap on maximum VP an account can have
            vpMax: 16000
        },
        1000000: {
            // fixed emissions at 0.3 Token/block
            accountMinLengthFeelessMaster: 1,
            ecoVersion: 2,
            ecoAuthorReward: 36000,
            ecoCurationReward: 24000,
            vaults: {
                airdrop: {
                    // airdrop rewards for authors with no ref defined
                    name: 'breeze-airdrop',
                    reward: 6000 // 0.006 Token
                },
                lpMining: {
                    // LP mining rewards
                    name: 'breeze-lpminer',
                    reward: 90000 // 0.09 Token
                },
                staking: {
                    // staking rewards
                    name: 'breeze-staker',
                    reward: 60000 // 0.06 Token
                },
                daf: {
                    // development appraisal fund
                    name: 'breeze-daf',
                    reward: 6000 // 0.006 Token
                },
                dao: {
                    // dao fund
                    name: 'breeze-dao',
                    reward: 30000 // 0.03 Token
                },
                charity: {
                    // charity share
                    name: 'breeze-charity',
                    reward: 3000 // 0.003 Token
                }
            },
            witnessReward: 3000,
            witnessRewardBlocks: 15, // 0.045 Token over last 15 witnesses, 0.003 each
        }
    },
    read: (blockNum) => {
        var finalConfig = {}
        for (const key in config.history) 
            if (blockNum >= key) {
                if (blockNum === parseInt(key) && blockNum !== 0)
                    logr.info('Hard Fork #'+key)
                Object.assign(finalConfig, config.history[key])
            }
            else {
                if (config.history[key].ecoBlocks > finalConfig.ecoBlocks
                && config.history[key].ecoBlocks - finalConfig.ecoBlocks >= key-blockNum)
                    finalConfig.ecoBlocksIncreasesSoon = config.history[key].ecoBlocks
                
                break
            }
            
        
        return finalConfig
    }
} 

module.exports = config
