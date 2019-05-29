// Includes;
const { St, Clutter } = imports.gi;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const GLib = imports.gi.GLib;
const Lang = imports.lang;

let statusIndicator;

class NordVPN {
    constructor()
    {
        this._commands = {
            status: 'nordvpn status'
        };

        this._states = {
            CONNECTED: 'CONNECTED'
        };
    }

    getStatus() {
        const full_status = GLib.spawn_command_line_sync(this._commands.status)[1].toString();
        const result = full_status.split('\n');
        const status = result[0].replace("Status:", "").trim();

        if (status.toUpperCase() === this._states.CONNECTED) {
            const serverNumber = result[1].match(/\d+/);
            const country = result[2].replace("Country:", "").trim();
            const city = result[3].replace("City:", "").trim();

            return {
                connected: true,
                status,
                serverNumber,
                country,
                city,
                full_status
            }
        } else {
            return {
                connected: false,
                status: status,
                full_status
            }
        }
    }
}

const StatusIndicator = new Lang.Class({
    Name: 'VpnIndicator',
    Extends: PanelMenu.Button,

    _init() {
        this.parent(0.0, "NordVPN Status Indicator", false);

        const hbox = new St.BoxLayout({ style_class: 'panel-status-label-box' });

        this._panelLabel = new St.Label({
            text: 'NordVPN',
            y_expand: true,
            y_align: Clutter.ActorAlign.CENTER
        });
        hbox.add_child(this._panelLabel);

        this._statusLabel = new St.Label({
            text: 'NordVPN',
            y_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'popup_status_label'
        });

        this.menu.box.add(this._statusLabel);

        // Add the label to the UI
        this.actor.add_actor(hbox);

        this.vpnHandler = new NordVPN();
    },

    enable() {
        this._refresh();
    },

    /**
     * Call NordVPN Command Line Tool to get the current status of the connection
     *
     * @private
     */
    _refresh() {
        this._update(this.vpnHandler.getStatus());
    },

    _update(vpnStatus) {
        // Update the panel button
        if (vpnStatus.connected) {
            this._panelLabel.style_class = 'label_connected';
            this._panelLabel.text = `${vpnStatus.status}: ${vpnStatus.city} #${vpnStatus.serverNumber}`;
        } else {
            this._panelLabel.style_class = 'label_disconnected';
            this._panelLabel.text = `${vpnStatus.status}`;
        }
        this._statusLabel.text = vpnStatus.full_status;

        //this._panelLabel.style_class = vpnStatus.styleClass;
    },

    destroy() {
        // Call destroy on the parent
        this.parent();
    }
});

function init() {
    // Init the indicator
    statusIndicator = new StatusIndicator();
}

function enable() {
    statusIndicator.enable();
    Main.panel.addToStatusArea('nordvpn-status-indicator', statusIndicator);
}

function disable() {
    // Remove the indicator from the panel
    statusIndicator.disable();
}

function destroy () {
    statusIndicator.destroy();
}
