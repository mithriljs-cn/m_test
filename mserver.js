var spawn=require("child_process").spawn;

var WebSocketServer = require('ws').Server
  , wss = new WebSocketServer({ port: 1280 });


const Hapi = require('hapi');

// Create a server with a host and port
const server = new Hapi.Server();
server.connection({ 
    host: '0.0.0.0', 
    port: 8080
});

server.register(require('inert'), (err) => {
    if (err) throw err;
    server.route({
        method: 'GET',
        path:'/', 
        handler: function (req, res) {
            return res.file('mclient.html')
        }
    })
})

server.start((err) => {
    if (err) throw err
    console.log('Server running at:', server.info.uri)
})


wss.on('connection', function connection(ws) {

  ws.on('close', function incoming(code, message) {
    console.log("WS close: ", code, message)
  })

  ws.on('message', function incoming(message) {
    // console.log('received: %s', message)
    var msg; try{ msg=JSON.parse(message) }catch(e){ msg=message }
    switch(msg.type){

      case 'connection':
        ws.name = msg.name
        broadcast({ meta:'clientList', data:clientList() })
        break

      // command from client.html or phantom
      case 'command':
        if(msg.meta=='server'){
          try{
            msg.result = eval( msg.data )
          }catch(e){
            msg.result = e.stack
          }
          delete msg.data
          msg.type = 'command_result'
          ws._send( msg )
          return
        }

      default:
        ws.name==='client'? toPhantom(msg) : toClient(msg)
        break

    }
  })

  ws._send = function(msg){
    if(ws.readyState!=1) return
    ws.send( typeof msg=='string' ? msg : JSON.stringify(msg) )
  }

  ws._send( {type:'ws', msg:'connected to socket 8080'} )

})



function clientList(){
  return wss.clients.map((v,i)=>v.name)
}
function findClient(name){
  return wss.clients.find((v,i)=>v.name==name)
}
function toClient(msg){
  var client = findClient('client')
  if(client) client._send(msg)
}
function toPhantom(msg){
  var phantom = findClient('phantom')
  if(phantom) phantom._send(msg)
}

function broadcast(data) {
  wss.clients.forEach(function each(client) {
    data.type='broadcast'
    client._send(data);
  })
}


var ls = spawn("phantomjs", ['--config', 'phantom-config.json', "mtest.js"], {pwd:__dirname, stdio: "pipe" });

ls.stdout.setEncoding("utf8");
ls.stderr.setEncoding("utf8");
ls.stdout.on("data",function (data) {
	console.log('stdout', data);
})
ls.stderr.on("data",function (data) {
	console.log('stderr', data);
})
ls.on("close", function (code) {
	console.log('close', code)
})
ls.on("error", function (code) {
	console.log('error', code);
})

