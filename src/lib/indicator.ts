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

import { Destructible } from "./destructible.js";
import { IconThemeLoader } from "./icons.js";
import { OfflineUpdateController } from "./offline-update/controller.js";

export const UpdateIndicator = GObject.registerClass(
  /**
   * An indicator for pending updates.
   */
  class UpdateIndicator extends PanelMenu.Button implements Destructible {
    private readonly _cancelItem: PopupMenuItem;

    /**
     * Create a new indicator for pending updates.
     *
     * @param iconLoader Load icons.
     * @param controller Control offline updates
     */
    constructor(
      iconLoader: IconThemeLoader,
      controller: OfflineUpdateController,
    ) {
      super(0, "Systemd Offline Update", false);
      if (!(this.menu instanceof PopupMenu)) {
        throw new Error("Menu not present!");
      }

      this.add_child(
        new St.Icon({
          styleClass: "system-status-icon",
          gicon: iconLoader.lookupIcon("up-arrow-in-a-star-symbolic"),
        }),
      );

      const operations = new PopupMenuSection();
      this._cancelItem = new PopupMenuItem(_("Cancel pending update"));
      this._cancelItem.connect("activate", () => {
        controller.cancelPendingUpdate();
      });
      operations.addMenuItem(this._cancelItem);
      this.menu.addMenuItem(operations);

      this._cancelItem.reactive = false;
      controller.connect("notify::backend", () => {
        this._cancelItem.reactive = controller.backend != null;
      });
    }
  },
);

export type UpdateIndicator = InstanceType<typeof UpdateIndicator>;
