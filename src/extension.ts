// Copyright Sebastian Wiesner <sebastian@swsnr.de>
//
// Licensed under the EUPL
//
// See https://interoperable-europe.ec.europa.eu/collection/eupl/eupl-text-eupl-12

import GObject from "gi://GObject";
import Gio from "gi://Gio";

import * as Main from "resource:///org/gnome/shell/ui/main.js";

import { DestructibleExtension, Destroyer } from "./lib/destructible.js";
import { IconThemeLoader } from "./lib/icons.js";
import { UpdateMonitor } from "./lib/offline-update/monitor.js";
import { UpdateIndicator } from "./lib/indicator.js";
import { PacmanOfflineBackend } from "./lib/offline-update/backends/pacman-offline.js";
import { OfflineUpdateController } from "./lib/offline-update/controller.js";

Gio._promisify(Gio.File.prototype, "query_info_async");
Gio._promisify(Gio.Subprocess.prototype, "wait_check_async");

/**
 * Extension to indicate pending systemd offline updates.
 *
 * Show a small GNOME Shell indicator if there are pending systemd offline updates.
 */
export default class SystemdOfflineUpdateExtension extends DestructibleExtension {
  override initialize(destroyer: Destroyer) {
    const log = this.getLogger();
    const iconLoader = new IconThemeLoader(
      this.metadata.dir.get_child("icons"),
    );

    const controller = new OfflineUpdateController(log);

    log.log("Creating indicator for pending offline update");
    const indicator = destroyer.add(
      new UpdateIndicator(iconLoader, controller),
    );

    log.log("Monitoring for pending offline update");
    const backends = [new PacmanOfflineBackend(log)];
    const monitor = destroyer.add(new UpdateMonitor(log, backends));
    destroyer.addBinding(
      monitor.bind_property(
        "offline-update-pending",
        indicator,
        "visible",
        GObject.BindingFlags.SYNC_CREATE,
      ),
    );
    destroyer.addBinding(
      monitor.bind_property(
        "offline-update-backend",
        controller,
        "backend",
        GObject.BindingFlags.SYNC_CREATE,
      ),
    );

    log.log("Monitoring for low-power condition");
    const powerMonitor = Gio.PowerProfileMonitor.dup_default();
    destroyer.addSignal(
      powerMonitor,
      powerMonitor.connect(
        "notify::power-saver-enabled",
        (monitor: Gio.PowerProfileMonitor) => {
          if (monitor.get_power_saver_enabled()) {
            log.log("Cancelling pending update due to low-power");
            controller.cancelPendingUpdate();
          }
        },
      ),
    );

    Main.panel.addToStatusArea(this.metadata.uuid, indicator);
  }
}
