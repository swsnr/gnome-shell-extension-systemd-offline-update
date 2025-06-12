// Copyright Sebastian Wiesner <sebastian@swsnr.de>
//
// Licensed under the EUPL
//
// See https://interoperable-europe.ec.europa.eu/collection/eupl/eupl-text-eupl-12

import GObject from "gi://GObject";
import St from "gi://St";

import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";

import { Destructible } from "./destructible.js";
import { IconThemeLoader } from "./icons.js";

export const UpdateIndicator = GObject.registerClass(
  /**
   * An indicator for pending updates.
   */
  class UpdateIndicator extends PanelMenu.Button implements Destructible {
    /**
     * Create a new indicator for pending updates.
     *
     * @param iconLoader Load icons.
     */
    constructor(iconLoader: IconThemeLoader) {
      super(0, "Systemd Offline Update", true);

      this.add_child(
        new St.Icon({
          styleClass: "system-status-icon",
          gicon: iconLoader.lookupIcon("up-arrow-in-a-star-symbolic"),
        }),
      );

      this.setSensitive(false);
    }
  },
);

export type UpdateIndicator = InstanceType<typeof UpdateIndicator>;
