// Copyright Sebastian Wiesner <sebastian@swsnr.de>
//
// Licensed under the EUPL
//
// See https://interoperable-europe.ec.europa.eu/collection/eupl/eupl-text-eupl-12

import GObject from "gi://GObject";
import Gio from "gi://Gio";

import type { ConsoleLike } from "resource:///org/gnome/shell/extensions/extension.js";

import { OfflineUpdateBackend } from "./backend.js";
import { fileExists } from "../io.js";

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
      "offline-update-backend":
        GObject.ParamSpec.jsobject<OfflineUpdateBackend | null>(
          "offline-update-backend",
          null,
          null,
          GObject.ParamFlags.READABLE,
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

    _backend: OfflineUpdateBackend | null = null;

    _monitors: [Gio.FileMonitor, number][] = [];

    readonly _backends: readonly OfflineUpdateBackend[] = [];

    readonly _log: ConsoleLike;

    /**
     * Create a new monitor.
     *
     * @param log The logger to use
     */
    constructor(log: ConsoleLike, backends: readonly OfflineUpdateBackend[]) {
      super();

      this._log = log;
      this._backends = backends;

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
      this.checkPendingUpdateAsync().catch((error: unknown) => {
        this._log.error("Failed to check for pending update:", error);
      });
    }

    private async checkPendingUpdateAsync() {
      const updateFile = (
        await Promise.all(
          UPDATE_FILE_DIRECTORIES.map(async (directory) => {
            const file = directory.get_child(UPDATE_FILENAME);
            return (await fileExists(file)) ? file : null;
          }),
        )
      ).find((file) => file !== null);

      const updatePending = updateFile != null;
      if (this._offlineUpdatePending !== updatePending) {
        this._offlineUpdatePending = updatePending;
        this._log.log(
          "Systemd offline update pending?",
          this._offlineUpdatePending,
        );
        this.notify("offline-update-pending");

        if (updateFile != null) {
          const backends = await Promise.all(
            this._backends.map(async (backend) => {
              try {
                return (await backend.isSupported(updateFile)) ? backend : null;
              } catch (error) {
                this._log.warn("Backend failed", backend.name, error);
                return null;
              }
            }),
          );
          this._backend = backends.find((backend) => backend != null) ?? null;
          this._log.log(
            "Found backend for offline update",
            this._backend?.name,
          );
          this.notify("offline-update-backend");
        } else {
          this._backend = null;
          this.notify("offline-update-backend");
        }
      }
    }

    /**
     * Whether an offline update is pending
     */
    get offline_update_pending(): boolean {
      return this._offlineUpdatePending;
    }

    /**
     * A backend to control a pending offline update.
     */
    get offline_update_backend(): OfflineUpdateBackend | null {
      return this._backend;
    }
  },
);

export type UpdateMonitor = InstanceType<typeof UpdateMonitor>;
