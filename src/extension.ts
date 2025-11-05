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
import { Notifications } from "./lib/notifications.js";

Gio._promisify(Gio.File.prototype, "query_info_async");
Gio._promisify(Gio.Subprocess.prototype, "wait_check_async");
Gio._promisify(Gio.Subprocess.prototype, "communicate_utf8_async");

/**
 * Extension to indicate pending systemd offline updates.
 *
 * Show a small GNOME Shell indicator if there are pending systemd offline updates.
 */
export default class SystemdOfflineUpdateExtension extends DestructibleExtension {
  override initialize(destroyer: Destroyer) {
    const log = this.getLogger();
    const iconLoader = new IconThemeLoader(this.dir.get_child("icons"));

    const notifications = new Notifications(log, iconLoader);
    const controller = new OfflineUpdateController(log);

    log.log("Creating indicator for pending offline update");
    const indicator = destroyer.add(
      new UpdateIndicator(iconLoader, controller, notifications),
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
    destroyer.addSignal(
      monitor,
      monitor.connect(
        "notify::offline-update-pending",
        (monitor: UpdateMonitor) => {
          if (monitor.offline_update_pending) {
            notifications.notifyNewPendingUpdate();
          }
        },
      ),
    );
    destroyer.addSignal(
      controller,
      controller.connect(
        "notify::backend",
        (controller: OfflineUpdateController) => {
          controller
            .getPackagesToUpdate()
            .then((packages) => {
              indicator.showPackages(packages);
            })
            .catch((error: unknown) => {
              log.error("Failed to get packages", error);
            });
        },
      ),
    );

    const cancelIfLowPower = (monitor: Gio.PowerProfileMonitor): void => {
      if (monitor.get_power_saver_enabled()) {
        log.log("Cancelling pending update due to low-power");
        controller
          .cancelPendingUpdate()
          .then((cancelled) => {
            if (cancelled) {
              notifications.notifyUpdateCancelledOnLowPower();
            }
          })
          .catch((error: unknown) => {
            notifications.notifyCancelFailed(error);
          });
      }
    };

    log.log("Monitoring for low-power condition");
    const powerMonitor = Gio.PowerProfileMonitor.dup_default();
    destroyer.addSignal(
      powerMonitor,
      powerMonitor.connect("notify::power-saver-enabled", cancelIfLowPower),
    );
    // If an offline becomes available while in powersave mode cancel it again
    destroyer.addSignal(
      controller,
      controller.connect(
        "notify::backend",
        (controller: OfflineUpdateController) => {
          if (controller.backend !== null) {
            destroyer.addTimeout(
              setTimeout(() => {
                cancelIfLowPower(powerMonitor);
              }, 3000),
            );
          }
        },
      ),
    );

    Main.panel.addToStatusArea(this.metadata.uuid, indicator);
  }
}
