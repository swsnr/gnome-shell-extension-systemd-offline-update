// Copyright Sebastian Wiesner <sebastian@swsnr.de>
//
// Licensed under the EUPL
//
// See https://interoperable-europe.ec.europa.eu/collection/eupl/eupl-text-eupl-12

import GLib from "gi://GLib";
import Gio from "gi://Gio";

import { ConsoleLike } from "resource:///org/gnome/shell/extensions/extension.js";

import { OfflineUpdateBackend, Package } from "../backend.js";

const IMPORTANT_PACKAGES: ReadonlySet<string> = new Set([
  // Mark kernel, initrd generator, and systemd as important, because these
  // might regress and require some attention.
  "linux",
  "linux-lts",
  "linux-zen",
  "linux-hardened",
  "mkinitcpio",
  "systemd",
  // Mark Gnome as important because major Gnome updates affect extensions, and
  // might ship cool new features
  "gdm",
  "gnome-shell",
  // Mark browsers as important, because these might need to updated ASAP to
  // address security issues.
  "firefox",
  "vivaldi",
]);

const parsePackage = (line: string): Package => {
  // Parse: smbclient 2:4.22.2-1 -> 2:4.22.3-1 [ignored]
  const match = /^([^ ]+) ([^ ]+) -> ([^ ]+)(?: .+)?$/.exec(line);
  if (!match) {
    throw new Error(`Failed to parse version from line: ${line}`);
  }
  const [_, name, oldVersion, newVersion] = match;
  if (!(name && oldVersion && newVersion)) {
    throw new Error(`Failed to extract data from line: ${line}`);
  }
  return {
    name,
    oldVersion,
    newVersion,
    important: IMPORTANT_PACKAGES.has(name),
  };
};

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

  async packages(): Promise<Package[]> {
    const cmd = ["pacman", "-Qu", "--color=never"];
    this.#log.log("Running command", cmd);

    const process = Gio.Subprocess.new(cmd, Gio.SubprocessFlags.STDOUT_PIPE);
    const [output, _] = await process.communicate_utf8_async(null, null);
    return output
      .split("\n")
      .filter((l) => !!l)
      .map(parsePackage);
  }
}
