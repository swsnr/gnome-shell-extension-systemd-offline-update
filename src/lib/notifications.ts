// Copyright Sebastian Wiesner <sebastian@swsnr.de>
//
// Licensed under the EUPL
//
// See https://interoperable-europe.ec.europa.eu/collection/eupl/eupl-text-eupl-12

import GLib from "gi://GLib";

import {
  gettext as _,
  type ConsoleLike,
} from "resource:///org/gnome/shell/extensions/extension.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import * as MessageTray from "resource:///org/gnome/shell/ui/messageTray.js";
import { IconThemeLoader } from "./icons.js";

/**
 * Notifications for this extension.
 */
export class Notifications {
  #log: ConsoleLike;

  #_notificationSource: MessageTray.Source | null = null;

  #iconLoader: IconThemeLoader;

  #updateNotification: MessageTray.Notification | null = null;

  constructor(log: ConsoleLike, iconLoader: IconThemeLoader) {
    this.#log = log;
    this.#iconLoader = iconLoader;
  }

  get #notificationSource(): MessageTray.Source {
    if (this.#_notificationSource == null) {
      const source = new MessageTray.Source({
        title: _("Systemd Offline Update"),
        icon: this.#iconLoader.lookupIcon("up-arrow-in-a-star-symbolic"),
        policy: new MessageTray.NotificationGenericPolicy(),
      });
      // Some sort of cargo-culting which seems to be required for sources.
      // See https://gjs.guide/extensions/topics/notifications.html#sources
      source.connect("destroy", () => {
        this.#_notificationSource = null;
      });
      this.#_notificationSource = source;
      Main.messageTray.add(source);
    }
    return this.#_notificationSource;
  }

  /**
   * Notify that a new offline update is pending.
   */
  notifyNewPendingUpdate(): void {
    if (this.#updateNotification != null) {
      // We're already showing a notification about the update, no need to show
      // it again.
      return;
    }
    this.#log.info("New offline update pending");
    const notification = new MessageTray.Notification({
      source: this.#notificationSource,
      title: _("New updates available!"),
      body: _("Reboot to apply updates"),
      urgency: MessageTray.Urgency.NORMAL,
    });
    notification.connect("destroy", () => {
      this.#updateNotification = null;
    });
    this.#updateNotification = notification;
    this.#notificationSource.addNotification(notification);
  }

  /**
   * Notify that cancelling an offline update failed.
   *
   * @param error The error which occurred
   */
  notifyCancelFailed(error: unknown): void {
    this.#log.warn("Failed to cancel pending offline update:", error);

    let details;
    if (error instanceof GLib.Error || error instanceof Error) {
      details = _("Error: %s").format(error.message);
    } else {
      details = _("No details available.");
    }
    Main.notifyError(_("Failed to cancel pending offline update"), details);
  }
}
