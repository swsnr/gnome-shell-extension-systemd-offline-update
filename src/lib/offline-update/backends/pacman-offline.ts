// Copyright Sebastian Wiesner <sebastian@swsnr.de>
//
// Licensed under the EUPL
//
// See https://interoperable-europe.ec.europa.eu/collection/eupl/eupl-text-eupl-12

import GLib from "gi://GLib";
import Gio from "gi://Gio";

import { ConsoleLike } from "resource:///org/gnome/shell/extensions/extension.js";

import { OfflineUpdateBackend } from "../backend.js";

export class PacmanOfflineBackend implements OfflineUpdateBackend {
  readonly #log: ConsoleLike;

  readonly name = "pacman-offline";

  constructor(log: ConsoleLike) {
    this.#log = log;
  }

  async isSupported(file: Gio.File): Promise<boolean> {
    const info = await file.query_info_async(
      Gio.FILE_ATTRIBUTE_STANDARD_SYMLINK_TARGET,
      Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS,
      GLib.PRIORITY_DEFAULT,
      null,
    );
    const target = info.get_symlink_target();
    if (target == null) {
      return false;
    }

    return Gio.File.new_for_path(target).equal(
      Gio.File.new_for_path("/var/cache/pacman/pkg"),
    );
  }

  async cancel(): Promise<void> {
    const cmd = ["/usr/bin/pacman-offline", "-a"];
    this.#log.log("Running command", cmd);

    const process = Gio.Subprocess.new(
      cmd,
      Gio.SubprocessFlags.STDOUT_SILENCE | Gio.SubprocessFlags.STDERR_SILENCE,
    );
    if (!(await process.wait_check_async(null))) {
      throw new Error("Command pacman-offline -a failed!");
    }
  }
}
