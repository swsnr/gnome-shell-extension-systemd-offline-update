// Copyright Sebastian Wiesner <sebastian@swsnr.de>
//
// Licensed under the EUPL
//
// See https://interoperable-europe.ec.europa.eu/collection/eupl/eupl-text-eupl-12

import GLib from "gi://GLib";
import Gio from "gi://Gio";

/**
 * Asynchronously check whether a file exists.
 *
 * @param file The file to check
 */
export const fileExists = async (file: Gio.File): Promise<boolean> => {
  try {
    await file.query_info_async(
      Gio.FILE_ATTRIBUTE_STANDARD_TYPE,
      // We care for the file itself not its symlink target
      Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS,
      GLib.PRIORITY_DEFAULT,
      null,
    );
    return true;
  } catch (error) {
    if (
      error instanceof GLib.Error &&
      error.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND)
    ) {
      return false;
    }
    throw error;
  }
};
