// Copyright Sebastian Wiesner <sebastian@swsnr.de>
//
// Licensed under the EUPL
//
// See https://interoperable-europe.ec.europa.eu/collection/eupl/eupl-text-eupl-12

import GObject from "gi://GObject";
import GLib from "gi://GLib";
import Gio from "gi://Gio";

import type { ConsoleLike } from "resource:///org/gnome/shell/extensions/extension.js";

/**
 * The name of the file indicating a pending offline update.
 */
const UPDATE_FILENAME = "system-update";

/**
 * Directories in which the update file is created.
 */
const UPDATE_FILE_DIRECTORIES = ["/", "/etc"].map((d) =>
  Gio.File.new_for_path(d),
);

/**
 * Asynchronously check whether a file exists.
 *
 * @param file The file to check
 */
const fileExists = async (file: Gio.File): Promise<boolean> => {
  try {
    await file.query_info_async(
      Gio.FILE_ATTRIBUTE_STANDARD_TYPE,
      // We care for the file itself not its symlink target
      Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS,
      GLib.PRIORITY_DEFAULT,
      null,
    );
    return true;
  } catch (error) {
    if (
      error instanceof GLib.Error &&
      error.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND)
    ) {
      return false;
    }
    throw error;
  }
};

export const UpdateMonitor = GObject.registerClass(
  {
    Properties: {
      "offline-update-pending": GObject.ParamSpec.boolean(
        "offline-update-pending",
        null,
        null,
        GObject.ParamFlags.READABLE,
        false,
      ),
    },
  },
  /**
   * Monitor for pending system updates.
   *
   * @implements Destructible
   */
  class UpdateMonitor extends GObject.Object {
    _offlineUpdatePending = false;

    _monitors: [Gio.FileMonitor, number][] = [];

    _log: ConsoleLike;

    /**
     * Create a new monitor.
     *
     * @param log The logger to use
     */
    constructor(log: ConsoleLike) {
      super();

      this._log = log;

      for (const directory of UPDATE_FILE_DIRECTORIES) {
        log.debug("Monitoring", directory.get_uri());
        const monitor = directory.monitor(Gio.FileMonitorFlags.NONE, null);
        const handlerId = monitor.connect(
          "changed",
          (_monitor, file, _otherFile, eventType) => {
            log.debug("Changed", file.get_uri(), eventType);
            const events = [
              Gio.FileMonitorEvent.CREATED,
              Gio.FileMonitorEvent.DELETED,
            ];
            if (
              file.get_basename() === UPDATE_FILENAME &&
              events.includes(eventType)
            ) {
              this.checkPendingUpdate();
            }
          },
        );
        this._monitors.push([monitor, handlerId]);
      }

      this.checkPendingUpdate();
    }

    destroy() {
      for (const [monitor, handlerId] of this._monitors) {
        monitor.disconnect(handlerId);
        monitor.cancel();
      }
      this._monitors = [];
    }

    checkPendingUpdate() {
      Promise.all(
        UPDATE_FILE_DIRECTORIES.map((d) =>
          fileExists(d.get_child(UPDATE_FILENAME)),
        ),
      )
        .then((e) => {
          this._offlineUpdatePending = e.some((e) => e);
          this._log.log(
            "Systemd offline update pending?",
            this._offlineUpdatePending,
          );
          this.notify("offline-update-pending");
        })
        .catch((error) => {
          this._log.error("Failed to update indicator:", error);
        });
    }

    /**
     * Whether an offline update is pending
     */
    get offline_update_pending() {
      return this._offlineUpdatePending;
    }
  },
);

export type UpdateMonitor = InstanceType<typeof UpdateMonitor>;
