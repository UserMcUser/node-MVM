# node-MVM
Mainscreen View Manager - Control which view appears on your Artemis Spaceship Bridge Simulator mainscreen consoles.

Majority of the code lifted from "tcpslow" by llambda - https://github.com/llambda/tcpslow

v1.0 - First Public Build

v1.1.0 - Added Perspective option.

v1.2.0 - Added Rotation Option

v1.3.0 - Fixed compatibility with Artemis v2.3.0+; Added flag to support Artemis <=2.2.0.
         Perspective option is now only available for use with older clients.

v1.4.0-NN - Does not use chalk or path. Fix Buffer() DeprecationWarning

v1.5.0-NN - Updated for Artemis 2.8.x. Tidied packet Parsing.
            Parse Version packets (obsolete --oldVersion).

MVM takes these arguments:
* -l/--listen \[port\] Specifies the port MVM should use to accept Artemis client connections.
                   This should match the "networkPort" setting in Artemis.ini.

* -f/--forward \[port\] \(Optional\) Specifies the port MVM should use to connect to the real Artemis server.
                      If not specified, defaults to 2010 \(Artemis' default\)

* -v/--view \[0-6,90,180,270\] Specifiy which view should be displayed. 0=Fore, 1=Port, 2=Starboard,
                  3=Aft, 4=Tactical, 5=Long Range Sensors, and 6=Ship Status 90,180,270=Rotate by
                  x Degrees from actual mainscreen view in 90º increments.

* -s/--server \[hostname or IP address\] \(Optional\) The hostname or IP address of the real Artemis server.
                                       If not specified, this defaults to 'localhost'.

* -p/--perspective \[1,3\] \(Optional, Requires -o \) Specifiy which perspective should be displayed. 1 = First person, 3 = Third person.
                         Note: Will almost certainly need to manually toggle perspective before it will lock.
                         This option is only supported for Artemis v.2.1.1 thru 2.2.0.

* -q/--quiet (Optional) Suppress console messages after initialization.

Usage:

1. Run 'npm install' to install.
 
2. Run "node mvm" with arguments or just "mvm" with arguments if installed Globally.

3. Launch Artemis on the computer where you want your new Mainscreen view to show. Make sure the networkPort value in this client's Artemis.ini file matches the "listen" port as specified on the command-line.

4. Proceed to connect to the server as you normally would; be sure and use the proxy server's IP if you are running it on another machine. Note that there may be a small delay between events on proxied and direct-connected clients.

Note: Actual view may not change until manually triggered - at that point the proxied client will switch to the view specified in the code. Doubly true for perspective changes.
