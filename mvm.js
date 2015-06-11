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

program
.version(packagejson.version)
.description('Delay packets')
.option('-l, --listen [port]', 'TCP port to listen on', parseInt)
.option('-f, --forward [port]', 'TCP port to forward to (normally 2010)', parseInt)
.option('-h, --host [hostname]', 'IP or Hostname of real Artemis Server. Defaults to \'localhost\' if unspecified.')
.option('-v, --verbose', 'Log connection events')
.parse(process.argv);


if (!program.listen) {
  console.error('Need a listening port');
  program.help();
}

if (!program.forward) {
  console.error('Need a forwarding port');
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
      var bufferIndex = unpackBitmap(data.slice(29,35), data);
      if (bufferIndex){
        console.log('bitmap: ', data.slice(29,33));
        console.log('Server Says the mainScreen is: ', data.readUInt8(bufferIndex));
        var showInstead = 0x02; //
        console.log('But we are sending: ', showInstead);
        data[bufferIndex] = showInstead;
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
    // if (program.verbose) console.log(new Date() + ' (listening) socket end.');
    logSocketStatus(' (listening) end ' , listen);
    listen.forward.end();
    listen.end();
  });
  listen.on('error', function(err) {
    // if (program.verbose) console.log(new Date() + ' (listening) error: ' + err);
    logSocketStatus(' (listening) error ' , listen);
    listen.forward.destroy();
  });
  listen.on('close', function() {
    // var args = Array.prototype.slice.call(arguments);
    logSocketStatus(' (listening) close ' , listen);
    // if (program.verbose) console.log(new Date() + ' (listening) close: ' + args);
    listen.forward.end();
  });
});

server.listen(program.listen ? program.listen : program.listenuds, function() {
  console.log('tcpslow ' + packagejson.version);
  if (program.listen) {
    console.log('Listening on port ' + program.listen);
  } else {
    console.log('Listening on unix domain socket ' + program.listenuds);
  }
  console.log('Relaying to ' + (program.host ? program.host + ' ' : '')
    + 'port ' + program.forward);
  if (program.delay) {
    console.log(' delaying by ' + program.delay + 'ms' + (program.sending ? ' in both directions ' : ' on receive'));
  }
});

function unpackBitmap(bufferSlice, buffer) { //Returns the number of bytes to skip.
//console.log('In unpack.');
//                0 1 2 3 4 5 6 7 8 9 10111213141516171819202122232425262728293031
var fieldBytes = [4,4,4,4,4,1,1,4,2,4,4,4,4,4,4,4,4,4,2,0,4,4,4,4,4,1,4,1,0,0,0,0];
var bitMapped = Array(32);
var bitmap = Array(4);
var runTot = 34; //Running Total of bytes we can skip.
var i = 0;
var byte = 0;
vay bit = 0;

  for (i = 0; i < 4 ; i++) {
    bitmap[i] = bufferSlice.readUInt8(i);
  };
  for (byte = 0; byte < 4; byte++) {
    for (bit = 0; bit < 8; bit++) {
      bitMapped[(byte*8)+bit] = (bitmap[byte] >> (7-bit) & 1);
    };//End For Bit
  };//End For Byte

  if (!bitMapped[28]) { //If this is false we don't have to care anymore.
    //console.log('Early Exit: ', runTot);
    return 0;
  }

  for (i=0;i<32;i++){
      if (bitMapped[i]) runTot += fieldBytes[i];
      if (i === 19 && bitMapped[i]) {
        var strLen = (buffer.readUInt32LE(runTot)*2);
        var str = buffer.toString('utf16le', runTot + 4, runTot + strLen + 2);
        runTot += strLen + 4;
      };
  };

  return runTot;

}; //End Function
