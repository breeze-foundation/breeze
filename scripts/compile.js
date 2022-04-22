const spawn = require('child_process').spawn

let nodeVersion = 10
let outPath = 'bin'

let platform = process.platform
if (platform === 'win32')
    platform = 'win'
if (platform === 'darwin')
    platform = 'macos'

let arch = process.arch
if (arch === 'x32')
    arch = 'x86'

let target = 'node'+nodeVersion+'-'+platform+'-'+arch
console.log('Compiling breeze for '+target)
let cmd = 'src/cli.js --output '+outPath+'/breeze --targets '+target

const compile_cli = spawn('pkg', cmd.split(' '))
compile_cli.stdout.on('data', function (data) {
    console.log(data.toString())
})

compile_cli.stderr.on('data', function (data) {
    console.log(data.toString())
})

compile_cli.on('exit', function (code) {
    console.log('Finished compiling breeze')
    console.log('Compiling avalond for '+target)

    cmd = 'src/main.js --options stack-size=65500 --output '+outPath+'/avalond --targets '+target
    const compile_daemon = spawn('pkg', cmd.split(' '))
    compile_daemon.stdout.on('data', function (data) {
        console.log(data.toString())
    })
    
    compile_daemon.stderr.on('data', function (data) {
        console.log(data.toString())
    })
    
    compile_daemon.on('exit', function (code) {
        console.log('Finished compiling avalond')
    })
})

