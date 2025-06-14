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

/**
 * Notifications for this extension.
 */
export class Notifications {
  #log: ConsoleLike;

  constructor(log: ConsoleLike) {
    this.#log = log;
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
