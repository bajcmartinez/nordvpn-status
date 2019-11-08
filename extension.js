// Includes;
const { St, Clutter } = imports.gi;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const Main = imports.ui.main;
const Mainloop  = imports.mainloop;
const AggregateMenu = Main.panel.statusArea.aggregateMenu;

let vpnStatusIndicator;

class NordVPN {
    constructor()
    {
        this._commands = {
            connect: 'nordvpn c',
            disconnect: 'nordvpn d',
            status: 'nordvpn status'
        };

        this._states = {
            CONNECTED: 'CONNECTED'
        };
    }

    /**
     * Call NordVPN Command Line Tool to connect to the VPN Service
     */
    connect() {
        GLib.spawn_command_line_async(this._commands.connect);
    }

    /**
     * Call NordVPN Command Line Tool to disconnect to the VPN Service
     */
    disconnect() {
        GLib.spawn_command_line_async(this._commands.disconnect);
    }

    /**
     * Call NordVPN Command Line Tool to get the status of the VPN connection
     *
     * @returns {{connected: boolean, country: string, city: string, fullStatus: string, serverNumber: number, status: string}|{connected: boolean, fullStatus: string, status: string}}
     */
    getStatus() {
        const data = (GLib.spawn_command_line_sync(this._commands.status)[1]);
        let fullStatus;
        if (data instanceof Uint8Array) {
            fullStatus = imports.byteArray.toString(data).trim();
        } else {
            fullStatus = data.toString().trim();
        }
        const result = fullStatus.split('\n');
        const statusLine = result.find((line) => line.includes("Status:"));
        const status = statusLine ? statusLine.replace("Status:", "").trim() : "Unknown";

        if (status.toUpperCase() === this._states.CONNECTED) {
            const serverNumberLine = result.find((line) => line.includes("server:"));
            const countryLine = result.find((line) => line.includes("Country:"));
            const cityLine = result.find((line) => line.includes("City:"));

            const serverNumber = serverNumberLine ? serverNumberLine.match(/\d+/) :  "Unknown";
            const country = countryLine ? countryLine.replace("Country:", "").trim() :  "Unknown";
            const city = cityLine ? cityLine.replace("City:", "").trim() :  "Unknown";

            return {
                connected: true,
                status,
                serverNumber,
                country,
                city,
                fullStatus
            }
        } else {
            return {
                connected: false,
                status: status,
                fullStatus
            }
        }
    }
}

class VPNStatusIndicator extends PanelMenu.SystemIndicator {
    constructor() {
        super();

        // Add the indicator to the indicator bar
        this._indicator = this._addIndicator();
        this._indicator.icon_name = 'network-vpn-symbolic';
        this._indicator.visible = false;

        // Build a menu

        // Main item with the header section
        this._item = new PopupMenu.PopupSubMenuMenuItem('NordVPN', true);
        this._item.icon.icon_name = 'network-vpn-symbolic';
        this._item.label.clutter_text.x_expand = true;
        this.menu.addMenuItem(this._item);

        // Content Inside the box
        this._item.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._connectionDetails = new PopupMenu.PopupMenuItem("");
        this._item.menu.addMenuItem(this._connectionDetails);

        // Initiate NordVPN handler
        this.vpnHandler = new NordVPN();

        // Add elements to the UI
        AggregateMenu._indicators.insert_child_at_index(this.indicators, 0);
        AggregateMenu.menu.addMenuItem(this.menu, 4);
    }

    enable() {
        this.resetTimer();
        this._refresh();
    }

    /**
     * Call NordVPN Command Line Tool to connect to the VPN Service
     *
     * @private
     */
    _connect() {
        this.stopTimer();
        this.vpnHandler.connect();
        this.resetTimer();
        this.startTimer();
    }

    /**
     * Call NordVPN Command Line Tool to connect to the VPN Service
     *
     * @private
     */
    _disconnect() {
        this.stopTimer();
        this.vpnHandler.disconnect();
        this.resetTimer();
        this.startTimer();
    }

    /**
     * Call NordVPN Command Line Tool to get the current status of the connection
     *
     * @private
     */
    _refresh() {
        this.stopTimer();
        log("Updating NordVPN Status...");
        this._update(this.vpnHandler.getStatus());
        this.startTimer();
    }

    /**
     * Updates the widgets based on the vpn status
     *
     * @param vpnStatus
     * @private
     */
    _update(vpnStatus) {
        // Update the panel button
        this._indicator.visible = vpnStatus.connected;
        this._item.label.text = `NordVPN ${vpnStatus.status}`;

        if (vpnStatus.connected) {
            if (!this._disconnectAction)
                this._disconnectAction = this._item.menu.addAction('Disconnect', this._disconnect.bind(this));

            if (this._connectAction) {
                this._connectAction.destroy();
                this._connectAction = null;
            }
        } else {
            if (!this._connectAction)
                this._connectAction = this._item.menu.addAction('Connect', this._connect.bind(this));

            if (this._disconnectAction) {
                this._disconnectAction.destroy();
                this._disconnectAction = null;
            }

        }
        this._connectionDetails.label.text = vpnStatus.fullStatus;
    }

    resetTimer() {
        this._timerStep = 1;
    }

    startTimer() {
        this._timer = Mainloop.timeout_add_seconds(this._timerStep, Lang.bind(this, this._refresh));
        this._timerStep = this._timerStep * 2;
        this._timerStep = (this._timerStep > 30) ? 30 : this._timerStep;
    }

    stopTimer() {
        if (this._timer) {
            Mainloop.source_remove(this._timer);
            this._timer = undefined;
        }
    }

    destroy() {
        this.stopTimer();
        // Call destroy on the parent
        this.indicators.destroy();
        if (typeof this.parent === "function") {
            this.parent();
        }
    }
}

function init() { }


function enable() {
    // Init the indicator
    vpnStatusIndicator = new VPNStatusIndicator();
    vpnStatusIndicator.enable();
}

function disable() {
    // Remove the indicator from the panel
    vpnStatusIndicator.destroy();
    vpnStatusIndicator = null;
}
