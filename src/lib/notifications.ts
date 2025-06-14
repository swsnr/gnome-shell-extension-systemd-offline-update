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
        // Translators: Translate according to systemd.offline-updates(7)
        // If this manpage isn't translated to your language, leave as is.
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
    const notification = this.#showNotification({
      title: _("New updates available!"),
      body: _("Reboot to apply updates"),
      urgency: MessageTray.Urgency.NORMAL,
    });
    notification.connect("destroy", () => {
      this.#updateNotification = null;
    });
    this.#updateNotification = notification;
  }

  /**
   * Notify that a pending update was cancelled because the system is in power save.
   */
  notifyUpdateCancelledOnLowPower(): void {
    // Destroy any current notification about a new update.
    this.#updateNotification?.destroy();
    this.#updateNotification = null;
    this.#showNotification({
      title: _("Update cancelled"),
      body: _("Update cancelled because the system is in power save mode"),
      urgency: MessageTray.Urgency.NORMAL,
    });
  }

  /**
   * Notify that cancelling an offline update failed.
   *
   * @param error The error which occurred
   */
  notifyCancelFailed(error: unknown): void {
    this.#log.warn("Failed to cancel pending offline update:", error);

    let body;
    if (error instanceof GLib.Error || error instanceof Error) {
      body = _("Error: %s").format(error.message);
    } else {
      body = _("No details available.");
    }
    this.#showNotification({
      title: _("Failed to cancel pending offline update"),
      body,
      isTransient: true,
    });
  }

  #showNotification(
    props: MessageTray.Notification.ConstructorProps,
  ): MessageTray.Notification {
    const notification = new MessageTray.Notification({
      source: this.#notificationSource,
      ...props,
    });
    this.#notificationSource.addNotification(notification);
    return notification;
  }
}
