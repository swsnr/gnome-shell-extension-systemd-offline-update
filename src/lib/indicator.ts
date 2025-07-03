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
  PopupSeparatorMenuItem,
} from "resource:///org/gnome/shell/ui/popupMenu.js";
import {
  gettext as _,
  ngettext,
} from "resource:///org/gnome/shell/extensions/extension.js";

import { Destructible } from "./destructible.js";
import { IconThemeLoader } from "./icons.js";
import { OfflineUpdateController } from "./offline-update/controller.js";
import { Notifications } from "./notifications.js";
import { Package } from "./offline-update/backend.js";

export const UpdateIndicator = GObject.registerClass(
  /**
   * An indicator for pending updates.
   */
  class UpdateIndicator extends PanelMenu.Button implements Destructible {
    private _packagesSection = new PopupMenuSection();

    /**
     * Create a new indicator for pending updates.
     *
     * @param iconLoader Load icons.
     * @param controller Control offline updates
     * @param notifications Notifications for this extension
     */
    constructor(
      iconLoader: IconThemeLoader,
      controller: OfflineUpdateController,
      notifications: Notifications,
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
      const cancelItem = new PopupMenuItem(_("Cancel pending update"));
      cancelItem.connect("activate", () => {
        controller.cancelPendingUpdate().catch((error: unknown) => {
          notifications.notifyCancelFailed(error);
        });
      });
      operations.addMenuItem(cancelItem);
      this.menu.addMenuItem(operations);

      cancelItem.reactive = false;
      controller.connect("notify::backend", () => {
        cancelItem.reactive = controller.backend != null;
      });

      this.menu.addMenuItem(new PopupSeparatorMenuItem());
      this.menu.addMenuItem(this._packagesSection);
    }

    showPackages(packages: Package[] | null): void {
      if (packages) {
        packages.sort((a, b): number => {
          if (!a.important && b.important) {
            return 1;
          } else if (a.important && !b.important) {
            return -1;
          } else {
            return 0;
          }
        });
        const displayLimit = 10;
        for (const pkg of packages.slice(0, displayLimit)) {
          const item = new PopupMenuItem(`${pkg.name} (-> ${pkg.newVersion})`);
          item.sensitive = false;
          if (pkg.important) {
            item.add_style_class_name("offline-update-important-update");
          }
          this._packagesSection.addMenuItem(item);
        }
        if (displayLimit < packages.length) {
          const remaining = packages.length - displayLimit;
          const item = new PopupMenuItem(
            ngettext(
              "+ one more package",
              "+ %s more packages",
              remaining,
            ).format(remaining),
          );
          item.sensitive = false;
          this._packagesSection.addMenuItem(item);
        }
        if (packages.some((p) => p.important)) {
          this.add_style_class_name("offline-update-important-update");
        } else {
          this.remove_style_class_name("offline-update-important-update");
        }
      } else {
        this.remove_style_class_name("offline-update-important-update");
        this._packagesSection.removeAll();
      }
    }
  },
);

export type UpdateIndicator = InstanceType<typeof UpdateIndicator>;
