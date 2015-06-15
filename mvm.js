//Based almost entirely on "tcpslow" by llambda - https://github.com/llambda/tcpslow
//I just removed the "slow" parts and shoe-horned my code into the loop.

'use strict';

var net = require('net');
var chalk = require('chalk');
var path = require('path');
var program = require('commander');
var packagejson = require('./package.json');

var MainPlayerPacket = new Buffer(5);
MainPlayerPacket.writeUIntBE(0xf93d808001,0,5);

var temp = Buffer(0);
var showInstead = 0;

program
.version(packagejson.version)
.option('-l, --listen [port]', 'TCP port to listen on', parseInt)
.option('-f, --forward [port]', 'TCP port to forward to (normally 2010)', parseInt)
.option('-v, --view [0-6]', 'What should the mainscreen show?\n                       0=Fore, 1=Port, 2=Starboard, 3=Aft, 4=Tactical,\n                       5=Long Range Sensors, and 6=Ship Status')
.option('-h, --host [hostname]', 'IP or Hostname of the real Artemis Server.\n                       Defaults to \'localhost\' if unspecified.')
.parse(process.argv);

if (!program.listen) {
  console.error('Please specify listening port.');
  program.help();
}

if (!program.forward) {
  console.error('Please specify forwarding port (usually 2010)');
  program.help();
}

if (!program.view) {
  console.error('Please specify the desired view.');
  program.help();
}

function createConnection() {
  var conn;

  if (program.host || program.forward) {
    conn = {};
    conn.port = program.forward;
    if (program.host) {
      conn.host = program.host;
    } else {
      conn.host = 'localhost';
    }
    return net.createConnection(conn);
  }
}

function logSocketStatus(status, socket) {
  if (program.verbose) {
    console.log(new Date () + ' local: ' + socket.localAddress + ':' + socket.localPort
     + ' remote: ' + socket.remoteAddress + ':' + socket.remotePort + ' | ' + status);
  }
}

var server = net.createServer(function(listen) {
  logSocketStatus('(listening) client connected', listen);

  listen.forward = createConnection();
  listen.forward.on('connect', function() {

    logSocketStatus('(forwarding) client connected.', listen.forward);
  });
  listen.forward.on('data', function(data) {
    //MVM Lie Goes here.
    temp = data.slice(20,25);
    //console.log(temp);

    if (temp.equals(MainPlayerPacket)){
      var bufferIndex = unpackBitmap(data.slice(29,34), data);

      if (bufferIndex){
        //console.log('bitmap: ', data.slice(29,34));
        //console.log('Buffer Index: ', bufferIndex);
        console.log('Server Says the mainScreen is: ', getPrettyName(data.readUInt8(bufferIndex)));
        data.writeUInt8(showInstead, bufferIndex);
        console.log('But we are sending: ', getPrettyName(data.readUInt8(bufferIndex)));
      };
    };

    if (program.packet) console.log(chalk.red(data))
      setTimeout(function() {
        listen.write(data);
      }, program.delay);
  });
  listen.forward.on('error', function(err) {
    // if (program.verbose) console.log(new Date() + ' (forwarding) error ' + err);
    logSocketStatus('(forwarding) error ' + err, listen.forward);
    listen.destroy();
  });
  listen.forward.on('end', function() {
    // if (program.verbose) console.log(new Date() + ' (forwarding) client end.');
    logSocketStatus('(forwarding) end ' , listen.forward);
    listen.end();
  });
  listen.forward.on('close', function(closed) {
    // if (program.verbose) console.log(new Date() + ' (forwarding) client close.');
    logSocketStatus('(forwarding) close ' , listen.forward);
    listen.end();
  })

  listen.on('data', function(data) {
    if (program.sending) {
      setTimeout(function() {
        listen.forward.write(data);
      }, program.delay);
    } else {
      listen.forward.write(data);
    }
    if (program.packet) console.log(chalk.blue(data));
  });
  listen.on('end', function() {
    logSocketStatus(' (listening) end ' , listen);
    listen.forward.end();
    listen.end();
  });
  listen.on('error', function(err) {
    logSocketStatus(' (listening) error ' , listen);
    listen.forward.destroy();
  });
  listen.on('close', function() {
    logSocketStatus(' (listening) close ' , listen);
    listen.forward.end();
  });
});

server.listen(program.listen ? program.listen : program.listenuds, function() {
  console.log('Mainscreen View Manager version' + packagejson.version);
  if (program.listen) {
    console.log('Listening on port ' + program.listen);
  }
  console.log('Relaying to ' + (program.host ? program.host + ' ' : '') + 'port ' + program.forward);
  showInstead = program.view;
  console.log('View will be set to: ', getPrettyName(showInstead));
  console.log('Use Control+C to quit.');
  });

function unpackBitmap(bufferSlice, buffer) { //Returns the number of bytes to skip.

//                0 1 2 3 4 5 6 7 8 9 10111213141516171819202122232425262728293031
var fieldBytes = [4,4,4,4,4,1,1,4,2,4,4,4,4,4,4,4,4,4,2,0,4,4,4,4,4,1,4,0,0,0,0,0]; //As of Artemis 2.1.5
var bitMapped = Array(40);
var bitmap = Array(5);
var runTot = 34; //Running Total of bytes we can skip.
var i = 0;
var byte = 0;
var bit = 0;

  for (i = 0; i < 4 ; i++) {
    bitmap[i] = bufferSlice.readUInt8(i);
  };
  for (byte = 0; byte < 4; byte++) {
    for (bit = 0; bit < 8; bit++) {
      bitMapped[(byte*8)+bit] = (bitmap[byte] >> (0+bit) & 1);
    }; //End For Bit
  }; //End For Byte

  if (!bitMapped[27]) return 0; //We can early exit if the update does not include the Mainscreen view.

  for (i=0;i<28;i++){ //Only need to look until we get to the item we want.
      if (i === 19 && bitMapped[i] === 1) {
        var strLen = (buffer.readUInt32LE(runTot)*2);
        //var str = buffer.toString('utf16le', runTot + 4, runTot + strLen + 2);
        //console.log('str: ', str);
        fieldBytes[i] = strLen + 4;
      };
      if (bitMapped[i]) {
        runTot += fieldBytes[i];
      };
  };
  return runTot;
}; //End Function

function getPrettyName(theView) {
  if (theView == 0) return 'Fore';
  if (theView == 1) return 'Port';
  if (theView == 2) return 'Starboard';
  if (theView == 3) return 'Aft';
  if (theView == 4) return 'Tactical';
  if (theView == 5) return 'LRS';
  if (theView == 6) return 'Status';
  return 'Out of Bounds';
}; //End Function
