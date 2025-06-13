// Copyright Sebastian Wiesner <sebastian@swsnr.de>
//
// Licensed under the EUPL
//
// See https://interoperable-europe.ec.europa.eu/collection/eupl/eupl-text-eupl-12

import Gio from "gi://Gio";

export interface OfflineUpdateBackend {
  /**
   * The name of this backend, for logging and debugging.
   */
  readonly name: string;

  /**
   *
   * @param file The update file
   */
  isSupported(file: Gio.File): Promise<boolean>;

  /**
   * Cancel a pending offline update.
   */
  cancel(): Promise<void>;
}
