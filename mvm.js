//Based almost entirely on "tcpslow" by llambda - https://github.com/llambda/tcpslow
//I just removed the "slow" parts and shoe-horned my code into the loop.
//
//Version History
// v1.0 - First public release
// v1.1 - Added perspective option, changed "-h" for host to "-s" for server to avoid collision wiht "-h" for help.
// v1.2 - Added "Dynamic" switching in 90º increments.
// v1.3 - Updated for Artemis 2.5.1; added option to support old client versions.
//        Removed a bunch of unused code from tcpslow. Removed perspective option, except for compatibility mode.

'use strict';

var net = require('net');
var chalk = require('chalk');
var path = require('path');
var program = require('commander');
var packagejson = require('./package.json');

var MainPlayerPacket = new Buffer(5);
MainPlayerPacket.writeUIntBE(0xf93d808001,0,5);
var PerspectivePacket = new Buffer(5);
PerspectivePacket.writeUIntBE(0xfec854f712,0,5);

var temp = Buffer(0);
var realMainScreenView = 0;
var viewTemp = 0;
var screenRotation = 0;
var viewArrayFore = [0,2,3,1]; //Because the order of the screens isn't layed out spatially we can't use simple math to determine the rotation. So rather than fuck around with lots of logic, I just pre-built these arrays.
var viewArrayPort = [1,0,2,3];
var viewArrayStar = [2,3,1,0];
var viewArrayAft = [3,1,0,2];
var showInstead = 0;
var perspectiveInstead = -1;
var oldVersion = 0;
var perspectiveOffset = 25;
var verbose = 1;

program
.version(packagejson.version)
.option('-l, --listen [port]', 'TCP port to listen on\n', parseInt)
.option('-f, --forward [port]', 'TCP port to forward to (Optional, default is\n                             2010)\n', parseInt)
.option('-v, --view [0-6,90,180,270]', 'What should the mainscreen show?\n                             0=Fore, 1=Port, 2=Starboard, 3=Aft, 4=Tactical\n                             5=Long Range Sensors, and 6=Ship Status\n                             90,180,270=Rotate by x Degrees from actual\n                             mainscreen view in 90º increments.\n')
.option('-s, --server [hostname]', 'IP or Hostname of the real Artemis Server.\n                             (Optional, default is \'localhost\')\n')
.option('-o, --oldVersion', 'Setting this option will allow MVM to work\n                             with Artemis v2.1.1 thru 2.2.0\n')
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
        return 0; //
      }; //End If
    }; //End If
  }; //End If
} //End If

if (program.oldVersion) {
  oldVersion = 1;
  perspectiveOffset = 28; // Artemis <=2.1.5
} else {
  oldVersion = 0;
  perspectiveOffset = 25; // Artemis >=2.3.0+ Not that this value is *used* mind you...
}

if (program.perspective) {
  if (!oldVersion) {
    console.log('\nERROR: MVM can only provide perspective locking in Artemis v2.1.1 thru 2.2.0\nMust use \'-o/--oldVersion\' argument with \'-p/--perspective\'')
    return 0;
  }
}

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

//                0 1 2 3 4 5 6 7 8 9 10111213141516171819202122232425262728293031
var fieldBytes = [4,4,4,4,4,1,1,4,2,4,4,4,4,4,4,4,4,4,2,0,4,4,4,4,4,1,4,0,0,0,0,0]; //As of Artemis 2.1.5
var bitMapped = Array(40);
var bitmap = Array(5);
if (oldVersion) {var runTot = 34;} else {var runTot = 35;} //Running Total of bytes we can skip. 35 for 2.3.0+, 34 for <2.3.0
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
  if (theRealView < 4) {
    switch(theRealView) {

      case 0: //Fore
        return viewArrayFore[theDegrees / 90];
        break;

      case 1: //Port
        return viewArrayPort[theDegrees / 90];
        break;

      case 2: //Starboard
        return viewArrayStar[theDegrees / 90];
        break;

      case 3: //Aft
        return viewArrayAft[theDegrees / 90];
        break;

      default:
        console.error('Somehow we didn\'t switch right in getViewByDegrees.');
        return -1;
        break;
    }//End Switch
  } else {
    return -1; //
  };
}//End getViewByDegrees

var server = net.createServer(function(listen) {
  listen.forward = createConnection();

  listen.forward.on('connect', function() {});

  listen.forward.on('data', function(data) {

    //MVM Lie Goes here.
    temp = data.slice(20,25);
    //console.log(temp);

    if (temp.equals(MainPlayerPacket)){
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
    }; //End if MainPlayerPacket

    //console.log(temp);

    if (temp.equals(PerspectivePacket) && perspectiveInstead != -1) {

        //console.log('Contents of Perspective Buffer: ', data);
        if(verbose){console.log('Server Says the mainScreen perspective is: ', getPrettyPerspective(data.readUInt8(perspectiveOffset),1));}
        data.writeUInt8(perspectiveInstead, perspectiveOffset);
        if(verbose){console.log('But we are sending: ', getPrettyPerspective(data.readUInt8(perspectiveOffset),1));}
    }; //End if PerspectivePacket

    listen.write(data);
})

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

  listen.on('end', function() {
    listen.forward.end();
    listen.end();
  });
  listen.on('error', function(err) {
    listen.forward.destroy();
  });

  listen.on('close', function() {
    listen.forward.end();
  });
})


server.listen(program.listen, function() {
  console.log('Mainscreen View Manager v' + packagejson.version + '\n');

  if (program.oldVersion) {
    console.log('Compatability mode enabled.\n')
  };

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
    if (oldVersion) {
      perspectiveInstead = getPerspective(program.perspective);
      console.log('Perspective will be set to: ' + getPrettyPerspective(program.perspective,0));
    }
  };
    console.log('\nUse Control+C to quit.');
    if(!verbose){console.log('\nNo further console messages will be shown.')};
});
