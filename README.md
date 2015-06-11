# node-MVM
Mainscreen View Manager - Control which view appears on your Artemis Spaceship Bridge Simulator mainscreen consoles.

Majority of the code lifted from "tcpslow" by llambda - https://github.com/llambda/tcpslow

v.01 - First working build

MVM takes up to three arguments:
-l/--listen [port] Specifies the port MVM should use to accept Artemis client connections.
                   This should match the "networkPort" setting in Artemis.ini.
-f/--forward [port] Specifies the port MVM should use to connect to the real Artemis server.
-h/--host [hostname or IP address] (Optional) The hostname or IP address of the real Artemis server.
                                   If not specified, this defaults to 'localhost'.
                                   
Usage:
1. Run 'npm install' to install.
2. Run "node mvm" with arguments or just "mvm" with arguments if installed Globally.
3. Launch Artemis on the computer where you want your new Mainscreen view to show. Make sure the networkPort value in this client's Artemis.ini file matches the "listen" port as specified on the command-line.
4. Proceed to connect to the server as you normally would. Note that there may be a small delay between events on proxied and direct-connected clients.


