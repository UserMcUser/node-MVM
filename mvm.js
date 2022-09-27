//Based almost entirely on "tcpslow" by llambda - https://github.com/llambda/tcpslow
//UserMcUser just removed the "slow" parts and shoe-horned MVM code into the loop.
//NoseyNick obsoleted --oldVersion by parsing server version, support Artemis 2.8.x
//
//Version History
// v1.0 - First public release
// v1.1 - Added perspective option, changed "-h" for host to "-s" for server to avoid collision wiht "-h" for help.
// v1.2 - Added "Dynamic" switching in 90º increments.
// v1.3 - Updated for Artemis 2.5.1; added option to support old client versions.
//        Removed a bunch of unused code from tcpslow. Removed perspective option, except for compatibility mode.
// v1.4-NN - Does not use chalk or path. Fix Buffer() DeprecationWarning. Tidied.
// v1.5-NN - Updated for Artemis 2.8.x. Tidied packet Parsing.
//           Parse Version packets (obsolete --oldVersion).

'use strict';

var net = require('net');
var program = require('commander');
var packagejson = require('./package.json');

var minor_ver = 8; // Artemis v2.X - assume Artemis 2.8 until we find otherwise
var VersionPacket     = Buffer.from([0x4a, 0xe7, 0x48, 0xe5]);
var MainPlayerPacket  = Buffer.from([0xf9, 0x3d, 0x80, 0x80, 0x01]);
var PerspectivePacket = Buffer.from([0xfe, 0xc8, 0x54, 0xf7, 0x12]);

var temp;
var realMainScreenView = 0;
var viewTemp = 0;
var screenRotation = 0;
var viewArrayFore = [0,2,3,1]; //Because the order of the screens isn't layed out spatially we can't use simple math to determine the rotation. So rather than fuck around with lots of logic, I just pre-built these arrays.
var viewArrayPort = [1,0,2,3];
var viewArrayStar = [2,3,1,0];
var viewArrayAft  = [3,1,0,2];
var showInstead = 0;
var perspectiveInstead = -1;
var verbose = 1;

program
.version(packagejson.version)
.option('-l, --listen [port]', 'TCP port to listen on\n', parseInt)
.option('-f, --forward [port]', 'TCP port to forward to (Optional, default is\n                             2010)\n', parseInt)
.option('-v, --view [0-6,90,180,270]', 'What should the mainscreen show?\n                             0=Fore, 1=Port, 2=Starboard, 3=Aft, 4=Tactical\n                             5=Long Range Sensors, and 6=Ship Status\n                             90,180,270=Rotate by x Degrees from actual\n                             mainscreen view in 90º increments.\n')
.option('-s, --server [hostname]', 'IP or Hostname of the real Artemis Server.\n                             (Optional, default is \'localhost\')\n')
.option('-p, --perspective [1,3]', 'Force mainscreen perspective to 1st or 3rd\n                             person. (Optional, requires -o)\n                             Toggle perspective once to initialize.\n                             Note: Not compatible with Artemis >=2.3.0\n', parseInt)
.option('-q, --quiet', 'Suppress console messages after initialization')
.parse(process.argv);

if (!program.listen) {
  console.error('\nPlease specify listening port.');
  program.help();
}

if (!program.forward) {
  program.forward = 2010;
}

if (!program.view) {
  console.error('\nPlease specify the desired view.');
  program.help();
} else {
  if (program.view > 6) {
    if (program.view % 90 !== 0) {
      console.error('\nPlease specify the view using 0-6 or a degree of rotation in increments of 90º.');
      program.help();
    } else {
      if (program.view > 270) {
        console.error('\nERROR: A rotation value greater than 270º is not allowed. Or useful.');
        return 0;
      }; //End If
    }; //End If
  }; //End If
} //End If

if (program.quiet) {verbose = 0;}

function createConnection() {
  var conn;

  if (program.server || program.forward) {
    conn = {};
    conn.port = program.forward;
    if (program.server) {
      conn.host = program.server;
    } else {
      conn.host = 'localhost';
    }
    return net.createConnection(conn);
  }
}

function unpackBitmap(bufferSlice, buffer) { //Returns the number of bytes to skip.
  var n = (minor_ver < 7) ? 2 : 1; // InNebula(U16) became InNebula(U8) in 2.7    :-/
  //                0 1 2 3 4 5 6 7  8 9 101112131415 1617181920212223 2425262728293031     ...
  var fieldBytes = [4,4,4,4,4,1,1,4, 2,4,4,4,4,4,4,4, 4,4,n,0,4,4,4,4, 4,1,4,1,1,1,4,4]; // ...
  var bitMapped = Array(40);
  var bitmap = Array(5);
  // Running Total of bytes we can skip.
  // 34 for <2.3.0, now 35 for 2.3.0+ (gained another byte of bitmap):
  var runTot = (minor_ver >= 3) ? 35 : 34;
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

  for (i=0;i<27;i++){ //Only need to look until we get to the item we want.
    if (bitMapped[i] && fieldBytes[i]) {
      runTot += fieldBytes[i];
    } else if (bitMapped[i]) {
      // fieldBytes=0 (ab)used to indicate len(U32)+len*ch(U16) = string
      var strLen = buffer.readUInt32LE(runTot) * 2;
      runTot += strLen + 4;
    };
  };
  return runTot;
}; //End Function

function getPrettyView(theView) {
  if (theView == 0) return 'Fore';
  if (theView == 1) return 'Port';
  if (theView == 2) return 'Starboard';
  if (theView == 3) return 'Aft';
  if (theView == 4) return 'Tactical';
  if (theView == 5) return 'LRS';
  if (theView == 6) return 'Status';
  return 'Out of Bounds';
}; //End Function

function getPerspective(thePerspective) {
  if (thePerspective == 1) return 0;
  if (thePerspective == 3) return 1;
}; //End getPerspective

function getPrettyPerspective(thePerspective, altMode) {
  if (thePerspective == 0) return '1st Person';
  if (altMode && thePerspective == 1) return '3rd person';
  if (thePerspective == 1) return '1st person';
  if (thePerspective == 3) return '3rd person';
  return 'Out of Bounds';
};//End getPrettyPerspective

function getViewByDegrees(theRealView, theDegrees) {
  switch(theRealView) {
    case 0: return viewArrayFore[theDegrees / 90];
    case 1: return viewArrayPort[theDegrees / 90];
    case 2: return viewArrayStar[theDegrees / 90];
    case 3: return viewArrayAft [theDegrees / 90];
  }//End Switch
  return theRealView;
}//End getViewByDegrees

var server = net.createServer(function(listen) {
  listen.forward = createConnection();

  listen.forward.on('data', function(data) {
    // MVM Lie Goes here. ++++++++++ Strongly consider proper DEADBEEF parsing?
    temp = data.slice(20,25);
    //console.log(temp);

    if (data.slice(20,24).equals(VersionPacket)){
      var major_ver = data.readUInt32LE(32);
      minor_ver     = data.readUInt32LE(36); // global var
      var patch_ver = data.readUInt32LE(40);
      if (verbose) {
        console.log('Connected to Server Version:', major_ver+'.'+minor_ver+'.'+patch_ver);
      }
      if (major_ver < 2) {
        console.error('  How quaint! DANGER! MVM probably only works with Artemis 2.X!');
        minor_ver = -1; // not true but "less than v2.0" more likely to work
      } else if (major_ver == 1) {
        if (verbose) {
          if         (minor_ver < 1 ) {
            console.warn('  MVM support for Artemis < 2.1 may be dubious!');
          } else if ((minor_ver > 8 ) || (minor_ver == 8 && patch_ver > 1)) {
            console.warn('  MVM support for Artemis > 2.8.1 may be dubious!');
          }
        }
      } else {
        console.error('  How awesome! DANGER! MVM probably only works with Artemis 2.X!');
        minor_ver = 999; // not true but "v2.999" more useful than 2.x
      }
    } else if (temp.equals(MainPlayerPacket)) {
      var bufferIndex = unpackBitmap(data.slice(29,34), data);
      if (bufferIndex){
        //console.log('bitmap: ', data.slice(29,34));
        //console.log('Buffer Index: ', bufferIndex);
        realMainScreenView = data.readUInt8(bufferIndex);
        if (!screenRotation) {
          if(verbose){console.log('Server Says the mainScreen view is: ', getPrettyView(realMainScreenView));}
          data.writeUInt8(showInstead, bufferIndex);
          if(verbose){console.log('But we are sending: ', getPrettyView(data.readUInt8(bufferIndex)));}
        } else {
          if(verbose){console.log('Server Says the mainScreen view is: ', getPrettyView(realMainScreenView));}
          viewTemp = getViewByDegrees(realMainScreenView, screenRotation);
          if (viewTemp !== -1) showInstead = viewTemp;
          data.writeUInt8(showInstead, bufferIndex);
          if(verbose){console.log('But we are dynamically rotating by', screenRotation, ' degrees and sending: ', getPrettyView(data.readUInt8(bufferIndex)));}
        };
      };//End If bufferIndex
    } else if (temp.equals(PerspectivePacket) && perspectiveInstead != -1) {
      //console.log('Contents of Perspective Buffer: ', data);
      var perspectiveOffset = (minor_ver < 4) ? 28 : 25;
      if(verbose){console.log('Server Says the mainScreen perspective is: ', getPrettyPerspective(data.readUInt8(perspectiveOffset),1));}
      if (minor_ver < 4) { // Artemis 2.3.x or lower
        data.writeUInt8(perspectiveInstead, perspectiveOffset);
        if (verbose) {
          console.log('But we are sending: ', getPrettyPerspective(data.readUInt8(perspectiveOffset),1));
        }
      } else {
        return; // skip sending it to the listener. Not perfect, but half works?
      }
    }

    listen.write(data); // possibly modified packet to client
  });

  listen.forward.on('error', function(err) {
    listen.destroy();
  });
  listen.forward.on('end', function() {
    listen.end();
  });
  listen.forward.on('close', function(closed) {
    listen.end();
  });

  listen.on('data', function(data) {
    listen.forward.write(data);
  });

  listen.on('error', function(err) {
    listen.forward.destroy();
  });
  listen.on('end', function() {
    listen.forward.end();
    listen.end();
  });
  listen.on('close', function() {
    listen.forward.end();
  });
});


server.listen(program.listen, function() {
  console.log('Mainscreen View Manager v' + packagejson.version + '\n');

  if (program.listen) {
    console.log('Listening on port ' + program.listen);
  };

  console.log('Relaying to ' + (program.server ? program.server + ' ' : '') + 'port ' + program.forward + '\n');

  if (program.view < 7) {
    showInstead = program.view;
    console.log('View will be set to: ' + getPrettyView(showInstead));
  } else {
    screenRotation = program.view;
    showInstead = getViewByDegrees(0,screenRotation);//Default
    console.log('View will dynamically change to be ' + screenRotation + 'º clockwise from actual Mainscreen.');
  }

  if (program.perspective) {
    perspectiveInstead = getPerspective(program.perspective);
    console.log('Perspective will be set to: ' + getPrettyPerspective(program.perspective,0));
  }
  console.log('\nUse Control+C to quit.');
  if(!verbose){console.log('\nNo further console messages will be shown.')};
});
