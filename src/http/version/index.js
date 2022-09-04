module.exports = {
    init: (app) => {
        // get version
        app.get('/version', (req, res) => {
            res.send({version: p2p.getVersion()})
        })
    }
}