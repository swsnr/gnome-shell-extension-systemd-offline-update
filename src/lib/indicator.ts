// Copyright Sebastian Wiesner <sebastian@swsnr.de>
//
// Licensed under the EUPL
//
// See https://interoperable-europe.ec.europa.eu/collection/eupl/eupl-text-eupl-12

import GObject from "gi://GObject";
import St from "gi://St";

import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";
import {
  PopupMenu,
  PopupMenuItem,
  PopupMenuSection,
} from "resource:///org/gnome/shell/ui/popupMenu.js";
import { ConsoleLike } from "resource:///org/gnome/shell/extensions/extension.js";

import { Destructible } from "./destructible.js";
import { IconThemeLoader } from "./icons.js";
import { OfflineUpdateBackend } from "./backend.js";

export const UpdateIndicator = GObject.registerClass(
  {
    Properties: {
      "offline-update-backend":
        GObject.ParamSpec.jsobject<OfflineUpdateBackend | null>(
          "offline-update-backend",
          null,
          null,
          GObject.ParamFlags.READWRITE,
        ),
    },
  },
  /**
   * An indicator for pending updates.
   */
  class UpdateIndicator extends PanelMenu.Button implements Destructible {
    private _backend: OfflineUpdateBackend | null = null;

    private readonly _log: ConsoleLike;

    private readonly _cancelItem: PopupMenuItem;

    /**
     * Create a new indicator for pending updates.
     *
     * @param iconLoader Load icons.
     */
    constructor(iconLoader: IconThemeLoader, log: ConsoleLike) {
      super(0, "Systemd Offline Update", false);
      if (!(this.menu instanceof PopupMenu)) {
        throw new Error("Menu not present!");
      }

      this._log = log;

      this.add_child(
        new St.Icon({
          styleClass: "system-status-icon",
          gicon: iconLoader.lookupIcon("up-arrow-in-a-star-symbolic"),
        }),
      );

      const operations = new PopupMenuSection();
      this._cancelItem = new PopupMenuItem(_("Cancel pending update"));
      this._cancelItem.connect("activate", () => {
        this._backend?.cancel().catch((error) => {
          this._log.warn("Failed to cancel offline update", error);
        });
      });
      operations.addMenuItem(this._cancelItem);
      this.menu.addMenuItem(operations);

      this._cancelItem.reactive = false;
    }

    get offline_update_backend(): OfflineUpdateBackend | null {
      return this._backend;
    }

    set offline_update_backend(
      backend: OfflineUpdateBackend | null | undefined,
    ) {
      this._backend = backend ?? null;

      this._cancelItem.reactive = this._backend != null;
    }
  },
);

export type UpdateIndicator = InstanceType<typeof UpdateIndicator>;
