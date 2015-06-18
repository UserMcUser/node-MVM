# node-MVM
Mainscreen View Manager - Control which view appears on your Artemis Spaceship Bridge Simulator mainscreen consoles.

Majority of the code lifted from "tcpslow" by llambda - https://github.com/llambda/tcpslow

v1.0 - First Public Build
v1.1.0 - Added Perspective option.

MVM takes these arguments:
* -l/--listen [port] Specifies the port MVM should use to accept Artemis client connections.
                   This should match the "networkPort" setting in Artemis.ini.

* -f/--forward [port] (Optional) Specifies the port MVM should use to connect to the real Artemis server.
                      If not specified, defaults to 2010 (Artemis' default)

* -v/--view [0-6] Specifiy which view should be displayed. 0=Fore, 1=Port, 2=Starboard, 3=Aft, 4=Tactical,
                  5=Long Range Sensors, and 6=Ship Status'

* -p/--perspective [1,3] (Optional) Specifiy which perspective should be displayed. 1 = First person, 3 = Third person.
                         Note: Will almost certainly need to manually toggle perspective before it will lock.

* -s/--server [hostname or IP address] (Optional) The hostname or IP address of the real Artemis server.
                                       If not specified, this defaults to 'localhost'.
                                   

Usage:

1. Run 'npm install' to install.
 
2. Run "node mvm" with arguments or just "mvm" with arguments if installed Globally.

3. Launch Artemis on the computer where you want your new Mainscreen view to show. Make sure the networkPort value in this client's Artemis.ini file matches the "listen" port as specified on the command-line.

4. Proceed to connect to the server as you normally would; be sure and use the proxy server's IP if you are running it on another machine. Note that there may be a small delay between events on proxied and direct-connected clients.

Note: Actual view may not change until manually triggered - at that point the proxied client will switch to the view specified in the code. Doubly true for perspective changes.
