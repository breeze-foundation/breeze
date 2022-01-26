const { performance } = require('perf_hooks')
const WARN_SLOW_VALID = process.env.WARN_SLOW_VALID || 5
const WARN_SLOW_EXEC = process.env.WARN_SLOW_EXEC || 5

var transactions = [
    require('./newAccount.js'),
    require('./approveNode.js'),
    require('./disaproveNode.js'),
    require('./transfer.js'),
    require('./comment.js'),
    require('./vote.js'),
    require('./userJson.js'),
    require('./follow.js'),
    require('./unfollow.js'),
    null,
    require('./newKey.js'),
    require('./removeKey.js'),
    require('./changePassword.js'),
    require('./promote.js'),
    require('./transferVt.js'),
    require('./transferBw.js'),
    require('./limitVt.js'),
    null, // claim reward op, not used in breeze due to instant payout
    require('./enableNode.js'),
    require('./unsetSignThreshold.js'),
    require('./newWeightedKey.js'),
    require('./setSignThreshold.js'),
    require('./setPasswordWeight.js'),
    require('./bridgeDeposit.js'),
    require('./bridgeUpdateTx.js'),
    require('./bridgeWithdraw.js'),
    require('./categoryFollow.js'),
    require('./categoryUnfollow.js'),
    require('./setLastRead.js')
]

module.exports = {
    Types: {
        NEW_ACCOUNT: 0,
        APPROVE_NODE_OWNER: 1,
        DISAPROVE_NODE_OWNER: 2,
        TRANSFER: 3,
        COMMENT: 4,
        VOTE: 5,
        USER_JSON: 6,
        FOLLOW: 7,
        UNFOLLOW: 8,
        // RESHARE: 9, // not sure
        NEW_KEY: 10,
        REMOVE_KEY: 11,
        CHANGE_PASSWORD: 12,
        PROMOTE: 13,
        TRANSFER_VP: 14,
        TRANSFER_BW: 15,
        LIMIT_VP: 16,
        // CLAIM_REWARD: 17,
        ENABLE_NODE: 18,
        UNSET_SIG_THRESHOLD: 19,
        NEW_WEIGHTED_KEY: 20,
        SET_SIG_THRESHOLD: 21,
        SET_PASSWORD_WEIGHT: 22,
        BRIDGE_DEPOSIT: 23,
        BRIDGE_UPDATE_TX: 24,
        BRIDGE_WITHDRAW: 25,
        CATEGORY_FOLLOW: 26,
        CATEGORY_UNFOLLOW: 27,
        SET_LAST_READ: 28
    },
    validate: (tx, ts, legitUser, cb) => {
        // logr.debug('tx:'+tx.type+' validation begins')
        var startTime = performance.now()
        // will make sure the transaction type exists (redondant ?)
        if (!transactions[tx.type]) {
            logr.error('No transaction type ?!')
            cb(false, 'forbidden transaction type'); return
        }

        // enforce there's no unknown field included in the transaction
        for (let i = 0; i < Object.keys(tx.data).length; i++)
            if (transactions[tx.type].fields.indexOf(Object.keys(tx.data)[i]) === -1) {
                cb(false, 'unknown tx.data.'+Object.keys(tx.data)[i])
                return
            }

        transactions[tx.type].validate(tx, ts, legitUser, function(isValid, error) {
            var timeDiff = performance.now()-startTime
            if (timeDiff > WARN_SLOW_VALID)
                logr.warn('Slow tx type:'+tx.type+' validation took: '+timeDiff.toFixed(3)+'ms')
            else
                logr.perf('tx:'+tx.type+' validation finish: '+timeDiff.toFixed(3)+'ms')

            cb(isValid, error)
        })
    },
    execute: (tx, ts, cb) => {
        // logr.debug('tx:'+tx.type+' execution begins')
        var startTime = performance.now()
        if (!transactions[tx.type]) {
            cb(false); return
        }
        transactions[tx.type].execute(tx, ts, function(isValid) {
            var timeDiff = performance.now()-startTime
            
            if (timeDiff > WARN_SLOW_EXEC)
                logr.warn('Slow tx type:'+tx.type+' execution took: '+timeDiff.toFixed(3)+'ms')
            else
                logr.perf('tx:'+tx.type+' execution finish: '+timeDiff.toFixed(3)+'ms')

            cb(isValid)
        })
    }
}